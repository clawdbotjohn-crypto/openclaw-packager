/**
 * Inspect command for openclaw-backup
 */
export interface InspectOptions {
}
/**
 * Run the inspect command
 */
export declare function runInspect(file: string, options: InspectOptions): Promise<void>;
