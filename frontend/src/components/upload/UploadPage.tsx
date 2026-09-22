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
  GraduationCap,
  Sparkles,
  Archive,
  Lock,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, type UploadResult } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface UploadPageProps {
  onNavigate?: (page: 'dashboard' | 'learners' | 'upload' | 'reports') => void;
}

export default function UploadPage({ onNavigate }: UploadPageProps) {
  const [uploadMode, setUploadMode] = useState<'progress' | 'pp'>('pp');

  // Generic progress upload state
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  // PP ZIP upload state
  const [ppDeliverable, setPpDeliverable] = useState<'desc' | 'strat' | 'gest' | 'budget' | 'content' | 'tdb'>('strat');
  const [ppPhase, setPpPhase] = useState<'entrainement' | 'final'>('entrainement');
  const [autoEvaluateAi, setAutoEvaluateAi] = useState(true);
  const [ppUploading, setPpUploading] = useState(false);
  const [ppResult, setPpResult] = useState<any | null>(null);
  const [ppError, setPpError] = useState<string | null>(null);

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

  // Generic Upload handler
  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.uploadFile(file);
      setResult(data);
      fetchHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [fetchHistory]);

  // PP ZIP Upload handler
  const handlePPUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setPpError("Veuillez sélectionner une archive ZIP exportée depuis Moodle.");
      return;
    }

    setPpUploading(true);
    setPpError(null);
    setPpResult(null);

    try {
      const geminiKey = localStorage.getItem('dclic_gemini_key') || undefined;
      const data = await api.uploadPPZip(file, ppDeliverable, ppPhase, autoEvaluateAi, geminiKey);
      setPpResult(data);
    } catch (err: any) {
      setPpError(err.message || "Erreur lors du traitement de l'archive ZIP.");
    } finally {
      setPpUploading(false);
    }
  };

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
    if (!file) return;

    if (uploadMode === 'pp') {
      await handlePPUpload(file);
    } else {
      await uploadFile(file);
    }
  }, [uploadMode, ppDeliverable, ppPhase, autoEvaluateAi, uploadFile]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UploadIcon className="w-6 h-6 text-primary" />
            Centre d'Importation & Synchronisation
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Importez les données Moodle pour synchroniser automatiquement les profils et lancer l'Agent IA.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-muted/60 border border-border rounded-xl self-start sm:self-center">
          <Button
            variant={uploadMode === 'pp' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setUploadMode('pp')}
            className={cn("h-8 text-xs font-medium gap-1.5 cursor-pointer", uploadMode !== 'pp' && "text-muted-foreground")}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Livrables Projet Pro (ZIP)</span>
          </Button>

          <Button
            variant={uploadMode === 'progress' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setUploadMode('progress')}
            className={cn("h-8 text-xs font-medium gap-1.5 cursor-pointer", uploadMode !== 'progress' && "text-muted-foreground")}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Progression Moodle (CSV/XLSX)</span>
          </Button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODE PROJET PRO (ZIP MOODLE PAR LIVRABLE) */}
      {/* ============================================================ */}
      {uploadMode === 'pp' ? (
        <div className="space-y-6 animate-fade-in">
          <Card className="bg-card border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Archive className="w-4 h-4 text-primary" />
                Dépôt des Devoirs par Archive ZIP Moodle
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Téléchargez l'archive ZIP complète des devoirs depuis Moodle (*« Télécharger toutes les remises »*). La plateforme extrait les dossiers de chaque apprenant, préserve les évaluations déjà validées, et évalue automatiquement les nouvelles copies avec l'Agent IA.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Deliverable & Phase Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border border-border">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">1. Livrable concerné :</label>
                  <select
                    value={ppDeliverable}
                    onChange={(e: any) => setPpDeliverable(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="desc">Livrable 0 — Description & Cadrage du projet</option>
                    <option value="strat">Livrable 1 — Stratégie Marketing (PP1) (/6 pts)</option>
                    <option value="gest">Livrable 2 — Gestion de Projet Gantt & RH (PP2) (/6 pts)</option>
                    <option value="budget">Livrable 2 — Budget Prévisionnel par Tâches (PP2) (/6 pts)</option>
                    <option value="content">Livrable 3 — Création de Contenu Flyer & Vidéo (PP3) (/4 pts)</option>
                    <option value="tdb">Livrable 4 — Tableau de Bord d'Indicateurs (PP4) (/4 pts)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">2. Phase d'évaluation :</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPpPhase('entrainement')}
                      className={cn(
                        "h-9 px-3 rounded-lg text-xs font-medium border text-left transition-colors cursor-pointer flex items-center justify-between",
                        ppPhase === 'entrainement' ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span>V1 Entraînement</span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">Sans note</Badge>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPpPhase('final')}
                      className={cn(
                        "h-9 px-3 rounded-lg text-xs font-medium border text-left transition-colors cursor-pointer flex items-center justify-between",
                        ppPhase === 'final' ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span>V2 Restitution Finale</span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">Noté /20</Badge>
                    </button>
                  </div>
                </div>
              </div>

              {/* AI auto-evaluation toggle */}
              <div className="flex items-center justify-between bg-primary/5 p-3 rounded-xl border border-primary/20">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Évaluation automatique par l'Agent Gemini IA</p>
                    <p className="text-[11px] text-muted-foreground">
                      Analyse instantanément le texte des fichiers déposés (.docx, .odt, .pdf) et prépare le diagnostic pédagogique.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoEvaluateAi}
                    onChange={e => setAutoEvaluateAi(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* ZIP Dropzone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer',
                  dragActive ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-muted/30',
                  ppUploading && 'pointer-events-none opacity-60'
                )}
                onClick={() => document.getElementById('pp-file-input')?.click()}
              >
                <input
                  id="pp-file-input"
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handlePPUpload(file);
                  }}
                />

                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    {ppUploading ? <Loader2 className="w-7 h-7 animate-spin" /> : <Archive className="w-7 h-7" />}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {ppUploading ? "Décompression & analyse en cours..." : "Glissez-déposez l'archive ZIP Moodle ici"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ou cliquez pour parcourir vos fichiers · Format .zip uniquement
                    </p>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {ppError && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{ppError}</span>
                </div>
              )}

              {/* Result Summary */}
              {ppResult && (
                <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Rapport d'Importation & Synchronisation
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigate?.('dashboard')}
                      className="h-7 text-xs gap-1 cursor-pointer"
                    >
                      <span>Voir dans le Dashboard</span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                    <div className="p-3 bg-card rounded-lg border border-border">
                      <p className="text-xl font-bold text-foreground">{ppResult.totalSubmissionsFound}</p>
                      <p className="text-[10px] text-muted-foreground">Dossiers détectés</p>
                    </div>

                    <div className="p-3 bg-card rounded-lg border border-border">
                      <p className="text-xl font-bold text-emerald-500 flex items-center justify-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        {ppResult.alreadyValidatedSkipped}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Déjà validés (préservés)</p>
                    </div>

                    <div className="p-3 bg-card rounded-lg border border-border">
                      <p className="text-xl font-bold text-primary flex items-center justify-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        {ppResult.newEvaluations}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Évalués ou préparés</p>
                    </div>

                    <div className="p-3 bg-card rounded-lg border border-border">
                      <p className="text-xl font-bold text-amber-500">{ppResult.revisionsDetected}</p>
                      <p className="text-[10px] text-muted-foreground">Nouvelles versions</p>
                    </div>
                  </div>

                  {/* Details List */}
                  {ppResult.details && ppResult.details.length > 0 && (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pt-2 border-t border-border">
                      {ppResult.details.map((item: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-card border border-border/60">
                          <div className="flex items-center gap-2">
                            {item.action === 'skipped_validated' && <Lock className="w-3.5 h-3.5 text-emerald-500" />}
                            {item.action === 'evaluated_by_ai' && <Sparkles className="w-3.5 h-3.5 text-primary" />}
                            {item.action === 'pending_evaluation' && <Clock className="w-3.5 h-3.5 text-blue-500" />}
                            {item.action === 'revision_detected' && <RefreshCcw className="w-3.5 h-3.5 text-amber-500" />}
                            <span className="font-medium text-foreground">{item.learnerName}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{item.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ============================================================ */
        /* MODE PROGRESSION MOODLE (CSV / XLSX / MD) */
        /* ============================================================ */
        <div className="space-y-6 animate-fade-in">
          <Card className="bg-card border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                Import de Progression Moodle (Grille de notes & Quiz)
              </CardTitle>
              <CardDescription className="text-xs">
                Export standard Moodle de fin de séquence (.csv, .xlsx ou .md). Met à jour les pourcentages de complétude et alertes d'inactivité.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={cn(
                  'border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer',
                  dragActive ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-muted/30',
                  uploading && 'pointer-events-none opacity-60'
                )}
                onClick={() => document.getElementById('csv-file-input')?.click()}
              >
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls,.md"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) uploadFile(file);
                  }}
                />

                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    {uploading ? <Loader2 className="w-7 h-7 animate-spin" /> : <UploadIcon className="w-7 h-7" />}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {uploading ? "Traitement des données en cours..." : "Glissez-déposez votre fichier CSV ou XLSX ici"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      ou cliquez pour parcourir · Formats acceptés : CSV, XLSX, XLS, MD
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {result && (
                <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-3">
                  <div className="flex items-center gap-2 text-emerald-500 font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Fichier synchronisé avec succès !</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 bg-card rounded border border-border">
                      <p className="text-lg font-bold text-foreground">{result.rows_processed}</p>
                      <p className="text-muted-foreground text-[10px]">Lignes traitées</p>
                    </div>
                    <div className="p-2 bg-card rounded border border-border">
                      <p className="text-lg font-bold text-primary">{result.learners_created}</p>
                      <p className="text-muted-foreground text-[10px]">Nouveaux apprenants</p>
                    </div>
                    <div className="p-2 bg-card rounded border border-border">
                      <p className="text-lg font-bold text-emerald-500">{result.learners_updated}</p>
                      <p className="text-muted-foreground text-[10px]">Apprenants actualisés</p>
                    </div>
                    <div className="p-2 bg-card rounded border border-border">
                      <p className="text-lg font-bold text-foreground">{result.progress_records}</p>
                      <p className="text-muted-foreground text-[10px]">Enregistrements</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* History */}
          {history.length > 0 && (
            <Card className="bg-card border-border shadow-xs">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Historique des imports progression</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleClearHistory} className="h-7 text-xs text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3 h-3 mr-1" />
                  Vider
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {history.slice(0, 5).map((h, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 text-xs">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-primary" />
                        <div>
                          <p className="font-medium text-foreground">{h.filename}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(h.uploaded_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {h.rows_processed} lignes
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
