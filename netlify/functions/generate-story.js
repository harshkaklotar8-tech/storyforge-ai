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

    // ── MOCK MODE: set MOCK_STORY=true in Netlify env vars to bypass Claude ────
    // Use this to test PayPal + Printify + email without spending API credits.
    // Remove MOCK_STORY (or set to false) when you top up Anthropic credits.
    let story;

    if (process.env.MOCK_STORY === 'true') {
      console.log('[generate-story] MOCK MODE — returning test story (no Claude API call)');
      story = {
        title: `${name.trim()} and the Magic ${selectedTheme.charAt(0).toUpperCase() + selectedTheme.slice(1)} Adventure`,
        tagline: `A brave young hero discovers that the greatest magic of all lives within.`,
        chapters: [
          {
            number: 1,
            title: 'The Mysterious Map',
            text: `Once upon a time, in a cosy little house at the edge of a great forest, there lived a child named ${name.trim()}. ${name.trim()} was ${age} years old and loved adventures more than anything in the world. One bright morning, ${name.trim()} discovered a rolled-up piece of old paper tucked beneath the garden gate. It was a map — drawn in golden ink — showing a path that wound deep into the ${selectedTheme} beyond the hill. "This must be a treasure map!" ${name.trim()} whispered, eyes wide with wonder. Without wasting another moment, ${name.trim()} packed a small bag with a biscuit, a bottle of water, and a torch, and set off down the winding path. The trees rustled in the breeze as if whispering a secret. Every step felt like the beginning of something magical. And it was.`,
            illustrationPrompt: `A cheerful ${age}-year-old child named ${name.trim()} standing at the edge of a magical ${selectedTheme}, holding a glowing golden map, watercolour children's book style, warm morning light, soft greens and golds, wonder and excitement on their face.`,
          },
          {
            number: 2,
            title: 'New Friends Appear',
            text: `Deep in the ${selectedTheme}, ${name.trim()} came across the most extraordinary sight. A small friendly creature was tangled in a cluster of vines, squeaking softly for help. ${name.trim()} didn't hesitate for even a second. Carefully and gently, ${name.trim()} untangled every vine until the creature was free. "Thank you!" it cried, shaking its fluffy ears. "My name is Pip, and I know these lands like the back of my paw." Pip offered to guide ${name.trim()} to the treasure marked on the map. Together they skipped through sun-dappled clearings and over mossy stepping stones, laughing and chatting as if they had been friends forever. ${name.trim()} felt brave and warm inside — the kind of warmth that only comes from doing something truly kind.`,
            illustrationPrompt: `${name.trim()} carefully freeing a small fluffy magical creature called Pip from tangled vines in a lush ${selectedTheme} clearing, watercolour children's book style, dappled sunlight, soft warm colours, both characters smiling.`,
          },
          {
            number: 3,
            title: 'The Big Challenge',
            text: `The path grew trickier as ${name.trim()} and Pip approached the heart of the ${selectedTheme}. A wide rushing river blocked the way, and the old wooden bridge had three broken planks right in the middle. Pip looked worried. "I don't think we can cross," Pip said sadly. But ${name.trim()} looked around thoughtfully. Nearby lay three flat stones, just the right size. One by one, ${name.trim()} placed the stones carefully across the gap until a safe path appeared. "You did it!" Pip cheered, clapping tiny paws together. ${name.trim()} smiled proudly — not because it was easy, but because it had seemed hard and they'd done it anyway. That, ${name.trim()} was learning, was what real bravery felt like.`,
            illustrationPrompt: `${name.trim()} placing flat stepping stones across a cheerful rushing river in the ${selectedTheme}, Pip the fluffy creature watching and cheering, watercolour children's book style, bright colours, sense of determination and triumph.`,
          },
          {
            number: 4,
            title: 'The Greatest Treasure',
            text: `At last, ${name.trim()} and Pip reached the spot marked with a golden star on the map. Beneath an ancient twisted tree sat a small wooden chest, half-hidden in soft moss. ${name.trim()} knelt down and opened it slowly. Inside was no gold or jewels — but a small round mirror. ${name.trim()} looked in and saw something wonderful: a reflection full of bravery, kindness, and adventure. A tiny note read: "The greatest treasure is already inside you." ${name.trim()} laughed with delight and hugged Pip tightly. Together they made their way home as the sun painted the sky in shades of pink and orange. That night, tucked up in bed, ${name.trim()} thought about the map, the bridge, and brave little Pip — and smiled a smile that stretched all the way to their ears. The end.`,
            illustrationPrompt: `${name.trim()} opening a small wooden treasure chest under an ancient magical tree to find a glowing mirror, Pip the fluffy creature beside them, warm sunset light in the ${selectedTheme} background, watercolour children's book style, heartwarming and magical.`,
          },
        ],
      };
    } else {
      // ── LIVE: Call Claude API ───────────────────────────────────────────────
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });

      const rawText = message.content[0].text.trim();

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
