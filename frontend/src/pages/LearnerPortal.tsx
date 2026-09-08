import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  Mail,
  Award,
  BookOpen,
  LogOut,
  UserCheck
} from 'lucide-react';
import { api, type LearnerPortalData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const LearnerPortal: React.FC = () => {
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalData, setPortalData] = useState<LearnerPortalData | null>(null);
  const [openSequences, setOpenSequences] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    if (emailParam) {
      setEmailInput(emailParam);
      handleSearch(emailParam);
    }
  }, []);

  const handleSearch = async (emailToSearch?: string) => {
    const targetEmail = (emailToSearch || emailInput).trim();
    if (!targetEmail) {
      setError('Veuillez renseigner votre adresse e-mail.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.getLearnerPortal(targetEmail);
      setPortalData(data);

      // Ouvrir par défaut les séquences avec des devoirs non validés ou non terminées
      const initialOpen: Record<string, boolean> = {};
      data.sequences.forEach((seq) => {
        const hasTrou = seq.activities.some(a => a.is_trou);
        const isIncomplete = seq.completed < seq.total;
        initialOpen[seq.sequence] = hasTrou || isIncomplete;
      });
      setOpenSequences(initialOpen);

      const url = new URL(window.location.href);
      url.searchParams.set('email', data.learner.email);
      window.history.replaceState({}, '', url.toString());
    } catch (err: any) {
      setPortalData(null);
      setError(err.message || 'Aucun apprenant trouvé avec cette adresse e-mail. Vérifiez votre saisie.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPortalData(null);
    setEmailInput('');
    setError(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('email');
    window.history.replaceState({}, '', url.toString());
  };

  const toggleSequence = (seqName: string) => {
    setOpenSequences(prev => ({ ...prev, [seqName]: !prev[seqName] }));
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header - Branded & Clean */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-primary text-primary-foreground font-extrabold text-sm px-2.5 py-1 rounded tracking-wide">
              DCLIC
            </span>
            <div>
              <span className="font-semibold text-sm text-foreground">
                Espace Apprenant
              </span>
              <span className="hidden sm:inline text-xs text-muted-foreground ml-2">
                Suivi de progression en temps réel
              </span>
            </div>
          </div>

          {portalData && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-xs h-8 gap-1.5 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Changer d'adresse e-mail
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* State 1: Email Form (Initial or Reset) */}
        {!portalData && (
          <div className="max-w-xl mx-auto pt-6 pb-12 space-y-6">
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="text-center pb-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                  <UserCheck className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl font-bold text-foreground">
                  Consulter mon avancement
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Renseignez l'adresse e-mail avec laquelle vous êtes inscrit sur la plateforme pour visualiser vos activités validées et vos devoirs.
                </p>
              </CardHeader>
              <CardContent className="pt-2 space-y-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSearch();
                  }}
                  className="space-y-3"
                >
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="nom.prenom@exemple.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="pl-10 h-11 text-base bg-background"
                      required
                      autoFocus
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 font-semibold gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Vérifier ma progression
                  </Button>
                </form>

                {error && (
                  <div className="p-3.5 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2.5 border border-destructive/20">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="p-3 rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground">Information importante :</p>
                  <p>
                    Pour que vos devoirs soient validés dans votre parcours de formation, une note minimale de 10/20 est requise par la coordination pédagogique.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* State 2: Learner Data Displayed */}
        {portalData && (
          <div className="space-y-6 animate-fade-in">
            {/* Learner Identity & Status Card */}
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="pb-4 border-b border-border bg-muted/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      {portalData.learner.first_name} {portalData.learner.last_name}
                    </h2>
                    <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
                      <span>{portalData.learner.email}</span>
                      <span>·</span>
                      <Badge variant="outline" className="text-xs font-medium">
                        {portalData.learner.group_id}
                      </Badge>
                      {portalData.learner.last_activity_at && (
                        <>
                          <span>·</span>
                          <span className="text-xs">
                            Dernière activité le {new Date(portalData.learner.last_activity_at).toLocaleDateString('fr-FR')}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="self-start sm:self-auto">
                    {portalData.has_unvalidated_assignments ? (
                      <Badge variant="destructive" className="gap-1.5 px-3 py-1 font-semibold text-xs">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Devoir(s) en attente de rattrapage
                      </Badge>
                    ) : portalData.learner.status === 'completed' ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1.5 px-3 py-1 font-semibold text-xs">
                        <Award className="h-3.5 w-3.5" />
                        Formation terminée
                      </Badge>
                    ) : (
                      <Badge variant="default" className="gap-1.5 px-3 py-1 font-semibold text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Dossier conforme
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6 space-y-6">
                {/* 3 Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-border bg-card flex flex-col justify-center">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Progression globale
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-extrabold text-foreground">
                        {portalData.completion_rate}%
                      </span>
                      <span className="text-xs text-muted-foreground">complétée</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden mt-3">
                      <div
                        className={cn(
                          'h-full transition-all duration-500',
                          portalData.completion_rate >= 90
                            ? 'bg-emerald-600'
                            : 'bg-primary'
                        )}
                        style={{ width: `${portalData.completion_rate}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-card flex flex-col justify-center">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Activités validées
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-extrabold text-foreground">
                        {portalData.completed_activities}
                      </span>
                      <span className="text-sm text-muted-foreground">/ {portalData.total_activities}</span>
                    </div>
                    <span className="text-xs text-muted-foreground mt-2">
                      {portalData.total_activities - portalData.completed_activities} restante(s) pour finir
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-card flex flex-col justify-center">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Devoirs obligatoires
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-extrabold text-foreground">
                        {portalData.has_unvalidated_assignments ? portalData.unvalidated_assignments.length : 0}
                      </span>
                      <span className="text-xs text-muted-foreground">à régulariser</span>
                    </div>
                    <span className={cn(
                      "text-xs mt-2 font-medium",
                      portalData.has_unvalidated_assignments ? "text-destructive" : "text-emerald-600"
                    )}>
                      {portalData.has_unvalidated_assignments
                        ? 'Note minimale de 10 requise'
                        : 'Aucun devoir en retard'}
                    </span>
                  </div>
                </div>

                {/* Diagnostic Banner */}
                {portalData.has_unvalidated_assignments ? (
                  <div className="p-5 rounded-xl border border-destructive/40 bg-destructive/5 text-foreground space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-destructive/10 text-destructive shrink-0 mt-0.5">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-destructive">
                          Attention : {portalData.unvalidated_assignments.length} devoir(s) obligatoire(s) non validé(s)
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                          Bien que vous ayez pu continuer dans les séquences suivantes, les devoirs obligatoires ci-dessous n'ont pas atteint la note minimale de <strong>10/20</strong> requise ou nécessitent un rattrapage. Sans la validation de ces devoirs, la formation ne pourra être considérée comme achevée.
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 pl-0 sm:pl-10 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {portalData.unvalidated_assignments.map((unval, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-lg border border-destructive/20 bg-card text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-foreground truncate">
                                {unval.name}
                              </span>
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                                Note &lt; 10
                              </Badge>
                            </div>
                            <p className="text-muted-foreground text-[11px]">
                              {unval.sequence}
                              {unval.completed_at && ` · Déposé le ${new Date(unval.completed_at).toLocaleDateString('fr-FR')}`}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="p-3 rounded-lg border border-border bg-card text-xs text-muted-foreground mt-3">
                        <span className="font-semibold text-foreground">Action à entreprendre : </span>
                        Rendez-vous sur la plateforme Moodle, consultez les remarques et annotations de votre évaluateur, puis déposez à nouveau votre devoir corrigé.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-950 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-emerald-950">
                        Dossier conforme et à jour
                      </h3>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Tous les devoirs et activités franchis jusqu'à présent sont validés. Continuez ainsi jusqu'au bout du parcours.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sequence by Sequence Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Détail de votre parcours par séquence
                </h3>
                <span className="text-xs text-muted-foreground">
                  Cliquez pour afficher ou masquer
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
                      'border rounded-xl overflow-hidden bg-card transition-colors',
                      hasTrou ? 'border-destructive/40' : 'border-border'
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
                            isAllDone ? 'bg-emerald-600' : hasTrou ? 'bg-destructive' : 'bg-primary'
                          )}
                        />
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm sm:text-base text-foreground truncate">
                            {seq.sequence}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {seq.completed} sur {seq.total} activité(s) validée(s)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isAllDone && (
                          <Badge className="bg-emerald-600 text-white text-[11px] font-semibold border-none">
                            Validée
                          </Badge>
                        )}
                        {hasTrou && (
                          <Badge variant="destructive" className="text-[11px] font-semibold gap-1">
                            <AlertTriangle className="h-3 w-3" /> Devoir à rattraper
                          </Badge>
                        )}
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="p-4 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-muted/5">
                        {seq.activities.map((act, aIdx) => {
                          const isDone = act.status === 'completed' || act.status === 'passed';
                          const isFailed = act.status === 'failed';
                          const isTrou = act.is_trou;
                          const isDevoir = act.is_devoir;

                          return (
                            <div
                              key={aIdx}
                              className={cn(
                                'p-3 rounded-lg border flex items-start gap-3 bg-card transition-colors',
                                isTrou
                                  ? 'border-destructive/40 bg-destructive/5'
                                  : isDone
                                  ? 'border-border'
                                  : 'border-dashed border-border opacity-70'
                              )}
                            >
                              <div
                                className={cn(
                                  'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                                  isTrou
                                    ? 'bg-destructive/15 text-destructive'
                                    : isDone
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : isFailed
                                    ? 'bg-destructive/15 text-destructive'
                                    : 'bg-muted text-muted-foreground'
                                )}
                              >
                                {isTrou ? (
                                  <AlertTriangle className="h-4 w-4" />
                                ) : isDone ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : isFailed ? (
                                  <AlertTriangle className="h-4 w-4" />
                                ) : (
                                  <Clock className="h-4 w-4" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p
                                  className={cn(
                                    'text-xs sm:text-sm font-medium text-foreground line-clamp-2',
                                    isTrou && 'text-destructive font-semibold'
                                  )}
                                  title={act.name}
                                >
                                  {act.name}
                                </p>

                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                  {isDevoir && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-semibold border-border text-muted-foreground"
                                    >
                                      Devoir obligatoire
                                    </Badge>
                                  )}

                                  {isTrou ? (
                                    <span className="text-[11px] font-bold text-destructive">
                                      Non validé (Note &lt; 10)
                                    </span>
                                  ) : isDone ? (
                                    <span className="text-[11px] text-emerald-600 font-medium">
                                      Validé {act.completed_at ? `le ${new Date(act.completed_at).toLocaleDateString('fr-FR')}` : ''}
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
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-border bg-card py-4 text-center text-xs text-muted-foreground mt-auto">
        <p>Plateforme de formation DCLIC · Suivi pédagogique individuel</p>
      </footer>
    </div>
  );
};

export default LearnerPortal;
