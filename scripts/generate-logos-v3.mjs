import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OUTPUT_DIR = path.join(process.cwd(), 'generated-logos', 'v3');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// The ACTUAL brand logo described precisely from the reference
const EXISTING_LOGO_DESC = `
REFERENCE LOGO TO MATCH / IMPROVE UPON:
The existing dyia logo is a COMBINATION MARK with a distinctive icon + wordmark:

ICON DESCRIPTION (this is what makes the brand):
- A stylized flame/phoenix shape that wraps around a dark navy-charcoal heart/shield form at the center
- The flame swoops upward and around from the bottom-left, curving over the top
- Color layers: deep red-orange at the base, transitioning to vibrant orange (#f97316) in the mid-body, then warm amber-yellow (#f59e0b / #fbbf24) at the outer edges and top
- Small pink/red flame tips or a tiny phoenix crest at the very top
- The dark navy (#1e293b) heart/shield shape sits inside the flame, giving the icon depth and contrast
- Inside the dark shape, there's a subtle curved accent (like a small flame reflection or swoosh) in orange
- The overall silhouette is compact, roughly circular, slightly taller than wide
- It feels ALIVE — there's movement, energy, warmth. Like a flame that's also a bird rising up.

WORDMARK:
- "dyia" in bold/heavy dark charcoal-black sans-serif, sitting to the RIGHT of the icon
- Clean, confident, slightly rounded letterforms

THE FEEL:
- Warm, energetic, hustler energy — this is a brand for hardworking service business owners
- NOT cold corporate minimalism. NOT sterile tech branding.
- Think: the warmth of Firefox's flame, the energy of a sports brand, the confidence of a tool that helps you make money
- The icon has illustrative depth — overlapping shapes, gradient colors, visual interest
`;

const QUALITY = `
CRITICAL RULES:
- "dyia" must be spelled EXACTLY: d-y-i-a (four letters, lowercase)
- The icon must be the HERO — distinctive, memorable, ownable
- Professional quality — this goes on an app store, a website hero, business cards
- Clean edges, intentional design, nothing accidental or sloppy
- 1024x1024 square, centered with breathing room
`;

// ═══════════════════════════════════════════════════════════════
// 5 LOGO VARIATIONS — all building on the existing brand direction
// ═══════════════════════════════════════════════════════════════

const logoPrompts = [
  {
    name: 'v3-logo-1-refined-combo',
    prompt: `${EXISTING_LOGO_DESC}${QUALITY}
TASK: Create a REFINED, polished version of the dyia logo described above.
- Horizontal combo mark: icon on LEFT, "dyia" wordmark on RIGHT
- The icon is the flame/phoenix wrapping around a dark shield/heart shape, exactly as described
- Make the flame shapes smoother and more refined — cleaner curves, more precise gradients
- The color palette: deep orange-red at the core, vibrant orange in the body, warm amber-gold at the edges
- The dark navy heart/shield interior should have crisp edges
- "dyia" in bold dark charcoal (#1a1a2e) sans-serif, vertically centered with the icon
- White background
- This is the HERO version — the one that goes on the website header and pitch deck
`,
  },
  {
    name: 'v3-logo-2-app-icon',
    prompt: `${EXISTING_LOGO_DESC}${QUALITY}
TASK: Create the dyia APP ICON — just the icon mark, no text.
- The flame/phoenix + dark heart/shield icon ONLY, no wordmark
- Placed inside an iOS-style rounded superellipse (app icon shape)
- The app icon background: solid dark navy (#0f172a)
- The flame/phoenix icon centered on the dark background, with the flame colors (orange, amber, red) glowing against the dark
- The icon should fill about 65-70% of the app icon space — not too small, not too cramped
- This needs to look PERFECT at app store size (1024x1024) and still be recognizable at 60x60px
- Think: the quality of the Instagram app icon, the Firefox icon, or the Duolingo icon
- Rich, vibrant colors against the dark background. The flame should feel like it's glowing.
`,
  },
  {
    name: 'v3-logo-3-stacked-tagline',
    prompt: `${EXISTING_LOGO_DESC}${QUALITY}
TASK: Create a STACKED version of the dyia logo with tagline.
- TOP: The flame/phoenix + dark heart/shield icon, centered
- MIDDLE: "dyia" in bold dark charcoal sans-serif, centered below the icon
- BOTTOM: "Your Day, Decoded" in a much smaller, lighter gray (#6b7280) font, centered below the wordmark
- White background
- Generous vertical spacing between each element
- This is the version for: landing page hero sections, app loading screens, social media profiles
- The icon should be about 2x the height of the text
`,
  },
  {
    name: 'v3-logo-4-dark-version',
    prompt: `${EXISTING_LOGO_DESC}${QUALITY}
TASK: Create the dyia logo on a DARK background.
- Background: solid rich dark (#0a0f1a)
- Horizontal combo mark: flame/phoenix icon on LEFT, "dyia" on RIGHT
- The icon flame colors stay the same (orange, amber, red) — they POP against the dark
- "dyia" wordmark in white (#f5f5f5) instead of dark charcoal
- The flame icon should feel like it's GLOWING softly against the dark background — not with a cheesy outer glow, but the warm colors naturally contrast beautifully against dark
- Below the wordmark in small muted gray (#9ca3af): "Your Day, Decoded"
- This is for: dark mode app headers, dark landing page sections, merch on dark backgrounds
`,
  },
  {
    name: 'v3-logo-5-icon-badge',
    prompt: `${EXISTING_LOGO_DESC}${QUALITY}
TASK: Create a circular BADGE/SEAL version of the dyia logo.
- A circle shape containing the full logo
- The circle has a dark navy (#0f172a) fill
- Inside: the flame/phoenix icon centered in the upper portion, with "dyia" in bold white text centered below it, all inside the circle
- The flame icon glows warm against the dark circular background
- The circle should have a very subtle thin border or slight 3D depth (like a coin or badge)
- This version works for: watermarks, social media avatars, stickers, favicon
- Think: Slack's workspace icons, Discord server icons, X/Twitter profile pictures
- Keep it readable — don't cram too much in. The icon + "dyia" text is enough.
`,
  },
];

