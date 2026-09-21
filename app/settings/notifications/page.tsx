'use client'
// app/settings/notifications/page.tsx — SecureScan Pro
// Configuración de notificaciones (email/webhook). Usa /api/settings/notifications
// (GET/POST) — NUNCA expone credenciales SMTP (esas viven solo en el
// entorno del servidor, ver server/notifications.py).

import { useEffect, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Bell, Mail, Webhook, Save, Loader2, ShieldAlert } from 'lucide-react'
import { Header } from '@/components/header'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberButton } from '@/components/cyber/CyberButton'
import { EmptyState } from '@/components/cyber/EmptyState'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { getNotificationSettings, updateNotificationSettings } from '@/lib/api-client'
import type { NotificationSettings } from '@/lib/api-client'

const DEFAULT_SETTINGS: NotificationSettings = {
  email_enabled: false,
  email_to: '',
  webhook_enabled: false,
  webhook_url: '',
  min_severity: 'info',
  events: { job_completed: true, job_failed: true, job_cancelled: true },
}

export default function NotificationSettingsPage() {
  const t = useTranslations('notificationSettings')
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await getNotificationSettings()
    if (err) setError(err.error)
    else if (data) setSettings(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setSaving(true)
    const { data, error: err } = await updateNotificationSettings(settings)
    setSaving(false)
    if (err) {
      toast.error(t('saveErrorToast'), { description: err.error })
      return
    }
    if (data) {
      setSettings(data)
      toast.success(t('savedToast'))
    }
  }

  const EVENT_ROWS: { key: keyof NotificationSettings['events']; label: string }[] = [
    { key: 'job_completed', label: t('eventCompleted') },
    { key: 'job_failed',    label: t('eventFailed') },
    { key: 'job_cancelled', label: t('eventCancelled') },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-2xl space-y-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[rgba(var(--cyber-accent-rgb),0.3)] bg-[rgba(var(--cyber-accent-rgb),0.10)]">
              <Bell className="h-5 w-5 text-[var(--cyber-accent)]" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
              <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
            </div>
          </div>

          {loading && (
            <div className="space-y-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-24 animate-pulse rounded-lg border border-[hsl(var(--border))] bg-muted/20" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="space-y-3 text-center">
              <EmptyState icon={ShieldAlert} title={t('loadErrorTitle')} detail={error} />
              <CyberButton size="sm" onClick={load}>{t('retry')}</CyberButton>
            </div>
          )}

          {!loading && !error && (
            <>
              <CyberCard className="transition-colors duration-200 hover:border-[rgba(var(--cyber-accent-rgb),0.25)]">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[var(--cyber-accent)]" />
                    <h2 className="font-semibold text-foreground">{t('email')}</h2>
                  </div>
                  <Switch
                    checked={settings.email_enabled}
                    onCheckedChange={(v) => setSettings(s => ({ ...s, email_enabled: v }))}
                  />
                </div>
                <label className="mb-1 block text-xs text-muted-foreground">{t('emailRecipient')}</label>
                <Input
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={settings.email_to}
                  disabled={!settings.email_enabled}
                  onChange={(e) => setSettings(s => ({ ...s, email_to: e.target.value }))}
                />
              </CyberCard>

              <CyberCard className="transition-colors duration-200 hover:border-[rgba(var(--cyber-accent-rgb),0.25)]">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Webhook className="h-4 w-4 text-[var(--cyber-accent)]" />
                    <h2 className="font-semibold text-foreground">{t('webhook')}</h2>
                  </div>
                  <Switch
                    checked={settings.webhook_enabled}
                    onCheckedChange={(v) => setSettings(s => ({ ...s, webhook_enabled: v }))}
                  />
                </div>
                <label className="mb-1 block text-xs text-muted-foreground">{t('webhookUrl')}</label>
                <Input
                  type="url"
                  placeholder={t('webhookPlaceholder')}
                  value={settings.webhook_url}
                  disabled={!settings.webhook_enabled}
                  onChange={(e) => setSettings(s => ({ ...s, webhook_url: e.target.value }))}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('webhookSsrfNote')}
                </p>
              </CyberCard>

              <CyberCard className="transition-colors duration-200 hover:border-[rgba(var(--cyber-accent-rgb),0.25)]">
                <h2 className="mb-3 font-semibold text-foreground">{t('events')}</h2>
                <div className="space-y-3">
                  {EVENT_ROWS.map(ev => (
                    <div key={ev.key} className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{ev.label}</span>
                      <Switch
                        checked={settings.events[ev.key]}
                        onCheckedChange={(v) => setSettings(s => ({
                          ...s, events: { ...s.events, [ev.key]: v },
                        }))}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t border-[hsl(var(--border))] pt-4">
                  <label className="mb-1 block text-xs text-muted-foreground">{t('minSeverity')}</label>
                  <Select
                    value={settings.min_severity}
                    onValueChange={(v) => setSettings(s => ({ ...s, min_severity: v as NotificationSettings['min_severity'] }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">{t('sevInfo')}</SelectItem>
                      <SelectItem value="low">{t('sevLow')}</SelectItem>
                      <SelectItem value="medium">{t('sevMedium')}</SelectItem>
                      <SelectItem value="high">{t('sevHigh')}</SelectItem>
                      <SelectItem value="critical">{t('sevCritical')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-2 text-xs text-muted-foreground">{t('minSeverityHint')}</p>
                </div>
              </CyberCard>

              <CyberButton
                onClick={handleSave}
                disabled={saving}
                icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              >
                {saving ? t('saving') : t('save')}
              </CyberButton>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
