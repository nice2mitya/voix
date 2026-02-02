import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [
      totalCalls,
      completedCalls,
      scheduledCalls,
      callsByDay,
      callsByResult,
      avgDuration,
    ] = await Promise.all([
      // Total calls
      prisma.call.count(),
      // Completed calls
      prisma.call.count({ where: { status: 'completed' } }),
      // Scheduled calls
      prisma.call.count({ where: { result: 'scheduled' } }),
      // Calls by day (last 30 days)
      prisma.$queryRaw`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM "Call"
        WHERE created_at >= ${thirtyDaysAgo}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      ` as Promise<{ date: Date; count: bigint }[]>,
      // Calls by result
      prisma.call.groupBy({
        by: ['result'],
        _count: true,
      }),
      // Average duration
      prisma.call.aggregate({
        _avg: { duration: true },
        where: { duration: { not: null } },
      }),
    ])

    return NextResponse.json({
      totalCalls,
      completedCalls,
      scheduledCalls,
      conversionRate: totalCalls > 0 ? (scheduledCalls / totalCalls) * 100 : 0,
      avgDuration: avgDuration._avg.duration || 0,
      callsByDay: callsByDay.map((item) => ({
        date: item.date,
        count: Number(item.count),
      })),
      callsByResult: callsByResult.map((item) => ({
        result: item.result || 'unknown',
        count: item._count,
      })),
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to get analytics' },
      { status: 500 }
    )
  }
}
