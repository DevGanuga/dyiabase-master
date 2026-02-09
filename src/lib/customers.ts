import { type SupabaseClient } from '@supabase/supabase-js'

/**
 * Upsert a customer record when a job or quote is saved.
 * If a customer with the same name exists (case-insensitive), updates contact info.
 * If not, creates a new customer record.
 * 
 * This is fire-and-forget -- failures are logged but don't block the parent operation.
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
  if (!customerName?.trim()) return

  const name = customerName.trim()

  try {
    // Check if customer already exists (case-insensitive)
    const { data: existing } = await supabase
      .from('dyia_customers')
      .select('id, phone, email, address')
      .eq('user_id', userId)
      .ilike('name', name)
      .single()

    if (existing) {
      // Update contact info if new data is provided and existing is empty
      const updates: Record<string, string> = {}
      if (contactInfo?.phone && !existing.phone) updates.phone = contactInfo.phone
      if (contactInfo?.email && !existing.email) updates.email = contactInfo.email
      if (contactInfo?.address && !existing.address) updates.address = contactInfo.address

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('dyia_customers')
          .update(updates)
          .eq('id', existing.id)
      }
    } else {
      // Create new customer
      await supabase
        .from('dyia_customers')
        .insert({
          user_id: userId,
          name,
          phone: contactInfo?.phone || null,
          email: contactInfo?.email || null,
          address: contactInfo?.address || null,
        })
    }
  } catch (err) {
    // Non-fatal: log but don't throw (duplicate key errors are expected from race conditions)
    const error = err as { code?: string; message?: string }
    if (error.code !== '23505') { // Ignore duplicate key
      console.error('[Customer Upsert] Failed:', error.message || err)
    }
  }
}
