import React, { useState } from 'react';
import { Obra, User } from '../types';
import { Settings, Key, Moon, Sun, Building, ShieldCheck, CheckCircle2, Save, Sparkles } from 'lucide-react';

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
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('perf_gemini_key') || '');
  const [savedMsg, setSavedMsg] = useState(false);

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      localStorage.setItem('perf_gemini_key', apiKey.trim());
    } else {
      localStorage.removeItem('perf_gemini_key');
    }
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

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
            <p className="text-xs text-slate-500 dark:text-slate-400">Preferências, temas, integrações de IA e parâmetros globais</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Gemini API Key */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Integração com Gemini AI API</span>
          </h3>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Configure sua chave da API do Gemini para habilitar assistente inteligente avançado de compras, otimização de canteiro e controle de desperdícios em tempo real.
          </p>

          <form onSubmit={handleSaveApiKey} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Gemini API Key
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                />
              </div>
            </div>

            {savedMsg && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Chave salva com sucesso no navegador!
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-[#0D1F2D] text-[#C9A358] font-bold rounded-xl text-xs shadow hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Chave API</span>
            </button>
          </form>
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
