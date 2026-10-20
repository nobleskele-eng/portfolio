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
bookshelf opens Projects, the record player shows what's playing on Spotify,
the stone lantern shows what Claude Code is doing.

The scene is painted in depth planes (pale far range and drifting clouds, far
bands, the lake, mid mountains, the near corner) with mist between them.
Scrolling pushes the camera into the corner, each plane following at its own
rate (parallax); on desktop the mouse nudges the planes apart. The lake follows
the shoreline in perspective, with faint rippling reflections, and cycles three
drawings at 3fps.

The sky keeps Toronto's time. Once the painting is done it settles over it: a
seal-red sun on its real path (rising on the left, setting on the right, behind
the clouds and hills), a warm glow round sunrise and sunset with a red glint on
the water, and at night an indigo wash with the moon in its real phase, its
halo and its path on the lake, and the lantern's light left uncovered.

- **Copy:** `content/about.ts`, `content/links.ts`, `content/projects.ts`
  (the bookshelf), `content/presence.ts` (Discord handle, status words,
  record-player and lantern text), `content/sky.ts` (the sky's scroll)
- **Sky:** `lib/sky.ts` works out the sun and moon over Toronto, the moon's
  phase and how dark it is; `components/landscape/useSky.ts` updates it every
  20s. The renderer paints the sun and moon into the sky plane and lays the
  dusk and night washes (`buildWash` in `renderer.ts`: once over the far
  layers, once over the near ones, so a mountain in front of the moon stays
  dark). Its colours and strengths are the constants at the top of
  `renderer.ts`. The inscription in the top-left corner shows Toronto's time
  and opens the sky's scroll (sunrise, sunset, the moon's phase)
- **Composition and seed:** `lib/shanshui/scenes.js` (`SEED`, plus a wide and a
  tall phone layout); the objects, the person's poses and the flowing water are
  in `lib/shanshui/objects.js`; depth planes, mist, lake shape and the zoom
  target (`focus`) are in `scenes.js` too
- **Person's pose:** follows Discord via `/api/presence/discord` (online/dnd
  waves, idle sits, offline sleeps); hovering shows `<status> @stayvyxed`
- **Record player:** spins while `/api/presence/spotify` says something is
  playing
- **Lantern:** follows Claude Code via `/api/presence/claude`, fed by the hook
  in `scripts/claude-presence-hook/` (see its README). Claude's ✻ spark burns
  in the window while it works, an ember glows while it's idle, and the window
  goes dark when the session ends or nothing has been heard for a while (10 min
  after the last activity, 30 min after going idle; tune in
  `lib/presence/fresh.ts`). Hovering shows what it's doing; its scroll shows the
  project folder too. It stands on the terrace at a spot measured for `SEED`
  (`lantern` in `scenes.js`)
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
  `?spotify=playing|paused|off` to fake Spotify, `?claude=active|idle|off` to
  fake Claude Code, `?time=21:30` and `?date=2026-12-21` to set Toronto's
  clock, `?speed=600` to run it that many times faster (a day in 2½ minutes),
  `?seed=anything` to preview another landscape
- `lib/shanshui/engine.js` is generated from upstream by
  `scripts/shanshui/port.mjs`; don't edit it by hand

## Deploy

Deploys on Vercel with no configuration changes. Import the repo and it builds with `next build`.
