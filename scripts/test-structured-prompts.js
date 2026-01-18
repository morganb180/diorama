/**
 * STRUCTURED PROMPT APPROACH
 *
 * Adapting the "Infrastructure Loop" prompt structure for house transformations.
 * Each style follows the same semantic structure for consistency.
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
    streetView: Buffer.from(await svRes.arrayBuffer()).toString('base64'),
    aerialView: Buffer.from(await avRes.arrayBuffer()).toString('base64'),
  };
}

async function extractHouseIdentity(streetViewBase64, aerialViewBase64) {
  console.log('\n🧬 Extracting house identity...');

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Structured identity extraction (like "Forensic Analysis")
  const prompt = `You are extracting the IDENTITY of this house for an artist to recreate it in various styles.

Analyze BOTH images (street view and aerial) and output a structured identity card.

=== HOUSE IDENTITY CARD ===

**1. COLOR PALETTE**
- Primary Wall: [exact color name + hex approximation]
- Roof: [exact color name + hex approximation]
- Trim/Accents: [colors]
- Garage Doors: [color]
- Fence: [color if present]

**2. ARCHITECTURAL DNA**
- Style: [e.g., Mediterranean Ranch, Contemporary, Spanish Colonial]
- Stories: [count and arrangement]
- Roof Type: [hip, gable, flat, tile, shingle]
- Facade Width: [narrow, medium, wide]

**3. SIGNATURE FEATURES** (the 4-5 most distinctive elements - like facial features)
1. [Most distinctive - e.g., "dominant centered 2-car garage"]
2. [Second - e.g., "terracotta tile roof contrasting white walls"]
3. [Third - e.g., "small second-story window above garage peak"]
4. [Fourth - e.g., "white horizontal slat fence across front"]
5. [Fifth if applicable]

**4. SPATIAL LAYOUT**
- Garage Position: [left, center, right of facade]
- Entry Position: [visible/hidden, left/center/right]
- Driveway: [shape, material, prominence]
- Landscaping: [trees positions, lawn areas, hedges]

**5. BACKYARD (from aerial)**
- Pool: [yes/no, shape, position in lot]
- Patio: [yes/no, position]
- Notable Features: [any distinctive elements]

**6. ONE-LINE ESSENCE**
[A single sentence capturing this house's identity that would make the owner say "that's MY house!"]

Be precise. An artist must recreate this house recognizably in any style.`;

  const svPart = { inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } };
  const avPart = { inlineData: { data: aerialViewBase64, mimeType: 'image/png' } };

  const result = await model.generateContent([prompt, svPart, avPart]);
  return (await result.response).text().trim();
}

// Structured style prompts - each follows the same semantic layers
const STYLE_TEMPLATES = {
  diorama: {
    name: 'Diorama',
    file: 'structured-diorama.png',
    useReference: true,
    buildPrompt: (identity) => `
=== STYLE: Architectural Diorama Model ===

**1. IDENTITY TO PRESERVE**
${identity}

**2. GEOMETRY & PERSPECTIVE**
- View: 45-degree isometric angle (revealing front, side, and roof simultaneously)
- Scale: Miniature architectural model (1:100 scale feel)
- Framing: Full property visible including backyard, centered in frame
- Base: Model sits on a wooden or neutral display platform

**3. MATERIALS & TEXTURE**
- Walls: Painted foam board or balsa wood texture
- Roof: Tiny individual tiles or shingles, visible texture
- Lawn: Model railroad grass (static grass or flock)
- Trees: Miniature model trees (wire armature with foam foliage)
- Pool: Resin or clear acrylic with subtle blue tint
- Driveway: Fine sandpaper or painted surface

**4. ENVIRONMENT & CONTEXT**
- Setting: Clean studio environment
- Base: Wooden display platform with clean edges
- Surroundings: Minimal - focus on the house model itself
- Props: Tiny model car in driveway if space allows

**5. LIGHTING & ATMOSPHERE**
- Style: Professional product photography
- Lighting: Warm studio lights, soft shadows
- Mood: Precious, collectible, museum-quality
- Time: Neutral (no specific time of day)

**6. OUTPUT SPECIFICATIONS**
- Quality: 8K photorealistic
- Aspect: 1:1 square
- Feel: High-end architectural scale model, the kind displayed in a developer's office
- CRITICAL: Every signature feature from the identity must be visible and accurate
    `.trim(),
  },

  ghibli: {
    name: 'Studio Ghibli',
    file: 'structured-ghibli.png',
    useReference: true,
    buildPrompt: (identity) => `
=== STYLE: Studio Ghibli Anime Background ===

**1. IDENTITY TO PRESERVE**
${identity}

**2. GEOMETRY & PERSPECTIVE**
- View: Slight 3/4 angle (like an establishing shot in a Miyazaki film)
- Scale: Life-size, as if you're standing across the street
- Framing: House is the hero, fills ~60% of frame, sky visible above
- Horizon: Slightly low camera angle, looking slightly up at the house

**3. MATERIALS & TEXTURE**
- Rendering: Hand-painted watercolor/gouache texture
- Walls: Soft painted texture with subtle color variations
- Roof: Visible brushstrokes suggesting tiles
- Vegetation: Lush, detailed, lovingly rendered leaves and grass
- Sky: Signature Ghibli clouds - big, puffy, volumetric white clouds

**4. ENVIRONMENT & CONTEXT**
- Setting: Peaceful suburban neighborhood
- Vegetation: Enhanced - more lush and green than reality
- Details: Small flowers, detailed grass blades, maybe a bird or butterfly
- Background: Soft treeline, distant hills if appropriate

**5. LIGHTING & ATMOSPHERE**
- Style: Golden afternoon sun (Ghibli's signature warm light)
- Lighting: Soft shadows, warm highlights on surfaces
- Mood: Nostalgic, peaceful, "a perfect summer afternoon"
- Sky: Clear with those iconic puffy white clouds

**6. OUTPUT SPECIFICATIONS**
- Quality: High resolution anime background painting
- Aspect: 1:1 square
- Feel: Like a background from Spirited Away, Totoro, or Kiki's Delivery Service
- CRITICAL: All architectural features must be accurate to identity, rendered in Ghibli style
    `.trim(),
  },

  wesanderson: {
    name: 'Wes Anderson',
    file: 'structured-wesanderson.png',
    useReference: false, // No reference so colors can be transformed
    buildPrompt: (identity) => `
=== STYLE: Wes Anderson Film Still ===

**1. IDENTITY TO PRESERVE (but colors will be transformed)**
${identity}

**2. GEOMETRY & PERSPECTIVE**
- View: PERFECT front-facing symmetry (dead center, mathematically precise)
- Scale: Life-size, cinematic framing
- Framing: House perfectly centered, equal space on both sides
- Camera: Locked off, perfectly level, no tilt

**3. COLOR TRANSFORMATION (CRITICAL)**
- Walls: Transform to soft peachy-pink or blush
- Roof: Transform to dusty coral or muted salmon
- Trim: Cream white or soft ivory
- Sky: Powder blue or soft seafoam
- Grass: Muted sage green
- Overall: Desaturated, harmonized, vintage film stock feel

**4. ENVIRONMENT & CONTEXT**
- Setting: Meticulously manicured, nothing out of place
- Landscaping: Symmetrical if possible, or artfully balanced
- Props: Everything intentional, like a movie set
- Fence: White picket if applicable, perfectly maintained

**5. LIGHTING & ATMOSPHERE**
- Style: Soft, diffused, golden hour
- Lighting: No harsh shadows, flat but warm
- Mood: Whimsical-melancholic, precious, dollhouse-like
- Film: Shot on 35mm, slight grain, vintage color science

**6. OUTPUT SPECIFICATIONS**
- Quality: 8K photorealistic (NOT illustration - real photograph)
- Aspect: 1:1 square
- Feel: A still from The Grand Budapest Hotel or Moonrise Kingdom
- CRITICAL: Photorealistic but with complete color palette transformation
    `.trim(),
  },
};

async function generateWithStructuredPrompt(identity, streetViewBase64, aerialViewBase64, style) {
  console.log(`\n🎨 ${style.name}...`);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-image',
    generationConfig: { responseModalities: ['image', 'text'] },
  });

  const prompt = style.buildPrompt(identity);

  try {
    let result;
    if (style.useReference) {
      const svPart = { inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } };
      const avPart = { inlineData: { data: aerialViewBase64, mimeType: 'image/png' } };
      result = await model.generateContent([prompt, svPart, avPart]);
    } else {
      result = await model.generateContent(prompt);
    }

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
  console.log('🔬 STRUCTURED PROMPT APPROACH\n');
  console.log('Testing layered prompt structure for consistency across styles\n');

  const images = await fetchImages();
  fs.writeFileSync('./generated-samples/original-streetview.jpg', Buffer.from(images.streetView, 'base64'));

  const identity = await extractHouseIdentity(images.streetView, images.aerialView);

  console.log('\n🧬 HOUSE IDENTITY:');
  console.log('═'.repeat(60));
  console.log(identity);
  console.log('═'.repeat(60));

  fs.writeFileSync('./generated-samples/house-identity-structured.txt', identity);

  for (const styleKey of Object.keys(STYLE_TEMPLATES)) {
    const style = STYLE_TEMPLATES[styleKey];
    const result = await generateWithStructuredPrompt(
      identity,
      images.streetView,
      images.aerialView,
      style
    );

    if (result.success) {
      fs.writeFileSync(`./generated-samples/${style.file}`, Buffer.from(result.base64, 'base64'));
      console.log(`✅ ${style.name} saved`);
    } else {
      console.log(`❌ ${style.name}: ${result.error}`);
    }
  }

  console.log('\n📂 Results in generated-samples/');
  console.log('Compare structured-* files against previous attempts');
}

main().catch(console.error);
