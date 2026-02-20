#!/usr/bin/env node
"use strict";
/**
 * openclaw-backup - Export and import OpenClaw bot configurations
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const export_1 = require("./export");
const import_1 = require("./import");
const inspect_1 = require("./inspect");
const program = new commander_1.Command();
program
    .name('openclaw-backup')
    .description('Export and import OpenClaw bot configurations')
    .version('0.1.0');
// Export command
program
    .command('export')
    .description('Export OpenClaw configuration to a zip file')
    .option('-o, --output <path>', 'Output file path')
    .option('--workspace', 'Include workspace (default: true)')
    .option('--no-workspace', 'Exclude workspace')
    .option('--cron', 'Include cron jobs (default: true)')
    .option('--no-cron', 'Exclude cron jobs')
    .option('--config', 'Include openclaw.json config (default: true)')
    .option('--no-config', 'Exclude config')
    .option('--agents', 'Include agent definitions (default: true)')
    .option('--no-agents', 'Exclude agents')
    .option('--agent <names...>', 'Export only specific agents (e.g. --agent main worker)')
    .option('--memory', 'Include MEMORY.md and memory/ folder (default: true)')
    .option('--no-memory', 'Exclude memory')
    .option('--auth', 'Include auth-profiles.json and credentials/ (default: false)')
    .option('--include-secrets', 'Include actual secret values (tokens, keys)')
    .option('--include-projects', 'Include workspace/projects/ (excluded by default, large)')
    .option('--stdout', 'Write zip to stdout (for SSH piping)')
    .option('--dry-run', 'Preview what would be exported')
    .action(async (options) => {
    try {
        await (0, export_1.runExport)(options);
    }
    catch (err) {
        console.error(chalk_1.default.red('Export failed:'), err);
        process.exit(1);
    }
});
// Import command
program
    .command('import <file>')
    .description('Import OpenClaw configuration from a backup zip')
    .option('--dry-run', 'Preview what would change')
    .option('--merge', 'Add missing files, skip existing (default)')
    .option('--force', 'Overwrite all existing files')
    .option('--target <path>', 'Target OpenClaw directory (default: ~/.openclaw)')
    .option('--skip-workspace', 'Skip workspace files')
    .option('--skip-cron', 'Skip cron jobs')
    .option('--skip-config', 'Skip config')
    .action(async (file, options) => {
    try {
        await (0, import_1.runImport)(file, options);
    }
    catch (err) {
        console.error(chalk_1.default.red('Import failed:'), err);
        process.exit(1);
    }
});
// Inspect command
program
    .command('inspect <file>')
    .description('Show contents of a backup without importing')
    .action(async (file, options) => {
    try {
        await (0, inspect_1.runInspect)(file, options);
    }
    catch (err) {
        console.error(chalk_1.default.red('Inspect failed:'), err);
        process.exit(1);
    }
});
// Parse and run
program.parse();
//# sourceMappingURL=index.js.map