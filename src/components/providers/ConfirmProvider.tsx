'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { ConfirmDialog, type DialogVariant } from '@/components/ui/ConfirmDialog'

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: DialogVariant
}

interface AlertOptions {
  title: string
  message: string
  variant?: DialogVariant
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  alert: (options: AlertOptions) => Promise<void>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

interface DialogState {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  variant: DialogVariant
  alertOnly: boolean
  resolve: ((value: boolean) => void) | null
}

const initialState: DialogState = {
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  variant: 'default',
  alertOnly: false,
  resolve: null,
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>(initialState)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        variant: options.variant || 'default',
        alertOnly: false,
        resolve,
      })
    })
  }, [])

  const alertFn = useCallback((options: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        title: options.title,
        message: options.message,
        confirmLabel: 'OK',
        cancelLabel: 'Cancel',
        variant: options.variant || 'info',
        alertOnly: true,
        resolve: () => resolve(),
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    state.resolve?.(true)
    setState(initialState)
  }, [state])

  const handleCancel = useCallback(() => {
    state.resolve?.(false)
    setState(initialState)
  }, [state])

  return (
    <ConfirmContext.Provider value={{ confirm, alert: alertFn }}>
      {children}
      <ConfirmDialog
        open={state.open}
        title={state.title}
        message={state.message}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        variant={state.variant}
        alertOnly={state.alertOnly}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmContextValue {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context
}
