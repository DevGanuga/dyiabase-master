import { type SupabaseClient } from '@supabase/supabase-js'

/**
 * Ensure a customer record exists and return its ID.
 * If a customer with the same name exists (case-insensitive), updates contact info and returns the ID.
 * If not, creates a new customer record and returns the new ID.
 *
 * This is the SINGLE ENTRY POINT for all customer creation.
 * Every job, quote, and follow-up creation should call this FIRST.
 */
export async function ensureCustomer(
  supabase: SupabaseClient,
  userId: string,
  customerName: string,
  contactInfo?: {
    phone?: string | null
    email?: string | null
    address?: string | null
    notes?: string | null
    tags?: string[]
  }
): Promise<string> {
  if (!customerName?.trim()) {
    throw new Error('Customer name is required')
  }

  const name = customerName.trim()

  try {
    // Check for existing customer (use maybeSingle to handle 0 or 1 results without throwing)
    const { data: matches } = await supabase
      .from('dyia_customers')
      .select('id, phone, email, address')
      .eq('user_id', userId)
      .ilike('name', name)
      .limit(1)

    const existing = matches?.[0]

    if (existing) {
      const updates: Record<string, unknown> = {}
      if (contactInfo?.phone && !existing.phone) updates.phone = contactInfo.phone
      if (contactInfo?.email && !existing.email) updates.email = contactInfo.email
      if (contactInfo?.address && !existing.address) updates.address = contactInfo.address
      if (contactInfo?.notes) updates.notes = contactInfo.notes
      if (contactInfo?.tags?.length) updates.tags = contactInfo.tags

      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString()
        await supabase.from('dyia_customers').update(updates).eq('id', existing.id)
      }

      return existing.id
    }

    // Create new customer
    const { data: created, error } = await supabase
      .from('dyia_customers')
      .insert({
        user_id: userId,
        name,
        phone: contactInfo?.phone || null,
        email: contactInfo?.email || null,
        address: contactInfo?.address || null,
        notes: contactInfo?.notes || null,
        tags: contactInfo?.tags?.length ? contactInfo.tags : [],
      })
      .select('id')
      .single()

    if (error) {
      // Duplicate key = race condition, look up the winner
      if (error.code === '23505') {
        const { data: raceWinner } = await supabase
          .from('dyia_customers')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', name)
          .limit(1)
        if (raceWinner?.[0]) return raceWinner[0].id
      }
      throw error
    }

    if (!created) {
      // Insert succeeded but select-back failed (RLS issue) — try to look it up
      const { data: fallback } = await supabase
        .from('dyia_customers')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', name)
        .limit(1)
      if (fallback?.[0]) return fallback[0].id
      throw new Error('Customer created but could not retrieve ID')
    }

    return created.id
  } catch (err) {
    console.error('[ensureCustomer] Failed for:', name, err)
    throw err
  }
}

/**
 * @deprecated Use ensureCustomer() instead. Kept for backwards compat during migration.
 */
export async function upsertCustomer(
  supabase: SupabaseClient,
  userId: string,
  customerName: string,
  contactInfo?: {
    phone?: string | null
    email?: string | null
    address?: string | null
  }
): Promise<void> {
  try {
    await ensureCustomer(supabase, userId, customerName, contactInfo)
  } catch (err) {
    const error = err as { code?: string; message?: string }
    if (error.code !== '23505') {
      console.error('[Customer Upsert] Failed:', error.message || err)
    }
  }
}
