/**
 * Manifest types and validation for openclaw-packager exports
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
export declare function createManifest(overrides?: Partial<Manifest>): Manifest;
/**
 * Validate that a manifest is well-formed
 */
export declare function validateManifest(data: unknown): data is Manifest;
/**
 * Format bytes to human-readable size
 */
export declare function formatSize(bytes: number): string;
