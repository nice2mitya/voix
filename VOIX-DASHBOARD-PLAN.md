# VOIX Dashboard — План разработки

> Этот файл содержит полный контекст проекта для продолжения работы в Claude Cloud

---

## Текущий статус проекта VOIX

### Что уже работает ✅
- **Voximplant интеграция** — звонки работают через HTTP API
- **Ассистент Аиша** — голосовой ассистент с ElevenLabs TTS
- **Два сценария:**
  - `mitya-elevenlabs.voxengine.js` — исходящие звонки (прозвон)
  - `mitya-inbound.voxengine.js` — входящие звонки (приём)
- **LLM** — AliceAI (Yandex Cloud) для генерации ответов
- **Деплой сценариев** — `npm run upload` загружает в Voximplant

### Конфигурация
```
Voximplant Account ID: 10153237
Application ID: 48325643
Rule ID: 8209679
Caller ID: +79770008714
ElevenLabs Voice ID: rsotas5V9CH0fqkg0oNZ (Аиша)
```

### Структура репозитория
```
VOIX/
├── src/
│   ├── scenarios/           # VoxEngine сценарии
│   │   ├── mitya-elevenlabs.voxengine.js  # Прозвон (Аиша)
│   │   └── mitya-inbound.voxengine.js     # Приём (Аиша)
│   ├── config.ts            # Загрузка конфига
│   └── voximplant-client.ts # HTTP клиент для Voximplant API
├── scripts/
│   ├── mitya-elevenlabs-call.ts  # Запуск прозвона
│   └── upload-scenarios.ts       # Загрузка сценариев
├── .env                     # Ключи API
└── package.json
```

---

## Задача: Создать веб-панель управления

### Что нужно
1. **История звонков** — список всех звонков с транскриптами
2. **Настройки ассистента** — менять промпт, голос, приветствие через UI
3. **Аналитика** — графики: звонки по дням, конверсия
4. **Запуск прозвона** — вводить номер и звонить из интерфейса

