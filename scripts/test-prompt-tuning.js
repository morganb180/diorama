/**
 * Test improved prompts for Animal Crossing, Ukiyo-e, and Bob Ross
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);

const TEST_ADDRESS = '26141 Red Corral Rd, Laguna Hills, CA 92653';

// IMPROVED PROMPTS - more stylized, less photorealistic
const IMPROVED_PROMPTS = {
  animalcrossing: {
    name: 'Animal Crossing',
    promptV2: `Animal Crossing style illustration - a soft, hand-drawn storybook scene. NOT a 3D game screenshot.

Art style requirements:
- Soft, gentle LINE ART with pastel colored outlines (not black)
- Hand-illustrated, watercolor-like quality
- Dreamy, whimsical storybook aesthetic
- Soft pastel color palette with muted tones
- Gentle gradients and soft shading

Scene composition:
- The house as the focal point in middle-ground
- 2-3 CUTE ANTHROPOMORPHIC ANIMAL VILLAGERS in the foreground (foxes, deer, cats, etc. wearing clothes)
- Lush, illustrated trees with soft, fluffy foliage surrounding the scene
- A gentle stream, pond, or river in the foreground
- Stepping stone path leading to the house
- Soft clouds and warm sunny sky
- Butterflies, birds, or falling leaves for atmosphere

The overall feeling should be cozy, peaceful, and magical - like a scene from a beloved children's book or Animal Crossing promotional art.`,
  },

  ukiyoe: {
    name: 'Ukiyo-e',
    promptV2: `Traditional Japanese ukiyo-e woodblock print in the style of Hokusai and Hiroshige. Create a COMPLETE COMPOSITION, not just the house.

REQUIRED elements:
- The house as the central subject but integrated into a larger scene
- Mount Fuji or mountains visible in the distant background
- Traditional Japanese figures in period clothing (merchants, travelers, or townspeople) in the foreground or middle ground
- Japanese calligraphy/kanji text block on the left or right margin (artist signature style)
- Decorative cartouche with title text
- Stylized waves, clouds, or wind patterns
- Cherry blossoms or pine trees framing the scene

Visual style requirements:
- Flat color areas with BOLD BLACK OUTLINES (no gradients)
- Limited color palette: indigo blue, rust red, ochre yellow, sage green, cream
- Visible wood grain texture throughout
- Bokashi gradient technique on sky
- Multiple visual planes creating depth
- Edo period (1603-1868) aesthetic

This should look like it could hang in a museum next to "The Great Wave."`,
  },

  bobross: {
    name: 'Bob Ross',
    promptV2: `Bob Ross style oil painting - a naturalistic landscape scene with the house nestled organically in nature.

Painting style:
- Impressionistic oil painting with VISIBLE BRUSH STROKES
- Wet-on-wet technique with soft, blended edges
- Canvas texture visible through the paint
- Rich, warm color palette

Scene composition (IMPORTANT - naturalistic, not staged):
- The house viewed from an angle, partially obscured by trees
- ABUNDANT AUTUMN FOLIAGE - rich oranges, deep reds, golden yellows, rusty browns
- Deciduous trees with detailed fall leaves surrounding and framing the house
- A winding stream or creek flowing through the foreground
- Wildflowers, bushes, and natural ground cover
- Soft afternoon sunlight filtering through the trees
- The house should feel like it BELONGS in this natural setting

Avoid:
- Symmetrical compositions
- The house being too prominent or centered
- Sparse, empty areas
- Overly bright or saturated colors

The painting should feel like a peaceful autumn day - the kind of scene Bob would paint while talking about "happy little trees" and making you feel relaxed.`,
  },
};

async function fetchImages(address) {
  console.log('Fetching Street View and Aerial images...');

  const [svResponse, avResponse] = await Promise.all([
    fetch(`https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(address)}&size=640x480&key=${GOOGLE_MAPS_API_KEY}`),
    fetch(`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=19&size=640x640&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`),
  ]);

  const streetViewBase64 = Buffer.from(await svResponse.arrayBuffer()).toString('base64');
  const aerialViewBase64 = Buffer.from(await avResponse.arrayBuffer()).toString('base64');

  return { streetViewBase64, aerialViewBase64 };
}

async function getIdentity(streetViewBase64, aerialViewBase64) {
  console.log('Extracting house identity...');

  const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const identityPrompt = `Extract this house's IDENTITY - the features that make it instantly recognizable.

=== HOUSE IDENTITY CARD ===

**COLORS**:
- Walls: [exact shade + hex approximation]
- Roof: [exact shade + hex approximation]
- Trim/accents: [colors]
- Garage doors: [color]

**ARCHITECTURE**:
- Style: [name]
- Stories: [count]
- Roof type: [shape]

**SIGNATURE FEATURES** (the 4-5 things that make THIS house unique):
1. [most distinctive]
2. [second]
3. [third]
4. [fourth]
5. [fifth if applicable]

**FROM AERIAL** (if aerial image provided):
- Pool: [yes/no, shape, position]
- Notable backyard features: [description]

**ONE-SENTENCE IDENTITY**:
[A single sentence capturing this house's essence that would make the owner say "that's MY house!"]`;

  const imageParts = [
    { inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } },
    { inlineData: { data: aerialViewBase64, mimeType: 'image/png' } },
  ];

  const result = await visionModel.generateContent([identityPrompt, ...imageParts]);
  return (await result.response).text().trim();
}

async function generateStyle(styleId, stylePrompt, identity, streetViewBase64, aerialViewBase64, useReference = true) {
  console.log(`\nGenerating ${styleId}...`);

  const imageModel = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: { responseModalities: ['image', 'text'] },
  });

  const generationPrompt = useReference
    ? `Create a ${stylePrompt}

I'm providing:
1. TWO REFERENCE PHOTOS of the actual house (street view and aerial)
2. The house's IDENTITY CARD with its distinctive features

Use the photos to see the EXACT details. Use the identity card to know what features MUST be captured.

=== HOUSE IDENTITY ===
${identity}
=== END IDENTITY ===

YOUR TASK:
- Study the reference photos carefully
- Create the house in the specified style
- The result must be UNMISTAKABLY this specific house
- All signature features from the identity card must be visible
- The owner should immediately recognize their home

Generate now.`
    : `${stylePrompt}

=== HOUSE IDENTITY (follow this EXACTLY) ===
${identity}
=== END IDENTITY ===

Create this house based on the identity description above. Every architectural feature must match. The owner must immediately recognize their home.

Generate now.`;

  const parts = [generationPrompt];
  if (useReference) {
    parts.push({ inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } });
    parts.push({ inlineData: { data: aerialViewBase64, mimeType: 'image/png' } });
  }

  const result = await imageModel.generateContent(parts);
  const response = await result.response;

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png',
      };
    }
  }

  throw new Error('No image generated');
}

async function main() {
  const outputDir = path.join(process.cwd(), 'prompt-tuning-results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Fetch reference images
  const { streetViewBase64, aerialViewBase64 } = await fetchImages(TEST_ADDRESS);

  // Get house identity
  const identity = await getIdentity(streetViewBase64, aerialViewBase64);
  console.log('\n=== HOUSE IDENTITY ===');
  console.log(identity);
  console.log('======================\n');

  // Generate each style
  for (const [styleId, config] of Object.entries(IMPROVED_PROMPTS)) {
    try {
      // Ukiyo-e uses useReference: false for creative freedom
      const useReference = styleId !== 'ukiyoe';

      const result = await generateStyle(
        styleId,
        config.promptV2,
        identity,
        streetViewBase64,
        aerialViewBase64,
        useReference
      );

      const filename = `${styleId}-improved.png`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, Buffer.from(result.base64, 'base64'));
      console.log(`✅ Saved: ${filepath}`);
    } catch (error) {
      console.error(`❌ Failed to generate ${styleId}:`, error.message);
    }
  }

  console.log('\n🎨 All done! Check the prompt-tuning-results folder.');
}

main().catch(console.error);
