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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, ResponsiveContainer } from 'recharts';

interface LearnerDetailProps {
  id: string;
  onBack: () => void;
}

const SequenceAccordion = ({
  seq,
  activities,
  unvalidatedIds = new Set<string>(),
  defaultOpen = false
}: {
  seq: string;
  activities: any[];
  unvalidatedIds?: Set<string>;
  defaultOpen?: boolean;
}) => {
  const hasUnvalidatedInSeq = activities.some((act: any) => unvalidatedIds.has(act.id));
  const [isOpen, setIsOpen] = useState(defaultOpen || hasUnvalidatedInSeq);

  return (
    <div className={cn(
      "mb-4 last:mb-0 border rounded-xl overflow-hidden bg-card transition-colors",
      hasUnvalidatedInSeq ? "border-destructive/30" : "border-border"
    )}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className={cn("h-6 w-1 rounded-full", hasUnvalidatedInSeq ? "bg-destructive" : "bg-primary")}></div>
          <h3 className="font-bold text-base text-foreground">{seq}</h3>
          <Badge variant="outline" className="ml-2 bg-background">
            {activities.length} activité(s)
          </Badge>
          {hasUnvalidatedInSeq && (
            <Badge variant="destructive" className="text-[10px] gap-1 ml-1">
              <AlertTriangle className="h-3 w-3" /> Devoir à rattraper
            </Badge>
          )}
        </div>
        {isOpen ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
      </button>

      {isOpen && (
        <div className="p-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3 bg-background/50 animate-fade-in">
          {activities.map((act: any, j: number) => {
            const isUnvalidated = unvalidatedIds.has(act.id);
            const isCompleted = act.status === 'completed' || act.status === 'passed';
            const isLettre = act.name.toLowerCase().includes("lettre d");

            return (
              <div
                key={j}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border transition-colors shadow-xs",
                  isUnvalidated
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border bg-card"
                )}
              >
                <div className="shrink-0 mt-0.5">
                  {isUnvalidated ? (
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : act.status === 'failed' ? (
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  ) : (
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("font-semibold text-sm truncate", isUnvalidated ? "text-destructive font-bold" : "text-foreground")} title={act.name}>
                    {act.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <Badge variant="outline" className="font-medium text-[10px] text-muted-foreground">
                      {act.type}
                    </Badge>
                    {isUnvalidated && (
                      <Badge variant="destructive" className="text-[10px] font-semibold">
                        {isLettre ? "Lettre non déposée (Dépôt obligatoire)" : "Devoir non validé (Note < 10)"}
                      </Badge>
                    )}
                    {act.completed_at && (
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {isUnvalidated ? 'Soumis le ' : ''}{new Date(act.completed_at).toLocaleDateString('fr-FR')}
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
  const [learner, setLearner] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      api.getLearner(id)
        .then(data => setLearner(data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;
  if (!learner) return <div className="p-8 text-center text-destructive">Apprenant non trouvé.</div>;

  const unvalidatedIds = new Set<string>((learner.unvalidated_assignments || []).map((u: any) => u.activity_id as string));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={onBack}
            className="h-10 w-10 shrink-0 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {learner.first_name} {learner.last_name}
            </h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1 text-sm">
              <Mail className="h-4 w-4" /> {learner.email}
              <span className="mx-1">•</span>
              Groupe {learner.group_id}
            </p>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`mailto:${learner.email}?subject=Suivi formation DCLIC&body=Bonjour ${learner.first_name},`}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted text-foreground transition-colors shadow-xs"
          >
            <Mail className="h-4 w-4 text-primary" />
            Contacter par email
          </a>
        </div>
      </div>

      {/* Unvalidated assignments warning banner */}
      {learner.has_unvalidated_assignments && (
        <div className="rounded-xl border border-destructive/30 bg-card p-5 shadow-xs text-foreground animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-bold text-base text-destructive flex items-center gap-2">
                Attention : {learner.unvalidated_assignments?.length || 0} devoir(s) en attente de validation / rattrapage
              </h3>
              <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Cet apprenant a continué à avancer dans les modules suivants, mais présente des devoirs obligatoires non validés (note minimale de 10/20 non atteinte) ou une lettre d'engagement non déposée.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {learner.unvalidated_assignments?.map((u: any, idx: number) => {
                  const isLettre = u.name.toLowerCase().includes("lettre d");
                  return (
                    <Badge key={idx} variant="destructive" className="font-medium text-xs py-1 px-2.5">
                      {u.name} — <span className="opacity-90 font-normal ml-1">{u.sequence}</span>
                      <span className="font-semibold ml-1">({isLettre ? "Dépôt manquant" : "Note < 10"})</span>
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 shadow-sm border-border">
          <CardHeader>
            <CardTitle className="text-lg">Résumé</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1.5">Statut</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {learner.status === 'active' && (
                  <Badge variant="default">Actif</Badge>
                )}
                {learner.status === 'inactive' && (
                  <Badge variant="secondary">Inactif</Badge>
                )}
                {learner.status === 'dropped' && (
                  <Badge variant="destructive">Décroché</Badge>
                )}
                {learner.status === 'completed_phase1' && (
                  <Badge variant="outline" className="border-primary text-primary font-semibold gap-1">
                    <CheckCircle2 size={12} /> Phase 1 terminée
                  </Badge>
                )}
                {learner.status === 'completed' && (
                  <Badge variant="default" className="bg-emerald-600 text-white font-semibold gap-1">
                    <Award size={12} /> Session terminée (100%)
                  </Badge>
                )}
                {learner.is_blocked && learner.status !== 'dropped' && (
                  <Badge variant="destructive" className="bg-red-600 font-semibold gap-1">
                    <AlertTriangle size={12} /> Bloqué (devoir à rattraper)
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Progression Globale</p>
              <div className="flex items-center gap-3">
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full transition-all duration-500', learner.completion_rate < 30 ? 'bg-destructive' : 'bg-primary')}
                    style={{ width: `${learner.completion_rate}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-foreground">{learner.completion_rate}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Activités Complétées</p>
              <p className="text-2xl font-bold text-foreground">
                {learner.completed_activities} <span className="text-sm font-normal text-muted-foreground">/ {learner.total_activities}</span>
              </p>
            </div>
            {learner.last_activity_at && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Dernière activité</p>
                <p className="text-foreground">
                  {formatTimeAgo(learner.last_activity_at)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Activité par jour</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const completed = learner.activities.filter((a: any) => (a.status === 'completed' || a.status === 'passed') && a.completed_at);
                const byDay = completed.reduce((acc: any, curr: any) => {
                  const day = curr.completed_at.split('T')[0];
                  acc[day] = (acc[day] || 0) + 1;
                  return acc;
                }, {});
                const chartData = Object.entries(byDay)
                  .sort((a: any, b: any) => a[0].localeCompare(b[0]))
                  .map(([date, count]) => ({ date, count }));

                if (chartData.length === 0) {
                  return <div className="text-sm text-muted-foreground py-8 text-center">Aucune activité enregistrée</div>;
                }

                return (
                  <div className="h-[200px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={24}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          tickFormatter={(v: string) => {
                            const [, m, d] = v.split('-');
                            return `${d}/${m}`;
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          formatter={(value: any) => [`${value} activités`, 'Complétées']}
                          labelFormatter={(label: any) => {
                            const [y, m, d] = label.split('-');
                            return `${d}/${m}/${y}`;
                          }}
                        />
                        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="text-lg">Parcours de formation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
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
          </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
