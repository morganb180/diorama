/**
 * Test "Army Guy" style - plastic army men figurine aesthetic
 */
import fs from 'fs';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);

// Use Fallingwater for consistent style samples
const ADDRESS = '1491 Mill Run Rd, Mill Run, PA 15464';

const ARMY_PROMPT = `1980s GI Joe action figure playset style. Detailed military base headquarters with realistic colors - tan, olive, gray camo patterns. Molded plastic with painted details like a Hasbro toy playset. Features like radar dishes, sandbags, camouflage netting accents. The house transformed into a covert ops command center. Product photography on white background, like a vintage toy catalog photo.`;

async function fetchImages() {
  console.log(`📷 Fetching images for: ${ADDRESS}`);
  const [svRes, avRes] = await Promise.all([
    fetch(`https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(ADDRESS)}&size=640x480&key=${GOOGLE_MAPS_API_KEY}`),
    fetch(`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(ADDRESS)}&zoom=18&size=640x640&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`),
  ]);
  return {
    streetView: Buffer.from(await svRes.arrayBuffer()).toString('base64'),
    aerialView: Buffer.from(await avRes.arrayBuffer()).toString('base64'),
  };
}

async function extractIdentity(streetViewBase64, aerialViewBase64) {
  console.log('🔍 Extracting building identity...');
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const prompt = `Extract this building's key visual identity in 2-3 sentences. Focus on: architectural style, distinctive features, materials, colors, and setting.`;

  const svPart = { inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } };
  const avPart = { inlineData: { data: aerialViewBase64, mimeType: 'image/png' } };

  const result = await model.generateContent([prompt, svPart, avPart]);
  return (await result.response).text().trim();
}

async function generateArmyGuy(identity, images) {
  console.log('🎖️ Generating Army Guy style...');
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-image',
    generationConfig: { responseModalities: ['image', 'text'] },
  });

  const prompt = `Create a ${ARMY_PROMPT}

Reference building: ${identity}

Study the reference photos and recreate this specific house in the army men toy style. Generate now.`;

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
  try {
    const images = await fetchImages();
    const identity = await extractIdentity(images.streetView, images.aerialView);
    console.log('📝 Identity:', identity);

    const imageBase64 = await generateArmyGuy(identity, images);

    const outputPath = './test-army-guy-output.png';
    fs.writeFileSync(outputPath, Buffer.from(imageBase64, 'base64'));
    console.log(`✅ Saved to ${outputPath}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
