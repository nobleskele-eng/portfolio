# claude-presence-hook

Client side of [`/api/presence/update`](../../app/api/presence/update/route.ts).

`hook.mjs` is a standalone [Claude Code hook](https://docs.claude.com/en/docs/claude-code/hooks).
On each lifecycle event it POSTs a small, non-sensitive status object to this
site's presence endpoint so the `claudeCode` card reflects live activity.

It is **additive** — it runs alongside
[claude-code-discord-status](https://github.com/brunoJurkovic/claude-code-discord-status)
(the Discord RPC daemon hook) without importing or modifying it. Both hooks just
receive the same stdin event.

## What it sends

```
POST <PRESENCE_BACKEND_URL>/api/presence/update
Authorization: Bearer <PRESENCE_WRITE_TOKEN>
Content-Type: application/json

{ "source": "claude-code",
  "status": { "state": "active|idle", "detail": "...", "event": "...", "project": "<cwd basename>", "tool": "<tool name>" },
  "timestamp": <ms epoch> }
```

| event              | `state`  | `detail`            | notes                     |
|--------------------|----------|---------------------|---------------------------|
| `SessionStart`     | `active` | `Starting session`  |                           |
| `UserPromptSubmit` | `active` | `Thinking`          |                           |
| `PreToolUse`       | `active` | per-tool label      | adds `tool`               |
| `Stop`             | `idle`   | `Finished`          |                           |
| `Notification`     | `idle`   | `Waiting for input` |                           |
| `SessionEnd`       | `idle`   | `Session ended`     | `ended: true`; pushed so the source flips off immediately instead of waiting for `STALE_THRESHOLD_MS` |

Only the working-directory basename, tool name, and event name leave the
machine — no paths, prompt text, env, or session id.

Always exits 0, never writes stdout, silently no-ops if either env var is unset.
Node 18+ (global `fetch`); fetch is capped at 2s.

## Install

```bash
mkdir -p ~/.claude/hooks
cp scripts/claude-presence-hook/hook.mjs ~/.claude/hooks/presence-webhook-hook.mjs
```

Set env vars where you launch `claude` (shell profile, or `~/.claude/settings.json` `env`):

| var                    | example                              |
|------------------------|--------------------------------------|
| `PRESENCE_WRITE_TOKEN` | must match the backend's `PRESENCE_WRITE_TOKEN` |
| `PRESENCE_BACKEND_URL` | `https://<your-deployment>` (trailing `/` or a full `/api/presence/update` path is tolerated) |

Register in `~/.claude/settings.json` under `hooks` — **merge**, keeping any
existing entries. Add one entry per event, command
`node ~/.claude/hooks/presence-webhook-hook.mjs` (absolute path; on Windows use
forward slashes). Mirror the six events the Discord hook uses: `SessionStart`
(sync), `UserPromptSubmit`, `PreToolUse` (matcher
`Write|Edit|Bash|Read|Grep|Glob|WebSearch|WebFetch|Task`), `Stop`,
`Notification` (async), `SessionEnd` (sync, so the final idle POST lands).

## Test

```bash
echo '{"hook_event_name":"PreToolUse","tool_name":"Bash","cwd":"'"$PWD"'"}' \
  | PRESENCE_WRITE_TOKEN=xxx PRESENCE_BACKEND_URL=https://example.com \
    node scripts/claude-presence-hook/hook.mjs
```
