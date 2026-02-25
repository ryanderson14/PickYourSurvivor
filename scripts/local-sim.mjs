#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const MAX_CONSECUTIVE_MISSES = 3;
const DEFAULT_EMAIL = "ryanpatrickanderson@gmail.com";
const DEFAULT_PLAYERS = 7;
const DEFAULT_EPISODES_TO_SIM = 3;
const DEFAULT_MISS_RATE = 0.25; // 25% chance a bot skips a week
const LEAGUE_ID = "00000000-0000-0000-0000-000000000050";
const INVITE_CODE = "PVRS50";

// Bot names — more fun than "Bot 1"
const BOT_NAMES = [
  "Jeff Probst Fan",
  "TorchSnuffer42",
  "TribalCouncil",
  "IdolHunter",
  "MergeOrBust",
  "BlindSided",
  "FinalTribal",
  "OutwitOutplay",
  "SurvivorSuperfan",
  "CoconutBandit",
];

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sep = trimmed.indexOf("=");
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(sep + 1).trim();
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

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
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

function intOption(options, key, fallback) {
  if (options[key] === undefined) return fallback;
  const parsed = Number.parseInt(String(options[key]), 10);
  if (Number.isNaN(parsed))
    throw new Error(`Invalid integer for --${key}: ${options[key]}`);
  return parsed;
}

function floatOption(options, key, fallback) {
  if (options[key] === undefined) return fallback;
  const parsed = Number.parseFloat(String(options[key]));
  if (Number.isNaN(parsed))
    throw new Error(`Invalid number for --${key}: ${options[key]}`);
  return parsed;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function randomPassword() {
  return `Sim-${randomBytes(12).toString("hex")}!`;
}

function randomElement(items) {
  return items[Math.floor(Math.random() * items.length)];
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

function log(msg) {
  console.log(`  ${msg}`);
}

function header(msg) {
  console.log(`\n▸ ${msg}`);
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------
async function clearTable(admin, tableName) {
  const { error } = await admin.from(tableName).delete().not("id", "is", null);
  if (error) throw new Error(`Failed to clear ${tableName}: ${error.message}`);
}

async function findUserByEmail(admin, email) {
  const target = email.toLowerCase();
  let page = 1;
  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return match;
    if (users.length < 200) break;
    page += 1;
  }
  return null;
}

async function ensureProfile(admin, userId, username) {
  const { data: existing } = await admin
    .from("profiles")
    .select("id, username")
    .eq("id", userId)
    .maybeSingle();

  if (!existing) {
    const { error } = await admin
      .from("profiles")
      .insert({ id: userId, username: username ?? null, avatar_url: null });
    if (error)
      throw new Error(`Failed to create profile ${userId}: ${error.message}`);
    return;
  }

  if (!existing.username && username) {
    await admin
      .from("profiles")
      .update({ username })
      .eq("id", userId);
  }
}

function isSimBotEmail(email) {
  const lower = (email ?? "").toLowerCase();
  return lower.endsWith("@local.test") && lower.includes("pys-bot-");
}

async function deleteAllSimBots(admin) {
  let page = 1;
  let deleted = 0;
  while (page <= 100) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) break;
    const users = data?.users ?? [];
    for (const user of users) {
      if (isSimBotEmail(user.email)) {
        await admin.auth.admin.deleteUser(user.id);
        deleted += 1;
      }
    }
    if (users.length < 200) break;
    page += 1;
  }
  return deleted;
}

// ---------------------------------------------------------------------------
// Seed data parsing (from seed.sql)
// ---------------------------------------------------------------------------
function decodeSqlString(value) {
  return value.replaceAll("''", "'");
}

