/**
 * Test CONSTRAINED CREATIVE approach
 *
 * The magic formula:
 * - STRICT: Facade details (the "that's MY house!" moment)
 * - CREATIVE: Perspective, texture, style (the "wow!" moment)
 *
 * This is NOT image-to-image (too literal)
 * This is NOT pure text generation (loses recognition)
 * This is: precise features + creative interpretation
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

async function fetchImages() {
  console.log('📷 Fetching street view and aerial view...');

  const [svRes, avRes] = await Promise.all([
    fetch(`https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(ADDRESS)}&size=640x480&key=${GOOGLE_MAPS_API_KEY}`),
    fetch(`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(ADDRESS)}&zoom=19&size=640x640&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`),
  ]);

  return {
    streetView: (await svRes.buffer()).toString('base64'),
    aerialView: (await avRes.buffer()).toString('base64'),
  };
}

async function extractFacadeManifest(streetViewBase64, aerialViewBase64) {
  console.log('\n🔍 Extracting FACADE MANIFEST (recognition features)...');

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // This prompt extracts features as STRICT CONSTRAINTS
  const prompt = `You are creating a FACADE MANIFEST for an AI artist. Extract SPECIFIC, RECOGNIZABLE features that make this house unique and identifiable.

Analyze both the STREET VIEW and AERIAL VIEW images.

Output a structured manifest in this EXACT format:

=== RECOGNITION FEATURES (MUST be exact) ===

EXTERIOR WALLS:
- Color: [be VERY specific - not "cream" but "warm ivory with slight yellow undertone" or "light terracotta beige"]
- Material: [stucco, brick, siding, etc.]

ROOF:
- Style: [hip, gable, flat, combination]
- Color: [specific - "reddish-orange terracotta" not just "tile"]
- Notable features: [dormers, skylights, multiple levels]

GARAGE:
- Position: [LEFT side, RIGHT side, CENTER - be exact]
- Door count: [number]
- Door color: [specific]
- Door style: [with/without windows, panel style]

WINDOWS:
- Style: [arched, rectangular, etc.]
- Color/frame: [specific]
- Notable pattern: [grid pattern, single pane, etc.]

FRONT DOOR & ENTRY:
- Position: [relative to garage and facade]
- Entry features: [porch, columns, steps]

LANDSCAPING ANCHORS (key recognizable elements):
- [List 2-3 distinctive trees/plants with EXACT positions like "tall palm tree LEFT of garage"]

DISTINCTIVE FEATURES (what makes this house unique):
- [Any unique architectural or design elements]

=== CREATIVE FREEDOM (artist can interpret) ===
- Perspective and camera angle
- Lighting and time of day
- Artistic texture and style
- Background and atmosphere
- Minor landscaping details

Remember: The homeowner should IMMEDIATELY recognize their house from the recognition features.`;

  const streetViewPart = { inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } };
  const aerialViewPart = { inlineData: { data: aerialViewBase64, mimeType: 'image/png' } };

  const result = await model.generateContent([prompt, streetViewPart, aerialViewPart]);
  return (await result.response).text().trim();
}

async function generateWithConstraints(manifest, styleName, styleDescription) {
  console.log(`\n🎨 Generating ${styleName} with constrained creativity...`);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: { responseModalities: ['image', 'text'] },
  });

  const prompt = `Create a ${styleDescription}

${manifest}

IMPORTANT INSTRUCTIONS:
1. The RECOGNITION FEATURES section contains NON-NEGOTIABLE details. The homeowner MUST be able to recognize their house.
2. The CREATIVE FREEDOM section is where you can be artistic with perspective, texture, and style.
3. This should create an "aha!" moment - "That's MY house, but WOW it looks amazing!"

Generate the image now.`;

  try {
    const result = await model.generateContent(prompt);
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
  console.log('🔬 Testing CONSTRAINED CREATIVE Approach\n');
  console.log('Goal: Precise recognition + Creative wow factor\n');

  const images = await fetchImages();
  const manifest = await extractFacadeManifest(images.streetView, images.aerialView);

  console.log('\n📋 FACADE MANIFEST:');
  console.log('─'.repeat(50));
  console.log(manifest);
  console.log('─'.repeat(50));

  // Save manifest for reference
  fs.writeFileSync('./generated-samples/facade-manifest.txt', manifest);

  const styles = [
    {
      name: 'Wes Anderson Constrained',
      file: 'wesanderson-constrained.png',
      description: `perfectly symmetrical Wes Anderson film still. Use his signature dollhouse-like miniature aesthetic with muted pastel color palette (millennial pink, seafoam, mustard yellow, powder blue). Soft diffused lighting, meticulous production design. The Grand Budapest Hotel aesthetic.`,
    },
    {
      name: 'Diorama Constrained',
      file: 'diorama-constrained.png',
      description: `pristine 45° isometric miniature architectural diorama model. Ultra-realistic PBR materials, golden hour lighting, clean off-white studio background. The house should look like a high-end architectural model photographed in a studio.`,
    },
    {
      name: 'Ghibli Constrained',
      file: 'ghibli-constrained.png',
      description: `Studio Ghibli/Hayao Miyazaki anime background painting. Soft watercolor-like rendering, warm golden afternoon light, puffy cumulus clouds, lush vegetation, hand-painted texture. Nostalgic Spirited Away meets My Neighbor Totoro aesthetic.`,
    },
  ];

  for (const style of styles) {
    const result = await generateWithConstraints(manifest, style.name, style.description);

    if (result.success) {
      fs.writeFileSync(`./generated-samples/${style.file}`, Buffer.from(result.base64, 'base64'));
      console.log(`✅ ${style.name} saved`);
    } else {
      console.log(`❌ ${style.name} failed: ${result.error}`);
    }
  }

  console.log('\n📂 Compare the results in generated-samples/');
  console.log('Look for: Recognition ("That\'s my house!") + Wow ("That looks amazing!")');
}

main().catch(console.error);
