/**
 * Test REFERENCE-BASED REBUILD approach
 *
 * Pass the actual image as VISUAL REFERENCE
 * But allow creative rebuild (not just recoloring)
 *
 * "Look at this photo. Now rebuild it as a [style] - you can change
 * perspective and texture, but the house features must match what you SEE."
 */
import fs from 'fs';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const ADDRESS = '26141 Red Corral Rd, Laguna Hills, CA 92653';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);

async function fetchStreetView() {
  console.log('📷 Fetching street view...');
  const url = `https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(ADDRESS)}&size=640x480&key=${GOOGLE_MAPS_API_KEY}`;
  const response = await fetch(url);
  return (await response.buffer()).toString('base64');
}

async function generateWithReference(streetViewBase64, styleName, prompt) {
  console.log(`\n🎨 Generating ${styleName}...`);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: { responseModalities: ['image', 'text'] },
  });

  const imagePart = { inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } };

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return { success: true, base64: part.inlineData.data };
      }
    }
    return { success: false, error: 'No image in response' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔬 Testing REFERENCE-BASED REBUILD\n');
  console.log('Strategy: Pass actual photo + ask for creative rebuild\n');

  const streetViewBase64 = await fetchStreetView();

  // Save original
  fs.writeFileSync('./generated-samples/original-streetview.jpg', Buffer.from(streetViewBase64, 'base64'));

  const styles = [
    {
      name: 'Ghibli Reference',
      file: 'ghibli-reference.png',
      prompt: `Study this photograph of a house carefully. Now create a Studio Ghibli anime painting of THIS EXACT HOUSE.

WHAT MUST MATCH THE PHOTO:
- The exact wall color you see
- The exact roof color and shape you see
- The garage door position (center), count (2), and color you see
- The window positions and styles you see
- The palm tree position (left of garage) you see
- The fence you see in front
- Every distinctive feature visible in this photo

WHAT YOU CAN CHANGE:
- Render it as a hand-painted Ghibli anime background
- Add Ghibli-style clouds and sky
- Use warm golden afternoon Ghibli lighting
- Add lush Ghibli-style vegetation details
- Make it feel like a scene from Spirited Away or Totoro

The homeowner must look at this and IMMEDIATELY recognize their house. Every architectural feature from the photo must be present and accurate. Do not invent features that aren't in the photo.`,
    },
    {
      name: 'Diorama Reference',
      file: 'diorama-reference.png',
      prompt: `Study this photograph of a house carefully. Now create a miniature architectural diorama model of THIS EXACT HOUSE.

WHAT MUST MATCH THE PHOTO:
- The exact wall color you see
- The exact roof color and shape you see
- The garage door position (center), count (2), and color you see
- The window positions and styles you see
- The palm tree position (left of garage) you see
- The fence you see in front
- Every distinctive feature visible in this photo

WHAT YOU CAN CHANGE:
- Show it as a 45° isometric miniature model
- Use realistic model materials (painted foam, tiny shingles, model grass)
- Place it on a clean studio background
- Add golden hour studio lighting
- Make it look like a high-end architectural scale model

The homeowner must look at this and IMMEDIATELY recognize their house. Every architectural feature from the photo must be present and accurate. Do not invent features that aren't in the photo.`,
    },
    {
      name: 'Wes Anderson Reference',
      file: 'wesanderson-reference.png',
      prompt: `Study this photograph of a house carefully. Now create a Wes Anderson film still of THIS EXACT HOUSE.

WHAT MUST MATCH THE PHOTO:
- The exact wall color you see (maybe shift slightly toward Wes Anderson pastels)
- The exact roof color and shape you see
- The garage door position (center), count (2), and style you see
- The window positions and styles you see
- The palm tree position (left of garage) you see
- The fence you see in front
- Every distinctive feature visible in this photo

WHAT YOU CAN CHANGE:
- Frame it with perfect Wes Anderson symmetry
- Apply his muted pastel color grading (pink, seafoam, yellow, blue tints)
- Use soft, diffused, whimsical lighting
- Make it feel like a carefully designed movie set
- Add that Grand Budapest Hotel dollhouse quality

The homeowner must look at this and IMMEDIATELY recognize their house. Every architectural feature from the photo must be present and accurate. Do not invent features that aren't in the photo.`,
    },
  ];

  for (const style of styles) {
    const result = await generateWithReference(streetViewBase64, style.name, style.prompt);

    if (result.success) {
      fs.writeFileSync(`./generated-samples/${style.file}`, Buffer.from(result.base64, 'base64'));
      console.log(`✅ ${style.name} saved`);
    } else {
      console.log(`❌ ${style.name} failed: ${result.error}`);
    }
  }

  console.log('\n📂 Compare with original-streetview.jpg');
  console.log('The features should match closely while style transforms.');
}

main().catch(console.error);
