#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const MAX_CONSECUTIVE_MISSES = 3;

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadLocalEnv() {
  const cwd = process.cwd();
  loadEnvFile(path.join(cwd, ".env.local"));
  loadEnvFile(path.join(cwd, ".env"));
}

function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const options = {};

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    i += 1;
  }

  return { command, options };
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function intOption(options, key, fallback) {
  if (options[key] === undefined) return fallback;
  const parsed = Number.parseInt(String(options[key]), 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer for --${key}: ${String(options[key])}`);
  }
  return parsed;
}

function randomInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function randomPassword() {
  return `Sim-${randomBytes(12).toString("hex")}!`;
}

function randomElement(items) {
  const idx = Math.floor(Math.random() * items.length);
  return items[idx];
}

function pickRandomDistinct(items, count) {
  const copy = [...items];
  const selected = [];
  while (copy.length > 0 && selected.length < count) {
    const idx = Math.floor(Math.random() * copy.length);
    selected.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return selected;
}

async function findUserByEmail(admin, email) {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 200;

  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return match;

    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

async function ensureProfile(admin, userId, usernameFallback) {
  const { data: existing, error: selectError } = await admin
    .from("profiles")
    .select("id, username")
    .eq("id", userId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Failed to read profile ${userId}: ${selectError.message}`);
  }

  if (!existing) {
    const payload = {
      id: userId,
      username: usernameFallback ?? null,
      avatar_url: null,
    };
    const { error: insertError } = await admin.from("profiles").insert(payload);
    if (insertError) {
      throw new Error(`Failed to create profile ${userId}: ${insertError.message}`);
    }
    return;
  }

  if (!existing.username && usernameFallback) {
    const { error: updateError } = await admin
      .from("profiles")
      .update({ username: usernameFallback })
      .eq("id", userId);
    if (updateError) {
      throw new Error(`Failed to set username for ${userId}: ${updateError.message}`);
    }
  }
}

async function resolveHostUserId(admin, options) {
  if (options["host-id"]) return String(options["host-id"]);

  const hostEmail = options["host-email"] ?? process.env.SIM_HOST_EMAIL;
  if (!hostEmail) {
    throw new Error(
      "Provide --host-email (or --host-id). Example: --host-email you@gmail.com"
    );
  }

  const user = await findUserByEmail(admin, String(hostEmail));
  if (!user) {
    throw new Error(
      `No auth user found for ${hostEmail}. Sign in once with Google, then run setup again.`
    );
  }

  return user.id;
}

async function createLeague(admin, { hostId, leagueName, season }) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const leagueId = randomUUID();
    const inviteCode = randomInviteCode();
    const { error } = await admin.from("leagues").insert({
      id: leagueId,
      host_id: hostId,
      name: leagueName,
      season,
      invite_code: inviteCode,
    });
    if (!error) return { id: leagueId, invite_code: inviteCode, name: leagueName, season };
    if (error.code === "23505") continue;
    throw new Error(`Failed to create league: ${error.message}`);
  }
  throw new Error("Could not create league (invite code collisions)");
}

