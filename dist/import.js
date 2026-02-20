"use strict";
/**
 * Import command for openclaw-backup
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runImport = runImport;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const chalk_1 = __importDefault(require("chalk"));
const manifest_1 = require("./manifest");
const paths_1 = require("./paths");
const utils_1 = require("./utils");
/**
 * Run the import command
 */
async function runImport(file, options) {
    const logger = new utils_1.Logger();
    // Validate file exists
    if (!fs.existsSync(file)) {
        logger.error(chalk_1.default.red(`✗ File not found: ${file}`));
        process.exit(1);
    }
    // Open zip
    let zip;
    try {
        zip = new adm_zip_1.default(file);
    }
    catch (err) {
        logger.error(chalk_1.default.red(`✗ Could not open zip file: ${file}`));
        logger.error(`  ${err}`);
        process.exit(1);
    }
    // Validate manifest
    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) {
        logger.error(chalk_1.default.red('✗ Not a valid openclaw-backup export'));
        logger.error('  Missing manifest.json - this file was not created by openclaw-backup');
        process.exit(1);
    }
    let manifest;
    try {
        const content = manifestEntry.getData().toString('utf-8');
        const parsed = JSON.parse(content);
        if (!(0, manifest_1.validateManifest)(parsed)) {
            throw new Error('Invalid manifest structure');
        }
        manifest = parsed;
    }
    catch (err) {
        logger.error(chalk_1.default.red('✗ Invalid manifest.json'));
        logger.error(`  ${err}`);
        process.exit(1);
    }
    // Determine target directory
    let targetDir = options.target || '';
    if (!targetDir) {
        const detected = (0, paths_1.detectOpenClawDir)();
        if (!detected) {
            logger.error(chalk_1.default.red('✗ Could not find OpenClaw directory'));
            logger.error('  Use --target to specify the destination');
            process.exit(1);
        }
        targetDir = detected;
    }
    const targetPaths = (0, paths_1.getOpenClawPaths)(targetDir);
    const isExisting = fs.existsSync(path.join(targetDir, 'openclaw.json')) ||
        fs.existsSync(path.join(targetDir, 'agents'));
    const mode = options.force ? 'force' : 'merge';
    logger.heading('OpenClaw Backup Import');
    logger.log(`Source: ${chalk_1.default.cyan(path.basename(file))}`);
    logger.log(`Target: ${chalk_1.default.cyan(targetDir)}`);
    logger.log(`Mode: ${mode === 'force' ? chalk_1.default.yellow('force (overwrite)') : chalk_1.default.green('merge (preserve existing)')}`);
    logger.log(`Installation: ${isExisting ? 'existing' : chalk_1.default.green('fresh')}`);
    if (options.dryRun) {
        logger.log(chalk_1.default.dim('\n(Dry run - no files will be modified)\n'));
    }
    // What will be imported
    logger.heading('Import Plan');
    const willImport = {
        config: manifest.includes.config && !options.skipConfig,
        cron: manifest.includes.cron && !options.skipCron,
        workspace: manifest.includes.workspace && !options.skipWorkspace,
        agents: manifest.includes.agents.length > 0,
    };
    if (willImport.config)
        logger.log(`  ${chalk_1.default.green('✓')} Config: openclaw.json`);
    if (willImport.cron)
        logger.log(`  ${chalk_1.default.green('✓')} Cron: ${manifest.stats.cronJobs || 0} jobs`);
    if (willImport.workspace)
        logger.log(`  ${chalk_1.default.green('✓')} Workspace: files`);
    if (willImport.agents)
        logger.log(`  ${chalk_1.default.green('✓')} Agents: ${manifest.includes.agents.join(', ')}`);
    if (options.skipConfig)
        logger.log(`  ${chalk_1.default.dim('○ Config: skipped')}`);
    if (options.skipCron)
        logger.log(`  ${chalk_1.default.dim('○ Cron: skipped')}`);
    if (options.skipWorkspace)
        logger.log(`  ${chalk_1.default.dim('○ Workspace: skipped')}`);
    if (options.dryRun) {
        // Just show what would happen
        await runDryRunImport(zip, manifest, targetPaths, willImport, mode, logger);
        return;
    }
    // Actually import
    const stats = await performImport(zip, manifest, targetPaths, willImport, mode, logger);
    // Summary
    logger.heading('Import Complete');
    logger.success(`Files written: ${stats.filesWritten}`);
    if (stats.filesSkipped > 0) {
        logger.log(`  Skipped (existing): ${stats.filesSkipped}`);
    }
    if (stats.filesOverwritten > 0) {
        logger.log(`  Overwritten: ${stats.filesOverwritten}`);
    }
    if (stats.cronJobsAdded > 0 || stats.cronJobsSkipped > 0) {
        logger.log(`  Cron jobs: ${stats.cronJobsAdded} added, ${stats.cronJobsSkipped} skipped`);
    }
    // Secrets warning
    if (!manifest.secretsIncluded && manifest.secretsStripped > 0) {
        logger.heading('⚠️  Secrets Not Included');
        logger.warn('The export had secrets stripped. You need to fill in:');
        const templateEntry = zip.getEntry('SECRETS_TEMPLATE.json');
        if (templateEntry) {
            try {
                const template = JSON.parse(templateEntry.getData().toString('utf-8'));
                if (template.config && Object.keys(template.config).length > 0) {
                    logger.log('\n  Config (openclaw.json):');
                    for (const key of Object.keys(template.config).slice(0, 5)) {
                        logger.log(`    - ${key}`);
                    }
                }
                if (template.credentials && template.credentials.length > 0) {
                    logger.log('\n  Credentials (recreate these files):');
                    for (const cred of template.credentials.slice(0, 5)) {
                        logger.log(`    - credentials/${cred}`);
                    }
                }
                if (template.agentAuth && Object.keys(template.agentAuth).length > 0) {
                    logger.log('\n  Agent Auth:');
                    for (const [agent, auths] of Object.entries(template.agentAuth)) {
                        logger.log(`    - ${agent}: ${auths.join(', ')}`);
                    }
                }
            }
            catch {
                logger.log('  See SECRETS_TEMPLATE.json in the archive for details');
            }
        }
    }
    // Next steps
    logger.heading('Next Steps');
    logger.log('  1. Fill in any missing API keys/tokens');
    logger.log('  2. Run: openclaw doctor');
    logger.log('  3. Run: openclaw gateway start');
}
/**
 * Dry run - show what would be imported
 */
