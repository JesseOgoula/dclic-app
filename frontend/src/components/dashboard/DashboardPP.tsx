import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  GraduationCap,
  Users,
  Award,
  Sparkles,
  Download,
  Key,
  RefreshCw,
  Lock,
  Unlock,
  CheckCheck,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { api, type PPLearner as PPLearnerType, type PPStats as PPStatsType } from '@/lib/api';
import defaultPpData from '@/data/pp_evaluations.json';

// ============================================================
// Types
// ============================================================

interface DeliverableDef {
  id: string;
  num: number;
  title: string;
  short: string;
  icon: string;
  max_score: number;
}

interface PhaseEntry {
  submitted: boolean;
  status: string;
  comment: string;
  files: { name: string; size: number; mtime: string }[];
  score?: number | null;
  max_score?: number;
  audit_v1?: string;
  is_locked?: boolean;
  evaluation_status?: 'pending' | 'ai_evaluated' | 'validated';
}

interface DeliverableEntry {
  id: string;
  entrainement: PhaseEntry;
  final: PhaseEntry;
}

interface Synthesis {
  coherence?: string;
  points_forts?: string;
  chantiers?: string;
  message?: string;
}

const deliverablesDef: DeliverableDef[] = (defaultPpData.deliverables_def || []) as DeliverableDef[];

const OFFICIAL_CONSIGNES: Record<string, string> = {
  desc: "Présentation claire de l'activité, proposition de valeur, ancrage géographique, cible, dimensionnement de l'équipe et périmètre.",
  strat: "Document de stratégie complet de 1000 mots maximum comprenant : 2 personas détaillés, étude de marché analysant au moins 3 concurrents réels nommés, objectifs SMART, 2 actions d'acquisition, justification des canaux, 2 actions de rétention.",
  gest: "Planning Gantt lisible, complet et chronologique (tâches, durées, dates, jalons) + affectation des ressources humaines (CM, graphiste, dev, etc.) en cohérence directe avec la stratégie marketing PP1.",
  budget: "Estimation des ressources nécessaires pour la stratégie, chiffrage budgétaire par tâches réaliste et cohérent avec le contexte local.",
  content: "Produire 1 flyer ET 1 vidéo (< 1mn30). Texte explicatif reliant chaque support à un objectif précis de la campagne (100 mots maximum).",
  tdb: "Tableau de bord avec indicateurs de surveillance par canaux + texte de justification concise du choix des métriques (100 mots maximum)."
};

