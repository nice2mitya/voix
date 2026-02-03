'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Phone, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

export default function DialPage() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [customGreeting, setCustomGreeting] = useState('')

  const handleDial = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)

    try {
      const body: Record<string, string> = { phone: getCleanPhone() }
      if (customPrompt.trim()) body.systemPrompt = customPrompt.trim()
      if (customGreeting.trim()) body.greeting = customGreeting.trim()

      const res = await fetch('/api/dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (res.ok) {
        setResult({ success: true, message: 'Звонок запущен!' })
        setPhone('')
      } else {
        setResult({ success: false, message: data.error || 'Ошибка запуска звонка' })
      }
    } catch {
      setResult({ success: false, message: 'Ошибка подключения' })
    } finally {
      setLoading(false)
    }
  }

  const formatPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 1) return '+7'
    if (digits.length <= 4) return `+7 (${digits.slice(1)}`
    if (digits.length <= 7) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4)}`
    if (digits.length <= 9) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value)
    setPhone(formatted)
  }

  const getCleanPhone = () => {
    return '+' + phone.replace(/\D/g, '')
  }

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Позвонить
          </CardTitle>
          <CardDescription>
            Введите номер телефона для запуска исходящего звонка
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDial} className="space-y-4">
            <div>
              <Input
                type="tel"
                placeholder="+7 (999) 123-45-67"
                value={phone}
                onChange={handlePhoneChange}
                className="text-lg"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Номер: {getCleanPhone()}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCustom(!showCustom)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showCustom ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Настройки для этого звонка
            </button>

            {showCustom && (
              <div className="space-y-3 border rounded-md p-3 bg-muted/30">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Задача для звонка
                  </label>
                  <Textarea
                    placeholder="Например: Узнай, когда удобно встретиться на кофе в эту пятницу"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Если пусто — используется промпт из настроек
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Приветствие
                  </label>
                  <Textarea
                    placeholder="Например: Привет! Это Аиша, ассистент Мити. Митя хотел узнать..."
                    value={customGreeting}
                    onChange={(e) => setCustomGreeting(e.target.value)}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Если пусто — используется приветствие из настроек
                  </p>
                </div>
              </div>
            )}

            {result && (
              <div
                className={`p-3 rounded-md text-sm ${
                  result.success
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {result.message}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || phone.replace(/\D/g, '').length < 11}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Запуск...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  Позвонить
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
