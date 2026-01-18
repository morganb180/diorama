/**
 * Generate famous homes gallery for the homepage
 */
import fs from 'fs';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);

// Famous homes to generate
const FAMOUS_HOMES = [
  {
    id: 'white-house',
    name: 'The White House',
    address: '1600 Pennsylvania Ave NW, Washington, DC 20500',
  },
  {
    id: 'gamble-house',
    name: 'The Gamble House',
    address: '4 Westmoreland Place, Pasadena, CA 91103',
  },
  {
    id: 'fallingwater',
    name: 'Fallingwater',
    address: '1491 Mill Run Rd, Mill Run, PA 15464',
  },
  {
    id: 'graceland',
    name: 'Graceland',
    address: '3764 Elvis Presley Blvd, Memphis, TN 38116',
  },
];

// Styles to generate for each home
const STYLES = [
  {
    id: 'diorama',
    name: 'Diorama',
    useReference: true,
    prompt: '45-degree isometric miniature architectural diorama model. Studio photography, warm lighting, clean background. Show the house from an isometric angle revealing front, side, and roof. Make it look like a high-end architectural scale model.',
  },
  {
    id: 'ghibli',
    name: 'Ghibli',
    useReference: true,
    prompt: 'Studio Ghibli anime background painting. Reimagine this house in Miyazaki\'s world - warm afternoon sun, hand-painted textures, lush vegetation, puffy clouds. Show it from a slight angle like an establishing shot.',
  },
];

async function fetchImages(address) {
  console.log(`  📷 Fetching images for ${address}...`);
  const [svRes, avRes] = await Promise.all([
    fetch(`https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(address)}&size=640x480&key=${GOOGLE_MAPS_API_KEY}`),
    fetch(`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=18&size=640x640&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`),
  ]);
  return {
    streetView: Buffer.from(await svRes.arrayBuffer()).toString('base64'),
    aerialView: Buffer.from(await avRes.arrayBuffer()).toString('base64'),
  };
}

async function extractIdentity(streetViewBase64, aerialViewBase64) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `Extract this building's IDENTITY - the features that make it instantly recognizable.

=== BUILDING IDENTITY CARD ===

**COLORS**:
- Walls: [exact shade]
- Roof: [exact shade]
- Trim/accents: [colors]

**ARCHITECTURE**:
- Style: [name]
- Stories: [count]
- Distinctive shape: [description]

**SIGNATURE FEATURES** (the 4-5 most distinctive elements):
1. [most distinctive]
2. [second]
3. [third]
4. [fourth]
5. [fifth if applicable]

**ONE-SENTENCE IDENTITY**:
[A single sentence capturing this building's essence]`;

  const svPart = { inlineData: { data: streetViewBase64, mimeType: 'image/jpeg' } };
  const avPart = { inlineData: { data: aerialViewBase64, mimeType: 'image/png' } };

  const result = await model.generateContent([prompt, svPart, avPart]);
  return (await result.response).text().trim();
}

async function generateImage(identity, streetViewBase64, aerialViewBase64, style) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-image',
    generationConfig: { responseModalities: ['image', 'text'] },
  });

  const prompt = style.useReference
    ? `Create a ${style.prompt}

I'm providing:
1. TWO REFERENCE PHOTOS of the actual building (street view and aerial)
2. The building's IDENTITY CARD with its distinctive features

=== BUILDING IDENTITY ===
${identity}
=== END IDENTITY ===

Create the building in the specified style. The result must be UNMISTAKABLY this specific building.

Generate now.`
    : `${style.prompt}

=== BUILDING IDENTITY ===
${identity}
=== END IDENTITY ===

Create this building based on the identity. Every architectural feature must match.

Generate now.`;

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
  console.log('🏛️  FAMOUS HOMES GALLERY GENERATOR\n');

  // Ensure output directory exists
  const outputDir = './public/gallery';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const galleryData = [];

  for (const home of FAMOUS_HOMES) {
    console.log(`\n🏠 Processing: ${home.name}`);

    try {
      const images = await fetchImages(home.address);

      // Save original street view
      fs.writeFileSync(`${outputDir}/${home.id}-original.jpg`, Buffer.from(images.streetView, 'base64'));

      console.log('  🧬 Extracting identity...');
      const identity = await extractIdentity(images.streetView, images.aerialView);

      const homeData = {
        id: home.id,
        name: home.name,
        address: home.address,
        original: `/gallery/${home.id}-original.jpg`,
        styles: [],
      };

      for (const style of STYLES) {
        console.log(`  🎨 Generating ${style.name}...`);
        const result = await generateImage(identity, images.streetView, images.aerialView, style);

        if (result.success) {
          const filename = `${home.id}-${style.id}.png`;
          fs.writeFileSync(`${outputDir}/${filename}`, Buffer.from(result.base64, 'base64'));
          console.log(`  ✅ ${style.name} saved`);
          homeData.styles.push({
            id: style.id,
            name: style.name,
            image: `/gallery/${filename}`,
          });
        } else {
          console.log(`  ❌ ${style.name}: ${result.error}`);
        }
      }

      galleryData.push(homeData);
    } catch (error) {
      console.error(`  ❌ Failed to process ${home.name}:`, error.message);
    }
  }

  // Save gallery metadata
  fs.writeFileSync(`${outputDir}/gallery-data.json`, JSON.stringify(galleryData, null, 2));
  console.log('\n📂 Gallery generated in public/gallery/');
  console.log('   Gallery data saved to gallery-data.json');
}

main().catch(console.error);
