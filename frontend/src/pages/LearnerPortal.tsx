import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Mail,
  Award,
  Sparkles,
  Copy,
  Check,
  BookOpen
} from 'lucide-react';
import { api, type LearnerPortalData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LearnerPortalProps {
  initialEmail?: string;
  onBackToAdmin?: () => void;
}

export const LearnerPortal: React.FC<LearnerPortalProps> = ({ initialEmail = '', onBackToAdmin }) => {
  const [emailInput, setEmailInput] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalData, setPortalData] = useState<LearnerPortalData | null>(null);
  const [openSequences, setOpenSequences] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  // Auto-search if initialEmail is provided or URL query param ?email=...
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email') || initialEmail;
    if (emailParam) {
      setEmailInput(emailParam);
      handleSearch(emailParam);
    }
  }, [initialEmail]);

  const handleSearch = async (emailToSearch?: string) => {
    const targetEmail = (emailToSearch || emailInput).trim();
    if (!targetEmail) {
      setError('Veuillez renseigner votre adresse de courriel.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.getLearnerPortal(targetEmail);
      setPortalData(data);
      
      // Open sequences that have incomplete items or errors by default
      const initialOpen: Record<string, boolean> = {};
      data.sequences.forEach((seq) => {
        const hasTrou = seq.activities.some(a => a.is_trou);
        const isIncomplete = seq.completed < seq.total;
        initialOpen[seq.sequence] = hasTrou || isIncomplete;
      });
      setOpenSequences(initialOpen);
    } catch (err: any) {
      setPortalData(null);
      setError(err.message || 'Aucun apprenant trouvé avec cette adresse email.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSequence = (seqName: string) => {
    setOpenSequences(prev => ({ ...prev, [seqName]: !prev[seqName] }));
  };

  const copyShareLink = () => {
    if (!portalData) return;
    const url = new URL(window.location.href);
    url.searchParams.set('email', portalData.learner.email);
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-6 px-4 sm:px-6 animate-in fade-in duration-300">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-wide uppercase mb-1">
            <GraduationCap className="h-5 w-5" />
            Portail Apprenant DCLIC
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Vérification de Ma Progression
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consultez en temps réel vos activités validées, détectez les devoirs à rattraper et sécurisez votre certification.
          </p>
        </div>

        {onBackToAdmin && (
          <Button variant="outline" size="sm" onClick={onBackToAdmin} className="self-start sm:self-auto">
            Retour Espace Tuteur
          </Button>
        )}
      </div>

      {/* Email Search Card */}
      <Card className="border-border shadow-sm">
        <CardContent className="pt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Entrez votre adresse email complète (ex: adjakidjememiaghe@gmail.com)"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="pl-10 h-11 text-base bg-background"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="h-11 px-6 font-semibold gap-2">
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Vérifier mon parcours
            </Button>
          </form>

          {error && (
            <div className="mt-4 p-3.5 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Learner Progress Display */}
      {portalData && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-400">
          {/* Summary Card */}
          <Card className="border-border shadow-sm overflow-hidden bg-gradient-to-br from-card to-card/60">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {portalData.learner.first_name} {portalData.learner.last_name}
                  </h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>{portalData.learner.email}</span>
                    <span>•</span>
                    <Badge variant="outline" className="text-xs">
                      {portalData.learner.group_id}
                    </Badge>
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyShareLink}
                  className="gap-2 text-xs h-8 self-start sm:self-auto cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Lien copié !' : 'Copier mon lien de suivi'}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {/* Progress metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border bg-background/60 flex flex-col justify-center">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Complétion Globale
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-extrabold text-foreground">
                      {portalData.completion_rate}%
                    </span>
                    <span className="text-xs text-muted-foreground">de la formation</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden mt-3">
                    <div
                      className={cn(
                        'h-full transition-all duration-700',
                        portalData.completion_rate >= 90
                          ? 'bg-emerald-500'
                          : portalData.completion_rate >= 50
                          ? 'bg-primary'
                          : 'bg-amber-500'
                      )}
                      style={{ width: `${portalData.completion_rate}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl border bg-background/60 flex flex-col justify-center">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Activités Validées
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-extrabold text-foreground">
                      {portalData.completed_activities}
                    </span>
                    <span className="text-sm text-muted-foreground">/ {portalData.total_activities}</span>
                  </div>
                  <span className="text-xs text-muted-foreground mt-2">
                    {portalData.total_activities - portalData.completed_activities} restante(s)
                  </span>
                </div>

                <div className="p-4 rounded-xl border bg-background/60 flex flex-col justify-center">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Statut Actuel
                  </span>
                  <div className="mt-2">
                    {portalData.learner.status === 'completed' && (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 px-2.5 py-1 text-xs">
                        <Award className="h-3.5 w-3.5" /> Session terminée
                      </Badge>
                    )}
                    {portalData.learner.status === 'completed_phase1' && (
                      <Badge variant="outline" className="border-primary text-primary font-bold gap-1 px-2.5 py-1 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Phase 1 terminée
                      </Badge>
                    )}
                    {portalData.has_unvalidated_assignments && (
                      <Badge variant="destructive" className="gap-1 px-2.5 py-1 text-xs font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5" /> Devoir(s) non validé(s)
                      </Badge>
                    )}
                    {!portalData.has_unvalidated_assignments && portalData.learner.status === 'active' && (
                      <Badge variant="default" className="gap-1 px-2.5 py-1 text-xs font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Parcours actif
                      </Badge>
                    )}
                    {!portalData.has_unvalidated_assignments && portalData.learner.status === 'inactive' && (
                      <Badge variant="secondary" className="gap-1 px-2.5 py-1 text-xs">
                        <Clock className="h-3.5 w-3.5" /> En pause / Inactif
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground mt-2">
                    {portalData.has_unvalidated_assignments
                      ? 'Action requise pour certification'
                      : 'Parcours en cours sans blocage'}
                  </span>
                </div>
              </div>

              {/* Diagnostic Banner */}
              {portalData.has_unvalidated_assignments ? (
                <div className="p-5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-amber-900 dark:text-amber-100">
                        Attention : {portalData.unvalidated_assignments.length} devoir(s) à régulariser impérativement !
                      </h3>
                      <p className="text-sm text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                        Vous avez continué à avancer dans la formation, mais l'évaluation d'un ou plusieurs devoirs en amont n'a pas atteint la note minimale requise (<strong>10/20</strong>) ou nécessite un rattrapage. Sans la validation de ces devoirs, votre attestation finale ne pourra pas être délivrée.
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pl-11 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-900/80 dark:text-amber-200/80">
                      Devoir(s) en souffrance à corriger ou renvoyer :
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {portalData.unvalidated_assignments.map((unval, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-white/70 dark:bg-black/20 text-xs font-medium"
                        >
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold block truncate" title={unval.name}>
                              {unval.name}
                            </span>
                            <span className="text-[11px] text-amber-700 dark:text-amber-400">
                              {unval.sequence}
                              {unval.completed_at && ` • Déposé le ${new Date(unval.completed_at).toLocaleDateString('fr-FR')}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs italic text-amber-700 dark:text-amber-400 mt-2">
                      💡 <strong>Conseil :</strong> Connectez-vous à la plateforme Moodle, consultez les retours de votre tuteur sur ces activités, et soumettez à nouveau votre devoir corrigé.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-600 shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-emerald-950 dark:text-emerald-100">
                      Parcours sans anomalie détectée !
                    </h3>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                      Tous les devoirs et activités franchis jusqu'à présent sont validés. Continuez ainsi !
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Checklist by Sequence */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Détail de vos modules et activités
              </h3>
              <span className="text-xs text-muted-foreground">
                Cliquez sur une séquence pour voir toutes les activités
              </span>
            </div>

            {portalData.sequences.map((seq, sIdx) => {
              const isOpen = !!openSequences[seq.sequence];
              const isAllDone = seq.completed === seq.total && seq.total > 0;
              const hasTrou = seq.activities.some(a => a.is_trou);

              return (
                <div
                  key={sIdx}
                  className={cn(
                    'border rounded-xl overflow-hidden bg-card transition-all',
                    hasTrou ? 'border-amber-300 dark:border-amber-800' : 'border-border'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleSequence(seq.sequence)}
                    className="w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'w-2 h-6 rounded-full shrink-0',
                          isAllDone ? 'bg-emerald-500' : hasTrou ? 'bg-amber-500' : 'bg-primary'
                        )}
                      />
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm sm:text-base text-foreground truncate">
                          {seq.sequence}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {seq.completed} sur {seq.total} activité(s) validée(s)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isAllDone && (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] border-none font-semibold">
                          Validé ✓
                        </Badge>
                      )}
                      {hasTrou && (
                        <Badge variant="destructive" className="text-[11px] font-semibold gap-1">
                          <AlertTriangle className="h-3 w-3" /> Devoir à refaire
                        </Badge>
                      )}
                      {isOpen ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-4 pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-background/40">
                      {seq.activities.map((act, aIdx) => {
                        const isDone = act.status === 'completed' || act.status === 'passed';
                        const isFailed = act.status === 'failed';
                        const isTrou = act.is_trou;
                        const isDevoir = act.is_devoir;

                        return (
                          <div
                            key={aIdx}
                            className={cn(
                              'p-3 rounded-lg border flex items-start gap-3 transition-colors',
                              isTrou
                                ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900'
                                : isDone
                                ? 'border-border bg-card'
                                : 'border-dashed border-muted-foreground/30 bg-muted/10 opacity-70'
                            )}
                          >
                            <div
                              className={cn(
                                'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                                isDone
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : isTrou
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                  : isFailed
                                  ? 'bg-destructive/10 text-destructive'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {isDone ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : isTrou ? (
                                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              ) : isFailed ? (
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                              ) : (
                                <Clock className="h-4 w-4" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  'text-xs sm:text-sm font-semibold text-foreground line-clamp-2',
                                  isTrou && 'text-amber-900 dark:text-amber-200'
                                )}
                                title={act.name}
                              >
                                {act.name}
                              </p>

                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                {isDevoir && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] font-bold border-amber-300 bg-amber-100/60 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
                                  >
                                    Devoir Obligatoire
                                  </Badge>
                                )}

                                {isDone ? (
                                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                    Terminé {act.completed_at ? `le ${new Date(act.completed_at).toLocaleDateString('fr-FR')}` : ''}
                                  </span>
                                ) : isTrou ? (
                                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                                    Non validé (Note &lt; 10 ou en attente)
                                  </span>
                                ) : isFailed ? (
                                  <span className="text-[11px] font-bold text-destructive">
                                    Note minimale non atteinte
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">
                                    Non commencé
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LearnerPortal;
