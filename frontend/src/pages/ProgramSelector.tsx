import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Target, LogOut } from 'lucide-react';

interface ProgramSelectorProps {
  onSelectProgram: (program: 'mn' | 'gp') => void;
  onLogout: () => void;
}

const ProgramSelector: React.FC<ProgramSelectorProps> = ({ onSelectProgram, onLogout }) => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
      <div className="w-full max-w-5xl space-y-10">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center border border-primary/30">
              <span className="font-bold text-xl text-primary">D</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Plateforme de Suivi DCLIC</h1>
          </div>
          <p className="text-lg text-muted-foreground">Sélectionnez le parcours à monitorer</p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1 - MN */}
          <Card 
            className="group cursor-pointer hover:scale-[1.02] transition-all duration-300 hover:border-pink-500/50 hover:shadow-[0_0_20px_-5px_rgba(236,72,153,0.3)] bg-card border-border"
            onClick={() => onSelectProgram('mn')}
          >
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start mb-2">
                <div className="p-3 bg-pink-500/10 rounded-lg text-pink-500 group-hover:bg-pink-500 group-hover:text-white transition-colors">
                  <BarChart3 className="w-8 h-8" />
                </div>
                <Badge className="bg-pink-500/15 text-pink-500 hover:bg-pink-500/25 border-pink-500/30">
                  Formation initiale
                </Badge>
              </div>
              <CardTitle className="text-2xl mt-4">Marketing Numérique</CardTitle>
              <CardDescription className="text-base mt-2">
                Suivi de la formation initiale en marketing numérique — 5 séquences d'apprentissage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md">
                <span>115 apprenants · Groupe G1_MN_072026</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2 - GP */}
          <Card 
            className="group cursor-pointer hover:scale-[1.02] transition-all duration-300 hover:border-teal-500/50 hover:shadow-[0_0_20px_-5px_rgba(20,184,166,0.3)] bg-card border-border"
            onClick={() => onSelectProgram('gp')}
          >
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start mb-2">
                <div className="p-3 bg-teal-500/10 rounded-lg text-teal-500 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                  <Target className="w-8 h-8" />
                </div>
                <Badge className="bg-teal-500/15 text-teal-500 hover:bg-teal-500/25 border-teal-500/30">
                  Spécialisation
                </Badge>
              </div>
              <CardTitle className="text-2xl mt-4">Gestion de Projet Marketing</CardTitle>
              <CardDescription className="text-base mt-2">
                Module de spécialisation en gestion de projets marketing 360° — 5 séquences + projet professionnel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md">
                <span>~158 apprenants · Groupe G1_GPM_092026</span>
              </div>
            </CardContent>
          </Card>
          
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center pt-8">
          <p className="text-sm text-muted-foreground mb-4">Coordinateur connecté</p>
          <Button variant="outline" size="sm" onClick={onLogout} className="gap-2">
            <LogOut className="w-4 h-4" />
            Déconnexion
          </Button>
        </div>

      </div>
    </div>
  );
};

export default ProgramSelector;
