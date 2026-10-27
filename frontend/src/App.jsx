import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import HomePage from './pages/HomePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import GroupsPage from './pages/GroupsPage.jsx';
import CreateGroupPage from './pages/CreateGroupPage.jsx';
import GroupPage from './pages/GroupPage.jsx';
import GroupSettingsPage from './pages/GroupSettingsPage.jsx';
import CreateEventPage from './pages/CreateEventPage.jsx';
import AddExpensePage from './pages/AddExpensePage.jsx';
import BalancesPage from './pages/BalancesPage.jsx';
import RequireAuth from './components/RequireAuth.jsx';

// Maps each URL to its page. Unknown URLs go to the login page.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Pages that need a login: RequireAuth checks the session and shows the top bar. */}
      <Route element={<RequireAuth />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/new" element={<CreateGroupPage />} />
        <Route path="/groups/:groupId" element={<GroupPage />} />
        <Route path="/groups/:groupId/settings" element={<GroupSettingsPage />} />
        <Route path="/groups/:groupId/events/new" element={<CreateEventPage />} />
        <Route path="/expenses/new" element={<AddExpensePage />} />
        <Route path="/groups/:groupId/expenses/new" element={<AddExpensePage />} />
        <Route path="/balances" element={<BalancesPage />} />
      </Route>
      {/* replace: keeps the unknown URL out of the browser history so Back does not return to it. */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
