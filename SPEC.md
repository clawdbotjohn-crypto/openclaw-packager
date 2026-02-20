# openclaw-backup — OpenClaw Export/Import CLI Tool

## Overview
A standalone npm CLI tool for exporting and importing OpenClaw bot configurations. Allows migration between machines, disaster recovery, and sharing setups (with secrets stripped).

**Package name:** `openclaw-backup`
**Install:** `npm install -g openclaw-backup`
**Runtime:** Node.js (TypeScript compiled to JS)
**Output format:** .zip (standard zip, contains manifest.json)

---

## Commands

### Export
```bash
openclaw-backup export [options]
```

**Flags:**
| Flag | Default | Description |
|------|---------|-------------|
| `-o, --output <path>` | `./openclaw-export-<timestamp>.zip` | Output file path |
| `--workspace` | included | Include workspace (skills, scripts, AGENTS.md, SOUL.md, etc.) |
| `--cron` | included | Include cron jobs (jobs.json) |
| `--config` | included | Include openclaw.json config |
| `--agents` | included | Include agent definitions (models.json per agent) |
| `--memory` | included | Include MEMORY.md + memory/ folder |
| `--auth` | **excluded** | Include auth-profiles.json and credentials/ |
| `--include-secrets` | false | Include actual secret values (tokens, keys). Without this, secrets are replaced with placeholder markers |
| `--no-workspace` | - | Exclude workspace |
| `--no-cron` | - | Exclude cron jobs |
| `--no-config` | - | Exclude config |
| `--no-agents` | - | Exclude agents |
| `--no-memory` | - | Exclude memory |
| `--stdout` | false | Write zip to stdout (for SSH piping: `ssh pi "openclaw-backup export --stdout" > backup.zip`) |
| `--dry-run` | false | Show what would be exported without creating file |

**Default behavior (no flags):** Export everything EXCEPT auth/secrets. Safe to share.

### Import
```bash
openclaw-backup import <file.zip> [options]
```

**Flags:**
| Flag | Default | Description |
|------|---------|-------------|
| `--dry-run` | false | Preview what would change, touch nothing |
| `--merge` | default | Add missing files, skip existing |
| `--force` | false | Overwrite all existing files |
| `--target <path>` | `~/.openclaw` | Target OpenClaw directory |
| `--skip-workspace` | false | Skip workspace files during import |
| `--skip-cron` | false | Skip cron jobs during import |
| `--skip-config` | false | Skip config during import |

**Import flow:**
1. Validate zip has manifest.json (reject if not an openclaw-backup export)
2. Read manifest, show summary of contents
3. Detect existing ~/.openclaw (fresh install vs existing)
4. If --dry-run: print diff summary and exit
5. Extract selected components to correct locations
6. If secrets were stripped: print SECRETS_TEMPLATE with instructions
7. Print next steps: "Run `openclaw doctor` to verify"

### Inspect
```bash
openclaw-backup inspect <file.zip>
```
Show contents of a backup without importing: manifest, what's included, file count, size, whether secrets are present.

---

## Directory Mapping

What gets exported and where it maps:

```
~/.openclaw/
├── openclaw.json              → config/openclaw.json          [--config]
├── cron/jobs.json             → cron/jobs.json                [--cron]
├── agents/                                                     [--agents]
│   ├── main/agent/models.json     → agents/main/models.json
│   ├── worker/agent/models.json   → agents/worker/models.json
│   ├── researcher/agent/...       → agents/researcher/...
│   └── (etc for all agents)
├── agents/*/agent/auth-profiles.json → agents/*/auth-profiles.json  [--auth only]
├── credentials/               → credentials/                  [--auth only]
├── identity/                  → (NEVER exported - machine-specific)
└── workspace/                                                  [--workspace]
    ├── AGENTS.md              → workspace/AGENTS.md
    ├── SOUL.md                → workspace/SOUL.md
    ├── USER.md                → workspace/USER.md
    ├── IDENTITY.md            → workspace/IDENTITY.md
    ├── TOOLS.md               → workspace/TOOLS.md
    ├── HEARTBEAT.md           → workspace/HEARTBEAT.md
    ├── MEMORY.md              → workspace/MEMORY.md           [--memory]
    ├── memory/                → workspace/memory/             [--memory]
    ├── skills/                → workspace/skills/
    ├── scripts/               → workspace/scripts/
    ├── automation/            → workspace/automation/
    └── (other non-gitignored workspace files)

NEVER exported:
- ~/.openclaw/identity/          (device keypairs, machine-specific)
- ~/.openclaw/agents/*/sessions/ (session history, too large)
- ~/.openclaw/logs/              (runtime logs)
- ~/.openclaw/browser/           (browser profile data)
- ~/.openclaw/completions/       (tab completion cache)
- ~/.openclaw/media/             (downloaded media files)
- ~/.openclaw/delivery-queue/    (transient)
- node_modules anywhere
- .git directories
- __pycache__
```

---

## manifest.json

Every export includes this at the root of the zip:

```json
{
  "version": "1.0.0",
  "tool": "openclaw-backup",
  "exportedAt": "2026-02-20T19:45:00Z",
  "openclawVersion": "2026.2.15",
  "platform": "linux-arm64",
  "nodeVersion": "v22.22.0",
  "includes": {
    "workspace": true,
    "cron": true,
    "config": true,
    "agents": ["main", "worker", "researcher", "designer", "guest", "guest-worker"],
    "memory": true,
    "auth": false
  },
  "secretsIncluded": false,
  "secretsStripped": 34,
  "stats": {
    "totalFiles": 156,
    "totalSize": "2.4MB",
    "cronJobs": 12,
    "skills": 24,
    "agents": 6
  }
}
```

