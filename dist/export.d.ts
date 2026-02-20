/**
 * Export command for openclaw-backup
 */
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
/**
 * Run the export command
 */
export declare function runExport(options: ExportOptions): Promise<void>;
