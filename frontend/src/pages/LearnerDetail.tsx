import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ArrowLeft, Mail, AlertCircle, CheckCircle2, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, ResponsiveContainer } from 'recharts';

interface LearnerDetailProps {
  id: string;
  onBack: () => void;
}

const SequenceAccordion = ({ seq, activities }: { seq: string; activities: any[] }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-4 last:mb-0 border border-border rounded-xl overflow-hidden bg-card">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-6 w-1 bg-primary rounded-full"></div>
          <h3 className="font-bold text-base text-foreground">{seq}</h3>
          <Badge variant="outline" className="ml-2 bg-background">
            {activities.length} activité(s)
          </Badge>
        </div>
        {isOpen ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
      </button>

      {isOpen && (
        <div className="p-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3 bg-background/50">
          {activities.map((act: any, j: number) => (
            <div key={j} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
              <div className={cn(
                "mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                (act.status === 'completed' || act.status === 'passed') ? "bg-green-100 text-green-700" :
                  act.status === 'failed' ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
              )}>
                {act.status === 'completed' || act.status === 'passed' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : act.status === 'failed' ? (
                  <AlertCircle className="h-5 w-5" />
                ) : (
                  <Clock className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm truncate" title={act.name}>{act.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="font-medium text-[10px] text-muted-foreground">
                    {act.type}
                  </Badge>
                  {act.completed_at && (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {new Date(act.completed_at).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
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

  if (loading) return <div className="p-8">Chargement...</div>;
  if (!learner) return <div className="p-8 text-red-500">Apprenant non trouvé.</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={onBack}
          className="h-10 w-10 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {learner.first_name} {learner.last_name}
          </h1>
          <p className="text-slate-500 flex items-center gap-2 mt-1">
            <Mail className="h-4 w-4" /> {learner.email}
            <span className="mx-2">•</span>
            Groupe {learner.group_id}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 shadow-sm border-border">
          <CardHeader>
            <CardTitle className="text-lg">Résumé</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Statut</p>
              {learner.status === 'active' && (
                <Badge variant="default">Actif</Badge>
              )}
              {learner.status === 'inactive' && (
                <Badge variant="secondary">Inactif</Badge>
              )}
              {learner.status === 'dropped' && (
                <Badge variant="destructive">Décroché</Badge>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Progression Globale</p>
              <div className="flex items-center gap-3">
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${learner.completion_rate < 30 ? 'bg-rose-500' : 'bg-primary'}`}
                    style={{ width: `${learner.completion_rate}%` }}
                  />
                </div>
                <span className="text-sm font-bold">{learner.completion_rate}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Activités Complétées</p>
              <p className="text-2xl font-bold text-slate-900">
                {learner.completed_activities} <span className="text-sm font-normal text-slate-500">/ {learner.total_activities}</span>
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
                            const [y, m, d] = v.split('-');
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
