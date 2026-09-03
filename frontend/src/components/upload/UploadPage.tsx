import React, { useState, useCallback, useEffect } from 'react';
import {
  Upload as UploadIcon,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Trash2,
  RefreshCcw,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, type UploadResult } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface UploadPageProps {
  onNavigate?: (page: 'dashboard' | 'learners' | 'upload' | 'reports') => void;
}

export default function UploadPage({ onNavigate }: UploadPageProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<any[]>([]);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await api.getUploads();
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleResetData = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir effacer TOUTES les données (apprenants, progrès, activités, historique) ? Cette action est irréversible.")) {
      try {
        await api.resetData();
        fetchHistory();
        alert("Les données ont été effacées avec succès.");
      } catch (err) {
        alert("Erreur lors de l'effacement : " + err);
      }
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm("Voulez-vous vraiment vider l'historique des imports ?")) {
      try {
        await api.clearHistory();
        fetchHistory();
      } catch (err) {
        alert("Erreur : " + err);
      }
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.uploadFile(file);
      setResult(data);
      fetchHistory(); // Refresh history after upload
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [fetchHistory]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  }, [uploadFile]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
  }, [uploadFile]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold">Importer des données Moodle</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Uploadez vos exports CSV (progression) ou Excel (participants) depuis Moodle.
            Seul le <strong>Groupe G1</strong> sera traité.
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={handleResetData} className="gap-2">
          <Trash2 className="w-4 h-4" />
          Reset Données
        </Button>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 cursor-pointer',
          dragActive
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : 'border-gray-200 hover:border-primary/50 hover:bg-muted/30',
          uploading && 'pointer-events-none opacity-60'
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".csv,.xlsx,.xls,.md"
          onChange={handleFileSelect}
          className="hidden"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-4 w-full max-w-[200px] mx-auto">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <div className="w-full h-2 bg-primary/20 rounded-full overflow-hidden">
              <div className="h-full bg-primary w-full animate-pulse origin-left" style={{ animation: "progress 2s infinite ease-in-out" }}></div>
            </div>
            <p className="text-sm font-medium text-primary text-center">Envoi et traitement du fichier...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <UploadIcon className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                Glissez votre fichier ici ou <span className="text-primary">parcourez</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Formats acceptés : CSV, XLSX, MD (max 50 MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <Card className="shadow-sm border-border animate-fade-in">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 className="w-6 h-6 text-success" />
              <div>
                <h3 className="font-semibold text-success">Import réussi !</h3>
                <p className="text-xs text-muted-foreground">{result.filename}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBox label="Lignes traitées" value={result.rows_processed} />
              <StatBox label="Apprenants créés" value={result.learners_created} />
              <StatBox label="Apprenants MàJ" value={result.learners_updated} />
              <StatBox label="Progressions" value={result.progress_records} />
            </div>

            {result.errors.length > 0 && (
              <div className="mt-4 p-3 bg-warning/5 rounded-lg border border-warning/20">
                <p className="text-xs font-medium text-warning mb-1">
                  {result.errors.length} avertissement(s)
                </p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {result.errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}
            
            <div className="mt-6 flex justify-end">
              <Button onClick={() => onNavigate ? onNavigate('dashboard') : (window.location.href = '/')} variant="default">
                Aller au Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-center gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">Erreur lors de l'import</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Supported formats */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Formats supportés</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 pt-2">
            <FormatCard
              icon={FileText}
              title="CSV — Progression des activités"
              description="Export depuis Moodle > Course Management > Achèvement des activités (TSV, UTF-16)"
              variant="primary"
            />
            <FormatCard
              icon={Users}
              title="MD — Liste des participants"
              description="Fichier courseid.md (Markdown table avec les participants)"
              variant="secondary"
            />
            <FormatCard
              icon={FileSpreadsheet}
              title="XLSX — Liste des participants"
              description="Export depuis Moodle > Participants (colonnes: Prénom, Nom, Email, Groupes)"
              variant="success"
            />
          </div>
        </CardContent>
      </Card>

      {/* History */}
      {history.length > 0 && (
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Historique des imports</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleClearHistory} className="h-8 text-muted-foreground hover:text-destructive">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Vider
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 pt-2">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    {h.file_type === 'csv' ? (
                      <FileText className="w-5 h-5 text-primary" />
                    ) : (
                      <FileSpreadsheet className="w-5 h-5 text-success" />
                    )}
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px] sm:max-w-[300px]">
                        {h.filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(h.uploaded_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={h.status === 'processed' ? 'default' : 'secondary'} className={h.status === 'processed' ? 'bg-success hover:bg-success/80' : ''}>
                      {h.status === 'processed' ? 'Terminé' : h.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {h.rows_processed} lignes
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center p-3 bg-muted/30 rounded-lg">
      <p className="text-2xl font-bold text-primary">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function FormatCard({
  icon: Icon,
  title,
  description,
  variant = 'primary',
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  variant?: 'primary' | 'secondary' | 'success';
}) {
  const styleMap = {
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-muted text-foreground',
    success: 'bg-emerald-500/10 text-emerald-600',
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors">
      <div className={cn('p-2 rounded-lg', styleMap[variant] || styleMap.primary)}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
