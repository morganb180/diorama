/**
 * SIMPLE TRANSFORM - Like a Ghibli selfie
 *
 * The Ghibli selfie trend works with simple prompts.
 * Maybe we're overcomplicating this.
 *
 * Just: "Transform this house into [style]"
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

async function simpleTransform(imageBase64, styleName, prompt) {
  console.log(`\n🎨 ${styleName}...`);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: { responseModalities: ['image', 'text'] },
  });

  const imagePart = { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } };

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return { success: true, base64: part.inlineData.data };
      }
    }
    return { success: false, error: 'No image' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔬 Testing SIMPLE TRANSFORM (like Ghibli selfies)\n');

  const streetView = await fetchStreetView();
  fs.writeFileSync('./generated-samples/original-streetview.jpg', Buffer.from(streetView, 'base64'));

  // Super simple prompts - like you'd use for a selfie
  const styles = [
    {
      name: 'Ghibli Simple',
      file: 'ghibli-simple.png',
      prompt: 'Transform this house photo into Studio Ghibli anime style. Keep the exact same house, just make it look like a Ghibli movie background.',
    },
    {
      name: 'Ghibli Simple v2',
      file: 'ghibli-simple-v2.png',
      prompt: 'Ghiblify this house. Same house, Ghibli art style.',
    },
    {
      name: 'Diorama Simple',
      file: 'diorama-simple.png',
      prompt: 'Turn this house photo into a miniature diorama model. Same exact house, but as a tiny architectural model.',
    },
    {
      name: 'Wes Anderson Simple',
      file: 'wesanderson-simple.png',
      prompt: 'Make this house look like a Wes Anderson movie set. Same house, Wes Anderson aesthetic.',
    },
    {
      name: 'Pixar Simple',
      file: 'pixar-simple.png',
      prompt: 'Transform this house into Pixar animation style. Same house, Pixar look.',
    },
  ];

  for (const style of styles) {
    const result = await simpleTransform(streetView, style.name, style.prompt);
    if (result.success) {
      fs.writeFileSync(`./generated-samples/${style.file}`, Buffer.from(result.base64, 'base64'));
      console.log(`✅ ${style.name} saved`);
    } else {
      console.log(`❌ ${style.name}: ${result.error}`);
    }
  }

  console.log('\n📂 Check generated-samples/ - compare to original');
}

main().catch(console.error);
