"use strict";
/**
 * Inspect command for openclaw-packager
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
exports.runInspect = runInspect;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const chalk_1 = __importDefault(require("chalk"));
const manifest_1 = require("./manifest");
const utils_1 = require("./utils");
/**
 * Run the inspect command
 */
async function runInspect(file, options) {
    const logger = new utils_1.Logger();
    // Validate file exists
    if (!fs.existsSync(file)) {
        logger.error(chalk_1.default.red(`✗ File not found: ${file}`));
        process.exit(1);
    }
    // Open zip
    let zip;
    try {
        zip = new adm_zip_1.default(file);
    }
    catch (err) {
        logger.error(chalk_1.default.red(`✗ Could not open zip file: ${file}`));
        logger.error(`  ${err}`);
        process.exit(1);
    }
    // Look for manifest
    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) {
        logger.error(chalk_1.default.red('✗ Not a valid openclaw-packager export'));
        logger.error('  Missing manifest.json');
        process.exit(1);
    }
    // Parse manifest
    let manifest;
    try {
        const content = manifestEntry.getData().toString('utf-8');
        const parsed = JSON.parse(content);
        if (!(0, manifest_1.validateManifest)(parsed)) {
            throw new Error('Invalid manifest structure');
        }
        manifest = parsed;
    }
    catch (err) {
        logger.error(chalk_1.default.red('✗ Invalid manifest.json'));
        logger.error(`  ${err}`);
        process.exit(1);
    }
    // Get file info
    const fileStats = fs.statSync(file);
    const entries = zip.getEntries();
    // Display info
    logger.heading('OpenClaw Backup Archive');
    logger.log(`File: ${chalk_1.default.cyan(path.basename(file))}`);
    logger.log(`Size: ${(0, manifest_1.formatSize)(fileStats.size)}\n`);
    // Manifest info
    logger.heading('Export Info');
    (0, utils_1.printTable)(logger, [
        ['Tool Version', manifest.version],
        ['Exported', new Date(manifest.exportedAt).toLocaleString()],
        ['Platform', manifest.platform],
        ['Node', manifest.nodeVersion],
        ...(manifest.openclawVersion ? [['OpenClaw', manifest.openclawVersion]] : []),
    ]);
    // Contents
    logger.heading('Contents');
    const inc = manifest.includes;
    logger.log(formatInclude('Config', inc.config));
    logger.log(formatInclude('Cron', inc.cron, manifest.stats.cronJobs ? `${manifest.stats.cronJobs} jobs` : undefined));
    logger.log(formatInclude('Workspace', inc.workspace, manifest.stats.totalFiles ? `${manifest.stats.totalFiles} files` : undefined));
    logger.log(formatInclude('Memory', inc.memory));
    logger.log(formatInclude('Agents', inc.agents.length > 0, inc.agents.join(', ')));
    logger.log(formatInclude('Auth', inc.auth));
    // Secrets
    logger.heading('Security');
    if (manifest.secretsIncluded) {
        logger.warn(chalk_1.default.yellow('⚠ Secrets INCLUDED - contains real tokens/keys'));
    }
    else {
        logger.success(`Secrets stripped: ${manifest.secretsStripped} values replaced`);
        // Check for secrets template
        const templateEntry = zip.getEntry('SECRETS_TEMPLATE.json');
        if (templateEntry) {
            logger.log(`  ${chalk_1.default.dim('See SECRETS_TEMPLATE.json for required values')}`);
        }
    }
    // Stats
    logger.heading('Stats');
    (0, utils_1.printTable)(logger, [
        ['Total Files', manifest.stats.totalFiles],
        ['Total Size', manifest.stats.totalSize],
        ...(manifest.stats.cronJobs ? [['Cron Jobs', manifest.stats.cronJobs]] : []),
        ...(manifest.stats.skills ? [['Skills', manifest.stats.skills]] : []),
        ...(manifest.stats.agents ? [['Agents', manifest.stats.agents]] : []),
    ]);
    // File list preview
    logger.heading('File List (first 20)');
    const sortedEntries = entries
        .filter(e => !e.isDirectory)
        .sort((a, b) => a.entryName.localeCompare(b.entryName));
    const preview = sortedEntries.slice(0, 20);
    for (const entry of preview) {
        const size = (0, manifest_1.formatSize)(entry.header.size);
        logger.log(`  ${chalk_1.default.dim(size.padStart(8))}  ${entry.entryName}`);
    }
    if (sortedEntries.length > 20) {
        logger.log(chalk_1.default.dim(`  ... and ${sortedEntries.length - 20} more files`));
    }
    logger.log('');
}
function formatInclude(name, included, detail) {
    const icon = included ? chalk_1.default.green('✓') : chalk_1.default.dim('○');
    const status = included ? name : chalk_1.default.dim(name);
    const extra = detail ? chalk_1.default.dim(` (${detail})`) : '';
    return `  ${icon} ${status}${extra}`;
}
//# sourceMappingURL=inspect.js.map