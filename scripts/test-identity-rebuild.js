/**
 * IDENTITY REBUILD approach
 *
 * Like how minifigures capture a person's essence in a new form:
 * 1. Extract the house's "DNA" / identity features
 * 2. Rebuild as a completely new 3D object in the target style
 * 3. Should be unmistakably THIS house despite new perspective
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
  console.log('📷 Fetching street view and aerial...');
  const [svRes, avRes] = await Promise.all([
    fetch(`https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(ADDRESS)}&size=640x480&key=${GOOGLE_MAPS_API_KEY}`),
    fetch(`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(ADDRESS)}&zoom=19&size=640x640&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`),
  ]);
  return {
    streetView: (await svRes.buffer()).toString('base64'),
    aerialView: (await avRes.buffer()).toString('base64'),
  };
}

async function extractHouseIdentity(streetViewBase64, aerialViewBase64) {
  console.log('\n🧬 Extracting HOUSE IDENTITY (DNA)...');

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Think of this like extracting facial features for a caricature
  const prompt = `You are extracting the IDENTITY of this house - like extracting someone's facial features to create a recognizable caricature or figurine.

Analyze BOTH images (street view and aerial) and identify what makes THIS house unique and recognizable.

=== HOUSE DNA / IDENTITY CARD ===

**COLOR SIGNATURE** (the colors that define this house):
- Primary wall color: [exact shade with description, e.g., "warm ivory cream, like vanilla ice cream"]
- Roof color: [exact shade, e.g., "terracotta orange-red, like clay pottery"]
- Accent colors: [trim, doors, etc.]

**ARCHITECTURAL DNA**:
- Style: [e.g., "California Ranch", "Mediterranean", "Spanish Colonial"]
- Stories: [number and arrangement]
- Roof shape: [distinctive roof features]

**SIGNATURE FEATURES** (the 3-4 things that make THIS house instantly recognizable, like someone's distinctive nose or hair):
1. [Most distinctive feature - e.g., "prominent 2-car garage centered on facade"]
2. [Second most distinctive - e.g., "single palm tree standing tall on the left side"]
3. [Third - e.g., "white horizontal slat fence across the front"]
4. [Fourth if applicable]

**LAYOUT FINGERPRINT** (from aerial - the unique shape/arrangement):
- House footprint shape: [L-shaped, rectangular, etc.]
- Special features: [pool location, patio, distinctive landscaping]

**THE ONE-SENTENCE IDENTITY**:
Write ONE sentence that captures this house's identity so distinctively that the owner would say "that's MY house!"
Example: "A cream-colored ranch with terracotta roof, dominated by a centered two-car garage, with a tall palm tree standing guard on the left and a white picket fence across the front."

Be specific enough that an artist could create a recognizable miniature/diorama/illustration of THIS specific house.`;

  const streetViewPart = { inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } };
  const aerialViewPart = { inlineData: { data: aerialViewBase64, mimeType: 'image/png' } };

  const result = await model.generateContent([prompt, streetViewPart, aerialViewPart]);
  return (await result.response).text().trim();
}

async function rebuildWithIdentity(identity, styleName, stylePrompt) {
  console.log(`\n🎨 Rebuilding as ${styleName}...`);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: { responseModalities: ['image', 'text'] },
  });

  const prompt = `You are creating a ${stylePrompt}

Here is the HOUSE IDENTITY you must capture:

${identity}

CRITICAL: This must be UNMISTAKABLY this specific house. Like how a Funko Pop of a celebrity is instantly recognizable - capture the ESSENCE.

- Use the EXACT colors from the identity card
- Include ALL the signature features
- The owner should look at this and immediately say "That's MY house!"

The style/perspective is creative, but the identity must be preserved perfectly.

Generate the image now.`;

  try {
    const result = await model.generateContent(prompt);
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
  console.log('🔬 Testing IDENTITY REBUILD approach\n');
  console.log('Like creating a Funko Pop - new format, but unmistakably THAT person/house\n');

  const images = await fetchImages();

  fs.writeFileSync('./generated-samples/original-streetview.jpg', Buffer.from(images.streetView, 'base64'));
  fs.writeFileSync('./generated-samples/original-aerial.jpg', Buffer.from(images.aerialView, 'base64'));

  // Extract identity
  const identity = await extractHouseIdentity(images.streetView, images.aerialView);

  console.log('\n🧬 HOUSE IDENTITY:');
  console.log('═'.repeat(60));
  console.log(identity);
  console.log('═'.repeat(60));

  fs.writeFileSync('./generated-samples/house-identity.txt', identity);

  const styles = [
    {
      name: 'Isometric Diorama',
      file: 'identity-diorama.png',
      prompt: '45-degree isometric miniature architectural diorama. Like a perfect scale model photographed in a studio with warm lighting. Show the house from an elevated isometric angle so you can see the roof, front facade, and side. Clean white/gray background.',
    },
    {
      name: 'Ghibli World',
      file: 'identity-ghibli.png',
      prompt: 'Studio Ghibli anime scene. The house reimagined as if it exists in a Miyazaki film - same house identity but with Ghibli\'s magical, hand-painted aesthetic. Warm afternoon light, puffy clouds, lush greenery. Show it from a slight angle, like an establishing shot in the movie.',
    },
    {
      name: 'Wes Anderson',
      file: 'identity-wesanderson.png',
      prompt: 'Wes Anderson film still. The house as if it\'s a meticulously designed movie set. Perfect front-facing symmetry, muted pastel color grading applied to the house\'s real colors, dollhouse-like presentation. Centered, theatrical, whimsical.',
    },
    {
      name: 'Miniature Figurine',
      file: 'identity-figurine.png',
      prompt: 'collectible miniature house figurine, like a detailed board game piece or architectural model. Slightly stylized proportions (a bit chunky/cute like a Monopoly house but detailed). Solid background, product photography style.',
    },
  ];

  for (const style of styles) {
    const result = await rebuildWithIdentity(identity, style.name, style.prompt);
    if (result.success) {
      fs.writeFileSync(`./generated-samples/${style.file}`, Buffer.from(result.base64, 'base64'));
      console.log(`✅ ${style.name} saved`);
    } else {
      console.log(`❌ ${style.name}: ${result.error}`);
    }
  }

  console.log('\n📂 Results in generated-samples/');
  console.log('The identity features should be recognizable across all styles.');
}

main().catch(console.error);
