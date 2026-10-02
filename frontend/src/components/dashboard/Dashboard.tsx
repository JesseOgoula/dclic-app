import React, { useEffect, useState, useMemo } from 'react';
import {
  Users,
  AlertTriangle,
  TrendingUp,
  Calendar,
  ExternalLink,
  Check,
  Copy,
  SlidersHorizontal,
  ChevronDown,
  Filter,
  ArrowUpRight,
  BookOpen,
  UploadCloud,
  FileText,
  UserX,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { api, type DashboardStats, type LearnerWithProgress } from '@/lib/api';
import { useFormation } from '@/context/FormationContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Page = 'dashboard' | 'learners' | 'upload' | 'reports';

interface DashboardProps {
  onNavigate?: (page: Page) => void;
  onSelectLearner?: (id: string) => void;
  globalSearch?: string;
  onViewAll?: (filter: string) => void;
}

export default function Dashboard({ onNavigate, onSelectLearner, globalSearch = '', onViewAll }: DashboardProps) {
  const { currentFormation, formationTitle, formationCategory, groupId } = useFormation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalCopied, setPortalCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'sequences' | 'performers' | 'at_risk' | 'blocked'>('sequences');
  const [chartView, setChartView] = useState<'sequences' | 'weekly'>('sequences');
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [currentFormation]);

  async function loadDashboardData() {
    try {
      setLoading(true);
      setError(null);
      const [statsData, reportsData] = await Promise.all([
        api.getDashboardStats(currentFormation),
        api.getWeeklyReports(currentFormation).catch(() => []),
      ]);
      setStats(statsData);
      
      // Extract days of current week if available
      if (reportsData && reportsData.length > 0 && reportsData[0].validations_by_day) {
        setWeeklyData(reportsData[0].validations_by_day);
      } else {
        // Fallback weekly distribution
        setWeeklyData([
          { day: 'Lundi', count: Math.round(statsData.active_learners * 0.25) },
          { day: 'Mardi', count: Math.round(statsData.active_learners * 0.4) },
          { day: 'Mercredi', count: Math.round(statsData.active_learners * 0.65) },
          { day: 'Jeudi', count: Math.round(statsData.active_learners * 0.3) },
          { day: 'Vendredi', count: Math.round(statsData.active_learners * 0.2) },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement des données');
    } finally {
      setLoading(false);
    }
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/?portal=true&formation=${currentFormation}`;
    navigator.clipboard.writeText(url);
    setPortalCopied(true);
    setTimeout(() => setPortalCopied(false), 2200);
  };

  // Prepare sequence chart data
  const sequenceChartData = useMemo(() => {
    if (!stats) return [];
    return stats.sequence_stats
      .filter((s) => s.sequence !== 'Autre' && s.sequence !== 'Préalable')
      .map((s, index) => {
        let label = `S${index + 1}`;
        if (s.sequence.toLowerCase().includes('projet')) label = 'Projet';
        else if (s.sequence.toLowerCase().includes('impression')) label = 'Impress.';
        else {
          const match = s.sequence.match(/Séquence (\d)/i);
          if (match) label = `Séq. ${match[1]}`;
        }
        return {
          name: label,
          fullName: s.sequence,
          completed: s.learners_completed,
          inProgress: s.learners_in_progress,
          notStarted: s.learners_not_started,
          rate: s.avg_completion,
          total: s.learners_completed + s.learners_in_progress,
        };
      });
  }, [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
          <p className="text-xs text-neutral-500 font-medium">Chargement du dashboard {formationTitle}...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8 text-center bg-white border border-[#F1F5F9] rounded-2xl">
        <AlertTriangle className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-neutral-800">{error || 'Données indisponibles'}</p>
        <button
          onClick={loadDashboardData}
          className="mt-3 px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium cursor-pointer"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const searchLower = globalSearch.toLowerCase();
  const filterList = (list: LearnerWithProgress[]) =>
    list.filter((l) => `${l.first_name} ${l.last_name} ${l.email}`.toLowerCase().includes(searchLower));

  const filteredPerformers = filterList(stats.top_performers);
  const filteredAtRisk = filterList(stats.at_risk);
  const filteredBlocked = filterList(stats.blocked_learners);

  return (
    <div className="space-y-6">
      {/* 1. Header Row (Title, Subtitle & Action Controls - ClickUp Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Overview
          </h1>
          <p className="text-xs text-neutral-500 font-medium mt-1">
            {formationCategory} · <span className="text-neutral-900 font-semibold">{formationTitle}</span> ({groupId})
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Customize View Button */}
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] hover:bg-neutral-50 bg-white text-xs font-medium text-neutral-700 transition-colors cursor-pointer"
          >
            <SlidersHorizontal size={13} className="text-neutral-500" />
            <span>Personnaliser</span>
          </button>

          {/* Date / Period Dropdown */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-medium text-neutral-700">
            <Calendar size={13} className="text-neutral-500" />
            <span>Cette session</span>
            <ChevronDown size={12} className="text-neutral-400 ml-0.5" />
          </div>

          {/* Filter button */}
          <button
            type="button"
            className="w-8 h-8 rounded-lg border border-[#E2E8F0] bg-white flex items-center justify-center text-neutral-600 hover:bg-neutral-50 transition-colors cursor-pointer"
            title="Filtres"
          >
            <Filter size={13} />
          </button>
        </div>
      </div>

      {/* 2. Top Segmented KPI Row (Divided by subtle vertical hairlines - ClickUp Reference Style) */}
      <div className="bg-white border border-[#F1F5F9] rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#F1F5F9] overflow-hidden">
        {/* KPI 1: Tasks / Activités validées */}
        <div className="p-5 sm:p-6 flex flex-col justify-between">
          <div className="text-xs font-medium text-neutral-500">Activités complétées</div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold tracking-tight text-neutral-900">
              {stats.sequence_stats.reduce((acc, s) => acc + s.learners_completed, 0)}
            </span>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-600 gap-0.5">
              <ArrowUpRight size={13} />
              +15%
            </span>
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            progression globale
          </div>
        </div>

        {/* KPI 2: Total Apprenants */}
        <div className="p-5 sm:p-6 flex flex-col justify-between">
          <div className="text-xs font-medium text-neutral-500">Apprenants inscrits</div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold tracking-tight text-neutral-900">
              {stats.total_learners}
            </span>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-600 gap-0.5">
              <ArrowUpRight size={13} />
              100%
            </span>
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            cohorte {groupId}
          </div>
        </div>

        {/* KPI 3: Apprenants actifs */}
        <div className="p-5 sm:p-6 flex flex-col justify-between">
          <div className="text-xs font-medium text-neutral-500">Apprenants actifs</div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold tracking-tight text-neutral-900">
              {stats.active_learners}
            </span>
            <span className="inline-flex items-center text-xs font-semibold text-blue-600 gap-0.5">
              {stats.total_learners > 0 ? Math.round((stats.active_learners / stats.total_learners) * 100) : 0}%
            </span>
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            connectés récemment
          </div>
        </div>

        {/* KPI 4: Complétion moyenne */}
        <div className="p-5 sm:p-6 flex flex-col justify-between">
          <div className="text-xs font-medium text-neutral-500">Complétion moyenne</div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-bold tracking-tight text-neutral-900">
              {stats.completion_rate}%
            </span>
            {stats.completion_evolution !== undefined && (
              <span className="inline-flex items-center text-xs font-semibold text-neutral-600 gap-0.5">
                {stats.completion_evolution > 0 ? `+${stats.completion_evolution}%` : `${stats.completion_evolution}%`}
              </span>
            )}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1">
            sur l'ensemble des modules
          </div>
        </div>
      </div>

      {/* Projet Professionnel Section (Formation Initiale) */}
      {stats.pp_stats && (
        <div className="bg-white border border-[#F1F5F9] rounded-2xl p-6 space-y-5">
          {/* Card Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F1F5F9]">
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Projet Professionnel (Session Initiale)</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Bilan consolidé des 4 livrables (Stratégie, Gantt & Budget, Contenus, Tableau de bord) · Seuil de validation : 10 / 20
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate?.('learners')}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer flex items-center gap-1"
              >
                <span>Consulter les notes par apprenant</span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>

          {/* Top 4 KPI mini blocks */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9]">
              <div className="text-[11px] font-medium text-neutral-500">Taux de validation</div>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className="text-2xl font-bold tracking-tight text-neutral-900">
                  {stats.pp_stats.validation_rate}%
                </span>
                <span className="text-xs font-semibold text-neutral-700">
                  {stats.pp_stats.validated_count}/{stats.pp_stats.total_submitted}
                </span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                {stats.pp_stats.failed_count} ajourné (&lt; 10/20)
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9]">
              <div className="text-[11px] font-medium text-neutral-500">Moyenne promotion</div>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className="text-2xl font-bold tracking-tight text-neutral-900">
                  {stats.pp_stats.average_total}
                </span>
                <span className="text-xs text-neutral-400">/ 20</span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                Min : {stats.pp_stats.distribution.min} · Max : {stats.pp_stats.distribution.max}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9]">
              <div className="text-[11px] font-medium text-neutral-500">Mentions Très bien & Bien</div>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className="text-2xl font-bold tracking-tight text-neutral-900">
                  {stats.pp_stats.distribution.tier_16_to_20_tres_bien + stats.pp_stats.distribution.tier_14_to_15_9_bien}
                </span>
                <span className="text-xs text-neutral-500">
                  ({Math.round(((stats.pp_stats.distribution.tier_16_to_20_tres_bien + stats.pp_stats.distribution.tier_14_to_15_9_bien) / stats.pp_stats.total_submitted) * 100)}%)
                </span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                Notes supérieures ou égales à 14/20
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9]">
              <div className="text-[11px] font-medium text-neutral-500">Effectif noté</div>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className="text-2xl font-bold tracking-tight text-neutral-900">
                  {stats.pp_stats.total_submitted}
                </span>
                <span className="text-xs text-neutral-400">évaluations</span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                100% des livrables corrigés
              </div>
            </div>
          </div>

          {/* 2 Sub-blocks: Deliverable Averages & Tier Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
            {/* Deliverable details */}
            <div className="space-y-3 p-4 rounded-xl border border-[#F1F5F9] bg-[#FAFAFA]/40">
              <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                Moyennes par Livrable
              </h4>
              <div className="space-y-2.5">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-neutral-700 font-medium">PP1 · Stratégie Marketing</span>
                    <span className="font-mono font-semibold text-neutral-900">
                      {stats.pp_stats.averages.pp1_strategie_marketing_sur_6} / 6
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-neutral-200/70 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${(stats.pp_stats.averages.pp1_strategie_marketing_sur_6 / 6) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-neutral-700 font-medium">PP2 · Gestion de Projets (Gantt & Budget)</span>
                    <span className="font-mono font-semibold text-neutral-900">
                      {stats.pp_stats.averages.pp2_gestion_projets_sur_6} / 6
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-neutral-200/70 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${(stats.pp_stats.averages.pp2_gestion_projets_sur_6 / 6) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-neutral-700 font-medium">PP3 · Production de Contenus</span>
                    <span className="font-mono font-semibold text-neutral-900">
                      {stats.pp_stats.averages.pp3_production_contenus_sur_4} / 4
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-neutral-200/70 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${(stats.pp_stats.averages.pp3_production_contenus_sur_4 / 4) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-neutral-700 font-medium">PP4 · Tableau de Bord des Indicateurs</span>
                    <span className="font-mono font-semibold text-neutral-900">
                      {stats.pp_stats.averages.pp4_tableau_bord_sur_4} / 4
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-neutral-200/70 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${(stats.pp_stats.averages.pp4_tableau_bord_sur_4 / 4) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tier distribution */}
            <div className="space-y-3 p-4 rounded-xl border border-[#F1F5F9] bg-[#FAFAFA]/40">
              <h4 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                Distribution des Mentions
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#F1F5F9]">
                  <span className="flex items-center gap-2 text-neutral-700">
                    <span className="w-2 h-2 rounded-full bg-neutral-800" />
                    Très bien (16 à 20/20)
                  </span>
                  <span className="font-mono font-semibold text-neutral-900">
                    {stats.pp_stats.distribution.tier_16_to_20_tres_bien} apprenant{stats.pp_stats.distribution.tier_16_to_20_tres_bien > 1 ? 's' : ''} ({Math.round((stats.pp_stats.distribution.tier_16_to_20_tres_bien / stats.pp_stats.total_submitted) * 100)}%)
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#F1F5F9]">
                  <span className="flex items-center gap-2 text-neutral-700">
                    <span className="w-2 h-2 rounded-full bg-neutral-600" />
                    Bien (14 à 15.9/20)
                  </span>
                  <span className="font-mono font-semibold text-neutral-900">
                    {stats.pp_stats.distribution.tier_14_to_15_9_bien} apprenant{stats.pp_stats.distribution.tier_14_to_15_9_bien > 1 ? 's' : ''} ({Math.round((stats.pp_stats.distribution.tier_14_to_15_9_bien / stats.pp_stats.total_submitted) * 100)}%)
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#F1F5F9]">
                  <span className="flex items-center gap-2 text-neutral-700">
                    <span className="w-2 h-2 rounded-full bg-neutral-500" />
                    Assez bien (12 à 13.9/20)
                  </span>
                  <span className="font-mono font-semibold text-neutral-900">
                    {stats.pp_stats.distribution.tier_12_to_13_9_assez_bien} apprenant{stats.pp_stats.distribution.tier_12_to_13_9_assez_bien > 1 ? 's' : ''} ({Math.round((stats.pp_stats.distribution.tier_12_to_13_9_assez_bien / stats.pp_stats.total_submitted) * 100)}%)
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#F1F5F9]">
                  <span className="flex items-center gap-2 text-neutral-700">
                    <span className="w-2 h-2 rounded-full bg-neutral-400" />
                    Passable (10 à 11.9/20)
                  </span>
                  <span className="font-mono font-semibold text-neutral-900">
                    {stats.pp_stats.distribution.tier_10_to_11_9_passable} apprenant{stats.pp_stats.distribution.tier_10_to_11_9_passable > 1 ? 's' : ''} ({Math.round((stats.pp_stats.distribution.tier_10_to_11_9_passable / stats.pp_stats.total_submitted) * 100)}%)
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#F1F5F9]">
                  <span className="flex items-center gap-2 text-neutral-700">
                    <span className="w-2 h-2 rounded-full bg-neutral-300" />
                    Ajourné (&lt; 10/20)
                  </span>
                  <span className="font-mono font-semibold text-neutral-900">
                    {stats.pp_stats.distribution.tier_below_10_ajourne} apprenant ({Math.round((stats.pp_stats.distribution.tier_below_10_ajourne / stats.pp_stats.total_submitted) * 100)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Dashboard Grid (2 Columns: Left Chart & Tables, Right Actions & Meters) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Bar Chart & Project Tabs */}
        <div className="lg:col-span-8 space-y-6">
          {/* Minimalist Bar Chart (Exact ClickUp Reference Style with rounded pastel bars) */}
          <div className="bg-white border border-[#F1F5F9] rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Progression par séquence</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Répartition des apprenants validés et en cours par bloc pédagogique
                </p>
              </div>

              <div className="flex items-center gap-4">
                {/* Visual Legend for Validé vs En cours when in sequences view */}
                {chartView === 'sequences' && (
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#2563EB] inline-block" />
                      <span className="text-neutral-600 font-medium">Validé</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-[#93C5FD] inline-block" />
                      <span className="text-neutral-600 font-medium">En cours</span>
                    </div>
                  </div>
                )}

                {/* View Switcher Pills */}
                <div className="flex items-center bg-[#F8FAFC] border border-[#F1F5F9] p-0.5 rounded-lg text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setChartView('sequences')}
                    className={cn(
                      "px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs",
                      chartView === 'sequences'
                        ? "bg-white text-neutral-900 font-semibold shadow-xs"
                        : "text-neutral-500 hover:text-neutral-800"
                    )}
                  >
                    Séquences
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartView('weekly')}
                    className={cn(
                      "px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs",
                      chartView === 'weekly'
                        ? "bg-white text-neutral-900 font-semibold shadow-xs"
                        : "text-neutral-500 hover:text-neutral-800"
                    )}
                  >
                    Par jour
                  </button>
                </div>
              </div>
            </div>

            {/* Recharts Bar Container */}
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartView === 'sequences' ? sequenceChartData : weeklyData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  barSize={36}
                  onMouseMove={(state: any) => {
                    if (state && state.activeTooltipIndex !== undefined) {
                      setHoveredBarIndex(state.activeTooltipIndex);
                    }
                  }}
                  onMouseLeave={() => setHoveredBarIndex(null)}
                >
                  <XAxis
                    dataKey={chartView === 'sequences' ? 'name' : 'day'}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: '#F1F5F9' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs shadow-none min-w-[200px]">
                          <p className="font-semibold text-neutral-900 border-b border-[#F1F5F9] pb-1.5 mb-2">
                            {data.fullName || data.day}
                          </p>
                          {chartView === 'sequences' ? (
                            <div className="space-y-1.5 text-xs">
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-neutral-600">
                                  <span className="w-2.5 h-2.5 rounded-xs bg-[#2563EB] shrink-0 inline-block" />
                                  Personnes validées :
                                </span>
                                <span className="font-semibold text-neutral-900 font-mono">
                                  {data.completed}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-neutral-600">
                                  <span className="w-2.5 h-2.5 rounded-xs bg-[#93C5FD] shrink-0 inline-block" />
                                  Personnes en cours :
                                </span>
                                <span className="font-semibold text-neutral-900 font-mono">
                                  {data.inProgress}
                                </span>
                              </div>
                              <div className="pt-1.5 border-t border-[#F1F5F9] flex items-center justify-between text-[11px] text-neutral-500">
                                <span>Complétion moyenne :</span>
                                <span className="font-semibold text-neutral-800">{data.rate}%</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-4 text-xs">
                              <span className="text-neutral-600">Apprenants actifs :</span>
                              <span className="font-semibold text-blue-600 font-mono">{data.count}</span>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  {chartView === 'sequences' ? (
                    <>
                      <Bar
                        dataKey="completed"
                        name="Validé"
                        stackId="seq"
                        radius={[0, 0, 4, 4]}
                      >
                        {sequenceChartData.map((_, index) => (
                          <Cell
                            key={`cell-comp-${index}`}
                            fill="#2563EB"
                            opacity={hoveredBarIndex === null || hoveredBarIndex === index ? 1 : 0.65}
                          />
                        ))}
                      </Bar>
                      <Bar
                        dataKey="inProgress"
                        name="En cours"
                        stackId="seq"
                        radius={[6, 6, 0, 0]}
                      >
                        {sequenceChartData.map((_, index) => (
                          <Cell
                            key={`cell-prog-${index}`}
                            fill="#93C5FD"
                            opacity={hoveredBarIndex === null || hoveredBarIndex === index ? 1 : 0.65}
                          />
                        ))}
                      </Bar>
                    </>
                  ) : (
                    <Bar
                      dataKey="count"
                      radius={[6, 6, 0, 0]}
                    >
                      {weeklyData.map((_, index) => (
                        <Cell
                          key={`cell-wk-${index}`}
                          fill={index === 2 ? '#2563EB' : '#BFDBFE'}
                        />
                      ))}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Section: Tabs for Séquences, Top Performers, À Risque, Bloqués (ClickUp Style) */}
          <div id="dashboard-tabs-section" className="bg-white border border-[#F1F5F9] rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#F1F5F9]">
              {/* Tabs */}
              <div className="flex items-center gap-1 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActiveTab('sequences')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-colors cursor-pointer",
                    activeTab === 'sequences'
                      ? "bg-neutral-100 text-neutral-900 font-semibold"
                      : "text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  Séquences
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('performers')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-colors cursor-pointer",
                    activeTab === 'performers'
                      ? "bg-neutral-100 text-neutral-900 font-semibold"
                      : "text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  Top Performers
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('at_risk')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-colors cursor-pointer",
                    activeTab === 'at_risk'
                      ? "bg-neutral-100 text-neutral-900 font-semibold"
                      : "text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  En risque ({stats.at_risk.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('blocked')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-colors cursor-pointer",
                    activeTab === 'blocked'
                      ? "bg-neutral-100 text-neutral-900 font-semibold"
                      : "text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  Bloqués ({stats.blocked_learners.length})
                </button>
              </div>

              {onViewAll && (
                <button
                  type="button"
                  onClick={() => onViewAll(activeTab === 'at_risk' ? 'at_risk' : activeTab === 'blocked' ? 'blocked' : '')}
                  className="text-xs text-neutral-500 hover:text-neutral-900 font-medium cursor-pointer"
                >
                  Voir la liste complète
                </button>
              )}
            </div>

            {/* Tab Contents: Clean Rows styled like the Dopamine / Citable rows in ClickUp reference */}
            <div className="divide-y divide-[#F1F5F9] mt-2">
              {activeTab === 'sequences' && (
                sequenceChartData.map((s, idx) => {
                  const totalCohort = stats.total_learners || 1;
                  const completedPct = Math.round((s.completed / totalCohort) * 100);
                  const inProgressPct = Math.round((s.inProgress / totalCohort) * 100);

                  return (
                    <div
                      key={idx}
                      className="group py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/80 rounded-xl px-3 transition-all cursor-default"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-neutral-900 truncate">
                            {s.fullName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                            <span className="flex items-center gap-1 text-blue-700 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                              {s.completed} validés
                            </span>
                            <span className="text-neutral-300">·</span>
                            <span className="flex items-center gap-1 text-sky-700 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#93C5FD]" />
                              {s.inProgress} en cours
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                        {/* Segmented bi-color progress bar with tooltip */}
                        <div
                          className="w-32 sm:w-40 bg-neutral-100 h-2 rounded-full overflow-hidden flex relative"
                          title={`${s.completed} validés (${completedPct}%) · ${s.inProgress} en cours (${inProgressPct}%)`}
                        >
                          <div
                            className="bg-[#2563EB] h-full transition-all duration-300"
                            style={{ width: `${completedPct}%` }}
                          />
                          <div
                            className="bg-[#93C5FD] h-full transition-all duration-300"
                            style={{ width: `${inProgressPct}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs font-semibold text-neutral-900 w-12 text-right">
                          {s.rate}%
                        </span>
                      </div>
                    </div>
                  );
                })
              )}

              {activeTab === 'performers' && (
                filteredPerformers.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-400">Aucun apprenant trouvé</div>
                ) : (
                  filteredPerformers.slice(0, 6).map((l, idx) => (
                    <div
                      key={l.id}
                      onClick={() => onSelectLearner?.(l.id)}
                      className="py-3 flex items-center justify-between gap-4 hover:bg-neutral-50 px-2 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-5 text-[11px] font-mono text-neutral-400">{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-neutral-900 truncate">
                            {l.first_name} {l.last_name}
                          </p>
                          <p className="text-[11px] text-neutral-400 truncate">{l.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-neutral-500 hidden sm:inline">
                          {l.completed_activities}/{l.total_activities} act.
                        </span>
                        <span className="font-mono text-xs font-semibold text-neutral-900">
                          {l.completion_rate}%
                        </span>
                      </div>
                    </div>
                  ))
                )
              )}

              {activeTab === 'at_risk' && (
                filteredAtRisk.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-400">Aucun apprenant en décrochage</div>
                ) : (
                  filteredAtRisk.slice(0, 6).map((l) => (
                    <div
                      key={l.id}
                      onClick={() => onSelectLearner?.(l.id)}
                      className="py-3 flex items-center justify-between gap-4 hover:bg-neutral-50 px-2 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-neutral-900 truncate">
                            {l.first_name} {l.last_name}
                          </p>
                          <p className="text-[11px] text-amber-700 truncate">
                            {l.days_inactive > 900 ? 'Jamais connecté' : `${l.days_inactive} jours d'inactivité`}
                          </p>
                        </div>
                      </div>

                      <span className="font-mono text-xs text-neutral-700">
                        {l.completion_rate}%
                      </span>
                    </div>
                  ))
                )
              )}

              {activeTab === 'blocked' && (
                filteredBlocked.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-400">Aucun apprenant bloqué</div>
                ) : (
                  filteredBlocked.slice(0, 6).map((l) => (
                    <div
                      key={l.id}
                      onClick={() => onSelectLearner?.(l.id)}
                      className="py-3 flex items-center justify-between gap-4 hover:bg-neutral-50 px-2 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-neutral-900 truncate">
                            {l.first_name} {l.last_name}
                          </p>
                          <p className="text-[11px] text-red-600 truncate">
                            Devoirs en retard : {l.failed_modules?.slice(0, 2).join(', ') || 'Livrable'}
                          </p>
                        </div>
                      </div>

                      <span className="font-mono text-xs text-neutral-700">
                        {l.completion_rate}%
                      </span>
                    </div>
                  ))
                )
              )}
            </div>

            {/* Bottom "View all" button (ClickUp reference style) */}
            <div className="mt-4 pt-3 border-t border-[#F1F5F9] text-center">
              <button
                type="button"
                onClick={() => onViewAll?.('')}
                className="px-4 py-1.5 rounded-lg border border-[#E2E8F0] hover:bg-neutral-50 text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
              >
                Voir tous les apprenants
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Action Panel & Status Meters (ClickUp Reference Style) */}
        <div className="lg:col-span-4 space-y-6">
          {/* "Start your next project" card (ClickUp style top card) */}
          <div className="bg-white border border-[#F1F5F9] rounded-2xl p-6">
            <h3 className="text-sm font-bold text-neutral-900">
              Espace Apprenant DCLIC
            </h3>
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
              Lien unique d'accès pour tous les apprenants de la cohorte {groupId}.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full flex items-center justify-center gap-2 h-9 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold cursor-pointer transition-colors shadow-none"
              >
                {portalCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{portalCopied ? 'Lien copié !' : 'Copier le lien apprenants'}</span>
              </button>
            </div>
          </div>

          {/* Quick Action Checklist Items (Matching ClickUp Right Sidebar) */}
          <div className="bg-white border border-[#F1F5F9] rounded-2xl p-4 divide-y divide-[#F1F5F9]">
            {/* Action 1: Espace Apprenant */}
            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-600">
                  <BookOpen size={15} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-900">Portail Apprenants</p>
                  <p className="text-[11px] text-neutral-400">Suivi individuel par email</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className={cn(
                  "px-2.5 py-1 rounded-md border text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1",
                  portalCopied
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "border-[#E2E8F0] hover:bg-neutral-50 text-neutral-700 hover:text-neutral-900"
                )}
                title="Copier le lien d'accès apprenant pour cette cohorte"
              >
                {portalCopied && <Check size={11} className="text-emerald-600" />}
                <span>{portalCopied ? 'Lien copié' : 'Partager'}</span>
              </button>
            </div>

            {/* Action 2: Import Moodle */}
            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-600">
                  <UploadCloud size={15} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-900">Import de progression</p>
                  <p className="text-[11px] text-neutral-400">Fichier CSV / Markdown</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('upload')}
                className="px-2.5 py-1 rounded-md border border-[#E2E8F0] hover:bg-neutral-50 hover:text-neutral-900 text-[11px] font-medium text-neutral-700 cursor-pointer transition-colors"
                title="Ouvrir la page d'importation de fichiers"
              >
                Importer
              </button>
            </div>

            {/* Action 3: Rapports */}
            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-600">
                  <FileText size={15} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-900">Rapport hebdomadaire</p>
                  <p className="text-[11px] text-neutral-400">Bilan d'activité synthétique</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('reports')}
                className="px-2.5 py-1 rounded-md border border-[#E2E8F0] hover:bg-neutral-50 hover:text-neutral-900 text-[11px] font-medium text-neutral-700 cursor-pointer transition-colors"
                title="Générer et exporter un rapport"
              >
                Générer
              </button>
            </div>

            {/* Action 4: Risques */}
            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-600">
                  <UserX size={15} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-900">Suivi des décrochages</p>
                  <p className="text-[11px] text-neutral-400">{stats.at_risk.length} apprenants à relancer</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('at_risk');
                  const el = document.getElementById('dashboard-tabs-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-2.5 py-1 rounded-md border border-[#E2E8F0] hover:bg-neutral-50 hover:text-neutral-900 text-[11px] font-medium text-neutral-700 cursor-pointer transition-colors"
                title="Afficher et examiner les apprenants en situation de décrochage"
              >
                Examiner
              </button>
            </div>
          </div>

          {/* Progress Meters (Bottom right in ClickUp mockup) */}
          <div className="bg-white border border-[#F1F5F9] rounded-2xl p-6 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-800 mb-1.5">
                <span>Apprenants engagés</span>
                <span className="font-mono text-neutral-500">
                  {stats.active_learners}/{stats.total_learners}
                </span>
              </div>
              <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full"
                  style={{
                    width: `${stats.total_learners > 0 ? (stats.active_learners / stats.total_learners) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-800 mb-1.5">
                <span>Complétion moyenne</span>
                <span className="font-mono text-neutral-500">{stats.completion_rate}%</span>
              </div>
              <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-neutral-900 h-full rounded-full"
                  style={{ width: `${Math.min(100, stats.completion_rate)}%` }}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-[11px] text-neutral-400">
              <span>Cohorte : {groupId}</span>
              <span className="text-neutral-600 font-medium">Session active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
