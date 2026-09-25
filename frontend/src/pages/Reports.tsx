import React, { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  Calendar,
  Users,
  Target,
  Trophy,
  TrendingUp,
  Activity,
  ChevronDown,
  Download,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
} from 'lucide-react';
import { useFormation } from '@/context/FormationContext';

function CustomSelect({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block w-full sm:w-auto" ref={containerRef}>
      <button
        type="button"
        className="flex items-center justify-between gap-2.5 h-8 px-3 w-full sm:min-w-[220px] rounded-lg border border-[#E2E8F0] bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors shadow-none cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="flex items-center gap-2 text-neutral-800 truncate">
          <Calendar size={13} className="text-neutral-400 shrink-0" />
          <span className="truncate">{selectedOption ? selectedOption.label : 'Sélectionner...'}</span>
        </span>
        <ChevronDown
          size={13}
          className={cn('text-neutral-400 shrink-0 transition-transform duration-200', isOpen ? 'rotate-180' : '')}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-full sm:w-auto sm:min-w-[240px] bg-white border border-[#E2E8F0] rounded-xl shadow-none z-50 py-1 max-h-64 overflow-y-auto">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={cn(
                'px-3.5 py-2 text-xs cursor-pointer transition-colors mx-1 rounded-lg flex items-center',
                value === opt.value
                  ? 'bg-neutral-100 font-semibold text-neutral-900'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              )}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const { currentFormation, formationTitle, formationCategory, groupId } = useFormation();
  const [reports, setReports] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customReport, setCustomReport] = useState<any>(null);
  const [generatingCustom, setGeneratingCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getWeeklyReports(currentFormation),
      api.getDashboardStats(currentFormation).catch(() => null),
    ])
      .then(([reportsData, statsData]) => {
        setReports(reportsData);
        setDashboardStats(statsData);
        if (reportsData.length > 0) {
          setSelectedWeek(reportsData[0].week_start);
          const startStr = reportsData[0].week_start ? reportsData[0].week_start.split('T')[0] : '';
          const endStr = reportsData[0].week_end ? reportsData[0].week_end.split('T')[0] : '';
          setCustomStartDate(startStr);
          setCustomEndDate(endStr);
        } else {
          const now = new Date();
          const past = new Date();
          past.setDate(now.getDate() - 30);
          setCustomStartDate(past.toISOString().split('T')[0]);
          setCustomEndDate(now.toISOString().split('T')[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentFormation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-neutral-800 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-neutral-400 font-medium">Chargement des rapports...</span>
        </div>
      </div>
    );
  }

  if (reports.length === 0 && !isCustomMode) {
    return (
      <div className="bg-white border border-[#F1F5F9] rounded-2xl p-12 text-center">
        <p className="text-xs text-neutral-500 font-medium">Aucun rapport hebdomadaire disponible pour cette formation.</p>
      </div>
    );
  }

  const currentIndex = reports.findIndex((r) => r.week_start === selectedWeek);
  const currentReport = isCustomMode ? customReport : currentIndex >= 0 ? reports[currentIndex] : reports[0];
  const previousReport =
    !isCustomMode && currentIndex >= 0 && currentIndex < reports.length - 1 ? reports[currentIndex + 1] : null;

  const handleGenerateCustom = async (startDate = customStartDate, endDate = customEndDate) => {
    if (!startDate || !endDate) {
      setCustomError('Veuillez renseigner une date de début et une date de fin.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setCustomError('La date de début doit être antérieure ou égale à la date de fin.');
      return;
    }
    setCustomError(null);
    setGeneratingCustom(true);
    try {
      const report = await api.getCustomReport(startDate, endDate, currentFormation);
      setCustomReport(report);
    } catch (err: any) {
      console.error(err);
      setCustomError(err?.message || 'Erreur lors de la génération du rapport personnalisé.');
    } finally {
      setGeneratingCustom(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const calculateTrend = (current?: number, previous?: number) => {
    if (current === undefined || previous === undefined || previous === null || previous === 0) return null;
    const diff = current - previous;
    const percent = Math.round((diff / previous) * 100);
    return { diff, percent };
  };

  const valTrend = currentReport ? calculateTrend(currentReport.total_validations, previousReport?.total_validations) : null;
  const learnTrend = currentReport ? calculateTrend(currentReport.active_learners, previousReport?.active_learners) : null;

  const topSequence =
    currentReport?.validations_by_sequence && currentReport.validations_by_sequence.length > 0
      ? [...currentReport.validations_by_sequence].sort((a: any, b: any) => b.count - a.count)[0]
      : null;
  const topDay =
    currentReport?.validations_by_day && currentReport.validations_by_day.length > 0
      ? [...currentReport.validations_by_day].sort((a: any, b: any) => b.count - a.count)[0]
      : null;

  const weekOptions = reports.map((r) => ({
    value: r.week_start,
    label: `Sem. du ${formatDate(r.week_start)} au ${formatDate(r.week_end)}`,
  }));

  const exportToMarkdown = () => {
    if (!currentReport) return;

    let globalSection = '';
    if (dashboardStats) {
      const totalLearners = dashboardStats.total_learners || 0;
      const phase1Count = dashboardStats.completed_phase1_learners || 0;
      const completedCount = dashboardStats.completed_learners || 0;
      const blockedCount = dashboardStats.blocked_learners?.length || 0;
      const droppedCount = dashboardStats.dropped_learners || 0;
      const inactiveCount = dashboardStats.inactive_learners || 0;
      const activeCount = dashboardStats.active_learners || 0;
      const enRisque = inactiveCount + droppedCount;

      const phase1List =
        dashboardStats.completed_phase1_list && dashboardStats.completed_phase1_list.length > 0
          ? dashboardStats.completed_phase1_list.map((l: any) => `  - ${l.first_name} ${l.last_name} (${l.email})`).join('\n')
          : '  - Aucun';

      const completedList =
        dashboardStats.completed_list && dashboardStats.completed_list.length > 0
          ? dashboardStats.completed_list.map((l: any) => `  - ${l.first_name} ${l.last_name} (${l.email})`).join('\n')
          : '  - Aucun';

      const blockedList =
        dashboardStats.blocked_learners && dashboardStats.blocked_learners.length > 0
          ? dashboardStats.blocked_learners
              .map((l: any) => {
                const modules = l.failed_modules && l.failed_modules.length > 0 ? l.failed_modules.join(', ') : 'Non identifié';
                return `  - ${l.first_name} ${l.last_name} — Modules échoués : ${modules}`;
              })
              .join('\n')
          : '  - Aucun';

      const topPerformersList =
        dashboardStats.top_performers && dashboardStats.top_performers.length > 0
          ? dashboardStats.top_performers
              .slice(0, 5)
              .map((l: any, i: number) => `  ${i + 1}. ${l.first_name} ${l.last_name} — ${l.completion_rate}%`)
              .join('\n')
          : '  - Aucun';

      const atRiskList =
        dashboardStats.at_risk && dashboardStats.at_risk.length > 0
          ? dashboardStats.at_risk.slice(0, 10).map((l: any) => `  - ${l.first_name} ${l.last_name} — ${l.days_inactive} jours d'inactivité`).join('\n')
          : '  - Aucun';

      const recommendations: string[] = [];
      const dropoutRate = totalLearners > 0 ? Math.round((droppedCount / totalLearners) * 100) : 0;

      if (dropoutRate > 20) {
        recommendations.push(
          `**Alerte décrochage** : ${dropoutRate}% de la cohorte est en situation de décrochage (${droppedCount}/${totalLearners}). Une campagne de relance ciblée est recommandée.`
        );
      } else if (dropoutRate > 10) {
        recommendations.push(
          `**Vigilance décrochage** : ${dropoutRate}% de la cohorte est en décrochage. Continuer les relances individuelles.`
        );
      }

      if (blockedCount > 0) {
        recommendations.push(
          `**${blockedCount} apprenant${blockedCount > 1 ? 's' : ''} bloqué${blockedCount > 1 ? 's' : ''}** : Des relances et un accompagnement personnalisé sur les activités évaluées sont nécessaires.`
        );
      }

      if (inactiveCount > 5) {
        recommendations.push(
          `**${inactiveCount} apprenants inactifs** : Planifier des relances pour les remobiliser sur la plateforme.`
        );
      }

      if (phase1Count > 0) {
        recommendations.push(
          `**${phase1Count} apprenant${phase1Count > 1 ? 's ont' : ' a'} terminé la Phase 1** : Préparer le passage au Projet Professionnel.`
        );
      }

      if (completedCount > 0) {
        recommendations.push(
          `**${completedCount} apprenant${completedCount > 1 ? 's ont' : ' a'} terminé la session** : Préparer les certificats et la clôture.`
        );
      }

      if (recommendations.length === 0) {
        recommendations.push('Aucune anomalie détectée. La cohorte suit un rythme régulier.');
      }

      globalSection = `
## Vue Globale de la Cohorte

| Indicateur | Valeur |
|---|---|
| Taux de complétion moyen | **${dashboardStats.completion_rate}%** |
| Apprenants actifs | **${activeCount}** |
| Inactifs | **${inactiveCount}** |
| Décrocheurs | **${droppedCount}** |
| En risque (inactifs + décrocheurs) | **${enRisque}** |
| Phase 1 terminée | **${phase1Count}** |
| Session terminée (100%) | **${completedCount}** |
| Bloqués (note minimale non atteinte) | **${blockedCount}** |

### Progression par Séquence
${dashboardStats.sequence_stats
  .filter((s: any) => s.sequence !== 'Autre' && s.sequence !== 'Préalable')
  .sort((a: any, b: any) => {
    const getOrder = (seq: string) => {
      if (seq.includes('Séquence 1')) return 1;
      if (seq.includes('Séquence 2')) return 2;
      if (seq.includes('Séquence 3')) return 3;
      if (seq.includes('Séquence 4')) return 4;
      if (seq.includes('Séquence 5')) return 5;
      if (seq.includes('Projet')) return 6;
      if (seq.toLowerCase().includes('impression')) return 7;
      return 99;
    };
    return getOrder(a.sequence) - getOrder(b.sequence);
  })
  .map(
    (s: any) =>
      `- **${s.sequence}** : ${s.learners_completed} terminés, ${s.learners_in_progress} en cours, ${s.learners_not_started} non commencés (Moyenne : ${s.avg_completion}%)`
  )
  .join('\n')}

### Apprenants ayant terminé la Phase 1 (${phase1Count})
${phase1List}

### Apprenants ayant terminé la Session (${completedCount})
${completedList}

### Apprenants Bloqués (${blockedCount})
${blockedList}

### Top Performers
${topPerformersList}

### Apprenants en Risque de Décrochage
${atRiskList}

### Recommandations
${recommendations.map((r) => `- ${r}`).join('\n')}

`;
    }

    const mdContent = `# Rapport ${isCustomMode ? 'Personnalisé' : 'Hebdomadaire'} - Cohorte ${formationTitle}
**Période :** Du ${formatDate(currentReport.week_start)} au ${formatDate(currentReport.week_end)}
${globalSection}
## Indicateurs Clés de la Période
- **Total des validations :** ${currentReport.total_validations}
- **Apprenants actifs cette semaine :** ${currentReport.active_learners}
- **Séquence la plus active :** ${topSequence?.sequence || 'N/A'} (${topSequence?.count || 0} validations)
- **Jour le plus actif :** ${topDay?.day || 'N/A'} (${topDay?.count || 0} validations)

## Validations par Séquence
${currentReport.validations_by_sequence.map((s: any) => `- **${s.sequence}** : ${s.count} validations`).join('\n')}

## Activité Quotidienne
${currentReport.validations_by_day.map((d: any) => `- **${d.day}** : ${d.count} validations`).join('\n')}

---
*Généré automatiquement depuis le tableau de bord DCLIC.*`;

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = isCustomMode
      ? `Rapport_DCLIC_Custom_${customStartDate}_au_${customEndDate}.md`
      : `Rapport_DCLIC_${currentReport.week_start}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header (Clean ClickUp Title & Subtitle) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            {isCustomMode ? 'Rapport Personnalisé' : 'Rapports Hebdomadaires'}
          </h1>
          <p className="text-xs text-neutral-500 font-medium mt-1">
            {formationCategory} · <span className="text-neutral-900 font-semibold">{formationTitle}</span> ({groupId})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector dropdown */}
          <CustomSelect
            options={[{ value: 'custom', label: 'Période personnalisée...' }, ...weekOptions]}
            value={isCustomMode ? 'custom' : selectedWeek}
            onChange={(val) => {
              if (val === 'custom') {
                setIsCustomMode(true);
                setCustomError(null);
                if (!customReport && customStartDate && customEndDate) {
                  handleGenerateCustom(customStartDate, customEndDate);
                }
              } else {
                setIsCustomMode(false);
                setSelectedWeek(val);
                setCustomError(null);
              }
            }}
          />

          {/* Custom Date Picker Inputs */}
          {isCustomMode && (
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                className="h-8 px-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-neutral-800 focus:bg-white focus:border-neutral-400 outline-none"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setCustomError(null);
                }}
              />
              <span className="text-neutral-400 text-xs font-medium">au</span>
              <input
                type="date"
                className="h-8 px-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-xs text-neutral-800 focus:bg-white focus:border-neutral-400 outline-none"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setCustomError(null);
                }}
              />
              <button
                type="button"
                onClick={() => handleGenerateCustom()}
                disabled={generatingCustom || !customStartDate || !customEndDate}
                className="h-8 px-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors shadow-none cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {generatingCustom ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Génération...</span>
                  </>
                ) : (
                  <span>Générer</span>
                )}
              </button>
            </div>
          )}

          {/* Export Markdown Button */}
          <button
            type="button"
            onClick={exportToMarkdown}
            disabled={!currentReport}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E2E8F0] hover:bg-neutral-50 bg-white text-xs font-medium text-neutral-700 transition-colors shadow-none cursor-pointer disabled:opacity-50"
            title="Exporter le rapport d'analyse en format Markdown"
          >
            <Download size={13} className="text-neutral-500" />
            <span>Export MD</span>
          </button>
        </div>
      </div>

      {customError && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200/60 flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0 text-red-600" />
          <span>{customError}</span>
        </div>
      )}

      {/* 2. Global Cohort Overview Pills Bar (Minimal ClickUp Style) */}
      {dashboardStats && (
        <div className="bg-white border border-[#F1F5F9] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-neutral-400" />
            <span className="text-neutral-500">Complétion moyenne :</span>
            <span className="font-semibold text-neutral-900">{dashboardStats.completion_rate}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={14} className="text-neutral-400" />
            <span className="text-neutral-500">Actifs :</span>
            <span className="font-semibold text-neutral-900">{dashboardStats.active_learners}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Inactifs :</span>
            <span className="font-semibold text-neutral-700">{dashboardStats.inactive_learners}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Décrocheurs :</span>
            <span className="font-semibold text-amber-600">{dashboardStats.dropped_learners}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Bloqués :</span>
            <span className="font-semibold text-red-600">{dashboardStats.blocked_learners?.length || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-blue-600" />
            <span className="text-neutral-500">Phase 1 validée :</span>
            <span className="font-semibold text-neutral-900">{dashboardStats.completed_phase1_learners || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy size={14} className="text-emerald-600" />
            <span className="text-neutral-500">Session terminée :</span>
            <span className="font-semibold text-neutral-900">{dashboardStats.completed_learners || 0}</span>
          </div>
        </div>
      )}

      {/* 3. Empty / Generating custom status */}
      {isCustomMode && !customReport && !generatingCustom && (
        <div className="bg-white border border-[#F1F5F9] rounded-2xl p-10 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <Calendar className="w-8 h-8 text-neutral-300 mx-auto" />
            <h3 className="font-semibold text-sm text-neutral-900">Génération de rapport sur-mesure</h3>
            <p className="text-xs text-neutral-400">
              Sélectionnez une date de début et de fin ci-dessus, puis cliquez sur « Générer » pour charger les statistiques de la période.
            </p>
          </div>
        </div>
      )}

      {generatingCustom && (
        <div className="bg-white border border-[#F1F5F9] rounded-2xl p-12 text-center">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-neutral-500">Génération du rapport en cours...</p>
          </div>
        </div>
      )}

      {/* 4. Selected Period Data Display */}
      {currentReport && (
        <>
          {/* Segmented KPIs Row (Matching Dashboard & LearnersList) */}
          <div className="bg-white border border-[#F1F5F9] rounded-2xl p-6 grid grid-cols-2 md:grid-cols-4 gap-6 divide-y md:divide-y-0 md:divide-x divide-[#F1F5F9]">
            {/* KPI 1: Total Validations */}
            <div>
              <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Total Validations
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-neutral-900">
                  {currentReport.total_validations ?? 0}
                </span>
                {valTrend && (
                  <span
                    className={cn(
                      'inline-flex items-center text-xs font-semibold gap-0.5',
                      valTrend.diff >= 0 ? 'text-emerald-600' : 'text-neutral-500'
                    )}
                  >
                    {valTrend.diff >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {valTrend.diff > 0 ? '+' : ''}
                    {valTrend.percent}%
                  </span>
                )}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                activités validées sur la période
              </div>
            </div>

            {/* KPI 2: Apprenants Actifs */}
            <div className="pt-4 md:pt-0 md:pl-6">
              <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Apprenants Actifs
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-neutral-900">
                  {currentReport.active_learners ?? 0}
                </span>
                {learnTrend && (
                  <span
                    className={cn(
                      'inline-flex items-center text-xs font-semibold gap-0.5',
                      learnTrend.diff >= 0 ? 'text-emerald-600' : 'text-neutral-500'
                    )}
                  >
                    {learnTrend.diff >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {learnTrend.diff > 0 ? '+' : ''}
                    {learnTrend.percent}%
                  </span>
                )}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                connexions actives enregistrées
              </div>
            </div>

            {/* KPI 3: Séquence Top */}
            <div className="pt-4 md:pt-0 md:pl-6">
              <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Séquence Top
              </div>
              <div className="text-lg font-bold tracking-tight text-neutral-900 truncate" title={topSequence?.sequence || '-'}>
                {topSequence?.sequence || '-'}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                {topSequence?.count || 0} validations réalisées
              </div>
            </div>

            {/* KPI 4: Jour Record */}
            <div className="pt-4 md:pt-0 md:pl-6">
              <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Jour Record
              </div>
              <div className="text-lg font-bold tracking-tight text-neutral-900 capitalize">
                {topDay?.day || '-'}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                pic avec {topDay?.count || 0} validations
              </div>
            </div>
          </div>

          {/* Charts Row (Two Columns: Rythme de Validation & Répartition par Séquence) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Rythme par jour (Clean Pastel Blue Area Chart) */}
            <div className="bg-white border border-[#F1F5F9] rounded-2xl p-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-neutral-900">Rythme de validation par jour</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Volume quotidien des activités validées sur la période
                </p>
              </div>

              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={currentReport.validations_by_day || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#94A3B8' }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#94A3B8' }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        boxShadow: 'none',
                        fontSize: '12px',
                        backgroundColor: '#FFFFFF',
                      }}
                      cursor={{ stroke: '#E2E8F0', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Validations"
                      stroke="#2563EB"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorCount)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Répartition par Séquence (Clean Minimal Bar Chart) */}
            <div className="bg-white border border-[#F1F5F9] rounded-2xl p-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-neutral-900">Répartition par séquence</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Validations ventilées selon les blocs pédagogiques
                </p>
              </div>

              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={currentReport.validations_by_sequence || []}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    barSize={24}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis
                      dataKey="sequence"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#94A3B8' }}
                      tickFormatter={(v: string) => {
                        const match = v.match(/Séquence (\d)/i);
                        if (match) return `Séq. ${match[1]}`;
                        if (v.toLowerCase().includes('projet')) return 'PP';
                        return v.substring(0, 8);
                      }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#94A3B8' }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        boxShadow: 'none',
                        fontSize: '12px',
                        backgroundColor: '#FFFFFF',
                      }}
                      formatter={(value: any, name: any) => [`${value} validations`, name]}
                    />
                    <Bar dataKey="count" name="Validations" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
