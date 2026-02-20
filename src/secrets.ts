/**
 * Secret detection and stripping for openclaw-backup
 */

import * as path from 'path';

/**
 * Keys that typically contain secrets
 */
const SECRET_KEYS = new Set([
  'token',
  'tokens',
  'key',
  'apiKey',
  'api_key',
  'apikey',
  'secret',
  'password',
  'credential',
  'credentials',
  'auth',
  'authorization',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
  'clientSecret',
  'client_secret',
  'botToken',
  'bot_token',
  'webhook',
  'webhookUrl',
]);

/**
 * Patterns that indicate a value is a secret
 */
const SECRET_PATTERNS = [
  /^ghu_[a-zA-Z0-9]+$/,       // GitHub user token
  /^ghp_[a-zA-Z0-9]+$/,       // GitHub personal token
  /^gho_[a-zA-Z0-9]+$/,       // GitHub OAuth token
  /^ghs_[a-zA-Z0-9]+$/,       // GitHub server token
  /^sk-[a-zA-Z0-9]+$/,        // OpenAI/Stripe keys
  /^xoxb-[a-zA-Z0-9-]+$/,     // Slack bot token
  /^xoxp-[a-zA-Z0-9-]+$/,     // Slack user token
  /^Bearer\s+[a-zA-Z0-9._-]+$/i, // Bearer tokens
  /^[A-Za-z0-9+/]{60,}={0,2}$/, // Base64 blobs > 60 chars
];

/**
 * Files that should be entirely treated as containing secrets
 */
const SECRET_FILE_PATTERNS = [
  /^credentials\//,
  /auth-profiles\.json$/,
  /token\.json$/,
  /_token\.json$/,
  /secret\.json$/,
  /_secret\.json$/,
];

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
export function isSecretFile(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  return SECRET_FILE_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Check if a key name suggests it contains secrets
 */
function isSecretKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SECRET_KEYS.has(lowerKey) || 
         SECRET_KEYS.has(key) ||
         lowerKey.includes('token') ||
         lowerKey.includes('secret') ||
         lowerKey.includes('password') ||
         lowerKey.includes('apikey') ||
         lowerKey.includes('api_key');
}

/**
 * Check if a value looks like a secret
 */
function isSecretValue(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  
  // Check against known patterns
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(value)) {
      return true;
    }
  }
  
  // Long random-looking strings (likely tokens)
  if (value.length > 40 && /^[a-zA-Z0-9+/=_-]+$/.test(value)) {
    return true;
  }
  
  return false;
}

/**
 * Recursively strip secrets from a JSON object
 */
function stripSecretsFromObject(
  obj: unknown, 
  parentKey: string,
  stripped: Set<string>
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map((item, i) => 
      stripSecretsFromObject(item, `${parentKey}[${i}]`, stripped)
    );
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const fullKey = parentKey ? `${parentKey}.${key}` : key;
      
      if (typeof value === 'string') {
        if (isSecretKey(key) || isSecretValue(value)) {
          result[key] = `__OPENCLAW_SECRET__:${key}`;
          stripped.add(fullKey);
        } else {
          result[key] = value;
        }
      } else {
        result[key] = stripSecretsFromObject(value, fullKey, stripped);
      }
    }
    return result;
  }
  
  return obj;
}

/**
 * Strip secrets from JSON content
 */
export function stripSecrets(content: string, filePath: string): StripResult {
  try {
    const parsed = JSON.parse(content);
    const stripped = new Set<string>();
    const result = stripSecretsFromObject(parsed, '', stripped);
    
    return {
      content: JSON.stringify(result, null, 2),
      secretsStripped: stripped.size,
    };
  } catch {
    // Not valid JSON, return as-is
    return {
      content,
      secretsStripped: 0,
    };
  }
}

/**
 * Create an empty secrets template
 */
export function createSecretsTemplate(): SecretsTemplate {
  return {
    _instructions: 'Fill in these values on your new machine. These secrets were stripped for security.',
    config: {},
    credentials: [],
    agentAuth: {},
  };
}

/**
 * Add a config secret to the template
 */
export function addConfigSecret(template: SecretsTemplate, path: string): void {
  template.config[path] = '__OPENCLAW_SECRET__';
}

/**
 * Add a credential file to the template
 */
export function addCredentialFile(template: SecretsTemplate, filename: string): void {
  if (!template.credentials.includes(filename)) {
    template.credentials.push(filename);
  }
}

/**
 * Add an agent auth entry to the template
 */
export function addAgentAuth(template: SecretsTemplate, agent: string, authType: string): void {
  if (!template.agentAuth[agent]) {
    template.agentAuth[agent] = [];
  }
  if (!template.agentAuth[agent].includes(authType)) {
    template.agentAuth[agent].push(authType);
  }
}
