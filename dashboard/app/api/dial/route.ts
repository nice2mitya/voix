import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startScenarios } from '@/lib/voximplant'

function buildTaskPrompt(task: string, assistantName: string): string {
  return `Ты ${assistantName} — ассистент Мити Амбарцумяна. Отвечай ТОЛЬКО одной короткой фразой.

ХАРАКТЕР: дружелюбная, тёплая, немного игривая, но деловая. Говоришь мягко и с улыбкой в голосе.

ТВОЯ ЕДИНСТВЕННАЯ ЗАДАЧА В ЭТОМ ЗВОНКЕ: ${task}

ВАЖНО:
- Следуй ТОЛЬКО задаче выше. Не спрашивай про другие темы.
- Если человек дал конкретный ответ на твою задачу — радостно подтверди и попрощайся
- Если ответ неполный — мягко уточни детали
- При отказе — понимающе попрощайся
- Не повторяй одно и то же, реагируй на то, что говорит собеседник

ФОРМАТ: только одно предложение, без кавычек, без ролей.

ФИШЕЧКИ: используй живые фразы типа "Записала!", "Ловлю!", "Поняла!"`
}

function buildTaskGreeting(task: string, assistantName: string): string {
  return `Алло, здравствуйте! Это ${assistantName}, ассистент Мити Амбарцумяна. Митя просил узнать: ${task}`
}

export async function POST(req: Request) {
  try {
    const { phone, systemPrompt, greeting } = await req.json()

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    const settings = await prisma.settings.findFirst({
      where: { id: 'default' },
    })

    const ruleId = process.env.VOXIMPLANT_RULE_ID
    if (!ruleId) {
      return NextResponse.json(
        { error: 'Voximplant rule ID not configured' },
        { status: 500 }
      )
    }

    const name = settings?.assistantName || 'Аиша'

    // If a custom task is provided, build matching prompt AND greeting
    const finalPrompt = systemPrompt
      ? buildTaskPrompt(systemPrompt, name)
      : settings?.systemPrompt

    const finalGreeting = greeting
      || (systemPrompt ? buildTaskGreeting(systemPrompt, name) : settings?.greeting)

    const customData = JSON.stringify({
      phone,
      callerId: process.env.CALLER_ID,
      yandexApiKey: process.env.YANDEX_API_KEY,
      yandexFolderId: process.env.YANDEX_FOLDER_ID,
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
      voiceId: settings?.voiceId || 'rsotas5V9CH0fqkg0oNZ',
      systemPrompt: finalPrompt,
      greeting: finalGreeting,
      webhookUrl: process.env.WEBHOOK_URL,
    })

    console.log('Dial customData length:', customData.length)
    console.log('Dial systemPrompt:', systemPrompt ? 'custom task' : 'from settings')
    console.log('Dial greeting:', greeting ? 'custom' : (systemPrompt ? 'auto-generated' : 'from settings'))

    const result = await startScenarios({ ruleId, customData })

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('Dial error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start call' },
      { status: 500 }
    )
  }
}
