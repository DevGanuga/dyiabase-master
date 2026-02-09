'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CustomerSuggestion {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
}

/**
 * Hook to provide customer autocomplete from the dyia_customers table.
 * Falls back to a provided name list if the DB query fails (e.g., demo mode or table not yet created).
 */
export function useCustomerAutocomplete(fallbackNames: string[] = [], isDemoMode = false) {
  const [customers, setCustomers] = useState<CustomerSuggestion[]>([])
  const [loaded, setLoaded] = useState(false)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current || isDemoMode) return
    loadedRef.current = true

    async function load() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('dyia_customers')
          .select('id, name, email, phone, address')
          .order('name', { ascending: true })

        if (error) throw error
        setCustomers((data || []).map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          address: c.address,
        })))
      } catch {
        // Fallback: build from provided names
        setCustomers(fallbackNames.map(name => ({
          id: `fallback-${name}`,
          name,
          email: null,
          phone: null,
          address: null,
        })))
      }
      setLoaded(true)
    }

    load()
  }, [isDemoMode, fallbackNames])

  // In demo mode, use fallback names
  const suggestions: CustomerSuggestion[] = isDemoMode
    ? fallbackNames.map(name => ({ id: `fb-${name}`, name, email: null, phone: null, address: null }))
    : customers

  /** Get name list for datalist */
  const nameList = suggestions.map(c => c.name)

  /** Find a customer by name (case-insensitive) and return their contact info */
  const findByName = useCallback((name: string): CustomerSuggestion | undefined => {
    const lower = name.trim().toLowerCase()
    return suggestions.find(c => c.name.toLowerCase() === lower)
  }, [suggestions])

  return { suggestions, nameList, findByName, loaded }
}
