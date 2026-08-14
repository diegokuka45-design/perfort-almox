import React from 'react';
import { User } from '../types';
import { 
  LayoutDashboard, 
  Package, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ClipboardCheck, 
  BarChart3, 
  Bell, 
  Settings, 
  Users, 
  Database, 
  Building, 
  TestTube, 
  Bot 
} from 'lucide-react';

interface SidebarProps {
  activePage: string;
  onOpenPage: (page: string) => void;
  currentUser: User | null;
  hasPermission: (module: string) => boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onOpenPage,
  hasPermission
}) => {
  const almoxNavItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'cadastro', label: 'Cadastro Insumos', icon: Package },
    { key: 'entradas', label: 'Entradas', icon: ArrowDownLeft },
    { key: 'saidas', label: 'Saídas', icon: ArrowUpRight },
    { key: 'inventario', label: 'Inventário', icon: ClipboardCheck },
    { key: 'relatorio', label: 'Relatórios', icon: BarChart3 },
    { key: 'alertas', label: 'Alertas', icon: Bell },
    { key: 'obras', label: 'Obras', icon: Building },
    { key: 'backup', label: 'Backup & Restore', icon: Database },
    { key: 'usuarios', label: 'Usuários', icon: Users },
    { key: 'config', label: 'Configurações', icon: Settings },
  ];

  const engNavItems = [
    { key: 'cq-concretagem', label: 'CQ Concretagem', icon: TestTube },
    { key: 'assistente-ia', label: 'Assistente IA', icon: Bot },
  ];

  return (
    <aside className="w-16 md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col py-4 shrink-0 transition-all duration-200">
      
      {/* Almoxarifado Section */}
      <div className="px-3 mb-2 hidden md:block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
        Almoxarifado
      </div>

      <nav className="space-y-1 px-2">
        {almoxNavItems.map((item) => {
          if (!hasPermission(item.key)) return null;
          const Icon = item.icon;
          const isActive = activePage === item.key;

          return (
            <button
              key={item.key}
              onClick={() => onOpenPage(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[#0D1F2D] text-[#C9A358] dark:bg-slate-800 dark:text-[#C9A358] shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={item.label}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#C9A358]' : 'text-slate-400'}`} />
              <span className="hidden md:inline truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Engenharia Section */}
      <div className="px-3 mt-6 mb-2 hidden md:block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-t border-slate-100 dark:border-slate-800/80 pt-4">
        Engenharia & IA
      </div>

      <nav className="space-y-1 px-2">
        {engNavItems.map((item) => {
          if (!hasPermission(item.key)) return null;
          const Icon = item.icon;
          const isActive = activePage === item.key;

          return (
            <button
              key={item.key}
              onClick={() => onOpenPage(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[#0D1F2D] text-[#C9A358] dark:bg-slate-800 dark:text-[#C9A358] shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={item.label}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#C9A358]' : 'text-slate-400'}`} />
              <span className="hidden md:inline truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

    </aside>
  );
};
