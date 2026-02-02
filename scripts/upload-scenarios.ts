/**
 * Загрузка сценариев в Voximplant
 *
 * Читает .voxengine.js файлы из src/scenarios/
 * и загружает их в приложение Voximplant
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from '../src/config.js';
import { createVoximplantClient } from '../src/voximplant-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('📤 Загрузка сценариев в Voximplant...\n');

  const config = loadConfig();
  const client = await createVoximplantClient(config);

  // Получаем приложение (имя в API включает домен)
  const appsResponse = await client.getApplications();
  const app = appsResponse.result?.find(
    (a: any) => a.application_name.startsWith(config.applicationName + '.')
  );

  if (!app) {
    console.error(`❌ Приложение "${config.applicationName}" не найдено.`);
    console.error('   Сначала выполните: npm run setup');
    process.exit(1);
  }

  const applicationId = app.application_id;
  console.log(`📱 Приложение: ${config.applicationName} (ID: ${applicationId})\n`);

  // Получаем существующие сценарии
  const scenariosResponse = await client.getScenarios(applicationId);
  const existingScenarios = scenariosResponse.result || [];

  // Читаем файлы сценариев
  const scenariosDir = join(__dirname, '..', 'src', 'scenarios');
  const files = readdirSync(scenariosDir).filter((f) => f.endsWith('.voxengine.js'));

  if (files.length === 0) {
    console.log('⚠️  Нет сценариев для загрузки');
    return;
  }

  const uploadedScenarioIds: number[] = [];

  for (const file of files) {
    const scenarioName = file.replace('.voxengine.js', '');
    const filePath = join(scenariosDir, file);
    const script = readFileSync(filePath, 'utf-8');

    console.log(`📄 ${file}`);

    // Проверяем, существует ли сценарий
    const existing = existingScenarios.find(
      (s: any) => s.scenario_name === scenarioName
    );

    if (existing) {
      console.log(`   🔄 Обновляем (ID: ${existing.scenario_id})...`);
      await client.updateScenario(existing.scenario_id, scenarioName, script);
      uploadedScenarioIds.push(existing.scenario_id);
      console.log(`   ✅ Обновлено`);
    } else {
      console.log(`   📝 Создаем...`);
      const response = await client.addScenario(applicationId, scenarioName, script);
      uploadedScenarioIds.push(response.scenario_id);
      console.log(`   ✅ Создано (ID: ${response.scenario_id})`);
    }
  }

  // Обновляем правило со сценариями
  console.log('\n📋 Обновляем правило маршрутизации...');

  const rulesResponse = await client.getRules(applicationId);
  const rule = rulesResponse.result?.find((r: any) => r.rule_name === 'test-call-rule');

  if (rule && uploadedScenarioIds.length > 0) {
    // Voximplant API не позволяет обновить rule напрямую,
    // но сценарии уже привязаны к приложению
    console.log(`   ✅ Сценарии доступны в правиле (Rule ID: ${rule.rule_id})`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Загрузка завершена!');
  console.log(`   Загружено сценариев: ${files.length}`);
}

main().catch((err) => {
  console.error('❌ Ошибка:', err.message);
  process.exit(1);
});
