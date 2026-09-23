# ArenaX

AsCI inter-college esports tournament platform built with Next.js, Supabase, and Tailwind CSS.

## Features

- `/` — home page
- `/login` — Google sign-in only (Supabase Auth)
- `/tickets` — games registered to the signed-in Gmail, shown as tickets
- `/register/[game]` — team leader registration (`freefire`, `bgmi`, or `codm`)

The supported games are defined in `lib/games.ts`. Registration and ticket data are handled by Supabase.

## Requirements

- Node.js 20 or newer
- npm
- A Supabase project
- Google OAuth credentials configured through Supabase Auth

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project and run `supabase/schema.sql` in the SQL editor for a new database.

   For an existing database, apply the migrations in `supabase/migrations/` in filename order. The latest migrations add CODM and remove COC from new registrations while preserving historical rows.

3. Create local environment variables:

   ```bash
   cp .env.local.example .env.local
   ```

   On PowerShell, use `Copy-Item .env.local.example .env.local` instead.

4. Add the Supabase URL and anon key to `.env.local`. Never commit this file.

5. In Authentication → Providers, enable **Google** (disable Email if you want Google-only).

6. Add these Redirect URLs in Authentication → URL Configuration:

   - `http://localhost:3000/auth/callback`
   - your production callback, e.g. `https://your-domain/auth/callback`

7. In Google Cloud Console, create OAuth credentials and paste the Client ID and secret into the Supabase Google provider.

## Run locally

```bash
npm run dev
```

Open http://localhost:3000.

## Verify before publishing

```bash
npm run build
```

For a production-like local run:

```bash
npm run build
npm start
```

## Deployment

Deploy as a Next.js application on Vercel or another Node-compatible host. Configure the same environment variables from `.env.local` in the host dashboard, then add the production `/auth/callback` URL to both Supabase and Google OAuth settings.

## Registration rules

- Sign-in is Google only.
- Tickets are loaded for the Gmail on that Google account (leader or member).
- A Gmail / in-game UID can be registered only once per game (one team, one role).
- A leader registers teammates with Gmail, in-game UID, branch, section, and year of study.
