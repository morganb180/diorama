/**
 * IDENTITY + VISUAL REFERENCE
 *
 * Combine:
 * 1. Structured identity/DNA (what makes this house THIS house)
 * 2. Actual images as visual reference (so AI can see the details)
 * 3. Creative rebuild in new style/perspective
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
  console.log('📷 Fetching images...');
  const [svRes, avRes] = await Promise.all([
    fetch(`https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(ADDRESS)}&size=640x480&key=${GOOGLE_MAPS_API_KEY}`),
    fetch(`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(ADDRESS)}&zoom=19&size=640x640&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`),
  ]);
  return {
    streetView: (await svRes.buffer()).toString('base64'),
    aerialView: (await avRes.buffer()).toString('base64'),
  };
}

async function extractIdentity(streetViewBase64, aerialViewBase64) {
  console.log('\n🧬 Extracting house identity...');

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `Extract this house's IDENTITY - the features that make it instantly recognizable, like extracting someone's distinctive facial features.

=== HOUSE IDENTITY CARD ===

**COLORS** (be very specific):
- Walls: [exact shade]
- Roof: [exact shade]
- Trim/accents: [colors]
- Garage doors: [color]

**ARCHITECTURE**:
- Style: [name]
- Stories: [count]
- Roof type: [shape]

**SIGNATURE FEATURES** (the 4-5 things that make THIS house unique - like distinctive facial features):
1. [most distinctive]
2. [second]
3. [third]
4. [fourth]
5. [fifth if applicable]

**FROM AERIAL** (backyard/lot features):
- Pool: [yes/no, shape, position]
- Other: [notable features]

**ONE-SENTENCE IDENTITY**:
[A single sentence capturing this house's essence that would make the owner say "that's MY house!"]`;

  const svPart = { inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } };
  const avPart = { inlineData: { data: aerialViewBase64, mimeType: 'image/png' } };

  const result = await model.generateContent([prompt, svPart, avPart]);
  return (await result.response).text().trim();
}

async function rebuildWithIdentityAndReference(identity, streetViewBase64, aerialViewBase64, styleName, stylePrompt) {
  console.log(`\n🎨 ${styleName}...`);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-image',
    generationConfig: { responseModalities: ['image', 'text'] },
  });

  // Pass BOTH the identity AND the actual images
  const prompt = `Create a ${stylePrompt}

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

Generate now.`;

  const svPart = { inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } };
  const avPart = { inlineData: { data: aerialViewBase64, mimeType: 'image/png' } };

  try {
    const result = await model.generateContent([prompt, svPart, avPart]);
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

// For styles that need color transformation freedom (like Wes Anderson), don't pass reference photos
async function rebuildFromIdentityOnly(identity, styleName, stylePrompt) {
  console.log(`\n🎨 ${styleName} (identity-only)...`);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-image',
    generationConfig: { responseModalities: ['image', 'text'] },
  });

  const prompt = `${stylePrompt}

=== HOUSE IDENTITY (follow this EXACTLY) ===
${identity}
=== END IDENTITY ===

Create this house based on the identity description above. Every architectural feature must match. The owner must immediately recognize their home.

Generate now.`;

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
  console.log('🔬 IDENTITY + VISUAL REFERENCE approach\n');

  const images = await fetchImages();
  fs.writeFileSync('./generated-samples/original-streetview.jpg', Buffer.from(images.streetView, 'base64'));

  const identity = await extractIdentity(images.streetView, images.aerialView);

  console.log('\n🧬 IDENTITY:');
  console.log(identity);
  console.log('\n');

  fs.writeFileSync('./generated-samples/house-identity-v2.txt', identity);

  const styles = [
    {
      name: 'Diorama + Ref',
      file: 'diorama-with-ref.png',
      useReference: true,
      prompt: '45-degree isometric miniature architectural diorama model. Studio photography, warm lighting, clean background. Show the house from an isometric angle revealing front, side, and roof. Include the pool in the back. Make it look like a high-end architectural scale model.',
    },
    {
      name: 'Ghibli + Ref',
      file: 'ghibli-with-ref.png',
      useReference: true,
      prompt: 'Studio Ghibli anime background painting. Reimagine this house in Miyazaki\'s world - warm afternoon sun, hand-painted textures, lush vegetation, puffy clouds. Show it from a slight angle like an establishing shot. Include all the signature features.',
    },
    {
      name: 'Wes Anderson',
      file: 'wesanderson-with-ref.png',
      useReference: false, // Don't pass photos so it can freely apply color grading
      prompt: 'Create a photorealistic Wes Anderson film still. This is a REAL photograph shot on 35mm film for a Wes Anderson movie, NOT an illustration. The house has been repainted and art-directed for the film: walls are now soft peachy-pink, the roof is dusty coral/salmon, trim is cream white. The sky is powder blue, grass is muted sage green. Perfect bilateral symmetry, house dead-center. Soft diffused golden hour lighting. Every detail is meticulously production-designed. 8K cinematic quality, sharp architectural details. The Grand Budapest Hotel aesthetic.',
    },
  ];

  for (const style of styles) {
    let result;
    if (style.useReference) {
      result = await rebuildWithIdentityAndReference(
        identity,
        images.streetView,
        images.aerialView,
        style.name,
        style.prompt
      );
    } else {
      result = await rebuildFromIdentityOnly(
        identity,
        style.name,
        style.prompt
      );
    }
    if (result.success) {
      fs.writeFileSync(`./generated-samples/${style.file}`, Buffer.from(result.base64, 'base64'));
      console.log(`✅ ${style.name} saved`);
    } else {
      console.log(`❌ ${style.name}: ${result.error}`);
    }
  }

  console.log('\n📂 Compare results in generated-samples/');
}

main().catch(console.error);
