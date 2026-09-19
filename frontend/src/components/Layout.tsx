import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Upload,
  BarChart3,
  ChevronLeft,
  Bell,
  Search,
  AlertTriangle,
  UserX,
  X,
  ExternalLink,
  Check,
  Copy,
  LogOut,
  Target,
  Layers,
  ChevronsUpDown,
} from 'lucide-react';
import { api, type Alert } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Page = 'dashboard' | 'learners' | 'upload' | 'reports';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onSelectLearner?: (id: string) => void;
  alertCount?: number;
  globalSearch?: string;
  onSearch?: (value: string) => void;
  onLogout?: () => void;
  activeProgram?: 'mn' | 'gp';
  onBackToPrograms?: () => void;
  onSelectProgram?: (program: 'mn' | 'gp') => void;
}

interface NavSection {
  title?: string;
  items: { id: Page; label: string; icon: React.ElementType }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Pilotage',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'reports', label: 'Rapports', icon: BarChart3 },
    ],
  },
  {
    title: 'Gestion',
    items: [
      { id: 'learners', label: 'Apprenants', icon: Users },
      { id: 'upload', label: 'Importation', icon: Upload },
    ],
  },
];

export default function Layout({
  children,
  currentPage,
  onNavigate,
  onSelectLearner,
  globalSearch = '',
  onSearch,
  onLogout,
  activeProgram = 'gp',
  onBackToPrograms,
  onSelectProgram,
}: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadAlertCount, setUnreadAlertCount] = useState<number>(0);
  const [portalLinkCopied, setPortalLinkCopied] = useState(false);
  const [programMenuOpen, setProgramMenuOpen] = useState(false);

  const alertsRef = useRef<HTMLDivElement>(null);
  const programMenuRef = useRef<HTMLDivElement>(null);

  const calculateUnread = (items: Alert[]) => {
    try {
      const seenIds = new Set<string>(JSON.parse(localStorage.getItem('dclic_seen_alert_ids') || '[]'));
      const unread = items.filter(a => !a.acknowledged && !seenIds.has(a.id));
      setUnreadAlertCount(unread.length);
    } catch {
      setUnreadAlertCount(items.filter(a => !a.acknowledged).length);
    }
  };

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const data = await api.getAlerts();
        if (data && data.length > 0) {
          setAlerts(data);
          calculateUnread(data);
        } else {
          const stats = await api.getDashboardStats(activeProgram);
          const generated: Alert[] = [];
          
          stats.blocked_learners.slice(0, 5).forEach((b) => {
            generated.push({
              id: `blocked-${b.id}`,
              learner_id: b.id,
              learner_name: `${b.first_name} ${b.last_name}`,
              type: 'blocked',
              message: `Bloqué sur : ${b.failed_modules?.join(', ') || 'activité évaluée'}`,
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
          calculateUnread(generated);
        }
      } catch (err) {
        console.warn('Could not load alerts:', err);
      }
    }

    fetchAlerts();
  }, [currentPage, activeProgram]);

  // Click outside listener for alerts and program menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setAlertsOpen(false);
      }
      if (programMenuRef.current && !programMenuRef.current.contains(event.target as Node)) {
        setProgramMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleAlerts = () => {
    const nextState = !alertsOpen;
    setAlertsOpen(nextState);
    if (nextState) {
      try {
        const currentIds = alerts.map(a => a.id);
        const existingSeen = new Set<string>(JSON.parse(localStorage.getItem('dclic_seen_alert_ids') || '[]'));
        currentIds.forEach(id => existingSeen.add(id));
        localStorage.setItem('dclic_seen_alert_ids', JSON.stringify(Array.from(existingSeen)));
      } catch (e) {
        console.warn('Could not persist seen alerts:', e);
      }
      setUnreadAlertCount(0);
    }
  };

  const currentProgramLabel = activeProgram === 'gp' ? 'Gestion de Projet' : 'Marketing Numérique';
  const currentProgramCohort = activeProgram === 'gp' ? '157 apprenants' : '115 apprenants';
  const currentProgramGroup = activeProgram === 'gp' ? 'G1_GPM_092026' : 'G1_MN_072026';

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col bg-zinc-950 border-r border-zinc-800/80 transition-all duration-300 ease-in-out shrink-0 z-30 select-none',
          collapsed ? 'w-[68px]' : 'w-[248px]'
        )}
      >
        {/* Top window decoration & brand switcher */}
        <div className="p-3 pb-2 flex flex-col gap-2">
          {/* Subtle desktop dots */}
          <div className="flex items-center gap-1.5 px-2 py-1">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
          </div>

          {/* Program switcher card (Untitled UI style) */}
          <div className="relative" ref={programMenuRef}>
            <button
              onClick={() => setProgramMenuOpen(!programMenuOpen)}
              className={cn(
                "w-full flex items-center justify-between p-2 rounded-xl transition-colors border border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700/60 text-left cursor-pointer group",
                collapsed && "justify-center p-2"
              )}
              title="Changer de parcours de formation"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-zinc-100 font-bold text-xs shrink-0 shadow-xs group-hover:border-zinc-500 transition-colors">
                  D
                </div>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-zinc-200 truncate">DCLIC Platform</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {currentProgramLabel}
                    </p>
                  </div>
                )}
              </div>
              {!collapsed && (
                <ChevronsUpDown size={14} className="text-zinc-500 shrink-0 ml-1 group-hover:text-zinc-300 transition-colors" />
              )}
            </button>

            {/* Dropdown Popup */}
            {programMenuOpen && (
              <div className={cn(
                "absolute left-0 top-full mt-1.5 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 p-1.5 animate-fade-in text-zinc-200",
                collapsed && "left-14 top-0 w-64"
              )}>
                <div className="px-2.5 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Parcours de formation
                </div>
                
                {/* GP option */}
                <button
                  onClick={() => {
                    onSelectProgram?.('gp');
                    setProgramMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left",
                    activeProgram === 'gp' ? "bg-zinc-800 text-white font-medium" : "hover:bg-zinc-800/60 text-zinc-300"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded bg-zinc-800 border border-zinc-700/60 flex items-center justify-center shrink-0">
                      <Target size={12} className="text-zinc-300" />
                    </div>
                    <div className="truncate">
                      <p className="font-medium truncate">Gestion de Projet</p>
                      <p className="text-[10px] text-zinc-400">157 apprenants · Spécialisation</p>
                    </div>
                  </div>
                  {activeProgram === 'gp' && <Check size={14} className="text-zinc-100 shrink-0 ml-1" />}
                </button>

                {/* MN option */}
                <button
                  onClick={() => {
                    onSelectProgram?.('mn');
                    setProgramMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left mt-0.5",
                    activeProgram === 'mn' ? "bg-zinc-800 text-white font-medium" : "hover:bg-zinc-800/60 text-zinc-300"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded bg-zinc-800 border border-zinc-700/60 flex items-center justify-center shrink-0">
                      <BarChart3 size={12} className="text-zinc-300" />
                    </div>
                    <div className="truncate">
                      <p className="font-medium truncate">Marketing Numérique</p>
                      <p className="text-[10px] text-zinc-400">115 apprenants · Socle</p>
                    </div>
                  </div>
                  {activeProgram === 'mn' && <Check size={14} className="text-zinc-100 shrink-0 ml-1" />}
                </button>

                {onBackToPrograms && (
                  <>
                    <div className="h-px bg-zinc-800 my-1" />
                    <button
                      onClick={() => {
                        onBackToPrograms();
                        setProgramMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                    >
                      <Layers size={13} className="text-zinc-400" />
                      <span>Vue d'ensemble des parcours</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
          {NAV_SECTIONS.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {!collapsed && section.title && (
                <div className="px-2 pb-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      'w-full flex items-center rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer',
                      collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-2.5 py-2',
                      isActive
                        ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-xs'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} className={cn("shrink-0", isActive ? "text-zinc-100" : "text-zinc-400")} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer with coordinator profile (Untitled UI / Linear style) */}
        <div className="p-3 border-t border-zinc-800/80 mt-auto bg-zinc-950/80">
          <div className={cn(
            "flex items-center justify-between p-2 rounded-xl bg-zinc-900/40 border border-zinc-800/60",
            collapsed && "flex-col gap-2 p-1.5"
          )}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center font-semibold text-[11px] text-zinc-200">
                  CO
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-zinc-950" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-200 truncate">Coordinateur</p>
                  <p className="text-[10px] text-zinc-500 truncate">Session 2026</p>
                </div>
              )}
            </div>

            <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Déconnexion coordinateur"
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "mt-2 w-full flex items-center justify-center p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors cursor-pointer text-xs gap-1.5",
              collapsed && "mt-1.5"
            )}
            title={collapsed ? "Agrandir le menu" : "Réduire le menu"}
          >
            <ChevronLeft size={14} className={cn("transition-transform", collapsed && "rotate-180")} />
            {!collapsed && <span>Réduire</span>}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Header Bar */}
        <header className="h-14 bg-background/95 backdrop-blur-md border-b border-border/80 flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
              <span>{NAV_SECTIONS.flatMap(s => s.items).find(n => n.id === currentPage)?.label || 'Dashboard'}</span>
              <span className="text-zinc-600 font-normal">/</span>
              <span className="text-xs font-normal text-zinc-400">{currentProgramLabel}</span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="hidden md:flex relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={globalSearch}
                onChange={(e) => onSearch?.(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-zinc-900/80 rounded-lg border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700 focus:border-zinc-700 w-56 transition-all"
              />
            </div>

            {/* Copy Unique Learner Portal Link */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const portalUrl = `${window.location.origin}/?portal=true&program=${activeProgram}`;
                navigator.clipboard.writeText(portalUrl);
                setPortalLinkCopied(true);
                setTimeout(() => setPortalLinkCopied(false), 2500);
              }}
              className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-lg border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs font-normal cursor-pointer shadow-none"
              title="Copier le lien unique à partager avec les apprenants"
            >
              {portalLinkCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} className="text-zinc-400" />}
              <span>{portalLinkCopied ? 'Lien copié' : 'Lien apprenants'}</span>
            </Button>

            {/* Alerts bell & Popover */}
            <div className="relative" ref={alertsRef}>
              <button
                onClick={handleToggleAlerts}
                className="relative p-2 rounded-lg hover:bg-zinc-900 border border-zinc-800/80 transition-colors bg-zinc-900/50 text-zinc-300 hover:text-zinc-100 cursor-pointer"
                title="Alertes"
              >
                <Bell size={15} />
                {unreadAlertCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-zinc-100 text-zinc-950 text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadAlertCount > 99 ? '99+' : unreadAlertCount}
                  </span>
                )}
              </button>

              {alertsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl z-50 overflow-hidden animate-fade-in text-zinc-200">
                  <div className="p-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs text-zinc-200">Alertes & Risques</span>
                      <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 bg-zinc-900 border-zinc-800 text-zinc-400">
                        {alerts.length}
                      </Badge>
                    </div>
                    <button
                      onClick={() => setAlertsOpen(false)}
                      className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <div className="max-h-[320px] overflow-y-auto divide-y divide-zinc-800/60">
                    {alerts.length === 0 ? (
                      <div className="p-6 text-center text-xs text-zinc-500">
                        Aucune alerte active
                      </div>
                    ) : (
                      alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={cn(
                            "p-3 flex items-start justify-between gap-3 hover:bg-zinc-800/30 transition-colors",
                            alert.acknowledged ? "opacity-60" : ""
                          )}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="p-1 rounded bg-zinc-800 text-zinc-300 mt-0.5 shrink-0">
                              {alert.type === 'blocked' ? <UserX size={13} /> : <AlertTriangle size={13} />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-xs text-zinc-200 truncate">
                                {alert.learner_name || 'Apprenant'}
                              </p>
                              <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                                {alert.message}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {onSelectLearner && (
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                  onSelectLearner(alert.learner_id);
                                  setAlertsOpen(false);
                                }}
                                className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-100"
                                title="Voir profil"
                              >
                                <ExternalLink size={12} />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2 border-t border-zinc-800 bg-zinc-950 text-center">
                    <button
                      onClick={() => {
                        onNavigate('learners');
                        setAlertsOpen(false);
                      }}
                      className="text-xs text-zinc-400 hover:text-zinc-200 font-medium w-full py-1 cursor-pointer transition-colors"
                    >
                      Voir tous les apprenants en risque
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Cohort tag */}
            <div className="px-2.5 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs font-mono text-zinc-400">
              {currentProgramGroup}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
