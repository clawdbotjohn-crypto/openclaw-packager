/**
 * Import command for openclaw-packager
 */
export interface ImportOptions {
    dryRun?: boolean;
    merge?: boolean;
    force?: boolean;
    target?: string;
    skipWorkspace?: boolean;
    skipCron?: boolean;
    skipConfig?: boolean;
}
/**
 * Run the import command
 */
export declare function runImport(file: string, options: ImportOptions): Promise<void>;
