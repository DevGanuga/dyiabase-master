import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OUTPUT_DIR = path.join(process.cwd(), 'generated-logos');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Brand context injected into every prompt
const BRAND_CONTEXT = `
Brand: "dyia" (lowercase, stylized). Tagline: "Your Day, Decoded."
dyia is a modern business management SaaS for hands-on service business owners — junk removal, lawn care, house cleaning, moving companies.
The brand personality is: smart but approachable, tech-forward but not cold, empowering blue-collar entrepreneurs.
The name "dyia" is short, punchy, 4 letters. It should feel premium yet accessible.
Primary brand color is a warm vibrant orange (#f97316) with amber/gold accents, but the design can incorporate complementary colors (deep navy, charcoal, white, warm grays) to create a polished, professional look.
`;

// ═══════════════════════════════════════════════════════════════
// LOGO PROMPTS — 5 distinct directions
// ═══════════════════════════════════════════════════════════════

const logoPrompts = [
  {
    name: 'logo-1-wordmark-clean',
    prompt: `${BRAND_CONTEXT}
Design a clean, modern WORDMARK logo for "dyia". 
- The word "dyia" in a custom sans-serif typeface — slightly rounded, geometric letterforms with subtle personality (like the dot of the "i" being slightly playful or the "y" having a unique descender).
- Use a rich dark charcoal (#1a1a2e) for the text on a clean white background.
- The letter "d" could have a subtle warm orange (#f97316) accent — perhaps the counter (inner space) or a small geometric detail.
- Below the wordmark in a much smaller, lighter weight font: "Your Day, Decoded"
- Style: Think Stripe, Linear, or Notion level branding quality. Premium SaaS. No clipart.
- The logo must be crisp, vector-quality, centered on a pure white background.
- Absolutely NO abstract shapes orbiting the text, no swooshes, no random decorative elements. Just beautiful typography with intentional details.
- Output: square composition, 1024x1024px.`,
  },
  {
    name: 'logo-2-icon-wordmark',
    prompt: `${BRAND_CONTEXT}
Design a COMBINATION MARK logo (icon + wordmark side by side) for "dyia".
- LEFT: A compact, geometric icon that symbolizes "decoding your day" — think a stylized calendar/clock hybrid, or an abstract "d" letterform that doubles as a productivity symbol. The icon should use a gradient from warm orange (#f97316) to amber-gold (#f59e0b).
- RIGHT: The word "dyia" in a clean, medium-weight sans-serif typeface in dark navy (#0f172a).
- The icon should be simple enough to work as a favicon/app icon on its own.
- Style: Professional SaaS brand, like HubSpot or Monday.com quality. Confident, not playful-childish.
- Clean white background, horizontally balanced composition.
- NO random decorative elements. The icon must have clear meaning and be instantly recognizable.
- Output: square composition, 1024x1024px.`,
  },
  {
    name: 'logo-3-lettermark-bold',
    prompt: `${BRAND_CONTEXT}
Design a bold LETTERMARK logo using the letter "d" for "dyia".
- A single stylized lowercase "d" that feels modern, confident, and geometric.
- The "d" should incorporate a subtle visual metaphor — perhaps the counter (bowl) of the "d" contains a subtle sunrise/horizon line suggesting a new day, or the negative space creates a forward-pointing arrow suggesting progress.
- Color: The "d" itself in a rich gradient from deep orange (#ea580c) through vibrant orange (#f97316) to warm amber (#f59e0b).
- Below the lettermark, "dyia" written small in a clean sans-serif, dark charcoal text.
- Background: clean white.
- Style: App icon quality. Think Duolingo's owl simplicity or Slack's hashtag recognizability. Bold, ownable, memorable.
- NO unnecessary flourishes, lines, or orbiting shapes.
- Output: square composition, 1024x1024px.`,
  },
  {
    name: 'logo-4-abstract-symbol',
    prompt: `${BRAND_CONTEXT}
Design a SYMBOL + WORDMARK logo for "dyia".
- The symbol should abstractly represent "decoding" and "organization" — think 4 small squares or dots arranged in a pattern (like a QR code fragment or data grid), OR interlocking geometric shapes that suggest both a calendar grid and digital intelligence.
- The symbol uses warm orange (#f97316) and deep navy (#1e293b) as a two-color combination.
- Next to or below the symbol: "dyia" in a confident, slightly wide-tracked sans-serif typeface in dark navy.
- The overall feel should be: "This is a smart tool built for real workers." Not corporate-stuffy, not startup-silly. The sweet spot of professional yet approachable.
- Clean white background.
- Think Asana's three dots, Figma's overlapping shapes, or Linear's clean mark. Simple, meaningful, ownable.
- Output: square composition, 1024x1024px.`,
  },
  {
    name: 'logo-5-stacked-modern',
    prompt: `${BRAND_CONTEXT}
Design a STACKED logo for "dyia" — icon on top, wordmark below.
- TOP: A rounded square (like an app icon shape) containing a minimal, meaningful symbol. The symbol could be: a stylized checkmark merged with a clock hand, OR a simplified "d" with a subtle spark/dot suggesting AI intelligence. The rounded square uses a gradient from vibrant orange (#f97316) to warm coral-orange (#fb923c), with the symbol knocked out in white.
- BOTTOM: "dyia" in a clean, modern sans-serif typeface in dark charcoal (#18181b). Optionally "Your Day, Decoded" in a very small, light gray font below.
- The rounded-square icon should work perfectly as a standalone app icon.
- Style: Apple-level design polish. Think the quality of logos for Notion, Things 3, or Fantastical.
- Clean white background, vertically centered.
- Output: square composition, 1024x1024px.`,
  },
];

