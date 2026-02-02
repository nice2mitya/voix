'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatPhone, formatDuration, formatDate } from '@/lib/utils'
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, CheckCircle, XCircle } from 'lucide-react'

interface Call {
  id: string
  phone: string
  direction: string
  status: string
  duration: number | null
  result: string | null
  scheduledTime: string | null
  transcript: any
  createdAt: string
}

interface CallsResponse {
  calls: Call[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function CallsPage() {
  const [data, setData] = useState<CallsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)

  useEffect(() => {
    fetchCalls()
  }, [])

  const fetchCalls = async () => {
    try {
      const res = await fetch('/api/calls')
      const data = await res.json()
      setData(data)
    } catch (error) {
      console.error('Failed to fetch calls:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
      case 'no_answer':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getResultBadge = (result: string | null) => {
    if (!result) return null
    const colors: Record<string, string> = {
      scheduled: 'bg-green-100 text-green-800',
      refused: 'bg-red-100 text-red-800',
      callback: 'bg-yellow-100 text-yellow-800',
    }
    const labels: Record<string, string> = {
      scheduled: 'Назначено',
      refused: 'Отказ',
      callback: 'Перезвонить',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[result] || 'bg-gray-100'}`}>
        {labels[result] || result}
      </span>
    )
  }

  if (loading) {
    return <div className="flex justify-center py-12">Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">История звонков</h1>
        <Button onClick={fetchCalls} variant="outline">
          Обновить
        </Button>
      </div>

      {data?.calls.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Звонков пока нет</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {data?.calls.map((call) => (
            <Card
              key={call.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setSelectedCall(call)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {call.direction === 'inbound' ? (
                        <PhoneIncoming className="h-5 w-5 text-blue-500" />
                      ) : (
                        <PhoneOutgoing className="h-5 w-5 text-green-500" />
                      )}
                      {getStatusIcon(call.status)}
                    </div>
                    <div>
                      <p className="font-medium">{formatPhone(call.phone)}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(call.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getResultBadge(call.result)}
                    <span className="text-sm text-muted-foreground">
                      {formatDuration(call.duration)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Call detail modal */}
      {selectedCall && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedCall(null)}
        >
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {selectedCall.direction === 'inbound' ? (
                  <PhoneIncoming className="h-5 w-5 text-blue-500" />
                ) : (
                  <PhoneOutgoing className="h-5 w-5 text-green-500" />
                )}
                {formatPhone(selectedCall.phone)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Статус:</span> {selectedCall.status}
                </div>
                <div>
                  <span className="text-muted-foreground">Длительность:</span> {formatDuration(selectedCall.duration)}
                </div>
                <div>
                  <span className="text-muted-foreground">Результат:</span> {selectedCall.result || '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">Время:</span> {formatDate(selectedCall.createdAt)}
                </div>
              </div>

              {selectedCall.transcript && (
                <div>
                  <h4 className="font-medium mb-2">Транскрипт</h4>
                  <div className="bg-muted rounded-md p-4 text-sm space-y-2 max-h-64 overflow-auto">
                    {Array.isArray(selectedCall.transcript) ? (
                      selectedCall.transcript.map((msg: any, i: number) => (
                        <div key={i} className={msg.role === 'assistant' ? 'text-blue-600' : ''}>
                          <strong>{msg.role === 'assistant' ? 'Ассистент' : 'Клиент'}:</strong> {msg.content}
                        </div>
                      ))
                    ) : (
                      <pre className="whitespace-pre-wrap">{JSON.stringify(selectedCall.transcript, null, 2)}</pre>
                    )}
                  </div>
                </div>
              )}

              <Button onClick={() => setSelectedCall(null)} className="w-full">
                Закрыть
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
