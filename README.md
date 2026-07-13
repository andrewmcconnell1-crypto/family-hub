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

Right now everything is stored **privately on the device**: item metadata in
`localStorage`, file blobs (documents & photos) in IndexedDB. There is no
server and nothing leaves the browser.

The store is deliberately shaped so cloud sync can slot in later without the
screens changing (the same pattern as our meal planner): a Supabase project
with Google sign-in, one row of JSON metadata per household protected by
row-level security, and a private Storage bucket for the files. That's the
next step on the roadmap.

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