async function runDryRunImport(zip, manifest, targetPaths, willImport, mode, logger) {
    const entries = zip.getEntries().filter(e => !e.isDirectory && e.entryName !== 'manifest.json' && e.entryName !== 'SECRETS_TEMPLATE.json');
    let wouldWrite = 0;
    let wouldSkip = 0;
    let wouldOverwrite = 0;
    logger.heading('Files');
    for (const entry of entries) {
        const targetPath = mapEntryToTarget(entry.entryName, targetPaths);
        if (!targetPath)
            continue;
        // Check skip conditions
        if (entry.entryName.startsWith('config/') && !willImport.config)
            continue;
        if (entry.entryName.startsWith('cron/') && !willImport.cron)
            continue;
        if (entry.entryName.startsWith('workspace/') && !willImport.workspace)
            continue;
        const exists = fs.existsSync(targetPath);
        if (exists && mode === 'merge') {
            wouldSkip++;
            logger.log(`  ${chalk_1.default.dim('skip')}  ${entry.entryName}`);
        }
        else if (exists && mode === 'force') {
            wouldOverwrite++;
            logger.log(`  ${chalk_1.default.yellow('overwrite')}  ${entry.entryName}`);
        }
        else {
            wouldWrite++;
            logger.log(`  ${chalk_1.default.green('write')}  ${entry.entryName}`);
        }
    }
    logger.heading('Summary');
    logger.log(`  Would write: ${wouldWrite} files`);
    logger.log(`  Would skip: ${wouldSkip} files`);
    logger.log(`  Would overwrite: ${wouldOverwrite} files`);
    logger.log(`\n  Run without ${chalk_1.default.cyan('--dry-run')} to perform the import.`);
}
/**
 * Actually perform the import
 */
