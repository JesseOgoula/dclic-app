import React, { useState, useCallback, useEffect } from 'react';
import {
  Upload as UploadIcon,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  RefreshCcw,
  Users,
  ArrowRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, type UploadResult } from '@/lib/api';
import { useFormation } from '@/context/FormationContext';

interface UploadPageProps {
  onNavigate?: (page: 'dashboard' | 'learners' | 'upload' | 'reports') => void;
}

const UPLOAD_STEPS = [
  'Téléversement et analyse du fichier Moodle...',
  'Détection automatique de la cohorte et des apprenants...',
  'Synchronisation et alignement des activités pédagogiques...',
  'Enregistrement haute performance des progressions...',
  'Mise à jour instantanée des statistiques et caches mémoire...',
];

export default function UploadPage({ onNavigate }: UploadPageProps) {
  const { currentFormation, setFormation, formationTitle, formationCategory, groupId } = useFormation();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStepIndex, setUploadStepIndex] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!uploading) {
      setUploadStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setUploadStepIndex(prev => (prev + 1) % UPLOAD_STEPS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [uploading]);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await api.getUploads(currentFormation);
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  }, [currentFormation]);

  const handleResetData = async () => {
    const otherFormationName =
      currentFormation === 'gp'
        ? 'Marketing numérique (Formation initiale)'
        : 'Gestion de projet (Module de spécialisation)';

    const confirmMsg =
      `Êtes-vous sûr de vouloir réinitialiser UNIQUEMENT les données de la cohorte « ${formationTitle} » (${groupId}) ?\n\n` +
      `Les données de l'autre formation (${otherFormationName}) resteront totalement préservées et intactes.`;

    if (window.confirm(confirmMsg)) {
      try {
        await api.resetData(currentFormation);
        fetchHistory();
        alert(`Les données de « ${formationTitle} » ont été réinitialisées avec succès.`);
      } catch (err) {
        alert("Erreur lors de la réinitialisation : " + err);
      }
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm(`Voulez-vous vraiment vider l'historique des imports pour « ${formationTitle} » ?`)) {
      try {
        await api.clearHistory(currentFormation);
        fetchHistory();
      } catch (err) {
        alert('Erreur : ' + err);
      }
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      setResult(null);
      setUploadedFileName(file.name);

      try {
        const data = await api.uploadFile(file, currentFormation);
        setResult(data);
        fetchHistory();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [fetchHistory, currentFormation]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const file = e.dataTransfer.files?.[0];
      if (file) await uploadFile(file);
    },
    [uploadFile]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await uploadFile(file);
    },
    [uploadFile]
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 1. Header (Clean ClickUp Title & Subtitle) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Importation Moodle
          </h1>
          <p className="text-xs text-neutral-500 font-medium mt-1">
            {formationCategory} · <span className="text-neutral-900 font-semibold">{formationTitle}</span> ({groupId})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetData}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#E2E8F0] hover:bg-red-50 hover:text-red-700 hover:border-red-200 bg-white text-xs font-medium text-neutral-700 transition-colors shadow-none cursor-pointer"
            title={`Effacer uniquement les données de ${formationTitle}`}
          >
            <Trash2 size={13} className="text-neutral-400" />
            <span>Réinitialiser ({formationTitle})</span>
          </button>
        </div>
      </div>

      {/* 2. Drop Zone */}
      <div
        className={cn(
          'relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer bg-white shadow-none',
          dragActive
            ? 'border-neutral-900 bg-neutral-50'
            : 'border-[#E2E8F0] hover:border-neutral-400 hover:bg-[#FAFAFA]',
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
          <div className="flex flex-col items-center gap-3.5 w-full max-w-sm mx-auto py-6">
            <div className="relative flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-neutral-900 animate-spin" />
              <Sparkles className="w-3.5 h-3.5 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-semibold text-neutral-900 transition-all duration-300">
                {UPLOAD_STEPS[uploadStepIndex]}
              </p>
              <p className="text-[11px] text-neutral-400">
                Traitement optimisé en masse &middot; Veuillez patienter...
              </p>
            </div>
            <div className="w-48 h-1.5 bg-neutral-100 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-neutral-900 transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, (uploadStepIndex + 1) * 20)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-700">
              <UploadIcon className="w-5 h-5 text-neutral-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                Déposez vos fichiers Moodle ici ou <span className="underline">parcourez vos dossiers</span>
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                Formats acceptés : CSV (Progression), XLSX / XLS / MD (Participants) · Max 50 MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Upload Result */}
      {result && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-neutral-900">
                  Importation terminée et synchronisée avec succès !
                </h3>
                <p className="text-xs text-neutral-400">{uploadedFileName || result.filename}</p>
              </div>
            </div>

            {/* Target Cohort Badge */}
            {result.formation && (
              <div className="flex items-center gap-1.5 self-start sm:self-auto px-2.5 py-1 rounded-md bg-neutral-100 border border-neutral-200 text-xs font-semibold text-neutral-800">
                <span>Cohorte :</span>
                <span className="text-neutral-900">
                  {result.formation === 'gp' ? 'Gestion de projet (G1_GPM_092026)' : 'Marketing numérique (G1_MN_072026)'}
                </span>
              </div>
            )}
          </div>

          {/* If the uploaded file belongs to a different formation than the currently active view */}
          {result.formation && result.formation !== currentFormation && (
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                  <span>Attention : Ce fichier concerne la cohorte « {result.formation === 'gp' ? 'Gestion de projet' : 'Marketing numérique'} »</span>
                </p>
                <p className="text-[11px] text-amber-800">
                  Vous consultez actuellement l'espace « {formationTitle} ». Pour voir les nouvelles statistiques générées par ce fichier, basculez sur la cohorte correspondante.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (result.formation) setFormation(result.formation);
                  if (onNavigate) onNavigate('dashboard');
                }}
                className="shrink-0 flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <span>Basculer sur {result.formation === 'gp' ? 'Gestion de projet' : 'Marketing numérique'} & Aperçu</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[#F8FAFC] border border-[#F1F5F9] rounded-xl text-center">
              <p className="text-2xl font-bold tracking-tight text-neutral-900">{result.rows_processed}</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">Lignes traitées</p>
            </div>
            <div className="p-4 bg-[#F8FAFC] border border-[#F1F5F9] rounded-xl text-center">
              <p className="text-2xl font-bold tracking-tight text-neutral-900">{result.learners_created}</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">Apprenants créés</p>
            </div>
            <div className="p-4 bg-[#F8FAFC] border border-[#F1F5F9] rounded-xl text-center">
              <p className="text-2xl font-bold tracking-tight text-neutral-900">{result.learners_updated}</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">Apprenants mis à jour</p>
            </div>
            <div className="p-4 bg-[#F8FAFC] border border-[#F1F5F9] rounded-xl text-center">
              <p className="text-2xl font-bold tracking-tight text-neutral-900">{result.progress_records}</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">Notes & activités synchronisées</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/60 text-xs">
              <p className="font-semibold text-amber-900 mb-1">{result.errors.length} avertissement(s)</p>
              <ul className="text-amber-800/80 space-y-0.5">
                {result.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>· {e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-neutral-500">
              Statistiques mises à jour en mémoire vive & Supabase.
            </span>
            <button
              type="button"
              onClick={() => {
                if (result.formation && result.formation !== currentFormation) {
                  setFormation(result.formation);
                }
                if (onNavigate) onNavigate('dashboard');
                else window.location.href = '/';
              }}
              className="w-full sm:w-auto h-9 px-4 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition-colors shadow-none cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Voir le Tableau de bord</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* 4. Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200/60 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-red-900">Erreur lors de l'import</p>
            <p className="text-xs text-red-700/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* 5. Supported formats */}
      <div className="bg-white border border-[#F1F5F9] rounded-2xl p-6 shadow-none space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Formats supportés</h3>
          <p className="text-xs text-neutral-400 mt-0.5">Exportez vos rapports bruts directement depuis la plateforme Moodle</p>
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex items-start gap-3 p-3 rounded-xl border border-[#F1F5F9] bg-[#FAFAFA]/50">
            <FileText size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-neutral-900">CSV — Progression des activités</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Export depuis Moodle &gt; Course Management &gt; Achèvement des activités (TSV ou CSV UTF-16 / UTF-8)
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl border border-[#F1F5F9] bg-[#FAFAFA]/50">
            <Users size={18} className="text-neutral-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-neutral-900">MD — Liste des participants</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Table Markdown avec colonnes Nom, Prénom, Email, Groupe
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl border border-[#F1F5F9] bg-[#FAFAFA]/50">
            <FileSpreadsheet size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-neutral-900">XLSX / XLS — Participants Moodle</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Export depuis Moodle &gt; Participants (colonnes : Prénom, Nom, Email, Groupes)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 6. History */}
      {history.length > 0 && (
        <div className="bg-white border border-[#F1F5F9] rounded-2xl p-6 shadow-none space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Historique des imports</h3>
              <p className="text-xs text-neutral-400 mt-0.5">Dernières données intégrées dans l'application</p>
            </div>
            <button
              type="button"
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-[#E2E8F0] hover:bg-neutral-50 bg-white text-xs font-medium text-neutral-600 transition-colors shadow-none cursor-pointer"
            >
              <RefreshCcw size={12} className="text-neutral-400" />
              <span>Vider</span>
            </button>
          </div>

          <div className="space-y-2 pt-1">
            {history.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl border border-[#F1F5F9] bg-[#FAFAFA]/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {h.file_type === 'csv' ? (
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-neutral-900 truncate max-w-xs">{h.filename}</p>
                    <p className="text-[11px] text-neutral-400">{new Date(h.uploaded_at).toLocaleString('fr-FR')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-neutral-500 font-medium">{h.rows_processed} lignes</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    {h.status === 'processed' ? 'Terminé' : h.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