---

## Secrets Detection & Stripping

When `--include-secrets` is NOT set (default), scan all JSON files for sensitive values and replace with markers.

**Detection patterns (in JSON values):**
- Keys matching: `token`, `key`, `apiKey`, `api_key`, `secret`, `password`, `credential`, `auth`
- Values matching: `ghu_*`, `ghp_*`, `sk-*`, `xoxb-*`, `xoxp-*`, Bearer tokens, base64 blobs > 40 chars that look like tokens
- Entire files: `credentials/*.json`, `agents/*/auth-profiles.json`

**Replacement:** `"__OPENCLAW_SECRET__:<original_key_name>"`

**SECRETS_TEMPLATE.json** (included in export when secrets are stripped):
```json
{
  "_instructions": "Fill in these values on your new machine. Run: openclaw-backup secrets <export.zip>",
  "config": {
    "channels.discord.token": "__OPENCLAW_SECRET__",
    "channels.telegram.token": "__OPENCLAW_SECRET__"
  },
  "credentials": [
    "google_token.json",
    "discord-pairing.json"
  ],
  "agentAuth": {
    "main": ["github-copilot"],
    "worker": ["github-copilot"]
  }
}
```

---

## Project Structure

```
openclaw-backup/
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE (MIT)
├── src/
│   ├── index.ts           # CLI entry point (commander.js)
│   ├── export.ts          # Export logic
│   ├── import.ts          # Import logic  
│   ├── inspect.ts         # Inspect command
│   ├── manifest.ts        # Manifest types and validation
│   ├── secrets.ts         # Secret detection and stripping
│   ├── paths.ts           # OpenClaw directory detection and mapping
│   └── utils.ts           # Shared utilities (zip, logging, formatting)
├── dist/                  # Compiled JS (gitignored, built on prepublish)
└── test/
    └── (basic tests)
```

**Dependencies (keep minimal):**
- `commander` — CLI arg parsing (standard for Node CLIs)
- `archiver` — zip creation
- `adm-zip` or `unzipper` — zip reading
- `chalk` — colored output (optional)

**package.json bin:**
```json
{
  "name": "openclaw-backup",
  "version": "0.1.0",
  "bin": {
    "openclaw-backup": "./dist/index.js"
  }
}
```

---

## Implementation Notes

1. **Detect OpenClaw directory:** Check `$OPENCLAW_STATE_DIR` env var first, then `~/.openclaw`, then `~/.openclaw-dev`. Fail with helpful message if not found.

2. **Workspace location:** Could be a symlink. Resolve with `fs.realpathSync`.

3. **Large file handling:** Stream files into zip, don't load all into memory. Important for workspaces with projects.

4. **Workspace filtering:** Skip `.git/`, `node_modules/`, `__pycache__/`, `*.pyc`, `.cache/`, and anything in workspace `.gitignore` (respect it as a hint for what's not worth exporting).

5. **--stdout mode:** Write zip buffer to `process.stdout`. No console.log output in this mode (use stderr for progress if needed).

6. **Import merge logic for cron jobs:** Parse both source and target jobs.json. Match by job ID. In merge mode, only add jobs with IDs that don't exist in target. In force mode, overwrite matching IDs.

7. **Config merge:** For openclaw.json, do a deep merge. Target values win in merge mode. Source values win in force mode.

8. **Post-import checklist output:**
```
✅ Import complete!

Imported:
  📂 Workspace: 145 files
  ⚙️  Config: openclaw.json
  ⏰ Cron: 12 jobs (8 new, 4 skipped existing)
  🤖 Agents: main, worker, researcher

⚠️  Secrets not included. Fill in manually:
  - Discord bot token → openclaw.json channels.discord.token
  - GitHub Copilot auth → agents/main/agent/auth-profiles.json
  - Run: openclaw-backup secrets backup.zip  (shows full list)

Next steps:
  1. Fill in API keys/tokens listed above
  2. Run: openclaw doctor
  3. Run: openclaw gateway start
```

---

## Testing

Build and test locally before publishing:
```bash
cd openclaw-backup
npm run build
npm link                    # Makes 'openclaw-backup' available globally
openclaw-backup export --dry-run
openclaw-backup export -o test-backup.zip
openclaw-backup inspect test-backup.zip
# Then test import on a temp directory:
openclaw-backup import test-backup.zip --target /tmp/test-openclaw --dry-run
```

---

## Scope for v0.1.0

**Must have:**
- [x] Export with all flags working
- [x] Secrets detection and stripping (default safe)
- [x] manifest.json
- [x] --stdout for SSH piping
- [x] --dry-run for both export and import
- [x] Import with merge/force modes
- [x] Inspect command
- [x] SECRETS_TEMPLATE.json generation

**Nice to have (v0.2+):**
- [ ] `openclaw-backup secrets <file.zip>` — interactive secrets fill-in
- [ ] .claw file extension option
- [ ] Diff view on import (show exactly what would change)
- [ ] Scheduled auto-export via cron
- [ ] Encrypted exports (password-protected zip)
