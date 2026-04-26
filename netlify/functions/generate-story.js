/**
 * Netlify Function: generate-story
 * POST /api/generate-story
 *
 * Receives child details → calls Claude → returns story JSON
 * with Pollinations.ai illustration URLs baked in (100% free, no API key).
 */

const Anthropic = require('@anthropic-ai/sdk');

// ─── Pollinations.ai image URL builder ────────────────────────────────────────
// Free, no API key, no rate limits for reasonable use.
// Just encode your prompt into a URL and the image is served directly.
function pollinationsUrl(prompt, seed) {
  const fullPrompt = `${prompt}, watercolour children's book illustration style, soft warm colours, whimsical, gentle, high quality`;
  const encoded = encodeURIComponent(fullPrompt);
  // width=768 height=512 gives a nice landscape book-page ratio
  return `https://image.pollinations.ai/prompt/${encoded}?width=768&height=512&seed=${seed}&nologo=true&enhance=true`;
}

// ─── CORS headers (required for browser → Netlify Function calls) ─────────────
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { name, age, personality, friend, extras, theme } = JSON.parse(event.body || '{}');

    // ── Validation ────────────────────────────────────────────────────────────
    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Child name is required.' }) };
    }
    if (!age || isNaN(age) || age < 3 || age > 8) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Age must be between 3 and 8.' }) };
    }

    const validThemes = ['jungle', 'space', 'fantasy', 'ocean', 'dinosaur', 'pirate', 'garden', 'superhero'];
    const selectedTheme = validThemes.includes(theme) ? theme : 'jungle';

    const themeSettings = {
      jungle:    { world: 'a lush, magical jungle full of hidden paths and ancient trees',   cast: 'friendly animals, wise old elephants, and cheeky monkeys'        },
      space:     { world: 'the shimmering far reaches of outer space',                        cast: 'friendly aliens, talking stars, and a wise robot companion'        },
      fantasy:   { world: 'an enchanted kingdom of rolling hills and glittering castles',    cast: 'gentle dragons, playful fairies, and kind-hearted knights'          },
      ocean:     { world: 'a sparkling underwater world of coral reefs and hidden caves',    cast: 'playful dolphins, wise sea turtles, and luminous jellyfish'          },
      dinosaur:  { world: 'a lush prehistoric world of ferns, volcanoes and giant lakes',   cast: 'gentle giant dinosaurs, tiny clever raptors, and a wise triceratops' },
      pirate:    { world: 'the sparkling high seas dotted with mysterious islands',          cast: 'friendly pirates, magical mermaids, and a talking parrot navigator'  },
      garden:    { world: 'a secret magical garden behind an old wooden gate',              cast: 'talking flowers, tiny garden fairies, and a wise old oak tree'       },
      superhero: { world: 'a bright and bustling city full of wonder and hidden magic',     cast: 'fellow young heroes, a wise mentor, and friendly citizens to protect' },
    };

    const { world, cast } = themeSettings[selectedTheme];
    const friendLine    = friend      ? `- ${name}'s best friend ${friend} appears in the story and helps them on their quest.` : '';
    const personalLine  = personality ? `- ${name} is described as: ${personality}. Weave these traits naturally into their choices and actions.` : '';
    const extrasLine    = extras      ? `- Additional details to include: ${extras}` : '';

    const prompt = `You are a professional children's book author celebrated for warm, imaginative storytelling.
Write a personalised storybook for a child named ${name.trim()}, aged ${age}.

STORY WORLD: ${world}, filled with ${cast}.

PERSONALISATION:
- ${name} is the main hero. Use their name frequently and warmly.
${personalLine}
${friendLine}
${extrasLine}

REQUIREMENTS:
- Write a complete story of approximately 1,200–1,500 words total
- Age-appropriate vocabulary and concepts for a ${age}-year-old
- ${name} must solve the central problem through their own qualities (bravery, kindness, creativity, etc.)
- Exactly 4 chapters with short, evocative titles
- Clear beginning, exciting middle, and heartwarming resolution
- Vivid, imaginative language children love to hear read aloud
- End each chapter at a gentle cliffhanger to keep the reader turning pages

For each chapter, write a detailed illustration prompt describing:
- The exact scene and action happening
- The main characters visible and what they are doing
- The mood, lighting, and colour palette
- The art style: watercolour children's book, soft warm colours, whimsical

OUTPUT FORMAT — return ONLY valid JSON, no markdown fences, no preamble, no trailing text:
{
  "title": "The full book title including ${name}'s name",
  "tagline": "A single magical sentence that captures the spirit of the story",
  "chapters": [
    {
      "number": 1,
      "title": "Chapter title",
      "text": "Full chapter text (300–400 words)",
      "illustrationPrompt": "Detailed DALL-E / Stable Diffusion prompt for this chapter's illustration"
    }
  ]
}`;

    // ── Call Claude ───────────────────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0].text.trim();

    // ── Parse story JSON ──────────────────────────────────────────────────────
    let story;
    try {
      story = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) story = JSON.parse(match[0]);
      else throw new Error('Could not parse story. Please try again.');
    }

    if (!story.title || !Array.isArray(story.chapters) || story.chapters.length !== 4) {
      throw new Error('Story structure was invalid. Please try again.');
    }

    // ── Attach Pollinations.ai illustration URLs ───────────────────────────────
    // Each chapter gets a unique seed so images are distinct.
    // The URL is constructed here on the server — the browser just loads the image.
    // Images generate in ~3–8 seconds when first loaded (then cached by Pollinations).
    const baseSeed = Date.now();

    story.chapters = story.chapters.map((ch, i) => ({
      ...ch,
      illustrationUrl: pollinationsUrl(ch.illustrationPrompt, baseSeed + i * 137),
    }));

    // ── Add metadata ──────────────────────────────────────────────────────────
    story.storyId = `sf_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    story.meta    = {
      name:        name.trim(),
      age:         parseInt(age),
      theme:       selectedTheme,
      generatedAt: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ success: true, story }),
    };

  } catch (err) {
    console.error('[generate-story] Error:', err.message);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: err.message || 'Story generation failed.' }),
    };
  }
};
