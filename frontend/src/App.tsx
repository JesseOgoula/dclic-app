import { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/dashboard/Dashboard';
import LearnersList from './components/learners/LearnersList';
import UploadPage from './components/upload/UploadPage';
import { LearnerDetail } from './pages/LearnerDetail';
import Reports from './pages/Reports';

type Page = 'dashboard' | 'learners' | 'upload' | 'reports';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [learnersFilter, setLearnersFilter] = useState<string>('');

  function handleNavigate(page: Page) {
    setCurrentPage(page);
    setSelectedLearnerId(null);
    setLearnersFilter('');
  }

  function handleViewAllLearners(filter: string) {
    setLearnersFilter(filter);
    setCurrentPage('learners');
    setSelectedLearnerId(null);
  }

  function handleSelectLearner(id: string) {
    setSelectedLearnerId(id);
    setCurrentPage('learners');
  }

  function handleGlobalSearch(value: string) {
    setGlobalSearch(value);
    if (value.trim().length > 0 && currentPage !== 'learners') {
      setCurrentPage('learners');
      setSelectedLearnerId(null);
    }
  }

  return (
    <Layout 
      currentPage={currentPage} 
      onNavigate={handleNavigate}
      onSelectLearner={handleSelectLearner}
      globalSearch={globalSearch}
      onSearch={handleGlobalSearch}
    >
      {currentPage === 'dashboard' && (
        <Dashboard 
          onSelectLearner={handleSelectLearner}
          globalSearch={globalSearch}
          onViewAll={handleViewAllLearners}
        />
      )}
      {currentPage === 'reports' && <Reports />}
      {currentPage === 'learners' && !selectedLearnerId && (
        <LearnersList 
          onSelectLearner={handleSelectLearner}
          globalSearch={globalSearch}
          initialFilter={learnersFilter}
        />
      )}
      {currentPage === 'learners' && selectedLearnerId && (
        <LearnerDetail id={selectedLearnerId} onBack={() => setSelectedLearnerId(null)} />
      )}
      {currentPage === 'upload' && <UploadPage onNavigate={handleNavigate} />}
    </Layout>
  );
}

export default App;
