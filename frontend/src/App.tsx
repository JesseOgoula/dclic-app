import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/dashboard/Dashboard';
import LearnersList from './components/learners/LearnersList';
import UploadPage from './components/upload/UploadPage';
import { LearnerDetail } from './pages/LearnerDetail';
import Reports from './pages/Reports';
import LearnerPortal from './pages/LearnerPortal';
import { api, authStorage } from './lib/api';
import { Lock, Eye, EyeOff, X, AlertTriangle } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';

type Page = 'dashboard' | 'learners' | 'upload' | 'reports';

function checkExplicitPortalRequested(): boolean {
  const path = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  return (
    path.includes('/portal') ||
    path.includes('/apprenant') ||
    params.has('portal') ||
    params.has('email')
  );
}

function checkAdminRequested(): boolean {
  const path = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  return path.includes('/admin') || path.includes('/coordinateur') || params.has('admin');
}

function App() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => authStorage.isAuthenticated());
  const [showLoginModal, setShowLoginModal] = useState<boolean>(() => checkAdminRequested());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [learnersFilter, setLearnersFilter] = useState<string>('');

  // Validate existing stored token on mount
  useEffect(() => {
    if (authStorage.isAuthenticated()) {
      api.checkAuth()
        .then(() => setIsAdminAuthenticated(true))
        .catch(() => {
          authStorage.removeToken();
          setIsAdminAuthenticated(false);
        });
    }
  }, []);

  // Handle URL changes
  useEffect(() => {
    if (checkAdminRequested() && !isAdminAuthenticated) {
      setShowLoginModal(true);
    }
  }, [isAdminAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await api.login(password.trim());
      authStorage.setToken(res.token);
      setIsAdminAuthenticated(true);
      setShowLoginModal(false);
      setPassword('');

      // Clean URL params if admin was specified
      const url = new URL(window.location.href);
      url.searchParams.delete('admin');
      window.history.replaceState({}, '', url.toString());
    } catch (err: any) {
      setLoginError(err.message || 'Mot de passe coordinateur incorrect.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    api.logout();
    setIsAdminAuthenticated(false);
    setCurrentPage('dashboard');
    setSelectedLearnerId(null);
  };

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

  // If NOT authenticated as admin or explicitly in portal mode:
  // Render ONLY LearnerPortal with secure login modal available
  const isExplicitPortal = checkExplicitPortalRequested();

  if (!isAdminAuthenticated || isExplicitPortal) {
    return (
      <div className="relative min-h-screen">
        <LearnerPortal onOpenCoordinatorLogin={() => setShowLoginModal(true)} />

        {/* Modal de connexion Coordinateur */}
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <Card className="w-full max-w-md border-border bg-card shadow-2xl relative">
              <button
                type="button"
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginError(null);
                  setPassword('');
                }}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-md cursor-pointer"
                title="Fermer"
              >
                <X className="h-4 w-4" />
              </button>

              <CardHeader className="text-center pb-3">
                <div className="mx-auto mb-2 text-primary">
                  <Lock className="h-8 w-8 mx-auto" />
                </div>
                <CardTitle className="text-xl font-bold text-foreground">
                  Accès Coordinateur
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Espace sécurisé de pilotage et de suivi pédagogique DCLIC
                </p>
              </CardHeader>

              <CardContent className="space-y-4 pt-2">
                <form onSubmit={handleLogin} className="space-y-3">
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mot de passe coordinateur"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10 h-11 text-base bg-background"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <Button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full h-11 font-semibold gap-2 cursor-pointer"
                  >
                    {loginLoading ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    Se connecter
                  </Button>
                </form>

                {loginError && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2 border border-destructive/20">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLoginModal(false);
                      setLoginError(null);
                      setPassword('');
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline"
                  >
                    Retour à l'espace apprenant
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // Authenticated Coordinator Interface
  return (
    <Layout 
      currentPage={currentPage} 
      onNavigate={handleNavigate}
      onSelectLearner={handleSelectLearner}
      globalSearch={globalSearch}
      onSearch={handleGlobalSearch}
      onLogout={handleLogout}
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
