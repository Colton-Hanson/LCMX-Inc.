import { usePageTitle } from '../lib/usePageTitle.js';

// Page shown after signing in. The login check and top bar come from RequireAuth.
export default function HomePage() {
  usePageTitle('Home');
  return (
    <main className="page-main d-flex align-items-center justify-content-center p-3">
      <h1 className="h2 mb-0">Home Page</h1>
    </main>
  );
}
