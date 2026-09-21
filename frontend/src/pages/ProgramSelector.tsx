import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Target, LogOut, ArrowRight, ShieldCheck, Sun, Moon, GraduationCap } from 'lucide-react';
import { useTheme } from '@/lib/theme';

interface ProgramSelectorProps {
  onSelectProgram: (program: 'mn' | 'gp' | 'pp') => void;
  onLogout: () => void;
}

const ProgramSelector: React.FC<ProgramSelectorProps> = ({ onSelectProgram, onLogout }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
      <div className="w-full max-w-6xl space-y-8 animate-fade-in">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted border border-border text-xs font-medium text-muted-foreground mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-foreground/80" />
            <span>Espace Coordinateur</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Plateforme de Suivi DCLIC</h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Sélectionnez le parcours ou le module à piloter pour accéder aux données et tableaux de bord en temps réel.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Card 1 - MN */}
          <Card 
            className="group cursor-pointer transition-all duration-200 hover:border-primary/40 bg-card border-border hover:bg-accent/30 relative overflow-hidden shadow-sm flex flex-col justify-between"
            onClick={() => onSelectProgram('mn')}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center text-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs font-normal">
                  Formation initiale
                </Badge>
              </div>
              <CardTitle className="text-xl mt-4 text-foreground transition-colors">
                Marketing Numérique
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed mt-1.5">
                Cohorte socle — 5 séquences d'apprentissage, devoirs pratiques et suivi de l'engagement.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/60 px-3 py-2.5 rounded-lg border border-border/60">
                <span className="font-mono text-foreground font-medium">G1_MN_072026</span>
                <span className="font-medium text-foreground">115 apprenants</span>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                <span>Accéder au dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </CardContent>
          </Card>

          {/* Card 2 - GP */}
          <Card 
            className="group cursor-pointer transition-all duration-200 hover:border-primary/40 bg-card border-border hover:bg-accent/30 relative overflow-hidden shadow-sm flex flex-col justify-between"
            onClick={() => onSelectProgram('gp')}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center text-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
                  <Target className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs font-normal">
                  Spécialisation
                </Badge>
              </div>
              <CardTitle className="text-xl mt-4 text-foreground transition-colors">
                Gestion de Projet Marketing
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed mt-1.5">
                Spécialisation 360° — 5 séquences opérationnelles, ateliers et suivi de cohorte.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/60 px-3 py-2.5 rounded-lg border border-border/60">
                <span className="font-mono text-foreground font-medium">G1_GPM_092026</span>
                <span className="font-medium text-foreground">157 apprenants</span>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                <span>Accéder au dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </CardContent>
          </Card>

          {/* Card 3 - PP */}
          <Card 
            className="group cursor-pointer transition-all duration-200 hover:border-primary/40 bg-card border-border hover:bg-accent/30 relative overflow-hidden shadow-sm flex flex-col justify-between"
            onClick={() => onSelectProgram('pp')}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center text-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-normal">
                  Certification & Livrables
                </Badge>
              </div>
              <CardTitle className="text-xl mt-4 text-foreground transition-colors">
                Projet Professionnel (PP)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed mt-1.5">
                Supervision des 6 livrables, suivi comparatif V1 Entraînement vs V2 Restitution et notation finale.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/60 px-3 py-2.5 rounded-lg border border-border/60">
                <span className="font-mono text-foreground font-medium">PROJET_PRO_2026</span>
                <span className="font-medium text-foreground">31 projets suivis</span>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                <span>Accéder au monitoring</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </CardContent>
          </Card>
          
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-3 pt-6 border-t border-border">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleTheme} 
            className="text-xs text-muted-foreground hover:text-foreground hover:bg-accent gap-2 h-8 px-3 cursor-pointer"
            title={theme === 'dark' ? "Passer au thème clair" : "Passer au thème sombre"}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{theme === 'dark' ? 'Thème clair' : 'Thème sombre'}</span>
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onLogout} 
            className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2 h-8 px-3 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Déconnexion coordinateur</span>
          </Button>
        </div>

      </div>
    </div>
  );
};

export default ProgramSelector;
