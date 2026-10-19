import React, { useState, useCallback, useEffect } from 'react';
import {
  Upload as UploadIcon,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Trash2,
  RefreshCcw,
  Users,
  ArrowRight,
  Loader2,
  Sparkles,
  Clipboard,
  Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, type UploadResult } from '@/lib/api';
import { useFormation } from '@/context/FormationContext';

interface UploadPageProps {
  onNavigate?: (page: 'dashboard' | 'learners' | 'upload' | 'reports') => void;
}

const UPLOAD_STEPS = [
  'Téléversement et analyse du fichier Moodle...',
  'Détection automatique de la cohorte et nettoyage des noms...',
  'Synchronisation et alignement des activités pédagogiques...',
  'Enregistrement des notes et détection des incohérences Moodle...',
  'Mise à jour instantanée des statistiques et caches mémoire...',
];

export default function UploadPage({ onNavigate }: UploadPageProps) {
  const { currentFormation, setFormation, formationTitle, formationCategory, groupId } = useFormation();
  const [importMode, setImportMode] = useState<'file' | 'gradebook' | 'text'>('file');
  const [rawText, setRawText] = useState('');
  const [gradebookText, setGradebookText] = useState('');
  const [parsingCount, setParsingCount] = useState<number>(0);
  const [gradebookLearnerCount, setGradebookLearnerCount] = useState<number>(0);
  const [gradebookGradesCount, setGradebookGradesCount] = useState<number>(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStepIndex, setUploadStepIndex] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<any[]>([]);

  // Détection en direct des adresses e-mails valides dans le texte collé (Participants)
  useEffect(() => {
    if (!rawText.trim()) {
      setParsingCount(0);
      return;
    }
    const emailMatches = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    const unique = new Set(emailMatches?.map(e => e.toLowerCase()) || []);
    setParsingCount(unique.size);
  }, [rawText]);

  // Détection en direct des apprenants et des notes dans le texte collé (Carnet de notes Moodle)
  useEffect(() => {
    if (!gradebookText.trim()) {
      setGradebookLearnerCount(0);
      setGradebookGradesCount(0);
      return;
    }
    const emailMatches = gradebookText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    const unique = new Set(emailMatches?.map(e => e.toLowerCase()) || []);
    setGradebookLearnerCount(unique.size);

    const gradeMatches = gradebookText.match(/\b\d{1,3}[.,]\d{2}\b/g);
    setGradebookGradesCount(gradeMatches ? gradeMatches.length : 0);
  }, [gradebookText]);

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

  const handleRawTextSubmit = async () => {
    if (!rawText.trim() || parsingCount === 0) {
      setError('Veuillez coller un texte contenant au moins un apprenant avec une adresse courriel valide.');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);
    setUploadedFileName(`Sélection collée (${parsingCount} apprenant${parsingCount > 1 ? 's' : ''})`);

    try {
      const data = await api.uploadRawText(rawText, currentFormation);
      setResult(data);
      fetchHistory();
      setRawText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du traitement du texte.');
    } finally {
      setUploading(false);
    }
  };

  const handleGradebookTextSubmit = async () => {
    if (!gradebookText.trim() || gradebookLearnerCount === 0) {
      setError("Veuillez coller le tableau complet du « Rapport de l'évaluateur » Moodle contenant les apprenants et leurs notes.");
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);
    setUploadedFileName(`Carnet de notes Moodle (${gradebookLearnerCount} apprenant${gradebookLearnerCount > 1 ? 's' : ''})`);

    try {
      const data = await api.uploadGradebookText(gradebookText, currentFormation);
      setResult(data);
      fetchHistory();
      setGradebookText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'import du carnet de notes Moodle.");
    } finally {
      setUploading(false);
    }
  };

  const isGradebookContent = (text: string) =>
    text.includes('sortitemid=') ||
    text.includes('Rapport de l’évaluateur') ||
    text.includes("Rapport de l'évaluateur") ||
    text.includes('Affichage des notes et tendances centrales') ||
    text.includes('Total du cours');

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
      if (file) {
        await uploadFile(file);
        return;
      }

      // Check if text was dragged and dropped
      const droppedText = e.dataTransfer.getData('text/plain');
      if (droppedText && droppedText.includes('@')) {
        if (isGradebookContent(droppedText)) {
          setImportMode('gradebook');
          setGradebookText(droppedText);
        } else {
          setImportMode('text');
          setRawText(droppedText);
        }
      }
    },
    [uploadFile]
  );

  const handleDropzonePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (text && text.includes('@')) {
      e.preventDefault();
      if (isGradebookContent(text)) {
        setImportMode('gradebook');
        setGradebookText(text);
      } else {
        setImportMode('text');
        setRawText(text);
      }
    }
  };

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
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

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] pb-2">
        <button
          type="button"
          onClick={() => setImportMode('file')}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer',
            importMode === 'file'
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          )}
        >
          <UploadIcon size={14} />
          <span>Fichier (CSV, XLSX, MD)</span>
        </button>

        <button
          type="button"
          onClick={() => setImportMode('gradebook')}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer',
            importMode === 'gradebook'
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          )}
        >
          <Award size={14} />
          <span>Tableau des Notes Moodle (Copier-coller)</span>
          {gradebookLearnerCount > 0 && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold',
                importMode === 'gradebook' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
              )}
            >
              {gradebookLearnerCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setImportMode('text')}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer',
            importMode === 'text'
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
          )}
        >
          <Clipboard size={14} />
          <span>Participants (Copier-coller)</span>
          {parsingCount > 0 && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold',
                importMode === 'text' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-800'
              )}
            >
              {parsingCount}
            </span>
          )}
        </button>
      </div>

      {/* 2. Import Content */}
      {importMode === 'file' ? (
        <div
          className={cn(
            'relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer bg-white shadow-none focus:outline-none focus:border-neutral-900',
            dragActive
              ? 'border-neutral-900 bg-neutral-50'
              : 'border-[#E2E8F0] hover:border-neutral-400 hover:bg-[#FAFAFA]',
            uploading && 'pointer-events-none opacity-60'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onPaste={handleDropzonePaste}
          onClick={() => document.getElementById('file-input')?.click()}
          tabIndex={0}
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
                  Formats acceptés : CSV, XLSX, XLS (Progression ou Participants) et MD · Max 50 MB
                </p>
                <p className="text-[11px] text-neutral-400 mt-2 font-mono">
                  Astuce : Vous pouvez aussi copier le Carnet de notes Moodle et faire Ctrl+V directement ici
                </p>
              </div>
            </div>
          )}
        </div>
      ) : importMode === 'gradebook' ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <Award size={16} className="text-amber-600" />
                Copier-coller du Tableau des Notes Moodle (« Rapport de l'évaluateur »)
              </h2>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                Depuis Moodle (&gt; Notes &gt; Rapport de l'évaluateur), faites <kbd className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-[10px] font-mono">Ctrl+A</kbd> puis <kbd className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-[10px] font-mono">Ctrl+C</kbd>, et collez l'intégralité de la page ci-dessous. Le système nettoie automatiquement toute la pollution Moodle (menus, liens, initiales d'avatars, colonnes en suppression) et extrait chaque apprenant et toutes ses notes.
              </p>
            </div>

            {gradebookLearnerCount > 0 && (
              <div className="flex items-center gap-2 shrink-0 self-start">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Users size={13} />
                  {gradebookLearnerCount} apprenant{gradebookLearnerCount > 1 ? 's' : ''}
                </span>
                {gradebookGradesCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                    <Award size={13} />
                    {gradebookGradesCount} cellules chiffrées
                  </span>
                )}
              </div>
            )}
          </div>

          <div
            className={cn(
              "relative rounded-xl border transition-all",
              dragActive ? "border-neutral-900 ring-2 ring-neutral-900/10" : "border-[#E2E8F0] focus-within:border-neutral-900"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <textarea
              value={gradebookText}
              onChange={e => setGradebookText(e.target.value)}
              placeholder={"Collez ici le texte complet copié depuis le « Rapport de l'évaluateur » Moodle (même avec les menus, liens et notifications de la page)...\n\nExemple pris en charge :\n[Prénom] / [Nom de famille]\n[Adresse de courriel]\n[Livrable 1 : Rapport d'audit et de recommandations]\n...\nHAHawa Abdoulaye Gouro\nhawaabdoulaye077@gmail.com\n15,00\n-"}
              rows={10}
              disabled={uploading}
              className="w-full p-3.5 text-xs font-mono bg-[#FAFAFA] rounded-xl focus:outline-none focus:bg-white resize-y text-neutral-800 placeholder:text-neutral-400"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-neutral-500 flex items-start sm:items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1 sm:mt-0" />
              <span>
                Compare la liste avec la cohorte, enregistre toutes les notes (ainsi que les livrables non notés <code className="px-1 py-0.5 bg-neutral-100 rounded">-</code>) et identifie les incohérences Moodle (notes obtenues mais marquées « Pas terminé »).
              </span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {gradebookText && (
                <button
                  type="button"
                  onClick={() => setGradebookText('')}
                  disabled={uploading}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                >
                  Effacer
                </button>
              )}

              <button
                type="button"
                onClick={handleGradebookTextSubmit}
                disabled={uploading || gradebookLearnerCount === 0}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-none cursor-pointer",
                  uploading || gradebookLearnerCount === 0
                    ? "bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed"
                    : "bg-neutral-900 hover:bg-neutral-800 text-white"
                )}
              >
                {uploading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Nettoyage & Synchronisation...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    <span>
                      Analyser & Importer les notes {gradebookLearnerCount > 0 ? `(${gradebookLearnerCount})` : ''}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <Clipboard size={15} className="text-neutral-700" />
                Copier-coller de la liste des Participants Moodle
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Sélectionnez le tableau des participants ou les lignes sur Moodle, copiez-les (Ctrl+C), puis collez (Ctrl+V) ci-dessous.
              </p>
            </div>

            {parsingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 self-start sm:self-auto">
                <Users size={13} />
                {parsingCount} apprenant{parsingCount > 1 ? 's' : ''} détecté{parsingCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div
            className={cn(
              "relative rounded-xl border transition-all",
              dragActive ? "border-neutral-900 ring-2 ring-neutral-900/10" : "border-[#E2E8F0] focus-within:border-neutral-900"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="Collez ici votre sélection Moodle (colonnes séparées par des tabulations, tableau markdown ou texte brut avec e-mails et heures de dernière connexion)...&#10;&#10;Exemple de format Moodle :&#10;Prénom / Nom    Adresse de courriel    Rôles    Groupes    Dernier accès au cours&#10;Jean DUPONT     jean.dupont@gmail.com   Étudiant  G1_GPM_092026   16 heures 22 min"
              rows={8}
              disabled={uploading}
              className="w-full p-3.5 text-xs font-mono bg-[#FAFAFA] rounded-xl focus:outline-none focus:bg-white resize-y text-neutral-800 placeholder:text-neutral-400"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-neutral-500 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>
                Prend automatiquement en compte les noms, prénoms, adresses e-mails, groupes et heures de dernier accès.
              </span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {rawText && (
                <button
                  type="button"
                  onClick={() => setRawText('')}
                  disabled={uploading}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                >
                  Effacer
                </button>
              )}

              <button
                type="button"
                onClick={handleRawTextSubmit}
                disabled={uploading || parsingCount === 0}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-none cursor-pointer",
                  uploading || parsingCount === 0
                    ? "bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed"
                    : "bg-neutral-900 hover:bg-neutral-800 text-white"
                )}
              >
                {uploading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Synchronisation...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    <span>Importer {parsingCount > 0 ? `(${parsingCount} apprenant${parsingCount > 1 ? 's' : ''})` : ''}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <p className="text-[11px] text-neutral-400 mt-0.5">Apprenants traités</p>
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

          {/* Gradebook Comparison & Incoherence Report */}
          {result.gradebook_comparison && (
            <div className="border border-[#E2E8F0] rounded-xl p-4 bg-[#FAFAFA] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
                    <Award size={14} className="text-amber-600" />
                    Comparaison de la liste des apprenants & Bilan des notes
                  </h4>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Réconciliation entre le copier-coller du Carnet de notes Moodle et la liste officielle de la cohorte
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
                  {result.gradebook_comparison.matched_count} / {result.gradebook_comparison.total_in_cohort} apprenants réconciliés
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
                  <p className="text-[10px] font-semibold uppercase text-neutral-400">Liste Notes collée</p>
                  <p className="text-lg font-bold text-neutral-900 mt-0.5">{result.gradebook_comparison.total_in_gradebook}</p>
                  <p className="text-[10px] text-neutral-500">apprenants extraits</p>
                </div>
                <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
                  <p className="text-[10px] font-semibold uppercase text-neutral-400">Liste Cohorte</p>
                  <p className="text-lg font-bold text-neutral-900 mt-0.5">{result.gradebook_comparison.total_in_cohort}</p>
                  <p className="text-[10px] text-neutral-500">inscrits au parcours</p>
                </div>
                <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
                  <p className="text-[10px] font-semibold uppercase text-neutral-400">Devoirs notés</p>
                  <p className="text-lg font-bold text-emerald-700 mt-0.5">{result.gradebook_comparison.grades_recorded}</p>
                  <p className="text-[10px] text-neutral-500">+ {result.gradebook_comparison.ungraded_recorded} non notés (0/20)</p>
                </div>
                <div className="p-3 bg-red-50/70 rounded-lg border border-red-200">
                  <p className="text-[10px] font-semibold uppercase text-red-700">Incohérences Moodle</p>
                  <p className="text-lg font-bold text-red-700 mt-0.5">{result.gradebook_comparison.incoherences_detected}</p>
                  <p className="text-[10px] text-red-600 font-medium">
                    dont {result.gradebook_comparison.passing_incoherences_detected} validés (&ge;10/20)
                  </p>
                </div>
              </div>

              {result.gradebook_comparison.incoherences_detected > 0 && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-red-900">
                      <span className="font-bold">
                        {result.gradebook_comparison.incoherences_detected} devoir(s) sur {result.gradebook_comparison.affected_learners_count} apprenant(s)
                      </span>{' '}
                      ont déjà reçu une note dans Moodle mais apparaissent comme <span className="font-semibold underline">« Pas terminé »</span> dans le suivi d'achèvement (suite à une réouverture de tentative).
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (result.formation && result.formation !== currentFormation) {
                        setFormation(result.formation);
                      }
                      if (onNavigate) onNavigate('dashboard');
                    }}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Voir les incohérences dans le Dashboard
                  </button>
                </div>
              )}

              {(result.gradebook_comparison.missing_in_gradebook.length > 0 ||
                result.gradebook_comparison.missing_in_cohort.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {result.gradebook_comparison.missing_in_gradebook.length > 0 && (
                    <div className="p-3 bg-white rounded-lg border border-amber-200 text-xs">
                      <p className="font-semibold text-amber-900 mb-1">
                        Absents du copier-coller des notes ({result.gradebook_comparison.missing_in_gradebook.length}) :
                      </p>
                      <div className="max-h-28 overflow-y-auto space-y-1 text-[11px] text-neutral-600">
                        {result.gradebook_comparison.missing_in_gradebook.map((m, idx) => (
                          <div key={idx} className="truncate">
                            · {m.first_name} {m.last_name} ({m.email})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.gradebook_comparison.missing_in_cohort.length > 0 && (
                    <div className="p-3 bg-white rounded-lg border border-blue-200 text-xs">
                      <p className="font-semibold text-blue-900 mb-1">
                        Nouveaux apprenants ajoutés depuis le carnet de notes ({result.gradebook_comparison.missing_in_cohort.length}) :
                      </p>
                      <div className="max-h-28 overflow-y-auto space-y-1 text-[11px] text-neutral-600">
                        {result.gradebook_comparison.missing_in_cohort.map((m, idx) => (
                          <div key={idx} className="truncate">
                            · {m.name} ({m.email})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
          <p className="text-xs text-neutral-400 mt-0.5">Exportez ou copiez-collez vos rapports directement depuis la plateforme Moodle</p>
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex items-start gap-3 p-3 rounded-xl border border-[#F1F5F9] bg-[#FAFAFA]/50">
            <Award size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-neutral-900">Copier-coller — Tableau des Notes Moodle (« Rapport de l'évaluateur »)</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Copiez toute la page du carnet de notes Moodle (Ctrl+A puis Ctrl+C) et collez-la dans l'onglet dédié. Nettoie la pollution Moodle, extrait toutes les notes, compare la liste des apprenants et détecte les devoirs notés marqués « Pas terminé ».
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl border border-[#F1F5F9] bg-[#FAFAFA]/50">
            <FileText size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-neutral-900">CSV — Progression des activités</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Export depuis Moodle &gt; Course Management &gt; Achèvement des activités. Enregistre automatiquement la progression et préserve les notes du carnet de notes.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl border border-[#F1F5F9] bg-[#FAFAFA]/50">
            <Users size={18} className="text-neutral-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-neutral-900">MD, XLSX ou Copier-coller — Liste des participants Moodle</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Export ou copier-coller depuis Moodle &gt; Participants. Synchronise les noms propres, adresses e-mails, groupes et dates de dernier accès.
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
