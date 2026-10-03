// App.jsx — the "map" of the site: which page component shows for which URL.

import { Routes, Route, Navigate } from 'react-router-dom'; // Routing tools from react-router.
import LoginPage from './pages/LoginPage.jsx'; // SCRUM-12: the login form page.
import RegisterPage from './pages/RegisterPage.jsx'; // SCRUM-11: the registration form page.
import HomePage from './pages/HomePage.jsx'; // Placeholder page users land on after logging in.

export default function App() {
  return (
    // <Routes> looks at the current URL and renders the FIRST matching <Route>.
    <Routes>
      {/* Visiting /login shows the login form. */}
      <Route path="/login" element={<LoginPage />} />
      {/* Visiting /register shows the registration form. */}
      <Route path="/register" element={<RegisterPage />} />
      {/* Placeholder home. Route guards for guest users are SCRUM-39 (Sprint 2),
          so right now anyone can open /home directly. */}
      <Route path="/home" element={<HomePage />} />
      {/* "*" matches ANY other URL. Per the requirements doc, unknown/guest URLs should
          redirect to login instead of showing an error page. `replace` swaps the history
          entry so the Back button doesn't bounce the user back into the bad URL. */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
