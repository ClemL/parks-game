import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Root from './Root';
import { InfoProvider } from './components/InfoSheet';
import './styles.css';

// Offline support: the service worker caches the shell and the park art.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline play is a bonus, never a requirement */
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InfoProvider>
      <Root />
    </InfoProvider>
  </StrictMode>,
);
