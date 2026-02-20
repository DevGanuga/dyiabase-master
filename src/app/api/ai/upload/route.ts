import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'dyia-files'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
const TEXT_TYPES = ['text/plain', 'text/csv', 'text/tab-separated-values']
const SPREADSHEET_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
]

function isAllowedType(mime: string): boolean {
  if (!mime) return false
  const t = mime.toLowerCase()
  return t.startsWith('image/') || t === 'application/pdf' || t.startsWith('text/') ||
    SPREADSHEET_TYPES.includes(t)
}

function isImageType(mime: string): boolean {
  return IMAGE_TYPES.includes(mime.toLowerCase())
}

function isTextExtractable(mime: string, fileName: string): boolean {
  const t = mime.toLowerCase()
  const ext = fileName.toLowerCase().split('.').pop() || ''
  return TEXT_TYPES.includes(t) || ['csv', 'txt', 'tsv'].includes(ext)
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
 * Extract text content from text-based files (CSV, TXT, TSV).
 * Truncates to ~8000 chars to stay within token limits.
 */
async function extractTextContent(file: File): Promise<string | null> {
  try {
    const text = await file.text()
    const MAX_CHARS = 8000
    if (text.length > MAX_CHARS) {
      return text.slice(0, MAX_CHARS) + `\n\n... [truncated, ${text.length} total characters]`
    }
    return text
  } catch {
    return null
  }
}

/**
 * POST: upload a file for use in Dyia chat (extraction / reference).
 * Body: multipart/form-data with field "file".
 * Returns: { url, fileName, fileType, extractedContent? }.
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

    const mime = (file.type || '').toLowerCase()
    let fileType: 'image' | 'text' | 'pdf' | 'spreadsheet' | 'other' = 'other'
    let extractedContent: string | null = null

    if (isImageType(mime)) {
      fileType = 'image'
    } else if (isTextExtractable(mime, file.name)) {
      fileType = 'text'
      extractedContent = await extractTextContent(file)
    } else if (mime === 'application/pdf') {
      fileType = 'pdf'
    } else if (SPREADSHEET_TYPES.includes(mime)) {
      fileType = 'spreadsheet'
    }

    return NextResponse.json({
      url: publicUrl,
      fileName: file.name,
      fileType,
      ...(extractedContent && { extractedContent }),
    })
  } catch (err) {
    console.error('Upload:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
