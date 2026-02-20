/**
 * OpenClaw directory detection and path mapping
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface OpenClawPaths {
  root: string;
  workspace: string;
  config: string;
  cron: string;
  agents: string;
  credentials: string;
}

/**
 * Detect the OpenClaw directory
 * Checks: $OPENCLAW_STATE_DIR, ~/.openclaw, ~/.openclaw-dev
 */
export function detectOpenClawDir(): string | null {
  const candidates: string[] = [];
  
  // Check environment variable first
  if (process.env.OPENCLAW_STATE_DIR) {
    candidates.push(process.env.OPENCLAW_STATE_DIR);
  }
  
  // Standard locations
  const home = os.homedir();
  candidates.push(path.join(home, '.openclaw'));
  candidates.push(path.join(home, '.openclaw-dev'));
  
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      // Verify it looks like an OpenClaw directory
      const hasConfig = fs.existsSync(path.join(candidate, 'openclaw.json'));
      const hasAgents = fs.existsSync(path.join(candidate, 'agents'));
      if (hasConfig || hasAgents) {
        return candidate;
      }
    }
  }
  
  return null;
}

/**
 * Get all relevant paths for an OpenClaw installation
 */
export function getOpenClawPaths(root: string): OpenClawPaths {
  const workspacePath = path.join(root, 'workspace');
  
  return {
    root,
    workspace: fs.existsSync(workspacePath) 
      ? fs.realpathSync(workspacePath) 
      : workspacePath,
    config: path.join(root, 'openclaw.json'),
    cron: path.join(root, 'cron'),
    agents: path.join(root, 'agents'),
    credentials: path.join(root, 'credentials'),
  };
}

/**
 * Directories/patterns to always exclude from exports
 */
export const EXCLUDED_DIRS = new Set([
  'identity',           // Device keypairs, machine-specific
  'sessions',           // Session history, too large (within agents)
  'logs',               // Runtime logs
  'browser',            // Browser profile data
  'completions',        // Tab completion cache
  'media',              // Downloaded media files
  'delivery-queue',     // Transient
  'node_modules',
  '.git',
  '__pycache__',
  '.cache',
]);

/**
 * Workspace directories excluded by default (personal data, not bot config)
 * These can be included with --include-projects
 */
export const WORKSPACE_EXCLUDED_DIRS = new Set([
  'projects',           // Personal project code (often huge)
  'research',           // Research session outputs
  'planning',           // Planning docs
  'fiverr',             // Personal/work data
  'analytics',          // Analytics data
  'news-digest',        // Generated news archives
  'design',             // Design files
  'patches',            // Patch files
  'temp',               // Temporary files
  'backup',             // Old backup copies
  'config',             // Config copies
]);

/**
 * File patterns to exclude
 */
export const EXCLUDED_FILES = new Set([
  '.DS_Store',
  'Thumbs.db',
  '*.pyc',
  '*.pyo',
  '*.log',
  '*.key',     // Private keys
  '*.pem',     // Certificates
]);

/**
 * Check if a path should be excluded
 */
export function shouldExclude(relativePath: string): boolean {
  const parts = relativePath.split(path.sep);
  
  // Check each directory component
  for (const part of parts) {
    if (EXCLUDED_DIRS.has(part)) {
      return true;
    }
  }
  
  // Check file patterns
  const filename = path.basename(relativePath);
  if (EXCLUDED_FILES.has(filename)) {
    return true;
  }
  
  // Check wildcard patterns
  if (filename.endsWith('.pyc') || filename.endsWith('.pyo')) {
    return true;
  }
  
  // Exclude key/cert files
  if (filename.endsWith('.key') || filename.endsWith('.pem')) {
    return true;
  }
  
  return false;
}

/**
 * Check if a workspace path should be excluded (non-portable personal data)
 * Returns true unless includeProjects is set
 */
export function shouldExcludeWorkspace(relativePath: string, includeProjects: boolean): boolean {
  if (shouldExclude(relativePath)) return true;
  
  if (!includeProjects) {
    const topDir = relativePath.split(path.sep)[0];
    if (WORKSPACE_EXCLUDED_DIRS.has(topDir)) {
      return true;
    }
  }
  
  return false;
}

/**
 * List all agent directories
 */
export function listAgents(agentsDir: string): string[] {
  if (!fs.existsSync(agentsDir)) {
    return [];
  }
  
  return fs.readdirSync(agentsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}
