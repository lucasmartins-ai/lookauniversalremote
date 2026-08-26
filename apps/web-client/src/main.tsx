import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './ui/styles/index.css';

// Register Service Worker via Vite PWA
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onNeedRefresh() {
          console.log('New LookARemote PWA content available. Reloading...');
        },
        onOfflineReady() {
          console.log('LookARemote is ready to work offline.');
        },
      });
    })
    .catch((err) => {
      console.warn('PWA registration skipped/failed:', err);
    });
}

const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
