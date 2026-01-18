/**
 * Test the new structured vision prompt
 */

const ADDRESS = '26141 Red Corral Rd, Laguna Hills, CA 92653';
const API_BASE = 'http://localhost:3001';

const FIDELITY_REQUIREMENTS = `STRICT FIDELITY REQUIRED - MUST exactly match: (1) wall color as described, (2) roof color/shape/style, (3) number of stories, (4) garage door count and style, (5) window placement and style, (6) fencing type and location, (7) driveway pillars/columns, (8) lot shape and landscaping, (9) pool shape/location if present. NO creative additions or modifications.`;

const stylePrompt = `${FIDELITY_REQUIREMENTS} Create a perfectly symmetrical Wes Anderson film still of: [SEMANTIC_DESCRIPTION]. Centered composition, muted pastel color palette (millennial pink, seafoam, mustard yellow, powder blue), flat lighting, dollhouse-like framing, whimsical yet melancholic mood. Shot on 35mm film, 1:1.`;

async function test() {
  console.log('Testing structured vision prompt...\n');
  console.log(`Address: ${ADDRESS}\n`);

  try {
    const response = await fetch(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: ADDRESS,
        stylePrompt: stylePrompt,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('=== NEW STRUCTURED SEMANTIC DESCRIPTION ===\n');
    console.log(data.semanticDescription);
    console.log('\n===========================================\n');

    console.log('=== PREVIOUS DESCRIPTION (for comparison) ===\n');
    console.log(`This is a two-story Contemporary style house with a low-pitched gable roof in terracotta. The exterior walls are a warm cream color, with the trim a brighter, off-white tone. The two-car garage, located centrally, features white doors without windows. The property has a sprawling, irregularly-shaped lot with the house centrally located, facing South. A long, light-gray driveway approaches from the street in a slightly rightward angle, leading directly to the garages. A rectangular pool is present in the back, in the approximate center, and multiple small trees and hedges are positioned around the property line. A low white fence extends along the left and right sides of the front yard.`);
    console.log('\n=============================================\n');

    if (data.generatedImage?.base64) {
      const fs = await import('fs');
      const path = await import('path');
      const outputPath = path.join(process.cwd(), 'generated-samples', 'test-structured-wesanderson.png');
      const imageBuffer = Buffer.from(data.generatedImage.base64, 'base64');
      fs.writeFileSync(outputPath, imageBuffer);
      console.log(`Image saved to: ${outputPath}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
