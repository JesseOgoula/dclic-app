import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  Mail,
  LogOut,
  UserCheck,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api, type LearnerPortalData, type FormationType } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type LearnerOutcomeTier =
  | 'validated'
  | 'phase1_no_pp'
  | 'phase1_failed_pp'
  | 'incomplete';

export function getLearnerOutcome(data: LearnerPortalData): LearnerOutcomeTier {
  // 1. Si l'apprenant a validé son Projet Professionnel, c'est un succès garanti !
  if (data.pp_grades && data.pp_grades.validated) {
    return 'validated';
  }

  // 2. Cas du parcours Spécialisation GP
  if (data.formation === 'gp') {
    if (data.learner.status === 'completed' || (!data.has_unvalidated_assignments && data.completion_rate >= 100)) {
      return 'validated';
    }
    return 'incomplete';
  }

  // 3. Cas du parcours Formation Initiale MN
  const isPhase1Done = Boolean(
    data.learner.status === 'completed' ||
    data.learner.status === 'completed_phase1' ||
    data.completed_activities >= 72 ||
    (!data.has_unvalidated_assignments && data.completion_rate >= 90)
  );

  if (isPhase1Done) {
    if (data.pp_grades?.has_pp) {
      return 'phase1_failed_pp';
    }
    return 'phase1_no_pp';
  }

  return 'incomplete';
}

export function getOutcomeModalContent(tier: LearnerOutcomeTier, data: LearnerPortalData) {
  const firstName = data.learner.first_name;

  switch (tier) {
    case 'phase1_no_pp':
      return {
        badge: 'Séquences 1 à 5 validées · Projet Professionnel non remis',
        title: 'Parcours des 5 séquences validé · Projet Pro non remis',
        bodyIntro: `Félicitations ${firstName} pour votre engagement et votre rigueur ! Vous avez suivi et validé avec succès l'intégralité des 5 séquences pédagogiques de la formation initiale en Marketing Numérique. Vos résultats démontrent un travail assidu tout au long du parcours.`,
        bodyReason: `Cependant, l'obtention de la certification finale D-CLIC est conditionnée par la remise et l'évaluation terminale des 4 livrables du Projet Professionnel (Stratégie, Gantt & Budget, Contenus, Tableau de bord). Aucun livrable de Projet Professionnel n'ayant été enregistré lors de cette session, votre formation ne peut malheureusement pas être certifiée pour cette promotion.`,
        bodyNextSession: `Ne vous arrêtez pas en si bon chemin ! Vos acquis sur l'ensemble des 5 séquences sont d'ores et déjà validés. Nous vous invitons chaleureusement à vous inscrire pour la prochaine session afin de soumettre vos livrables de Projet Professionnel et décrocher définitivement votre certification D-CLIC.`,
      };

    case 'phase1_failed_pp':
      return {
        badge: 'Séquences 1 à 5 validées · Projet Professionnel ajourné',
        title: 'Parcours des séquences validé · Seuil non atteint au Projet Pro',
        bodyIntro: `Félicitations ${firstName} pour votre investissement ! Vous avez validé l'ensemble des 5 séquences de formation et vous avez conduit votre travail jusqu'à la remise complète des livrables du Projet Professionnel.`,
        bodyReason: `Après correction et évaluation collégiale de vos livrables (Stratégie, Gantt & Budget, Contenus, Tableau de bord), la note globale obtenue n'atteint malheureusement pas le seuil minimum de validation de 10/20 exigé pour la certification D-CLIC lors de cette session.`,
        bodyNextSession: `Ne baissez surtout pas les bras ! L'essentiel des compétences a été assimilé. Nous vous encourageons vivement à vous réinscrire lors de la prochaine session pour ajuster vos livrables, intégrer les retours pédagogiques et obtenir votre certification D-CLIC avec succès.`,
      };

    case 'incomplete':
    default:
      return {
        badge: 'Session terminée · Parcours non finalisé',
        title: 'Bilan de fin de formation',
        bodyIntro: `Bonjour ${firstName}, vous avez participé à la formation en Marketing Numérique. Votre parcours enregistre une progression de ${data.completion_rate}%, avec ${data.completed_activities} activité(s) validée(s) sur un total de ${data.total_activities}.`,
        bodyReason: `L'ensemble des activités obligatoires et des évaluations des séquences n'ayant pas été validé avec succès, vous n'avez malheureusement pas terminé la formation avec succès pour cette promotion et ne pouvez prétendre à la certification sur cette session.`,
        bodyNextSession: `Chaque étape d'apprentissage est constructive. Nous vous invitons chaleureusement à vous inscrire pour la prochaine session de formation. Vous pourrez reprendre votre parcours avec un nouvel élan, consolider vos acquis et franchir toutes les étapes jusqu'à la certification.`,
      };
  }
}

