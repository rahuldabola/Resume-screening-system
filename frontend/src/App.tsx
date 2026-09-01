import { Route, BrowserRouter, Routes } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { CandidatesPage } from './pages/CandidatesPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { JobsPage } from './pages/JobsPage';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<JobsPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/candidates" element={<CandidatesPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