async function resolveLeague(admin, options) {
  if (!options["league-id"] && !options["invite-code"]) {
    throw new Error("Provide --league-id or --invite-code");
  }

  let query = admin.from("leagues").select("id, invite_code, name, season, host_id");
  if (options["league-id"]) {
    query = query.eq("id", String(options["league-id"]));
  } else {
    query = query.eq("invite_code", String(options["invite-code"]).toUpperCase());
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Failed to load league: ${error.message}`);
  if (!data) throw new Error("League not found");
  return data;
}

async function upsertLeagueMembers(admin, leagueId, userIds) {
  const rows = userIds.map((userId) => ({
    league_id: leagueId,
    user_id: userId,
    is_eliminated: false,
    eliminated_at_episode: null,
  }));

  const { error } = await admin
    .from("league_members")
    .upsert(rows, { onConflict: "league_id,user_id", ignoreDuplicates: true });

  if (error) {
    throw new Error(`Failed to upsert league memberships: ${error.message}`);
  }
}

async function getUserById(admin, userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) {
    throw new Error(`Failed to read auth user ${userId}: ${error.message}`);
  }
  return data.user ?? null;
}

function isSimBotEmail(email) {
  const lower = (email ?? "").toLowerCase();
  return lower.endsWith("@local.test") && lower.includes("pys-bot-");
}

async function resolveSeedUserIds(
  admin,
  { leagueId, hostId, includeHost, botsOnly }
) {
  const { data: members, error } = await admin
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("is_eliminated", false);

  if (error) {
    throw new Error(`Failed to load league members: ${error.message}`);
  }

  let userIds = [...new Set((members ?? []).map((m) => m.user_id))];

  if (botsOnly) {
    const botIds = [];
    for (const userId of userIds) {
      if (userId === hostId) continue;
      const authUser = await getUserById(admin, userId);
      if (isSimBotEmail(authUser?.email)) {
        botIds.push(userId);
      }
    }
    userIds = botIds;
  } else if (!includeHost) {
    userIds = userIds.filter((userId) => userId !== hostId);
  }

  if (includeHost && !userIds.includes(hostId)) {
    userIds.push(hostId);
  }

  return userIds;
}

async function createBotUsers(admin, count) {
  const created = [];
  const runTag = Date.now().toString(36);

  for (let i = 1; i <= count; i++) {
    const username = `Bot ${i}`;
    const email = `pys-bot-${runTag}-${i}@local.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: {
        avatar_url: null,
      },
    });
    if (error || !data?.user) {
      throw new Error(`Failed to create bot user ${email}: ${error?.message ?? "unknown"}`);
    }

    await ensureProfile(admin, data.user.id, username);
    created.push({
      id: data.user.id,
      email,
      username,
    });
  }

  return created;
}