### Решения
- **Расположение:** `VOIX/dashboard/` (монорепо)
- **Авторизация:** Простая (один пароль через cookie)
- **Деплой:** Dokploy из Git-репо (автоматически)

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                        VOIX Dashboard                            │
│                      (Next.js + Prisma)                          │
├─────────────────────────────────────────────────────────────────┤
│  UI Pages:                                                       │
│  • /calls - История звонков с транскриптами                     │
│  • /settings - Настройки ассистента (промпт, голос)             │
│  • /analytics - Графики и статистика                            │
│  • /dial - Запуск прозвона                                      │
├─────────────────────────────────────────────────────────────────┤
│  API Routes:                                                     │
│  • POST /api/webhook - Принимает данные от Voximplant           │
│  • GET/POST /api/calls - CRUD звонков                           │
│  • GET/POST /api/settings - Настройки ассистента                │
│  • POST /api/dial - Запуск звонка                               │
│  • GET /api/analytics - Статистика                              │
└───────────────────────┬─────────────────────────────────────────┘
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│    PostgreSQL   │         │   Voximplant    │
│    (Prisma)     │         │   (HTTP API)    │
└─────────────────┘         └─────────────────┘
```

---

## Стек технологий

| Компонент | Технология | Почему |
|-----------|------------|--------|
| Frontend | Next.js 14 (App Router) | SSR, API routes встроены, быстрый старт |
| UI | shadcn/ui + Tailwind | Красивые компоненты, кастомизация |
| Database | PostgreSQL + Prisma | Типизация, миграции, Dokploy-friendly |
| Auth | Cookie + middleware | Простая авторизация одним паролем |
| Charts | Recharts | Простые графики для аналитики |

---

## Структура dashboard/

```
VOIX/
├── dashboard/                   # <-- СОЗДАТЬ
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Редирект на /calls
│   │   ├── login/page.tsx       # Страница входа
│   │   ├── calls/page.tsx       # История звонков
│   │   ├── settings/page.tsx    # Настройки ассистента
│   │   ├── analytics/page.tsx   # Аналитика
│   │   ├── dial/page.tsx        # Запуск прозвона
│   │   └── api/
│   │       ├── webhook/route.ts
│   │       ├── calls/route.ts
│   │       ├── settings/route.ts
│   │       ├── dial/route.ts
│   │       ├── analytics/route.ts
│   │       └── login/route.ts
│   ├── components/
│   │   ├── ui/                  # shadcn
│   │   ├── call-list.tsx
│   │   ├── call-detail.tsx
│   │   ├── settings-form.tsx
│   │   ├── dial-form.tsx
│   │   └── analytics-charts.tsx
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── voximplant.ts
│   │   └── utils.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── middleware.ts            # Авторизация
│   ├── Dockerfile
│   ├── package.json
│   └── .env
├── src/                         # Существующий код
├── scripts/
└── .env
```

---

## База данных (Prisma)

```prisma
model Call {
  id            String   @id @default(cuid())
  phone         String
  direction     String   // "inbound" | "outbound"
  status        String   // "completed" | "failed" | "no_answer"
  duration      Int?     // секунды
  result        String?  // "scheduled" | "refused" | "callback"
  scheduledTime String?  // если договорились о времени
  transcript    Json?    // полный лог разговора
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Settings {
  id            String   @id @default("default")
  assistantName String   @default("Аиша")
  voiceId       String   @default("rsotas5V9CH0fqkg0oNZ")
  systemPrompt  String   @db.Text
  greeting      String   @db.Text
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

---

## Авторизация (простая)

```typescript
// dashboard/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get('voix-auth');
  const isLoginPage = request.nextUrl.pathname === '/login';
  const isApiWebhook = request.nextUrl.pathname === '/api/webhook';

  // Webhook без авторизации
  if (isApiWebhook) return NextResponse.next();

  // Если не авторизован — на логин
  if (!authCookie && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Если авторизован и на логине — на главную
  if (authCookie && isLoginPage) {
    return NextResponse.redirect(new URL('/calls', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## Интеграция Voximplant ↔ Dashboard

### Webhook (Voximplant → Dashboard)
Добавить в `endConversation()` в сценариях:

```javascript
// В mitya-elevenlabs.voxengine.js и mitya-inbound.voxengine.js
function sendWebhook(data) {
  var webhookUrl = CONFIG.webhookUrl || '';
  if (!webhookUrl) return;

  Net.httpRequestAsync(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    postData: JSON.stringify(data)
  }).catch(function(err) {
    Logger.write('Webhook error: ' + err);
  });
}

// В endConversation() добавить:
sendWebhook({
  phone: callerNumber || data.phone,
  direction: 'outbound', // или 'inbound'
  status: 'completed',
  duration: Math.floor((Date.now() - callStartTime) / 1000),
  result: detectResult(conversationHistory),
  transcript: conversationHistory
});
```

### Запуск звонка (Dashboard → Voximplant)

```typescript
// dashboard/app/api/dial/route.ts
export async function POST(req: Request) {
  const { phone } = await req.json();
  const settings = await prisma.settings.findFirst();

  const customData = JSON.stringify({
    phone,
    callerId: process.env.CALLER_ID,
    yandexApiKey: process.env.YANDEX_API_KEY,
    yandexFolderId: process.env.YANDEX_FOLDER_ID,
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: settings?.voiceId || 'rsotas5V9CH0fqkg0oNZ',
    systemPrompt: settings?.systemPrompt,
    greeting: settings?.greeting,
    webhookUrl: process.env.WEBHOOK_URL,
  });

  // Используем существующий voximplant-client
  await startScenarios(ruleId, customData);

  return Response.json({ success: true });
}
```

---

## Этапы реализации

### Этап 1: Базовая структура
- [ ] `npx create-next-app@latest dashboard --typescript --tailwind --app`
- [ ] `npx shadcn@latest init`
- [ ] Настроить Prisma + PostgreSQL
- [ ] Создать layout с навигацией
- [ ] Middleware авторизации
- [ ] Dockerfile

### Этап 2: История звонков
- [ ] POST /api/webhook — приём данных
- [ ] GET /api/calls — список звонков
- [ ] Страница /calls с таблицей
- [ ] Модалка с деталями и транскриптом

### Этап 3: Настройки ассистента
- [ ] GET/POST /api/settings
- [ ] Страница /settings с формой
- [ ] Поля: имя, промпт, приветствие, голос

### Этап 4: Запуск прозвона
- [ ] POST /api/dial
- [ ] Страница /dial с формой ввода номера
- [ ] Индикатор статуса звонка

### Этап 5: Аналитика
- [ ] GET /api/analytics
- [ ] Страница /analytics
- [ ] Графики: звонки по дням, конверсия

### Этап 6: Обновить сценарии Voximplant
- [ ] Добавить webhook в mitya-elevenlabs.voxengine.js
- [ ] Добавить webhook в mitya-inbound.voxengine.js
- [ ] `npm run upload`

---

## Переменные окружения (.env)

```env
# Database
DATABASE_URL="postgresql://voix:password@localhost:5432/voix"

# Auth
ADMIN_PASSWORD="your-secure-password"

# Voximplant
VOXIMPLANT_ACCOUNT_ID=10153237
VOXIMPLANT_API_KEY=86a3e4d1-ea18-4772-a8d7-d261697d629a
VOXIMPLANT_RULE_ID=8209679
CALLER_ID=+79770008714

# APIs
YANDEX_API_KEY=...
YANDEX_FOLDER_ID=b1gldslh30kku55tga8r
ELEVENLABS_API_KEY=...

# Webhook (URL этого dashboard)
WEBHOOK_URL=https://your-domain.com/api/webhook
```

---

## Деплой на Dokploy

```dockerfile
# dashboard/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "server.js"]
```

---

## Верификация

1. **Локально:** `cd dashboard && npm run dev` → http://localhost:3000
2. **Авторизация:** Войти с паролем из ADMIN_PASSWORD
3. **Webhook:** `curl -X POST http://localhost:3000/api/webhook -d '{"phone":"+79001234567"}'`
4. **Звонок:** Запустить из /dial, проверить что появился в /calls
5. **Dokploy:** Git push → автодеплой → проверить на продакшене
