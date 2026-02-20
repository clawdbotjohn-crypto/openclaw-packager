"use strict";
/**
 * OpenClaw directory detection and path mapping
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXCLUDED_FILES = exports.WORKSPACE_EXCLUDED_DIRS = exports.EXCLUDED_DIRS = void 0;
exports.detectOpenClawDir = detectOpenClawDir;
exports.getOpenClawPaths = getOpenClawPaths;
exports.shouldExclude = shouldExclude;
exports.shouldExcludeWorkspace = shouldExcludeWorkspace;
exports.listAgents = listAgents;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * Detect the OpenClaw directory
 * Checks: $OPENCLAW_STATE_DIR, ~/.openclaw, ~/.openclaw-dev
 */
function detectOpenClawDir() {
    const candidates = [];
    // Check environment variable first
    if (process.env.OPENCLAW_STATE_DIR) {
        candidates.push(process.env.OPENCLAW_STATE_DIR);
    }
    // Standard locations
    const home = os.homedir();
    candidates.push(path.join(home, '.openclaw'));
    candidates.push(path.join(home, '.openclaw-dev'));
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            // Verify it looks like an OpenClaw directory
            const hasConfig = fs.existsSync(path.join(candidate, 'openclaw.json'));
            const hasAgents = fs.existsSync(path.join(candidate, 'agents'));
            if (hasConfig || hasAgents) {
                return candidate;
            }
        }
    }
    return null;
}
/**
 * Get all relevant paths for an OpenClaw installation
 */
function getOpenClawPaths(root) {
    const workspacePath = path.join(root, 'workspace');
    return {
        root,
        workspace: fs.existsSync(workspacePath)
            ? fs.realpathSync(workspacePath)
            : workspacePath,
        config: path.join(root, 'openclaw.json'),
        cron: path.join(root, 'cron'),
        agents: path.join(root, 'agents'),
        credentials: path.join(root, 'credentials'),
    };
}
/**
 * Directories/patterns to always exclude from exports
 */
exports.EXCLUDED_DIRS = new Set([
    'identity', // Device keypairs, machine-specific
    'sessions', // Session history, too large (within agents)
    'logs', // Runtime logs
    'browser', // Browser profile data
    'completions', // Tab completion cache
    'media', // Downloaded media files
    'delivery-queue', // Transient
    'node_modules',
    '.git',
    '__pycache__',
    '.cache',
]);
/**
 * Workspace directories excluded by default (personal data, not bot config)
 * These can be included with --include-projects
 */
exports.WORKSPACE_EXCLUDED_DIRS = new Set([
    'projects', // Personal project code (often huge)
    'research', // Research session outputs
    'planning', // Planning docs
    'fiverr', // Personal/work data
    'analytics', // Analytics data
    'news-digest', // Generated news archives
    'design', // Design files
    'patches', // Patch files
    'temp', // Temporary files
    'backup', // Old backup copies
    'config', // Config copies
]);
/**
 * File patterns to exclude
 */
exports.EXCLUDED_FILES = new Set([
    '.DS_Store',
    'Thumbs.db',
    '*.pyc',
    '*.pyo',
    '*.log',
    '*.key', // Private keys
    '*.pem', // Certificates
]);
/**
 * Check if a path should be excluded
 */
function shouldExclude(relativePath) {
    const parts = relativePath.split(path.sep);
    // Check each directory component
    for (const part of parts) {
        if (exports.EXCLUDED_DIRS.has(part)) {
            return true;
        }
    }
    // Check file patterns
    const filename = path.basename(relativePath);
    if (exports.EXCLUDED_FILES.has(filename)) {
        return true;
    }
    // Check wildcard patterns
    if (filename.endsWith('.pyc') || filename.endsWith('.pyo')) {
        return true;
    }
    // Exclude key/cert files
    if (filename.endsWith('.key') || filename.endsWith('.pem')) {
        return true;
    }
    return false;
}
/**
 * Check if a workspace path should be excluded (non-portable personal data)
 * Returns true unless includeProjects is set
 */
function shouldExcludeWorkspace(relativePath, includeProjects) {
    if (shouldExclude(relativePath))
        return true;
    if (!includeProjects) {
        const topDir = relativePath.split(path.sep)[0];
        if (exports.WORKSPACE_EXCLUDED_DIRS.has(topDir)) {
            return true;
        }
    }
    return false;
}
/**
 * List all agent directories
 */
function listAgents(agentsDir) {
    if (!fs.existsSync(agentsDir)) {
        return [];
    }
    return fs.readdirSync(agentsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
}
//# sourceMappingURL=paths.js.map