async function getEpisode(admin, options) {
  const seasonEpisodeNumber = options.episode
    ? intOption(options, "episode", 0)
    : null;

  if (seasonEpisodeNumber !== null) {
    const { data, error } = await admin
      .from("episodes")
      .select("id, number, title, air_date, is_complete")
      .eq("number", seasonEpisodeNumber)
      .maybeSingle();
    if (error) throw new Error(`Failed to load episode ${seasonEpisodeNumber}: ${error.message}`);
    if (!data) throw new Error(`Episode ${seasonEpisodeNumber} not found`);
    return data;
  }

  const { data, error } = await admin
    .from("episodes")
    .select("id, number, title, air_date, is_complete")
    .eq("is_complete", false)
    .order("number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load current episode: ${error.message}`);
  if (!data) throw new Error("No open episode found");
  return data;
}

async function getEpisodesForSeeding(admin, options, weeks) {
  const startEpisode = await getEpisode(admin, options);
  const maxWeeks = Math.max(1, weeks);

  const { data: episodes, error } = await admin
    .from("episodes")
    .select("id, number, title, air_date, is_complete")
    .eq("is_complete", false)
    .gte("number", startEpisode.number)
    .order("number", { ascending: true })
    .limit(maxWeeks);

  if (error) {
    throw new Error(`Failed to load episodes for seeding: ${error.message}`);
  }

  return episodes ?? [];
}

async function setEpisodeOpen(admin, episodeId) {
  const openAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin
    .from("episodes")
    .update({ air_date: openAt, is_complete: false })
    .eq("id", episodeId);
  if (error) throw new Error(`Failed to update episode timing: ${error.message}`);
  return openAt;
}

async function setEpisodeRevealed(admin, episodeId) {
  const revealAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { error } = await admin
    .from("episodes")
    .update({ air_date: revealAt })
    .eq("id", episodeId);
  if (error) throw new Error(`Failed to reveal episode picks: ${error.message}`);
  return revealAt;
}

async function seedEpisodePicks(admin, { leagueId, episodeId, userIds, season }) {
  if (userIds.length === 0) return { inserted: 0, skipped: 0 };

  const { data: contestants, error: contestantsError } = await admin
    .from("contestants")
    .select("id, name")
    .eq("season", season)
    .eq("is_eliminated", false);
  if (contestantsError) {
    throw new Error(`Failed to load contestants: ${contestantsError.message}`);
  }

  const { data: priorPicks, error: picksError } = await admin
    .from("picks")
    .select("id, user_id, episode_id, contestant_id")
    .eq("league_id", leagueId)
    .in("user_id", userIds);
  if (picksError) throw new Error(`Failed to load prior picks: ${picksError.message}`);

  const { error: deleteError } = await admin
    .from("picks")
    .delete()
    .eq("league_id", leagueId)
    .eq("episode_id", episodeId)
    .in("user_id", userIds);
  if (deleteError) {
    throw new Error(`Failed to clear existing picks for target episode: ${deleteError.message}`);
  }

  const usedByUser = new Map();
  for (const pick of priorPicks ?? []) {
    if (pick.episode_id === episodeId) continue;
    if (!usedByUser.has(pick.user_id)) usedByUser.set(pick.user_id, new Set());
    usedByUser.get(pick.user_id).add(pick.contestant_id);
  }

  const rows = [];
  let skipped = 0;
  for (const userId of userIds) {
    const usedIds = usedByUser.get(userId) ?? new Set();
    const available = (contestants ?? []).filter((c) => !usedIds.has(c.id));
    if (available.length === 0) {
      skipped += 1;
      continue;
    }

    const pick = randomElement(available);
    rows.push({
      league_id: leagueId,
      user_id: userId,
      episode_id: episodeId,
      contestant_id: pick.id,
    });
  }

  if (rows.length > 0) {
    const { error: insertError } = await admin.from("picks").insert(rows);
    if (insertError) throw new Error(`Failed to insert picks: ${insertError.message}`);
  }

  return { inserted: rows.length, skipped };
}

async function markLeagueMembersEliminated(admin, leagueId, userIds, episodeNumber) {
  if (userIds.length === 0) return;
  const { error } = await admin
    .from("league_members")
    .update({
      is_eliminated: true,
      eliminated_at_episode: episodeNumber,
    })
    .eq("league_id", leagueId)
    .eq("is_eliminated", false)
    .in("user_id", userIds);
  if (error) {
    throw new Error(`Failed to eliminate league members: ${error.message}`);
  }
}

async function advanceEpisode(admin, { leagueId, season, episode, eliminatedCount }) {
  const revealAt = await setEpisodeRevealed(admin, episode.id);

  const { data: activeContestants, error: activeContestantsError } = await admin
    .from("contestants")
    .select("id, name")
    .eq("season", season)
    .eq("is_eliminated", false);
  if (activeContestantsError) {
    throw new Error(`Failed to load active contestants: ${activeContestantsError.message}`);
  }

  const eliminatedContestants = pickRandomDistinct(
    activeContestants ?? [],
    Math.max(1, Math.min(eliminatedCount, (activeContestants ?? []).length))
  );

  if (eliminatedContestants.length > 0) {
    const eliminatedIds = eliminatedContestants.map((c) => c.id);
    const { error: contestantUpdateError } = await admin
      .from("contestants")
      .update({
        is_eliminated: true,
        eliminated_at_episode: episode.number,
      })
      .in("id", eliminatedIds);
    if (contestantUpdateError) {
      throw new Error(`Failed to update eliminated contestants: ${contestantUpdateError.message}`);
    }
  }

  const { error: episodeUpdateError } = await admin
    .from("episodes")
    .update({
      is_complete: true,
      air_date: revealAt,
    })
    .eq("id", episode.id);
  if (episodeUpdateError) {
    throw new Error(`Failed to mark episode complete: ${episodeUpdateError.message}`);
  }

  const eliminatedIds = eliminatedContestants.map((c) => c.id);
  let eliminatedByPickUserIds = [];
  if (eliminatedIds.length > 0) {
    const { data: badPicks, error: badPicksError } = await admin
      .from("picks")
      .select("user_id")
      .eq("league_id", leagueId)
      .eq("episode_id", episode.id)
      .in("contestant_id", eliminatedIds);
    if (badPicksError) {
      throw new Error(`Failed to read bad picks: ${badPicksError.message}`);
    }
    eliminatedByPickUserIds = [...new Set((badPicks ?? []).map((p) => p.user_id))];
    await markLeagueMembersEliminated(
      admin,
      leagueId,
      eliminatedByPickUserIds,
      episode.number
    );
  }

  const { data: activeMembers, error: activeMembersError } = await admin
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("is_eliminated", false);
  if (activeMembersError) {
    throw new Error(`Failed to load active members: ${activeMembersError.message}`);
  }

  const activeUserIds = (activeMembers ?? []).map((m) => m.user_id);
  let eliminatedByMisses = [];
  if (activeUserIds.length > 0) {
    const { data: episodes, error: episodesError } = await admin
      .from("episodes")
      .select("id, number")
      .lte("number", episode.number)
      .order("number", { ascending: true });
    if (episodesError) throw new Error(`Failed to load episodes: ${episodesError.message}`);

    const { data: memberPicks, error: memberPicksError } = await admin
      .from("picks")
      .select("user_id, episode_id, contestant_id")
      .eq("league_id", leagueId)
      .in("user_id", activeUserIds);
    if (memberPicksError) {
      throw new Error(`Failed to load member picks: ${memberPicksError.message}`);
    }

    const picksByUser = new Map();
    for (const pick of memberPicks ?? []) {
      if (!picksByUser.has(pick.user_id)) picksByUser.set(pick.user_id, []);
      picksByUser.get(pick.user_id).push(pick);
    }

    const episodeByNumber = new Map((episodes ?? []).map((e) => [e.number, e.id]));
    eliminatedByMisses = activeUserIds.filter((userId) => {
      const userPicks = picksByUser.get(userId) ?? [];
      let misses = 0;
      for (let ep = episode.number; ep >= 1; ep--) {
        const epId = episodeByNumber.get(ep);
        if (!epId) continue;
        const hasPick = userPicks.some((p) => p.episode_id === epId);
        if (hasPick) break;
        misses += 1;
      }
      return misses >= MAX_CONSECUTIVE_MISSES;
    });

    await markLeagueMembersEliminated(admin, leagueId, eliminatedByMisses, episode.number);
  }

  const { data: stillActiveMembers, error: stillActiveMembersError } = await admin
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("is_eliminated", false);
  if (stillActiveMembersError) {
    throw new Error(`Failed to read remaining active members: ${stillActiveMembersError.message}`);
  }

  const remainingActiveUserIds = (stillActiveMembers ?? []).map((m) => m.user_id);
  let eliminatedByNoOptions = [];
  if (remainingActiveUserIds.length > 0) {
    const { data: remainingContestants, error: remainingContestantsError } = await admin
      .from("contestants")
      .select("id")
      .eq("season", season)
      .eq("is_eliminated", false);
    if (remainingContestantsError) {
      throw new Error(
        `Failed to load remaining contestants: ${remainingContestantsError.message}`
      );
    }

    const remainingContestantIds = new Set((remainingContestants ?? []).map((c) => c.id));
    const { data: allMemberPicks, error: allMemberPicksError } = await admin
      .from("picks")
      .select("user_id, contestant_id")
      .eq("league_id", leagueId)
      .in("user_id", remainingActiveUserIds);
    if (allMemberPicksError) {
      throw new Error(`Failed to read all member picks: ${allMemberPicksError.message}`);
    }

    const usedByUser = new Map();
    for (const pick of allMemberPicks ?? []) {
      if (!usedByUser.has(pick.user_id)) usedByUser.set(pick.user_id, new Set());
      usedByUser.get(pick.user_id).add(pick.contestant_id);
    }

    eliminatedByNoOptions = remainingActiveUserIds.filter((userId) => {
      const used = usedByUser.get(userId) ?? new Set();
      for (const contestantId of remainingContestantIds) {
        if (!used.has(contestantId)) return false;
      }
      return true;
    });
    await markLeagueMembersEliminated(
      admin,
      leagueId,
      eliminatedByNoOptions,
      episode.number
    );
  }

  return {
    revealAt,
    eliminatedContestants: eliminatedContestants.map((c) => c.name),
    eliminatedByPickCount: eliminatedByPickUserIds.length,
    eliminatedByMissesCount: eliminatedByMisses.length,
    eliminatedByNoOptionsCount: eliminatedByNoOptions.length,
  };
}

function printHelp() {
  console.log(`
Local Simulation CLI

Usage:
  node scripts/local-sim.mjs <command> [options]

Commands:
  setup    Create bots, join a league, and seed random picks for an open episode
  seed     Seed picks for bots (or active members) for one or more upcoming episodes
  reveal   Move an episode air_date to the past so picks are visible to everyone
  advance  Reveal + complete an episode and apply eliminations in a league

Examples:
  node scripts/local-sim.mjs setup --host-email you@gmail.com --players 8
  node scripts/local-sim.mjs seed --league-id <league-id> --weeks 3
  node scripts/local-sim.mjs seed --league-id <league-id> --episode 5 --include-host-pick
  node scripts/local-sim.mjs setup --league-id <league-id> --host-email you@gmail.com --players 6
  node scripts/local-sim.mjs reveal --league-id <league-id>
  node scripts/local-sim.mjs advance --league-id <league-id> --eliminated 2

Common options:
  --episode <n>            Target episode number (default: first incomplete)
  --weeks <n>              Number of consecutive incomplete episodes to seed (seed command)
  --season <n>             Season number (default: 50)
`);
}

async function handleSetup(admin, options) {
  const hostUserId = await resolveHostUserId(admin, options);
  await ensureProfile(admin, hostUserId, null);

  const season = intOption(options, "season", 50);
  const players = intOption(options, "players", 8);
  if (players < 1) throw new Error("--players must be at least 1");

  let league;
  if (options["league-id"] || options["invite-code"]) {
    league = await resolveLeague(admin, options);
  } else {
    const leagueName =
      String(options["league-name"] ?? `Local Test League ${new Date().toLocaleDateString()}`);
    league = await createLeague(admin, {
      hostId: hostUserId,
      leagueName,
      season,
    });
  }

  const bots = await createBotUsers(admin, players);
  await upsertLeagueMembers(admin, league.id, [hostUserId, ...bots.map((b) => b.id)]);

  const episode = await getEpisode(admin, options);
  const openAt = await setEpisodeOpen(admin, episode.id);

  const includeHost = Boolean(options["include-host-pick"]);
  const userIdsToPick = includeHost
    ? [hostUserId, ...bots.map((b) => b.id)]
    : bots.map((b) => b.id);
  const pickSummary = await seedEpisodePicks(admin, {
    leagueId: league.id,
    episodeId: episode.id,
    userIds: userIdsToPick,
    season: league.season ?? season,
  });

  console.log("Setup complete.");
  console.log(`League: ${league.name} (${league.id})`);
  console.log(`Invite code: ${league.invite_code}`);
  console.log(`Bots created: ${bots.length}`);
  console.log(`Episode ${episode.number} opened until: ${openAt}`);
  console.log(`Picks seeded: ${pickSummary.inserted} (skipped: ${pickSummary.skipped})`);
  console.log("");
  console.log("Next steps:");
  console.log(`1) Open /league/${league.id} and verify only your picks are visible.`);
  console.log(`2) Run: npm run sim:reveal -- --league-id ${league.id} --episode ${episode.number}`);
  console.log("3) Refresh the league/history pages to verify multi-player reveal.");
}

async function handleReveal(admin, options) {
  const league = await resolveLeague(admin, options);
  const episode = await getEpisode(admin, options);
  const revealAt = await setEpisodeRevealed(admin, episode.id);

  console.log("Reveal complete.");
  console.log(`League: ${league.name} (${league.id})`);
  console.log(`Episode ${episode.number} air_date moved to: ${revealAt}`);
  console.log("Refresh /league and /history to verify picks are now visible.");
}

async function handleSeed(admin, options) {
  const league = await resolveLeague(admin, options);
  const weeks = intOption(options, "weeks", 1);
  const season = intOption(options, "season", league.season ?? 50);
  const includeHost = Boolean(options["include-host-pick"]);
  const botsOnly = options["all-members"] ? false : true;

  const targetUserIds = await resolveSeedUserIds(admin, {
    leagueId: league.id,
    hostId: league.host_id,
    includeHost,
    botsOnly,
  });

  if (targetUserIds.length === 0) {
    throw new Error(
      "No eligible members to seed picks for. Use --all-members or run sim:setup first."
    );
  }

  const episodes = await getEpisodesForSeeding(admin, options, weeks);
  if (episodes.length === 0) {
    throw new Error("No open episodes found to seed");
  }

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const episode of episodes) {
    const openAt = await setEpisodeOpen(admin, episode.id);
    const summary = await seedEpisodePicks(admin, {
      leagueId: league.id,
      episodeId: episode.id,
      userIds: targetUserIds,
      season,
    });
    totalInserted += summary.inserted;
    totalSkipped += summary.skipped;
    console.log(
      `Seeded Episode ${episode.number}: inserted ${summary.inserted}, skipped ${summary.skipped}, open until ${openAt}`
    );
  }

  console.log("");
  console.log("Seed complete.");
  console.log(`League: ${league.name} (${league.id})`);
  console.log(`Episodes seeded: ${episodes.length}`);
  console.log(`Total picks inserted: ${totalInserted}`);
  console.log(`Total skipped (no available contestants): ${totalSkipped}`);
}

