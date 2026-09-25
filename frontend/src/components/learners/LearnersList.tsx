import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  ChevronUp,
  ChevronDown,
  Download,
  AlertTriangle,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, type LearnerWithProgress } from '@/lib/api';
import { useFormation } from '@/context/FormationContext';

interface LearnersListProps {
  onSelectLearner?: (id: string) => void;
  globalSearch?: string;
  initialFilter?: string;
}

export default function LearnersList({ onSelectLearner, globalSearch = '', initialFilter = '' }: LearnersListProps) {
  const { currentFormation, formationTitle, formationCategory, groupId } = useFormation();
  const [learners, setLearners] = useState<LearnerWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [sortBy, setSortBy] = useState('last_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [stats, setStats] = useState<{
    active: number;
    inactive: number;
    dropped: number;
    blocked: number;
    completed_phase1: number;
    completed: number;
    total: number;
  } | null>(null);

  const loadLearners = useCallback(async () => {
    try {
      setLoading(true);
      const effectiveSearch = search || globalSearch || undefined;
      const data = await api.getLearners({
        search: effectiveSearch,
        status: statusFilter || undefined,
        sortBy,
        sortDir,
        formation: currentFormation,
      });
      setLearners(data);
    } catch (err) {
      console.error('Failed to load learners:', err);
    } finally {
      setLoading(false);
    }
  }, [search, globalSearch, statusFilter, sortBy, sortDir, currentFormation]);

  useEffect(() => {
    setStatusFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    api.getDashboardStats(currentFormation).then(data => {
      setStats({
        total: data.total_learners,
        active: data.active_learners,
        inactive: data.inactive_learners,
        dropped: data.dropped_learners,
        blocked: data.blocked_learners.length,
        completed_phase1: data.completed_phase1_learners,
        completed: data.completed_learners,
      });
    }).catch(console.error);
  }, [currentFormation]);

  useEffect(() => {
    loadLearners();
  }, [loadLearners]);

  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ArrowUpDown size={12} className="text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortDir === 'asc' ? <ChevronUp size={13} className="text-neutral-900" /> : <ChevronDown size={13} className="text-neutral-900" />;
  };

  const renderStatusBadge = (status: string, isBlocked?: boolean) => {
    if (isBlocked && status !== 'dropped') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-50 text-red-700 border border-red-200/60">
          Bloqué
        </span>
      );
    }

    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
            Actif
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200/60">
            Inactif
          </span>
        );
      case 'dropped':
      case 'at_risk':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
            Décroché
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            Terminé
          </span>
        );
      case 'completed_phase1':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            Phase 1
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-50 text-neutral-600 border border-neutral-200/60">
            {status}
          </span>
        );
    }
  };

  const handleExportCSV = () => {
    if (learners.length === 0) return;
    const headers = ['Nom', 'Prénom', 'Email', 'Groupe', 'Statut', 'Complétion (%)', 'Activités complétées', 'Total activités', 'Jours inactif'];
    const rows = learners.map(l => [
      `"${l.last_name}"`,
      `"${l.first_name}"`,
      `"${l.email}"`,
      `"${l.group_id}"`,
      `"${l.status}"`,
      l.completion_rate,
      l.completed_activities,
      l.total_activities,
      l.days_inactive > 900 ? 'Jamais' : l.days_inactive,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Apprenants_${statusFilter || 'tous'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filterTabs = [
    { id: '', label: 'Tous', count: stats?.total },
    { id: 'active', label: 'Actifs', count: stats?.active },
    { id: 'inactive', label: 'Inactifs', count: stats?.inactive },
    { id: 'dropped', label: 'Décrochés', count: stats?.dropped },
    { id: 'blocked', label: 'Bloqués', count: stats?.blocked },
    { id: 'completed', label: 'Terminés', count: stats?.completed },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header (Clean ClickUp Title & Subtitle) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Apprenants
          </h1>
          <p className="text-xs text-neutral-500 font-medium mt-1">
            {formationCategory} · <span className="text-neutral-900 font-semibold">{formationTitle}</span> ({groupId})
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={learners.length === 0}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E2E8F0] hover:bg-neutral-50 bg-white text-xs font-medium text-neutral-700 transition-colors shadow-none cursor-pointer disabled:opacity-50"
            title="Exporter la liste des apprenants au format CSV"
          >
            <Download size={13} className="text-neutral-500" />
            <span>Exporter CSV</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Bar (Minimalist Segmented Row) */}
      {stats && (
        <div className="bg-white border border-[#F1F5F9] rounded-2xl p-6 grid grid-cols-2 md:grid-cols-4 gap-6 divide-y md:divide-y-0 md:divide-x divide-[#F1F5F9]">
          <div>
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Effectif Total
            </div>
            <div className="text-3xl font-bold tracking-tight text-neutral-900">
              {stats.total}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              inscrits dans la cohorte
            </div>
          </div>

          <div className="pt-4 md:pt-0 md:pl-6">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Apprenants Actifs
            </div>
            <div className="text-3xl font-bold tracking-tight text-neutral-900">
              {stats.active}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% de mobilisation
            </div>
          </div>

          <div className="pt-4 md:pt-0 md:pl-6">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Décrochage
            </div>
            <div className="text-3xl font-bold tracking-tight text-amber-600">
              {stats.dropped}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              inactivité prolongée
            </div>
          </div>

          <div className="pt-4 md:pt-0 md:pl-6">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Bloqués
            </div>
            <div className="text-3xl font-bold tracking-tight text-red-600">
              {stats.blocked}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              devoir / note &lt; 10
            </div>
          </div>
        </div>
      )}

      {/* 3. Search and Status Filter Pills */}
      <div className="bg-white border border-[#F1F5F9] rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* ClickUp Pills for Status Filters */}
        <div className="flex flex-wrap items-center gap-1">
          {filterTabs.map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5",
                  isActive
                    ? "bg-neutral-100 text-neutral-900 font-semibold"
                    : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50"
                )}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={cn(
                    "text-[10px] font-mono px-1 py-0.2 rounded",
                    isActive ? "text-neutral-700 bg-neutral-200/60" : "text-neutral-400"
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search input with shortcut badge */}
        <div className="relative flex items-center min-w-[240px]">
          <Search size={14} className="absolute left-3 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Filtrer par nom ou courriel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8.5 pr-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] focus:border-neutral-400 focus:bg-white rounded-lg text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* 4. Table Container (Exact ClickUp Style) */}
      <div className="bg-white border border-[#F1F5F9] rounded-2xl overflow-hidden shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#F1F5F9] text-[11px] font-semibold text-neutral-400 uppercase tracking-wider bg-white">
                <th
                  onClick={() => toggleSort('last_name')}
                  className="py-3 px-6 cursor-pointer hover:text-neutral-700 group transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Apprenant</span>
                    <SortIcon field="last_name" />
                  </div>
                </th>
                <th className="py-3 px-6 hidden sm:table-cell">Courriel</th>
                <th
                  onClick={() => toggleSort('completion_rate')}
                  className="py-3 px-6 cursor-pointer hover:text-neutral-700 group transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Progression</span>
                    <SortIcon field="completion_rate" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('days_inactive')}
                  className="py-3 px-6 text-center cursor-pointer hover:text-neutral-700 group transition-colors select-none"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Inactivité</span>
                    <SortIcon field="days_inactive" />
                  </div>
                </th>
                <th className="py-3 px-6 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] text-xs">
              {loading && learners.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-neutral-400">
                    <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin mx-auto mb-2" />
                    Chargement des apprenants...
                  </td>
                </tr>
              ) : learners.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-neutral-400">
                    <p className="text-sm font-medium text-neutral-700">Aucun apprenant trouvé</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Ajustez vos filtres de recherche pour afficher des résultats
                    </p>
                  </td>
                </tr>
              ) : (
                learners.map((learner) => (
                  <tr
                    key={learner.id}
                    onClick={() => onSelectLearner?.(learner.id)}
                    className="hover:bg-neutral-50/80 transition-colors cursor-pointer group"
                  >
                    {/* Nom & Alertes */}
                    <td className="py-3.5 px-6">
                      <div className="min-w-0">
                        <p className="font-semibold text-neutral-900 group-hover:text-blue-600 transition-colors">
                          {learner.first_name} {learner.last_name}
                        </p>
                        {learner.unvalidated_assignments && learner.unvalidated_assignments.length > 0 && (
                          <p
                            className="text-[11px] text-red-600 flex items-center gap-1 mt-0.5 truncate max-w-md"
                            title={learner.unvalidated_assignments.map((u) => u.name).join(', ')}
                          >
                            <AlertTriangle size={11} className="shrink-0" />
                            <span>
                              À régulariser : {learner.unvalidated_assignments.map((u) => (u.name.toLowerCase().includes('lettre') ? 'Lettre' : u.name.split('.')[0].trim())).join(', ')}
                            </span>
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-6 text-neutral-400 font-mono text-[11px] hidden sm:table-cell">
                      {learner.email}
                    </td>

                    {/* Progression bar */}
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-28 sm:w-36 bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(learner.completion_rate, learner.completion_rate > 0 ? 4 : 0))}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs font-semibold text-neutral-900 w-10">
                          {learner.completion_rate}%
                        </span>
                      </div>
                    </td>

                    {/* Inactivité */}
                    <td className="py-3.5 px-6 text-center">
                      <span className={cn(
                        'text-xs font-medium',
                        learner.days_inactive > 14 ? 'text-red-600 font-semibold' :
                        learner.days_inactive > 7 ? 'text-amber-600' :
                        learner.days_inactive > 900 ? 'text-red-600' : 'text-neutral-400'
                      )}>
                        {learner.days_inactive > 900 ? 'Jamais' : `${learner.days_inactive}j`}
                      </span>
                    </td>

                    {/* Statut */}
                    <td className="py-3.5 px-6 text-right">
                      {renderStatusBadge(learner.status, learner.is_blocked)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-[#F1F5F9] text-xs text-neutral-400 flex items-center justify-between">
          <span>{learners.length} apprenant{learners.length > 1 ? 's' : ''} affiché{learners.length > 1 ? 's' : ''}</span>
          <span className="font-mono text-[11px] text-neutral-400">{groupId}</span>
        </div>
      </div>
    </div>
  );
}
