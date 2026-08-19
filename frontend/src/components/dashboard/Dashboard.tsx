import { useEffect, useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  TrendingUp,
  Award,
  Clock,
  Calendar,
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
  Area,
  AreaChart,
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

const PIE_COLORS = ['#db2777', '#0ea5e9', '#f43f5e', '#64748b'];
const BAR_GRADIENT = ['#db2777', '#f472b6', '#fbcfe8', '#fdf2f8', '#ffffff'];

// dynamicDeadlines moved inside component

interface DashboardProps {
  onSelectLearner?: (id: string) => void;
  globalSearch?: string;
  onViewAll?: (filter: string) => void;
}

export default function Dashboard({ onSelectLearner, globalSearch = '', onViewAll }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  // Calculate dynamic deadlines based on backend data
  const dynamicDeadlines = useMemo(() => {
    if (!stats) return [];

    return stats.sequence_stats
      .filter(s => s.sequence !== 'Autre' && s.sequence !== 'Préalable')
      .map(s => {
        let dates = 'À définir';
        let seqShort = s.sequence;
        let start = new Date(2026, 0, 1);
        let end = new Date(2026, 0, 1);

        if (s.sequence.includes('Séquence 1')) {
          dates = '27 juil - 3 août';
          seqShort = 'Séquence 1';
          start = new Date(2026, 6, 27); // 27 Juillet
          end = new Date(2026, 7, 3, 23, 59, 59); // 3 Août
        } else if (s.sequence.includes('Séquence 2')) {
          dates = '3 août - 7 août';
          seqShort = 'Séquence 2';
          start = new Date(2026, 7, 3);
          end = new Date(2026, 7, 7, 23, 59, 59);
        } else if (s.sequence.includes('Séquence 3')) {
          dates = '10 août - 21 août';
          seqShort = 'Séquence 3';
          start = new Date(2026, 7, 10);
          end = new Date(2026, 7, 21, 23, 59, 59);
        } else if (s.sequence.includes('Séquence 4')) {
          dates = '24 août - 4 sept';
          seqShort = 'Séquence 4';
          start = new Date(2026, 7, 24); // 24 Août
          end = new Date(2026, 8, 4, 23, 59, 59); // 4 Septembre
        } else if (s.sequence.includes('Séquence 5')) {
          dates = '7 sept - 11 sept';
          seqShort = 'Séquence 5';
          start = new Date(2026, 8, 7);
          end = new Date(2026, 8, 11, 23, 59, 59);
        } else if (s.sequence.includes('Projet')) {
          dates = '14 sept - 25 sept';
          seqShort = 'Projet pro';
          start = new Date(2026, 8, 14);
          end = new Date(2026, 8, 25, 23, 59, 59);
        }

        const now = new Date();
        let status = 'pending';
        if (now > end) status = 'past';
        else if (now >= start && now <= end) status = 'active';

        return { sequence: seqShort, dates, status };
      })
      .sort((a, b) => {
        if (a.sequence === 'Projet pro') return 1;
        if (b.sequence === 'Projet pro') return -1;
        return a.sequence.localeCompare(b.sequence);
      });
  }, [stats]);

  async function loadStats() {
    try {
      setLoading(true);
      const data = await api.getDashboardStats();
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
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <p className="text-destructive font-medium">{error}</p>
          <button
            onClick={loadStats}
            className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors"
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

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Apprenants"
          value={stats.total_learners}
          icon={Users}
          badgeText="Groupe G1"
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
        />
        <KPICard
          title="Apprenants actifs"
          value={stats.active_learners}
          icon={UserCheck}
          badgeText={`${Math.round((stats.active_learners / stats.total_learners) * 100)}%`}
          badgeVariant="default"
          delay={3}
        />
        <KPICard
          title="En risque"
          value={stats.inactive_learners + stats.dropped_learners}
          icon={AlertTriangle}
          badgeText={`${stats.dropped_learners} décrocheurs`}
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
              <Calendar className="w-5 h-5 text-primary" />
              <CardTitle className="text-base font-semibold">Deadlines Séquences</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">Calendrier de la session</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pt-2">
              {dynamicDeadlines.length === 0 ? (
                <div className="text-sm text-muted-foreground">Aucune séquence disponible.</div>
              ) : dynamicDeadlines.map((deadline, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={cn(
                    "w-2 h-10 rounded-full shrink-0",
                    deadline.status === 'past' ? "bg-muted" :
                      deadline.status === 'active' ? "bg-primary" : "bg-muted-foreground/30"
                  )} />
                  <div>
                    <p className={cn(
                      "text-sm font-semibold",
                      deadline.status === 'past' ? "text-muted-foreground line-through" :
                        deadline.status === 'active' ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {deadline.sequence}
                    </p>
                    <p className="text-xs text-muted-foreground">{deadline.dates}</p>
                  </div>
                  {deadline.status === 'active' && (
                    <Badge variant="default" className="ml-auto text-[10px] h-5 px-1.5">En cours</Badge>
                  )}
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
              <BarChart data={stats.sequence_stats.filter(s => s.sequence !== 'Autre')} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="sequence"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={(v: string) => {
                    const match = v.match(/Séquence (\d)/);
                    return match ? `Séq. ${match[1]}` : v.substring(0, 12);
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={(v: number) => `${v}`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    padding: '12px 16px',
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
                  fill="#f59e0b"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="learners_not_started"
                  name="Non commencé"
                  stackId="a"
                  fill="#e2e8f0"
                  radius={[6, 6, 0, 0]}
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

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top performers */}
        <Card className="shadow-sm border-border overflow-hidden">
          <CardHeader className="bg-muted/30 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
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
                            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                              index === 1 ? 'bg-gray-200 text-gray-700' :
                                index === 2 ? 'bg-orange-100 text-orange-700' :
                                  'bg-muted text-muted-foreground'
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
                                learner.completion_rate > 0 ? "bg-primary" : "bg-gray-300"
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
          <CardHeader className="bg-muted/30 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-destructive" />
              <CardTitle className="text-base font-semibold">Apprenants bloqués</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredBlocked.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Aucun apprenant bloqué</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Apprenant</TableHead>
                    <TableHead>Statut</TableHead>
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
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium text-sm text-foreground truncate max-w-[150px]">{learner.first_name} {learner.last_name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{learner.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="font-medium whitespace-nowrap">
                          Note minimale non atteinte
                        </Badge>
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
                Voir plus
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// KPI Card component
// ============================================================

function KPICard({
  title,
  value,
  icon: Icon,
  badgeText,
  badgeVariant,
  delay,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  badgeText?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  delay: number;
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
          <div className="p-2 bg-muted rounded-xl text-foreground">
            <Icon size={18} strokeWidth={2.5} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