function parseSeedSql(seedSql) {
  // Episodes
  const episodesMatch = seedSql.match(
    /INSERT\s+INTO\s+episodes\s*\(\s*number\s*,\s*title\s*,\s*air_date\s*\)\s*VALUES\s*([\s\S]*?);/i
  );
  if (!episodesMatch) throw new Error("No episode INSERT found in seed.sql");
  const episodes = [];
  const epRe =
    /\(\s*(\d+)\s*,\s*'((?:[^']|'{2})*)'\s*,\s*'((?:[^']|'{2})*)'\s*\)/g;
  let m;
  while ((m = epRe.exec(episodesMatch[1])) !== null) {
    episodes.push({
      number: Number.parseInt(m[1], 10),
      title: decodeSqlString(m[2]),
      air_date: decodeSqlString(m[3]),
      is_complete: false,
    });
  }

  // Contestants
  const contestants = [];
  const cInsertRe =
    /INSERT\s+INTO\s+contestants\s*\(\s*name\s*,\s*tribe\s*,\s*tribe_color\s*,\s*season\s*\)\s*VALUES\s*([\s\S]*?);/gi;
  let cMatch;
  while ((cMatch = cInsertRe.exec(seedSql)) !== null) {
    const cTupleRe =
      /\(\s*'((?:[^']|'{2})*)'\s*,\s*'((?:[^']|'{2})*)'\s*,\s*'((?:[^']|'{2})*)'\s*,\s*(\d+)\s*\)/g;
    let ct;
    while ((ct = cTupleRe.exec(cMatch[1])) !== null) {
      contestants.push({
        name: decodeSqlString(ct[1]),
        tribe: decodeSqlString(ct[2]),
        tribe_color: decodeSqlString(ct[3]),
        season: Number.parseInt(ct[4], 10),
        is_eliminated: false,
        eliminated_at_episode: null,
      });
    }
  }

  // Leagues
  const leagues = [];
  const lMatch = seedSql.match(
    /INSERT\s+INTO\s+leagues\s*\(\s*id\s*,\s*name\s*,\s*invite_code\s*,\s*season\s*\)\s*VALUES\s*([\s\S]*?);/i
  );
  if (lMatch) {
    const lRe =
      /\(\s*'((?:[^']|'{2})*)'\s*,\s*'((?:[^']|'{2})*)'\s*,\s*'((?:[^']|'{2})*)'\s*,\s*(\d+)\s*\)/g;
    let lt;
    while ((lt = lRe.exec(lMatch[1])) !== null) {
      leagues.push({
        id: decodeSqlString(lt[1]),
        name: decodeSqlString(lt[2]),
        invite_code: decodeSqlString(lt[3]),
        season: Number.parseInt(lt[4], 10),
        host_id: null,
      });
    }
  }

  return { episodes, contestants, leagues };
}

function loadSeedData() {
  const seedFile = path.join(process.cwd(), "supabase", "seed.sql");
  if (!existsSync(seedFile)) throw new Error(`Seed file not found: ${seedFile}`);
  return parseSeedSql(readFileSync(seedFile, "utf8"));
}

// ---------------------------------------------------------------------------
// Core simulation functions
// ---------------------------------------------------------------------------

/** Wipe all game data and re-insert seed data. Does NOT touch auth users. */
async function resetData(admin) {
  header("Resetting game data...");
  await clearTable(admin, "picks");
  await clearTable(admin, "league_members");
  await clearTable(admin, "leagues");
  await clearTable(admin, "contestants");
  await clearTable(admin, "episodes");

  const { episodes, contestants, leagues } = loadSeedData();

  const { error: epErr } = await admin.from("episodes").insert(episodes);
  if (epErr) throw new Error(`Failed to seed episodes: ${epErr.message}`);

  const { error: cErr } = await admin.from("contestants").insert(contestants);
  if (cErr) throw new Error(`Failed to seed contestants: ${cErr.message}`);

  if (leagues.length > 0) {
    const { error: lErr } = await admin.from("leagues").insert(leagues);
    if (lErr) throw new Error(`Failed to seed leagues: ${lErr.message}`);
  }

  log(`Episodes: ${episodes.length}`);
  log(`Contestants: ${contestants.length}`);
  log(`Leagues: ${leagues.length}`);
}

