import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'dyia-files'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
function isAllowedType(mime: string): boolean {
  if (!mime) return false
  const t = mime.toLowerCase()
  return t.startsWith('image/') || t === 'application/pdf' || t.startsWith('text/') ||
    t === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || t === 'application/vnd.ms-excel'
}

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase env not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function getDyiaUserId(supabase: ReturnType<typeof getSupabase>, clerkUserId: string): Promise<string | null> {
  const { data } = await supabase
    .from('dyia_users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single()
  return (data as { id: string } | null)?.id ?? null
}

/**
 * POST: upload a file for use in Dyia chat (extraction / reference).
 * Body: multipart/form-data with field "file".
 * Returns: { url, fileName }.
 * Create a storage bucket "dyia-files" in Supabase Dashboard if needed.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabase()
    const dyiaUserId = await getDyiaUserId(supabase, clerkUserId)
    if (!dyiaUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file || !file.size) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    if (!isAllowedType(file.type || '')) {
      return NextResponse.json({ error: 'File type not allowed. Use image, PDF, CSV, or text.' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'bin'
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    const path = `${dyiaUserId}/${Date.now()}-${safeName}`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type })

    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: publicUrl, fileName: file.name })
  } catch (err) {
    console.error('Upload:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
