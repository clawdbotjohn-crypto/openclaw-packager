/**
 * Shared utilities for openclaw-backup
 */
import * as fs from 'fs';
/**
 * Logger that respects stdout mode (no console output when piping to stdout)
 */
export declare class Logger {
    private stdoutMode;
    constructor(stdoutMode?: boolean);
    log(...args: unknown[]): void;
    error(...args: unknown[]): void;
    info(message: string): void;
    success(message: string): void;
    warn(message: string): void;
    heading(message: string): void;
}
/**
 * Recursively walk a directory
 */
export declare function walkDir(dir: string, relativeTo?: string): AsyncGenerator<{
    path: string;
    relativePath: string;
    stats: fs.Stats;
}>;
/**
 * Count files and total size in a directory
 */
export declare function countDirContents(dir: string, filter?: (path: string) => boolean): {
    files: number;
    size: number;
};
/**
 * Ensure a directory exists
 */
export declare function ensureDir(dir: string): void;
/**
 * Read JSON file safely
 */
export declare function readJson<T = unknown>(filePath: string): T | null;
/**
 * Write JSON file
 */
export declare function writeJson(filePath: string, data: unknown): void;
/**
 * Get timestamp for filenames
 */
export declare function getTimestamp(): string;
/**
 * Print a table (simple key-value format)
 */
export declare function printTable(logger: Logger, items: [string, string | number | boolean][]): void;
/**
 * Deep merge two objects
 */
export declare function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>, sourceWins?: boolean): T;
