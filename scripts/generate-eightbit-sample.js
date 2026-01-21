/**
 * Generate 8-bit style sample for the style selector UI
 * Uses Fallingwater as the reference (same as other style samples)
 */
import fs from 'fs';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);

// Reference property - Fallingwater
const REFERENCE = {
  name: 'Fallingwater',
  address: '1491 Mill Run Rd, Mill Run, PA 15464',
};

// Crayon style
const STYLE = {
  id: 'crayon',
  prompt: `A child's crayon drawing of this house, like a middle schooler's art project.

Style requirements:
- Drawn with WAX CRAYONS on white construction paper
- Visible waxy crayon texture with uneven color fill
- Wobbly, imperfect hand-drawn lines (not straight)
- Colors slightly outside the lines
- Heavy crayon pressure in some areas, light in others
- Layered crayon strokes visible

Childlike characteristics:
- Simplified shapes and proportions
- Bright, cheerful primary colors (red, blue, yellow, green, orange)
- Sun with rays in the corner
- Fluffy cloud shapes
- Green grass drawn as a strip at the bottom
- Maybe a stick figure family or pet in the yard
- Flowers as simple circles with stems
- Birds as simple "M" shapes in the sky

The drawing should feel authentic - like something a 10-12 year old would proudly bring home from art class. Charming imperfections, not polished.`,
  useRef: true,
};

async function fetchImages() {
  console.log(`📷 Fetching reference images for ${REFERENCE.name}...`);
  const [svRes, avRes] = await Promise.all([
    fetch(`https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(REFERENCE.address)}&size=640x480&key=${GOOGLE_MAPS_API_KEY}`),
    fetch(`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(REFERENCE.address)}&zoom=18&size=640x640&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`),
  ]);
  return {
    streetView: Buffer.from(await svRes.arrayBuffer()).toString('base64'),
    aerialView: Buffer.from(await avRes.arrayBuffer()).toString('base64'),
  };
}

async function extractIdentity(streetViewBase64, aerialViewBase64) {
  console.log('🧬 Extracting building identity...');
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const prompt = `Extract this building's key visual identity in 2-3 sentences. Focus on: architectural style, distinctive features, materials, colors, and setting.`;

  const svPart = { inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } };
  const avPart = { inlineData: { data: aerialViewBase64, mimeType: 'image/png' } };

  const result = await model.generateContent([prompt, svPart, avPart]);
  return (await result.response).text().trim();
}

async function generateStyleSample(identity, images) {
  console.log('🖍️ Generating Crayon style...');
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-image',
    generationConfig: { responseModalities: ['image', 'text'] },
  });

  const prompt = `Create a ${STYLE.prompt}

Reference: ${identity}

Study the reference photos and create this building in the specified style. Generate now.`;

  const svPart = { inlineData: { data: images.streetView, mimeType: 'image/jpeg' } };
  const avPart = { inlineData: { data: images.aerialView, mimeType: 'image/png' } };
  const result = await model.generateContent([prompt, svPart, avPart]);

  const response = await result.response;
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return { success: true, base64: part.inlineData.data };
    }
  }
  return { success: false, error: 'No image in response' };
}

async function main() {
  console.log('🖍️ CRAYON STYLE SAMPLE GENERATOR\n');

  const outputDir = './public/style-samples';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const images = await fetchImages();
  const identity = await extractIdentity(images.streetView, images.aerialView);
  console.log(`   "${identity.substring(0, 100)}..."\n`);

  const result = await generateStyleSample(identity, images);

  if (result.success) {
    const outputPath = `${outputDir}/${STYLE.id}.png`;
    fs.writeFileSync(outputPath, Buffer.from(result.base64, 'base64'));
    console.log(`\n✅ Saved to ${outputPath}`);
  } else {
    console.log(`\n❌ Failed: ${result.error}`);
  }
}

main().catch(console.error);
