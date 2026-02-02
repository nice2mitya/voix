# Mitya Assistant - Текущее состояние

## Обзор

Голосовой бот-ассистент Мити Амбарцумяна на базе Voximplant + ElevenLabs + Yandex Cloud.

## Режимы работы

### 1. Исходящие звонки (Outbound)
**Задача**: позвонить человеку, представиться ассистентом Мити, узнать удобное время для звонка.

```bash
npm run mitya11 +79XXXXXXXXX
```

### 2. Входящие звонки (Inbound) - NEW
**Задача**: принимать звонки на номер +79770008714, представляться личным ассистентом, выслушивать и записывать в лог.

```bash
# Позвонить на номер:
+79770008714
```

## Текущая версия: v8

**Файлы:**
- `src/scenarios/mitya-elevenlabs.voxengine.js` - исходящие звонки
- `src/scenarios/mitya-inbound.voxengine.js` - входящие звонки (NEW)
- `scripts/mitya-elevenlabs-call.ts` - скрипт запуска исходящего звонка

## Технологический стек

| Компонент | Технология | Детали |
|-----------|------------|--------|
| Платформа | Voximplant | VoxEngine сценарии |
| TTS (голос) | ElevenLabs | Voice ID: `BhF9uHLusJ5UYp49C1kI`, модель: `eleven_turbo_v2_5` |
| ASR (распознавание) | Yandex SpeechKit | Русский язык |
| LLM | **AliceAI** | `gpt://folder_id/aliceai-llm/latest` (~600ms) |

## Сравнение LLM моделей

| Модель | Время ответа | Статус | Примечание |
|--------|--------------|--------|------------|
| **AliceAI** | **~600ms** | ✅ Используется | Лучший выбор |
| Qwen3-235B | ~1300-1700ms | ✅ Работает | Медленнее, иногда галлюцинации |
| gpt-oss-20b | ~2000ms+ | ❌ | Возвращает reasoning вместо ответа |
| qwen3-4b | - | ❌ | Ошибка 500 |
| YandexGPT Lite | ~800ms | ✅ Работает | Запасной вариант |

## Credentials (.env)

```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key
YANDEX_API_KEY=your_yandex_api_key
YANDEX_FOLDER_ID=your_yandex_folder_id
CALLER_ID=+79770008714
```

## Архитектура

### Потоковое приветствие
Приветствие разбито на 4 короткие фразы для минимизации задержки:
```javascript
greetingParts: [
  'Алло, здравствуйте!',
  'Это Филипп, ассистент Мити Амбарцумяна.',
  'Митя просил связаться с вами — хотел обсудить один вопрос.',
  'Когда вам удобно созвониться минут на десять?'
]
```

### LLM Integration (OpenAI API)
```javascript
// AliceAI через OpenAI-совместимый endpoint
Net.httpRequestAsync('https://llm.api.cloud.yandex.net/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Api-Key ' + apiKey
  },
  postData: JSON.stringify({
    model: 'gpt://folder_id/aliceai-llm/latest',
    messages: messages,
    max_tokens: 80,
    temperature: 0.3
  })
});
```

### Логика завершения
- `hasFullDateTime()` - проверяет наличие дня + времени
- `shouldEndCall()` - проверяет фразы отказа
- `isEndPhrase()` - проверяет "до свидания" в ответе LLM

## Команды

```bash
# Загрузить сценарии в Voximplant
npm run upload

# Исходящий звонок
npm run mitya11 +79XXXXXXXXX

# Логи - смотреть в Voximplant Console:
# https://manage.voximplant.com/ → Applications → voix → Logs
```

## Voximplant Resources

- Application: `voix`
- Scenarios:
  - `mitya-elevenlabs` (ID: 3047196) - исходящие
  - `mitya-inbound` - входящие (NEW)
- Rules:
  - `mitya-elevenlabs-rule` (ID: 8218520) - исходящие
  - `mitya-inbound-rule` - входящие (NEW)
- Phone: `+79770008714`

## История версий

| Версия | Описание |
|--------|----------|
| v1-v5 | Yandex SpeechKit TTS (проблемы с ударениями) |
| v6 | ElevenLabs Realtime TTS |
| v7 | Предгенерация интро |
| v8 | Потоковые короткие фразы + AliceAI LLM |
| v8.1 | + Входящие звонки |
