/**
 * Запуск умного бота с YandexGPT
 *
 * Использование:
 *   npm run smart +79001234567
 */

import { loadConfig } from '../src/config.js';
import { createVoximplantClient } from '../src/voximplant-client.js';

async function main() {
  const args = process.argv.slice(2);
  const phoneNumber = args.find((arg) => arg.startsWith('+') || /^\d{10,}$/.test(arg));

  if (!phoneNumber) {
    console.log('Использование: npm run smart <номер_телефона>');
    console.log('Пример: npm run smart +79001234567');
    process.exit(1);
  }

  const config = loadConfig();

  // YandexGPT ключи из .env
  const yandexKey = process.env.YANDEX_API_KEY;
  const yandexFolder = process.env.YANDEX_FOLDER_ID;

  if (!yandexKey || !yandexFolder) {
    console.error('❌ Не указаны ключи YandexGPT в .env');
    console.error('   YANDEX_API_KEY=...');
    console.error('   YANDEX_FOLDER_ID=...');
    process.exit(1);
  }

  console.log('🤖 Запуск умного бота с YandexGPT...\n');

  const ruleId = config.smartRuleId;

  if (!ruleId) {
    console.error('❌ Не указан VOXIMPLANT_SMART_RULE_ID в .env');
    process.exit(1);
  }

  const client = await createVoximplantClient(config);

  // Данные для сценария
  const customData = {
    phone: phoneNumber,
    callerId: config.callerId,
    yandexApiKey: yandexKey,
    yandexFolderId: yandexFolder,
  };

  console.log('🧠 LLM: YandexGPT');
  console.log(`📱 Номер: ${phoneNumber}`);
  console.log(`📤 CallerID: ${config.callerId || 'default'}`);
  console.log(`📋 Smart Rule ID: ${ruleId}\n`);

  try {
    console.log('🚀 Запускаем сценарий...');
    const response = await client.startScenarios(ruleId, JSON.stringify(customData));

    if (response.result === 1) {
      console.log('\n✅ Звонок запущен!');
      console.log('\n💡 Бот будет:');
      console.log('   - Приветствовать');
      console.log('   - Слушать ваши вопросы');
      console.log('   - Отправлять их в YandexGPT');
      console.log('   - Озвучивать умные ответы');
      console.log('\n📊 Логи: https://manage.voximplant.com');
      console.log(`   → Applications → ${config.applicationName} → Call history`);
    } else {
      console.log('\n⚠️  Ответ API:', JSON.stringify(response, null, 2));
    }
  } catch (err: any) {
    console.error('\n❌ Ошибка запуска:', err.message);
  }
}

main().catch((err) => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
