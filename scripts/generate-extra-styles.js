/**
 * Generate extra styles for a few random famous homes
 */
import fs from 'fs';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);

// Random selection of famous homes
const HOMES = [
  { id: 'home-alone', name: 'Home Alone House', address: '671 Lincoln Ave, Winnetka, IL 60093' },
  { id: 'fresh-prince', name: 'Fresh Prince Mansion', address: '251 N Bristol Ave, Los Angeles, CA 90049' },
  { id: 'breaking-bad', name: 'Breaking Bad House', address: '3828 Piermont Dr NE, Albuquerque, NM 87111' },
  { id: 'mar-a-lago', name: 'Mar-a-Lago', address: '1100 S Ocean Blvd, Palm Beach, FL 33480' },
];

// Extra styles to generate
const STYLES = [
  { id: 'animalcrossing', prompt: 'Nintendo Animal Crossing video game style. Cute rounded 3D low-poly aesthetic, soft pastel colors, cheerful and cozy vibes, like a villager house on a tropical island.' },
  { id: 'cottagecore', prompt: 'Dreamy cottagecore aesthetic. Soft watercolor painting style, wildflowers, climbing roses, warm golden hour lighting, cozy pastoral countryside vibes, romantic and nostalgic.' },
  { id: 'crayon', prompt: 'Child\'s crayon drawing style. Thick waxy crayon strokes, bright primary colors, simple shapes, wobbly lines, construction paper texture, innocent and playful like a kindergartner\'s artwork.' },
  { id: 'openarmy', prompt: '1980s military action figure playset style, like a GI Joe or Army Men headquarters. Olive drab and camo colors, sandbags, radar dishes, observation towers, molded plastic toy aesthetic with visible seams. Product photography on white background.' },
];

async function fetchImages(address) {
  const [svRes, avRes] = await Promise.all([
    fetch(`https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(address)}&size=640x480&key=${GOOGLE_MAPS_API_KEY}`),
    fetch(`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=18&size=640x640&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`),
  ]);
  return {
    streetView: Buffer.from(await svRes.arrayBuffer()).toString('base64'),
    aerialView: Buffer.from(await avRes.arrayBuffer()).toString('base64'),
  };
}

async function extractIdentity(images) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const prompt = `Extract this building's key visual identity in 2-3 sentences. Focus on: architectural style, distinctive features, materials, colors, and setting.`;

  const svPart = { inlineData: { data: images.streetView, mimeType: 'image/jpeg' } };
  const avPart = { inlineData: { data: images.aerialView, mimeType: 'image/png' } };

  const result = await model.generateContent([prompt, svPart, avPart]);
  return (await result.response).text().trim();
}

async function generateStyle(identity, images, style) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-image',
    generationConfig: { responseModalities: ['image', 'text'] },
  });

  const prompt = `Create: ${style.prompt}

Reference building: ${identity}

Study the reference photos and recreate this specific building in the specified style. Generate now.`;

  const svPart = { inlineData: { data: images.streetView, mimeType: 'image/jpeg' } };
  const avPart = { inlineData: { data: images.aerialView, mimeType: 'image/png' } };

  const result = await model.generateContent([prompt, svPart, avPart]);
  const response = await result.response;

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return part.inlineData.data;
    }
  }
  throw new Error('No image generated');
}

const OUTPUT_DIR = './launch-assets';
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function processHome(home) {
  console.log(`\n🏠 ${home.name}`);

  try {
    console.log('  📷 Fetching images...');
    const images = await fetchImages(home.address);

    console.log('  🔍 Extracting identity...');
    const identity = await extractIdentity(images);

    for (const style of STYLES) {
      const filename = `${OUTPUT_DIR}/${home.id}-${style.id}.png`;
      // Skip if already exists
      if (fs.existsSync(filename)) {
        console.log(`  ⏭️  ${style.id} already exists, skipping`);
        continue;
      }

      console.log(`  🎨 Generating ${style.id}...`);
      try {
        const imageBase64 = await generateStyle(identity, images, style);
        fs.writeFileSync(filename, Buffer.from(imageBase64, 'base64'));
        console.log(`     ✅ ${filename}`);
      } catch (err) {
        console.log(`     ❌ ${style.id} failed: ${err.message}`);
      }
    }
  } catch (err) {
    console.log(`  ❌ Failed: ${err.message}`);
  }
}

async function main() {
  console.log('🚀 Generating extra styles for', HOMES.length, 'famous homes');
  console.log('   Styles:', STYLES.map(s => s.id).join(', '));

  for (const home of HOMES) {
    await processHome(home);
  }

  console.log('\n✅ Done! Check', OUTPUT_DIR);
}

main();
