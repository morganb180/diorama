/**
 * Generate Lo-Fi style images for famous homes gallery
 */
import fs from 'fs';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);

const HOMES = [
  { id: 'white-house', address: '1600 Pennsylvania Avenue NW, Washington, DC' },
  { id: 'fallingwater', address: '1491 Mill Run Rd, Mill Run, PA 15464' },
  { id: 'gamble-house', address: '4 Westmoreland Pl, Pasadena, CA 91103' },
  { id: 'graceland', address: '3764 Elvis Presley Blvd, Memphis, TN 38116' },
];

const LOFI_PROMPT = `Lo-fi hip hop anime aesthetic illustration. Warm cozy evening atmosphere with purple and orange sunset tones. Soft, dreamy lighting with visible warm light from windows. Anime-style rendering with gentle gradients and soft edges. Nostalgic and peaceful mood like a lo-fi music video thumbnail. Include atmospheric elements like falling leaves, soft clouds, or gentle rain.`;

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

async function extractIdentity(streetViewBase64, aerialViewBase64) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const prompt = `Extract this building's key visual identity in 2-3 sentences. Focus on: architectural style, distinctive features, materials, colors, and setting.`;

  const svPart = { inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } };
  const avPart = { inlineData: { data: aerialViewBase64, mimeType: 'image/png' } };

  const result = await model.generateContent([prompt, svPart, avPart]);
  return (await result.response).text().trim();
}

async function generateLofi(identity, images) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-image',
    generationConfig: { responseModalities: ['image', 'text'] },
  });

  const prompt = `Create a ${LOFI_PROMPT}

Reference building: ${identity}

Study the reference photos and recreate this specific building in the lo-fi anime style. Generate now.`;

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

async function main() {
  for (const home of HOMES) {
    console.log(`\n🏠 Processing ${home.id}...`);
    try {
      console.log('  📷 Fetching images...');
      const images = await fetchImages(home.address);

      console.log('  🔍 Extracting identity...');
      const identity = await extractIdentity(images.streetView, images.aerialView);

      console.log('  🎨 Generating Lo-Fi style...');
      const imageBase64 = await generateLofi(identity, images);

      const outputPath = `./public/gallery/${home.id}-lofi.png`;
      fs.writeFileSync(outputPath, Buffer.from(imageBase64, 'base64'));
      console.log(`  ✅ Saved to ${outputPath}`);
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }
}

main();
