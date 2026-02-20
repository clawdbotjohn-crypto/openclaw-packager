/**
 * Secret detection and stripping for openclaw-backup
 */
export interface SecretsTemplate {
    _instructions: string;
    config: Record<string, string>;
    credentials: string[];
    agentAuth: Record<string, string[]>;
}
export interface StripResult {
    content: string;
    secretsStripped: number;
}
/**
 * Check if a file path indicates it contains secrets
 */
export declare function isSecretFile(relativePath: string): boolean;
/**
 * Strip secrets from JSON content
 */
export declare function stripSecrets(content: string, filePath: string): StripResult;
/**
 * Create an empty secrets template
 */
export declare function createSecretsTemplate(): SecretsTemplate;
/**
 * Add a config secret to the template
 */
export declare function addConfigSecret(template: SecretsTemplate, path: string): void;
/**
 * Add a credential file to the template
 */
export declare function addCredentialFile(template: SecretsTemplate, filename: string): void;
/**
 * Add an agent auth entry to the template
 */
export declare function addAgentAuth(template: SecretsTemplate, agent: string, authType: string): void;
