/**
 * Test IMAGE-TO-IMAGE style transfer approach
 *
 * Instead of: describe image → generate from description
 * We try: pass actual image → restyle while preserving composition
 *
 * This is closer to what made Ghibli viral - same composition, different style.
 */
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const ADDRESS = '26141 Red Corral Rd, Laguna Hills, CA 92653';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);

async function fetchStreetView() {
  console.log('📷 Fetching street view image...');
  const url = `https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(ADDRESS)}&size=640x480&key=${GOOGLE_MAPS_API_KEY}`;
  const response = await fetch(url);
  const buffer = await response.buffer();
  return buffer.toString('base64');
}

async function testImageToImage(streetViewBase64, styleName, stylePrompt) {
  console.log(`\n🎨 Testing ${styleName} with IMAGE-TO-IMAGE approach...`);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: { responseModalities: ['image', 'text'] },
  });

  // KEY DIFFERENCE: We pass the ACTUAL IMAGE and ask to restyle it
  const prompt = `Transform this photograph into ${stylePrompt}

CRITICAL COMPOSITION REQUIREMENTS:
- Maintain the EXACT same camera angle and perspective
- Keep the house in the EXACT same position within the frame
- Preserve the EXACT proportions and scale of all elements
- The sky, house, and ground should occupy the same portions of the image
- Every architectural feature must remain in its original position
- This should look like the SAME PHOTO with a different artistic style applied

Do NOT reimagine or recompose. This is STYLE TRANSFER, not regeneration.`;

  const imagePart = {
    inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' },
  };

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return {
          success: true,
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png',
        };
      }
    }
    return { success: false, error: 'No image in response' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔬 Testing IMAGE-TO-IMAGE Style Transfer\n');
  console.log('Hypothesis: Passing the actual image to the generator');
  console.log('should preserve composition better than text descriptions.\n');

  // Fetch street view
  const streetViewBase64 = await fetchStreetView();

  // Save original for comparison
  fs.writeFileSync(
    './generated-samples/original-streetview.jpg',
    Buffer.from(streetViewBase64, 'base64')
  );
  console.log('📁 Saved original street view for comparison');

  // Test styles with image-to-image
  const styles = [
    {
      name: 'Wes Anderson (Image-to-Image)',
      file: 'wesanderson-img2img.png',
      prompt: 'a Wes Anderson film still. Apply his signature perfectly symmetrical framing, muted pastel color palette (millennial pink, seafoam, mustard yellow), soft diffused lighting, and whimsical-melancholic mood. Make it look like a carefully designed movie set while keeping EVERY architectural detail exactly where it is.',
    },
    {
      name: 'Studio Ghibli (Image-to-Image)',
      file: 'ghibli-img2img.png',
      prompt: 'a Studio Ghibli anime background painting. Apply Miyazaki\'s signature soft watercolor-like rendering, warm golden afternoon lighting, hand-painted texture, and nostalgic Japanese animation style. Keep every building, tree, and element in its EXACT original position.',
    },
  ];

  for (const style of styles) {
    const result = await testImageToImage(streetViewBase64, style.name, style.prompt);

    if (result.success) {
      const outputPath = `./generated-samples/${style.file}`;
      fs.writeFileSync(outputPath, Buffer.from(result.base64, 'base64'));
      console.log(`✅ ${style.name} saved to ${style.file}`);
    } else {
      console.log(`❌ ${style.name} failed: ${result.error}`);
    }
  }

  console.log('\n📂 Check generated-samples/ folder to compare:');
  console.log('   - original-streetview.jpg (source)');
  console.log('   - wesanderson-img2img.png (style transfer)');
  console.log('   - ghibli-img2img.png (style transfer)');
  console.log('\nLook for: Same composition? Same proportions? "Aha" moment?');
}

main().catch(console.error);
