
## Status: In Progress

### Done
- [x] Core export with selective flags (workspace, cron, config, agents, memory, auth)
- [x] Per-agent filtering (--agent main worker)
- [x] Smart workspace defaults (excludes projects/research/personal data by default)
- [x] --include-projects flag for full workspace export
- [x] Secrets stripping with SECRETS_TEMPLATE.json
- [x] Import with merge/force modes
- [x] Inspect command
- [x] --stdout for SSH piping
- [x] --dry-run for both export and import
- [x] GitHub repo: https://github.com/clawdbotjohn-crypto/openclaw-backup
- [x] Ideas DB: moved to in-progress

### Blocked
BLOCKED: Cross-device import testing
REASON: Need to test on a different machine (Windows/Mac) to verify cross-platform works
NEEDS: John to export on Pi, import on his laptop (Windows), verify the backup restores correctly
NEXT: Fix any path separator issues or platform-specific bugs found during testing

### Future
- [ ] Individual cron job export/import (share specific jobs with others)
- [ ] Publish to npm (`npm publish`)
- [ ] .claw file extension option
- [ ] Encrypted exports (password-protected zip)
- [ ] Interactive secrets fill-in (`openclaw-backup secrets <file>`)
