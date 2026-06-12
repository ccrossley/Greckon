import { readFileSync, writeFileSync } from 'node:fs';

const BASE_URL = 'https://api.atlascloud.ai/api/v1';

function mimeFor(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function encodeImageDataUri(path) {
  const data = readFileSync(path).toString('base64');
  return `data:${mimeFor(path)};base64,${data}`;
}

async function pollPrediction(predictionId, apiKey) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const response = await fetch(`${BASE_URL}/model/prediction/${predictionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(`Poll failed: ${response.status} ${JSON.stringify(payload)}`);
    }
    const result = payload.data;
    if (result.status === 'completed') {
      return result;
    }
    if (result.status === 'failed') {
      throw new Error(result.error ?? 'AtlasCloud generation failed');
    }
  }
  throw new Error('AtlasCloud generation timed out');
}

export async function generateNanoBananaEdit({
  apiKey,
  model,
  prompt,
  referencePaths,
  aspectRatio = '21:9',
  resolution = '1k',
  outputPath,
}) {
  const images = referencePaths.map(encodeImageDataUri);
  const response = await fetch(`${BASE_URL}/model/generateImage`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      images,
      aspect_ratio: aspectRatio,
      resolution,
      output_format: 'png',
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Generate failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  const predictionId = payload.data?.id;
  if (!predictionId) {
    throw new Error(`Missing prediction id: ${JSON.stringify(payload)}`);
  }

  const result = await pollPrediction(predictionId, apiKey);
  const imageUrl = result.outputs?.[0];
  if (!imageUrl) {
    throw new Error(`No output URL for prediction ${predictionId}`);
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download ${imageUrl}: ${imageResponse.status}`);
  }
  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  writeFileSync(outputPath, bytes);
  return outputPath;
}
