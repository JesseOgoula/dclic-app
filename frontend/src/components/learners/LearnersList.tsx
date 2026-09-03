import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  ChevronUp,
  ChevronDown,
  Award,
  Filter,
  UserX,
  UserCheck,
  Users as UsersIcon,
  CheckCircle2,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, type LearnerWithProgress } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface LearnersListProps {
  onSelectLearner?: (id: string) => void;
  globalSearch?: string;
  initialFilter?: string;
}

export default function LearnersList({ onSelectLearner, globalSearch = '', initialFilter = '' }: LearnersListProps) {
  const [learners, setLearners] = useState<LearnerWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [sortBy, setSortBy] = useState('last_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [stats, setStats] = useState<{ active: number, inactive: number, dropped: number, blocked: number, completed_phase1: number, completed: number, total: number } | null>(null);

  const loadLearners = useCallback(async () => {
    try {
      if (learners.length === 0) setLoading(true);
      const effectiveSearch = search || globalSearch || undefined;
      const data = await api.getLearners({
        search: effectiveSearch,
        status: statusFilter || undefined,
        sortBy,
        sortDir,
      });
      setLearners(data);
    } catch (err) {
      console.error('Failed to load learners:', err);
    } finally {
      setLoading(false);
    }
  }, [search, globalSearch, statusFilter, sortBy, sortDir, learners.length]);

  useEffect(() => {
    setStatusFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    // Load stats once to get the counts for the filters
    api.getDashboardStats().then(data => {
      setStats({
        total: data.total_learners,
        active: data.active_learners,
        inactive: data.inactive_learners,
        dropped: data.dropped_learners,
        blocked: data.blocked_learners.length,
        completed_phase1: data.completed_phase1_learners,
        completed: data.completed_learners,
      });
    }).catch(console.error);
  }, []);

  useEffect(() => {
    loadLearners();
  }, [loadLearners]);

  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const statusBadge = (status: string) => {
    const config = ({
      active: { label: 'Actif', variant: 'default' as const },
      inactive: { label: 'Inactif', variant: 'secondary' as const },
      dropped: { label: 'Décroché', variant: 'destructive' as const },
      at_risk: { label: 'Risque', variant: 'destructive' as const },
      blocked: { label: 'Bloqué', variant: 'destructive' as const },
      completed_phase1: { label: 'Phase 1 terminée', variant: 'outline' as const },
      completed: { label: 'Session terminée', variant: 'outline' as const },
    } as Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }>)[status] || { label: status, variant: 'outline' as const };

    return (
      <Badge
        variant={config.variant}
        className="font-medium"
      >
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Rechercher un apprenant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 bg-white rounded-lg border p-1">
          <FilterButton
            label="Tous"
            icon={UsersIcon}
            active={statusFilter === ''}
            onClick={() => setStatusFilter('')}
            count={stats?.total}
          />
          <FilterButton
            label="Actifs"
            icon={UserCheck}
            active={statusFilter === 'active'}
            onClick={() => setStatusFilter('active')}
            color="success"
            count={stats?.active}
          />
          <FilterButton
            label="Inactifs"
            icon={UserX}
            active={statusFilter === 'inactive'}
            onClick={() => setStatusFilter('inactive')}
            color="warning"
            count={stats?.inactive}
          />
          <FilterButton
            icon={UserX}
            label="Décrochés"
            active={statusFilter === 'dropped'}
            onClick={() => setStatusFilter('dropped')}
            color="destructive"
            count={stats?.dropped}
          />
          <FilterButton
            icon={Filter}
            label="Bloqués"
            active={statusFilter === 'blocked'}
            onClick={() => setStatusFilter('blocked')}
            color="destructive"
            count={stats?.blocked}
          />
          <FilterButton
            icon={CheckCircle2}
            label="Phase 1"
            active={statusFilter === 'completed_phase1'}
            onClick={() => setStatusFilter('completed_phase1')}
            count={stats?.completed_phase1}
          />
          <FilterButton
            icon={Award}
            label="Terminé"
            active={statusFilter === 'completed'}
            onClick={() => setStatusFilter('completed')}
            count={stats?.completed}
          />
        </div>

        {/* Export CSV button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (learners.length === 0) return;
            const headers = ['Nom', 'Prénom', 'Email', 'Groupe', 'Statut', 'Complétion (%)', 'Activités complétées', 'Total activités', 'Jours inactif'];
            const rows = learners.map(l => [
              `"${l.last_name}"`,
              `"${l.first_name}"`,
              `"${l.email}"`,
              `"${l.group_id}"`,
              `"${l.status}"`,
              l.completion_rate,
              l.completed_activities,
              l.total_activities,
              l.days_inactive > 900 ? 'Jamais' : l.days_inactive,
            ]);
            const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Apprenants_${statusFilter || 'tous'}_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }}
          className="ml-auto gap-2 bg-white"
        >
          <Download size={14} />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <Card className="shadow-sm border-border overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => toggleSort('last_name')}
                >
                  <div className="flex items-center gap-1">
                    Apprenant <SortIcon field="last_name" />
                  </div>
                </TableHead>
                <TableHead>Email</TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => toggleSort('completion_rate')}
                >
                  <div className="flex items-center gap-1">
                    Progression <SortIcon field="completion_rate" />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground transition-colors text-center"
                  onClick={() => toggleSort('days_inactive')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Inactivité <SortIcon field="days_inactive" />
                  </div>
                </TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={cn("transition-opacity duration-300", loading && learners.length > 0 ? "opacity-50" : "")}>
              {loading && learners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : learners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Search className="w-8 h-8 text-muted-foreground/50 mb-3" />
                      <p className="text-sm font-medium text-foreground">Aucun apprenant trouvé</p>
                      {(search || globalSearch) && (
                        <p className="text-xs mt-1">
                          Aucun résultat pour la recherche "{search || globalSearch}"
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                learners.map((learner) => (
                  <TableRow
                    key={learner.id}
                    className="hover:bg-muted/20 cursor-pointer"
                    onClick={() => onSelectLearner?.(learner.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium text-foreground">{learner.first_name} {learner.last_name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{learner.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              learner.completion_rate > 0 ? 'bg-primary' : 'bg-gray-300'
                            )}
                            style={{ width: `${Math.max(learner.completion_rate, learner.completion_rate > 0 ? 4 : 0)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-foreground w-12">
                          {learner.completion_rate}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        'text-xs font-medium',
                        learner.days_inactive > 14 ? 'text-destructive' :
                          learner.days_inactive > 7 ? 'text-warning' :
                            learner.days_inactive > 900 ? 'text-destructive' : 'text-muted-foreground'
                      )}>
                        {learner.days_inactive > 900 ? 'Jamais' : `${learner.days_inactive}j`}
                      </span>
                    </TableCell>
                    <TableCell>{statusBadge(learner.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Footer */}
          <div className="px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
            {learners.length} apprenant{learners.length > 1 ? 's' : ''} affiché{learners.length > 1 ? 's' : ''}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FilterButton({
  label,
  icon: Icon,
  active,
  onClick,
  color,
  count,
}: {
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
  color?: string;
  count?: number;
}) {
  const activeColorClasses: Record<string, string> = {
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    warning: 'bg-amber-500 text-white hover:bg-amber-600',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  };

  return (
    <Button
      variant={active ? "default" : "ghost"}
      size="sm"
      onClick={onClick}
      className={cn(
        'gap-1.5 h-8',
        active && color && activeColorClasses[color],
        !active && 'text-muted-foreground'
      )}
    >
      <Icon size={14} />
      {label}
      {count !== undefined && (
        <Badge variant={active ? "secondary" : "outline"} className="ml-1 px-1.5 py-0 text-[10px]">
          {count}
        </Badge>
      )}
    </Button>
  );
}
