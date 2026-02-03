const apiKey = 'AIzaSyDz_Yt2tl5_SOfrKc5bF8kxxFtMUJdBJ50';
const fetch = global.fetch || require('node-fetch');

(async () => {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: `Current Time: ${new Date().toISOString()}. Region: Global. User Question: Describe the Kenyan flag` }] }],
      tools: [{ google_search: {} }],
      systemInstruction: { parts: [{ text: "You are ElimuLink Pro. Provide accurate, globally relevant information and adapt responses to the provided Region: Global. If Region is 'Global', respond in a neutral, worldwide context. Keep answers concise and actionable. End with 2-3 clear suggestions for 'knowing more'." }] }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:');
    console.log(text);
  } catch (err) {
    console.error('Request error:', err);
  }
})();