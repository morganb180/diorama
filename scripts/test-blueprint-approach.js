/**
 * BLUEPRINT APPROACH
 *
 * Instead of describing features, we extract a precise COMPOSITIONAL BLUEPRINT
 * that specifies WHERE everything is positioned in the frame.
 *
 * Think of it like giving an architect exact measurements vs. saying "nice house."
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

async function extractBlueprint(streetViewBase64, aerialViewBase64) {
  console.log('\n📐 Extracting COMPOSITIONAL BLUEPRINT...');

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are a technical architect creating a PRECISE COMPOSITIONAL BLUEPRINT for an AI artist to recreate this house.

Analyze the STREET VIEW image and create an exact spatial map.

OUTPUT FORMAT - Be extremely precise with percentages and positions:

=== FRAME COMPOSITION ===
SKY_ZONE: [top X% of frame]
HOUSE_ZONE: [middle X% to X% of frame vertically]
GROUND_ZONE: [bottom X% of frame]

=== HORIZONTAL LAYOUT (left to right, viewing from street) ===
Divide the facade into sections with percentages:
- 0-X%: [what's here - be specific]
- X-X%: [what's here]
- X-100%: [what's here]

=== ROOF ===
- Type: [hip/gable/flat]
- Color: [specific color name AND hex approximation]
- Peak position: [left/center/right of frame, percentage from left]
- Vertical span: [top X% to X% of frame]

=== WALLS ===
- Color: [specific - e.g., "warm ivory cream" not "white"] AND hex approximation
- Material: [stucco/brick/siding]
- Texture: [smooth/textured]

=== GARAGE ===
- Horizontal position: [X% to X% of frame width]
- Number of doors: [count]
- Door color: [specific] AND hex approximation
- Door style: [paneled/flat/with windows/without windows]
- Any windows on doors: [yes/no, if yes describe]

=== WINDOWS (on main facade, not garage) ===
For each visible window:
- Window 1: position [X%, Y% from top-left], size [small/medium/large], style [description]
- Window 2: [etc.]

=== ENTRY/FRONT DOOR ===
- Position: [X% from left edge]
- Visible: [yes/no/partially]
- Style: [description if visible]

=== TREES AND MAJOR LANDSCAPING ===
For each major element:
- Element 1: [type], position [X% from left, height relative to house]
- Element 2: [etc.]

=== FENCE/WALL IN FOREGROUND ===
- Present: [yes/no]
- Type: [picket/solid/iron]
- Color: [specific]
- Spans: [X% to X% of frame width]
- Height in frame: [bottom X% of image]

=== COLORS PALETTE (with hex codes) ===
- Primary wall: #XXXXXX
- Roof: #XXXXXX
- Garage doors: #XXXXXX
- Trim: #XXXXXX
- Fence: #XXXXXX
- Lawn: #XXXXXX
- Sky: #XXXXXX

=== DISTINCTIVE IDENTIFIERS ===
List 3-5 unique features that make THIS house recognizable:
1. [feature]
2. [feature]
3. [etc.]

Be EXTREMELY precise. An artist should be able to recreate the exact composition from this blueprint.`;

  const streetViewPart = { inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } };

  const result = await model.generateContent([prompt, streetViewPart]);
  return (await result.response).text().trim();
}

async function generateFromBlueprint(blueprint, streetViewBase64, styleName, styleInstructions) {
  console.log(`\n🎨 Generating ${styleName} from blueprint...`);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: { responseModalities: ['image', 'text'] },
  });

  // Pass BOTH the blueprint AND the original image as reference
  const prompt = `You are recreating a specific house in a new artistic style. You have TWO references:

1. A PHOTOGRAPH of the actual house (attached)
2. A precise COMPOSITIONAL BLUEPRINT (below)

YOUR TASK: Create a ${styleInstructions}

COMPOSITIONAL BLUEPRINT (follow this EXACTLY):
${blueprint}

CRITICAL RULES:
- The POSITIONS of all elements must match the blueprint percentages
- The COLORS must match the hex codes in the blueprint
- The PROPORTIONS must match the blueprint
- Use the attached photograph as your visual reference for details
- The homeowner MUST immediately recognize this as THEIR house

WHAT YOU CAN CHANGE:
- The artistic rendering style and texture
- Lighting mood (but keep it flattering)
- Minor stylistic flourishes appropriate to the style

WHAT YOU CANNOT CHANGE:
- Element positions (use the blueprint percentages)
- Colors (use the blueprint hex codes, can shift slightly for style)
- Proportions and spatial relationships
- Number and placement of windows, doors, trees

Generate the image now. Make it beautiful, but make it ACCURATE to the blueprint.`;

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
  console.log('🔬 Testing BLUEPRINT APPROACH\n');
  console.log('Strategy: Extract precise spatial composition, then generate from blueprint + photo reference\n');

  const images = await fetchImages();

  // Save original
  fs.writeFileSync('./generated-samples/original-streetview.jpg', Buffer.from(images.streetView, 'base64'));

  // Extract blueprint
  const blueprint = await extractBlueprint(images.streetView, images.aerialView);

  console.log('\n📋 COMPOSITIONAL BLUEPRINT:');
  console.log('═'.repeat(60));
  console.log(blueprint);
  console.log('═'.repeat(60));

  // Save blueprint
  fs.writeFileSync('./generated-samples/blueprint.txt', blueprint);

  const styles = [
    {
      name: 'Ghibli Blueprint',
      file: 'ghibli-blueprint.png',
      instructions: 'Studio Ghibli anime background painting. Use Miyazaki\'s signature soft watercolor rendering, warm golden afternoon light, hand-painted texture, puffy clouds. But maintain EXACT positions and colors from the blueprint.',
    },
    {
      name: 'Diorama Blueprint',
      file: 'diorama-blueprint.png',
      instructions: '45-degree isometric miniature architectural diorama model. Ultra-realistic materials, studio lighting, clean background. The house should look like a perfect scale model, but with EXACT features matching the blueprint.',
    },
    {
      name: 'Wes Anderson Blueprint',
      file: 'wesanderson-blueprint.png',
      instructions: 'Wes Anderson film still with perfect symmetry, muted pastel color grading, dollhouse aesthetic, whimsical mood. Apply his color treatment but maintain EXACT architectural features from the blueprint.',
    },
  ];

  for (const style of styles) {
    const result = await generateFromBlueprint(blueprint, images.streetView, style.name, style.instructions);

    if (result.success) {
      fs.writeFileSync(`./generated-samples/${style.file}`, Buffer.from(result.base64, 'base64'));
      console.log(`✅ ${style.name} saved`);
    } else {
      console.log(`❌ ${style.name} failed: ${result.error}`);
    }
  }

  console.log('\n📂 Results in generated-samples/');
  console.log('Compare blueprint versions against original-streetview.jpg');
}

main().catch(console.error);
