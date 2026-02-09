import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OUTPUT_DIR = path.join(process.cwd(), 'generated-logos', 'v2');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Much more focused brand brief
const BRAND = `
BRAND NAME: "dyia" — always lowercase, 4 letters.
TAGLINE: "Your Day, Decoded"
PRODUCT: Premium business management SaaS app for service businesses.
FEEL: Confident, modern, premium tech product. Think Linear, Vercel, Stripe, Notion branding quality.
The logo must look like it belongs on a Y Combinator demo day slide, not a Fiverr gig.
`;

const QUALITY_RULES = `
CRITICAL RULES:
- The text "dyia" must be PERFECTLY spelled: d-y-i-a. Four letters. No extra letters, no misspellings.
- Typography must be crisp, geometric, modern sans-serif. Think Inter, Satoshi, or Geist font families.
- NO clipart. NO stock-icon energy. NO gradients that look like 2010 web design.
- NO busy decorative elements, swooshes, or orbiting shapes.
- This must look like a real logo from a real funded tech startup.
- Vector-clean edges. Professional graphic design quality.
- Square 1024x1024 composition, perfectly centered.
`;

const logoPrompts = [
  {
    name: 'v2-logo-1-dark-wordmark',
    prompt: `${BRAND}${QUALITY_RULES}
DESIGN: A premium wordmark logo on a DARK background.
- Background: solid dark navy-black (#0a0a1a)
- The word "dyia" in white, using a clean geometric sans-serif typeface with medium weight.
- The letter "i" has its dot replaced by a small, precise orange (#f97316) diamond or square — the only color accent. Subtle but distinctive.
- Below in very small, light gray (#6b7280) text: "Your Day, Decoded"
- The overall feeling: like opening Vercel's website or Linear's landing page. Dark, premium, tech-forward.
- Generous whitespace. The logo should breathe.
`,
  },
  {
    name: 'v2-logo-2-light-wordmark',
    prompt: `${BRAND}${QUALITY_RULES}
DESIGN: A clean wordmark logo on a WHITE background.
- Background: pure white (#ffffff)
- The word "dyia" in a bold/semibold geometric sans-serif, dark charcoal-black (#111111) color.
- The letters should be slightly wide-tracked (generous letter spacing) for a premium feel.
- A single orange (#f97316) accent: the dot on the "i" is a perfect small circle in vibrant orange. That's the ONLY color. Everything else is black and white.
- No tagline, no icon. Just "dyia" with the orange dot. Nothing else.
- This is the kind of logo that goes on business cards, invoices, and login screens.
- Minimalist to the extreme. Stripe-level restraint.
`,
  },
  {
    name: 'v2-logo-3-icon-combo',
    prompt: `${BRAND}${QUALITY_RULES}
DESIGN: A combination mark — small geometric icon to the LEFT, "dyia" wordmark to the RIGHT.
- Background: pure white (#ffffff)
- ICON: A small, simple rounded square (like an app icon shape, ~40px feel) with a dark navy (#0f172a) fill. Inside the rounded square, a minimal white geometric "d" letterform — clean and abstract, not decorative. The "d" should feel like a tech product icon.
- WORDMARK: "dyia" to the right of the icon in a clean semibold sans-serif, dark navy (#0f172a).
- Optional: a thin orange (#f97316) accent line or the dot of "i" in orange.
- The icon and wordmark should be vertically centered and feel like ONE cohesive unit.
- Think: how GitHub's octocat sits next to "GitHub", or how Figma's logo sits next to "Figma".
`,
  },
  {
    name: 'v2-logo-4-app-icon-stacked',
    prompt: `${BRAND}${QUALITY_RULES}
DESIGN: Stacked logo — app icon on TOP, "dyia" text BELOW.
- Background: white (#ffffff)
- TOP: A rounded-square app icon (iOS-style superellipse shape). The icon has a solid dark navy (#0f172a) background. Inside: a stylized lowercase "d" in orange (#f97316) — geometric, modern, slightly thick stroke weight. The "d" should be simple enough to recognize at 16x16px but interesting enough to be memorable. Think of how the Notion "N" or the Linear "L" works as an app icon.
- BELOW: "dyia" in a clean, medium-weight sans-serif typeface in dark navy (#0f172a), centered under the icon.
- Small gap between icon and text.
- The icon alone should work as a favicon, app icon, or profile picture.
`,
  },
  {
    name: 'v2-logo-5-bold-dark',
    prompt: `${BRAND}${QUALITY_RULES}
DESIGN: A bold, dark, hero-section logo.
- Background: rich dark (#09090b)
- "dyia" in a large, confident, slightly heavy geometric sans-serif in white (#fafafa).
- The entire word has a very subtle warm glow/bloom behind it — not a cheesy glow effect, but like the text is softly lit from behind with a warm orange light. Think of neon signage photographed at night, but much more subtle and refined.
- The "y" descender could have a slight stylistic flair — maybe a clean angular cut instead of a curve.
- Below in small muted gray: "Your Day, Decoded"
- This is the version that goes on the landing page hero, on the pitch deck title slide, on the Product Hunt launch page.
- Moody, premium, confident. Like a poster for a tech product launch event.
`,
  },
];

async function generateImage(promptObj, index) {
  const label = `[${index + 1}/5] ${promptObj.name}`;
  console.log(`⏳ ${label}...`);

  try {
    const response = await openai.images.generate({
      model: 'gpt-image-1.5',
      prompt: promptObj.prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });

    const imageData = response.data[0];

    if (imageData.b64_json) {
      const buffer = Buffer.from(imageData.b64_json, 'base64');
      const filePath = path.join(OUTPUT_DIR, `${promptObj.name}.png`);
      fs.writeFileSync(filePath, buffer);
      console.log(`✅ ${label} → saved`);
      return filePath;
    } else if (imageData.url) {
      const res = await fetch(imageData.url);
      const buffer = Buffer.from(await res.arrayBuffer());
      const filePath = path.join(OUTPUT_DIR, `${promptObj.name}.png`);
      fs.writeFileSync(filePath, buffer);
      console.log(`✅ ${label} → saved`);
      return filePath;
    }
  } catch (err) {
    console.error(`❌ ${label}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('');
  console.log('dyia Logo Gen v2 — gpt-image-1.5 / high / 1024x1024');
  console.log('═════════════════════════════════════════════════════');
  console.log('');

  for (let i = 0; i < logoPrompts.length; i++) {
    await generateImage(logoPrompts[i], i);
  }

  console.log('');
  console.log(`Done. Output → ${OUTPUT_DIR}`);
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
  files.forEach(f => console.log(`  • ${f}`));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