// ═══════════════════════════════════════════════════════════════
// AGENT ICON PROMPTS — 5 distinct AI assistant avatar styles
// ═══════════════════════════════════════════════════════════════

const agentIconPrompts = [
  {
    name: 'agent-1-friendly-avatar',
    prompt: `${BRAND_CONTEXT}
Design an AI AGENT AVATAR icon for "Dyia" — the AI assistant inside the dyia app.
- A friendly, approachable circular avatar of an abstract humanoid AI face. NOT a realistic human — more like a stylized, geometric face with:
  - Simple dot eyes that feel warm and attentive
  - A subtle smile or neutral-friendly expression
  - Clean geometric head shape (rounded, not angular/scary)
- Color palette: Face/head in warm orange (#f97316) to amber gradient, with white facial features. Background: soft dark navy (#1e293b) circle or clean white.
- The avatar should feel like a helpful AI colleague, not a robot. Think: smart, warm, trustworthy.
- Style: Similar to the quality of Duolingo's Duo owl or Notion's avatar illustrations — simple, iconic, instantly recognizable at 32px.
- This will be used at small sizes (32-64px) in chat interfaces, so keep it SIMPLE and bold.
- Output: square composition, 1024x1024px, centered.`,
  },
  {
    name: 'agent-2-spark-brain',
    prompt: `${BRAND_CONTEXT}
Design an AI AGENT ICON for the dyia AI assistant.
- A glowing, stylized brain or lightbulb shape combined with a subtle spark/lightning element — representing AI intelligence that lights up your business day.
- The icon should feel energetic and smart, like a "eureka moment" captured in a symbol.
- Color: Warm orange core (#f97316) with radiating amber-gold (#fbbf24) glow effects, on a deep navy (#0f172a) circular background.
- The brain/bulb shape should be HEAVILY simplified — think 5-6 strokes maximum. Not anatomical. More like an iconic symbol.
- Style: Tech-forward, premium. Like an AI feature icon you'd see in a top-tier SaaS product.
- Must be recognizable at small sizes (32-64px). Bold shapes, high contrast.
- Output: square composition, 1024x1024px, centered.`,
  },
  {
    name: 'agent-3-chat-personality',
    prompt: `${BRAND_CONTEXT}
Design an AI AGENT ICON for the dyia AI chat assistant.
- A speech/chat bubble with personality — the bubble itself IS the character. Think: a rounded chat bubble shape with two small dot-eyes and maybe a tiny expression, making the bubble feel alive and sentient.
- The bubble is warm orange (#f97316) with white eyes/details.
- The bubble could have a small sparkle or star accent near it suggesting AI/magic capability.
- Set on a clean white background or very subtle light warm gray.
- The vibe: "I'm a smart chat companion who actually helps you make money." Friendly but competent, not childish.
- Think: the personality of Clippy reimagined as a premium, modern, actually-useful AI.
- Must read well at 32-64px. Simple shapes, bold contrast.
- Output: square composition, 1024x1024px, centered.`,
  },
  {
    name: 'agent-4-geometric-bot',
    prompt: `${BRAND_CONTEXT}
Design a GEOMETRIC AI AGENT ICON for the dyia assistant.
- A minimal, geometric robot/AI face constructed from basic shapes — circles, rounded rectangles, simple lines.
- The face should have: two circular or rounded-square "eyes" (perhaps with a subtle glow or gradient), and a simple rectangular or rounded body/head shape.
- Color scheme: The face/head in white or very light gray, with orange (#f97316) accents (glowing eyes, a stripe, or antenna detail). Set against a dark navy (#1e293b) rounded-square background (app-icon style).
- The aesthetic: Clean, confident, technical but not cold. Like an AI icon from a premium productivity app.
- Think: GitHub Copilot's icon simplicity, or the ChatGPT sparkle icon's level of polish.
- Must work great at 24-64px sizes. Ultra-clean edges, no unnecessary detail.
- Output: square composition, 1024x1024px, centered.`,
  },
  {
    name: 'agent-5-minimal-d-ai',
    prompt: `${BRAND_CONTEXT}
Design a MINIMAL AI AGENT ICON that combines the letter "d" (for dyia) with an AI motif.
- The lowercase letter "d" stylized with a subtle AI element — perhaps:
  - The bowl of the "d" contains a small neural-network pattern or constellation of connected dots
  - OR the "d" has a subtle sparkle/star replacing its tittle or emerging from it
  - OR the "d" is formed by smart, circuit-like paths that feel both organic and digital
- Color: The "d" in vibrant orange (#f97316) on a dark charcoal (#18181b) circular background, OR orange on white.
- This should serve as BOTH a brand element AND an AI identity — it's the face of dyia's AI.
- Style: Exquisitely minimal. Every line serves a purpose. Think: the discipline of a Japanese logo designer meets Silicon Valley tech branding.
- Must be instantly readable as a "d" even at 24px. The AI element is a subtle cherry on top, not the focus.
- Output: square composition, 1024x1024px, centered.`,
  },
];

