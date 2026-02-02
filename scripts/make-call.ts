/**
 * Запуск тестового звонка
 *
 * Использование:
 *   npm run call +79001234567
 *   npm run call -- +79001234567
 */

import { loadConfig } from '../src/config.js';
import { createVoximplantClient } from '../src/voximplant-client.js';

async function main() {
  const phoneNumber = process.argv[2];

  if (!phoneNumber) {
    console.log('Использование: npm run call <номер_телефона>');
    console.log('Пример: npm run call +79001234567');
    process.exit(1);
  }

  // Валидация номера (базовая)
  if (!phoneNumber.match(/^\+?[0-9]{10,15}$/)) {
    console.error('❌ Неверный формат номера телефона');
    console.error('   Используйте формат: +79001234567');
    process.exit(1);
  }

  console.log('📞 Запуск тестового звонка...\n');

  const config = loadConfig();

  if (!config.ruleId) {
    console.error('❌ Не указан VOXIMPLANT_RULE_ID в .env');
    console.error('   Сначала выполните: npm run setup');
    process.exit(1);
  }

  // CallerID опционален - если не указан, Voximplant использует default

  const client = await createVoximplantClient(config);

  // Данные для сценария
  const customData = JSON.stringify({
    phone: phoneNumber,
    callerId: config.callerId,
  });

  console.log(`📱 Номер: ${phoneNumber}`);
  console.log(`📤 CallerID: ${config.callerId || 'default'}`);
  console.log(`📋 Rule ID: ${config.ruleId}\n`);

  try {
    console.log('🚀 Запускаем сценарий...');
    const response = await client.startScenarios(config.ruleId, customData);

    if (response.result === 1) {
      console.log('\n✅ Звонок запущен!');
      console.log('\n📊 Для просмотра логов:');
      console.log('   https://manage.voximplant.com');
      console.log(`   → Applications → ${config.applicationName} → Call history`);
    } else {
      console.log('\n⚠️  Ответ API:', JSON.stringify(response, null, 2));
    }
  } catch (err: any) {
    console.error('\n❌ Ошибка запуска:', err.message);

    if (err.message.includes('rule')) {
      console.error('\n💡 Возможные причины:');
      console.error('   - Неверный VOXIMPLANT_RULE_ID');
      console.error('   - Сценарии не загружены (выполните npm run upload)');
    }
  }
}

main().catch((err) => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
