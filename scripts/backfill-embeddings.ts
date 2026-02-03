/**
 * Backfill Embeddings Script
 * 
 * This script generates embeddings for all existing jobs that don't have them.
 * Run this once after applying the 007_job_embeddings.sql migration.
 * 
 * Usage:
 *   npx ts-node scripts/backfill-embeddings.ts
 * 
 * Or add to package.json scripts:
 *   "backfill-embeddings": "ts-node scripts/backfill-embeddings.ts"
 * 
 * Environment variables required:
 *   - OPENAI_API_KEY
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// Configuration
const BATCH_SIZE = 10 // Process jobs in batches to avoid rate limits
const DELAY_BETWEEN_BATCHES_MS = 1000 // Wait between batches
const EMBEDDING_MODEL = 'text-embedding-3-small'

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

/**
 * Build embedding text from job data
 */
function buildJobEmbeddingText(job: {
  customer_name: string
  notes?: string | null
  source?: string | null
  revenue: number
}): string {
  const parts = [
    job.customer_name,
    job.notes || 'general job',
    job.source || 'unknown source',
    `$${job.revenue}`
  ]
  return parts.join(' - ')
}

/**
 * Generate embedding for text
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  })
  return response.data[0].embedding
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Main backfill function
 */
async function backfillEmbeddings() {
  console.log('🚀 Starting embedding backfill...\n')

  // 1. Count jobs needing embeddings
  const { count: totalCount } = await supabase
    .from('dyia_jobs')
    .select('*', { count: 'exact', head: true })
    .is('embedding', null)

  if (!totalCount || totalCount === 0) {
    console.log('✅ All jobs already have embeddings. Nothing to do.')
    return
  }

  console.log(`📊 Found ${totalCount} jobs without embeddings\n`)

  let processed = 0
  let errors = 0
  let offset = 0

  while (offset < totalCount) {
    // 2. Fetch batch of jobs without embeddings
    const { data: jobs, error: fetchError } = await supabase
      .from('dyia_jobs')
      .select('id, customer_name, notes, source, revenue')
      .is('embedding', null)
      .range(offset, offset + BATCH_SIZE - 1)

    if (fetchError) {
      console.error('❌ Error fetching jobs:', fetchError)
      break
    }

    if (!jobs || jobs.length === 0) {
      break
    }

    console.log(`\n📦 Processing batch ${Math.floor(offset / BATCH_SIZE) + 1} (${jobs.length} jobs)...`)

    // 3. Process each job in the batch
    for (const job of jobs) {
      try {
        const embeddingText = buildJobEmbeddingText({
          customer_name: job.customer_name,
          notes: job.notes,
          source: job.source,
          revenue: job.revenue
        })

        const embedding = await generateEmbedding(embeddingText)

        // 4. Update job with embedding (pgvector expects string format: '[0.1, 0.2, ...]')
        const vectorString = `[${embedding.join(',')}]`
        const { error: updateError } = await supabase
          .from('dyia_jobs')
          .update({ 
            embedding: vectorString,
            embedding_text: embeddingText 
          })
          .eq('id', job.id)

        if (updateError) {
          console.error(`  ❌ Failed to update job ${job.id}:`, updateError)
          errors++
        } else {
          processed++
          console.log(`  ✓ ${job.customer_name} (${job.id.slice(0, 8)}...)`)
        }
      } catch (err) {
        console.error(`  ❌ Error processing job ${job.id}:`, err)
        errors++
      }
    }

    // 5. Progress update
    const progress = Math.round(((offset + jobs.length) / totalCount) * 100)
    console.log(`\n📈 Progress: ${progress}% (${processed} processed, ${errors} errors)`)

    offset += BATCH_SIZE

    // 6. Rate limit protection
    if (offset < totalCount) {
      console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`)
      await sleep(DELAY_BETWEEN_BATCHES_MS)
    }
  }

  // 7. Final summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 BACKFILL COMPLETE')
  console.log('='.repeat(50))
  console.log(`✅ Successfully processed: ${processed}`)
  console.log(`❌ Errors: ${errors}`)
  console.log(`📝 Total jobs: ${totalCount}`)
  
  if (errors > 0) {
    console.log('\n⚠️  Some jobs failed to process. You may want to run this script again.')
  } else {
    console.log('\n🎉 All jobs now have embeddings! Similarity search is ready.')
  }
}

// Run the script
backfillEmbeddings()
  .catch(console.error)
  .finally(() => process.exit())
