import React, { useState, useEffect, useRef } from 'react';

// --- Safe Icon Components (Inline SVG) ---
const ImageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
);

const LoaderIcon = () => (
  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
);

// --- Error Boundary Component ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-center">
          <h1 className="text-xl font-bold text-red-500">Something went wrong.</h1>
          <button 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
            onClick={() => window.location.reload()}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Main App Component ---
function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const scrollRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleImageGeneration = async (promptText) => {
    setIsThinking(true);
    setErrorMessage("");
    try {
      const response = await fetch('http://localhost:4000/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
      });
      const data = await response.json();

      // Accept several backend shapes: { success: true, url }, { image }, or { image: 'data:...' }
      const imageUrl = data?.image || data?.url || (data?.data && (data.data.image || data.data.url));

      if (imageUrl) {
        const aiMsg = {
          id: Date.now() + Math.random(),
          role: 'ai',
          type: 'image',
          content: imageUrl,
          text: data.isMock ? `[DEMO MODE] ${data.message || 'Placeholder image returned.'}` : (data.message || 'Here is your generated image:')
        };
        setMessages(prev => [...prev, aiMsg]);
      } else if (data?.success === false) {
        setErrorMessage(data.error || data.message || 'Failed to generate image.');
      } else if (data?.error) {
        setErrorMessage(data.error);
      } else {
        setErrorMessage('Unexpected response from image service.');
      }
    } catch (err) {
      console.error('Image request error', err);
      setErrorMessage('Could not connect to the backend server.');
    } finally {
      setIsThinking(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;

    const userMsg = { id: Date.now() + Math.random(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    handleImageGeneration(input);
    setInput("");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white font-sans">
      <header className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <ImageIcon /> ElimuLink Image Pro
        </h1>
        <div className="text-xs text-gray-500 px-3 py-1 bg-gray-800 rounded-full">
          Local Backend: 4000
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
            <div className="p-6 bg-gray-800 rounded-full">
              <ImageIcon />
            </div>
            <p className="text-sm">Describe an image to generate it locally.</p>
          </div>
        )}
        
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl ${
              m.role === 'user' ? 'bg-blue-600' : 'bg-gray-800 border border-gray-700'
            }`}>
              {m.text && <p className="text-sm mb-2">{m.text}</p>}
              {m.type === 'image' && (
                <img 
                  src={m.content} 
                  alt="Generated Art" 
                  className="rounded-lg w-full h-auto object-cover mt-2 shadow-xl border border-gray-700"
                />
              )}
            </div>
          </div>
        ))}
        
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-gray-800 border border-gray-700 p-4 rounded-2xl flex items-center gap-3">
              <LoaderIcon />
              <span className="text-xs text-blue-400 font-medium animate-pulse">GENERATING IMAGE...</span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-900/20 border border-red-500/50 text-red-500 text-xs rounded-lg text-center">
            {errorMessage}
          </div>
        )}
      </main>

      <footer className="p-4 bg-gray-950 border-t border-gray-800">
        <form onSubmit={onSubmit} className="max-w-4xl mx-auto flex gap-2">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="A surreal landscape with floating islands..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isThinking}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 p-3 rounded-xl transition-colors"
          >
            <SendIcon />
          </button>
        </form>
      </footer>
    </div>
  );
}

// Ensure the default export is the App wrapped in ErrorBoundary
export default function WrappedApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
