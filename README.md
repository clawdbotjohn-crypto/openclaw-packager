# openclaw-backup

Export and import OpenClaw bot configurations. Enables migration between machines, disaster recovery, and sharing setups (with secrets stripped).

## Installation

```bash
npm install -g openclaw-backup
```

Or run locally:
```bash
cd openclaw-backup
npm install
npm run build
npm link  # Makes 'openclaw-backup' available globally
```

## Commands

### Export

Export your OpenClaw configuration to a zip file:

```bash
openclaw-backup export                          # Default export (secrets stripped)
openclaw-backup export -o backup.zip            # Specify output file
openclaw-backup export --dry-run                # Preview what would be exported
openclaw-backup export --no-workspace           # Exclude workspace files
openclaw-backup export --no-memory              # Exclude memory files
openclaw-backup export --agent main worker      # Export only specific agents
openclaw-backup export --auth                   # Include auth profiles/credentials
openclaw-backup export --include-secrets        # Include actual secret values (dangerous!)
openclaw-backup export --include-projects       # Include workspace/projects/ (large, excluded by default)
openclaw-backup export --stdout > backup.zip    # Pipe to stdout (for SSH)
```

**SSH piping example:**
```bash
ssh pi "openclaw-backup export --stdout" > pi-backup.zip
```

### Import

Import a backup into an OpenClaw installation:

```bash
openclaw-backup import backup.zip                       # Import with merge (preserve existing)
openclaw-backup import backup.zip --dry-run             # Preview what would change
openclaw-backup import backup.zip --force               # Overwrite all existing files
openclaw-backup import backup.zip --target ~/.openclaw-dev  # Specify target directory
openclaw-backup import backup.zip --skip-workspace      # Skip workspace files
openclaw-backup import backup.zip --skip-cron           # Skip cron jobs
```

### Inspect

View contents of a backup without importing:

```bash
openclaw-backup inspect backup.zip
```

## What's Included

By default, exports include:
- ✅ **Config** - `openclaw.json`
- ✅ **Cron jobs** - `cron/jobs.json`
- ✅ **Workspace** - skills, scripts, automation, AGENTS.md, SOUL.md, etc.
- ✅ **Memory** - MEMORY.md and memory/ folder
- ✅ **Agents** - Agent definitions (models.json per agent)

By default, exports **exclude**:
- ❌ **Auth** - `auth-profiles.json` and `credentials/` (use `--auth` to include)
- ❌ **Secrets** - Tokens, API keys, passwords (use `--include-secrets` to include)
- ❌ **Identity** - Device keypairs (machine-specific, never exported)
- ❌ **Sessions** - Chat history (too large)
- ❌ **Logs, browser data, media** - Runtime artifacts

## Secret Handling

By default, all secrets are **stripped** and replaced with placeholders:
```json
{
  "token": "__OPENCLAW_SECRET__:token",
  "apiKey": "__OPENCLAW_SECRET__:apiKey"
}
```

A `SECRETS_TEMPLATE.json` is included in the export listing all secrets that need to be filled in on the target machine.

Use `--include-secrets` only if you're transferring to a trusted machine and need the actual values.

## Merge vs Force Import

- **Merge (default)**: Adds new files, skips existing ones. Safe for updating.
- **Force (`--force`)**: Overwrites all files. Use for full restoration.

For cron jobs:
- Merge: Only adds jobs with IDs that don't exist in the target
- Force: Replaces all jobs

## Requirements

- Node.js 18+
- OpenClaw installed at `~/.openclaw` (or `$OPENCLAW_STATE_DIR`)

## License

MIT
