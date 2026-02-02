/**
 * Запуск ассистента Мити v8 - потоковые короткие фразы через ElevenLabs
 * npm run mitya11 +79001234567
 */

import { loadConfig } from '../src/config.js';
import { createVoximplantClient } from '../src/voximplant-client.js';

async function main() {
  const phoneNumber = process.argv[2];

  if (!phoneNumber || !phoneNumber.match(/^\+?\d{10,}/)) {
    console.log('Использование: npm run mitya11 +79001234567');
    process.exit(1);
  }

  const config = loadConfig();
  const yandexKey = process.env.YANDEX_API_KEY;
  const yandexFolder = process.env.YANDEX_FOLDER_ID;
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

  if (!yandexKey || !yandexFolder) {
    console.error('❌ Нужны YANDEX_API_KEY и YANDEX_FOLDER_ID в .env');
    process.exit(1);
  }

  if (!elevenLabsKey) {
    console.error('❌ Нужен ELEVENLABS_API_KEY в .env');
    process.exit(1);
  }

  const voiceId = 'BhF9uHLusJ5UYp49C1kI';

  const client = await createVoximplantClient(config);

  // Находим приложение
  const appsResp = await client.getApplications();
  const app = appsResp.result?.find((a: any) => a.application_name.startsWith(config.applicationName + '.'));
  if (!app) {
    console.error('❌ Приложение не найдено');
    process.exit(1);
  }

  // Находим сценарий
  const scenariosResp = await client.getScenarios(app.application_id);
  const scenario = scenariosResp.result?.find((s: any) => s.scenario_name === 'mitya-elevenlabs');
  if (!scenario) {
    console.error('❌ Сценарий mitya-elevenlabs не найден. Сначала: npm run upload');
    process.exit(1);
  }

  // Находим или создаём правило
  const rulesResp = await client.getRules(app.application_id);
  let rule = rulesResp.result?.find((r: any) => r.rule_name === 'mitya-elevenlabs-rule');

  if (!rule) {
    console.log('📋 Создаю правило mitya-elevenlabs-rule...');
    const ruleResp = await client.addRule(app.application_id, 'mitya-elevenlabs-rule', [scenario.scenario_id]);
    rule = { rule_id: ruleResp.rule_id };
    console.log(`✅ Rule ID: ${rule.rule_id}`);
  }

  console.log('\n🤖 Ассистент Мити Амбарцумяна v8\n');
  console.log(`📱 Звоним: ${phoneNumber}`);
  console.log(`🎤 Голос: ElevenLabs (${voiceId})`);
  console.log(`🧠 LLM: Qwen3-4B`);
  console.log(`🎵 Режим: потоковые короткие фразы`);
  console.log(`📋 Rule ID: ${rule.rule_id}\n`);

  const customData = {
    phone: phoneNumber,
    callerId: config.callerId,
    yandexApiKey: yandexKey,
    yandexFolderId: yandexFolder,
    elevenLabsApiKey: elevenLabsKey,
    voiceId: voiceId,
  };

  const response = await client.startScenarios(rule.rule_id, JSON.stringify(customData));

  if (response.result === 1) {
    console.log('✅ Звонок запущен!\n');
  } else {
    console.log('⚠️  Ответ:', JSON.stringify(response, null, 2));
  }
}

main().catch(console.error);
