/**
 * Export command for openclaw-packager
 */

import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import chalk from 'chalk';

import { 
  detectOpenClawDir, 
  getOpenClawPaths, 
  shouldExclude,
  shouldExcludeWorkspace,
  listAgents,
  OpenClawPaths 
} from './paths';
import { 
  createManifest, 
  formatSize, 
  Manifest 
} from './manifest';
import { 
  stripSecrets, 
  createSecretsTemplate,
  addCredentialFile,
  addAgentAuth,
  SecretsTemplate 
} from './secrets';
import { 
  Logger, 
  walkDir, 
  readJson, 
  getTimestamp 
} from './utils';

export interface ExportOptions {
  output?: string;
  workspace?: boolean;
  cron?: boolean;
  config?: boolean;
  agents?: boolean;
  agent?: string[];
  memory?: boolean;
  auth?: boolean;
  includeSecrets?: boolean;
  includeProjects?: boolean;
  stdout?: boolean;
  dryRun?: boolean;
}

interface ExportStats {
  totalFiles: number;
  totalSize: number;
  cronJobs: number;
  skills: number;
  agentCount: number;
}

/**
 * Run the export command
 */
export async function runExport(options: ExportOptions): Promise<void> {
  const logger = new Logger(options.stdout);
  
  // Detect OpenClaw directory
  const openclawDir = detectOpenClawDir();
  if (!openclawDir) {
    logger.error(chalk.red('✗ Could not find OpenClaw directory'));
    logger.error('  Checked: $OPENCLAW_STATE_DIR, ~/.openclaw, ~/.openclaw-dev');
    logger.error('  Make sure OpenClaw is installed.');
    process.exit(1);
  }
  
  const paths = getOpenClawPaths(openclawDir);
  logger.heading('OpenClaw Backup Export');
  logger.log(`Source: ${chalk.cyan(paths.root)}`);
  
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
  const agentFilter = options.agent || null;  // null = all agents
  
  // Prepare output
  const outputPath = options.output || `./openclaw-export-${getTimestamp()}.zip`;
  
  if (options.dryRun) {
    await runDryRun(paths, includes, includeSecrets, includeProjects, agentFilter, logger);
    return;
  }
  
  // Create the archive
  const stats = await createArchive(
    paths, 
    includes, 
    includeSecrets,
    includeProjects,
    agentFilter,
    outputPath, 
    options.stdout || false,
    logger
  );
  
  // Summary
  if (!options.stdout) {
    logger.heading('Export Complete');
    logger.success(`Created: ${chalk.green(outputPath)}`);
    logger.log(`  Files: ${stats.totalFiles}`);
    logger.log(`  Size: ${formatSize(stats.totalSize)}`);
    if (!includeSecrets && stats.secretsStripped > 0) {
      logger.warn(`Secrets stripped: ${stats.secretsStripped} values replaced with placeholders`);
      logger.log(`  Use ${chalk.cyan('--include-secrets')} to include actual values`);
    }
  }
}

/**
 * Run in dry-run mode (preview only)
 */
