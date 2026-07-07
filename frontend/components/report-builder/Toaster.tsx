'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Info, X, RotateCcw } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  kind: ToastKind
  title: string
  description?: string
  /** Optional retry callback — surfaces a "Try again" button on error toasts. */
  retry?: () => void
}

interface ToastContextValue {
  toast: (t: Omit<Toast, 'id'>) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const KIND_STYLE: Record<ToastKind, { icon: typeof Info; ring: string; iconColor: string; bar: string }> = {
  success: { icon: CheckCircle2, ring: 'border-emerald-200', iconColor: 'text-emerald-600', bar: 'bg-emerald-500' },
  error: { icon: AlertTriangle, ring: 'border-rose-200', iconColor: 'text-rose-600', bar: 'bg-rose-500' },
  info: { icon: Info, ring: 'border-sky-200', iconColor: 'text-sky-600', bar: 'bg-sky-500' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [mounted, setMounted] = useState(false)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    setMounted(true)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    if (timers.current[id]) {
      clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts(prev => [...prev, { ...t, id }])
    // Auto-dismiss: errors with a retry stay a little longer so they're not missed.
    const ttl = t.kind === 'error' && t.retry ? 8000 : 4200
    timers.current[id] = setTimeout(() => dismiss(id), ttl)
    return id
  }, [dismiss])

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted && createPortal(
        <div className="fixed top-4 right-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2 print:hidden">
          <AnimatePresence initial={false}>
            {toasts.map(t => {
              const style = KIND_STYLE[t.kind]
              const IconCmp = style.icon
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, x: 40, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className={`relative overflow-hidden rounded-xl border ${style.ring} bg-white p-3.5 pr-9 shadow-elev-3`}
                >
                  <span className={`absolute left-0 top-0 h-full w-1 ${style.bar}`} />
                  <div className="flex gap-2.5">
                    <IconCmp className={`h-4.5 w-4.5 mt-0.5 shrink-0 ${style.iconColor}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800">{t.title}</p>
                      {t.description && (
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{t.description}</p>
                      )}
                      {t.retry && (
                        <button
                          onClick={() => { t.retry!(); dismiss(t.id) }}
                          className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Try again
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => dismiss(t.id)}
                    className="absolute right-2 top-2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}
