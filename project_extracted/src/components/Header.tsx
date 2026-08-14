import React, { useState } from 'react';
import { Obra, User } from '../types';
import { Building2, Sun, Moon, LogOut, Shield, ChevronDown } from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  activeObra: Obra | null;
  obras: Obra[];
  obrasAtivas: Obra[];
  onSelectObra: (obra: Obra | null) => void;
  onLogout: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenPage: (page: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  activeObra,
  obras,
  obrasAtivas,
  onSelectObra,
  onLogout,
  isDarkMode,
  onToggleTheme,
  onOpenPage
}) => {
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);

  return (
    <header className="bg-[#0D1F2D] text-white px-4 py-3 sticky top-0 z-40 shadow-md border-b border-[#C9A358]/30">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Brand & Logo */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onOpenPage('dashboard')}>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#C9A358] to-[#b8924a] flex items-center justify-center font-extrabold text-[#0D1F2D] text-lg shadow">
              P
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-extrabold text-base tracking-wider text-[#C9A358]">PERFORT</span>
                <span className="text-xs font-light tracking-widest text-slate-200">ENGENHARIA</span>
              </div>
              <p className="text-[11px] text-slate-300">Centro de Custo 36 — PERFORT ALMOX</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={onToggleTheme}
              className="p-1.5 rounded-lg bg-slate-800 text-[#C9A358] border border-slate-700 hover:bg-slate-700"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg bg-red-950/80 text-red-300 border border-red-800 hover:bg-red-900"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Obra Selector in Header */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-center bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60">
          <Building2 className="w-4 h-4 text-[#C9A358] shrink-0 ml-1" />
          <select
            value={activeObra?.id || ''}
            onChange={(e) => {
              const val = e.target.value;
              if (!val) {
                onSelectObra(null);
              } else {
                const found = obrasAtivas.find(o => o.id === Number(val));
                onSelectObra(found || null);
              }
            }}
            className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer py-1 pr-2 max-w-[220px] truncate"
          >
            <option value="" className="bg-[#0D1F2D] text-slate-200">🌐 Visão Geral (Todas as Obras)</option>
            {obrasAtivas.map(o => (
              <option key={o.id} value={o.id} className="bg-[#0D1F2D] text-white">
                {o.nome}
              </option>
            ))}
          </select>

          {activeObra && (
            <span className="text-[10px] bg-[#C9A358]/20 text-[#C9A358] border border-[#C9A358]/40 px-2 py-0.5 rounded-full font-medium hidden lg:inline">
              Obra Ativa
            </span>
          )}
        </div>

        {/* Controls, Status & Profile */}
        <div className="hidden md:flex items-center gap-3">
          
          {/* Connection Status Indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800 text-[11px] font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Online
          </div>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-lg bg-slate-800 text-[#C9A358] border border-slate-700 hover:bg-slate-700 transition-colors"
            title="Alternar Tema Escuro/Claro"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Admin Menu Dropdown */}
          {currentUser?.role === 'Administrador' && (
            <div className="relative">
              <button
                onClick={() => setIsAdminDropdownOpen(!isAdminDropdownOpen)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#C9A358]/10 text-[#C9A358] border border-[#C9A358]/30 hover:bg-[#C9A358]/20 text-xs font-semibold transition-colors"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>

              {isAdminDropdownOpen && (
                <div 
                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-2 z-50 text-slate-800 dark:text-slate-200 text-xs"
                  onClick={() => setIsAdminDropdownOpen(false)}
                >
                  <div className="px-3 py-1 font-bold text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 mb-1">
                    Administração
                  </div>
                  <button 
                    onClick={() => onOpenPage('usuarios')} 
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    👥 Gerenciar Usuários
                  </button>
                  <button 
                    onClick={() => onOpenPage('obras')} 
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    🏗️ Gerenciar Obras
                  </button>
                  <button 
                    onClick={() => onOpenPage('backup')} 
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    💾 Backup & Restore
                  </button>
                  <button 
                    onClick={() => onOpenPage('config')} 
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                  >
                    ⚙️ Configurações
                  </button>
                </div>
              )}
            </div>
          )}

          {/* User Badge */}
          {currentUser && (
            <div className="text-right pl-2 border-l border-slate-700">
              <div className="text-xs font-bold text-[#C9A358]">{currentUser.username}</div>
              <div className="text-[10px] text-slate-400">{currentUser.role}</div>
            </div>
          )}

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="p-2 rounded-lg bg-red-950/80 text-red-300 border border-red-800 hover:bg-red-900 transition-colors"
            title="Encerrar Sessão"
          >
            <LogOut className="w-4 h-4" />
          </button>

        </div>

      </div>
    </header>
  );
};
