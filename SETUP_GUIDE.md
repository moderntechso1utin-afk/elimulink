# ElimuLink Pro Setup Guide

## Installation Complete ✓

Dependencies have been installed:
- `lucide-react` - Icon library
- `firebase` - Backend services

## Next Steps: Configuration

### 1. Firebase Setup

You need to create a Firebase project and get your credentials. Follow these steps:

1. **Go to [Firebase Console](https://console.firebase.google.com/)**
2. **Create a new project** or use an existing one
3. **Add a Web App** to your project
4. **Copy your Firebase config** - You'll see something like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123...",
  measurementId: "G-ABC123..."
};
```

5. **Update `.env` file** in your project root with these values:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 2. Gemini API Setup

The Gemini API key is already in your `.env`:
```env
VITE_GEMINI_API_KEY=AIzaSyDz_Yt2tl5_SOfrKc5bF8kxxFtMUJdBJ50
```

**Note:** If this key doesn't work, get a new one:
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Replace it in `.env`

### 3. Enable Firebase Services

In Firebase Console, enable these services for your project:

- **Authentication** → Enable "Anonymous" sign-in method
- **Firestore Database** → Create database in test mode
- **Storage** (Optional) → For file uploads

### 4. Firestore Database Structure

Your database should have this structure:
```
artifacts/
  └── elimulink-pro-v2/
      └── users/
          └── {userId}/
              └── chats/
                  └── {chatId}/
                      ├── title: string
                      ├── messages: array
                      └── timestamp: timestamp
```

This is created automatically when users interact with the app.

### 5. Environment Variables Summary

Your `.env` file should look like:

```env
# Gemini API
VITE_GEMINI_API_KEY=your_key_here
VITE_GEMINI_ENDPOINT=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent

# Firebase
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-ABC123

# App
VITE_APP_ID=elimulink-pro-v2
```

### 6. Run the App

```bash
npm run dev
```

The app should now be running on `http://localhost:5173` (or similar port shown in terminal).

## Features Included

✓ Dark theme with collapsible sidebar  
✓ Real-time chat with Firebase Firestore  
✓ Anonymous + Custom authentication  
✓ Chat history sync  
✓ Text-to-Speech (TTS) support  
✓ Image generation  
✓ File upload capability  
✓ Message editing  
✓ Google Search integration  
✓ Real-time clock display  

## Troubleshooting

### "Cannot read property of undefined"
- Make sure all `.env` variables are filled in
- Restart the dev server after updating `.env`

### Firebase auth errors
- Check that Authentication is enabled in Firebase Console
- Ensure anonymous sign-in is enabled

### API calls failing
- Verify Gemini API key is valid
- Check browser console for detailed error messages
- Ensure CORS is properly configured

### Images not generating
- Gemini API key must have Imagen access
- Check quota in Google Cloud Console

## Need Help?

Check the error messages in:
1. Browser Console (F12)
2. Terminal/Console output
3. Firebase Console logs

