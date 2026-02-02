import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface WebhookPayload {
  phone: string
  direction: 'inbound' | 'outbound'
  status: 'completed' | 'failed' | 'no_answer'
  duration?: number
  result?: string
  scheduledTime?: string
  transcript?: unknown
}

export async function POST(req: Request) {
  try {
    const data: WebhookPayload = await req.json()

    const call = await prisma.call.create({
      data: {
        phone: data.phone,
        direction: data.direction,
        status: data.status,
        duration: data.duration,
        result: data.result,
        scheduledTime: data.scheduledTime,
        transcript: data.transcript as any,
      },
    })

    return NextResponse.json({ success: true, id: call.id })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}
