'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Settings, Save, Loader2 } from 'lucide-react'

interface SettingsData {
  id: string
  assistantName: string
  voiceId: string
  systemPrompt: string
  greeting: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      setSettings(data)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings) return

    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Настройки сохранены!' })
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || 'Ошибка сохранения' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Ошибка подключения' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12">Загрузка...</div>
  }

  if (!settings) {
    return <div className="flex justify-center py-12 text-destructive">Ошибка загрузки настроек</div>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Настройки ассистента
          </CardTitle>
          <CardDescription>
            Настройте параметры голосового ассистента
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Имя ассистента</label>
              <Input
                value={settings.assistantName}
                onChange={(e) => setSettings({ ...settings, assistantName: e.target.value })}
                placeholder="Аиша"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Voice ID (ElevenLabs)</label>
              <Input
                value={settings.voiceId}
                onChange={(e) => setSettings({ ...settings, voiceId: e.target.value })}
                placeholder="rsotas5V9CH0fqkg0oNZ"
              />
              <p className="text-xs text-muted-foreground">
                ID голоса из ElevenLabs для синтеза речи
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Системный промпт</label>
              <Textarea
                value={settings.systemPrompt}
                onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                placeholder="Инструкции для ассистента..."
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Определяет поведение и стиль общения ассистента
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Приветствие</label>
              <Textarea
                value={settings.greeting}
                onChange={(e) => setSettings({ ...settings, greeting: e.target.value })}
                placeholder="Алло, здравствуйте!..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Первая фраза при начале разговора
              </p>
            </div>

            {message && (
              <div
                className={`p-3 rounded-md text-sm ${
                  message.type === 'success'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {message.text}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Сохранить
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
