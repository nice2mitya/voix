/**
 * Voximplant HTTP API Client
 * Использует прямые HTTP запросы (для простого API Key из консоли)
 */

import type { Config } from './config.js';

const API_BASE = 'https://api.voximplant.com/platform_api';

export interface VoximplantClient {
  getApplications(): Promise<any>;
  createApplication(name: string): Promise<any>;
  getScenarios(applicationId: number): Promise<any>;
  addScenario(applicationId: number, name: string, script: string): Promise<any>;
  updateScenario(scenarioId: number, name: string, script: string): Promise<any>;
  getRules(applicationId: number): Promise<any>;
  addRule(applicationId: number, ruleName: string, scenarioIds: number[]): Promise<any>;
  startScenarios(ruleId: number, customData?: string): Promise<any>;
}

async function apiRequest(
  method: string,
  accountId: number,
  apiKey: string,
  params: Record<string, any> = {},
  usePost: boolean = false
): Promise<any> {
  const url = new URL(`${API_BASE}/${method}`);

  // Добавляем auth параметры
  const allParams = {
    account_id: accountId,
    api_key: apiKey,
    ...params,
  };

  let response: Response;

  if (usePost) {
    // POST с form-urlencoded для больших данных (скриптов)
    const formData = new URLSearchParams();
    Object.entries(allParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((v) => formData.append(key, String(v)));
        } else {
          formData.append(key, String(value));
        }
      }
    });

    response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
  } else {
    // GET для простых запросов
    Object.entries(allParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((v) => url.searchParams.append(key, String(v)));
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    });

    response = await fetch(url.toString());
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Voximplant API error: ${data.error.msg || JSON.stringify(data.error)}`);
  }

  return data;
}

export async function createVoximplantClient(config: Config): Promise<VoximplantClient> {
  const { accountId, apiKey } = config;

  return {
    async getApplications() {
      return apiRequest('GetApplications', accountId, apiKey);
    },

    async createApplication(name: string) {
      return apiRequest('AddApplication', accountId, apiKey, {
        application_name: name,
      });
    },

    async getScenarios(applicationId: number) {
      return apiRequest('GetScenarios', accountId, apiKey, {
        application_id: applicationId,
      });
    },

    async addScenario(applicationId: number, name: string, script: string) {
      // POST для больших скриптов
      return apiRequest('AddScenario', accountId, apiKey, {
        application_id: applicationId,
        scenario_name: name,
        scenario_script: script,
      }, true);
    },

    async updateScenario(scenarioId: number, name: string, script: string) {
      // POST для больших скриптов
      return apiRequest('SetScenarioInfo', accountId, apiKey, {
        scenario_id: scenarioId,
        scenario_name: name,
        scenario_script: script,
      }, true);
    },

    async getRules(applicationId: number) {
      return apiRequest('GetRules', accountId, apiKey, {
        application_id: applicationId,
      });
    },

    async addRule(applicationId: number, ruleName: string, scenarioIds: number[]) {
      return apiRequest('AddRule', accountId, apiKey, {
        application_id: applicationId,
        rule_name: ruleName,
        rule_pattern: '.*',
        scenario_id: scenarioIds,
      });
    },

    async startScenarios(ruleId: number, customData?: string) {
      const params: Record<string, any> = {
        rule_id: ruleId,
      };
      if (customData) {
        params.script_custom_data = customData;
      }
      return apiRequest('StartScenarios', accountId, apiKey, params);
    },
  };
}
