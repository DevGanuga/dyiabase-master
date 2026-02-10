import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OUTPUT_DIR = path.join(process.cwd(), 'generated-logos', 'v4');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const logoPrompts = [
  {
    name: 'v4-logo-1',
    prompt: `Design a professional logo for "dyia" — a modern business management app for service businesses like junk removal, lawn care, and house cleaning. The app helps owners track jobs, build quotes, manage customers, and grow their business. The name is "dyia" (lowercase, four letters). Create a clean, bold, memorable logo with an icon and the word "dyia" next to it. Make it look like a real tech startup logo. White background. High quality.`,
  },
  {
    name: 'v4-logo-2',
    prompt: `Create a logo for a mobile app called "dyia". dyia is a business management tool for service professionals — people who run junk removal, landscaping, cleaning, and moving companies. It helps them log jobs, send quotes, and track profits. Design a sharp, modern logo with a strong icon mark and "dyia" text. The logo should feel trustworthy, professional, and energetic. White background.`,
  },
  {
    name: 'v4-logo-3',
    prompt: `Logo design for "dyia" — an AI-powered business assistant app for blue-collar service businesses. Think of it as the Stripe or Square for junk haulers, lawn care pros, and cleaners. The logo needs a distinctive icon that works as an app icon, plus "dyia" in bold modern text. Should feel premium but approachable. Clean white background.`,
  },
  {
    name: 'v4-logo-4',
    prompt: `Design a startup logo for "dyia". dyia stands for "Your Day, Decoded" — it's a smart business management platform that helps service business owners decode their daily operations, track revenue, and grow. Create a memorable, modern logo with a unique icon and "dyia" wordmark. The icon should work standalone as an app icon. Professional quality, white background.`,
  },
  {
    name: 'v4-logo-5',
    prompt: `Create a brand logo for "dyia", a SaaS app that helps small service business owners (junk removal, lawn care, house cleaning) manage their entire business from their phone. Features include job tracking, quote building, customer management, and AI insights. Design a distinctive, modern logo with icon + "dyia" text. It should look like it belongs on the App Store next to apps like Square, Jobber, or Housecall Pro. White background.`,
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
    } else if (imageData.url) {
      const res = await fetch(imageData.url);
      const buffer = Buffer.from(await res.arrayBuffer());
      const filePath = path.join(OUTPUT_DIR, `${promptObj.name}.png`);
      fs.writeFileSync(filePath, buffer);
      console.log(`✅ ${label} → saved`);
    }
  } catch (err) {
    console.error(`❌ ${label}: ${err.message}`);
  }
}

async function main() {
  console.log('dyia Logo Gen v4 — Simple prompts, let the model cook');
  console.log('');
  for (let i = 0; i < logoPrompts.length; i++) {
    await generateImage(logoPrompts[i], i);
  }
  console.log('');
  console.log('Done →', OUTPUT_DIR);
}

main().catch(err => { console.error(err); process.exit(1); });
