import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import App from './app.jsx';

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      // Service worker registered successfully
      await registration.update();
    } catch {
      // Registration failed - silently fail in production
    }
  });
}

createRoot(document.querySelector('#root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
