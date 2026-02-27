'use client'

import { useState, useRef, useEffect } from 'react'

export interface AnimatedDropdownOption {
  id: string
  label: string
}

export interface AnimatedDropdownProps {
  options: AnimatedDropdownOption[]
  value: string
  onChange: (id: string) => void
  placeholder: string
  label?: string
  isDark?: boolean
  className?: string
}

export function AnimatedDropdown({
  options,
  value,
  onChange,
  placeholder,
  label,
  isDark = false,
  className = '',
}: AnimatedDropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.id === value)
  const displayLabel = selectedOption?.label ?? placeholder

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (id: string) => {
    onChange(id)
    setOpen(false)
  }

  const triggerBg = isDark ? 'bg-slate-700/80 border-slate-600' : 'bg-white border-slate-200'
  const triggerHover = isDark ? 'hover:border-slate-500' : 'hover:border-orange-300'
  const triggerOpen = 'border-orange-500 ring-2 ring-orange-500/20 shadow-[0_0_0_3px_rgba(249,115,22,0.15)]'
  const panelBg = isDark ? 'bg-slate-800 border-slate-600 shadow-xl' : 'bg-white border-slate-200 shadow-xl shadow-slate-200/50'
  const optionBase = isDark
    ? 'text-slate-200 hover:bg-slate-700/80 active:bg-slate-700'
    : 'text-slate-700 hover:bg-orange-50 active:bg-orange-100'
  const optionActive = 'bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'
  const chevronColor = isDark ? 'text-slate-400' : 'text-slate-500'
  const labelColor = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className={`block text-sm mb-2 ${labelColor}`}>{label}</label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`
          w-full flex items-center justify-between gap-2 pl-4 pr-11 py-3 rounded-xl border text-left text-base
          transition-all duration-200 ease-out
          ${triggerBg} ${triggerHover}
          ${open ? triggerOpen : ''}
        `}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label || placeholder}
      >
        <span className={`transition-opacity duration-150 ${selectedOption ? '' : 'opacity-60'}`}>
          {displayLabel}
        </span>
        <span
          className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-transform duration-200 ease-out ${chevronColor} ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      <div
        className={`
          absolute left-0 right-0 top-full z-50 mt-1.5 rounded-xl border overflow-hidden
          origin-top transition-all duration-200 ease-out
          ${panelBg}
          ${open ? 'opacity-100 scale-y-100 translate-y-0' : 'opacity-0 scale-y-95 -translate-y-1 pointer-events-none'}
        `}
        role="listbox"
        aria-hidden={!open}
      >
        <ul className="py-1 max-h-56 overflow-y-auto">
          {options.map((opt, i) => {
            const isSelected = value === opt.id
            return (
              <li
                key={opt.id}
                role="option"
                aria-selected={isSelected}
                style={{
                  animation: open ? `dropdownOptionIn 0.2s ease-out ${i * 30}ms both` : undefined,
                }}
                className={`
                  px-4 py-2.5 cursor-pointer transition-colors duration-150
                  ${optionBase} ${isSelected ? optionActive : ''}
                `}
                onClick={() => handleSelect(opt.id)}
              >
                {opt.label}
              </li>
            )
          })}
        </ul>
      </div>

      <style jsx global>{`
        @keyframes dropdownOptionIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
