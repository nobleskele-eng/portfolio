/**
 * Brings the bookshelf's videos in from Google Drive and puts them on R2.
 *
 * For each entry in content/videos.json with a `drive` id and no `sources`
 * yet (or each key named on the command line), this:
 *   1. downloads the original from Drive, which only works while the file is
 *      shared as "Anyone with the link", and checks it against `bytes`
 *   2. makes an MP4 the browser can stream: the original video stream is
 *      copied untouched when browsers can play it (H.264, HEVC), and anything
 *      else (ProRes, DNx, 10-bit H.264) is encoded to H.264 at CRF 16 with the
 *      same size and frame rate. HEVC gets an H.264 copy too, for browsers
 *      without HEVC.
 *   3. saves a poster frame to public/videos/posters/<key>.webp
 *   4. uploads the MP4s to the R2 bucket under content-hashed names
 *   5. writes sources, poster, size and duration back into content/videos.json
 *
 * Needs ffmpeg, ffprobe and curl on PATH, and scripts/videos/.env (copy
 * .env.example). Downloads are kept in .cache/ so a re-run skips them.
 *
 *   node ingest.mjs                 every entry not ingested yet
 *   node ingest.mjs wspbae          just these keys, even if already ingested
 *   node ingest.mjs --dry-run       everything but the upload and write-back
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const MANIFEST = join(ROOT, "content", "videos.json");
const POSTERS = join(ROOT, "public", "videos", "posters");
const CACHE = join(HERE, ".cache");

// Streams browsers play as they are; anything else is encoded.
const COPY_VIDEO = { h264: ["yuv420p", "yuvj420p"], hevc: ["yuv420p", "yuv420p10le"] };
const COPY_AUDIO = ["aac", "mp3"];
const H264 = ["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2"];
// 160k a channel, up to 320k: as much as AAC usefully takes
const aac = (channels) => ["-c:a", "aac", "-b:a", `${Math.min(320, 160 * (channels || 2))}k`];
const POSTER_AT = 0.15;
const POSTER_MAX_W = 1280;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const only = args.filter((a) => !a.startsWith("--"));

function run(cmd, argv, { quiet = true } = {}) {
  const r = spawnSync(cmd, argv, { encoding: "utf8", maxBuffer: 1 << 26, stdio: quiet ? "pipe" : ["ignore", "inherit", "inherit"] });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} exited ${r.status}${r.stderr ? `:\n${r.stderr.trim()}` : ""}`);
  return r.stdout;
}

const ffmpeg = (argv) => run("ffmpeg", ["-hide_banner", "-v", "warning", "-stats", "-y", ...argv], { quiet: false });

function probe(file) {
  const j = JSON.parse(run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]));
  const v = j.streams.find((s) => s.codec_type === "video");
  const a = j.streams.find((s) => s.codec_type === "audio");
  if (!v) throw new Error("no video stream in the download (is it shared as 'Anyone with the link'?)");
  const rotation = Number(v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? v.tags?.rotate ?? 0);
  const turned = Math.abs(rotation) % 180 === 90;
  const [n, d] = (v.avg_frame_rate || v.r_frame_rate || "0/1").split("/").map(Number);
  return {
    codec: v.codec_name,
    pix: v.pix_fmt,
    width: turned ? v.height : v.width,
    height: turned ? v.width : v.height,
    fps: d ? n / d : 0,
    duration: Number(j.format.duration),
    bitrate: Number(j.format.bit_rate),
    audio: a?.codec_name ?? null,
    channels: a?.channels ?? 0,
  };
}

function download(id, bytes, dest) {
  if (existsSync(dest) && (!bytes || statSync(dest).size === bytes)) {
    console.log("  already downloaded");
    return;
  }
  const url = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;
  run("curl", ["-L", "--fail", "--retry", "3", "--progress-bar", "-o", dest, url], { quiet: false });
  const got = statSync(dest).size;
  if (bytes && got !== bytes) {
    throw new Error(`downloaded ${got} bytes, expected ${bytes} (is it shared as 'Anyone with the link'?)`);
  }
}

/** The MP4s to publish, best first, and whether the picture had to be re-encoded. */
function makePlayable(src, info, base) {
  const copyVideo = COPY_VIDEO[info.codec]?.includes(info.pix);
  const audio = !info.audio ? ["-an"] : COPY_AUDIO.includes(info.audio) ? ["-c:a", "copy"] : aac(info.channels);
  const map = ["-map", "0:v:0", "-map", "0:a:0?"];
  const out = [];
  if (copyVideo) {
    const hevc = info.codec === "hevc";
    const file = `${base}.${info.codec}.mp4`;
    ffmpeg(["-i", src, ...map, "-c:v", "copy", ...(hevc ? ["-tag:v", "hvc1"] : []), ...audio, "-movflags", "+faststart", file]);
    out.push({ file, type: hevc ? 'video/mp4; codecs="hvc1"' : "video/mp4" });
  }
  if (!copyVideo || info.codec === "hevc") {
    const file = `${base}.h264.mp4`;
    ffmpeg(["-i", src, ...map, ...H264, ...audio, "-movflags", "+faststart", file]);
    out.push({ file, type: "video/mp4" });
  }
  return { out, reencoded: !copyVideo };
}

