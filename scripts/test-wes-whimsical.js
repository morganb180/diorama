/**
 * Test the whimsical (non-hyper-realistic) Wes Anderson prompt
 */
import fs from 'fs';
import path from 'path';

const ADDRESS = '26141 Red Corral Rd, Laguna Hills, CA 92653';
const API_BASE = 'http://localhost:3001';

const FIDELITY_REQUIREMENTS = `STRICT FIDELITY REQUIRED - MUST exactly match: (1) wall color as described, (2) roof color/shape/style, (3) number of stories, (4) garage door count and style, (5) window placement and style, (6) fencing type and location, (7) driveway pillars/columns, (8) lot shape and landscaping, (9) pool shape/location if present. NO creative additions or modifications.`;

// Updated whimsical prompt (removed hyper-realism)
const wesAndersonPrompt = `${FIDELITY_REQUIREMENTS} Create a perfectly symmetrical Wes Anderson film still of: [SEMANTIC_DESCRIPTION]. Charming dollhouse-like miniature aesthetic, perfectly centered composition, muted pastel color palette (millennial pink, seafoam green, mustard yellow, powder blue, cream), soft diffused lighting, whimsical yet melancholic mood. Meticulous production design like a carefully arranged film set. The Grand Budapest Hotel meets Moonrise Kingdom aesthetic. Slightly stylized, not photorealistic - embrace the theatrical, storybook quality. 8K, 1:1.`;

async function test() {
  console.log('Testing WHIMSICAL Wes Anderson prompt (no hyper-realism)...\n');

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

    console.log('Semantic Description:');
    console.log(data.semanticDescription);
    console.log('\n');

    if (data.generatedImage?.base64) {
      const outputPath = path.join(process.cwd(), 'generated-samples', 'wesanderson-whimsical.png');
      const imageBuffer = Buffer.from(data.generatedImage.base64, 'base64');
      fs.writeFileSync(outputPath, imageBuffer);
      console.log(`✅ Image saved to: ${outputPath}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
