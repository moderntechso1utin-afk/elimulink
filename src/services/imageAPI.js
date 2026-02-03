// Simple image generation wrapper supporting OpenAI and Stability (placeholders)
const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const STABILITY_KEY = import.meta.env.VITE_STABILITY_API_KEY || '';

const imageAPI = {
  generateImage: async (prompt) => {
    // Prefer OpenAI if key present
    if (OPENAI_KEY) {
      try {
        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
          body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024', n: 1 })
        });
        const data = await res.json();
        const b64 = data.data?.[0]?.b64_json || data.data?.[0]?.b64_image;
        if (b64) return `data:image/png;base64,${b64}`;
      } catch (e) { console.error('OpenAI image error', e); }
    }

    // Stability (DreamStudio) placeholder
    if (STABILITY_KEY) {
      try {
        const res = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-v1-5/text-to-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${STABILITY_KEY}` },
          body: JSON.stringify({ text_prompts: [{ text: prompt }], cfg_scale: 7, height: 1024, width: 1024, samples: 1 })
        });
        const data = await res.json();
        const b64 = data.artifacts?.[0]?.base64;
        if (b64) return `data:image/png;base64,${b64}`;
      } catch (e) { console.error('Stability image error', e); }
    }

    // No provider available
    throw new Error('No image provider configured. Set VITE_OPENAI_API_KEY or VITE_STABILITY_API_KEY in .env');
  }
};

export default imageAPI;
