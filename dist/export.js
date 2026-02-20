"use strict";
/**
 * Export command for openclaw-backup
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
exports.runExport = runExport;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const archiver_1 = __importDefault(require("archiver"));
const chalk_1 = __importDefault(require("chalk"));
const paths_1 = require("./paths");
const manifest_1 = require("./manifest");
const secrets_1 = require("./secrets");
const utils_1 = require("./utils");
/**
 * Run the export command
 */
async function runExport(options) {
    const logger = new utils_1.Logger(options.stdout);
    // Detect OpenClaw directory
    const openclawDir = (0, paths_1.detectOpenClawDir)();
    if (!openclawDir) {
        logger.error(chalk_1.default.red('✗ Could not find OpenClaw directory'));
        logger.error('  Checked: $OPENCLAW_STATE_DIR, ~/.openclaw, ~/.openclaw-dev');
        logger.error('  Make sure OpenClaw is installed.');
        process.exit(1);
    }
    const paths = (0, paths_1.getOpenClawPaths)(openclawDir);
    logger.heading('OpenClaw Backup Export');
    logger.log(`Source: ${chalk_1.default.cyan(paths.root)}`);
    // Default options: include everything except auth
    const includes = {
        workspace: options.workspace !== false,
        cron: options.cron !== false,
        config: options.config !== false,
        agents: options.agents !== false,
        memory: options.memory !== false,
        auth: options.auth === true,
    };
    const includeSecrets = options.includeSecrets === true;
    const includeProjects = options.includeProjects === true;
    const agentFilter = options.agent || null; // null = all agents
    // Prepare output
    const outputPath = options.output || `./openclaw-export-${(0, utils_1.getTimestamp)()}.zip`;
    if (options.dryRun) {
        await runDryRun(paths, includes, includeSecrets, includeProjects, agentFilter, logger);
        return;
    }
    // Create the archive
    const stats = await createArchive(paths, includes, includeSecrets, includeProjects, agentFilter, outputPath, options.stdout || false, logger);
    // Summary
    if (!options.stdout) {
        logger.heading('Export Complete');
        logger.success(`Created: ${chalk_1.default.green(outputPath)}`);
        logger.log(`  Files: ${stats.totalFiles}`);
        logger.log(`  Size: ${(0, manifest_1.formatSize)(stats.totalSize)}`);
        if (!includeSecrets && stats.secretsStripped > 0) {
            logger.warn(`Secrets stripped: ${stats.secretsStripped} values replaced with placeholders`);
            logger.log(`  Use ${chalk_1.default.cyan('--include-secrets')} to include actual values`);
        }
    }
}
/**
 * Run in dry-run mode (preview only)
 */
