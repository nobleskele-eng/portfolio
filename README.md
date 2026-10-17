# porfolio

Next.js 14 (App Router, TypeScript) + Tailwind CSS. Framer Motion is installed and ready to use.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Structure

- `app/` — routes (App Router)
- `components/` — reusable UI pieces
- `public/` — static assets

## The landscape

The whole site is one ink landscape that paints itself on load, ported from
[shan-shui-inf](https://github.com/LingDong-/shan-shui-inf) (MIT, © Lingdong
Huang). Clicking the person opens About, the notice board opens Links, the
bookshelf opens Projects, the record player shows what's playing on Spotify.

The scene is painted in depth planes (pale far range and drifting clouds, far
bands, the lake, mid mountains, the near corner) with mist between them.
Scrolling pushes the camera into the corner, each plane following at its own
rate (parallax); on desktop the mouse nudges the planes apart. The lake follows
the shoreline in perspective, with faint rippling reflections, and cycles three
drawings at 3fps.

- **Copy:** `content/about.ts`, `content/links.ts`, `content/projects.ts`
  (the bookshelf), `content/presence.ts` (Discord handle, status words,
  record-player text)
- **Composition and seed:** `lib/shanshui/scenes.js` (`SEED`, plus a wide and a
  tall phone layout); the objects, the person's poses and the flowing water are
  in `lib/shanshui/objects.js`; depth planes, mist, lake shape and the zoom
  target (`focus`) are in `scenes.js` too
- **Person's pose:** follows Discord via `/api/presence/discord` (online/dnd
  waves, idle sits, offline sleeps); hovering shows `<status> @.vyxed`
- **Record player:** spins while `/api/presence/spotify` says something is
  playing
- **Song:** `content/song.ts` (title, artist, volume) plays
  `public/audio/me-n-you.mp3` on a loop. Browsers block sound until the
  visitor interacts, so the first click, tap or key starts it; the chip sits
  bottom-right, or top-right on the tall layout
- **Link icons:** ink drawings in `components/landscape/LinkIcons.tsx`, picked
  by each link's `icon` in `content/links.ts`
- **Bookshelf:** four volumes (VFX, Motion Graphics, Animation, Coding) stand
  on the shelf; picking one opens it as an album, a spread per work with its
  notes on the left and its video on the right. Volumes and works are in
  `content/projects.ts`; a work's `video` is a key in `content/videos.json`.
  Videos play in the site's own player and the song pauses while one does
- **Videos:** hosted on Cloudflare R2 behind `media.stayvyxed.com`. To add one,
  share the Drive file as "Anyone with the link", add
  `"<key>": { "drive": "<file id>", "bytes": <size> }` to
  `content/videos.json`, then in `scripts/videos/` run `npm install` once and
  `node ingest.mjs`. It downloads the original, copies the streams untouched
  into a streamable MP4 when browsers can play them (H.264, HEVC; HEVC also
  gets an H.264 copy), encodes anything else (ProRes, DNx) to H.264 at CRF 16,
  saves a poster to `public/videos/posters/`, uploads to R2 and fills in the
  entry. `--dry-run` does everything but the upload. Needs ffmpeg and curl on
  PATH and `scripts/videos/.env` (from `.env.example`: an R2 API token with
  Object Read & Write on the bucket)
- **After Effects projects:** with a project open in After Effects, run
  `scripts/after-effects/export-project-info.jsx` (File > Scripts > Run Script
  File...) and save the JSON into `content/after-effects/`, then set a work's
  `ae` to the file name; its main comp timeline, counts, effects and fonts show
  under that work's spread. Needs Preferences > Scripting & Expressions >
  "Allow Scripts to Write Files and Access Network"
- **Dev-only URL params:** `?pose=wave|sit|sleep` to force a pose,
  `?spotify=playing|paused|off` to fake Spotify, `?seed=anything` to preview
  another landscape
- `lib/shanshui/engine.js` is generated from upstream by
  `scripts/shanshui/port.mjs`; don't edit it by hand

## Deploy

Deploys on Vercel with no configuration changes. Import the repo and it builds with `next build`.
