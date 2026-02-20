"use strict";
/**
 * Shared utilities for openclaw-backup
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
exports.walkDir = walkDir;
exports.countDirContents = countDirContents;
exports.ensureDir = ensureDir;
exports.readJson = readJson;
exports.writeJson = writeJson;
exports.getTimestamp = getTimestamp;
exports.printTable = printTable;
exports.deepMerge = deepMerge;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
/**
 * Logger that respects stdout mode (no console output when piping to stdout)
 */
class Logger {
    stdoutMode;
    constructor(stdoutMode = false) {
        this.stdoutMode = stdoutMode;
    }
    log(...args) {
        if (!this.stdoutMode) {
            console.log(...args);
        }
    }
    error(...args) {
        // Always write errors to stderr
        console.error(...args);
    }
    info(message) {
        this.log(chalk_1.default.blue('ℹ'), message);
    }
    success(message) {
        this.log(chalk_1.default.green('✓'), message);
    }
    warn(message) {
        this.log(chalk_1.default.yellow('⚠'), message);
    }
    heading(message) {
        this.log(chalk_1.default.bold.cyan(`\n${message}`));
    }
}
exports.Logger = Logger;
/**
 * Recursively walk a directory
 */
async function* walkDir(dir, relativeTo) {
    const base = relativeTo || dir;
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(base, fullPath);
        if (entry.isDirectory()) {
            yield* walkDir(fullPath, base);
        }
        else if (entry.isFile()) {
            try {
                const stats = fs.statSync(fullPath);
                yield { path: fullPath, relativePath, stats };
            }
            catch {
                // Skip files we can't stat
            }
        }
    }
}
/**
 * Count files and total size in a directory
 */
function countDirContents(dir, filter) {
    let files = 0;
    let size = 0;
    const walk = (currentDir) => {
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
                }
                else if (entry.isFile()) {
                    try {
                        const stats = fs.statSync(fullPath);
                        files++;
                        size += stats.size;
                    }
                    catch {
                        // Skip
                    }
                }
            }
        }
        catch {
            // Skip
        }
    };
    walk(dir);
    return { files, size };
}
/**
 * Ensure a directory exists
 */
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
/**
 * Read JSON file safely
 */
function readJson(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
/**
 * Write JSON file
 */
function writeJson(filePath, data) {
    const dir = path.dirname(filePath);
    ensureDir(dir);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
/**
 * Get timestamp for filenames
 */
function getTimestamp() {
    const now = new Date();
    return now.toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .slice(0, 19);
}
/**
 * Print a table (simple key-value format)
 */
function printTable(logger, items) {
    const maxKey = Math.max(...items.map(([k]) => k.length));
    for (const [key, value] of items) {
        logger.log(`  ${chalk_1.default.dim(key.padEnd(maxKey))}  ${value}`);
    }
}
/**
 * Deep merge two objects
 */
function deepMerge(target, source, sourceWins = false) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        const sourceVal = source[key];
        const targetVal = target[key];
        if (sourceVal === undefined) {
            continue;
        }
        if (typeof sourceVal === 'object' &&
            sourceVal !== null &&
            !Array.isArray(sourceVal) &&
            typeof targetVal === 'object' &&
            targetVal !== null &&
            !Array.isArray(targetVal)) {
            result[key] = deepMerge(targetVal, sourceVal, sourceWins);
        }
        else if (sourceWins || targetVal === undefined) {
            result[key] = sourceVal;
        }
    }
    return result;
}
//# sourceMappingURL=utils.js.map