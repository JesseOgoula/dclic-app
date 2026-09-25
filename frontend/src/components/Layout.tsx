import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  Users,
  BarChart3,
  UploadCloud,
  Bell,
  Search,
  AlertTriangle,
  UserX,
  X,
  ExternalLink,
  Check,
  Copy,
  LogOut,
  ChevronDown,
  Layers,
  Briefcase,
  SlidersHorizontal,
  Command,
} from 'lucide-react';
import { api, type Alert, type FormationType } from '@/lib/api';
import { useFormation } from '@/context/FormationContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type Page = 'dashboard' | 'learners' | 'upload' | 'reports';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onSelectLearner?: (id: string) => void;
  globalSearch?: string;
  onSearch?: (value: string) => void;
  onLogout?: () => void;
}

export default function Layout({
  children,
  currentPage,
  onNavigate,
  onSelectLearner,
  globalSearch = '',
  onSearch,
  onLogout,
}: LayoutProps) {
  const { currentFormation, setFormation, formationTitle, formationCategory, setShowSelector } = useFormation();
  const [formationDropdownOpen, setFormationDropdownOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadAlertCount, setUnreadAlertCount] = useState<number>(0);
  const [portalLinkCopied, setPortalLinkCopied] = useState(false);

  const alertsRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Cmd+K / Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch alerts for active formation
  useEffect(() => {
    async function fetchAlerts() {
      try {
        const stats = await api.getDashboardStats(currentFormation);
        const generated: Alert[] = [];

        stats.blocked_learners.slice(0, 5).forEach((b) => {
          generated.push({
            id: `blocked-${b.id}`,
            learner_id: b.id,
            learner_name: `${b.first_name} ${b.last_name}`,
            type: 'blocked',
            message: `Retard / devoir non validé : ${b.failed_modules?.join(', ') || 'activité'}`,
            acknowledged: false,
            triggered_at: new Date().toISOString(),
          });
        });

        stats.at_risk.slice(0, 5).forEach((r) => {
          generated.push({
            id: `risk-${r.id}`,
            learner_id: r.id,
            learner_name: `${r.first_name} ${r.last_name}`,
            type: 'dropout_risk',
            message: `${r.days_inactive > 900 ? 'Jamais connecté' : `${r.days_inactive} jours d'inactivité`}`,
            acknowledged: false,
            triggered_at: new Date().toISOString(),
          });
        });

        setAlerts(generated);
        setUnreadAlertCount(generated.length);
      } catch (err) {
        console.warn('Could not load alerts:', err);
      }
    }

    fetchAlerts();
  }, [currentFormation, currentPage]);

  // Click outside listener for dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setAlertsOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setFormationDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyPortalLink = () => {
    const portalUrl = `${window.location.origin}/?portal=true&formation=${currentFormation}`;
    navigator.clipboard.writeText(portalUrl);
    setPortalLinkCopied(true);
    setTimeout(() => setPortalLinkCopied(false), 2200);
  };

  const navTabs: { id: Page; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Overview', icon: LayoutGrid },
    { id: 'learners', label: 'Apprenants', icon: Users },
    { id: 'reports', label: 'Rapports', icon: BarChart3 },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#FAFAFA]">
      {/* Top Navigation Bar */}
      <header className="h-14 bg-white border-b border-[#F1F5F9] px-4 sm:px-6 flex items-center justify-between shrink-0 z-10">
        {/* Left: Formation Switcher & Horizontal Navigation Tabs */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          {/* Formation Switcher Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setFormationDropdownOpen(!formationDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E2E8F0] hover:border-neutral-300 bg-white text-xs font-semibold text-neutral-900 transition-all cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
              <span className="truncate max-w-[130px] sm:max-w-[200px]">
                {formationTitle}
              </span>
              <span className="text-[10px] text-neutral-400 font-normal hidden md:inline">
                ({formationCategory})
              </span>
              <ChevronDown size={13} className="text-neutral-400 ml-0.5" />
            </button>

              {/* Dropdown Menu */}
              {formationDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-64 bg-white border border-[#E2E8F0] rounded-xl p-1.5 shadow-none z-50 animate-fade-in">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                    Espaces de formation
                  </div>
                  
                  {/* Gestion de Projet */}
                  <button
                    type="button"
                    onClick={() => {
                      setFormation('gp');
                      setFormationDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer",
                      currentFormation === 'gp'
                        ? "bg-neutral-100 text-neutral-900 font-semibold"
                        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Briefcase size={14} className="text-neutral-500" />
                      <div>
                        <p className="leading-tight">Gestion de projet</p>
                        <p className="text-[10px] text-neutral-400">Module de spécialisation</p>
                      </div>
                    </div>
                    {currentFormation === 'gp' && <Check size={14} className="text-neutral-900" />}
                  </button>

                  {/* Marketing Numérique */}
                  <button
                    type="button"
                    onClick={() => {
                      setFormation('mn');
                      setFormationDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer mt-0.5",
                      currentFormation === 'mn'
                        ? "bg-neutral-100 text-neutral-900 font-semibold"
                        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-neutral-500" />
                      <div>
                        <p className="leading-tight">Marketing numérique</p>
                        <p className="text-[10px] text-neutral-400">Formation initiale</p>
                      </div>
                    </div>
                    {currentFormation === 'mn' && <Check size={14} className="text-neutral-900" />}
                  </button>

                  <div className="border-t border-[#F1F5F9] mt-1.5 pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setFormationDropdownOpen(false);
                        setShowSelector(true);
                      }}
                      className="w-full text-center px-2 py-1.5 text-[11px] text-neutral-500 hover:text-neutral-900 font-medium cursor-pointer"
                    >
                      Vue d'ensemble des cohortes...
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Horizontal Tabs (ClickUp Style) */}
            <div className="hidden sm:flex items-center gap-1 border-l border-[#F1F5F9] pl-6">
              {navTabs.map((tab) => {
                const isActive = currentPage === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onNavigate(tab.id)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer",
                      isActive
                        ? "text-neutral-900 bg-neutral-100 font-semibold"
                        : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Controls: Search, Quick Actions, Alerts, Avatar */}
          <div className="flex items-center gap-3">
            {/* Search Input with shortcut */}
            <div className="hidden md:flex relative items-center">
              <Search size={14} className="absolute left-3 text-neutral-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Rechercher..."
                value={globalSearch}
                onChange={(e) => onSearch?.(e.target.value)}
                className="pl-8.5 pr-8 py-1.5 bg-[#F8FAFC] border border-transparent focus:border-[#E2E8F0] focus:bg-white rounded-lg text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none w-52 transition-all"
              />
              <span className="absolute right-2.5 flex items-center gap-0.5 text-[10px] text-neutral-400 bg-neutral-200/60 px-1 py-0.5 rounded font-mono pointer-events-none">
                <Command size={9} />K
              </span>
            </div>

            {/* Quick Action: Share Portal Link */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyPortalLink}
              className="h-8 px-2.5 text-xs font-medium border-[#E2E8F0] text-neutral-700 bg-white hover:bg-neutral-50 rounded-lg gap-1.5 shadow-none cursor-pointer"
              title="Copier le lien d'accès apprenant pour ce module"
            >
              {portalLinkCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              <span className="hidden lg:inline">{portalLinkCopied ? 'Lien copié' : 'Lien apprenant'}</span>
            </Button>

            {/* Quick Action: Import Button */}
            <button
              type="button"
              onClick={() => onNavigate('upload')}
              className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-white cursor-pointer transition-colors"
            >
              <UploadCloud size={13} />
              <span>Importer</span>
            </button>

            {/* Notifications Bell */}
            <div className="relative" ref={alertsRef}>
              <button
                type="button"
                onClick={() => setAlertsOpen(!alertsOpen)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer relative"
                title="Alertes pédagogiques"
              >
                <Bell size={16} />
                {unreadAlertCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-600" />
                )}
              </button>

              {alertsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-none z-50 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-neutral-900">Alertes apprenants</span>
                      <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-mono">
                        {alerts.length}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAlertsOpen(false)}
                      className="text-neutral-400 hover:text-neutral-700 p-0.5 cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto divide-y divide-[#F1F5F9] my-1">
                    {alerts.length === 0 ? (
                      <div className="py-6 text-center text-xs text-neutral-400">
                        Aucune alerte pour cette formation
                      </div>
                    ) : (
                      alerts.map((alert) => (
                        <div key={alert.id} className="py-2.5 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-neutral-900 truncate">
                              {alert.learner_name}
                            </p>
                            <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                              {alert.message}
                            </p>
                          </div>
                          {onSelectLearner && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectLearner(alert.learner_id);
                                setAlertsOpen(false);
                              }}
                              className="text-neutral-400 hover:text-neutral-900 p-1 shrink-0 cursor-pointer"
                              title="Voir détails"
                            >
                              <ExternalLink size={12} />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#F1F5F9]">
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate('learners');
                        setAlertsOpen(false);
                      }}
                      className="w-full text-center text-[11px] text-neutral-600 hover:text-neutral-900 font-medium cursor-pointer"
                    >
                      Voir tous les apprenants
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Logout button */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-neutral-100 transition-colors cursor-pointer"
                title="Déconnexion"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </header>

      {/* Content View */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
