import { config } from 'dotenv';
import { resolve } from 'path';

// Загружаем .env из корня проекта
config({ path: resolve(process.cwd(), '.env') });

export interface Config {
  accountId: number;
  apiKey: string;
  applicationName: string;
  ruleId?: number;
  smartRuleId?: number;
  callerId?: string;
  anthropicApiKey?: string;
}

function getEnvVar(name: string, required = true): string {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || '';
}

export function loadConfig(): Config {
  return {
    accountId: parseInt(getEnvVar('VOXIMPLANT_ACCOUNT_ID'), 10),
    apiKey: getEnvVar('VOXIMPLANT_API_KEY'),
    applicationName: getEnvVar('VOXIMPLANT_APPLICATION_NAME', false) || 'voix',
    ruleId: process.env.VOXIMPLANT_RULE_ID
      ? parseInt(process.env.VOXIMPLANT_RULE_ID, 10)
      : undefined,
    smartRuleId: process.env.VOXIMPLANT_SMART_RULE_ID
      ? parseInt(process.env.VOXIMPLANT_SMART_RULE_ID, 10)
      : undefined,
    callerId: process.env.CALLER_ID || undefined,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
  };
}