function getStatusBadge(phase: PhaseEntry): { color: string; label: string; icon: React.ReactNode } {
  if (phase.is_locked) {
    return { color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', label: 'Validé & Verrouillé', icon: <Lock className="w-3 h-3" /> };
  }
  if (phase.evaluation_status === 'ai_evaluated') {
    return { color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', label: 'Évalué par IA (À relire)', icon: <Sparkles className="w-3 h-3" /> };
  }
  const s = phase.status || '';
  if (s.includes('Non soumis') || s.includes('🔴')) {
    return { color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', label: 'Non soumis', icon: <AlertTriangle className="w-3 h-3" /> };
  }
  if (s.includes('Excellent') || s.includes('✅')) {
    return { color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', label: 'Validé', icon: <CheckCircle2 className="w-3 h-3" /> };
  }
  if (s.includes('🟡') || s.includes('ajust') || s.includes('affiner') || s.includes('structurer') || s.includes('améliorer')) {
    return { color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', label: 'À ajuster', icon: <Clock className="w-3 h-3" /> };
  }
  if (phase.submitted) {
    return { color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', label: 'Soumis (En attente)', icon: <FileText className="w-3 h-3" /> };
  }
  return { color: 'bg-muted text-muted-foreground border-border', label: 'En attente', icon: <Clock className="w-3 h-3" /> };
}

function getCategoryBadge(cat: string) {
  switch (cat) {
    case 'green':
      return { label: 'Complet (Vert)', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    case 'yellow':
      return { label: 'Partiel (Jaune)', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
    case 'red':
      return { label: 'En retard (Rouge)', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' };
    default:
      return { label: cat, color: 'bg-muted text-muted-foreground border-border' };
  }
}

interface DashboardPPProps {
  onNavigate?: (page: any) => void;
  globalSearch?: string;
}

export default function DashboardPP({ onNavigate, globalSearch = '' }: DashboardPPProps) {
  const [learnersData, setLearnersData] = useState<any[]>((defaultPpData.learners as any[]) || []);
  const [statsData, setStatsData] = useState<any>(defaultPpData.stats || {});
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState(globalSearch);
  const [filterCategory, setFilterCategory] = useState<'all' | 'green' | 'yellow' | 'red' | 'pending'>('all');
  const [expandedLearner, setExpandedLearner] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'entrainement' | 'final'>('entrainement');
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  // Gemini API Key & Evaluation Modal state
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => localStorage.getItem('dclic_gemini_key') || '');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [selectedEval, setSelectedEval] = useState<{
    learner: any;
    deliverableId: string;
    phase: 'entrainement' | 'final';
  } | null>(null);
  const [evaluatingAi, setEvaluatingAi] = useState(false);
  const [validating, setValidating] = useState(false);
  const [evalComment, setEvalComment] = useState('');
  const [evalScore, setEvalScore] = useState<number | string>('');

  // Fetch dynamic data from API on mount
  const fetchData = async (force = false) => {
    setLoading(true);
    try {
      const [lData, sData] = await Promise.all([
        api.getPPLearners(force),
        api.getPPStats(force)
      ]);
      if (lData && lData.length > 0) setLearnersData(lData);
      if (sData) setStatsData(sData);
    } catch (err) {
      console.warn('API error fetching PP data, using fallback cache:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveApiKey = (key: string) => {
    setGeminiApiKey(key);
    localStorage.setItem('dclic_gemini_key', key);
    setShowKeyModal(false);
  };

  const filteredLearners = useMemo(() => {
    let result = [...learnersData];
    const q = (searchQuery || globalSearch).toLowerCase().trim();
    if (q) {
      result = result.filter(l =>
        (l.full_name || '').toLowerCase().includes(q) ||
        (l.projet || '').toLowerCase().includes(q) ||
        (l.num || '').includes(q)
      );
    }
    if (filterCategory === 'pending') {
      result = result.filter(l => {
        const delivs = Object.values(l.deliverables || {}) as any[];
        return delivs.some((d: any) => 
          (d.entrainement?.submitted && !d.entrainement?.is_locked) ||
          (d.final?.submitted && !d.final?.is_locked)
        );
      });
    } else if (filterCategory !== 'all') {
      result = result.filter(l => l.category === filterCategory);
    }
    return result;
  }, [learnersData, searchQuery, globalSearch, filterCategory]);

  const handleCopyMessage = (msg: string, id: string) => {
    navigator.clipboard.writeText(msg);
    setCopiedMessage(id);
    setTimeout(() => setCopiedMessage(null), 2500);
  };

  const toggleLearner = (id: string) => {
    setExpandedLearner(prev => prev === id ? null : id);
  };

  // Open evaluation modal
  const openEvaluationModal = (learner: any, deliverableId: string, phase: 'entrainement' | 'final') => {
    const entry = learner.deliverables?.[deliverableId]?.[phase];
    setSelectedEval({ learner, deliverableId, phase });
    setEvalComment(entry?.comment || '');
    setEvalScore(entry?.score !== null && entry?.score !== undefined ? entry.score : '');
  };

  // Trigger Gemini AI evaluation
  const handleAiEvaluation = async () => {
    if (!selectedEval) return;
    setEvaluatingAi(true);
    try {
      const res = await api.evaluatePPCopy(
        selectedEval.learner.id,
        selectedEval.deliverableId,
        selectedEval.phase,
        geminiApiKey
      );
      if (res?.data) {
        setEvalComment(res.data.comment || '');
        if (res.data.score !== null) setEvalScore(res.data.score);
        await fetchData(true);
      }
    } catch (err: any) {
      alert(`Erreur évaluation IA: ${err.message}`);
    } finally {
      setEvaluatingAi(false);
    }
  };

  // Validate & lock evaluation
  const handleValidateEvaluation = async () => {
    if (!selectedEval) return;
    setValidating(true);
    try {
      await api.validatePPEvaluation({
        learner_id: selectedEval.learner.id,
        deliverable_id: selectedEval.deliverableId,
        phase: selectedEval.phase,
        score: evalScore !== '' ? Number(evalScore) : null,
        comment: evalComment,
        status: '✅ Validé par le tuteur',
      });
      await fetchData(true);
      setSelectedEval(null);
    } catch (err: any) {
      alert(`Erreur validation: ${err.message}`);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/40 p-3 rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Agent Évaluateur IA Connecté
          </Badge>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Données dynamiques Supabase · Règle zéro-salutation & anti-surnotation active
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowKeyModal(true)}
            className="h-8 text-xs gap-1.5 cursor-pointer"
            title="Configurer la clé API Gemini"
          >
            <Key className="w-3.5 h-3.5 text-primary" />
            <span>{geminiApiKey ? 'Clé IA Active' : 'Clé API Gemini'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(api.getPPExcelExportUrl(), '_blank')}
            className="h-8 text-xs gap-1.5 cursor-pointer text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            title="Exporter l'ensemble de la cohorte au format Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter Excel</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={loading}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Actualiser les données"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{statsData.total_learners || learnersData.length}</p>
                <p className="text-[11px] text-muted-foreground">Apprenants suivis</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl font-bold text-foreground">{statsData.categories?.green || 0}</p>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">({statsData.v1_rate || 0}%)</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Complets V1 (4/4)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-4.5 h-4.5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{statsData.categories?.yellow || 0}</p>
                <p className="text-[11px] text-muted-foreground">Partiels V1 (1-3/4)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-4.5 h-4.5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{statsData.categories?.red || 0}</p>
                <p className="text-[11px] text-muted-foreground">En retard (0/4)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Award className="w-4.5 h-4.5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{statsData.v2_submitted || 0}</p>
                <p className="text-[11px] text-muted-foreground">Restitutions finales V2</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Anti-Oubli Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={filterCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterCategory('all')}
            className="text-xs h-8 cursor-pointer"
          >
            Tous ({learnersData.length})
          </Button>

          <Button
            variant={filterCategory === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterCategory('pending')}
            className="text-xs h-8 gap-1.5 cursor-pointer border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Copies en attente</span>
          </Button>

          <Button
            variant={filterCategory === 'green' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterCategory('green')}
            className="text-xs h-8 cursor-pointer"
          >
            Complets ({statsData.categories?.green || 0})
          </Button>

          <Button
            variant={filterCategory === 'yellow' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterCategory('yellow')}
            className="text-xs h-8 cursor-pointer"
          >
            Partiels ({statsData.categories?.yellow || 0})
          </Button>

          <Button
            variant={filterCategory === 'red' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterCategory('red')}
            className="text-xs h-8 cursor-pointer"
          >
            En retard ({statsData.categories?.red || 0})
          </Button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, projet..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-card border-border"
          />
        </div>
      </div>

      {/* Learners Matrix Table */}
      <Card className="bg-card border-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-10 text-center text-xs">#</TableHead>
                <TableHead className="text-xs min-w-[200px]">Apprenant & Projet</TableHead>
                <TableHead className="text-xs text-center min-w-[90px]">Statut</TableHead>
                {deliverablesDef.map(d => (
                  <TableHead key={d.id} className="text-xs text-center min-w-[100px]">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-sm">{d.icon}</span>
                      <span className="text-[11px] font-medium leading-tight">{d.short}</span>
                      {d.max_score > 0 && (
                        <span className="text-[9px] text-muted-foreground font-mono">/{d.max_score}pts</span>
                      )}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="w-10 text-center text-xs"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLearners.map((learner, idx) => {
                const isExpanded = expandedLearner === learner.id;
                const catBadge = getCategoryBadge(learner.category);

                return (
                  <React.Fragment key={learner.id}>
                    <TableRow
                      className={`border-border transition-colors cursor-pointer ${isExpanded ? 'bg-muted/40' : 'hover:bg-muted/20'}`}
                      onClick={() => toggleLearner(learner.id)}
                    >
                      <TableCell className="text-center text-xs font-mono text-muted-foreground">
                        {learner.num || idx + 1}
                      </TableCell>

                      <TableCell>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{learner.full_name}</p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[240px]" title={learner.projet}>
                            {learner.projet || 'Projet à préciser'}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-[10px] ${catBadge.color}`}>
                          {catBadge.label}
                        </Badge>
                      </TableCell>

                      {/* Deliverables cells */}
                      {deliverablesDef.map(d => {
                        const deliv = learner.deliverables?.[d.id];
                        const entrainement = deliv?.entrainement;
                        const final = deliv?.final;
                        const hasV2 = final?.submitted;
                        const activePhase = hasV2 ? final : entrainement;
                        const badge = activePhase ? getStatusBadge(activePhase) : { color: 'bg-muted text-muted-foreground', label: '—', icon: null };

                        return (
                          <TableCell 
                            key={d.id} 
                            className="text-center p-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEvaluationModal(learner, d.id, hasV2 ? 'final' : 'entrainement');
                            }}
                          >
                            <button className="w-full group/btn text-center cursor-pointer">
                              <Badge
                                variant="outline"
                                className={`text-[10px] gap-1 px-1.5 py-0.5 w-full justify-center transition-transform hover:scale-105 ${badge.color}`}
                                title={activePhase?.comment ? `${activePhase.comment.slice(0, 120)}... (Cliquer pour évaluer)` : 'Cliquer pour évaluer'}
                              >
                                {badge.icon}
                                <span className="truncate">{badge.label}</span>
                              </Badge>

                              {hasV2 && final?.score !== null && final?.score !== undefined && (
                                <span className="block text-[10px] font-mono font-bold text-primary mt-0.5">
                                  {final.score}/{d.max_score}
                                </span>
                              )}
                            </button>
                          </TableCell>
                        );
                      })}

                      <TableCell className="text-center">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <TableRow className="border-border bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={deliverablesDef.length + 4} className="p-4">
                          <div className="space-y-4 max-w-4xl mx-auto animate-fade-in">
                            {/* Synthesis Card */}
                            <div className="bg-card p-4 rounded-xl border border-border space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                                  <span>🎓 Bilan Pédagogique — {learner.full_name}</span>
                                </h4>
                                <Badge variant="outline" className={`text-xs ${catBadge.color}`}>
                                  {learner.status_priority || catBadge.label}
                                </Badge>
                              </div>

                              {learner.synthesis?.coherence && (
                                <p className="text-xs text-foreground/90 leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border/60">
                                  <strong>Cohérence globale :</strong> {learner.synthesis.coherence}
                                </p>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                {learner.synthesis?.points_forts && (
                                  <div className="bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/15">
                                    <p className="font-semibold text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Points forts
                                    </p>
                                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                                      {learner.synthesis.points_forts}
                                    </p>
                                  </div>
                                )}

                                {learner.synthesis?.chantiers && (
                                  <div className="bg-amber-500/5 p-3 rounded-lg border border-amber-500/15">
                                    <p className="font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5" /> Chantiers prioritaires
                                    </p>
                                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                                      {learner.synthesis.chantiers}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {learner.synthesis?.message && (
                                <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-primary">Message pour l'apprenant (Format Moodle / WhatsApp) :</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleCopyMessage(learner.synthesis.message!, `synth_${learner.id}`)}
                                      className="h-6 text-[11px] gap-1 text-primary hover:bg-primary/10 cursor-pointer"
                                    >
                                      {copiedMessage === `synth_${learner.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                      <span>{copiedMessage === `synth_${learner.id}` ? 'Copié !' : 'Copier'}</span>
                                    </Button>
                                  </div>
                                  <p className="text-xs italic text-foreground/80 font-serif">
                                    "{learner.synthesis.message}"
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Deliverables detail cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              {deliverablesDef.map(d => {
                                const entry = learner.deliverables?.[d.id]?.entrainement;
                                const hasFiles = entry?.files && entry.files.length > 0;

                                return (
                                  <div key={d.id} className="bg-card p-3 rounded-xl border border-border space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 font-semibold">
                                        <span>{d.icon}</span>
                                        <span>{d.short}</span>
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openEvaluationModal(learner, d.id, 'entrainement')}
                                        className="h-6 px-2 text-[10px] gap-1 cursor-pointer"
                                      >
                                        <Sparkles className="w-2.5 h-2.5 text-primary" />
                                        <span>Évaluer</span>
                                      </Button>
                                    </div>

                                    {hasFiles ? (
                                      <div className="space-y-1">
                                        {entry.files.map((f: any, fIdx: number) => (
                                          <div key={fIdx} className="flex items-center justify-between text-[10px] bg-muted/40 px-2 py-1 rounded">
                                            <span className="truncate max-w-[140px] text-muted-foreground">{f.name}</span>
                                            <span className="font-mono text-muted-foreground/80">{Math.round((f.size || 0) / 1024)} Ko</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-[10px] text-muted-foreground italic">Aucun fichier soumis</p>
                                    )}

                                    {entry?.comment && (
                                      <p className="text-[11px] text-foreground/80 bg-muted/20 p-2 rounded border border-border/40 line-clamp-3">
                                        {entry.comment}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ============================================================ */}
      {/* EVALUATION MODAL (Interactive Review, AI Grading, Locking) */}
      {/* ============================================================ */}
      {selectedEval && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5 animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">
                    {deliverablesDef.find(d => d.id === selectedEval.deliverableId)?.icon}
                  </span>
                  <h3 className="text-lg font-bold text-foreground">
                    {deliverablesDef.find(d => d.id === selectedEval.deliverableId)?.title}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Apprenant : <strong className="text-foreground">{selectedEval.learner.full_name}</strong> · Projet : {selectedEval.learner.projet}
                </p>
              </div>

              <Badge variant="outline" className="text-xs">
                {selectedEval.phase === 'entrainement' ? 'Phase 1 : Entraînement (Sans note)' : 'Phase 2 : Rendu Final'}
              </Badge>
            </div>

            {/* Official Consigne */}
            <div className="bg-muted/40 p-3 rounded-xl border border-border text-xs space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Consigne officielle du référentiel D-CLIC :
              </span>
              <p className="text-muted-foreground leading-relaxed">
                {OFFICIAL_CONSIGNES[selectedEval.deliverableId]}
              </p>
            </div>

            {/* AI Agent Trigger */}
            <div className="flex items-center justify-between bg-primary/5 p-3 rounded-xl border border-primary/20">
              <div>
                <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Agent Évaluateur Gemini IA
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Analyse le texte, compare avec la consigne et prépare le diagnostic selon la grille officielle.
                </p>
              </div>

              <Button
                size="sm"
                onClick={handleAiEvaluation}
                disabled={evaluatingAi}
                className="h-8 text-xs gap-1.5 cursor-pointer"
              >
                <Sparkles className={`w-3.5 h-3.5 ${evaluatingAi ? 'animate-spin' : ''}`} />
                <span>{evaluatingAi ? 'Analyse en cours...' : 'Évaluer avec l’IA'}</span>
              </Button>
            </div>

            {/* Score & Grading (if Final phase) */}
            {selectedEval.phase === 'final' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Note attribuée (Barème sur {deliverablesDef.find(d => d.id === selectedEval.deliverableId)?.max_score || 6} points) :
                </label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max={deliverablesDef.find(d => d.id === selectedEval.deliverableId)?.max_score || 6}
                  value={evalScore}
                  onChange={e => setEvalScore(e.target.value)}
                  placeholder="Ex : 5.5"
                  className="text-xs bg-background h-8 max-w-[120px]"
                />
              </div>
            )}

            {/* Feedback / Diagnostic text */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  Commentaire & Diagnostic pédagogique (Règle ZÉRO Salutation / ZÉRO Signature) :
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyMessage(evalComment, 'modal_copy')}
                  className="h-6 text-[11px] gap-1 text-primary cursor-pointer"
                >
                  {copiedMessage === 'modal_copy' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedMessage === 'modal_copy' ? 'Copié !' : 'Copier pour Moodle'}</span>
                </Button>
              </div>
              <textarea
                value={evalComment}
                onChange={e => setEvalComment(e.target.value)}
                rows={5}
                className="w-full text-xs p-3 rounded-xl border border-border bg-background text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Rédigez ou laissez l'Agent IA générer le retour pédagogique..."
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedEval(null)}
                className="text-xs cursor-pointer"
              >
                Fermer
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={handleValidateEvaluation}
                disabled={validating || !evalComment.trim()}
                className="text-xs gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{validating ? 'Validation...' : 'Valider & Verrouiller l’évaluation'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* GEMINI API KEY MODAL */}
      {/* ============================================================ */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-4 animate-scale-in">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              <h3 className="text-base font-bold text-foreground">Clé API Google Gemini</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Renseignez votre clé API Gemini pour alimenter l'Agent de correction intelligent. La clé est stockée localement dans votre navigateur en toute sécurité.
            </p>

            <Input
              type="password"
              placeholder="AIzaSy..."
              defaultValue={geminiApiKey}
              id="gemini_key_input"
              className="text-xs bg-background"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowKeyModal(false)} className="text-xs">
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const input = document.getElementById('gemini_key_input') as HTMLInputElement;
                  handleSaveApiKey(input?.value || '');
                }}
                className="text-xs"
              >
                Enregistrer la clé
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
