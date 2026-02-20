/**
 * Inspect command for openclaw-packager
 */

import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import chalk from 'chalk';

import { validateManifest, Manifest, formatSize } from './manifest';
import { Logger, printTable } from './utils';

export interface InspectOptions {
  // No options for now
}

/**
 * Run the inspect command
 */
export async function runInspect(file: string, options: InspectOptions): Promise<void> {
  const logger = new Logger();
  
  // Validate file exists
  if (!fs.existsSync(file)) {
    logger.error(chalk.red(`✗ File not found: ${file}`));
    process.exit(1);
  }
  
  // Open zip
  let zip: AdmZip;
  try {
    zip = new AdmZip(file);
  } catch (err) {
    logger.error(chalk.red(`✗ Could not open zip file: ${file}`));
    logger.error(`  ${err}`);
    process.exit(1);
  }
  
  // Look for manifest
  const manifestEntry = zip.getEntry('manifest.json');
  if (!manifestEntry) {
    logger.error(chalk.red('✗ Not a valid openclaw-packager export'));
    logger.error('  Missing manifest.json');
    process.exit(1);
  }
  
  // Parse manifest
  let manifest: Manifest;
  try {
    const content = manifestEntry.getData().toString('utf-8');
    const parsed = JSON.parse(content);
    
    if (!validateManifest(parsed)) {
      throw new Error('Invalid manifest structure');
    }
    
    manifest = parsed;
  } catch (err) {
    logger.error(chalk.red('✗ Invalid manifest.json'));
    logger.error(`  ${err}`);
    process.exit(1);
  }
  
  // Get file info
  const fileStats = fs.statSync(file);
  const entries = zip.getEntries();
  
  // Display info
  logger.heading('OpenClaw Backup Archive');
  logger.log(`File: ${chalk.cyan(path.basename(file))}`);
  logger.log(`Size: ${formatSize(fileStats.size)}\n`);
  
  // Manifest info
  logger.heading('Export Info');
  printTable(logger, [
    ['Tool Version', manifest.version],
    ['Exported', new Date(manifest.exportedAt).toLocaleString()],
    ['Platform', manifest.platform],
    ['Node', manifest.nodeVersion],
    ...(manifest.openclawVersion ? [['OpenClaw', manifest.openclawVersion] as [string, string]] : []),
  ]);
  
  // Contents
  logger.heading('Contents');
  const inc = manifest.includes;
  
  logger.log(formatInclude('Config', inc.config));
  logger.log(formatInclude('Cron', inc.cron, manifest.stats.cronJobs ? `${manifest.stats.cronJobs} jobs` : undefined));
  logger.log(formatInclude('Workspace', inc.workspace, manifest.stats.totalFiles ? `${manifest.stats.totalFiles} files` : undefined));
  logger.log(formatInclude('Memory', inc.memory));
  logger.log(formatInclude('Agents', inc.agents.length > 0, inc.agents.join(', ')));
  logger.log(formatInclude('Auth', inc.auth));
  
  // Secrets
  logger.heading('Security');
  if (manifest.secretsIncluded) {
    logger.warn(chalk.yellow('⚠ Secrets INCLUDED - contains real tokens/keys'));
  } else {
    logger.success(`Secrets stripped: ${manifest.secretsStripped} values replaced`);
    
    // Check for secrets template
    const templateEntry = zip.getEntry('SECRETS_TEMPLATE.json');
    if (templateEntry) {
      logger.log(`  ${chalk.dim('See SECRETS_TEMPLATE.json for required values')}`);
    }
  }
  
  // Stats
  logger.heading('Stats');
  printTable(logger, [
    ['Total Files', manifest.stats.totalFiles],
    ['Total Size', manifest.stats.totalSize],
    ...(manifest.stats.cronJobs ? [['Cron Jobs', manifest.stats.cronJobs] as [string, number]] : []),
    ...(manifest.stats.skills ? [['Skills', manifest.stats.skills] as [string, number]] : []),
    ...(manifest.stats.agents ? [['Agents', manifest.stats.agents] as [string, number]] : []),
  ]);
  
  // File list preview
  logger.heading('File List (first 20)');
  const sortedEntries = entries
    .filter(e => !e.isDirectory)
    .sort((a, b) => a.entryName.localeCompare(b.entryName));
  
  const preview = sortedEntries.slice(0, 20);
  for (const entry of preview) {
    const size = formatSize(entry.header.size);
    logger.log(`  ${chalk.dim(size.padStart(8))}  ${entry.entryName}`);
  }
  
  if (sortedEntries.length > 20) {
    logger.log(chalk.dim(`  ... and ${sortedEntries.length - 20} more files`));
  }
  
  logger.log('');
}

function formatInclude(name: string, included: boolean, detail?: string): string {
  const icon = included ? chalk.green('✓') : chalk.dim('○');
  const status = included ? name : chalk.dim(name);
  const extra = detail ? chalk.dim(` (${detail})`) : '';
  return `  ${icon} ${status}${extra}`;
}
