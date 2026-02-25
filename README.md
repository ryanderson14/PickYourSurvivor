This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Local Multiplayer Simulation (OAuth-Friendly)

Leagues are pre-configured in the database (not created by users). Use the simulation CLI to populate a league with bots, seed picks, and fast-forward reveal/results:

```bash
# 1) Reset the database and restore the seeded league (invite code: PVRS50)
npm run sim:reset -- --yes

# 2) Populate the league with bots (optionally add your real account)
npm run sim:setup -- --invite-code PVRS50 --players 8
npm run sim:setup -- --invite-code PVRS50 --host-email you@gmail.com --players 8

# 3) Join the league in the app via: http://localhost:3000/join/PVRS50

# 4) Reveal picks for the current open episode (moves air_date to the past)
npm run sim:reveal -- --league-id <league-id>

# 5) Seed bot picks for upcoming weeks
npm run sim:seed -- --league-id <league-id> --weeks 3

# 6) Simulate episode completion + eliminations
npm run sim:advance -- --league-id <league-id> --eliminated 2
```

Useful options:
- `--invite-code <code>`: target a league by invite code (e.g. `PVRS50`)
- `--league-id <id>`: target a league by UUID
- `--host-email <email>`: optionally add your real account to the league
- `--episode <n>`: target a specific episode number
- `--weeks <n>`: with `sim:seed`, seed consecutive open episodes
- `--include-host-pick`: also seed a pick for your real account
- `--all-members`: with `sim:seed`, seed all active members (not just bots)
- `--yes`: required confirmation for `sim:reset`
- `npm run sim:help`: print all simulation commands/options

## Resetting The Database

Warning: these steps permanently delete data.

Simulation CLI reset (works for hosted or local Supabase when `.env.local` is configured):

```bash
npm run sim:reset -- --yes
```

This clears `picks`, `league_members`, `leagues`, `contestants`, and `episodes`, then reloads `episodes`, `contestants`, and the pre-configured league from `supabase/seed.sql`.

Use `--seed-file` to target a different seed SQL file:

```bash
npm run sim:reset -- --yes --seed-file supabase/seed.sql
```

Local Supabase reset (if you are running a local Supabase stack):

```bash
npx supabase start
npx supabase db reset
```

This reapplies everything in `supabase/migrations` and reruns `supabase/seed.sql`.

Hosted Supabase reset (your current setup if `.env.local` points to `*.supabase.co`):

1. Open Supabase Dashboard -> SQL Editor.
2. Run:

```sql
truncate table picks, league_members, leagues, contestants, episodes restart identity cascade;
```

3. Re-run the SQL in `supabase/seed.sql` to restore episodes, contestants, and the seeded league.
4. Optional cleanup for test bot profiles:

```sql
delete from profiles where username like 'Bot %';
```

If you want a full clean slate including Auth users/sessions, create a new Supabase project and update your `.env.local` keys.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
