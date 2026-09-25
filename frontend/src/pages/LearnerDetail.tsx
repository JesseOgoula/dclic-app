import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  ArrowLeft,
  Mail,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, ResponsiveContainer } from 'recharts';
import { useFormation } from '@/context/FormationContext';

interface LearnerDetailProps {
  id: string;
  onBack: () => void;
}

const SequenceAccordion = ({
  seq,
  activities,
  unvalidatedIds = new Set<string>(),
  defaultOpen = false,
}: {
  seq: string;
  activities: any[];
  unvalidatedIds?: Set<string>;
  defaultOpen?: boolean;
}) => {
  const hasUnvalidatedInSeq = activities.some((act: any) => unvalidatedIds.has(act.id));
  const [isOpen, setIsOpen] = useState(defaultOpen || hasUnvalidatedInSeq);

  return (
    <div
      className={cn(
        'mb-3 last:mb-0 border rounded-xl overflow-hidden bg-white transition-colors shadow-none',
        hasUnvalidatedInSeq ? 'border-red-200' : 'border-[#F1F5F9]'
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 bg-[#F8FAFC]/60 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className={cn('h-4 w-1 rounded-full', hasUnvalidatedInSeq ? 'bg-red-500' : 'bg-blue-600')} />
          <h3 className="font-semibold text-xs text-neutral-900">{seq}</h3>
          <span className="text-[10px] font-medium text-neutral-400 bg-white border border-[#E2E8F0] px-2 py-0.5 rounded-full ml-1">
            {activities.length} activité{activities.length > 1 ? 's' : ''}
          </span>
          {hasUnvalidatedInSeq && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full ml-1">
              <AlertTriangle className="h-2.5 w-2.5" /> Devoir à rattraper
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-neutral-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-neutral-400" />
        )}
      </button>

      {isOpen && (
        <div className="p-3.5 border-t border-[#F1F5F9] grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-white">
          {activities.map((act: any, j: number) => {
            const isUnvalidated = unvalidatedIds.has(act.id);
            const isCompleted = act.status === 'completed' || act.status === 'passed';
            const isLettre = act.name.toLowerCase().includes('lettre d');

            return (
              <div
                key={j}
                className={cn(
                  'flex items-start gap-2.5 p-2.5 rounded-xl border transition-colors shadow-none text-xs',
                  isUnvalidated
                    ? 'border-red-200 bg-red-50/40'
                    : 'border-[#F1F5F9] bg-[#FAFAFA]/50 hover:bg-[#FAFAFA]'
                )}
              >
                <div className="shrink-0 mt-0.5">
                  {isUnvalidated ? (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  ) : act.status === 'failed' ? (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-neutral-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'font-medium truncate',
                      isUnvalidated ? 'text-red-700 font-semibold' : 'text-neutral-800'
                    )}
                    title={act.name}
                  >
                    {act.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-medium text-neutral-400 bg-white border border-[#E2E8F0] px-1.5 py-0.5 rounded">
                      {act.type}
                    </span>
                    {isUnvalidated && (
                      <span className="text-[10px] font-medium text-red-600 bg-red-100/60 px-1.5 py-0.5 rounded">
                        {isLettre ? 'Lettre non déposée' : 'Note < 10'}
                      </span>
                    )}
                    {act.completed_at && (
                      <span className="text-[10px] text-neutral-400">
                        {isUnvalidated ? 'Soumis le ' : ''}
                        {new Date(act.completed_at).toLocaleDateString('fr-FR')}
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
};

const formatTimeAgo = (isoString: string | null) => {
  if (!isoString) return 'Jamais';
  const last = new Date(isoString).getTime();
  const now = new Date().getTime();
  const diff = Math.max(0, now - last);

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return days === 1 ? 'Hier' : `Il y a ${days} jour(s)`;
  }
  if (hours > 0) {
    return `Il y a ${hours} heure(s) et ${minutes % 60} minute(s)`;
  }
  if (minutes > 0) {
    return `Il y a ${minutes} minute(s)`;
  }
  return `Il y a ${seconds} seconde(s)`;
};

export const LearnerDetail: React.FC<LearnerDetailProps> = ({ id, onBack }) => {
  const { currentFormation, formationTitle, formationCategory } = useFormation();
  const [learner, setLearner] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      setLoading(true);
      api
        .getLearner(id, currentFormation)
        .then((data) => setLearner(data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id, currentFormation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-neutral-800 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-neutral-400 font-medium">Chargement de la fiche apprenant...</span>
        </div>
      </div>
    );
  }

  if (!learner) {
    return (
      <div className="bg-white border border-[#F1F5F9] rounded-2xl p-12 text-center">
        <p className="text-xs text-neutral-500 font-medium">Apprenant introuvable.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 text-xs text-neutral-700 underline font-medium cursor-pointer"
        >
          Retour à la liste des apprenants
        </button>
      </div>
    );
  }

  const unvalidatedIds = new Set<string>(
    (learner.unvalidated_assignments || []).map((u: any) => u.activity_id as string)
  );

  return (
    <div className="space-y-6">
      {/* 1. Header (Clean ClickUp Title, Back Button & Contact Action) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-[#E2E8F0] hover:bg-neutral-50 bg-white text-neutral-700 transition-colors shadow-none cursor-pointer shrink-0"
            title="Retour à la liste"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
              {learner.first_name} {learner.last_name}
            </h1>
            <p className="text-xs text-neutral-500 font-medium mt-1 flex items-center gap-2">
              <span>{learner.email}</span>
              <span>·</span>
              <span>Groupe {learner.group_id}</span>
              <span>·</span>
              <span className="text-neutral-900 font-semibold">{formationTitle}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`mailto:${learner.email}?subject=Suivi pédagogique ${formationTitle}&body=Bonjour ${learner.first_name},`}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E2E8F0] hover:bg-neutral-50 bg-white text-xs font-medium text-neutral-700 transition-colors shadow-none cursor-pointer"
          >
            <Mail className="h-3.5 w-3.5 text-neutral-500" />
            <span>Contacter par email</span>
          </a>
        </div>
      </div>

      {/* 2. Unvalidated assignments warning banner */}
      {learner.has_unvalidated_assignments && (
        <div className="bg-red-50/70 border border-red-200/60 rounded-2xl p-5 shadow-none">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-red-900">
                {learner.unvalidated_assignments?.length || 0} devoir(s) en attente de validation ou rattrapage
              </h3>
              <p className="text-xs text-red-700/80 max-w-3xl leading-relaxed">
                Cet apprenant poursuit son parcours mais présente des devoirs obligatoires non validés (note minimale non atteinte) ou un document obligatoire non déposé.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {learner.unvalidated_assignments?.map((u: any, idx: number) => {
                  const isLettre = u.name.toLowerCase().includes('lettre d');
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-red-800 bg-white border border-red-200 px-2.5 py-1 rounded-lg"
                    >
                      <span>{u.name}</span>
                      <span className="text-neutral-400">·</span>
                      <span className="text-neutral-500">{u.sequence}</span>
                      <span className="text-red-600 font-semibold">({isLettre ? 'Dépôt manquant' : 'Note < 10'})</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (4 cols): Résumé */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-[#F1F5F9] rounded-2xl p-6 shadow-none space-y-5">
            <h3 className="text-sm font-semibold text-neutral-900">Synthèse apprenant</h3>

            <div>
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Statut</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {learner.status === 'active' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
                    Actif
                  </span>
                )}
                {learner.status === 'inactive' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200/60">
                    Inactif
                  </span>
                )}
                {learner.status === 'dropped' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                    Décroché
                  </span>
                )}
                {learner.status === 'completed_phase1' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
                    <CheckCircle2 size={11} /> Phase 1 terminée
                  </span>
                )}
                {learner.status === 'completed' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <Award size={11} /> Terminé (100%)
                  </span>
                )}
                {learner.is_blocked && learner.status !== 'dropped' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-50 text-red-700 border border-red-200/60">
                    <AlertTriangle size={11} /> Bloqué
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                <span>Progression globale</span>
                <span className="text-neutral-900 font-bold text-xs">{learner.completion_rate}%</span>
              </div>
              <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${learner.completion_rate}%` }}
                />
              </div>
            </div>

            <div className="border-t border-[#F1F5F9] pt-4">
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Activités complétées</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-neutral-900">{learner.completed_activities}</span>
                <span className="text-xs text-neutral-400">/ {learner.total_activities} au total</span>
              </div>
            </div>

            {learner.last_activity_at && (
              <div className="border-t border-[#F1F5F9] pt-4">
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Dernière activité</p>
                <p className="text-xs font-medium text-neutral-700">{formatTimeAgo(learner.last_activity_at)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (8 cols): Activity Chart & Parcours */}
        <div className="lg:col-span-8 space-y-6">
          {/* Daily Activity Chart */}
          <div className="bg-white border border-[#F1F5F9] rounded-2xl p-6 shadow-none">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-neutral-900">Activité par jour</h3>
              <p className="text-xs text-neutral-400 mt-0.5">Fréquence de complétion des modules</p>
            </div>

            {(() => {
              const completed = learner.activities.filter(
                (a: any) => (a.status === 'completed' || a.status === 'passed') && a.completed_at
              );
              const byDay = completed.reduce((acc: any, curr: any) => {
                const day = curr.completed_at.split('T')[0];
                acc[day] = (acc[day] || 0) + 1;
                return acc;
              }, {});
              const chartData = Object.entries(byDay)
                .sort((a: any, b: any) => a[0].localeCompare(b[0]))
                .map(([date, count]) => ({ date, count }));

              if (chartData.length === 0) {
                return (
                  <div className="text-xs text-neutral-400 py-8 text-center font-medium">
                    Aucune activité enregistrée pour cet apprenant
                  </div>
                );
              }

              return (
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#94A3B8' }}
                        tickFormatter={(v: string) => {
                          const [, m, d] = v.split('-');
                          return `${d}/${m}`;
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#94A3B8' }}
                        axisLine={false}
                        tickLine={false}
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
                        formatter={(value: any) => [`${value} activités`, 'Complétées']}
                        labelFormatter={(label: any) => {
                          const [y, m, d] = label.split('-');
                          return `${d}/${m}/${y}`;
                        }}
                      />
                      <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </div>

          {/* Training Track / Parcours Accordions */}
          <div className="bg-white border border-[#F1F5F9] rounded-2xl p-6 shadow-none">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-neutral-900">Parcours de formation</h3>
              <p className="text-xs text-neutral-400 mt-0.5">Détail des activités par séquence pédagogique</p>
            </div>

            <div className="space-y-3">
              {Array.from(new Set(learner.activities.map((a: any) => a.sequence))).map((seq: any, i) => (
                <SequenceAccordion
                  key={i}
                  seq={seq}
                  activities={learner.activities.filter((a: any) => a.sequence === seq)}
                  unvalidatedIds={unvalidatedIds}
                  defaultOpen={i === 0}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