// ═══════════════════════════════════════════════════════════════
// 5 AGENT ICON VARIATIONS — matching the brand's warm energy
// ═══════════════════════════════════════════════════════════════

const agentPrompts = [
  {
    name: 'v3-agent-1-flame-face',
    prompt: `${EXISTING_LOGO_DESC}${QUALITY}
TASK: Create an AI AGENT AVATAR that matches the dyia brand.
- Take the flame/phoenix icon from the dyia logo and give it PERSONALITY — add two small friendly white dot-eyes and a subtle smile to the dark heart/shield area, making the icon itself feel like a character
- The flame wraps around the "face" like hair or a hood
- The colors stay the same: orange flame, amber edges, dark navy face
- Set on a white or very light background
- Circle crop friendly — works as a chat avatar
- This should feel like the dyia flame came alive as a friendly AI assistant
- NOT robotic, NOT cold. Warm, approachable, like a helpful buddy made of fire
- Must work at 32-64px sizes in a chat interface
`,
  },
  {
    name: 'v3-agent-2-bot-branded',
    prompt: `${EXISTING_LOGO_DESC}${QUALITY}
TASK: Create an AI AGENT ICON that combines a friendly robot aesthetic with dyia's brand colors.
- A geometric, friendly robot/AI face (similar to the style of a clean, modern bot icon)
- The robot head uses the dyia color palette: white/light gray body, with ORANGE (#f97316) glowing eyes and orange accent details (antenna tip, stripe, ear pieces)
- Set inside a dark navy (#0f172a) rounded-square background (app icon style)
- The robot should feel warm and helpful, not cold and mechanical
- Clean geometric shapes — circles for eyes, rounded rectangle head, simple details
- The orange glow in the eyes should feel alive, like the flame energy from the dyia brand lives inside this bot
- Must be recognizable at 24-64px. Ultra clean, bold shapes.
- Think: a premium version of a friendly chatbot icon that unmistakably belongs to the dyia brand
`,
  },
  {
    name: 'v3-agent-3-flame-spark',
    prompt: `${EXISTING_LOGO_DESC}${QUALITY}
TASK: Create an AI AGENT ICON that represents dyia's AI as a "smart flame."
- Start with the flame/phoenix shape from the dyia logo
- Add a small sparkle/star element near the top of the flame — suggesting AI intelligence/magic
- The flame should feel like it contains knowledge — perhaps tiny circuit-like patterns or constellation dots subtly visible within the orange gradient
- Colors: same as the brand — orange core, amber edges, dark navy accent at the base
- On a clean white background, or inside a dark navy circle
- This icon says: "I'm the intelligence inside dyia — warm, smart, powerful"
- Compact, works at small sizes, distinctive silhouette
`,
  },
  {
    name: 'v3-agent-4-chat-flame',
    prompt: `${EXISTING_LOGO_DESC}${QUALITY}
TASK: Create an AI AGENT ICON that combines a chat bubble with the dyia flame.
- A speech/chat bubble shape, but the bubble IS made of flame — the edges ripple with fire
- The bubble uses the dyia gradient: orange to amber, with the characteristic dark navy interior visible through the bubble
- Inside the bubble: a small sparkle or "..." typing indicator in white, suggesting the AI is thinking/responding
- Below/beside the bubble: subtle flame wisps trailing off
- White background
- This represents: "the dyia AI is talking to you" — it's the chat feature icon
- Bold, warm, instantly readable. Not too complex.
- Must work at 32px as a chat avatar
`,
  },
  {
    name: 'v3-agent-5-d-flame-icon',
    prompt: `${EXISTING_LOGO_DESC}${QUALITY}
TASK: Create an AI AGENT ICON that's a stylized "d" made of flame.
- The lowercase letter "d" but constructed from flowing flame shapes — not just colored orange, but actually SHAPED like fire
- The vertical stroke of the "d" is a tall flame column
- The bowl of the "d" is a curved flame swoosh
- Colors: deep orange-red at the base transitioning to bright amber at the tips
- A small AI sparkle/star at the top of the ascender (where the flame tip is)
- Set on a dark navy (#0f172a) circular background for contrast
- This combines the brand initial with the flame motif AND the AI spark
- It's THE definitive dyia AI icon — brand letter + brand flame + AI indicator
- Crisp, works at all sizes, unmistakably "dyia"
`,
  },
];

async function generateImage(promptObj, index, type) {
  const label = `[${type} ${index + 1}/5] ${promptObj.name}`;
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
  console.log('dyia Logo Gen v3 — Flame Brand Direction');
  console.log('gpt-image-1.5 / high / 1024x1024');
  console.log('════════════════════════════════════════════');
  console.log('');

  console.log('🔥 LOGOS (5 variations based on existing flame brand)...');
  for (let i = 0; i < logoPrompts.length; i++) {
    await generateImage(logoPrompts[i], i, 'LOGO');
  }

  console.log('');
  console.log('🤖 AGENT ICONS (5 variations matching flame brand)...');
  for (let i = 0; i < agentPrompts.length; i++) {
    await generateImage(agentPrompts[i], i, 'AGENT');
  }

  console.log('');
  console.log('Done. Output →', OUTPUT_DIR);
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
  files.forEach(f => console.log(`  • ${f}`));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
