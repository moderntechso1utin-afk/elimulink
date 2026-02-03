import React from 'react';

export const SplashScreen = ({ isVisible, onFinish }) => {
  // Auto-close after 1.5 seconds regardless
  React.useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onFinish?.();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onFinish]);

  // Also add a manual close button as fallback
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-blue-600 to-blue-700 flex flex-col items-center justify-center z-50">
      {/* Logo */}
      <div className="text-9xl mb-6 animate-bounce">📚</div>
      
      {/* App Name */}
      <h1 className="text-4xl font-bold text-white mb-2 text-center">ElimuLink</h1>
      
      {/* Tagline */}
      <p className="text-white text-center text-lg opacity-90">
        Your AI Learning Assistant
      </p>
      
      {/* Loading indicator */}
      <div className="mt-12 flex gap-2">
        <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
        <div className="w-3 h-3 bg-white rounded-full animate-pulse delay-100"></div>
        <div className="w-3 h-3 bg-white rounded-full animate-pulse delay-200"></div>
      </div>

      {/* Fallback button if auto-close doesn't work */}
      <button
        onClick={() => onFinish?.()}
        className="mt-12 px-6 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition text-sm"
      >
        Click to continue
      </button>
    </div>
  );
};
