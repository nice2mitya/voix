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
      recentCalls,
      callsByResult,
      avgDuration,
    ] = await Promise.all([
      // Total calls
      prisma.call.count(),
      // Completed calls
      prisma.call.count({ where: { status: 'completed' } }),
      // Scheduled calls
      prisma.call.count({ where: { result: 'scheduled' } }),
      // Recent calls for chart (last 30 days)
      prisma.call.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
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

    // Group calls by day
    const callsByDayMap = new Map<string, number>()
    recentCalls.forEach((call) => {
      const dateStr = call.createdAt.toISOString().split('T')[0]
      callsByDayMap.set(dateStr, (callsByDayMap.get(dateStr) || 0) + 1)
    })
    const callsByDay = Array.from(callsByDayMap.entries()).map(([date, count]) => ({
      date,
      count,
    }))

    return NextResponse.json({
      totalCalls,
      completedCalls,
      scheduledCalls,
      conversionRate: totalCalls > 0 ? (scheduledCalls / totalCalls) * 100 : 0,
      avgDuration: avgDuration._avg.duration || 0,
      callsByDay,
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
