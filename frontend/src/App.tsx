import { Route, BrowserRouter, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Navbar } from './components/Navbar';
import { Aurora } from './components/Depth';
import { ToastProvider } from './components/ToastProvider';
import { CandidatesPage } from './pages/CandidatesPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { JobsPage } from './pages/JobsPage';

/**
 * Re-keys its subtree on every navigation, which restarts the entry animation.
 *
 * Without this, moving between two routes that render the same component tree
 * swaps the content in place with no transition at all.
 */
function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <main key={location.pathname} className="motion-safe:animate-fade-up">
      {children}
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Aurora />
        <Navbar />
        <PageTransition>
          <Routes>
            <Route path="/" element={<JobsPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/candidates" element={<CandidatesPage />} />
          </Routes>
        </PageTransition>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
