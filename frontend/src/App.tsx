import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/dashboard/Dashboard';
import LearnersList from './components/learners/LearnersList';
import UploadPage from './components/upload/UploadPage';
import { LearnerDetail } from './pages/LearnerDetail';
import Reports from './pages/Reports';
import LearnerPortal from './pages/LearnerPortal';
import { api, authStorage } from './lib/api';
import { FormationProvider, useFormation } from './context/FormationContext';
import { FormationSelectorModal } from './components/formation/FormationSelectorModal';
import { Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
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

function AppContent() {
  const { showSelector, setShowSelector } = useFormation();
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => authStorage.isAuthenticated());
  const [isPortalMode, setIsPortalMode] = useState<boolean>(() => checkExplicitPortalRequested());
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [learnersFilter, setLearnersFilter] = useState<string>('');

  // Validate existing stored token on mount, or auto-login in dev/local
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      // 1. If we already have a token stored in localStorage, check its validity
      if (authStorage.isAuthenticated()) {
        try {
          await api.checkAuth();
          if (isMounted) {
            setIsAdminAuthenticated(true);
            setAuthLoading(false);
          }
          return;
        } catch {
          authStorage.removeToken();
        }
      }

      // 2. In local/dev environment, auto-authenticate to directly access the dashboard
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (import.meta.env.DEV || isLocal) {
        try {
          const res = await api.login('Dclic#2026!Coord$Peda');
          authStorage.setToken(res.token);
          if (isMounted) {
            setIsAdminAuthenticated(true);
            setAuthLoading(false);
          }
          return;
        } catch (e) {
          console.warn('[DCLIC] Auto-login dev skipped:', e);
        }
      }

      if (isMounted) {
        setIsAdminAuthenticated(false);
        setAuthLoading(false);
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for admin shortcut (Ctrl+Shift+A or Alt+A) to switch to dashboard/login
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') || (e.altKey && e.key.toLowerCase() === 'a')) {
        e.preventDefault();
        setIsPortalMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await api.login(password.trim());
      authStorage.setToken(res.token);
      setIsAdminAuthenticated(true);
      setIsPortalMode(false);
      setPassword('');

      // Clean URL params if admin was specified
      const url = new URL(window.location.href);
      url.searchParams.delete('admin');
      url.searchParams.delete('portal');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
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

  // 1. Explicit Portal Mode (Learner access)
  if (isPortalMode) {
    return (
      <div className="relative min-h-screen">
        <LearnerPortal />
      </div>
    );
  }

  // 2. Loading state during auth check
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA]">
        <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium text-neutral-500">Connexion à DCLIC Monitoring...</p>
      </div>
    );
  }

  // 3. Coordinator Login Screen if unauthenticated
  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-border bg-card shadow-sm">
          <CardHeader className="text-center pb-3">
            <div className="mx-auto mb-2 text-primary">
              <Lock className="h-7 w-7 mx-auto" strokeWidth={1.75} />
            </div>
            <CardTitle className="text-xl font-bold text-foreground">
              DCLIC Monitoring
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Espace sécurisé de pilotage et de suivi pédagogique
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
                  className="pr-10 h-10 text-sm bg-background border-border"
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
                className="w-full h-10 font-semibold gap-2 cursor-pointer shadow-none"
              >
                {loginLoading ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                Accéder au Dashboard
              </Button>
            </form>

            {loginError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="text-center pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsPortalMode(true)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline"
              >
                Vous êtes apprenant ? Consulter votre progression
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 4. Authenticated Coordinator Interface (Monitoring Dashboard)
  return (
    <>
      <Layout 
        currentPage={currentPage} 
        onNavigate={handleNavigate}
        onSelectLearner={handleSelectLearner}
        globalSearch={globalSearch}
        onSearch={handleGlobalSearch}
        onLogout={handleLogout}
        onOpenPortal={() => setIsPortalMode(true)}
      >
        {currentPage === 'dashboard' && (
          <Dashboard 
            onNavigate={handleNavigate}
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

      {/* Startup / On-demand Formation Selector Modal */}
      <FormationSelectorModal 
        isOpen={showSelector} 
        onClose={() => setShowSelector(false)} 
      />
    </>
  );
}

export default function App() {
  return (
    <FormationProvider>
      <AppContent />
    </FormationProvider>
  );
}
