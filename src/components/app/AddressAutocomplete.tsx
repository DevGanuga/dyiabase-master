'use client'

import { useEffect, useRef, useState } from 'react'
import { loadMapsLibraries, isMapsConfigured } from '@/lib/maps/loader'

export interface AddressSelection {
  address: string
  latitude: number | null
  longitude: number | null
}

interface AddressAutocompleteProps {
  value: string
  /** Fires on every keystroke (controlled input). Coordinates are cleared by the parent when the user edits a previously-selected address. */
  onChange: (address: string) => void
  /** Fires when the user picks a real place from the dropdown. Carries cached coordinates so the Maps view never has to geocode again. */
  onSelect: (selection: AddressSelection) => void
  placeholder?: string
  className?: string
  /** Skip all Google API calls (demo mode). Falls back to a plain text input. */
  disabled?: boolean
  id?: string
}

/**
 * Google Places-powered address field for the Job form.
 *
 * Replaces the plain text input so users pick a canonical address and we
 * silently capture its coordinates (Phase 1 of the Maps spec). Uses a Places
 * Autocomplete session — Google bills one session per typing burst, not per
 * keystroke. Gracefully degrades to a plain input when the API key is missing
 * or in demo mode, so the form always works.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  disabled = false,
  id,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const onSelectRef = useRef(onSelect)
  const onChangeRef = useRef(onChange)
  const [ready, setReady] = useState(false)

  // Keep the latest callbacks without re-binding the Google listener.
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  useEffect(() => {
    if (disabled || !isMapsConfigured()) return
    let cancelled = false

    loadMapsLibraries()
      .then(({ places }) => {
        if (cancelled || !inputRef.current) return
        const autocomplete = new places.Autocomplete(inputRef.current, {
          fields: ['formatted_address', 'geometry', 'name'],
          types: ['address'],
        })
        autocompleteRef.current = autocomplete
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          const address = place.formatted_address || place.name || inputRef.current?.value || ''
          const loc = place.geometry?.location
          const selection: AddressSelection = {
            address,
            latitude: loc ? loc.lat() : null,
            longitude: loc ? loc.lng() : null,
          }
          onChangeRef.current(address)
          onSelectRef.current(selection)
        })
        setReady(true)
      })
      .catch((err) => {
        console.error('Failed to load Google Maps for address autocomplete:', err)
      })

    return () => {
      cancelled = true
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
        autocompleteRef.current = null
      }
    }
  }, [disabled])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // Pressing Enter on a suggestion should select it, not submit the form.
        onKeyDown={(e) => { if (e.key === 'Enter' && ready) e.preventDefault() }}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  )
}
