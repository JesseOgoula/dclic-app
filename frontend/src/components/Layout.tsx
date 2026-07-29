import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Upload,
  BarChart,
  ChevronLeft,
  Bell,
  Search,
} from 'lucide-react';

type Page = 'dashboard' | 'learners' | 'upload' | 'reports';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  alertCount?: number;
  globalSearch?: string;
  onSearch?: (value: string) => void;
}

const NAV_ITEMS: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'reports', label: 'Rapports', icon: BarChart },
  { id: 'learners', label: 'Apprenants', icon: Users },
  { id: 'upload', label: 'Import données', icon: Upload },
];

export default function Layout({ children, currentPage, onNavigate, alertCount = 0, globalSearch = '', onSearch }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

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

            {/* Alerts bell */}
            <button
              className="relative p-2 rounded-full hover:bg-white hover:shadow-sm border border-transparent hover:border-border transition-all bg-white shadow-sm"
              title="Alertes"
            >
              <Bell size={18} className="text-foreground" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </button>

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
