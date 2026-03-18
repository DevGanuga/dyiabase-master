import { jsPDF } from 'jspdf'
import { formatCurrency, parseLocalDate } from '@/lib/utils'
import type { BusinessInfo } from '@/lib/quote-pdf'

export interface JobReceiptPdfData {
  customerName: string
  jobDate: string
  serviceAddress?: string
  jobDescription?: string
  amountPaid: number
  receiptRef?: string
  generatedAt?: Date
  photoDataUrl?: string | null
}

export function generateJobReceiptPdf(data: JobReceiptPdfData, business: BusinessInfo): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const margin = 18
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const ORANGE = '#f97316'
  const DARK = '#1e293b'
  const MUTED = '#64748b'
  const LIGHT_BG = '#fff7ed'

  const receiptRef = data.receiptRef || `R-${Date.now().toString(36).toUpperCase()}`
  const receiptDate = data.generatedAt || new Date()
  const formattedReceiptDate = receiptDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const formattedServiceDate = parseLocalDate(data.jobDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  if (business.logo) {
    try {
      const fmt = business.logo.includes('image/png') ? 'PNG' : 'JPEG'
      doc.addImage(business.logo, fmt, margin, y, 28, 28)
    } catch {
      // Ignore bad logos so receipt generation still works.
    }
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

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(ORANGE)
  doc.text('RECEIPT', pageWidth - margin, y + 8, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(MUTED)
  doc.text(`#${receiptRef}`, pageWidth - margin, y + 14, { align: 'right' })
  doc.text(formattedReceiptDate, pageWidth - margin, y + 19, { align: 'right' })
  doc.text('Paid in full', pageWidth - margin, y + 24, { align: 'right' })

  y = Math.max(contactY, y + 28) + 8

  doc.setDrawColor('#e2e8f0')
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(MUTED)
  doc.text('RECEIPT FOR', margin, y)
  y += 5

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  doc.text(data.customerName, margin, y)
  y += 7

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(MUTED)
  doc.text(`Service date: ${formattedServiceDate}`, margin, y)
  y += 5

  if (data.serviceAddress) {
    const addressLines = doc.splitTextToSize(data.serviceAddress, contentWidth)
    doc.text(addressLines, margin, y)
    y += addressLines.length * 4 + 3
  }

  if (data.jobDescription) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(MUTED)
    doc.text('JOB DESCRIPTION', margin, y)
    y += 5

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(DARK)
    const descLines = doc.splitTextToSize(data.jobDescription, contentWidth)
    doc.text(descLines, margin, y)
    y += descLines.length * 5 + 6
  }

  if (y > 235) { doc.addPage(); y = margin }

  doc.setFillColor(ORANGE)
  doc.roundedRect(margin, y, contentWidth, 26, 3, 3, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor('#ffffff')
  doc.text('TOTAL PAID', pageWidth / 2, y + 8, { align: 'center' })
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text(formatCurrency(data.amountPaid), pageWidth / 2, y + 19, { align: 'center' })
  y += 34

  if (data.photoDataUrl) {
    const imageFormat = data.photoDataUrl.includes('image/png') ? 'PNG' : 'JPEG'
    try {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(MUTED)
      doc.text('JOB PHOTO', margin, y)
      y += 5
      doc.addImage(data.photoDataUrl, imageFormat, margin, y, 72, 54)
      y += 60
    } catch {
      // Ignore invalid images so receipt generation still succeeds.
    }
  }

  if (y > 260) { doc.addPage(); y = margin }

  doc.setFillColor(LIGHT_BG)
  doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(MUTED)
  doc.text(`Thank you for choosing ${business.name || 'us'}!`, pageWidth / 2, y + 7.5, { align: 'center' })

  return doc
}

export function downloadJobReceiptPdf(data: JobReceiptPdfData, business: BusinessInfo): void {
  const doc = generateJobReceiptPdf(data, business)
  const safeName = data.customerName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
  const ref = data.receiptRef || `R-${Date.now().toString(36)}`
  doc.save(`receipt-${safeName}-${ref}.pdf`)
}
