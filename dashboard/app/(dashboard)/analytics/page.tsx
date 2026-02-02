'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3, Phone, CheckCircle, Calendar, Clock } from 'lucide-react'

interface AnalyticsData {
  totalCalls: number
  completedCalls: number
  scheduledCalls: number
  conversionRate: number
  avgDuration: number
  callsByDay: { date: string; count: number }[]
  callsByResult: { result: string; count: number }[]
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics')
      const data = await res.json()
      setData(data)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12">Загрузка...</div>
  }

  if (!data) {
    return <div className="flex justify-center py-12 text-destructive">Ошибка загрузки данных</div>
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Аналитика
        </h1>
        <Button onClick={fetchAnalytics} variant="outline">
          Обновить
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Phone className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Всего звонков</p>
                <p className="text-2xl font-bold">{data.totalCalls}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Завершено</p>
                <p className="text-2xl font-bold">{data.completedCalls}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-full">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Конверсия</p>
                <p className="text-2xl font-bold">{data.conversionRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-full">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ср. длительность</p>
                <p className="text-2xl font-bold">{formatDuration(data.avgDuration)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Звонки по дням</CardTitle>
          </CardHeader>
          <CardContent>
            {data.callsByDay.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Нет данных</p>
            ) : (
              <div className="space-y-2">
                {data.callsByDay.slice(-14).map((day) => (
                  <div key={day.date} className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-24">
                      {new Date(day.date).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (day.count / Math.max(...data.callsByDay.map((d) => d.count))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{day.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Результаты звонков</CardTitle>
          </CardHeader>
          <CardContent>
            {data.callsByResult.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Нет данных</p>
            ) : (
              <div className="space-y-4">
                {data.callsByResult.map((item) => {
                  const labels: Record<string, string> = {
                    scheduled: 'Назначено',
                    refused: 'Отказ',
                    callback: 'Перезвонить',
                    unknown: 'Другое',
                  }
                  const colors: Record<string, string> = {
                    scheduled: 'bg-green-500',
                    refused: 'bg-red-500',
                    callback: 'bg-yellow-500',
                    unknown: 'bg-gray-500',
                  }
                  return (
                    <div key={item.result} className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${colors[item.result] || colors.unknown}`} />
                      <span className="flex-1">{labels[item.result] || item.result}</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
