'use client'
// app/schedules/page.tsx — SecureScan Pro
// Gestión de escaneos programados (Celery Beat). Usa exclusivamente las
// rutas ya existentes: /api/schedules (GET/POST), /api/schedules/<id>
// (GET/DELETE), /api/schedules/<id>/pause, /api/schedules/<id>/resume.

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Calendar, Plus, Trash2, Pause, Play, Clock, Target, Loader2,
} from 'lucide-react'
import { Header } from '@/components/header'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberBadge } from '@/components/cyber/CyberBadge'
import { CyberButton } from '@/components/cyber/CyberButton'
import { EmptyState } from '@/components/cyber/EmptyState'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  listSchedules, createSchedule, pauseSchedule, resumeSchedule, deleteSchedule,
} from '@/lib/api-client'
import type { Schedule, CreateScheduleRequest } from '@/lib/api-client'

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const FREQUENCY_KEY: Record<Schedule['frequency'], string> = {
  daily: 'frequencyDaily', weekly: 'frequencyWeekly', monthly: 'frequencyMonthly',
}

// ─── Formulario de creación ─────────────────────────────────────────────────
function CreateScheduleForm({ onCreated }: { onCreated: (s: Schedule) => void }) {
  const t = useTranslations('schedules')
  const [target, setTarget]       = useState('')
  const [frequency, setFrequency] = useState<Schedule['frequency']>('daily')
  const [time, setTime]           = useState('03:00')
  const [dayOfWeek, setDayOfWeek] = useState('1')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!target.trim()) {
      toast.error(t('targetRequired'))
      return
    }
    const [hourStr, minuteStr] = time.split(':')
    const req: CreateScheduleRequest = {
      target: target.trim(),
      frequency,
      hour: parseInt(hourStr, 10) || 0,
      minute: parseInt(minuteStr, 10) || 0,
      ...(frequency === 'weekly'  ? { day_of_week: parseInt(dayOfWeek, 10) } : {}),
      ...(frequency === 'monthly' ? { day_of_month: parseInt(dayOfMonth, 10) } : {}),
    }

    setSubmitting(true)
    const { data, error } = await createSchedule(req)
    setSubmitting(false)

    if (error) {
      toast.error(t('createErrorToast'), { description: error.error })
      return
    }
    if (data) {
      toast.success(t('createdToast'), { description: data.target })
      onCreated(data)
      setTarget('')
    }
  }

  return (
    <CyberCard>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-[var(--cyber-accent)]" />
          <h2 className="font-semibold text-foreground">{t('newTitle')}</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">{t('targetLabel')}</label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={t('targetPlaceholder')}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t('frequencyLabel')}</label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as Schedule['frequency'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t('frequencyDaily')}</SelectItem>
                <SelectItem value="weekly">{t('frequencyWeekly')}</SelectItem>
                <SelectItem value="monthly">{t('frequencyMonthly')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t('timeLabel')}</label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>

          {frequency === 'weekly' && (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t('weekdayLabel')}</label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(t.raw('weekdays') as string[]).map((label, idx) => (
                    <SelectItem key={idx} value={String(idx)}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {frequency === 'monthly' && (
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{t('monthDayLabel')}</label>
              <Input
                type="number" min={1} max={28}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
              />
            </div>
          )}
        </div>

        <CyberButton type="submit" disabled={submitting} icon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}>
          {submitting ? t('creating') : t('createButton')}
        </CyberButton>
      </form>
    </CyberCard>
  )
}

// ─── Fila de programación ───────────────────────────────────────────────────
function ScheduleRow({ schedule, onChange, onDelete }: {
  schedule: Schedule
  onChange: (s: Schedule) => void
  onDelete: (id: string) => void
}) {
  const [busy, setBusy] = useState(false)

  const t = useTranslations('schedules')

  const handleToggle = async () => {
    setBusy(true)
    const action = schedule.active ? pauseSchedule : resumeSchedule
    const { data, error } = await action(schedule.id)
    setBusy(false)
    if (error) {
      toast.error(t('updateErrorToast'), { description: error.error })
      return
    }
    if (data) {
      onChange(data)
      toast.success(data.active ? t('resumedToast') : t('pausedToast'))
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    const { error } = await deleteSchedule(schedule.id)
    setBusy(false)
    if (error) {
      toast.error(t('deleteErrorToast'), { description: error.error })
      return
    }
    toast.success(t('deletedToast'))
    onDelete(schedule.id)
  }

  return (
    <div className={cn(
      'grid grid-cols-[1fr_auto] gap-4 rounded-lg border p-4 transition-all duration-200',
      'border-[hsl(var(--border))] bg-[hsl(var(--card))]/70 backdrop-blur-sm',
      'hover:border-[rgba(var(--cyber-accent-rgb),0.3)] hover:shadow-cyber-sm hover:bg-[hsl(var(--card))]',
    )}>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <CyberBadge type={schedule.active ? 'completed' : 'pending'} label={schedule.active ? t('active') : t('paused')} size="sm" />
          <Target className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <code className="truncate font-mono text-sm text-foreground">{schedule.target}</code>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {t(FREQUENCY_KEY[schedule.frequency])} · {String(schedule.hour).padStart(2, '0')}:{String(schedule.minute).padStart(2, '0')} UTC
          </span>
          <span>{t('nextRun')}: {formatDate(schedule.next_run_at)}</span>
          <span>{t('lastRun')}: {formatDate(schedule.last_run_at)}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1">
        <button
          onClick={handleToggle}
          disabled={busy}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md border border-transparent',
            'text-muted-foreground transition-all duration-150',
            'hover:border-[rgba(var(--cyber-accent-rgb),0.3)] hover:text-[var(--cyber-accent)]',
            busy && 'opacity-40 pointer-events-none',
          )}
          aria-label={schedule.active ? t('pauseAction') : t('resumeAction')}
        >
          {schedule.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={handleDelete}
          disabled={busy}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md border border-transparent',
            'text-muted-foreground transition-all duration-150',
            'hover:border-red-900/50 hover:bg-red-500/10 hover:text-red-400',
            busy && 'opacity-40 pointer-events-none',
          )}
          aria-label={t('deleteAction')}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default function SchedulesPage() {
  const t = useTranslations('schedules')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await listSchedules()
    if (err) setError(err.error)
    else setSchedules(data?.schedules ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreated = (s: Schedule) => setSchedules(prev => [s, ...prev])
  const handleChange   = (s: Schedule) => setSchedules(prev => prev.map(x => x.id === s.id ? s : x))
  const handleDelete   = (id: string) => setSchedules(prev => prev.filter(x => x.id !== id))

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-[var(--cyber-accent)]" />
            <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('subtitle')}
          </p>

          <CreateScheduleForm onCreated={handleCreated} />

          <div className="space-y-3">
            {loading && (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/30" />
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="space-y-3 text-center">
                <EmptyState icon={Calendar} title={t('loadErrorTitle')} detail={error} />
                <CyberButton size="sm" onClick={load}>{t('retry')}</CyberButton>
              </div>
            )}

            {!loading && !error && schedules.length === 0 && (
              <EmptyState
                icon={Calendar}
                title={t('emptyTitle')}
                detail={t('emptyDetail')}
              />
            )}

            {!loading && !error && schedules.map(s => (
              <ScheduleRow key={s.id} schedule={s} onChange={handleChange} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