async function runDryRun(
  paths: OpenClawPaths,
  includes: Record<string, boolean>,
  includeSecrets: boolean,
  includeProjects: boolean,
  agentFilter: string[] | null,
  logger: Logger
): Promise<void> {
  logger.heading('Dry Run - Preview');
  logger.log(chalk.dim('(No files will be created)\n'));
  
  let totalFiles = 0;
  let totalSize = 0;
  
  // Config
  if (includes.config && fs.existsSync(paths.config)) {
    const stats = fs.statSync(paths.config);
    logger.log(`${chalk.green('✓')} Config: openclaw.json (${formatSize(stats.size)})`);
    totalFiles++;
    totalSize += stats.size;
  }
  
  // Cron
  if (includes.cron) {
    const cronFile = path.join(paths.cron, 'jobs.json');
    if (fs.existsSync(cronFile)) {
      const stats = fs.statSync(cronFile);
      const jobs = readJson<{ jobs: unknown[] }>(cronFile);
      const jobCount = jobs?.jobs?.length || 0;
      logger.log(`${chalk.green('✓')} Cron: ${jobCount} jobs (${formatSize(stats.size)})`);
      totalFiles++;
      totalSize += stats.size;
    }
  }
  
  // Agents
  if (includes.agents) {
    let agents = listAgents(paths.agents);
    if (agentFilter) {
      agents = agents.filter(a => agentFilter.includes(a));
    }
    logger.log(`${chalk.green('✓')} Agents: ${agents.join(', ') || 'none'}`);
    for (const agent of agents) {
      const agentDir = path.join(paths.agents, agent, 'agent');
      if (fs.existsSync(agentDir)) {
        for await (const file of walkDir(agentDir)) {
          if (!shouldExclude(file.relativePath)) {
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
    
    for await (const file of walkDir(paths.workspace)) {
      if (shouldExcludeWorkspace(file.relativePath, includeProjects)) continue;
      
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
    
    logger.log(`${chalk.green('✓')} Workspace: ${workspaceFiles} files (${formatSize(workspaceSize)})`);
    if (skillCount > 0) {
      logger.log(`  Skills: ${skillCount}`);
    }
    if (!includeProjects) {
      logger.log(`  ${chalk.dim('Projects excluded (use --include-projects to include)')}`);
    }
    totalFiles += workspaceFiles;
    totalSize += workspaceSize;
  }
  
  // Memory
  if (includes.memory) {
    logger.log(`${chalk.green('✓')} Memory: MEMORY.md + memory/ folder`);
  }
  
  // Auth
  if (includes.auth) {
    logger.log(`${chalk.green('✓')} Auth: auth-profiles.json + credentials/`);
  } else {
    logger.log(`${chalk.dim('○')} Auth: ${chalk.dim('excluded (use --auth to include)')}`);
  }
  
  // Secrets
  if (includeSecrets) {
    logger.warn('Secrets: INCLUDED (real tokens/keys will be in export)');
  } else {
    logger.log(`${chalk.green('✓')} Secrets: stripped (placeholders used)`);
  }
  
  logger.heading('Summary');
  logger.log(`  Total files: ~${totalFiles}`);
  logger.log(`  Total size: ~${formatSize(totalSize)}`);
  logger.log(`\n  Run without ${chalk.cyan('--dry-run')} to create the export.`);
}

/**
 * Create the actual archive
 */
async function createArchive(
  paths: OpenClawPaths,
  includes: Record<string, boolean>,
  includeSecrets: boolean,
  includeProjects: boolean,
  agentFilter: string[] | null,
  outputPath: string,
  toStdout: boolean,
  logger: Logger
): Promise<ExportStats & { secretsStripped: number }> {
  const stats: ExportStats & { secretsStripped: number } = {
    totalFiles: 0,
    totalSize: 0,
    cronJobs: 0,
    skills: 0,
    agentCount: 0,
    secretsStripped: 0,
  };
  
  const secretsTemplate = createSecretsTemplate();
  const agents: string[] = [];
  
  // Create archive
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  // Output handling
  let output: NodeJS.WritableStream;
  if (toStdout) {
    output = process.stdout;
  } else {
    output = fs.createWriteStream(outputPath);
  }
  
  archive.pipe(output);
  
  // Helper to add file with optional secret stripping
  const addFile = (
    filePath: string, 
    archivePath: string
  ): boolean => {
    let content: Buffer;
    let fileStats: fs.Stats;
    
    try {
      content = fs.readFileSync(filePath);
      fileStats = fs.statSync(filePath);
    } catch (err) {
      // Skip files we can't read (permission errors, etc)
      return false;
    }
    
    // Strip secrets from JSON files if needed
    if (!includeSecrets && filePath.endsWith('.json')) {
      // Strip secrets from JSON files (both secret files and regular files)
      const result = stripSecrets(content.toString('utf-8'), archivePath);
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
      const jobs = readJson<{ jobs: unknown[] }>(cronFile);
      stats.cronJobs = jobs?.jobs?.length || 0;
      addFile(cronFile, 'cron/jobs.json');
    }
  }
  
  // Agents
  if (includes.agents) {
    let agentList = listAgents(paths.agents);
    if (agentFilter) {
      agentList = agentList.filter(a => agentFilter.includes(a));
    }
    logger.info(`Adding ${agentList.length} agents...`);
    stats.agentCount = agentList.length;
    
    for (const agent of agentList) {
      agents.push(agent);
      const agentDir = path.join(paths.agents, agent, 'agent');
      
      if (fs.existsSync(agentDir)) {
        for await (const file of walkDir(agentDir)) {
          if (shouldExclude(file.relativePath)) continue;
          
          // Handle auth files
          if (file.relativePath.includes('auth-profiles')) {
            if (includes.auth) {
              const archivePath = `agents/${agent}/${file.relativePath}`;
              addFile(file.path, archivePath);
              addAgentAuth(secretsTemplate, agent, 'auth-profiles');
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
    for await (const file of walkDir(paths.credentials)) {
      if (shouldExclude(file.relativePath)) continue;
      
      const archivePath = `credentials/${file.relativePath}`;
      addFile(file.path, archivePath);
      addCredentialFile(secretsTemplate, file.relativePath);
    }
  }
  
  // Workspace
  if (includes.workspace && fs.existsSync(paths.workspace)) {
    logger.info('Adding workspace...');
    
    for await (const file of walkDir(paths.workspace)) {
      if (shouldExcludeWorkspace(file.relativePath, includeProjects)) continue;
      
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
  const manifest = createManifest({
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
      totalSize: formatSize(stats.totalSize),
      cronJobs: stats.cronJobs,
      skills: stats.skills,
      agents: stats.agentCount,
    },
  });
  
  // Try to get OpenClaw version
  try {
    const pkg = readJson<{ version: string }>(
      path.join(paths.root, '..', 'openclaw', 'package.json')
    );
    if (pkg?.version) {
      manifest.openclawVersion = pkg.version;
    }
  } catch {
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
    await new Promise<void>((resolve, reject) => {
      (output as fs.WriteStream).on('close', resolve);
      (output as fs.WriteStream).on('error', reject);
    });
  }
  
  return stats;
}