export interface LearnerPortalProps {}

export const LearnerPortal: React.FC<LearnerPortalProps> = () => {
  const [formation, setFormation] = useState<FormationType>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const f = urlParams.get('formation');
    if (f === 'mn' || f === 'gp') return f;
    return 'mn';
  });

  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalData, setPortalData] = useState<LearnerPortalData | null>(null);
  const [openSequences, setOpenSequences] = useState<Record<string, boolean>>({});
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const f = urlParams.get('formation');
    if (f === 'mn' || f === 'gp') {
      setFormation(f);
    }
    const emailParam = urlParams.get('email');
    if (emailParam) {
      setEmailInput(emailParam);
      handleSearch(emailParam, f === 'mn' || f === 'gp' ? f : undefined);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowOutcomeModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 250);
  };

  const handleSearch = async (emailToSearch?: string, formationOverride?: FormationType) => {
    const targetEmail = (emailToSearch || emailInput).trim();
    if (!targetEmail) {
      setError('Veuillez renseigner votre adresse e-mail ou votre nom.');
      return;
    }

    const targetFormation = formationOverride || formation;

    setLoading(true);
    setError(null);

    try {
      const data = await api.getLearnerPortal(targetEmail, targetFormation);
      setPortalData(data);

      const isGPFormation = data.formation === 'gp' || data.learner.group_id?.includes('GPM') || targetFormation === 'gp';

      if (isGPFormation) {
        setFormation('gp');
        setShowOutcomeModal(false);
        if (data.completion_rate === 100) {
          setTimeout(() => {
            triggerConfetti();
          }, 300);
        }
      } else {
        setFormation('mn');
        const tier = getLearnerOutcome(data);
        if (tier === 'validated') {
          setShowOutcomeModal(false);
          setTimeout(() => {
            triggerConfetti();
          }, 300);
        } else {
          setShowOutcomeModal(true);
        }
      }

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
      url.searchParams.set('formation', data.formation || targetFormation);
      window.history.replaceState({}, '', url.toString());
    } catch (err: any) {
      setPortalData(null);
      setError(err.message || 'Aucun apprenant trouvé. Vérifiez votre saisie (e-mail ou nom).');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPortalData(null);
    setEmailInput('');
    setError(null);
    setShowOutcomeModal(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('email');
    window.history.replaceState({}, '', url.toString());
  };

  const toggleSequence = (seqName: string) => {
    setOpenSequences(prev => ({ ...prev, [seqName]: !prev[seqName] }));
  };

  const isGP = formation === 'gp';
  const outcomeTier = portalData ? getLearnerOutcome(portalData) : 'incomplete';
  const outcomeContent = portalData ? getOutcomeModalContent(outcomeTier, portalData) : null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Barre du haut épurée avec lien retour dashboard */}
      <header className="h-14 border-b border-border bg-white px-4 sm:px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center">
          <span className="font-semibold text-sm text-foreground">Portail de suivi apprenant</span>
          <span className="text-xs text-muted-foreground ml-2">
            · {isGP ? 'Spécialisation Gestion de projet' : 'Formation initiale'}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* State 1: Email Form (Initial or Reset) */}
        {!portalData && (
          <div className="max-w-md mx-auto pt-8 sm:pt-16 pb-12">
            <Card className="border-border bg-card shadow-none">
              <CardHeader className="text-center pb-4">
                <UserCheck className="h-10 w-10 text-primary mx-auto mb-3" />
                <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">
                  Consulter mon avancement
                </CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  Renseignez votre adresse e-mail ou votre nom pour visualiser votre progression.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSearch();
                  }}
                  className="space-y-3"
                >
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="votre.email@exemple.com ou Nom Prénom"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="pl-10 h-11 text-sm sm:text-base bg-background"
                      required
                      autoFocus
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 font-semibold gap-2 cursor-pointer shadow-none"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Consulter ma progression
                  </Button>
                </form>

                {error && (
                  <div className="p-3.5 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2.5 border border-destructive/20">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="text-center text-xs text-muted-foreground space-y-1.5 pt-2">
                  <p className="font-semibold text-foreground">
                    {isGP ? 'Validation du parcours de spécialisation :' : 'Validation du parcours :'}
                  </p>
                  <p className="leading-relaxed">
                    {isGP ? (
                      <>
                        Assurez-vous de valider les livrables des Séquences 1 à 5 avec une note minimale de <strong>10/20</strong>, ainsi que le Projet de Spécialisation et le Portfolio avec au moins <strong>12/20</strong> pour valider votre certification.
                      </>
                    ) : (
                      <>
                        Assurez-vous de compléter toutes les activités et de valider les livrables obligatoires avec une note minimale de <strong>10/20</strong> pour valider votre certification.
                      </>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* State 2: Learner Data Displayed */}
        {portalData && (
          <div className="space-y-6 animate-fade-in">
            {/* Top action bar */}
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Espace Apprenant
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="text-xs h-8 gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                Changer d'adresse e-mail
              </Button>
            </div>

            {/* Learner Identity & Status Card */}
            <Card className="border-border bg-card shadow-none">
              <CardHeader className="pb-4 border-b border-border bg-muted/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-foreground">
                      {portalData.learner.first_name} {portalData.learner.last_name}
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
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
                    {outcomeTier === 'validated' ? (
                      <Badge className="bg-neutral-900 hover:bg-neutral-800 text-white px-3 py-1 font-medium text-xs">
                        Formation validée
                      </Badge>
                    ) : outcomeTier === 'phase1_no_pp' ? (
                      <Badge variant="outline" className="bg-neutral-50 text-neutral-800 border-neutral-300 px-3 py-1 font-medium text-xs">
                        Phase 1 validée · PP non remis
                      </Badge>
                    ) : outcomeTier === 'phase1_failed_pp' ? (
                      <Badge variant="outline" className="bg-neutral-50 text-neutral-800 border-neutral-300 px-3 py-1 font-medium text-xs">
                        Phase 1 validée · PP ajourné
                      </Badge>
                    ) : portalData.has_unvalidated_assignments ? (
                      <Badge variant="destructive" className="gap-1.5 px-3 py-1 font-semibold text-xs">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Devoir(s) en attente de rattrapage
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-neutral-50 text-neutral-600 border-neutral-300 px-3 py-1 font-medium text-xs">
                        Parcours non finalisé
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6 space-y-6">
                {/* 3 Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="p-4 rounded-xl border border-border bg-card flex flex-col justify-center">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Progression globale
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
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
                      <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
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
                      <span className="text-2xl sm:text-3xl font-extrabold text-foreground">
                        {portalData.has_unvalidated_assignments ? portalData.unvalidated_assignments.length : 0}
                      </span>
                      <span className="text-xs text-muted-foreground">à régulariser</span>
                    </div>
                    <span className={cn(
                      "text-xs mt-2 font-medium",
                      portalData.has_unvalidated_assignments ? "text-destructive" : "text-emerald-600"
                    )}>
                      {portalData.has_unvalidated_assignments
                        ? 'Validation ou dépôt requis'
                        : 'Aucun devoir en retard'}
                    </span>
                  </div>
                </div>

                {/* Diagnostic Banner */}
                {portalData.has_unvalidated_assignments ? (
                  <div className="p-4 sm:p-5 rounded-xl border border-destructive/30 bg-card text-foreground space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-bold text-sm sm:text-base text-destructive">
                          Attention : {portalData.unvalidated_assignments.length} élément(s) obligatoire(s) non validé(s)
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                          {isGP ? (
                            <>
                              Pour valider votre certification de spécialisation, les livrables des Séquences 1 à 5 doivent atteindre une note minimale de <strong>10/20</strong>, et les épreuves de certification (Projet de Spécialisation et Portfolio) au moins <strong>12/20</strong>. Sans la régularisation des éléments ci-dessous, la spécialisation ne pourra être considérée comme validée.
                            </>
                          ) : (
                            <>
                              Bien que vous ayez pu avancer dans les séquences suivantes, les devoirs obligatoires ci-dessous n'ont pas atteint la note minimale de <strong>10/20</strong> requise ou votre lettre d'engagement n'a pas été déposée. Sans la régularisation de ces éléments, la formation ne pourra être considérée comme achevée.
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {portalData.unvalidated_assignments.map((unval, i) => {
                          const isLettre = unval.name.toLowerCase().includes("lettre d");
                          const isS6 = isGP && (unval.sequence.toLowerCase().includes("séquence 6") || unval.name.toLowerCase().includes("portfolio") || unval.name.toLowerCase().includes("projet de spécialisation"));

                          return (
                            <div
                              key={i}
                              className="p-3 rounded-lg border border-destructive/20 bg-background text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-foreground truncate" title={unval.name}>
                                  {unval.name}
                                </span>
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                                  {isLettre ? "Dépôt manquant" : isS6 ? "Note < 12" : "Note < 10"}
                                </Badge>
                              </div>
                              <p className="text-muted-foreground text-[11px]">
                                {unval.sequence}
                                {unval.completed_at && ` · Déposé le ${new Date(unval.completed_at).toLocaleDateString('fr-FR')}`}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="p-3 rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground mt-3">
                        <span className="font-semibold text-foreground">Action à entreprendre : </span>
                        {isGP ? (
                          <span>
                            Consultez les remarques de votre tuteur sur Moodle pour soumettre votre devoir corrigé.
                          </span>
                        ) : (
                          <span>
                            Rendez-vous sur la plateforme Moodle pour déposer votre lettre d'engagement ou consulter les remarques de votre évaluateur afin de redéposer votre devoir corrigé.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-border bg-card text-foreground flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        Dossier conforme et à jour
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Tous les devoirs et activités franchis jusqu'à présent sont validés. Continuez ainsi jusqu'au bout du parcours.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Outcome Banner / Summary Section */}
            {isGP ? (
              <Card className="border-border bg-card shadow-none overflow-hidden">
                <CardContent className="pt-5 pb-5">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-neutral-100 text-neutral-800 border border-neutral-200">
                        Séquence 3 en cours (05 — 09 oct.)
                      </span>
                      <span className="text-xs text-muted-foreground">· Semaine 3 sur 8</span>
                    </div>
                    <h3 className="font-bold text-sm text-foreground">
                      Parcours de Spécialisation « Gestion de projets marketing 360° »
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Chaque séquence hebdomadaire (S1 à S5) valide un badge de compétence par la remise de sa mission au tuteur. La certification finale D-CLIC est délivrée à l'issue de la Séquence 6 (Projet de spécialisation & Portfolio, seuil de validation : <strong>12 / 20</strong>).
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : outcomeTier === 'validated' ? (
              <Card className="border-border bg-card shadow-none overflow-hidden">
                <CardContent className="pt-6 pb-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-neutral-800 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h3 className="font-bold text-sm text-foreground">
                        Félicitations {portalData.learner.first_name} ! Vous avez validé votre formation avec succès.
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Votre évaluation confirme la validation de l'épreuve terminale du Projet Professionnel pour la Formation Initiale en Marketing Numérique. Vous avez obtenu votre certification D-CLIC.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : outcomeContent ? (
              <Card className="border-border bg-card shadow-none overflow-hidden">
                <CardContent className="pt-6 pb-6 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <span className="inline-block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                        {outcomeContent.badge}
                      </span>
                      <h3 className="font-bold text-sm text-foreground">
                        {outcomeContent.title}
                      </h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {outcomeContent.bodyReason}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowOutcomeModal(true)}
                      className="shrink-0 text-xs h-8 border-neutral-300 hover:bg-neutral-100 cursor-pointer"
                    >
                      Voir la notification
                    </Button>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Prochaine étape :</span>{' '}
                    {outcomeContent.bodyNextSession}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Sequence by Sequence Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-sm sm:text-base font-bold text-foreground">
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
                const isS6 = isGP && (seq.sequence.toLowerCase().includes('séquence 6') || seq.sequence.toLowerCase().includes('portfolio'));

                return (
                  <div
                    key={sIdx}
                    className={cn(
                      'border rounded-xl overflow-hidden bg-card transition-colors',
                      hasTrou ? 'border-destructive/30' : 'border-border'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSequence(seq.sequence)}
                      className="w-full flex items-center justify-between p-3.5 sm:p-4 bg-muted/20 hover:bg-muted/30 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            'w-1.5 h-6 rounded-full shrink-0',
                            isAllDone ? 'bg-emerald-600' : hasTrou ? 'bg-destructive' : 'bg-primary'
                          )}
                        />
                        <div className="min-w-0">
                          <h4 className="font-semibold text-xs sm:text-sm text-foreground truncate">
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
                      <div className="p-3 sm:p-4 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-2 bg-muted/5">
                        {seq.activities.map((act, aIdx) => {
                          const isDone = act.status === 'completed' || act.status === 'passed';
                          const isFailed = act.status === 'failed';
                          const isTrou = act.is_trou;
                          const isDevoir = act.is_devoir;

                          return (
                            <div
                              key={aIdx}
                              className={cn(
                                'p-3 rounded-lg border flex items-start gap-2.5 bg-card transition-colors',
                                isTrou
                                  ? 'border-destructive/30'
                                  : isDone
                                  ? 'border-border'
                                  : 'border-dashed border-border opacity-70'
                              )}
                            >
                              <div className="shrink-0 mt-0.5">
                                {isTrou ? (
                                  <AlertTriangle className="h-4 w-4 text-destructive" />
                                ) : isDone ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                ) : isFailed ? (
                                  <AlertTriangle className="h-4 w-4 text-destructive" />
                                ) : (
                                  <Clock className="h-4 w-4 text-muted-foreground" />
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
                                      {act.name.toLowerCase().includes("lettre d")
                                        ? "Lettre non déposée"
                                        : isS6
                                        ? "Non validé (Note < 12)"
                                        : "Non validé (Note < 10)"}
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

        {/* Modal Popup pour les apprenants n'ayant pas validé la formation (formation initiale uniquement) */}
        {showOutcomeModal && portalData && !isGP && outcomeTier !== 'validated' && outcomeContent && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setShowOutcomeModal(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 text-left relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setShowOutcomeModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header / Badge */}
              <div className="space-y-2 pr-6">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-neutral-100 text-neutral-800 border border-neutral-200">
                  {outcomeContent.badge}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-neutral-900 leading-snug">
                  {outcomeContent.title}
                </h3>
              </div>

              {/* Body */}
              <div className="space-y-3 text-xs sm:text-sm text-neutral-600 leading-relaxed">
                <p>{outcomeContent.bodyIntro}</p>
                <p>{outcomeContent.bodyReason}</p>
              </div>

              {/* Callout box Prochaine Session */}
              <div className="p-4 rounded-xl border border-neutral-200 bg-[#F8FAFC] space-y-1.5 text-xs">
                <div className="font-semibold text-neutral-900">
                  Inscription pour la prochaine session
                </div>
                <p className="text-neutral-600 leading-relaxed">
                  {outcomeContent.bodyNextSession}
                </p>
              </div>

              {/* Actions */}
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={() => setShowOutcomeModal(false)}
                  className="w-full h-10 font-semibold bg-neutral-900 hover:bg-neutral-800 text-white cursor-pointer shadow-none"
                >
                  Consulter le détail de mon parcours
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-border bg-card py-4 text-xs text-muted-foreground mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center sm:text-left">
          <p>Plateforme de formation DCLIC · Suivi pédagogique individuel</p>
        </div>
      </footer>
    </div>
  );
};

export default LearnerPortal;