async function handleAdvance(admin, options) {
  const league = await resolveLeague(admin, options);
  const episode = await getEpisode(admin, options);
  const eliminatedCount = intOption(options, "eliminated", 1);
  const season = intOption(options, "season", league.season ?? 50);

  const summary = await advanceEpisode(admin, {
    leagueId: league.id,
    season,
    episode,
    eliminatedCount,
  });

  console.log("Advance complete.");
  console.log(`League: ${league.name} (${league.id})`);
  console.log(`Episode ${episode.number} marked complete.`);
  console.log(
    `Eliminated contestants: ${
      summary.eliminatedContestants.length > 0
        ? summary.eliminatedContestants.join(", ")
        : "none"
    }`
  );
  console.log(`Members eliminated by bad picks: ${summary.eliminatedByPickCount}`);
  console.log(`Members eliminated by missed weeks: ${summary.eliminatedByMissesCount}`);
  console.log(`Members eliminated by no options left: ${summary.eliminatedByNoOptionsCount}`);
}

async function main() {
  loadLocalEnv();
  const { command, options } = parseArgs(process.argv.slice(2));

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceRoleKey);

  if (command === "setup") {
    await handleSetup(admin, options);
    return;
  }
  if (command === "seed") {
    await handleSeed(admin, options);
    return;
  }
  if (command === "reveal") {
    await handleReveal(admin, options);
    return;
  }
  if (command === "advance") {
    await handleAdvance(admin, options);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`local-sim error: ${error.message}`);
  process.exit(1);
});