async function runDryRun(paths, includes, includeSecrets, includeProjects, agentFilter, logger) {
    logger.heading('Dry Run - Preview');
    logger.log(chalk_1.default.dim('(No files will be created)\n'));
    let totalFiles = 0;
    let totalSize = 0;
    // Config
    if (includes.config && fs.existsSync(paths.config)) {
        const stats = fs.statSync(paths.config);
        logger.log(`${chalk_1.default.green('✓')} Config: openclaw.json (${(0, manifest_1.formatSize)(stats.size)})`);
        totalFiles++;
        totalSize += stats.size;
    }
    // Cron
    if (includes.cron) {
        const cronFile = path.join(paths.cron, 'jobs.json');
        if (fs.existsSync(cronFile)) {
            const stats = fs.statSync(cronFile);
            const jobs = (0, utils_1.readJson)(cronFile);
            const jobCount = jobs?.jobs?.length || 0;
            logger.log(`${chalk_1.default.green('✓')} Cron: ${jobCount} jobs (${(0, manifest_1.formatSize)(stats.size)})`);
            totalFiles++;
            totalSize += stats.size;
        }
    }
    // Agents
    if (includes.agents) {
        let agents = (0, paths_1.listAgents)(paths.agents);
        if (agentFilter) {
            agents = agents.filter(a => agentFilter.includes(a));
        }
        logger.log(`${chalk_1.default.green('✓')} Agents: ${agents.join(', ') || 'none'}`);
        for (const agent of agents) {
            const agentDir = path.join(paths.agents, agent, 'agent');
            if (fs.existsSync(agentDir)) {
                for await (const file of (0, utils_1.walkDir)(agentDir)) {
                    if (!(0, paths_1.shouldExclude)(file.relativePath)) {
                        // Skip auth unless included
                        if (!includes.auth && file.relativePath.includes('auth-profiles')) {
                            continue;
                        }
                        totalFiles++;
                        totalSize += file.stats.size;
                    }
                }
            }
        }
    }
    // Workspace
    if (includes.workspace && fs.existsSync(paths.workspace)) {
        let workspaceFiles = 0;
        let workspaceSize = 0;
        let skillCount = 0;
        for await (const file of (0, utils_1.walkDir)(paths.workspace)) {
            if ((0, paths_1.shouldExcludeWorkspace)(file.relativePath, includeProjects))
                continue;
            // Skip memory if not included
            if (!includes.memory) {
                if (file.relativePath === 'MEMORY.md' || file.relativePath.startsWith('memory/')) {
                    continue;
                }
            }
            workspaceFiles++;
            workspaceSize += file.stats.size;
            // Count skills
            if (file.relativePath.startsWith('skills/') && file.relativePath.endsWith('SKILL.md')) {
                skillCount++;
            }
        }
        logger.log(`${chalk_1.default.green('✓')} Workspace: ${workspaceFiles} files (${(0, manifest_1.formatSize)(workspaceSize)})`);
        if (skillCount > 0) {
            logger.log(`  Skills: ${skillCount}`);
        }
        if (!includeProjects) {
            logger.log(`  ${chalk_1.default.dim('Projects excluded (use --include-projects to include)')}`);
        }
        totalFiles += workspaceFiles;
        totalSize += workspaceSize;
    }
    // Memory
    if (includes.memory) {
        logger.log(`${chalk_1.default.green('✓')} Memory: MEMORY.md + memory/ folder`);
    }
    // Auth
    if (includes.auth) {
        logger.log(`${chalk_1.default.green('✓')} Auth: auth-profiles.json + credentials/`);
    }
    else {
        logger.log(`${chalk_1.default.dim('○')} Auth: ${chalk_1.default.dim('excluded (use --auth to include)')}`);
    }
    // Secrets
    if (includeSecrets) {
        logger.warn('Secrets: INCLUDED (real tokens/keys will be in export)');
    }
    else {
        logger.log(`${chalk_1.default.green('✓')} Secrets: stripped (placeholders used)`);
    }
    logger.heading('Summary');
    logger.log(`  Total files: ~${totalFiles}`);
    logger.log(`  Total size: ~${(0, manifest_1.formatSize)(totalSize)}`);
    logger.log(`\n  Run without ${chalk_1.default.cyan('--dry-run')} to create the export.`);
}
/**
 * Create the actual archive
 */
