/**
 * OpenClaw directory detection and path mapping
 */
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
export declare function detectOpenClawDir(): string | null;
/**
 * Get all relevant paths for an OpenClaw installation
 */
export declare function getOpenClawPaths(root: string): OpenClawPaths;
/**
 * Directories/patterns to always exclude from exports
 */
export declare const EXCLUDED_DIRS: Set<string>;
/**
 * Workspace directories excluded by default (personal data, not bot config)
 * These can be included with --include-projects
 */
export declare const WORKSPACE_EXCLUDED_DIRS: Set<string>;
/**
 * File patterns to exclude
 */
export declare const EXCLUDED_FILES: Set<string>;
/**
 * Check if a path should be excluded
 */
export declare function shouldExclude(relativePath: string): boolean;
/**
 * Check if a workspace path should be excluded (non-portable personal data)
 * Returns true unless includeProjects is set
 */
export declare function shouldExcludeWorkspace(relativePath: string, includeProjects: boolean): boolean;
/**
 * List all agent directories
 */
export declare function listAgents(agentsDir: string): string[];
