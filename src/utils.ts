/**
 * Shared utilities for openclaw-backup
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

/**
 * Logger that respects stdout mode (no console output when piping to stdout)
 */
export class Logger {
  private stdoutMode: boolean;
  
  constructor(stdoutMode: boolean = false) {
    this.stdoutMode = stdoutMode;
  }
  
  log(...args: unknown[]): void {
    if (!this.stdoutMode) {
      console.log(...args);
    }
  }
  
  error(...args: unknown[]): void {
    // Always write errors to stderr
    console.error(...args);
  }
  
  info(message: string): void {
    this.log(chalk.blue('ℹ'), message);
  }
  
  success(message: string): void {
    this.log(chalk.green('✓'), message);
  }
  
  warn(message: string): void {
    this.log(chalk.yellow('⚠'), message);
  }
  
  heading(message: string): void {
    this.log(chalk.bold.cyan(`\n${message}`));
  }
}

/**
 * Recursively walk a directory
 */
export async function* walkDir(dir: string, relativeTo?: string): AsyncGenerator<{
  path: string;
  relativePath: string;
  stats: fs.Stats;
}> {
  const base = relativeTo || dir;
  
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(base, fullPath);
    
    if (entry.isDirectory()) {
      yield* walkDir(fullPath, base);
    } else if (entry.isFile()) {
      try {
        const stats = fs.statSync(fullPath);
        yield { path: fullPath, relativePath, stats };
      } catch {
        // Skip files we can't stat
      }
    }
  }
}

/**
 * Count files and total size in a directory
 */
export function countDirContents(dir: string, filter?: (path: string) => boolean): {
  files: number;
  size: number;
} {
  let files = 0;
  let size = 0;
  
  const walk = (currentDir: string) => {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(dir, fullPath);
        
        if (filter && !filter(relativePath)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          try {
            const stats = fs.statSync(fullPath);
            files++;
            size += stats.size;
          } catch {
            // Skip
          }
        }
      }
    } catch {
      // Skip
    }
  };
  
  walk(dir);
  return { files, size };
}

/**
 * Ensure a directory exists
 */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Read JSON file safely
 */
export function readJson<T = unknown>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Write JSON file
 */
export function writeJson(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Get timestamp for filenames
 */
export function getTimestamp(): string {
  const now = new Date();
  return now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
}

/**
 * Print a table (simple key-value format)
 */
export function printTable(logger: Logger, items: [string, string | number | boolean][]): void {
  const maxKey = Math.max(...items.map(([k]) => k.length));
  for (const [key, value] of items) {
    logger.log(`  ${chalk.dim(key.padEnd(maxKey))}  ${value}`);
  }
}

/**
 * Deep merge two objects
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
  sourceWins: boolean = false
): T {
  const result = { ...target };
  
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceVal = source[key];
    const targetVal = target[key];
    
    if (sourceVal === undefined) {
      continue;
    }
    
    if (
      typeof sourceVal === 'object' && 
      sourceVal !== null && 
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' && 
      targetVal !== null && 
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
        sourceWins
      ) as T[keyof T];
    } else if (sourceWins || targetVal === undefined) {
      result[key] = sourceVal as T[keyof T];
    }
  }
  
  return result;
}
