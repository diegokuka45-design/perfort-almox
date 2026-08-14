import React, { useState } from 'react';
import { ItemInsumo } from '../types';
import { getSaldo, formatNumber, exportToExcel } from '../lib/storage';
import { FAMILIAS } from '../data/mockData';
import { ClipboardCheck, Search, Filter, CheckCircle2, Download, RefreshCw } from 'lucide-react';

interface InventarioViewProps {
  items: ItemInsumo[];
  onUpdateContagem: (idx: number, qtdContada: number) => void;
  onAjustarInventario: (idx: number) => void;
  canEdit: boolean;
}

export const InventarioView: React.FC<InventarioViewProps> = ({
  items,
  onUpdateContagem,
  onAjustarInventario
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFamilia, setFilterFamilia] = useState('');

  const filteredItems = items.filter(i => {
    const matchSearch = !searchTerm || (i.codigo + ' ' + i.nome).toLowerCase().includes(searchTerm.toLowerCase());
    const matchFamilia = !filterFamilia || i.familia === filterFamilia;
    return matchSearch && matchFamilia;
  });

  const handleExportExcel = () => {
    const data = filteredItems.map(i => {
      const saldo = getSaldo(i);
      const contada = i.qtd_contada !== undefined ? i.qtd_contada : saldo;
      const diff = contada - saldo;
      return {
        'Código': i.codigo,
        'Nome': i.nome,
        'Família': i.familia,
        'Saldo Sistema': saldo,
        'Qtd Contada': contada,
        'Diferença (Ajuste)': diff,
        'Status': diff === 0 ? 'OK' : diff > 0 ? 'SOBRA' : 'FALTA'
      };
    });
    exportToExcel('Contagem_Inventario', 'Inventario', data);
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Filter Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-[#C9A358]" />
            <span>Contagem de Inventário Físico</span>
          </h3>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 transition-colors ml-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar insumos..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
            <select
              value={filterFamilia}
              onChange={e => setFilterFamilia(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-slate-200 font-semibold focus:outline-none w-full"
            >
              <option value="">Todas as Famílias</option>
              {FAMILIAS.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Count Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-4 space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Nome / Detalhes</th>
                <th className="p-3 text-right">Saldo Sistema</th>
                <th className="p-3 text-center">Qtd Contada</th>
                <th className="p-3 text-right">Diferença</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.map(item => {
                const idx = items.indexOf(item);
                const saldo = getSaldo(item);
                const contada = item.qtd_contada !== undefined ? item.qtd_contada : saldo;
                const diff = contada - saldo;

                const statusLabel = diff === 0 ? 'OK' : diff > 0 ? 'SOBRA' : 'FALTA';

                return (
                  <tr key={item.codigo} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">{item.codigo}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{item.nome}</div>
                      <div className="text-[10px] text-slate-400">{item.familia} {item.detalhe ? `• ${item.detalhe}` : ''}</div>
                    </td>
                    <td className="p-3 text-right font-black text-slate-700 dark:text-slate-300">
                      {formatNumber(saldo)} <span className="text-[10px] font-normal text-slate-400">{item.unidade}</span>
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        step="0.01"
                        value={contada}
                        onChange={e => onUpdateContagem(idx, parseFloat(e.target.value) || 0)}
                        className="w-24 p-1.5 text-center bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                      />
                    </td>
                    <td className="p-3 text-right font-bold">
                      <span className={diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-amber-500' : 'text-red-500'}>
                        {diff > 0 ? `+${formatNumber(diff)}` : formatNumber(diff)}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                        statusLabel === 'OK'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : statusLabel === 'SOBRA'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400'
                      }`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => onAjustarInventario(idx)}
                        disabled={diff === 0}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all mx-auto ${
                          diff === 0
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            : 'bg-[#0D1F2D] text-[#C9A358] hover:bg-slate-800 shadow-sm'
                        }`}
                        title="Aplicar ajuste automático de saldo"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Ajustar</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