// ═══════════════════════════════════════════════════════════════
// Generation logic
// ═══════════════════════════════════════════════════════════════

async function generateImage(promptObj, index, type) {
  const label = `[${type} ${index + 1}/5] ${promptObj.name}`;
  console.log(`⏳ Generating ${label}...`);

  try {
    const response = await openai.images.generate({
      model: 'gpt-image-1.5',
      prompt: promptObj.prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });

    const imageData = response.data[0];

    // gpt-image-1.5 returns b64_json by default
    if (imageData.b64_json) {
      const buffer = Buffer.from(imageData.b64_json, 'base64');
      const filePath = path.join(OUTPUT_DIR, `${promptObj.name}.png`);
      fs.writeFileSync(filePath, buffer);
      console.log(`✅ Saved ${label} → ${filePath}`);
      return filePath;
    } else if (imageData.url) {
      // Fallback: download from URL
      const res = await fetch(imageData.url);
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const filePath = path.join(OUTPUT_DIR, `${promptObj.name}.png`);
      fs.writeFileSync(filePath, buffer);
      console.log(`✅ Saved ${label} → ${filePath}`);
      return filePath;
    }
  } catch (err) {
    console.error(`❌ Failed ${label}: ${err.message}`);
    if (err.error) console.error('   Details:', JSON.stringify(err.error, null, 2));
    return null;
  }
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  dyia Logo & Agent Icon Generator');
  console.log('  Model: gpt-image-1.5 | Quality: high | 1024x1024');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  // Generate logos (sequentially to respect rate limits)
  console.log('📐 GENERATING LOGOS (5 variations)...');
  console.log('─────────────────────────────────────');
  for (let i = 0; i < logoPrompts.length; i++) {
    await generateImage(logoPrompts[i], i, 'LOGO');
  }

  console.log('');
  console.log('🤖 GENERATING AGENT ICONS (5 variations)...');
  console.log('─────────────────────────────────────');
  for (let i = 0; i < agentIconPrompts.length; i++) {
    await generateImage(agentIconPrompts[i], i, 'AGENT');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  ✅ Generation complete!');
  console.log(`  📁 Output: ${OUTPUT_DIR}`);
  console.log('═══════════════════════════════════════════════════');

  // List results
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
  console.log('');
  console.log(`Generated ${files.length} images:`);
  files.forEach(f => console.log(`  • ${f}`));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
