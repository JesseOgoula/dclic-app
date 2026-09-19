import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Target, LogOut, ArrowRight, ShieldCheck } from 'lucide-react';

interface ProgramSelectorProps {
  onSelectProgram: (program: 'mn' | 'gp') => void;
  onLogout: () => void;
}

const ProgramSelector: React.FC<ProgramSelectorProps> = ({ onSelectProgram, onLogout }) => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
      <div className="w-full max-w-4xl space-y-8 animate-fade-in">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-300" />
            <span>Espace Coordinateur</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Plateforme de Suivi DCLIC</h1>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            Sélectionnez le parcours de formation à piloter pour accéder aux données et tableaux de bord.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Card 1 - MN */}
          <Card 
            className="group cursor-pointer transition-all duration-200 hover:border-zinc-600 bg-card border-border hover:bg-zinc-900/40 relative overflow-hidden"
            onClick={() => onSelectProgram('mn')}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200 group-hover:text-white group-hover:border-zinc-700 transition-colors">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="bg-zinc-900/80 text-zinc-300 border-zinc-800 text-xs font-normal">
                  Formation initiale
                </Badge>
              </div>
              <CardTitle className="text-xl mt-4 text-zinc-100 group-hover:text-white transition-colors">
                Marketing Numérique
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 leading-relaxed mt-1.5">
                Cohorte socle — 5 séquences d'apprentissage, devoirs pratiques et suivi de l'engagement.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center justify-between text-xs text-zinc-400 bg-zinc-900/60 px-3 py-2.5 rounded-lg border border-zinc-800/60">
                <span className="font-mono text-zinc-300">G1_MN_072026</span>
                <span className="font-medium text-zinc-300">115 apprenants</span>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">
                <span>Accéder au dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </CardContent>
          </Card>

          {/* Card 2 - GP */}
          <Card 
            className="group cursor-pointer transition-all duration-200 hover:border-zinc-600 bg-card border-border hover:bg-zinc-900/40 relative overflow-hidden"
            onClick={() => onSelectProgram('gp')}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200 group-hover:text-white group-hover:border-zinc-700 transition-colors">
                  <Target className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="bg-zinc-900/80 text-zinc-300 border-zinc-800 text-xs font-normal">
                  Spécialisation
                </Badge>
              </div>
              <CardTitle className="text-xl mt-4 text-zinc-100 group-hover:text-white transition-colors">
                Gestion de Projet Marketing
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 leading-relaxed mt-1.5">
                Spécialisation 360° — 5 séquences opérationnelles, livrables d'entraînement et projet professionnel.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center justify-between text-xs text-zinc-400 bg-zinc-900/60 px-3 py-2.5 rounded-lg border border-zinc-800/60">
                <span className="font-mono text-zinc-300">G1_GPM_092026</span>
                <span className="font-medium text-zinc-300">157 apprenants</span>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">
                <span>Accéder au dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </CardContent>
          </Card>
          
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center pt-6 border-t border-zinc-800/60">
          <Button variant="ghost" size="sm" onClick={onLogout} className="text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 gap-2 h-8 px-3">
            <LogOut className="w-3.5 h-3.5" />
            <span>Déconnexion coordinateur</span>
          </Button>
        </div>

      </div>
    </div>
  );
};

export default ProgramSelector;
