// Gemini API Integration Module
// Replace your API calls here - easy to swap implementations

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

export const geminiAPI = {
  // Search for books and get AI-enhanced summaries
  searchBook: async function(query) {
    try {
      const prompt = `You are an educational AI assistant. A student asked: "${query}"
      
      If this is about a programming/CS topic, provide a JSON response with this exact structure:
      {
        "found": true,
        "title": "Book/Topic Title",
        "summary": "2-3 sentence summary",
        "keyTopics": ["topic1", "topic2", "topic3"],
        "realWorldExamples": ["example1", "example2", "example3"],
        "pastExamQuestions": ["question1", "question2", "question3"]
      }
      
      If not a recognized topic, respond with:
      {
        "found": false,
        "message": "guidance message"
      }`;

      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE',
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`API error: ${response.status}`, errorData);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Check if response has the expected structure
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        console.error('Unexpected API response structure:', data);
        throw new Error('Invalid response format from Gemini API');
      }
      
      const responseText = data.candidates[0].content.parts[0].text;
      
      // Parse the JSON response from Gemini
      try {
        return JSON.parse(responseText);
      } catch {
        // If JSON parsing fails, return as is
        console.warn('Could not parse JSON response:', responseText);
        return { found: false, message: responseText };
      }
    } catch (error) {
      console.error('Gemini API Error:', error.message);
      console.error('Full error:', error);
      return { found: false, message: 'Error connecting to AI service. Using learning resources instead.' };
    }
  },

  // You can add more API methods here for other features
  askQuestion: async function(question) {
    try {
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: question
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 512,
          },
        }),
      });

      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Gemini API Error:', error);
      return 'Sorry, I could not process your request.';
    }
  }
};

export default geminiAPI;