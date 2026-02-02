import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULT_SYSTEM_PROMPT = `Ты - личный ассистент Мити Амбарцумяна по имени Аиша.
Твоя задача - связаться с человеком и узнать удобное время для звонка с Митей.
Будь вежливой, краткой и профессиональной.`

const DEFAULT_GREETING = `Алло, здравствуйте! Это Аиша, ассистент Мити Амбарцумяна. Митя просил связаться с вами — хотел обсудить один вопрос. Когда вам удобно созвониться минут на десять?`

export async function GET() {
  try {
    let settings = await prisma.settings.findFirst({
      where: { id: 'default' },
    })

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: 'default',
          assistantName: 'Аиша',
          voiceId: 'rsotas5V9CH0fqkg0oNZ',
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
          greeting: DEFAULT_GREETING,
        },
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Get settings error:', error)
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()

    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      update: {
        assistantName: data.assistantName,
        voiceId: data.voiceId,
        systemPrompt: data.systemPrompt,
        greeting: data.greeting,
      },
      create: {
        id: 'default',
        assistantName: data.assistantName || 'Аиша',
        voiceId: data.voiceId || 'rsotas5V9CH0fqkg0oNZ',
        systemPrompt: data.systemPrompt || DEFAULT_SYSTEM_PROMPT,
        greeting: data.greeting || DEFAULT_GREETING,
      },
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Update settings error:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
