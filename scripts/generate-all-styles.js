/**
 * Batch generate all styles for comparison
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '../generated-samples');

const ADDRESS = '26141 Red Corral Rd, Laguna Hills, CA 92653';
const API_BASE = 'http://localhost:3001';

const FIDELITY_REQUIREMENTS = `STRICT FIDELITY REQUIRED - MUST exactly match: (1) wall color as described, (2) roof color/shape/style, (3) number of stories, (4) garage door count and style, (5) window placement and style, (6) fencing type and location, (7) driveway pillars/columns, (8) lot shape and landscaping, (9) pool shape/location if present. NO creative additions or modifications.`;

// New styles to test
const NEW_STYLES = {
  wesanderson: {
    name: 'Wes Anderson',
    prompt: `${FIDELITY_REQUIREMENTS} Create a perfectly symmetrical Wes Anderson film still of: [SEMANTIC_DESCRIPTION]. Centered composition, muted pastel color palette (millennial pink, seafoam, mustard yellow, powder blue), flat lighting, dollhouse-like framing, whimsical yet melancholic mood. Shot on 35mm film, aspect ratio 1.85:1 cropped to 1:1.`,
  },
  animalcrossing: {
    name: 'Animal Crossing',
    prompt: `${FIDELITY_REQUIREMENTS} Create an Animal Crossing New Horizons style rendering of: [SEMANTIC_DESCRIPTION]. Soft rounded edges, warm cel-shaded lighting, slightly chibi proportions, lush green grass, cute simplified details, pastel sky with fluffy clouds. Nintendo Switch game aesthetic. 8K, 1:1.`,
  },
  ghibli: {
    name: 'Studio Ghibli',
    prompt: `${FIDELITY_REQUIREMENTS} Create a Studio Ghibli/Hayao Miyazaki background art painting of: [SEMANTIC_DESCRIPTION]. Soft watercolor-like rendering, warm golden afternoon light, puffy cumulus clouds, lush detailed vegetation, hand-painted texture, nostalgic Japanese animation style. Spirited Away meets My Neighbor Totoro aesthetic. 8K, 1:1.`,
  },
  bobross: {
    name: 'Bob Ross',
    prompt: `${FIDELITY_REQUIREMENTS} Create a Bob Ross "Joy of Painting" style oil painting of: [SEMANTIC_DESCRIPTION]. Wet-on-wet technique, happy little trees, soft misty mountains in background, peaceful cabin-in-the-woods mood, titanium white highlights, van dyke brown shadows, almighty brush strokes. Calm, serene, ASMR-like tranquility. 8K, 1:1.`,
  },
  kinkade: {
    name: 'Thomas Kinkade',
    prompt: `${FIDELITY_REQUIREMENTS} Create a Thomas Kinkade "Painter of Light" style painting of: [SEMANTIC_DESCRIPTION]. Magical golden hour lighting, warm glowing windows emanating cozy light, cobblestone pathway, lush flowering gardens, romantic idealized atmosphere, soft ethereal glow throughout. Nostalgic, heartwarming, Christmas-card beautiful. 8K, 1:1.`,
  },
  ukiyoe: {
    name: 'Ukiyo-e Woodblock',
    prompt: `${FIDELITY_REQUIREMENTS} Create a traditional Japanese ukiyo-e woodblock print of: [SEMANTIC_DESCRIPTION]. Flat color areas with bold black outlines, Hokusai/Hiroshige style, traditional indigo and earth tones, stylized clouds and waves, subtle wood grain texture, Edo period aesthetic. Mount Fuji optional in background. 8K, 1:1.`,
  },
  travelposter: {
    name: 'Vintage Travel Poster',
    prompt: `${FIDELITY_REQUIREMENTS} Create a vintage 1950s travel poster illustration of: [SEMANTIC_DESCRIPTION]. Bold flat colors, simplified geometric shapes, art deco influences, optimistic mid-century modern aesthetic, screen-printed texture, "Visit California" tourism poster style. Warm sunset palette with teal accents. 8K, 1:1.`,
  },
  richardscarry: {
    name: 'Richard Scarry',
    prompt: `${FIDELITY_REQUIREMENTS} Create a Richard Scarry Busytown children's book illustration of: [SEMANTIC_DESCRIPTION]. Charming hand-drawn style, warm cheerful colors, cross-section cutaway showing interior rooms, tiny anthropomorphic animal residents going about their day, whimsical details everywhere, nostalgic 1970s children's book aesthetic. 8K, 1:1.`,
  },
  lofi: {
    name: 'Lo-fi Anime',
    prompt: `${FIDELITY_REQUIREMENTS} Create a lo-fi hip hop anime aesthetic illustration of: [SEMANTIC_DESCRIPTION]. Warm cozy evening lighting, soft purple and orange sunset tones, gentle rain or cherry blossoms falling, peaceful melancholic mood, anime background art style, study girl YouTube channel aesthetic. Relaxing, nostalgic, slightly dreamy. 8K, 1:1.`,
  },
  cottagecore: {
    name: 'Cottagecore',
    prompt: `${FIDELITY_REQUIREMENTS} Create a dreamy cottagecore fairy tale illustration of: [SEMANTIC_DESCRIPTION]. Romanticized overgrown garden, climbing roses and wisteria, soft dappled sunlight through trees, vintage pastoral aesthetic, slightly ethereal and magical atmosphere, wildflower meadow, butterflies and songbirds. Pinterest-perfect rural fantasy. 8K, 1:1.`,
  },
};

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function generateStyle(styleId, styleName, stylePrompt) {
  console.log(`\n🎨 Generating ${styleName}...`);

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

    if (data.generatedImage?.base64) {
      // Save the image
      const filename = `${styleId}.png`;
      const filepath = path.join(OUTPUT_DIR, filename);
      const imageBuffer = Buffer.from(data.generatedImage.base64, 'base64');
      fs.writeFileSync(filepath, imageBuffer);
      console.log(`   ✅ Saved to ${filename}`);

      // Also save the semantic description once
      if (styleId === 'wesanderson') {
        fs.writeFileSync(
          path.join(OUTPUT_DIR, 'semantic-description.txt'),
          data.semanticDescription
        );
        console.log(`   📝 Saved semantic description`);
      }

      return { success: true, path: filepath };
    } else {
      console.log(`   ⚠️  No image generated (mock mode?)`);
      return { success: false, mock: data.mock };
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🏠 Batch Style Generation');
  console.log(`   Address: ${ADDRESS}`);
  console.log(`   Output: ${OUTPUT_DIR}`);
  console.log(`   Styles: ${Object.keys(NEW_STYLES).length}`);

  const results = {};

  for (const [styleId, style] of Object.entries(NEW_STYLES)) {
    results[styleId] = await generateStyle(styleId, style.name, style.prompt);
    // Small delay between requests to avoid rate limiting
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n📊 Summary:');
  const successful = Object.entries(results).filter(([,r]) => r.success);
  const failed = Object.entries(results).filter(([,r]) => !r.success);

  console.log(`   ✅ Successful: ${successful.length}`);
  console.log(`   ❌ Failed: ${failed.length}`);

  if (successful.length > 0) {
    console.log(`\n🖼️  Generated images saved to: ${OUTPUT_DIR}`);
  }
}

main().catch(console.error);
