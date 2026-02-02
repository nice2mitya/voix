/**
 * Создание правила для smart-bot сценария
 */

import { loadConfig } from '../src/config.js';
import { createVoximplantClient } from '../src/voximplant-client.js';

async function main() {
  console.log('🔧 Настройка правила для smart-bot...\n');

  const config = loadConfig();
  const client = await createVoximplantClient(config);

  // Получаем приложение
  const appsResponse = await client.getApplications();
  const app = appsResponse.result?.find(
    (a: any) => a.application_name.startsWith(config.applicationName + '.')
  );

  if (!app) {
    console.error(`❌ Приложение "${config.applicationName}" не найдено.`);
    process.exit(1);
  }

  const applicationId = app.application_id;
  console.log(`📱 Приложение: ${config.applicationName} (ID: ${applicationId})`);

  // Получаем сценарии
  const scenariosResponse = await client.getScenarios(applicationId);
  const scenarios = scenariosResponse.result || [];

  const smartBotScenario = scenarios.find((s: any) => s.scenario_name === 'smart-bot');

  if (!smartBotScenario) {
    console.error('❌ Сценарий smart-bot не найден. Сначала выполните: npm run upload');
    process.exit(1);
  }

  console.log(`📄 Сценарий: smart-bot (ID: ${smartBotScenario.scenario_id})`);

  // Проверяем существующие правила
  const rulesResponse = await client.getRules(applicationId);
  const rules = rulesResponse.result || [];

  let smartBotRule = rules.find((r: any) => r.rule_name === 'smart-bot-rule');

  if (smartBotRule) {
    console.log(`✅ Правило уже существует (ID: ${smartBotRule.rule_id})`);
  } else {
    console.log('📋 Создаём правило smart-bot-rule...');
    const ruleResponse = await client.addRule(applicationId, 'smart-bot-rule', [
      smartBotScenario.scenario_id,
    ]);
    smartBotRule = { rule_id: ruleResponse.rule_id };
    console.log(`✅ Правило создано (ID: ${smartBotRule.rule_id})`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Готово!');
  console.log(`\n📋 Rule ID для smart-bot: ${smartBotRule.rule_id}`);
  console.log('\nДобавьте в .env:');
  console.log(`VOXIMPLANT_SMART_RULE_ID=${smartBotRule.rule_id}`);
}

main().catch((err) => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
