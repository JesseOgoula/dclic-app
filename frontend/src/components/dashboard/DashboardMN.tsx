import React, { useState } from 'react';
import { BarChart3, GraduationCap, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Dashboard from './Dashboard';
import DashboardPP from './DashboardPP';

interface DashboardMNProps {
  onSelectLearner?: (id: string) => void;
  globalSearch?: string;
  onViewAll?: (filter: string) => void;
  onNavigate?: (page: any) => void;
}

export default function DashboardMN({
  onSelectLearner,
  globalSearch = '',
  onViewAll,
  onNavigate,
}: DashboardMNProps) {
  const [activeTab, setActiveTab] = useState<'progression' | 'projet-pro'>(() => {
    return (localStorage.getItem('dclic_mn_tab') as 'progression' | 'projet-pro') || 'progression';
  });

  const handleTabChange = (tab: 'progression' | 'projet-pro') => {
    setActiveTab(tab);
    localStorage.setItem('dclic_mn_tab', tab);
  };

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Marketing Numérique</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              G1_MN_072026
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Suivi consolidé de la formation socle et des 6 livrables du Projet Professionnel
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-muted/60 border border-border rounded-xl self-start sm:self-center">
          <Button
            variant={activeTab === 'progression' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange('progression')}
            className={cn(
              "h-8 text-xs font-medium gap-2 cursor-pointer transition-all",
              activeTab !== 'progression' && "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Progression Moodle</span>
          </Button>

          <Button
            variant={activeTab === 'projet-pro' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTabChange('projet-pro')}
            className={cn(
              "h-8 text-xs font-medium gap-2 cursor-pointer transition-all",
              activeTab !== 'projet-pro' && "text-muted-foreground hover:text-foreground"
            )}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Projet Professionnel (PP)</span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] rounded-full bg-primary/20 text-primary font-bold">
              <Sparkles className="w-2.5 h-2.5" />
              IA
            </span>
          </Button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'progression' ? (
        <div className="animate-fade-in">
          <Dashboard
            onSelectLearner={onSelectLearner}
            globalSearch={globalSearch}
            onViewAll={onViewAll}
          />
        </div>
      ) : (
        <div className="animate-fade-in">
          <DashboardPP
            onNavigate={onNavigate}
            globalSearch={globalSearch}
          />
        </div>
      )}
    </div>
  );
}
