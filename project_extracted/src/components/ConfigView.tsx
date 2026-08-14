import React from 'react';
import { Obra, User } from '../types';
import { Settings, Moon, Sun, Building, CheckCircle2, Cloud } from 'lucide-react';
import { firebaseConfig } from '../lib/firebase';

interface ConfigViewProps {
  currentUser: User | null;
  activeObra: Obra | null;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const ConfigView: React.FC<ConfigViewProps> = ({
  currentUser,
  activeObra,
  isDarkMode,
  onToggleTheme
}) => {
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#0D1F2D] text-[#C9A358] rounded-xl font-bold">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white">Configurações Gerais do Sistema</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Preferências, Firebase e parâmetros globais</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Firebase Config Panel */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Cloud className="w-4 h-4 text-amber-500" />
            <span>Firebase & Cloud Backend (`perfort-gerencia`)</span>
          </h3>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Status da integração com o projeto Firebase oficial da **PERFORT ENGENHARIA**.
          </p>

          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 text-xs font-mono">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-1.5">
              <span className="text-slate-400 font-sans">Projeto ID:</span>
              <span className="text-slate-800 dark:text-white font-bold">{firebaseConfig.projectId}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-1.5">
              <span className="text-slate-400 font-sans">Domínio Auth:</span>
              <span className="text-slate-800 dark:text-white truncate max-w-[200px]">{firebaseConfig.authDomain}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-1.5">
              <span className="text-slate-400 font-sans">Storage Bucket:</span>
              <span className="text-slate-800 dark:text-white truncate max-w-[200px]">{firebaseConfig.storageBucket}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-400 font-sans">Status Firebase:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 font-sans">
                <CheckCircle2 className="w-3.5 h-3.5" /> Conectado & Ativo
              </span>
            </div>
          </div>
        </div>

        {/* Theme & Display */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            <span>Aparência e Tema Visual</span>
          </h3>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Alterne entre o modo Claro (alta legibilidade sob sol no canteiro) e o modo Escuro (conforto visual para escritório).
          </p>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isDarkMode ? <Moon className="w-5 h-5 text-[#C9A358]" /> : <Sun className="w-5 h-5 text-[#C9A358]" />}
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-white">
                  {isDarkMode ? 'Modo Escuro Ativo' : 'Modo Claro Ativo'}
                </p>
                <p className="text-[11px] text-slate-400">Clique para alternar o tema do sistema</p>
              </div>
            </div>

            <button
              onClick={onToggleTheme}
              className="px-4 py-2 bg-[#0D1F2D] text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors"
            >
              Alternar
            </button>
          </div>
        </div>

      </div>

      {/* Corporate & Tenant Info */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Building className="w-4 h-4 text-[#C9A358]" />
          <span>Informações da Empresa e Obra Ativa</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Empresa</span>
            <span className="text-slate-800 dark:text-white font-extrabold text-sm">PERFORT ENGENHARIA</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Centro de Custo</span>
            <span className="text-slate-800 dark:text-white font-bold">CC 36 — PERFORT ALMOX</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Obra Selecionada</span>
            <span className="text-[#C9A358] font-bold">{activeObra ? activeObra.nome : 'Nenhuma (Visão Geral)'}</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Sessão Atual</span>
            <span className="text-slate-800 dark:text-white font-bold">{currentUser?.username} ({currentUser?.role})</span>
          </div>
        </div>
      </div>

    </div>
  );
};