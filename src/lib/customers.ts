import { type SupabaseClient } from '@supabase/supabase-js'

/**
 * Ensure a customer record exists and return its ID.
 * If a customer with the same name exists (case-insensitive), updates contact info and returns the ID.
 * If not, creates a new customer record and returns the new ID.
 *
 * NEVER THROWS — returns null on failure so callers can proceed without a customer_id.
 * Jobs/quotes should always save regardless of whether customer linking succeeds.
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
): Promise<string | null> {
  if (!customerName?.trim()) return null

  const name = customerName.trim()

  try {
    // Look for existing customer
    const { data: matches } = await supabase
      .from('dyia_customers')
      .select('id, phone, email, address')
      .eq('user_id', userId)
      .ilike('name', name)
      .limit(1)

    const existing = matches?.[0]

    if (existing) {
      // Merge in any new contact info
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
      if (error.code === '23505') {
        // Race condition — another insert won, look up the winner
        const { data: fallback } = await supabase
          .from('dyia_customers')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', name)
          .limit(1)
        return fallback?.[0]?.id ?? null
      }
      console.error('[ensureCustomer] Insert failed:', error.message)
      return null
    }

    return created?.id ?? null
  } catch (err) {
    console.error('[ensureCustomer] Failed for:', name, err)
    return null
  }
}

/**
 * @deprecated Use ensureCustomer() instead.
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
  await ensureCustomer(supabase, userId, customerName, contactInfo)
}