function poster(video, at, key) {
  mkdirSync(POSTERS, { recursive: true });
  const file = join(POSTERS, `${key}.webp`);
  ffmpeg(["-ss", at.toFixed(2), "-i", video, "-frames:v", "1", "-vf", `scale='min(${POSTER_MAX_W},iw)':-2`, "-c:v", "libwebp", "-quality", "82", file]);
  return `/videos/posters/${key}.webp`;
}

function sha8(file) {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(file)
      .on("data", (c) => h.update(c))
      .on("end", () => resolve(h.digest("hex").slice(0, 8)))
      .on("error", reject);
  });
}

function env() {
  const path = join(HERE, ".env");
  if (existsSync(path)) process.loadEnvFile(path);
  const need = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "MEDIA_BASE_URL"];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`missing ${missing.join(", ")} in scripts/videos/.env (see .env.example)`);
  return process.env;
}

async function uploader() {
  const e = env();
  const { S3Client } = await import("@aws-sdk/client-s3");
  const { Upload } = await import("@aws-sdk/lib-storage");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY },
  });
  const base = e.MEDIA_BASE_URL.replace(/\/+$/, "");
  return async (file, key) => {
    const name = `${key}-${await sha8(file)}.mp4`;
    const up = new Upload({
      client,
      params: {
        Bucket: e.R2_BUCKET,
        Key: name,
        Body: createReadStream(file),
        ContentType: "video/mp4",
        CacheControl: "public, max-age=31536000, immutable",
      },
      partSize: 16 * 1024 * 1024,
      queueSize: 4,
    });
    const total = statSync(file).size;
    up.on("httpUploadProgress", (p) => process.stdout.write(`\r  uploading ${name}: ${Math.round(((p.loaded ?? 0) / total) * 100)}%`));
    await up.done();
    process.stdout.write("\n");
    const url = `${base}/${name}`;
    // the custom domain may not be connected yet; that's worth a warning, not a failure
    const head = await fetch(url, { method: "HEAD" }).catch(() => null);
    if (!head?.ok) console.warn(`  warning: ${url} answered ${head?.status ?? "nothing"}; check the bucket's custom domain`);
    return url;
  };
}

async function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const keys = only.length ? only : Object.keys(manifest).filter((k) => manifest[k].drive && !manifest[k].sources?.length);
  const unknown = keys.filter((k) => !manifest[k]?.drive);
  if (unknown.length) throw new Error(`no \`drive\` id in content/videos.json for: ${unknown.join(", ")}`);
  if (!keys.length) {
    console.log("Nothing to ingest: every entry with a `drive` id already has sources.");
    return;
  }

  mkdirSync(CACHE, { recursive: true });
  const upload = dryRun ? null : await uploader();
  const reencoded = [];

  for (const key of keys) {
    const entry = manifest[key];
    console.log(`\n${key}`);
    const src = join(CACHE, `${key}.source`);
    download(entry.drive, entry.bytes, src);

    const info = probe(src);
    console.log(
      `  ${info.codec} ${info.pix}, ${info.width}×${info.height}, ${info.fps.toFixed(2)} fps, ` +
        `${info.duration.toFixed(1)}s, ${(info.bitrate / 1e6).toFixed(1)} Mb/s, audio ${info.audio ?? "none"}`,
    );

    const { out, reencoded: re } = makePlayable(src, info, join(CACHE, key));
    if (re) reencoded.push(key);
    const posterPath = poster(out[0].file, entry.posterAt ?? info.duration * POSTER_AT, key);

    if (dryRun) {
      for (const o of out) console.log(`  would upload ${o.file} (${(statSync(o.file).size / 1e6).toFixed(1)} MB, ${o.type})`);
      continue;
    }
    const sources = [];
    for (const o of out) sources.push({ src: await upload(o.file, key), type: o.type });

    // re-read so edits made while this ran aren't lost
    const fresh = JSON.parse(readFileSync(MANIFEST, "utf8"));
    fresh[key] = {
      ...fresh[key],
      sources,
      poster: posterPath,
      width: info.width,
      height: info.height,
      duration: Math.round(info.duration * 100) / 100,
    };
    writeFileSync(MANIFEST, `${JSON.stringify(fresh, null, 2)}\n`);
    console.log(`  done: ${sources.map((s) => s.src).join(", ")}`);
  }

  if (reencoded.length) console.log(`\nRe-encoded to H.264 (the original couldn't stream as-is): ${reencoded.join(", ")}`);
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
