'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const QUESTIONS: {
  id: string
  key: keyof QuizState['answers']
  title: string
  helper: string
  options: { value: string; label: string }[]
}[] = [
  {
    id: 'q1',
    key: 'q1',
    title: 'How many jobs do you typically complete per month?',
    helper: 'This helps us calculate your total opportunity for profit leaks',
    options: [
      { value: '1-20', label: '1–20 jobs' },
      { value: '21-50', label: '21–50 jobs' },
      { value: '51-100', label: '51–100 jobs' },
      { value: '100+', label: '100+ jobs' },
    ],
  },
  {
    id: 'q2',
    key: 'q2',
    title: 'How do you currently send quotes to customers?',
    helper: 'Professional quotes convert 34% better on average',
    options: [
      { value: 'A', label: 'Text message or verbal estimate' },
      { value: 'B', label: 'Email or written quote' },
      { value: 'C', label: 'Professional quote with PDF' },
      { value: 'D', label: 'I use a quoting app/software' },
    ],
  },
  {
    id: 'q3',
    key: 'q3',
    title: 'How do you follow up on quotes that don’t convert immediately?',
    helper: '60% of sales happen after the 3rd follow-up',
    options: [
      { value: 'A', label: "I don't really follow up" },
      { value: 'B', label: 'I try to remember, but it’s inconsistent' },
      { value: 'C', label: "I have a system, but it's manual" },
      { value: 'D', label: 'I have automated follow-ups' },
    ],
  },
  {
    id: 'q4',
    key: 'q4',
    title: 'Do you track expenses for each individual job?',
    helper: 'Untracked expenses hide your real profit margins',
    options: [
      { value: 'A', label: 'No' },
      { value: 'B', label: 'Sometimes' },
      { value: 'C', label: 'Yes, manually' },
      { value: 'D', label: 'Yes, with software' },
    ],
  },
  {
    id: 'q5',
    key: 'q5',
    title: 'How often do you do multiple jobs in one trip?',
    helper: 'Shared expense splitting can add $500+/month to profit',
    options: [
      { value: 'A', label: 'Rarely' },
      { value: 'B', label: 'Occasionally' },
      { value: 'C', label: 'Often' },
      { value: 'D', label: 'Frequently' },
    ],
  },
  {
    id: 'q6',
    key: 'q6',
    title: 'How do you determine your pricing?',
    helper: 'Underpricing is the #1 profit killer in junk removal',
    options: [
      { value: 'A', label: 'Guess' },
      { value: 'B', label: 'Rough mental math' },
      { value: 'C', label: 'Spreadsheet or sheet' },
      { value: 'D', label: 'Data-driven / software' },
    ],
  },
  {
    id: 'q7',
    key: 'q7',
    title: 'Do you know your profit margin from last month?',
    helper: "You can't improve what you don't measure",
    options: [
      { value: 'A', label: 'No idea' },
      { value: 'B', label: 'Rough guess' },
      { value: 'C', label: 'I run numbers later' },
      { value: 'D', label: 'Yes, in real time' },
    ],
  },
]

interface QuizState {
  currentQuestion: number
  answers: Record<string, string>
}

const STORAGE_KEY = 'dyia_quiz_answers'

export default function QuizPage() {
  const router = useRouter()
  const [state, setState] = useState<QuizState>({
    currentQuestion: 0,
    answers: {},
  })

  const current = QUESTIONS[state.currentQuestion]
  const progress = ((state.currentQuestion + 1) / QUESTIONS.length) * 100
  const canNext = current && state.answers[current.key] !== undefined
  const isLast = state.currentQuestion === QUESTIONS.length - 1

  const setAnswer = useCallback((key: string, value: string) => {
    setState((prev) => ({
      ...prev,
      answers: { ...prev.answers, [key]: value },
    }))
  }, [])

  const goNext = useCallback(() => {
    if (!canNext) return
    if (isLast) {
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.answers))
        } catch { /* ignore */ }
      }
      router.push('/profit-calculator/email')
      return
    }
    setState((prev) => ({ ...prev, currentQuestion: prev.currentQuestion + 1 }))
  }, [canNext, isLast, state.answers, router])

  const goBack = useCallback(() => {
    if (state.currentQuestion > 0) {
      setState((prev) => ({ ...prev, currentQuestion: prev.currentQuestion - 1 }))
    }
  }, [state.currentQuestion])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="sticky top-20 z-40 rounded-xl bg-white/[0.04] border border-white/10 p-3 mb-8">
        <div className="flex justify-between text-sm text-slate-400 mb-2">
          <span>Question {state.currentQuestion + 1} of {QUESTIONS.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {current && (
        <>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{current.title}</h2>
          <p className="text-slate-400 mb-8">{current.helper}</p>
          <div className="space-y-3">
            {current.options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAnswer(current.key, opt.value)}
                className={`w-full text-left px-6 py-4 rounded-xl border-2 transition-all ${
                  state.answers[current.key] === opt.value
                    ? 'bg-orange-500/10 border-orange-500 text-white'
                    : 'border-white/10 text-slate-300 hover:border-orange-500/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-4 mt-10">
            {state.currentQuestion > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="px-6 py-3 rounded-xl border border-white/20 text-slate-300 hover:bg-white/5 transition"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-orange-500/20 transition"
            >
              {isLast ? 'Get my results' : 'Next'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