async function createArchive(paths, includes, includeSecrets, includeProjects, agentFilter, outputPath, toStdout, logger) {
    const stats = {
        totalFiles: 0,
        totalSize: 0,
        cronJobs: 0,
        skills: 0,
        agentCount: 0,
        secretsStripped: 0,
    };
    const secretsTemplate = (0, secrets_1.createSecretsTemplate)();
    const agents = [];
    // Create archive
    const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
    // Output handling
    let output;
    if (toStdout) {
        output = process.stdout;
    }
    else {
        output = fs.createWriteStream(outputPath);
    }
    archive.pipe(output);
    // Helper to add file with optional secret stripping
    const addFile = (filePath, archivePath) => {
        let content;
        let fileStats;
        try {
            content = fs.readFileSync(filePath);
            fileStats = fs.statSync(filePath);
        }
        catch (err) {
            // Skip files we can't read (permission errors, etc)
            return false;
        }
        // Strip secrets from JSON files if needed
        if (!includeSecrets && filePath.endsWith('.json')) {
            // Strip secrets from JSON files (both secret files and regular files)
            const result = (0, secrets_1.stripSecrets)(content.toString('utf-8'), archivePath);
            if (result.secretsStripped > 0) {
                content = Buffer.from(result.content);
                stats.secretsStripped += result.secretsStripped;
            }
        }
        archive.append(content, { name: archivePath });
        stats.totalFiles++;
        stats.totalSize += fileStats.size;
        return true;
    };
    // Config
    if (includes.config && fs.existsSync(paths.config)) {
        logger.info('Adding config...');
        addFile(paths.config, 'config/openclaw.json');
    }
    // Cron
    if (includes.cron) {
        const cronFile = path.join(paths.cron, 'jobs.json');
        if (fs.existsSync(cronFile)) {
            logger.info('Adding cron jobs...');
            const jobs = (0, utils_1.readJson)(cronFile);
            stats.cronJobs = jobs?.jobs?.length || 0;
            addFile(cronFile, 'cron/jobs.json');
        }
    }
    // Agents
    if (includes.agents) {
        let agentList = (0, paths_1.listAgents)(paths.agents);
        if (agentFilter) {
            agentList = agentList.filter(a => agentFilter.includes(a));
        }
        logger.info(`Adding ${agentList.length} agents...`);
        stats.agentCount = agentList.length;
        for (const agent of agentList) {
            agents.push(agent);
            const agentDir = path.join(paths.agents, agent, 'agent');
            if (fs.existsSync(agentDir)) {
                for await (const file of (0, utils_1.walkDir)(agentDir)) {
                    if ((0, paths_1.shouldExclude)(file.relativePath))
                        continue;
                    // Handle auth files
                    if (file.relativePath.includes('auth-profiles')) {
                        if (includes.auth) {
                            const archivePath = `agents/${agent}/${file.relativePath}`;
                            addFile(file.path, archivePath);
                            (0, secrets_1.addAgentAuth)(secretsTemplate, agent, 'auth-profiles');
                        }
                        continue;
                    }
                    const archivePath = `agents/${agent}/${file.relativePath}`;
                    addFile(file.path, archivePath);
                }
            }
        }
    }
    // Credentials
    if (includes.auth && fs.existsSync(paths.credentials)) {
        logger.info('Adding credentials...');
        for await (const file of (0, utils_1.walkDir)(paths.credentials)) {
            if ((0, paths_1.shouldExclude)(file.relativePath))
                continue;
            const archivePath = `credentials/${file.relativePath}`;
            addFile(file.path, archivePath);
            (0, secrets_1.addCredentialFile)(secretsTemplate, file.relativePath);
        }
    }
    // Workspace
    if (includes.workspace && fs.existsSync(paths.workspace)) {
        logger.info('Adding workspace...');
        for await (const file of (0, utils_1.walkDir)(paths.workspace)) {
            if ((0, paths_1.shouldExcludeWorkspace)(file.relativePath, includeProjects))
                continue;
            // Skip memory if not included
            if (!includes.memory) {
                if (file.relativePath === 'MEMORY.md' || file.relativePath.startsWith('memory/') || file.relativePath.startsWith('memory\\')) {
                    continue;
                }
            }
            // Count skills
            if (file.relativePath.startsWith('skills/') && file.relativePath.endsWith('SKILL.md')) {
                stats.skills++;
            }
            const archivePath = `workspace/${file.relativePath}`;
            addFile(file.path, archivePath);
        }
    }
    // Create manifest
    const manifest = (0, manifest_1.createManifest)({
        includes: {
            workspace: includes.workspace,
            cron: includes.cron,
            config: includes.config,
            agents,
            memory: includes.memory,
            auth: includes.auth,
        },
        secretsIncluded: includeSecrets,
        secretsStripped: stats.secretsStripped,
        stats: {
            totalFiles: stats.totalFiles,
            totalSize: (0, manifest_1.formatSize)(stats.totalSize),
            cronJobs: stats.cronJobs,
            skills: stats.skills,
            agents: stats.agentCount,
        },
    });
    // Try to get OpenClaw version
    try {
        const pkg = (0, utils_1.readJson)(path.join(paths.root, '..', 'openclaw', 'package.json'));
        if (pkg?.version) {
            manifest.openclawVersion = pkg.version;
        }
    }
    catch {
        // Ignore
    }
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    // Add secrets template if secrets were stripped
    if (!includeSecrets && stats.secretsStripped > 0) {
        archive.append(JSON.stringify(secretsTemplate, null, 2), {
            name: 'SECRETS_TEMPLATE.json'
        });
    }
    // Finalize
    await archive.finalize();
    // Wait for output to finish
    if (!toStdout) {
        await new Promise((resolve, reject) => {
            output.on('close', resolve);
            output.on('error', reject);
        });
    }
    return stats;
}
//# sourceMappingURL=export.js.map