'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppFixedExpense } from '@/types/database'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { 
  formatCurrency, 
  calculateMonthlyFixedExpenses, 
  calculateYearlyFixedExpenses,
  EXPENSE_CATEGORIES 
} from '@/lib/utils'

interface FixedExpensesProps {
  userId: string
  showSuccess: (message: string) => void
  onDataChanged?: () => void
}

interface ExpenseFormData {
  name: string
  amount: string
  frequency: 'monthly' | 'yearly'
  category: string
}

const defaultFormData: ExpenseFormData = {
  name: '',
  amount: '',
  frequency: 'monthly',
  category: 'other'
}

export function FixedExpenses({ userId, showSuccess, onDataChanged }: FixedExpensesProps) {
  const [expenses, setExpenses] = useState<AppFixedExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ExpenseFormData>(defaultFormData)
  const [saving, setSaving] = useState(false)
  const { confirm, alert } = useConfirm()

  // Memoize supabase client to prevent unnecessary re-renders
  const supabase = useMemo(() => createClient(), [])

  // Load expenses
  useEffect(() => {
    const loadExpenses = async () => {
      if (!userId) {
        setLoading(false)
        return
      }
      
      try {
        const { data, error } = await supabase
          .from('dyia_fixed_expenses')
          .select('*')
          .eq('user_id', userId)
          .order('is_active', { ascending: false }) // Active first
          .order('created_at', { ascending: false })

        if (error) throw error

        if (data) {
          setExpenses(data.map(e => ({
            id: e.id,
            name: e.name,
            amount: parseFloat(e.amount) || 0,
            frequency: e.frequency as 'monthly' | 'yearly',
            category: e.category || 'other',
            isActive: e.is_active
          })))
        }
      } catch (error) {
        console.error('Error loading expenses:', error)
      } finally {
        setLoading(false)
      }
    }

    loadExpenses()
  }, [userId, supabase])

  const resetForm = useCallback(() => {
    setFormData(defaultFormData)
    setEditingId(null)
    setShowForm(false)
  }, [])

  const handleEdit = useCallback((expense: AppFixedExpense) => {
    setFormData({
      name: expense.name,
      amount: expense.amount.toString(),
      frequency: expense.frequency,
      category: expense.category
    })
    setEditingId(expense.id)
    setShowForm(true)
  }, [])

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.amount) {
      await alert({ title: 'Missing Fields', message: 'Please fill in all required fields.', variant: 'warning' })
      return
    }

    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount < 0) {
      await alert({ title: 'Invalid Amount', message: 'Please enter a valid amount.', variant: 'warning' })
      return
    }

    setSaving(true)

    try {
      if (editingId) {
        // Update existing expense
        const { error } = await supabase
          .from('dyia_fixed_expenses')
          .update({
            name: formData.name.trim(),
            amount: amount,
            frequency: formData.frequency,
            category: formData.category
          })
          .eq('id', editingId)

        if (error) throw error

        setExpenses(expenses.map(e => 
          e.id === editingId 
            ? { ...e, name: formData.name.trim(), amount, frequency: formData.frequency, category: formData.category }
            : e
        ))
        showSuccess('Expense updated!')
        onDataChanged?.()
      } else {
        // Create new expense
        const { data, error } = await supabase
          .from('dyia_fixed_expenses')
          .insert({
            user_id: userId,
            name: formData.name.trim(),
            amount: amount,
            frequency: formData.frequency,
            category: formData.category,
            is_active: true
          })
          .select()
          .single()

        if (error) throw error

        if (data) {
          setExpenses([{
            id: data.id,
            name: data.name,
            amount: parseFloat(data.amount) || 0,
            frequency: data.frequency as 'monthly' | 'yearly',
            category: data.category || 'other',
            isActive: data.is_active
          }, ...expenses])
        }
        showSuccess('Expense added!')
        onDataChanged?.()
      }
      resetForm()
    } catch (error) {
      console.error('Error saving expense:', error)
      await alert({ title: 'Error', message: 'Error saving expense.', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: 'Delete Expense', message: 'Are you sure you want to delete this expense?', confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('dyia_fixed_expenses')
        .delete()
        .eq('id', id)

      if (error) throw error

      setExpenses(expenses.filter(e => e.id !== id))
      showSuccess('Expense deleted!')
      onDataChanged?.()
    } catch (error) {
      console.error('Error deleting expense:', error)
      await alert({ title: 'Error', message: 'Error deleting expense.', variant: 'error' })
    }
  }

  const handleToggleActive = async (expense: AppFixedExpense) => {
    try {
      const { error } = await supabase
        .from('dyia_fixed_expenses')
        .update({ is_active: !expense.isActive })
        .eq('id', expense.id)

      if (error) throw error

      setExpenses(expenses.map(e => 
        e.id === expense.id ? { ...e, isActive: !e.isActive } : e
      ))
      showSuccess(expense.isActive ? 'Expense paused' : 'Expense activated')
      onDataChanged?.()
    } catch (error) {
      console.error('Error toggling expense:', error)
      await alert({ title: 'Error', message: 'Error updating expense.', variant: 'error' })
    }
  }

  const monthlyTotal = calculateMonthlyFixedExpenses(expenses)
  const yearlyTotal = calculateYearlyFixedExpenses(expenses)

  if (loading) {
    return (
      <div className="app-card">
        <div className="flex items-center justify-center py-8">
          <div className="loading-spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="app-card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💸</span>
          <div>
            <h3 className="font-semibold text-[var(--color-text-primary)]">Fixed Expenses</h3>
            <p className="text-sm text-[var(--color-text-muted)]">Track your recurring business costs</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="app-btn-secondary text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Expense
        </button>
      </div>

      {/* Monthly/Yearly Totals */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 rounded-xl p-4 border border-orange-100 dark:border-orange-800/30">
          <p className="text-sm text-orange-600 dark:text-orange-400 font-medium mb-1">Monthly Total</p>
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{formatCurrency(monthlyTotal)}</p>
        </div>
        <div className="bg-[var(--color-bg-subtle)] rounded-xl p-4 border border-[var(--color-border)]">
          <p className="text-sm text-[var(--color-text-muted)] font-medium mb-1">Yearly Total</p>
          <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{formatCurrency(yearlyTotal)}</p>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-[var(--color-bg-subtle)] rounded-xl p-4 mb-6 border border-[var(--color-border)]">
          <h4 className="font-medium text-[var(--color-text-primary)] mb-4">
            {editingId ? 'Edit Expense' : 'Add New Expense'}
          </h4>
          <div className="space-y-4">
            <div>
              <label className="app-label">Expense Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="app-input"
                placeholder="e.g., Truck Payment, Insurance, Software"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="app-label">Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">$</span>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="app-input pl-7"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="app-label">Frequency</label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as 'monthly' | 'yearly' })}
                  className="app-input"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>

            <div>
              <label className="app-label">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="app-input"
              >
                {Object.entries(EXPENSE_CATEGORIES).map(([key, { label, emoji }]) => (
                  <option key={key} value={key}>
                    {emoji} {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="app-btn-primary text-sm flex-1"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {editingId ? 'Update' : 'Add'} Expense
                  </>
                )}
              </button>
              <button
                onClick={resetForm}
                className="app-btn-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expenses List */}
      {expenses.length === 0 ? (
        <div className="text-center py-8 text-[var(--color-text-muted)]">
          <span className="text-4xl mb-3 block">📋</span>
          <p>No fixed expenses yet.</p>
          <p className="text-sm">Add your recurring business costs to track them.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => {
            const category = EXPENSE_CATEGORIES[expense.category] || EXPENSE_CATEGORIES.other
            const monthlyEquivalent = expense.frequency === 'yearly' 
              ? expense.amount / 12 
              : expense.amount
            
            return (
              <div 
                key={expense.id}
                className={`flex items-center gap-4 p-4 rounded-xl border transition ${
                  expense.isActive 
                    ? 'bg-[var(--color-bg-card)] border-[var(--color-border)]' 
                    : 'bg-[var(--color-bg-subtle)] border-[var(--color-border-light)] opacity-60'
                }`}
              >
                {/* Category Icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                  expense.isActive ? 'bg-orange-50 dark:bg-orange-900/30' : 'bg-slate-100 dark:bg-slate-800'
                }`}>
                  {category.emoji}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-medium truncate ${expense.isActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                      {expense.name}
                    </h4>
                    {!expense.isActive && (
                      <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {category.label} • {expense.frequency === 'yearly' ? 'Yearly' : 'Monthly'}
                    {expense.frequency === 'yearly' && (
                      <span className="text-[var(--color-text-faint)]"> ({formatCurrency(monthlyEquivalent)}/mo)</span>
                    )}
                  </p>
                </div>

                {/* Amount */}
                <div className="text-right">
                  <p className={`font-semibold ${expense.isActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                    {formatCurrency(expense.amount)}
                  </p>
                  <p className="text-xs text-[var(--color-text-faint)]">
                    {expense.frequency === 'yearly' ? '/year' : '/month'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleActive(expense)}
                    className={`p-2 rounded-lg transition ${
                      expense.isActive 
                        ? 'text-[var(--color-text-faint)] hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30'
                        : 'text-[var(--color-text-faint)] hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30'
                    }`}
                    title={expense.isActive ? 'Pause expense' : 'Activate expense'}
                  >
                    {expense.isActive ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(expense)}
                    className="p-2 text-[var(--color-text-faint)] hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                    title="Edit expense"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(expense.id)}
                    className="p-2 text-[var(--color-text-faint)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                    title="Delete expense"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tip */}
      {expenses.length > 0 && (
        <div className="mt-6 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/30 rounded-xl p-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            💡 <strong>Tip:</strong> Fixed expenses are subtracted from your net profit calculations on the dashboard. Pause expenses you&apos;re not currently paying.
          </p>
        </div>
      )}
    </div>
  )
}
