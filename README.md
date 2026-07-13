# Treehouse

A private family hub: **documents, calendar and photos for the kids, all in
one place.** Add each child once, then tag everything to them — a birth
certificate, the school sports day, the first-day-of-school photo — and filter
any screen by child.

## The five tabs

- **Home** – today at a glance: the next 7 days of events, recent photos, and
  quick counts.
- **Calendar** – a month view with per-child colour dots; add school, medical,
  activity and birthday events with optional times and notes.
- **Docs** – upload any file (PDFs, scans, letters), organised by category
  (Medical / School / Identity / Activities) and taggable to a child. Tap to
  open or download.
- **Photos** – a family photo grid with captions and per-child tags, plus a
  full-screen viewer.
- **Family** – manage the children themselves: name, date of birth, and the
  colour used for their tags everywhere else.

## Getting started

```bash
npm install
npm run dev      # start the dev server (Vite)
npm run build    # production build to dist/
npm run lint     # eslint
npm test         # vitest
```

## Where the data lives

Everything is always stored **privately on the device** (metadata in
`localStorage`, file blobs in IndexedDB), so the app works with no
configuration at all.

When cloud sync is configured (below) and you sign in, the same data also
syncs to **Supabase**: metadata in a per-user row protected by row-level
security, files in a private Storage bucket under your user's folder, and
realtime updates so other signed-in devices refresh live. Signing in for the
first time on a device with existing local data migrates that data (and its
files) into the account. Without sign-in, or if the network drops, the local
copy keeps working.

## Cloud sync setup (Supabase + Google sign-in)

The app reads two Vite env vars (safe to expose — data is protected by
row-level security, not by hiding the key):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

For local dev, copy `.env.example` to `.env.local` and fill them in.

1. Create a project at [supabase.com](https://supabase.com); copy the API URL
   and anon public key from Project Settings → API into the vars above.
2. Run `supabase/setup.sql` in the SQL editor — it creates the `family_data`
   table with RLS, enables realtime, and creates the private `family-files`
   storage bucket with per-user access policies.
3. **Authentication → Providers → Google:** enable it and add a Google OAuth
   client's ID/secret (the client's redirect URI must be Supabase's
   `…/auth/v1/callback`).
4. **Authentication → URL Configuration:** add the app's URL(s) (deployed URL
   and `http://localhost:5173/` for dev) to Site URL + Redirect URLs.

Sharing one hub between two parents (a household, like the meal planner has)
is the next step on the roadmap; for now each account has its own copy.

## Project structure

```
src/
  App.jsx                  # tab state + screen layout
  components/              # one component per screen + shared UI (Sheet, chips…)
  hooks/
    useFamilyStore.js      # single data store: children/events/documents/photos
    useFileUrl.js          # fileId -> object URL for display
  lib/
    familyData.js          # load/save/normalise data (pure, tested)
    fileStore.js           # IndexedDB blob store for document/photo files
  utils/
    dateUtils.js           # date keys, month grid, upcoming events (pure, tested)
    id.js                  # id generation
```

Business logic lives in pure functions under `utils/` and `lib/` so it can be
tested without a browser.