async function performImport(zip, manifest, targetPaths, willImport, mode, logger) {
    const stats = {
        filesWritten: 0,
        filesSkipped: 0,
        filesOverwritten: 0,
        cronJobsAdded: 0,
        cronJobsSkipped: 0,
    };
    const entries = zip.getEntries().filter(e => !e.isDirectory);
    // Handle cron specially for merge logic
    if (willImport.cron) {
        const cronEntry = zip.getEntry('cron/jobs.json');
        if (cronEntry) {
            const cronResult = importCronJobs(cronEntry, targetPaths.cron, mode, logger);
            stats.cronJobsAdded = cronResult.added;
            stats.cronJobsSkipped = cronResult.skipped;
            if (cronResult.added > 0) {
                stats.filesWritten++;
            }
        }
    }
    // Handle config specially for merge logic
    if (willImport.config) {
        const configEntry = zip.getEntry('config/openclaw.json');
        if (configEntry) {
            const result = importConfig(configEntry, targetPaths.config, mode, logger);
            if (result === 'written')
                stats.filesWritten++;
            else if (result === 'merged')
                stats.filesWritten++;
            else if (result === 'skipped')
                stats.filesSkipped++;
        }
    }
    // Process other files
    for (const entry of entries) {
        // Skip manifest and template
        if (entry.entryName === 'manifest.json' || entry.entryName === 'SECRETS_TEMPLATE.json') {
            continue;
        }
        // Skip cron and config (handled above)
        if (entry.entryName === 'cron/jobs.json' || entry.entryName === 'config/openclaw.json') {
            continue;
        }
        // Check skip conditions
        if (entry.entryName.startsWith('config/') && !willImport.config)
            continue;
        if (entry.entryName.startsWith('cron/') && !willImport.cron)
            continue;
        if (entry.entryName.startsWith('workspace/') && !willImport.workspace)
            continue;
        if (entry.entryName.startsWith('agents/') && !willImport.agents)
            continue;
        const targetPath = mapEntryToTarget(entry.entryName, targetPaths);
        if (!targetPath)
            continue;
        const exists = fs.existsSync(targetPath);
        if (exists && mode === 'merge') {
            stats.filesSkipped++;
            continue;
        }
        // Write the file
        (0, utils_1.ensureDir)(path.dirname(targetPath));
        fs.writeFileSync(targetPath, entry.getData());
        if (exists) {
            stats.filesOverwritten++;
        }
        else {
            stats.filesWritten++;
        }
    }
    return stats;
}
/**
 * Map an archive entry path to the target filesystem path
 */
function mapEntryToTarget(entryName, targetPaths) {
    if (entryName.startsWith('config/')) {
        return path.join(targetPaths.root, entryName.replace('config/', ''));
    }
    if (entryName.startsWith('cron/')) {
        return path.join(targetPaths.cron, entryName.replace('cron/', ''));
    }
    if (entryName.startsWith('workspace/')) {
        return path.join(targetPaths.workspace, entryName.replace('workspace/', ''));
    }
    if (entryName.startsWith('agents/')) {
        // agents/main/models.json -> agents/main/agent/models.json
        const parts = entryName.split('/');
        if (parts.length >= 3) {
            const agent = parts[1];
            const rest = parts.slice(2).join('/');
            return path.join(targetPaths.agents, agent, 'agent', rest);
        }
    }
    if (entryName.startsWith('credentials/')) {
        return path.join(targetPaths.credentials, entryName.replace('credentials/', ''));
    }
    return null;
}
/**
 * Import cron jobs with merge logic
 */
function importCronJobs(entry, cronDir, mode, logger) {
    const result = { added: 0, skipped: 0 };
    let sourceJobs;
    try {
        sourceJobs = JSON.parse(entry.getData().toString('utf-8'));
    }
    catch {
        logger.warn('Could not parse source cron/jobs.json');
        return result;
    }
    const targetPath = path.join(cronDir, 'jobs.json');
    if (mode === 'force' || !fs.existsSync(targetPath)) {
        // Just write it
        (0, utils_1.ensureDir)(cronDir);
        fs.writeFileSync(targetPath, JSON.stringify(sourceJobs, null, 2));
        result.added = sourceJobs.jobs?.length || 0;
        return result;
    }
    // Merge mode
    let targetJobs;
    try {
        targetJobs = (0, utils_1.readJson)(targetPath) || { jobs: [] };
    }
    catch {
        targetJobs = { jobs: [] };
    }
    const existingIds = new Set(targetJobs.jobs.map(j => j.id));
    for (const job of sourceJobs.jobs || []) {
        if (existingIds.has(job.id)) {
            result.skipped++;
        }
        else {
            targetJobs.jobs.push(job);
            result.added++;
        }
    }
    if (result.added > 0) {
        (0, utils_1.writeJson)(targetPath, targetJobs);
    }
    return result;
}
/**
 * Import config with merge logic
 */
function importConfig(entry, targetPath, mode, logger) {
    let sourceConfig;
    try {
        sourceConfig = JSON.parse(entry.getData().toString('utf-8'));
    }
    catch {
        logger.warn('Could not parse source config');
        return 'skipped';
    }
    if (mode === 'force' || !fs.existsSync(targetPath)) {
        (0, utils_1.ensureDir)(path.dirname(targetPath));
        fs.writeFileSync(targetPath, JSON.stringify(sourceConfig, null, 2));
        return 'written';
    }
    // Merge mode - target values win
    const targetConfig = (0, utils_1.readJson)(targetPath);
    if (!targetConfig) {
        fs.writeFileSync(targetPath, JSON.stringify(sourceConfig, null, 2));
        return 'written';
    }
    // Deep merge with target winning
    const merged = (0, utils_1.deepMerge)(sourceConfig, targetConfig, true);
    (0, utils_1.writeJson)(targetPath, merged);
    return 'merged';
}
//# sourceMappingURL=import.js.map