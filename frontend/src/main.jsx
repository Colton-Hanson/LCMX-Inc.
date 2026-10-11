import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import '@fontsource/red-hat-display/700.css';
import '@fontsource/red-hat-display/800.css';
import '@fontsource/red-hat-display/900.css';
import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/600.css';
import '@fontsource/hanken-grotesk/700.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles.css'; // Loaded after Bootstrap so these overrides take precedence.

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
