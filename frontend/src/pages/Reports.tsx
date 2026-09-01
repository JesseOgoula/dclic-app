import React, { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { Calendar, Users, Target, Trophy, TrendingUp, TrendingDown, Activity, ChevronDown, Download, CheckCircle2 } from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

function CustomSelect({ options, value, onChange }: { options: { value: string, label: string }[], value: string | null, onChange: (val: string) => void }) {
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
        className="flex items-center justify-between gap-3 h-10 px-4 py-2 w-full sm:min-w-[260px] rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input shadow-sm transition-all"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="flex items-center gap-2 text-foreground">
          <Calendar size={16} className="text-muted-foreground" />
          {selectedOption ? selectedOption.label : 'Sélectionner...'}
        </span>
        <ChevronDown size={16} className={cn("text-muted-foreground transition-transform duration-200", isOpen ? "rotate-180" : "")} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1.5 w-full sm:w-auto sm:min-w-[260px] bg-popover border border-border rounded-lg shadow-lg z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={cn(
                "px-4 py-2 text-sm cursor-pointer transition-colors mx-1.5 rounded-md flex items-center",
                value === opt.value ? "bg-accent font-semibold text-accent-foreground" : "text-popover-foreground hover:bg-accent hover:text-accent-foreground"
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
  const [reports, setReports] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customReport, setCustomReport] = useState<any>(null);
  const [generatingCustom, setGeneratingCustom] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getWeeklyReports(),
      api.getDashboardStats().catch(() => null)
    ])
      .then(([reportsData, statsData]) => {
        setReports(reportsData);
        setDashboardStats(statsData);
        if (reportsData.length > 0) {
          setSelectedWeek(reportsData[0].week_start);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8">Chargement des rapports...</div>;
  if (reports.length === 0 && !isCustomMode) return <div className="p-8 text-muted-foreground">Aucun historique disponible.</div>;

  const currentIndex = reports.findIndex(r => r.week_start === selectedWeek);
  const currentReport = (isCustomMode && customReport) ? customReport : (reports[currentIndex] || reports[0]);
  const previousReport = (!isCustomMode && currentIndex >= 0 && currentIndex < reports.length - 1) ? reports[currentIndex + 1] : null;

  const handleGenerateCustom = async () => {
    if (!customStartDate || !customEndDate) return;
    setGeneratingCustom(true);
    try {
      const report = await api.getCustomReport(customStartDate, customEndDate);
      setCustomReport(report);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la génération du rapport personnalisé.');
    } finally {
      setGeneratingCustom(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const calculateTrend = (current: number, previous: number) => {
    if (!previous || previous === 0) return null;
    const diff = current - previous;
    const percent = Math.round((diff / previous) * 100);
    return { diff, percent };
  };

  const valTrend = calculateTrend(currentReport.total_validations, previousReport?.total_validations);
  const learnTrend = calculateTrend(currentReport.active_learners, previousReport?.active_learners);

  const topSequence = [...currentReport.validations_by_sequence].sort((a, b) => b.count - a.count)[0];
  const topDay = [...currentReport.validations_by_day].sort((a, b) => b.count - a.count)[0];

  const weekOptions = reports.map(r => ({
    value: r.week_start,
    label: `Sem. du ${formatDate(r.week_start)} au ${formatDate(r.week_end)}`
  }));

  const exportToMarkdown = () => {
    if (!currentReport) return;

    // --- Section Vue Globale ---
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

      // Liste des apprenants Phase 1 terminée
      const phase1List = dashboardStats.completed_phase1_list && dashboardStats.completed_phase1_list.length > 0
        ? dashboardStats.completed_phase1_list.map((l: any) => `  - ${l.first_name} ${l.last_name} (${l.email})`).join('\n')
        : '  - Aucun';

      // Liste des apprenants Session terminée
      const completedList = dashboardStats.completed_list && dashboardStats.completed_list.length > 0
        ? dashboardStats.completed_list.map((l: any) => `  - ${l.first_name} ${l.last_name} (${l.email})`).join('\n')
        : '  - Aucun';

      // Liste des apprenants bloqués avec modules
      const blockedList = dashboardStats.blocked_learners && dashboardStats.blocked_learners.length > 0
        ? dashboardStats.blocked_learners.map((l: any) => {
            const modules = l.failed_modules && l.failed_modules.length > 0 ? l.failed_modules.join(', ') : 'Non identifié';
            return `  - ${l.first_name} ${l.last_name} — Modules échoués : ${modules}`;
          }).join('\n')
        : '  - Aucun';

      // Top Performers
      const topPerformersList = dashboardStats.top_performers && dashboardStats.top_performers.length > 0
        ? dashboardStats.top_performers.slice(0, 5).map((l: any, i: number) => `  ${i + 1}. ${l.first_name} ${l.last_name} — ${l.completion_rate}%`).join('\n')
        : '  - Aucun';

      // Apprenants en risque (at_risk)
      const atRiskList = dashboardStats.at_risk && dashboardStats.at_risk.length > 0
        ? dashboardStats.at_risk.slice(0, 10).map((l: any) => `  - ${l.first_name} ${l.last_name} — ${l.days_inactive} jours d'inactivité`).join('\n')
        : '  - Aucun';

      // --- Recommandations automatiques ---
      const recommendations: string[] = [];
      const dropoutRate = totalLearners > 0 ? Math.round((droppedCount / totalLearners) * 100) : 0;
      
      if (dropoutRate > 20) {
        recommendations.push(`⚠️ **Alerte décrochage** : ${dropoutRate}% de la cohorte est en situation de décrochage (${droppedCount}/${totalLearners}). Une campagne de relance ciblée est recommandée.`);
      } else if (dropoutRate > 10) {
        recommendations.push(`📋 **Vigilance décrochage** : ${dropoutRate}% de la cohorte est en décrochage. Continuer les relances individuelles.`);
      }

      if (blockedCount > 0) {
        recommendations.push(`🔒 **${blockedCount} apprenant${blockedCount > 1 ? 's' : ''} bloqué${blockedCount > 1 ? 's' : ''}** : Des relances et un accompagnement personnalisé sur les activités évaluées sont nécessaires.`);
      }

      if (inactiveCount > 5) {
        recommendations.push(`📧 **${inactiveCount} apprenants inactifs** : Planifier des relances par mail/WhatsApp pour les ramener sur la plateforme.`);
      }

      if (phase1Count > 0) {
        recommendations.push(`🎉 **${phase1Count} apprenant${phase1Count > 1 ? 's ont' : ' a'} terminé la Phase 1** : Envoyer un message de félicitations et les préparer pour le Projet Pro.`);
      }

      if (completedCount > 0) {
        recommendations.push(`🏆 **${completedCount} apprenant${completedCount > 1 ? 's ont' : ' a'} terminé la session** : Préparer les certificats et la clôture.`);
      }

      if (recommendations.length === 0) {
        recommendations.push('✅ Pas d\'alerte particulière. La cohorte suit un rythme normal.');
      }

      globalSection = `
## 🌍 Vue Globale de la Cohorte

| Indicateur | Valeur |
|---|---|
| Taux de complétion moyen | **${dashboardStats.completion_rate}%** |
| Apprenants actifs | **${activeCount}** |
| Inactifs | **${inactiveCount}** |
| Décrocheurs | **${droppedCount}** |
| En risque (inactifs + décrocheurs) | **${enRisque}** |
| Phase 1 terminée (≥ 93,5%) | **${phase1Count}** |
| Session terminée (100%) | **${completedCount}** |
| Bloqués (note minimale non atteinte) | **${blockedCount}** |

### 📈 Progression par Séquence
${dashboardStats.sequence_stats.filter((s: any) => s.sequence !== 'Autre' && s.sequence !== 'Préalable').map((s: any) => `- **${s.sequence}** : ${s.learners_completed} terminés, ${s.learners_in_progress} en cours, ${s.learners_not_started} non commencés (Moyenne : ${s.avg_completion}%)`).join('\n')}

### ✅ Apprenants ayant terminé la Phase 1 (${phase1Count})
${phase1List}

### 🏆 Apprenants ayant terminé la Session (${completedCount})
${completedList}

### 🔒 Apprenants Bloqués (${blockedCount})
${blockedList}

### 🏅 Top 5 Performers
${topPerformersList}

### ⚠️ Apprenants en Risque de Décrochage
${atRiskList}

### 💡 Recommandations
${recommendations.map(r => `- ${r}`).join('\n')}

`;
    }

    const mdContent = `# Rapport ${isCustomMode ? 'Personnalisé' : 'Hebdomadaire'} - Cohorte DCLIC
**Période :** Du ${formatDate(currentReport.week_start)} au ${formatDate(currentReport.week_end)}
${globalSection}
## 📊 Indicateurs Hebdomadaires Clés
- **Total des validations :** ${currentReport.total_validations}
- **Apprenants actifs cette semaine :** ${currentReport.active_learners}
- **Séquence la plus active :** ${topSequence?.sequence || 'N/A'} (${topSequence?.count || 0} validations)
- **Jour le plus actif :** ${topDay?.day || 'N/A'} (${topDay?.count || 0} validations)

## 📚 Validations par Séquence
${currentReport.validations_by_sequence.map((s: any) => `- **${s.sequence}** : ${s.count} validations`).join('\n')}

## 🏆 Top Apprenants de la Semaine (Validations)
${currentReport.top_learners && currentReport.top_learners.length > 0 
  ? currentReport.top_learners.map((l: any, i: number) => `${i + 1}. **${l.name}** : ${l.count} validations`).join('\n')
  : "- Aucune donnée"}

## 📅 Activité Quotidienne
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {isCustomMode ? 'Rapport Personnalisé' : 'Rapports Hebdomadaires'}
          </h1>
          <p className="text-muted-foreground mt-1">
            Analyse détaillée de la cohorte du <span className="font-semibold text-foreground">{currentReport ? formatDate(currentReport.week_start) : '-'} au {currentReport ? formatDate(currentReport.week_end) : '-'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <CustomSelect
            options={[
              { value: 'custom', label: 'Période personnalisée...' },
              ...reports.map(r => ({
                value: r.week_start,
                label: `Sem. du ${formatDate(r.week_start)} au ${formatDate(r.week_end)}`
              }))
            ]}
            value={isCustomMode ? 'custom' : selectedWeek}
            onChange={(val) => {
              if (val === 'custom') {
                setIsCustomMode(true);
              } else {
                setIsCustomMode(false);
                setSelectedWeek(val);
              }
            }}
          />

          {isCustomMode && (
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                className="h-10 px-2 rounded-md border border-input bg-background text-sm" 
                value={customStartDate} 
                onChange={e => setCustomStartDate(e.target.value)} 
              />
              <span className="text-muted-foreground text-sm">au</span>
              <input 
                type="date" 
                className="h-10 px-2 rounded-md border border-input bg-background text-sm" 
                value={customEndDate} 
                onChange={e => setCustomEndDate(e.target.value)} 
              />
              <button 
                onClick={handleGenerateCustom}
                disabled={generatingCustom || !customStartDate || !customEndDate}
                className="h-10 px-3 bg-accent text-accent-foreground rounded-md text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
              >
                {generatingCustom ? '...' : 'Générer'}
              </button>
            </div>
          )}

          <button
            onClick={exportToMarkdown}
            className="flex items-center gap-2 h-10 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <Download size={16} />
            Export MD
          </button>
        </div>
      </div>

      {dashboardStats && (
        <div className="bg-muted/30 p-4 rounded-lg border border-border flex flex-wrap gap-x-8 gap-y-3 text-sm items-center">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-muted-foreground" />
            <span className="text-muted-foreground">Complétion moyenne:</span>
            <span className="font-bold text-foreground">{dashboardStats.completion_rate}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={14} className="text-muted-foreground" />
            <span className="text-muted-foreground">Actifs:</span>
            <span className="font-bold text-foreground">{dashboardStats.active_learners}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Inactifs:</span>
            <span className="font-bold text-foreground">{dashboardStats.inactive_learners}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Décrocheurs:</span>
            <span className="font-bold text-destructive">{dashboardStats.dropped_learners}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Bloqués:</span>
            <span className="font-bold text-destructive">{dashboardStats.blocked_learners?.length || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-muted-foreground" />
            <span className="text-muted-foreground">Phase 1 terminée:</span>
            <span className="font-bold text-foreground">{dashboardStats.completed_phase1_learners || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy size={14} className="text-muted-foreground" />
            <span className="text-muted-foreground">Session terminée:</span>
            <span className="font-bold text-foreground">{dashboardStats.completed_learners || 0}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <Card className="shadow-sm border-border hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground truncate mb-1">Total Validations</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-foreground tracking-tight leading-none">{currentReport.total_validations}</p>
                  {valTrend && (
                    <span className={cn("text-xs font-semibold", valTrend.diff >= 0 ? "text-emerald-600" : "text-rose-600")}>
                      {valTrend.diff > 0 ? '+' : ''}{valTrend.percent}%
                    </span>
                  )}
                </div>
              </div>
              <div className="p-2 bg-muted text-muted-foreground rounded-xl shrink-0">
                <Target className="h-5 w-5" strokeWidth={2.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2 */}
        <Card className="shadow-sm border-border hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground truncate mb-1">Apprenants Actifs</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-foreground tracking-tight leading-none">{currentReport.active_learners}</p>
                  {learnTrend && (
                    <span className={cn("text-xs font-semibold", learnTrend.diff >= 0 ? "text-emerald-600" : "text-rose-600")}>
                      {learnTrend.diff > 0 ? '+' : ''}{learnTrend.percent}%
                    </span>
                  )}
                </div>
              </div>
              <div className="p-2 bg-muted text-muted-foreground rounded-xl shrink-0">
                <Users className="h-5 w-5" strokeWidth={2.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3 */}
        <Card className="shadow-sm border-border hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground truncate mb-1">Séquence top</p>
                <div className="flex flex-col">
                  <p className="text-lg font-bold text-foreground tracking-tight leading-none truncate" title={topSequence?.sequence || '-'}>
                    {topSequence?.sequence || '-'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">{topSequence?.count || 0} validations</p>
                </div>
              </div>
              <div className="p-2 bg-muted text-muted-foreground rounded-xl shrink-0">
                <Trophy className="h-5 w-5" strokeWidth={2.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4 */}
        <Card className="shadow-sm border-border hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground truncate mb-1">Jour record</p>
                <div className="flex flex-col">
                  <p className="text-lg font-bold text-foreground tracking-tight leading-none capitalize truncate">
                    {topDay?.day || '-'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">{topDay?.count || 0} validations</p>
                </div>
              </div>
              <div className="p-2 bg-muted text-muted-foreground rounded-xl shrink-0">
                <Activity className="h-5 w-5" strokeWidth={2.5} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Rythme de Validation par Jour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={currentReport.validations_by_day} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#db2777" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#db2777" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: '13px' }}
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area type="monotone" dataKey="count" name="Validations" stroke="#db2777" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Répartition par Séquence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={currentReport.validations_by_sequence} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="sequence"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickFormatter={(v: string) => {
                      const match = v.match(/Séquence (\d)/i);
                      return match ? `Séq. ${match[1]}` : v.substring(0, 10) + '...';
                    }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: '13px' }}
                    formatter={(value: any, name: any) => [`${value} validations`, name]}
                    labelFormatter={(label: any) => label}
                  />
                  <Bar dataKey="count" name="Validations" fill="#db2777" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
