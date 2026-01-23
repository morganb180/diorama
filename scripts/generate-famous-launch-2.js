/**
 * Generate famous homes - additional styles
 */
import fs from 'fs';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);

// Famous homes to generate
const HOMES = [
  { id: 'home-alone', name: 'Home Alone House', address: '671 Lincoln Ave, Winnetka, IL 60093' },
  { id: 'fresh-prince', name: 'Fresh Prince Mansion', address: '251 N Bristol Ave, Los Angeles, CA 90049' },
  { id: 'ferris-bueller', name: 'Ferris Bueller Glass House', address: '370 Beech St, Highland Park, IL 60035' },
  { id: 'christmas-story', name: 'A Christmas Story House', address: '3159 W 11th St, Cleveland, OH 44109' },
  { id: 'mrs-doubtfire', name: 'Mrs. Doubtfire House', address: '2640 Steiner St, San Francisco, CA 94115' },
  { id: 'goonies', name: 'Goonies House', address: '368 38th St, Astoria, OR 97103' },
  { id: 'breaking-bad', name: 'Breaking Bad House', address: '3828 Piermont Dr NE, Albuquerque, NM 87111' },
  { id: 'sopranos', name: 'Sopranos House', address: '14 Aspen Dr, North Caldwell, NJ 07006' },
  { id: 'stranger-things', name: 'Stranger Things Byers House', address: '2530 Piney Wood Ln, East Point, GA 30344' },
  { id: 'mar-a-lago', name: 'Mar-a-Lago', address: '1100 S Ocean Blvd, Palm Beach, FL 33480' },
  { id: 'eames-house', name: 'Eames House', address: '203 N Chautauqua Blvd, Pacific Palisades, CA 90272' },
  { id: 'stahl-house', name: 'Stahl House', address: '1635 Woods Dr, Los Angeles, CA 90069' },
  { id: 'kaufmann-desert', name: 'Kaufmann Desert House', address: '470 W Vista Chino, Palm Springs, CA 92262' },
];

// Additional styles
const STYLES = [
  { id: 'lofi', prompt: 'Lo-fi hip hop anime aesthetic. Warm cozy evening, purple and orange sunset tones, soft dreamy lighting, nostalgic peaceful mood like a lo-fi music video thumbnail.' },
  { id: 'lego', prompt: 'LEGO Architecture brick-built model. Chunky LEGO bricks with visible studs, smooth ABS plastic sheen. White studio background, product photography style.' },
  { id: 'simcity', prompt: '90s SimCity-style 2.5D isometric pixel art sprite. Clean aliased edges, vibrant 16-bit colors, retro game aesthetic.' },
  { id: 'wesanderson', prompt: 'Wes Anderson film still. Perfectly symmetrical composition, pastel color palette (peachy-pink, powder blue, mint), quirky and whimsical, Grand Budapest Hotel aesthetic.' },
  { id: 'bobross', prompt: 'Bob Ross "Joy of Painting" oil painting style. Happy little trees, titanium white highlights, soft blended clouds, peaceful nature scene.' },
  { id: 'ukiyoe', prompt: 'Traditional Japanese ukiyo-e woodblock print. Flat colors, bold black outlines, Hokusai wave style, classic Japanese aesthetic.' },
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
  console.log('🚀 Generating additional styles for', HOMES.length, 'famous homes');
  console.log('   Styles:', STYLES.map(s => s.id).join(', '));

  for (const home of HOMES) {
    await processHome(home);
  }

  console.log('\n✅ Done! Check', OUTPUT_DIR);
}

main();
