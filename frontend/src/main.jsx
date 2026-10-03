// main.jsx — the very first file that runs. It "mounts" (attaches) our React app onto the page.

import React from 'react'; // React itself: the library that builds the UI out of components.
import { createRoot } from 'react-dom/client'; // Lets React draw into a real browser page.
import { BrowserRouter } from 'react-router-dom'; // Gives the app multiple "pages" (/login, /register...) without full reloads.
import App from './App.jsx'; // Our top-level component (defines which page shows at which URL).
import 'bootstrap/dist/css/bootstrap.min.css'; // Bootstrap: the team's "1 CSS framework" (requirements doc). CSS only, no JavaScript from it.
import './styles.css'; // Loads our own small CSS AFTER Bootstrap so our few overrides win.

// Bootstrap 5.3 switches between light and dark colors using a data-bs-theme attribute on <html>.
// Match the device's setting (like the old plain CSS did) and follow it live if the user changes it.
const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => document.documentElement.setAttribute('data-bs-theme', darkMode.matches ? 'dark' : 'light');
applyTheme();
darkMode.addEventListener('change', applyTheme);

// index.html has an empty <div id="root"></div>. We find it and render the app inside it.
createRoot(document.getElementById('root')).render(
  // StrictMode is a development helper: it warns about common mistakes. It has no effect in production.
  <React.StrictMode>
    {/* BrowserRouter watches the URL in the address bar so <Routes> and <Link> can work. */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
