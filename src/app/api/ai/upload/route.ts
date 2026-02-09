import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

const BUCKET = 'dyia-files'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_EXTRACT_ROWS = 50
const MAX_EXTRACT_CHARS = 8000

function isAllowedType(mime: string): boolean {
  if (!mime) return false
  const t = mime.toLowerCase()
  return t.startsWith('image/') || t === 'application/pdf' || t.startsWith('text/') ||
    t === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || t === 'application/vnd.ms-excel' ||
    t === 'text/csv'
}

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase env not set')
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

async function getDyiaUserId(supabase: ReturnType<typeof getSupabase>, clerkUserId: string): Promise<string | null> {
  const { data } = await supabase.from('dyia_users').select('id').eq('clerk_user_id', clerkUserId).single()
  return (data as { id: string } | null)?.id ?? null
}

// ─── Content extraction by file type ───

function formatRowsAsTable(headers: string[], rows: Record<string, unknown>[]): string {
  const capped = rows.slice(0, MAX_EXTRACT_ROWS)
  const lines = [headers.join(' | '), headers.map(() => '---').join(' | ')]
  for (const row of capped) {
    lines.push(headers.map(h => String(row[h] ?? '')).join(' | '))
  }
  let result = lines.join('\n')
  if (rows.length > MAX_EXTRACT_ROWS) {
    result += `\n\n... and ${rows.length - MAX_EXTRACT_ROWS} more rows (${rows.length} total)`
  }
  return result.slice(0, MAX_EXTRACT_CHARS)
}

async function extractCSV(file: File): Promise<string | null> {
  try {
    const text = await file.text()
    const result = Papa.parse(text, { header: true, skipEmptyLines: true })
    if (!result.data || result.data.length === 0) return text.slice(0, MAX_EXTRACT_CHARS)
    const headers = result.meta.fields || Object.keys(result.data[0] as Record<string, unknown>)
    return `CSV file with ${result.data.length} rows and ${headers.length} columns:\n\n${formatRowsAsTable(headers, result.data as Record<string, unknown>[])}`
  } catch (err) {
    console.error('CSV parse error:', err)
    return null
  }
}

async function extractExcel(file: File): Promise<string | null> {
  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const results: string[] = []
    for (const sheetName of workbook.SheetNames.slice(0, 3)) { // max 3 sheets
      const sheet = workbook.Sheets[sheetName]
      const json = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]
      if (json.length === 0) continue
      const headers = Object.keys(json[0])
      results.push(`Sheet "${sheetName}" (${json.length} rows):\n\n${formatRowsAsTable(headers, json)}`)
    }
    return results.join('\n\n---\n\n').slice(0, MAX_EXTRACT_CHARS) || null
  } catch (err) {
    console.error('Excel parse error:', err)
    return null
  }
}

async function extractPDF(file: File): Promise<string | null> {
  try {
    const arrayBuf = await file.arrayBuffer()
    const data = new Uint8Array(arrayBuf)
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data })
    const result = await parser.getText()
    const text = result.text?.trim()
    if (!text) return null
    const pages = result.total || '?'
    return `PDF document (${pages} pages):\n\n${text.slice(0, MAX_EXTRACT_CHARS)}`
  } catch (err) {
    console.error('PDF parse error:', err)
    return null
  }
}

async function extractText(file: File): Promise<string | null> {
  try {
    const text = await file.text()
    return text.slice(0, MAX_EXTRACT_CHARS) || null
  } catch {
    return null
  }
}

async function extractContent(file: File): Promise<string | null> {
  const mime = (file.type || '').toLowerCase()
  const ext = file.name.split('.').pop()?.toLowerCase() || ''

  // CSV
  if (mime === 'text/csv' || ext === 'csv') {
    return extractCSV(file)
  }

  // Excel
  if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mime === 'application/vnd.ms-excel' || ext === 'xlsx' || ext === 'xls') {
    return extractExcel(file)
  }

  // PDF
  if (mime === 'application/pdf' || ext === 'pdf') {
    return extractPDF(file)
  }

  // Plain text / other text types
  if (mime.startsWith('text/') || ext === 'txt' || ext === 'md') {
    return extractText(file)
  }

  // Images — no text extraction (AI can handle URLs via vision)
  return null
}

/**
 * POST: upload a file for use in Dyia chat.
 * Extracts content from CSV, Excel, PDF, and text files.
 * Returns: { url, fileName, extractedContent }.
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
      return NextResponse.json({ error: 'File type not allowed. Use image, PDF, CSV, Excel, or text.' }, { status: 400 })
    }

    // Extract content BEFORE uploading (we need the File object)
    const extractedContent = await extractContent(file)

    // Upload to storage
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

    return NextResponse.json({
      url: publicUrl,
      fileName: file.name,
      extractedContent,
    })
  } catch (err) {
    console.error('Upload:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