/** Create bot auth users and profiles. Returns array of { id, email, username }. */
async function createBots(admin, count) {
  const runTag = Date.now().toString(36);
  const bots = [];
  for (let i = 1; i <= count; i++) {
    const username = BOT_NAMES[i - 1] || `Bot ${i}`;
    const email = `pys-bot-${runTag}-${i}@local.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { avatar_url: null },
    });
    if (error || !data?.user)
      throw new Error(
        `Failed to create bot ${email}: ${error?.message ?? "unknown"}`
      );
    await ensureProfile(admin, data.user.id, username);
    bots.push({ id: data.user.id, email, username });
  }
  return bots;
}

/** Add users to a league (idempotent). */
async function addMembers(admin, leagueId, userIds) {
  const rows = userIds.map((user_id) => ({
    league_id: leagueId,
    user_id,
    is_eliminated: false,
    eliminated_at_episode: null,
  }));
  const { error } = await admin
    .from("league_members")
    .upsert(rows, { onConflict: "league_id,user_id", ignoreDuplicates: true });
  if (error)
    throw new Error(`Failed to add league members: ${error.message}`);
}

/**
 * Calculate how many picks a user owes for this episode.
 * Matches the app logic in src/lib/game-logic.ts getRequiredPicks():
 *   required = 1 + consecutive missed episodes immediately before this one
 */
function getRequiredPicks(userPicksByEpisodeId, pastEpisodeIds) {
  let consecutiveMisses = 0;
  for (let i = pastEpisodeIds.length - 1; i >= 0; i--) {
    const epId = pastEpisodeIds[i];
    if (!userPicksByEpisodeId.has(epId)) {
      consecutiveMisses++;
      continue;
    }
    break;
  }
  return 1 + consecutiveMisses;
}

/**
 * Seed picks for one episode with realistic miss patterns and makeup picks.
 *
 * When a player decides to pick this week, they submit:
 *   1 + consecutive missed episodes immediately before this one.
 * All picks are tied to the current episode, each a different unused contestant.
 *
 * @param missRate - probability [0,1] that a given bot skips this episode
 * @param forcePickUserIds - user IDs that must always pick (e.g. real user)
 * @param completedEpisodeIds - episode IDs completed before this one (for debt calc)
 */
async function seedPicksForEpisode(
  admin,
  { leagueId, episodeId, episodeNumber, userIds, season, missRate, forcePickUserIds, completedEpisodeIds }
) {
  if (userIds.length === 0) return { picked: [], missed: [], details: [] };

  // Load alive contestants
  const { data: contestants } = await admin
    .from("contestants")
    .select("id, name")
    .eq("season", season)
    .eq("is_eliminated", false);

  // Load all prior picks for these users in this league
  const { data: priorPicks } = await admin
    .from("picks")
    .select("user_id, episode_id, contestant_id")
    .eq("league_id", leagueId)
    .in("user_id", userIds);

  // Clear any existing picks for this episode
  await admin
    .from("picks")
    .delete()
    .eq("league_id", leagueId)
    .eq("episode_id", episodeId)
    .in("user_id", userIds);

  // Build per-user maps: used contestants + which episodes they have picks for
  const usedByUser = new Map();       // userId -> Set<contestantId>
  const pickEpsByUser = new Map();    // userId -> Set<episodeId>
  for (const pick of priorPicks ?? []) {
    if (pick.episode_id === episodeId) continue;
    if (!usedByUser.has(pick.user_id)) usedByUser.set(pick.user_id, new Set());
    usedByUser.get(pick.user_id).add(pick.contestant_id);
    if (!pickEpsByUser.has(pick.user_id)) pickEpsByUser.set(pick.user_id, new Set());
    pickEpsByUser.get(pick.user_id).add(pick.episode_id);
  }

  const pastEpisodeIds = completedEpisodeIds ?? [];
  const forceSet = new Set(forcePickUserIds ?? []);
  const rows = [];
  const picked = [];
  const missed = [];
  const details = [];

  for (const userId of userIds) {
    // Decide whether this user misses this week
    const mustPick = forceSet.has(userId);
    if (!mustPick && Math.random() < missRate) {
      missed.push(userId);
      continue;
    }

    // Calculate how many picks this user owes
    const userEps = pickEpsByUser.get(userId) ?? new Set();
    const required = getRequiredPicks(userEps, pastEpisodeIds);

    const usedIds = usedByUser.get(userId) ?? new Set();
    const available = (contestants ?? []).filter((c) => !usedIds.has(c.id));
    if (available.length === 0) {
      missed.push(userId);
      continue;
    }

    // Pick min(required, available) distinct contestants — all for this episode
    const pickCount = Math.min(required, available.length);
    const chosen = pickRandomDistinct(available, pickCount);

    for (const c of chosen) {
      rows.push({
        league_id: leagueId,
        user_id: userId,
        episode_id: episodeId,
        contestant_id: c.id,
      });
      // Track so later episodes in the same sim run respect these
      if (!usedByUser.has(userId)) usedByUser.set(userId, new Set());
      usedByUser.get(userId).add(c.id);
    }

    picked.push(userId);
    details.push({ userId, required, submitted: chosen.length });
  }

  if (rows.length > 0) {
    const { error } = await admin.from("picks").insert(rows);
    if (error) throw new Error(`Failed to insert picks: ${error.message}`);
  }

  return { picked, missed, details };
}

/** Advance an episode: reveal picks, eliminate contestants, eliminate players. */
async function advanceEpisode(
  admin,
  { leagueId, season, episode, eliminatedCount }
) {
  // Set air_date to past (reveals picks)
  const revealAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await admin
    .from("episodes")
    .update({ air_date: revealAt })
    .eq("id", episode.id);

  // Eliminate random contestant(s)
  const { data: activeContestants } = await admin
    .from("contestants")
    .select("id, name")
    .eq("season", season)
    .eq("is_eliminated", false);

  const eliminated = pickRandomDistinct(
    activeContestants ?? [],
    Math.min(eliminatedCount, (activeContestants ?? []).length)
  );

  if (eliminated.length > 0) {
    const ids = eliminated.map((c) => c.id);
    await admin
      .from("contestants")
      .update({
        is_eliminated: true,
        eliminated_at_episode: episode.number,
      })
      .in("id", ids);

    // Eliminate league members who picked the eliminated contestant
    const { data: badPicks } = await admin
      .from("picks")
      .select("user_id")
      .eq("league_id", leagueId)
      .eq("episode_id", episode.id)
      .in("contestant_id", ids);

    const badUserIds = [...new Set((badPicks ?? []).map((p) => p.user_id))];
    if (badUserIds.length > 0) {
      await admin
        .from("league_members")
        .update({
          is_eliminated: true,
          eliminated_at_episode: episode.number,
        })
        .eq("league_id", leagueId)
        .eq("is_eliminated", false)
        .in("user_id", badUserIds);
    }
  }

  // Mark episode complete
  await admin
    .from("episodes")
    .update({ is_complete: true, air_date: revealAt })
    .eq("id", episode.id);

  // Check for consecutive-miss eliminations
  const { data: activeMembers } = await admin
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("is_eliminated", false);
  const activeUserIds = (activeMembers ?? []).map((m) => m.user_id);

  if (activeUserIds.length > 0) {
    const { data: episodes } = await admin
      .from("episodes")
      .select("id, number")
      .lte("number", episode.number)
      .order("number", { ascending: true });

    const { data: memberPicks } = await admin
      .from("picks")
      .select("user_id, episode_id")
      .eq("league_id", leagueId)
      .in("user_id", activeUserIds);

    const picksByUser = new Map();
    for (const p of memberPicks ?? []) {
      if (!picksByUser.has(p.user_id)) picksByUser.set(p.user_id, new Set());
      picksByUser.get(p.user_id).add(p.episode_id);
    }

    const epById = new Map((episodes ?? []).map((e) => [e.number, e.id]));
    const missEliminated = activeUserIds.filter((uid) => {
      const userEps = picksByUser.get(uid) ?? new Set();
      let misses = 0;
      for (let n = episode.number; n >= 1; n--) {
        const epId = epById.get(n);
        if (!epId) continue;
        if (userEps.has(epId)) break;
        misses++;
      }
      return misses >= MAX_CONSECUTIVE_MISSES;
    });

    if (missEliminated.length > 0) {
      await admin
        .from("league_members")
        .update({
          is_eliminated: true,
          eliminated_at_episode: episode.number,
        })
        .eq("league_id", leagueId)
        .eq("is_eliminated", false)
        .in("user_id", missEliminated);
    }
  }

  return {
    eliminated: eliminated.map((c) => c.name),
  };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * sim:go — The all-in-one command.
 *
 * 1. Deletes old sim bots
 * 2. Wipes & reseeds game data
 * 3. Creates bots + adds you to the league
 * 4. Fast-forwards through N episodes with realistic pick patterns
 * 5. Opens the next episode for you to pick
 */
async function handleGo(admin, options) {
  const email = String(options.email ?? DEFAULT_EMAIL);
  const playerCount = intOption(options, "players", DEFAULT_PLAYERS);
  const episodesToSim = intOption(options, "episodes", DEFAULT_EPISODES_TO_SIM);
  const missRate = floatOption(options, "miss-rate", DEFAULT_MISS_RATE);
  const eliminatedPerEp = intOption(options, "eliminated", 1);

  console.log("╔══════════════════════════════════════════╗");
  console.log("║    Pick Your Survivor — Simulation       ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(
    `  Email: ${email} | Bots: ${playerCount} | Episodes: ${episodesToSim} | Miss rate: ${(missRate * 100).toFixed(0)}%`
  );

  // Step 1: Clean up old bots
  header("Cleaning up old sim bots...");
  const deletedBots = await deleteAllSimBots(admin);
  log(`Deleted ${deletedBots} old bot accounts`);

  // Step 2: Reset game data
  await resetData(admin);

  // Step 3: Find real user
  header("Finding your account...");
  const realUser = await findUserByEmail(admin, email);
  if (!realUser) {
    throw new Error(
      `No auth user found for ${email}. Sign in with Google once first, then run this again.`
    );
  }
  await ensureProfile(admin, realUser.id, null);
  log(`Found: ${realUser.id} (${email})`);

  // Step 4: Create bots
  header(`Creating ${playerCount} bots...`);
  const bots = await createBots(admin, playerCount);
  for (const bot of bots) {
    log(`${bot.username} (${bot.email})`);
  }

  // Step 5: Add everyone to the league
  header("Adding everyone to the league...");
  const allUserIds = [realUser.id, ...bots.map((b) => b.id)];
  await addMembers(admin, LEAGUE_ID, allUserIds);
  log(`${allUserIds.length} members added to league ${INVITE_CODE}`);

  // Step 6: Load all episodes
  const { data: allEpisodes } = await admin
    .from("episodes")
    .select("id, number, title")
    .order("number", { ascending: true });
  if (!allEpisodes || allEpisodes.length === 0) {
    throw new Error("No episodes found after reset");
  }

  // Step 7: Fast-forward through episodes
  const botIds = bots.map((b) => b.id);
  const episodesToProcess = allEpisodes.slice(0, episodesToSim);
  const nextEpisode = allEpisodes[episodesToSim] ?? null;
  const completedEpisodeIds = []; // tracks completed episode UUIDs for debt calc

  for (const ep of episodesToProcess) {
    header(`Episode ${ep.number}: ${ep.title}`);

    // Open episode for picking (set air_date to future)
    const openAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await admin
      .from("episodes")
      .update({ air_date: openAt, is_complete: false })
      .eq("id", ep.id);

    // Get active members (skip eliminated players)
    const { data: activeMembers } = await admin
      .from("league_members")
      .select("user_id")
      .eq("league_id", LEAGUE_ID)
      .eq("is_eliminated", false);
    const activeUserIds = (activeMembers ?? []).map((m) => m.user_id);

    // Seed picks — bots pick with miss rate, real user always picks
    // Players owe extra picks only for consecutive missed weeks immediately prior.
    const pickResult = await seedPicksForEpisode(admin, {
      leagueId: LEAGUE_ID,
      episodeId: ep.id,
      episodeNumber: ep.number,
      userIds: activeUserIds,
      season: 50,
      missRate,
      forcePickUserIds: [realUser.id],
      completedEpisodeIds,
    });

    // Log pick details including makeup picks
    const makeupPickers = (pickResult.details ?? []).filter((d) => d.required > 1);
    log(
      `Picks: ${pickResult.picked.length} players submitted, ${pickResult.missed.length} missed`
    );
    if (makeupPickers.length > 0) {
      for (const d of makeupPickers) {
        log(`  ↳ makeup: ${d.submitted} picks (owed ${d.required}, missed ${d.required - 1} consecutive prior week${d.required > 2 ? "s" : ""})`);
      }
    }

    // Advance episode (reveal + eliminate)
    const advResult = await advanceEpisode(admin, {
      leagueId: LEAGUE_ID,
      season: 50,
      episode: ep,
      eliminatedCount: eliminatedPerEp,
    });
    log(
      `Eliminated: ${advResult.eliminated.length > 0 ? advResult.eliminated.join(", ") : "none"}`
    );

    // Track this episode as completed for future debt calculations
    completedEpisodeIds.push(ep.id);

    // Show remaining active count
    const { data: stillActive } = await admin
      .from("league_members")
      .select("user_id")
      .eq("league_id", LEAGUE_ID)
      .eq("is_eliminated", false);
    const stillActiveIds = (stillActive ?? []).map((m) => m.user_id);
    log(`Active members remaining: ${stillActiveIds.length}`);
  }

  // Step 8: Open the next episode for picking
  if (nextEpisode) {
    header(`Opening Episode ${nextEpisode.number} for picking...`);
    const openAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await admin
      .from("episodes")
      .update({ air_date: openAt, is_complete: false })
      .eq("id", nextEpisode.id);
    log(`Episode ${nextEpisode.number} open until ${openAt}`);
  }

  // Summary
  const { data: finalMembers } = await admin
    .from("league_members")
    .select("user_id, is_eliminated")
    .eq("league_id", LEAGUE_ID);
  const active = (finalMembers ?? []).filter((m) => !m.is_eliminated).length;
  const eliminated = (finalMembers ?? []).filter((m) => m.is_eliminated).length;

  const { data: remainingContestants } = await admin
    .from("contestants")
    .select("id")
    .eq("season", 50)
    .eq("is_eliminated", false);

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║              Simulation Done             ║");
  console.log("╚══════════════════════════════════════════╝");
  log(`Episodes completed: ${episodesToSim}`);
  log(`Players active: ${active} | eliminated: ${eliminated}`);
  log(`Contestants remaining: ${(remainingContestants ?? []).length}/24`);
  if (nextEpisode) {
    log(`Current episode: ${nextEpisode.number} (open for picks)`);
  }
  console.log("");
  log(`View league: /league/${LEAGUE_ID}`);
  log(`Join link:   /join/${INVITE_CODE}`);
  console.log("");
  log("Quick actions:");
  log(`  npm run sim:reveal    — Reveal current episode picks`);
  log(`  npm run sim:advance   — Complete current episode + eliminations`);
  log(`  npm run sim:go        — Start over from scratch`);
}

/** sim:reset — Just wipe data and reseed. */
async function handleReset(admin, options) {
  if (!options.yes) {
    throw new Error(
      "Reset is destructive. Run with --yes to confirm.\n  npm run sim:reset -- --yes"
    );
  }

  header("Cleaning up old sim bots...");
  const deletedBots = await deleteAllSimBots(admin);
  log(`Deleted ${deletedBots} old bot accounts`);

  await resetData(admin);

  console.log("\nReset complete. Run sim:go to set up a new simulation.");
}

/** sim:setup — Legacy: create bots and add to league. */
async function handleSetup(admin, options) {
  const inviteCode = String(
    options["invite-code"] ?? INVITE_CODE
  ).toUpperCase();
  const playerCount = intOption(options, "players", DEFAULT_PLAYERS);
  const email = options["host-email"] ?? options.email;

  const { data: league } = await admin
    .from("leagues")
    .select("id, name, invite_code, season")
    .eq("invite_code", inviteCode)
    .maybeSingle();
  if (!league) throw new Error(`League not found for invite code: ${inviteCode}`);

  let hostId = null;
  if (email) {
    const user = await findUserByEmail(admin, String(email));
    if (!user)
      throw new Error(
        `No auth user for ${email}. Sign in with Google first.`
      );
    hostId = user.id;
    await ensureProfile(admin, hostId, null);
  }

  header(`Creating ${playerCount} bots...`);
  const bots = await createBots(admin, playerCount);

  const memberIds = hostId
    ? [hostId, ...bots.map((b) => b.id)]
    : bots.map((b) => b.id);
  await addMembers(admin, league.id, memberIds);

  // Open first incomplete episode
  const { data: episode } = await admin
    .from("episodes")
    .select("id, number")
    .eq("is_complete", false)
    .order("number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (episode) {
    const openAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await admin
      .from("episodes")
      .update({ air_date: openAt, is_complete: false })
      .eq("id", episode.id);

    // Seed picks for bots only (first episode, no prior debt)
    await seedPicksForEpisode(admin, {
      leagueId: league.id,
      episodeId: episode.id,
      episodeNumber: episode.number,
      userIds: bots.map((b) => b.id),
      season: league.season ?? 50,
      missRate: 0,
      forcePickUserIds: [],
      completedEpisodeIds: [],
    });
  }

  console.log("\nSetup complete.");
  log(`League: ${league.name} (${league.id})`);
  log(`Bots: ${bots.length}`);
  if (hostId) log(`Host: ${email}`);
  if (episode) log(`Episode ${episode.number} opened for picks`);
  console.log("");
  log(`Next: npm run sim:reveal -- --league-id ${league.id}`);
}

/** sim:reveal — Move episode air_date to past so picks are visible. */
async function handleReveal(admin, options) {
  const leagueId = String(options["league-id"] ?? LEAGUE_ID);

  const { data: episode } = await admin
    .from("episodes")
    .select("id, number, title")
    .eq("is_complete", false)
    .order("number", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!episode) throw new Error("No open episode found");

  const revealAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await admin
    .from("episodes")
    .update({ air_date: revealAt })
    .eq("id", episode.id);

  console.log(
    `Episode ${episode.number} revealed. Picks are now visible. Refresh the league page.`
  );
}

/** sim:advance — Complete the current episode with eliminations. */
async function handleAdvance(admin, options) {
  const leagueId = String(options["league-id"] ?? LEAGUE_ID);
  const eliminatedCount = intOption(options, "eliminated", 1);

  const { data: episode } = await admin
    .from("episodes")
    .select("id, number, title")
    .eq("is_complete", false)
    .order("number", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!episode) throw new Error("No open episode found");

  const result = await advanceEpisode(admin, {
    leagueId,
    season: 50,
    episode,
    eliminatedCount,
  });

  console.log(`Episode ${episode.number} complete.`);
  log(
    `Eliminated: ${result.eliminated.length > 0 ? result.eliminated.join(", ") : "none"}`
  );

  // Open next episode
  const { data: nextEp } = await admin
    .from("episodes")
    .select("id, number")
    .eq("is_complete", false)
    .order("number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextEp) {
    const openAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await admin
      .from("episodes")
      .update({ air_date: openAt, is_complete: false })
      .eq("id", nextEp.id);
    log(`Episode ${nextEp.number} now open for picks`);
  } else {
    log("No more episodes — season is over!");
  }
}

/** sim:seed — Seed picks for upcoming episodes with realistic patterns. */
async function handleSeed(admin, options) {
  const leagueId = String(options["league-id"] ?? LEAGUE_ID);
  const weeks = intOption(options, "weeks", 1);
  const missRate = floatOption(options, "miss-rate", DEFAULT_MISS_RATE);

  const { data: members } = await admin
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("is_eliminated", false);
  const userIds = (members ?? []).map((m) => m.user_id);
  if (userIds.length === 0) throw new Error("No active members found");

  // Get completed episodes for debt calculation
  const { data: completedEps } = await admin
    .from("episodes")
    .select("id, number")
    .eq("is_complete", true)
    .order("number", { ascending: true });
  const completedEpisodeIds = (completedEps ?? []).map((e) => e.id);

  const { data: episodes } = await admin
    .from("episodes")
    .select("id, number, title")
    .eq("is_complete", false)
    .order("number", { ascending: true })
    .limit(weeks);

  for (const ep of episodes ?? []) {
    const openAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await admin
      .from("episodes")
      .update({ air_date: openAt })
      .eq("id", ep.id);

    const result = await seedPicksForEpisode(admin, {
      leagueId,
      episodeId: ep.id,
      episodeNumber: ep.number,
      userIds,
      season: 50,
      missRate,
      forcePickUserIds: [],
      completedEpisodeIds,
    });

    const makeupPickers = (result.details ?? []).filter((d) => d.required > 1);
    log(
      `Episode ${ep.number}: ${result.picked.length} picked, ${result.missed.length} missed`
    );
    if (makeupPickers.length > 0) {
      for (const d of makeupPickers) {
        log(`  ↳ makeup: ${d.submitted} picks (owed ${d.required})`);
      }
    }

    // Track this episode as completed for subsequent weeks
    completedEpisodeIds.push(ep.id);
  }

  console.log("Seed complete.");
}

function printHelp() {
  console.log(`
Pick Your Survivor — Simulation CLI

Commands:
  go        All-in-one: reset → create bots → seed picks → fast-forward episodes → open next
  reset     Wipe all game data and restore seed (episodes, contestants, league)
  setup     Create bots and add to an existing league
  seed      Seed picks for upcoming episodes (with miss patterns)
  reveal    Reveal current episode picks (move air_date to past)
  advance   Complete current episode + apply eliminations + open next episode
  help      Show this help

Quick Start:
  npm run sim:go                                 # Full simulation (recommended)
  npm run sim:go -- --episodes 5 --players 10    # Customize

All-in-one (sim:go) options:
  --email <email>        Your email (default: ${DEFAULT_EMAIL})
  --players <n>          Number of bots (default: ${DEFAULT_PLAYERS})
  --episodes <n>         Episodes to fast-forward (default: ${DEFAULT_EPISODES_TO_SIM})
  --miss-rate <0-1>      Bot miss probability (default: ${DEFAULT_MISS_RATE})
  --eliminated <n>       Contestants eliminated per episode (default: 1)

Other commands:
  npm run sim:reset -- --yes                       # Wipe and reseed
  npm run sim:reveal                               # Reveal current episode
  npm run sim:advance                              # Complete current episode
  npm run sim:advance -- --eliminated 2            # Eliminate 2 contestants
  npm run sim:seed -- --weeks 3 --miss-rate 0.3    # Seed picks for 3 weeks

DB Recovery:
  If your tables are broken, paste scripts/rebuild-db.sql into the Supabase SQL Editor.
  Then run: npm run sim:go
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
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

  const handlers = {
    go: handleGo,
    reset: handleReset,
    setup: handleSetup,
    seed: handleSeed,
    reveal: handleReveal,
    advance: handleAdvance,
  };

  const handler = handlers[command];
  if (!handler) throw new Error(`Unknown command: ${command}. Run sim:help`);
  await handler(admin, options);
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
