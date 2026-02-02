/**
 * Настройка приложения Voximplant
 *
 * Создает:
 * 1. Приложение "voix"
 * 2. Правило маршрутизации
 *
 * После выполнения:
 * - Добавьте VOXIMPLANT_RULE_ID в .env
 * - Купите номер в консоли Voximplant
 */

import { loadConfig } from '../src/config.js';
import { createVoximplantClient } from '../src/voximplant-client.js';

async function main() {
  console.log('🚀 Настройка Voximplant...\n');

  const config = loadConfig();
  const client = await createVoximplantClient(config);

  // 1. Проверяем/создаем приложение
  console.log(`📱 Проверяем приложение "${config.applicationName}"...`);

  const appsResponse = await client.getApplications();
  let app = appsResponse.result?.find(
    (a: any) => a.application_name === config.applicationName
  );

  if (app) {
    console.log(`   ✅ Приложение существует (ID: ${app.application_id})`);
  } else {
    console.log(`   📝 Создаем приложение...`);
    const createResponse = await client.createApplication(config.applicationName);
    app = { application_id: createResponse.application_id };
    console.log(`   ✅ Приложение создано (ID: ${app.application_id})`);
  }

  const applicationId = app.application_id;

  // 2. Проверяем/создаем правило
  console.log('\n📋 Проверяем правила маршрутизации...');

  const rulesResponse = await client.getRules(applicationId);
  let rule = rulesResponse.result?.find((r: any) => r.rule_name === 'test-call-rule');

  if (rule) {
    console.log(`   ✅ Правило существует (ID: ${rule.rule_id})`);
  } else {
    console.log(`   📝 Создаем правило...`);
    // Правило без сценариев - сценарии добавятся при upload
    const ruleResponse = await client.addRule(applicationId, 'test-call-rule', []);
    rule = { rule_id: ruleResponse.rule_id };
    console.log(`   ✅ Правило создано (ID: ${rule.rule_id})`);
  }

  // Итоги
  console.log('\n' + '='.repeat(50));
  console.log('✅ Настройка завершена!\n');
  console.log('Следующие шаги:\n');

  console.log('1. Добавьте в .env:');
  console.log(`   VOXIMPLANT_RULE_ID=${rule.rule_id}\n`);

  console.log('2. Загрузите сценарии:');
  console.log('   npm run upload\n');

  console.log('3. Купите номер в консоли Voximplant:');
  console.log('   https://manage.voximplant.com');
  console.log('   → Numbers → Buy New → Russia\n');

  console.log('4. После покупки номера:');
  console.log('   - Привяжите номер к приложению "' + config.applicationName + '"');
  console.log('   - Добавьте номер в .env как CALLER_ID\n');

  console.log('5. Сделайте тестовый звонок:');
  console.log('   npm run call +79001234567');
}

main().catch((err) => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
