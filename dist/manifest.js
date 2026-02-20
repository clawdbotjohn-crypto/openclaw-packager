"use strict";
/**
 * Manifest types and validation for openclaw-packager exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createManifest = createManifest;
exports.validateManifest = validateManifest;
exports.formatSize = formatSize;
/**
 * Create a new manifest with defaults
 */
function createManifest(overrides = {}) {
    return {
        version: '1.0.0',
        tool: 'openclaw-packager',
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
function validateManifest(data) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    const m = data;
    return (typeof m.version === 'string' &&
        m.tool === 'openclaw-packager' &&
        typeof m.exportedAt === 'string' &&
        typeof m.includes === 'object' &&
        m.includes !== null);
}
/**
 * Format bytes to human-readable size
 */
function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(unitIndex > 0 ? 1 : 0)}${units[unitIndex]}`;
}
//# sourceMappingURL=manifest.js.map