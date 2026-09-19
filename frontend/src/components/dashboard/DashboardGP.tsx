import { useEffect, useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  TrendingUp,
  Award,
  Calendar,
  CheckCircle2,
  GraduationCap,
  Check,
  Copy,
  Target
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { api, type DashboardStats } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

const PIE_COLORS = ['#10b981', '#38bdf8', '#f43f5e', '#71717a'];

interface DashboardProps {
  onSelectLearner?: (id: string) => void;
  globalSearch?: string;
  onViewAll?: (filter: string) => void;
  program?: 'gp';
}

function getShortModuleCode(name: string): string {
  if (/diagnostic/i.test(name)) return 'Diag.';
  if (/planification/i.test(name)) return 'Planif.';
  if (/pilotage/i.test(name)) return 'Pilotage';
  if (/déploiement/i.test(name)) return 'Déploie.';
  if (/mesure/i.test(name)) return 'Mesure';
  if (/livrable/i.test(name)) return 'Livrable';
  if (/portfolio/i.test(name)) return 'Portfolio';
  return name.length > 10 ? name.slice(0, 10) + '...' : name;
}

export default function DashboardGP({ onSelectLearner, globalSearch = '', onViewAll, program = 'gp' }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerCopied, setBannerCopied] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const dynamicDeadlines = useMemo(() => {
    if (!stats) return [];

    const expectedSequences = [
      'Séquence 1 : Diagnostic & Positionnement',
      'Séquence 2 : Planification & Budget',
      'Séquence 3 : Pilotage opérationnel',
      'Séquence 4 : Déploiement 360°',
      'Séquence 5 : Mesure & Reporting',
      'Projet professionnel'
    ];

    return stats.sequence_stats
      .filter(s => s.sequence !== 'Autre' && s.sequence !== 'Préalable')
      .map(s => {
        let seqShort = s.sequence;
        if (s.sequence.includes('Séquence 1')) seqShort = 'Séquence 1';
        else if (s.sequence.includes('Séquence 2')) seqShort = 'Séquence 2';
        else if (s.sequence.includes('Séquence 3')) seqShort = 'Séquence 3';
        else if (s.sequence.includes('Séquence 4')) seqShort = 'Séquence 4';
        else if (s.sequence.includes('Séquence 5')) seqShort = 'Séquence 5';
        else if (s.sequence.includes('Projet')) seqShort = 'Projet pro';

        return { sequence: seqShort, fullSequence: s.sequence, dates: 'À définir', status: 'pending' };
      })
      .sort((a, b) => {
        const order = ['Séquence 1', 'Séquence 2', 'Séquence 3', 'Séquence 4', 'Séquence 5', 'Projet pro'];
        const indexA = order.indexOf(a.sequence);
        const indexB = order.indexOf(b.sequence);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.sequence.localeCompare(b.sequence);
      });
  }, [stats]);

  async function loadStats() {
    try {
      setLoading(true);
      const data = await api.getDashboardStats('gp');
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-400">Chargement des données de spécialisation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <p className="text-destructive text-sm font-medium">{error}</p>
          <button
            onClick={loadStats}
            className="mt-3 px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-xs font-medium transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const statusDistribution = [
    { name: 'Actifs', value: stats.active_learners, color: PIE_COLORS[0] },
    { name: 'Inactifs', value: stats.inactive_learners, color: PIE_COLORS[1] },
    { name: 'Décrocheurs', value: stats.dropped_learners, color: PIE_COLORS[2] },
    { name: 'Phase 1 terminée', value: stats.completed_phase1_learners, color: PIE_COLORS[3] },
    { name: 'Session terminée', value: stats.completed_learners, color: PIE_COLORS[0] },
  ].filter(d => d.value > 0);

  const searchLower = globalSearch.toLowerCase();
  const filteredTopPerformers = stats.top_performers.filter(l =>
    `${l.first_name} ${l.last_name} ${l.email}`.toLowerCase().includes(searchLower)
  );
  const filteredAtRisk = stats.at_risk.filter(l =>
    `${l.first_name} ${l.last_name} ${l.email}`.toLowerCase().includes(searchLower)
  );

  const filteredBlocked = stats.blocked_learners.filter(l =>
    `${l.first_name} ${l.last_name} ${l.email}`.toLowerCase().includes(searchLower)
  );

  const filteredCompletedPhase1 = stats.completed_phase1_list.filter(l =>
    `${l.first_name} ${l.last_name} ${l.email}`.toLowerCase().includes(searchLower)
  );
  const filteredCompleted = stats.completed_list.filter(l =>
    `${l.first_name} ${l.last_name} ${l.email}`.toLowerCase().includes(searchLower)
  );

  const projetProStat = stats.sequence_stats.find(s => s.sequence.toLowerCase().includes('projet'));

  return (
    <div className="space-y-4">
      {/* Learner portal banner */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-5 h-5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-bold text-foreground">Lien unique de l'Espace Apprenant (GP)</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Partagez ce lien unique avec tous les apprenants GP : chacun consulte sa progression personnelle.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 cursor-pointer font-medium bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-200"
            onClick={() => {
              const url = `${window.location.origin}/?portal=true&program=gp`;
              navigator.clipboard.writeText(url);
              setBannerCopied(true);
              setTimeout(() => setBannerCopied(false), 2500);
            }}
          >
            {bannerCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
            {bannerCopied ? 'Lien copié' : 'Copier le lien apprenants'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Apprenants"
          value={stats.total_learners}
          icon={Users}
          badgeText="G1_GPM_092026"
          badgeVariant="secondary"
          delay={1}
        />
        <KPICard
          title="Taux de complétion"
          value={`${stats.completion_rate}%`}
          icon={TrendingUp}
          badgeText={stats.completion_evolution !== undefined ? `${stats.completion_evolution > 0 ? '+' : ''}${stats.completion_evolution}% vs dernier upload` : "Moyenne"}
          badgeVariant={stats.completion_evolution !== undefined ? (stats.completion_evolution > 0 ? 'default' : stats.completion_evolution < 0 ? 'destructive' : 'secondary') : "outline"}
          delay={2}
          colorClass="text-zinc-200"
        />
        <KPICard
          title="Apprenants actifs"
          value={stats.active_learners}
          icon={UserCheck}
          badgeText={`${Math.round((stats.active_learners / Math.max(1, stats.total_learners)) * 100)}% de la cohorte`}
          badgeVariant="default"
          delay={3}
          colorClass="text-emerald-400"
        />
        <KPICard
          title="En risque"
          value={stats.inactive_learners + stats.dropped_learners}
          icon={AlertTriangle}
          badgeText={`${stats.inactive_learners} inactifs · ${stats.dropped_learners} décrocheurs`}
          badgeVariant="destructive"
          delay={4}
        />
      </div>

      {/* Deadlines and Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Sequence Deadlines */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-zinc-400" />
              <CardTitle className="text-base font-semibold">Deadlines Séquences</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Calendrier de la spécialisation</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pt-2">
              {dynamicDeadlines.length === 0 ? (
                <div className="text-sm text-muted-foreground">Aucune séquence disponible.</div>
              ) : dynamicDeadlines.map((deadline, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-2 h-10 rounded-full shrink-0 bg-muted-foreground/30" />
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      {deadline.sequence}
                    </p>
                    <p className="text-xs text-muted-foreground">{deadline.dates}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Progression par séquence */}
        <Card className="xl:col-span-2 shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Progression par séquence</CardTitle>
            <p className="text-sm text-muted-foreground">Taux de complétion moyen des activités</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={stats.sequence_stats
                  .filter(s => s.sequence !== 'Autre' && s.sequence !== 'Préalable')
                  .sort((a, b) => {
                    const getOrder = (seq: string) => {
                      if (seq.includes('Séquence 1')) return 1;
                      if (seq.includes('Séquence 2')) return 2;
                      if (seq.includes('Séquence 3')) return 3;
                      if (seq.includes('Séquence 4')) return 4;
                      if (seq.includes('Séquence 5')) return 5;
                      if (seq.includes('Projet')) return 6;
                      return 99;
                    };
                    return getOrder(a.sequence) - getOrder(b.sequence);
                  })}
                barSize={32}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="sequence"
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  tickFormatter={(v: string) => {
                    const match = v.match(/Séquence (\d)/);
                    if (match) return `Séq. ${match[1]}`;
                    if (v.includes('Projet')) return 'Projet pro';
                    return v.substring(0, 12);
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  tickFormatter={(v: number) => `${v}`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#141417',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                    padding: '8px 12px',
                    color: '#f4f4f5',
                    fontSize: '12px',
                  }}
                  formatter={(value: any, name: any) => [`${value} apprenants`, name]}
                  labelFormatter={(label: any) => label}
                />
                <Bar
                  dataKey="learners_completed"
                  name="Terminé"
                  stackId="a"
                  fill="#10b981"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="learners_in_progress"
                  name="En cours"
                  stackId="a"
                  fill="#38bdf8"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="learners_not_started"
                  name="Non commencé"
                  stackId="a"
                  fill="#27272a"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Répartition des statuts */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Statuts</CardTitle>
            <p className="text-sm text-muted-foreground">Répartition globale</p>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              {statusDistribution.map((entry, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="font-semibold">{entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Special Projet Professionnel Section */}
      {projetProStat && (
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-3 border-b border-border bg-zinc-900/40">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-zinc-300" />
              <div>
                <CardTitle className="text-base font-semibold">Projet Professionnel</CardTitle>
                <p className="text-xs text-muted-foreground">Progression sur les livrables d'entraînement et finaux</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total apprenants validés</span>
                  <span className="font-bold text-foreground">{projetProStat.learners_completed}</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full" 
                    style={{ width: `${Math.max(0, Math.min(100, (projetProStat.learners_completed / Math.max(1, stats.total_learners)) * 100))}%` }} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Apprenants en cours</span>
                  <span className="font-bold text-foreground">{projetProStat.learners_in_progress}</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-sky-500 rounded-full" 
                    style={{ width: `${Math.max(0, Math.min(100, (projetProStat.learners_in_progress / Math.max(1, stats.total_learners)) * 100))}%` }} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Moyenne d'avancement</span>
                  <span className="font-bold text-foreground">{projetProStat.avg_completion}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full" 
                    style={{ width: `${projetProStat.avg_completion}%` }} 
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top performers */}
        <Card className="shadow-sm border-border overflow-hidden">
          <CardHeader className="bg-muted/30 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-zinc-300" />
              <CardTitle className="text-base font-semibold">Top Performers</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredTopPerformers.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Aucun résultat</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Apprenant</TableHead>
                    <TableHead>Progression</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTopPerformers.slice(0, 5).map((learner, index) => (
                    <TableRow
                      key={learner.id}
                      className="cursor-pointer hover:bg-muted/20"
                      onClick={() => onSelectLearner?.(learner.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0',
                            index === 0 ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' :
                              index === 1 ? 'bg-zinc-700/30 text-zinc-200 border border-zinc-600/30' :
                                index === 2 ? 'bg-amber-800/20 text-amber-400 border border-amber-700/30' :
                                  'bg-zinc-800 text-zinc-400'
                          )}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-foreground truncate max-w-[150px]">{learner.first_name} {learner.last_name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{learner.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden shrink-0">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                learner.completion_rate > 0 ? "bg-emerald-500" : "bg-zinc-800"
                              )}
                              style={{ width: `${Math.max(learner.completion_rate, learner.completion_rate > 0 ? 4 : 0)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-foreground shrink-0">{learner.completion_rate}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* At risk */}
        <Card className="shadow-sm border-border overflow-hidden">
          <CardHeader className="bg-muted/30 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <CardTitle className="text-base font-semibold">Apprenants en risque</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredAtRisk.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Aucun résultat</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Apprenant</TableHead>
                    <TableHead className="text-center">Inactivité</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAtRisk.slice(0, 5).map((learner) => (
                    <TableRow
                      key={learner.id}
                      className="cursor-pointer hover:bg-muted/20"
                      onClick={() => onSelectLearner?.(learner.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium text-sm text-foreground truncate max-w-[130px]">{learner.first_name} {learner.last_name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[130px]">{learner.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          'text-xs font-semibold',
                          learner.days_inactive > 14 ? 'text-destructive' :
                            learner.days_inactive > 7 ? 'text-warning' : 'text-muted-foreground'
                        )}>
                          {learner.days_inactive > 900 ? 'Jamais' : `${learner.days_inactive}j`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="font-medium whitespace-nowrap">
                          {learner.status === 'dropped' ? 'Décroché' : 'Risque'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          {filteredAtRisk.length > 5 && onViewAll && (
            <div className="p-4 border-t border-border flex justify-center bg-muted/10">
              <Button variant="outline" size="sm" onClick={() => onViewAll('at_risk')}>
                Voir plus
              </Button>
            </div>
          )}
        </Card>

        {/* Blocked learners */}
        <Card className="shadow-sm border-border overflow-hidden">
          <CardHeader className="bg-muted/30 pb-3 border-b border-border flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-destructive" />
              <div>
                <CardTitle className="text-base font-semibold">Apprenants bloqués</CardTitle>
                <p className="text-xs text-muted-foreground">Livrables non validés</p>
              </div>
            </div>
            {filteredBlocked.length > 0 && (
              <Badge variant="destructive" className="font-semibold text-xs">
                {filteredBlocked.length} bloqué{filteredBlocked.length > 1 ? 's' : ''}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {filteredBlocked.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Aucun apprenant bloqué</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Apprenant</TableHead>
                    <TableHead className="text-right">Éléments bloquants</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBlocked.slice(0, 5).map((learner) => (
                    <TableRow
                      key={learner.id}
                      className="cursor-pointer hover:bg-muted/20"
                      onClick={() => onSelectLearner?.(learner.id)}
                    >
                      <TableCell>
                        <p className="font-medium text-sm text-foreground truncate max-w-[160px]">{learner.first_name} {learner.last_name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[160px]">{learner.email}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {learner.failed_modules && learner.failed_modules.length > 0 ? (
                            learner.failed_modules.map((fm, idx) => (
                              <Badge 
                                key={idx} 
                                variant="destructive" 
                                className="text-[10px] px-1.5 py-0 font-medium"
                                title={fm}
                              >
                                {getShortModuleCode(fm)}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-medium">À régulariser</Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          {filteredBlocked.length > 5 && onViewAll && (
            <div className="p-4 border-t border-border flex justify-center bg-muted/10">
              <Button variant="outline" size="sm" onClick={() => onViewAll('blocked')}>
                Voir les {filteredBlocked.length} apprenants bloqués
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Completed learners section */}
      {(filteredCompletedPhase1.length > 0 || filteredCompleted.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Phase 1 terminée */}
          <Card className="shadow-sm border-border overflow-hidden">
            <CardHeader className="bg-muted/30 pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <CardTitle className="text-base font-semibold">Phase d'apprentissage terminée</CardTitle>
                </div>
                <Badge variant="outline">
                  {stats.completed_phase1_learners} apprenant{stats.completed_phase1_learners > 1 ? 's' : ''}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">5 séquences complétées — en attente du Projet Pro</p>
            </CardHeader>
            <CardContent className="p-0">
              {filteredCompletedPhase1.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Aucun apprenant</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Apprenant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompletedPhase1.slice(0, 5).map((learner) => (
                      <TableRow
                        key={learner.id}
                        className="cursor-pointer hover:bg-muted/20"
                        onClick={() => onSelectLearner?.(learner.id)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm text-foreground truncate max-w-[180px]">{learner.first_name} {learner.last_name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">{learner.email}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {filteredCompletedPhase1.length > 5 && onViewAll && (
                <div className="p-3 border-t border-border flex justify-center bg-muted/10">
                  <Button variant="outline" size="sm" onClick={() => onViewAll('completed_phase1')}>
                    Voir les {stats.completed_phase1_learners} apprenants
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Session terminée */}
          <Card className="shadow-sm border-border overflow-hidden">
            <CardHeader className="bg-muted/30 pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-zinc-200" />
                  <CardTitle className="text-base font-semibold">Spécialisation terminée</CardTitle>
                </div>
                <Badge variant="outline">
                  {stats.completed_learners} apprenant{stats.completed_learners > 1 ? 's' : ''}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Spécialisation 100% complétée — Projet Pro inclus</p>
            </CardHeader>
            <CardContent className="p-0">
              {filteredCompleted.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Aucun apprenant — le projet pro n'est pas encore validé</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Apprenant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompleted.slice(0, 5).map((learner) => (
                      <TableRow
                        key={learner.id}
                        className="cursor-pointer hover:bg-muted/20"
                        onClick={() => onSelectLearner?.(learner.id)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm text-foreground truncate max-w-[180px]">{learner.first_name} {learner.last_name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">{learner.email}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {filteredCompleted.length > 5 && onViewAll && (
                <div className="p-3 border-t border-border flex justify-center bg-muted/10">
                  <Button variant="outline" size="sm" onClick={() => onViewAll('completed')}>
                    Voir les {stats.completed_learners} apprenants
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function KPICard({
  title,
  value,
  icon: Icon,
  badgeText,
  badgeVariant,
  delay,
  colorClass
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  badgeText?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  delay: number;
  colorClass?: string;
}) {
  return (
    <Card className={cn(
      'shadow-sm border-border animate-fade-in transition-all hover:shadow-md',
      `stagger-${delay}`
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1 text-foreground tracking-tight animate-count-up">
              {value}
            </p>
            {badgeText && (
              <div className="mt-1.5">
                <Badge variant={badgeVariant}>{badgeText}</Badge>
              </div>
            )}
          </div>
          <div className={cn("p-2 bg-muted rounded-xl", colorClass || "text-foreground")}>
            <Icon size={18} strokeWidth={2.5} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
