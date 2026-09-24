import React from 'react';
import { useFormation } from '@/context/FormationContext';
import { Layers, Briefcase, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormationType } from '@/lib/api';

interface FormationSelectorModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const FormationSelectorModal: React.FC<FormationSelectorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentFormation, setFormation } = useFormation();

  if (!isOpen) return null;

  const handleSelect = (type: FormationType) => {
    setFormation(type);
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-2xl bg-white border border-border rounded-2xl p-6 sm:p-8 shadow-none">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            DCLIC Monitoring
          </p>
          <h2 className="text-2xl font-bold text-foreground tracking-tight mt-1">
            Sélectionnez votre programme
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            Choisissez la phase de formation à administrer et visualiser sur le dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Module de Spécialisation (Gestion de projet) */}
          <button
            type="button"
            onClick={() => handleSelect('gp')}
            className={cn(
              "group relative flex flex-col text-left p-5 rounded-xl border transition-all cursor-pointer",
              currentFormation === 'gp'
                ? "border-primary bg-primary/[0.02]"
                : "border-border hover:border-neutral-300 bg-white"
            )}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center text-foreground group-hover:bg-neutral-200 transition-colors">
                <Briefcase size={18} strokeWidth={2} />
              </div>
              {currentFormation === 'gp' && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                  <Check size={14} /> Actif
                </span>
              )}
            </div>

            <span className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase">
              Module de spécialisation
            </span>
            <span className="text-base font-bold text-foreground mt-0.5">
              Gestion de projet
            </span>

            <div className="mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground space-y-1">
              <div className="flex items-center justify-between">
                <span>Cohorte</span>
                <span className="font-mono text-foreground text-[11px]">G1_GPM_092026</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Structure</span>
                <span className="text-foreground">5 Blocs + Livrables</span>
              </div>
            </div>

            <div className="mt-4 flex items-center text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
              Accéder au dashboard
              <ChevronRight size={14} className="ml-1" />
            </div>
          </button>

          {/* Formation Initiale (Marketing Numérique) */}
          <button
            type="button"
            onClick={() => handleSelect('mn')}
            className={cn(
              "group relative flex flex-col text-left p-5 rounded-xl border transition-all cursor-pointer",
              currentFormation === 'mn'
                ? "border-primary bg-primary/[0.02]"
                : "border-border hover:border-neutral-300 bg-white"
            )}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center text-foreground group-hover:bg-neutral-200 transition-colors">
                <Layers size={18} strokeWidth={2} />
              </div>
              {currentFormation === 'mn' && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                  <Check size={14} /> Actif
                </span>
              )}
            </div>

            <span className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase">
              Formation initiale
            </span>
            <span className="text-base font-bold text-foreground mt-0.5">
              Marketing numérique
            </span>

            <div className="mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground space-y-1">
              <div className="flex items-center justify-between">
                <span>Cohorte</span>
                <span className="font-mono text-foreground text-[11px]">G1_MN_072026</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Structure</span>
                <span className="text-foreground">5 Séquences + Projet Pro</span>
              </div>
            </div>

            <div className="mt-4 flex items-center text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
              Accéder au dashboard
              <ChevronRight size={14} className="ml-1" />
            </div>
          </button>
        </div>

        {onClose && (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
            >
              Fermer sans changer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
