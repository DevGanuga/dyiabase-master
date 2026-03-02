import { jsPDF } from 'jspdf'
import { formatCurrency } from '@/lib/utils'

export interface QuotePdfData {
  customerName: string
  customerPhone?: string
  customerEmail?: string
  customerAddress?: string
  jobDescription?: string
  estimateLow: number
  estimateHigh: number
  lineItems?: Array<{ description: string; amount: number }>
  photos?: string[]
  createdAt?: Date
  quoteRef?: string
}

export interface BusinessInfo {
  name?: string
  phone?: string
  email?: string
  address?: string
  logo?: string | null
}

export function generateQuotePdf(data: QuotePdfData, business: BusinessInfo): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const margin = 18
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const ORANGE = '#f97316'
  const DARK = '#1e293b'
  const MUTED = '#64748b'
  const LIGHT_BG = '#fff7ed'

  const quoteRef = data.quoteRef || `Q-${Date.now().toString(36).toUpperCase()}`
  const quoteDate = data.createdAt || new Date()
  const formattedDate = quoteDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // --- Header: Logo + Business Info ---
  if (business.logo) {
    try {
      const fmt = business.logo.includes('image/png') ? 'PNG' : 'JPEG'
      doc.addImage(business.logo, fmt, margin, y, 28, 28)
    } catch { /* skip logo on error */ }
  }

  const headerX = business.logo ? margin + 34 : margin
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  doc.text(business.name || 'My Business', headerX, y + 8)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(MUTED)
  let contactY = y + 14
  if (business.phone) { doc.text(business.phone, headerX, contactY); contactY += 4 }
  if (business.email) { doc.text(business.email, headerX, contactY); contactY += 4 }
  if (business.address) { doc.text(business.address, headerX, contactY) }

  // Estimate badge (right side)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(ORANGE)
  doc.text('ESTIMATE', pageWidth - margin, y + 8, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(MUTED)
  doc.text(`#${quoteRef}`, pageWidth - margin, y + 14, { align: 'right' })
  doc.text(formattedDate, pageWidth - margin, y + 19, { align: 'right' })
  doc.text('Valid for 30 days', pageWidth - margin, y + 24, { align: 'right' })

  y = Math.max(contactY, y + 28) + 8

  // Divider
  doc.setDrawColor('#e2e8f0')
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // --- Customer Info ---
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(MUTED)
  doc.text('PREPARED FOR', margin, y)
  y += 5

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  doc.text(data.customerName, margin, y)
  y += 6

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(MUTED)
  if (data.customerPhone) { doc.text(data.customerPhone, margin, y); y += 4 }
  if (data.customerEmail) { doc.text(data.customerEmail, margin, y); y += 4 }
  if (data.customerAddress) {
    const addrLines = doc.splitTextToSize(data.customerAddress, contentWidth)
    doc.text(addrLines, margin, y)
    y += addrLines.length * 4
  }
  y += 6

  // --- Scope of Work ---
  if (data.jobDescription) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(MUTED)
    doc.text('SCOPE OF WORK', margin, y)
    y += 5

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(DARK)
    const descLines = doc.splitTextToSize(data.jobDescription, contentWidth)
    for (const line of descLines) {
      if (y > 270) { doc.addPage(); y = margin }
      doc.text(line, margin, y)
      y += 5
    }
    y += 6
  }

  // --- Line Items / Pricing Breakdown ---
  if (data.lineItems && data.lineItems.length > 0) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(MUTED)
    doc.text('PRICING BREAKDOWN', margin, y)
    y += 6

    let subtotal = 0
    for (const item of data.lineItems) {
      if (y > 265) { doc.addPage(); y = margin }

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(DARK)
      doc.text(item.description, margin, y)

      doc.setFont('helvetica', 'bold')
      doc.text(formatCurrency(item.amount), pageWidth - margin, y, { align: 'right' })

      // Dotted line between description and amount
      const descWidth = doc.getTextWidth(item.description)
      const amtWidth = doc.getTextWidth(formatCurrency(item.amount))
      const dotsStart = margin + descWidth + 3
      const dotsEnd = pageWidth - margin - amtWidth - 3
      if (dotsEnd > dotsStart + 5) {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor('#cbd5e1')
        const dots = '.'.repeat(Math.floor((dotsEnd - dotsStart) / 1.5))
        doc.text(dots, dotsStart, y)
      }

      subtotal += item.amount
      y += 6
    }

    // Subtotal line
    doc.setDrawColor('#e2e8f0')
    doc.line(pageWidth - margin - 50, y, pageWidth - margin, y)
    y += 5
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(DARK)
    doc.text('Subtotal', pageWidth - margin - 50, y)
    doc.text(formatCurrency(subtotal), pageWidth - margin, y, { align: 'right' })
    y += 8
  }

  // --- Estimate Range Box ---
  if (y > 240) { doc.addPage(); y = margin }

  const boxH = 28
  doc.setFillColor(ORANGE)
  doc.roundedRect(margin, y, contentWidth, boxH, 3, 3, 'F')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor('#ffffff')
  doc.text('ESTIMATED COST', pageWidth / 2, y + 8, { align: 'center' })

  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text(
    `${formatCurrency(data.estimateLow)}  –  ${formatCurrency(data.estimateHigh)}`,
    pageWidth / 2, y + 20, { align: 'center' }
  )
  y += boxH + 4

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(MUTED)
  doc.text('Final price may vary based on actual job conditions. All labor and disposal fees included.', pageWidth / 2, y, { align: 'center' })
  y += 8

  // --- Photos ---
  const validPhotos = (data.photos || []).filter(Boolean)
  if (validPhotos.length > 0) {
    if (y > 220) { doc.addPage(); y = margin }

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(MUTED)
    doc.text('JOB PHOTOS', margin, y)
    y += 5

    const photoW = 55
    const photoH = 42
    const gap = 4
    let px = margin

    for (const photo of validPhotos) {
      if (px + photoW > pageWidth - margin) {
        px = margin
        y += photoH + gap
      }
      if (y + photoH > 280) { doc.addPage(); y = margin; px = margin }

      try {
        const fmt = photo.includes('image/png') ? 'PNG' : 'JPEG'
        doc.addImage(photo, fmt, px, y, photoW, photoH)
      } catch { /* skip photo on error */ }
      px += photoW + gap
    }
    y += photoH + 8
  }

  // --- Terms ---
  if (y > 255) { doc.addPage(); y = margin }

  doc.setDrawColor('#e2e8f0')
  doc.line(margin, y, pageWidth - margin, y)
  y += 5

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(MUTED)
  doc.text('TERMS & CONDITIONS', margin, y)
  y += 4

  doc.setFont('helvetica', 'normal')
  const terms = [
    '1. This estimate is valid for 30 days from the date above.',
    '2. Final price may vary up to 10% based on actual conditions found on-site.',
    '3. Payment is due upon completion of work unless otherwise agreed.',
    '4. Price includes all labor, transportation, and standard disposal fees.',
  ]
  for (const term of terms) {
    doc.text(term, margin, y)
    y += 3.5
  }

  // --- Footer ---
  y += 4
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(MUTED)
  doc.setFillColor(LIGHT_BG)
  doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F')
  doc.text(
    `Thank you for choosing ${business.name || 'us'}!`,
    pageWidth / 2, y + 7.5, { align: 'center' }
  )

  return doc
}

export function downloadQuotePdf(data: QuotePdfData, business: BusinessInfo): void {
  const doc = generateQuotePdf(data, business)
  const safeName = data.customerName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
  const ref = data.quoteRef || `Q-${Date.now().toString(36)}`
  doc.save(`estimate-${safeName}-${ref}.pdf`)
}
