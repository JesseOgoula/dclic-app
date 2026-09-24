import React, { createContext, useContext, useState, useEffect } from 'react';
import { type FormationType, formationStorage } from '@/lib/api';

interface FormationContextType {
  currentFormation: FormationType;
  setFormation: (formation: FormationType) => void;
  showSelector: boolean;
  setShowSelector: (show: boolean) => void;
  formationTitle: string;
  formationCategory: string;
  groupId: string;
  periodText: string;
}

const FormationContext = createContext<FormationContextType | undefined>(undefined);

export const FormationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // If no formation has ever been selected, default to null so the selection screen is shown
  const [formation, setFormationState] = useState<FormationType>(() => {
    return formationStorage.getFormation() || 'gp';
  });

  const [showSelector, setShowSelector] = useState<boolean>(() => {
    return !formationStorage.hasSelectedFormation();
  });

  const handleSelectFormation = (f: FormationType) => {
    formationStorage.setFormation(f);
    setFormationState(f);
    setShowSelector(false);
  };

  const isGP = formation === 'gp';

  const value: FormationContextType = {
    currentFormation: formation,
    setFormation: handleSelectFormation,
    showSelector,
    setShowSelector,
    formationTitle: isGP ? 'Gestion de projet' : 'Marketing numérique',
    formationCategory: isGP ? 'Module de spécialisation' : 'Formation initiale',
    groupId: isGP ? 'G1_GPM_092026' : 'G1_MN_072026',
    periodText: isGP ? 'Septembre — Octobre 2026' : '27 juil — 25 sept 2026',
  };

  return (
    <FormationContext.Provider value={value}>
      {children}
    </FormationContext.Provider>
  );
};

export function useFormation(): FormationContextType {
  const context = useContext(FormationContext);
  if (!context) {
    throw new Error('useFormation must be used within a FormationProvider');
  }
  return context;
}
