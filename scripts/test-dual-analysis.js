/**
 * Test the new dual-analysis vision prompts (street view + aerial analyzed separately)
 */
import fs from 'fs';
import path from 'path';

const ADDRESS = '26141 Red Corral Rd, Laguna Hills, CA 92653';
const API_BASE = 'http://localhost:3001';

const FIDELITY_REQUIREMENTS = `STRICT FIDELITY REQUIRED - MUST exactly match: (1) wall color as described, (2) roof color/shape/style, (3) number of stories, (4) garage door count and style, (5) window placement and style, (6) fencing type and location, (7) driveway pillars/columns, (8) lot shape and landscaping, (9) pool shape/location if present. NO creative additions or modifications.`;

const wesAndersonPrompt = `${FIDELITY_REQUIREMENTS} Create a HYPER-REALISTIC, perfectly symmetrical Wes Anderson film still photograph of: [SEMANTIC_DESCRIPTION]. 8K ultra-high resolution, photorealistic with cinematic color grading. Perfectly centered composition, muted pastel color palette (millennial pink, seafoam green, mustard yellow, powder blue), soft diffused lighting, meticulous production design with every detail visible. Real architectural photography aesthetic with Wes Anderson's signature symmetry and whimsical-melancholic mood. Shot on large format film, tack-sharp focus, museum-quality print. 8K, 1:1.`;

async function test() {
  console.log('Testing DUAL-ANALYSIS vision prompts with Wes Anderson...\n');
  console.log(`Address: ${ADDRESS}\n`);
  console.log('This will analyze street view and aerial view SEPARATELY, then combine.\n');

  const startTime = Date.now();

  try {
    const response = await fetch(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: ADDRESS,
        stylePrompt: wesAndersonPrompt,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n=== COMBINED SEMANTIC DESCRIPTION (${elapsed}s) ===\n`);
    console.log(data.semanticDescription);
    console.log('\n' + '='.repeat(60) + '\n');

    if (data.generatedImage?.base64) {
      const outputPath = path.join(process.cwd(), 'generated-samples', 'wesanderson-dual-analysis.png');
      const imageBuffer = Buffer.from(data.generatedImage.base64, 'base64');
      fs.writeFileSync(outputPath, imageBuffer);
      console.log(`✅ Image saved to: ${outputPath}`);
      console.log('\nCheck server logs for individual street view and aerial view descriptions.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
