#!/usr/bin/env node
/**
 * Additive Claude Code hook — presence webhook.
 *
 * This is NOT part of claude-code-discord-status. It runs alongside the tool's
 * own hook (which talks to the local Discord RPC daemon) and does something
 * completely separate: it POSTs a tiny status payload to a remote backend.
 *
 * It never imports, calls, or modifies the original hook / daemon / CLI. Drop it
 * anywhere; register it in ~/.claude/settings.json as extra hook entries (see
 * extras/README.md). It reads the Claude Code hook event from stdin, same as the
 * original, so both hooks get the same event and neither notices the other.
 *
 * Contract of the target endpoint (POST <PRESENCE_BACKEND_URL>/api/presence/update):
 *   headers: Authorization: Bearer <PRESENCE_WRITE_TOKEN>
 *   body:    { source: "claude-code", status: {...}, timestamp: <ms epoch> }
 *
 * Required env vars (set them in the same shell/profile Claude Code runs in):
 *   PRESENCE_WRITE_TOKEN   bearer token expected by the backend
 *   PRESENCE_BACKEND_URL   backend origin, e.g. https://your-portfolio.vercel.app
 *                          (a trailing slash or a full .../api/presence/update
 *                          path is tolerated)
 *
 * If either env var is missing the hook exits 0 silently. It always exits 0 and
 * never writes to stdout, so it can never block or disturb Claude Code.
 */

const ENDPOINT_PATH = '/api/presence/update';
const SOURCE = 'claude-code'; // backend only accepts "claude-code" | "after-effects"
const POST_TIMEOUT_MS = 2000;

// Tool name -> short, non-sensitive activity label. Mirrors the original hook's
// TOOL_MAP so the two presences read consistently.
const TOOL_DETAILS = {
  Write: 'Editing a file',
  Edit: 'Editing a file',
  Bash: 'Running a command',
  Read: 'Reading a file',
  Grep: 'Searching codebase',
  Glob: 'Searching codebase',
  WebSearch: 'Searching the web',
  WebFetch: 'Searching the web',
  Task: 'Running a subtask',
};

function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', () => resolve(''));
  });
}

function resolveEndpoint(rawBase) {
  let base = rawBase.trim().replace(/\/+$/, '');
  if (base.endsWith(ENDPOINT_PATH)) return base;
  return base + ENDPOINT_PATH;
}

function basename(p) {
  if (!p) return null;
  const parts = String(p).split(/[/\\]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

/**
 * Map a hook event to the status object we send. Returns null for events we
 * don't care about. `state` is "active" | "idle"; the backend's reader keys off
 * `status.state` and `status.detail`.
 */
function buildStatus(event, input) {
  const project = basename(input.cwd);

  switch (event) {
    case 'SessionStart':
      return { state: 'active', detail: 'Starting session', event, project };

    case 'UserPromptSubmit':
      return { state: 'active', detail: 'Thinking', event, project };

    case 'PreToolUse': {
      const tool = typeof input.tool_name === 'string' ? input.tool_name : '';
      return {
        state: 'active',
        detail: TOOL_DETAILS[tool] ?? 'Working',
        event,
        project,
        tool: tool || null,
      };
    }

    case 'Stop':
      return { state: 'idle', detail: 'Finished', event, project };

    case 'Notification':
      return { state: 'idle', detail: 'Waiting for input', event, project };

    case 'SessionEnd':
      // Explicitly mark the source idle/inactive rather than letting the
      // backend's staleness timer flip it later.
      return { state: 'idle', detail: 'Session ended', event, project, ended: true };

    default:
      return null;
  }
}

async function main() {
  const token = process.env.PRESENCE_WRITE_TOKEN;
  const backend = process.env.PRESENCE_BACKEND_URL;
  if (!token || !backend) return; // not configured — do nothing

  const raw = await readStdin();
  if (!raw.trim()) return;

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return;
  }

  const event = input.hook_event_name;
  if (!event) return;

  const status = buildStatus(event, input);
  if (!status) return;

  const body = JSON.stringify({
    source: SOURCE,
    status,
    timestamp: Date.now(),
  });

  try {
    await fetch(resolveEndpoint(backend), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body,
      signal: AbortSignal.timeout(POST_TIMEOUT_MS),
    });
  } catch {
    // Backend unreachable / slow — never block Claude Code.
  }
}

main().finally(() => process.exit(0));
