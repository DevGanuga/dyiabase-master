import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OUTPUT_DIR = path.join(process.cwd(), 'generated-logos', 'refined');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Precise description of the existing logo so the model recreates it faithfully
const LOGO_DNA = `
THE EXISTING DYIA LOGO (recreate this faithfully, then refine):
- ICON: A compact emblem combining a bullseye TARGET with an ARROW hitting the center.
  - The overall silhouette is a rounded heart/shield shape, slightly taller than wide.
  - There are concentric curved segments forming the target rings:
    * Outermost ring: warm amber-yellow (#fbbf24)
    * Middle ring: vibrant orange (#f97316) 
    * Inner ring: coral-salmon (#fb7185)
    * Center bullseye: dark navy (#1e293b)
  - An arrow comes from the upper-left, angled diagonally, hitting dead center of the bullseye
  - The arrow has dark navy fletching/feathers (small V-shape at the tail) with red-pink tips
  - The arrow shaft is dark navy
  - All shapes have clean dark navy (#1e293b) outlines giving it a bold, illustrative look
  - The whole icon has an illustrated, slightly playful but professional quality
- WORDMARK: "dyia" in bold, heavy, dark navy (#0f172a) sans-serif text to the RIGHT of the icon
  - Lowercase, clean geometric letterforms
  - The text is vertically centered with the icon

BRAND MEANING: "dyia" comes from "día" (day in Latin/Spanish). It helps service business owners hit their daily targets. The arrow-in-bullseye represents achieving goals every day.
`;

const refinements = [
  {
    name: 'refined-1-polished',
    prompt: `${LOGO_DNA}
Create this exact logo but more polished and professional. Smoother gradients on the target rings, crisper arrow, cleaner outlines. The shapes should feel precise and intentional. "dyia" wordmark in bold dark navy sans-serif to the right. White background. 1024x1024. The text "dyia" must be spelled exactly d-y-i-a.`,
  },
  {
    name: 'refined-2-premium',
    prompt: `${LOGO_DNA}
Create this logo with a more premium, elevated feel. Keep the exact same bullseye+arrow concept and heart/shield silhouette. Make the colors richer — deeper orange, more golden amber, the coral more refined. The outlines slightly thinner and more elegant. The arrow more sleek and precise. "dyia" in a premium bold sans-serif (think Inter or SF Pro weight). White background. 1024x1024. Spell "dyia" exactly: d-y-i-a.`,
  },
  {
    name: 'refined-3-app-icon',
    prompt: `${LOGO_DNA}
Create just the ICON portion of this logo (no text), formatted as an app icon. The bullseye/target with arrow in the heart/shield silhouette, placed on a dark navy (#0f172a) rounded-square background (iOS superellipse shape). The warm orange/amber/coral target rings glow against the dark background. The arrow is crisp and dynamic. This needs to look perfect as an App Store icon. 1024x1024. No text whatsoever.`,
  },
  {
    name: 'refined-4-stacked',
    prompt: `${LOGO_DNA}
Create a STACKED version: icon centered on top, "dyia" text centered below. Same bullseye+arrow icon, same warm colors, same dark outlines. Below: "dyia" in bold dark navy sans-serif. Below that in smaller light gray: "Your Day, Decoded". White background. Vertically centered. 1024x1024. Spell "dyia" exactly: d-y-i-a.`,
  },
  {
    name: 'refined-5-dark-mode',
    prompt: `${LOGO_DNA}
Create this logo on a DARK background (#0f172a dark navy). The bullseye+arrow icon stays the same with its warm orange/amber/coral colors — they POP against the dark. The dark navy outlines on the icon become slightly lighter (#334155) so they're visible. The "dyia" wordmark changes to WHITE text instead of dark. The warm colors against the dark background should feel vibrant and alive. Horizontal layout: icon left, "dyia" right. 1024x1024. Spell "dyia" exactly: d-y-i-a.`,
  },
];

async function generate(ref, index) {
  const label = `[${index + 1}/5] ${ref.name}`;
  console.log(`⏳ ${label}...`);

  try {
    const response = await openai.images.generate({
      model: 'gpt-image-1.5',
      prompt: ref.prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    });

    const imageData = response.data[0];
    if (imageData.b64_json) {
      const buffer = Buffer.from(imageData.b64_json, 'base64');
      const filePath = path.join(OUTPUT_DIR, `${ref.name}.png`);
      fs.writeFileSync(filePath, buffer);
      console.log(`✅ ${label}`);
    } else if (imageData.url) {
      const res = await fetch(imageData.url);
      const buffer = Buffer.from(await res.arrayBuffer());
      const filePath = path.join(OUTPUT_DIR, `${ref.name}.png`);
      fs.writeFileSync(filePath, buffer);
      console.log(`✅ ${label}`);
    }
  } catch (err) {
    console.error(`❌ ${label}: ${err.message}`);
  }
}

async function main() {
  console.log('dyia Logo Refinement — gpt-image-1.5 generation');
  console.log('');
  for (let i = 0; i < refinements.length; i++) {
    await generate(refinements[i], i);
  }
  console.log('');
  console.log('Done →', OUTPUT_DIR);
}

main().catch(err => { console.error(err); process.exit(1); });
