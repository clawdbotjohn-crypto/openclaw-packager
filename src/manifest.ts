/**
 * Manifest types and validation for openclaw-backup exports
 */

export interface ManifestIncludes {
  workspace: boolean;
  cron: boolean;
  config: boolean;
  agents: string[];
  memory: boolean;
  auth: boolean;
}

export interface ManifestStats {
  totalFiles: number;
  totalSize: string;
  cronJobs?: number;
  skills?: number;
  agents?: number;
}

export interface Manifest {
  version: string;
  tool: string;
  exportedAt: string;
  openclawVersion?: string;
  platform: string;
  nodeVersion: string;
  includes: ManifestIncludes;
  secretsIncluded: boolean;
  secretsStripped: number;
  stats: ManifestStats;
}

/**
 * Create a new manifest with defaults
 */
export function createManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    version: '1.0.0',
    tool: 'openclaw-backup',
    exportedAt: new Date().toISOString(),
    platform: `${process.platform}-${process.arch}`,
    nodeVersion: process.version,
    includes: {
      workspace: false,
      cron: false,
      config: false,
      agents: [],
      memory: false,
      auth: false,
    },
    secretsIncluded: false,
    secretsStripped: 0,
    stats: {
      totalFiles: 0,
      totalSize: '0B',
    },
    ...overrides,
  };
}

/**
 * Validate that a manifest is well-formed
 */
export function validateManifest(data: unknown): data is Manifest {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  const m = data as Record<string, unknown>;
  
  return (
    typeof m.version === 'string' &&
    m.tool === 'openclaw-backup' &&
    typeof m.exportedAt === 'string' &&
    typeof m.includes === 'object' &&
    m.includes !== null
  );
}

/**
 * Format bytes to human-readable size
 */
export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)}${units[unitIndex]}`;
}
