import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startScenarios } from '@/lib/voximplant'

export async function POST(req: Request) {
  try {
    const { phone } = await req.json()

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
    })

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
