import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Upload,
  BarChart,
  ChevronLeft,
  Bell,
  Search,
  AlertTriangle,
  UserX,
  X,
  ExternalLink,
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
}

const NAV_ITEMS: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'reports', label: 'Rapports', icon: BarChart },
  { id: 'learners', label: 'Apprenants', icon: Users },
  { id: 'upload', label: 'Import', icon: Upload },
];

export default function Layout({
  children,
  currentPage,
  onNavigate,
  onSelectLearner,
  globalSearch = '',
  onSearch,
}: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadAlertCount, setUnreadAlertCount] = useState<number>(0);
  const alertsRef = useRef<HTMLDivElement>(null);

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
    // Load active alerts or generate from dashboard at-risk data
    async function fetchAlerts() {
      try {
        const data = await api.getAlerts();
        if (data && data.length > 0) {
          setAlerts(data);
          calculateUnread(data);
        } else {
          // Fallback: check dashboard stats for at-risk/blocked learners
          const stats = await api.getDashboardStats();
          const generated: Alert[] = [];
          
          stats.blocked_learners.slice(0, 5).forEach((b) => {
            generated.push({
              id: `blocked-${b.id}`,
              learner_id: b.id,
              learner_name: `${b.first_name} ${b.last_name}`,
              type: 'blocked',
              message: `Bloqué sur : ${b.failed_modules?.join(', ') || 'activité'}`,
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
  }, [currentPage]);

  // Click outside listener for alerts dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setAlertsOpen(false);
      }
    }
    if (alertsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [alertsOpen]);

  const handleToggleAlerts = () => {
    const nextState = !alertsOpen;
    setAlertsOpen(nextState);
    if (nextState) {
      // When drawer is opened, mark current alerts as seen so badge disappears
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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col bg-sidebar border-r border-border transition-all duration-300 ease-in-out shrink-0',
          collapsed ? 'w-[72px]' : 'w-[200px]'
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center gap-3 py-6 shrink-0", collapsed ? "justify-center px-0" : "px-6")}>
          <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white font-bold text-xl shrink-0">
            D
          </div>
          {!collapsed && (
            <div className="animate-fade-in font-bold text-lg text-foreground tracking-tight flex items-center gap-1">
              <span className="text-muted-foreground text-sm font-normal">Monitoring</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 py-4 space-y-2 overflow-y-auto", collapsed ? "px-2" : "px-4")}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200 group',
                  collapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                title={collapsed ? item.label : undefined}
              >
                <div className={cn(
                  "flex items-center justify-center rounded-lg transition-colors shrink-0",
                  collapsed ? "p-2.5" : "p-1.5",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                )}>
                  <Icon size={20} strokeWidth={2.5} />
                </div>
                {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className={cn("p-4 mt-auto", collapsed && "px-2")}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "w-full flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
              collapsed ? "py-3" : "gap-2 px-3 py-2"
            )}
          >
            <ChevronLeft
              size={20}
              className={cn('transition-transform', collapsed && 'rotate-180')}
            />
            {!collapsed && <span className="text-sm font-medium">Réduire</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-background flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground tracking-tight">
                {NAV_ITEMS.find(n => n.id === currentPage)?.label || 'Dashboard'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="hidden md:flex relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={globalSearch}
                onChange={(e) => onSearch?.(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white rounded-full border border-border shadow-sm text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-64 transition-all"
              />
            </div>

            {/* Alerts bell & Popover */}
            <div className="relative" ref={alertsRef}>
              <button
                onClick={handleToggleAlerts}
                className="relative p-2 rounded-full hover:bg-white hover:shadow-sm border border-transparent hover:border-border transition-all bg-white shadow-sm cursor-pointer"
                title="Alertes"
              >
                <Bell size={18} className="text-foreground" />
                {unreadAlertCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadAlertCount > 99 ? '99+' : unreadAlertCount}
                  </span>
                )}
              </button>

              {alertsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card rounded-xl border border-border shadow-xl z-50 overflow-hidden animate-fade-in">
                  <div className="p-3.5 bg-muted/40 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">Alertes et Risques</span>
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                        {alerts.length}
                      </Badge>
                    </div>
                    <button
                      onClick={() => setAlertsOpen(false)}
                      className="text-muted-foreground hover:text-foreground p-1 rounded-md cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="max-h-[320px] overflow-y-auto divide-y divide-border">
                    {alerts.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        Aucune alerte active
                      </div>
                    ) : (
                      alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={cn(
                            "p-3 flex items-start justify-between gap-3 hover:bg-muted/20 transition-colors",
                            alert.acknowledged ? "opacity-60" : ""
                          )}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="p-1 rounded bg-destructive/10 text-destructive mt-0.5 shrink-0">
                              {alert.type === 'blocked' ? <UserX size={14} /> : <AlertTriangle size={14} />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-xs text-foreground truncate">
                                {alert.learner_name || 'Apprenant'}
                              </p>
                              <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
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
                                className="h-7 w-7 p-0"
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

                  <div className="p-2 border-t border-border bg-muted/20 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onNavigate('learners');
                        setAlertsOpen(false);
                      }}
                      className="text-xs text-primary font-medium w-full h-8"
                    >
                      Voir tous les apprenants en risque
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Date range */}
            <div className="px-4 py-2 rounded-full bg-white border border-border shadow-sm text-sm font-medium text-foreground flex items-center gap-2">
              <span className="w-8 h-4 rounded-full bg-foreground flex items-center justify-end px-1">
                <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
              </span>
              27 Jul — 25 Sep 2026
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-6 pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}
