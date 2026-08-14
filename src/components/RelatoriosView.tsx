import React, { useState } from 'react';
import { ItemInsumo, EntradaStock, SaidaStock } from '../types';
import { formatCurrency, formatNumber, exportReportPDF, exportToExcel } from '../lib/storage';
import { BarChart3, Download, FileText, Filter, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface RelatoriosViewProps {
  items: ItemInsumo[];
  entradas: EntradaStock[];
  saidas: SaidaStock[];
}

export const RelatoriosView: React.FC<RelatoriosViewProps> = ({
  items,
  entradas,
  saidas
}) => {
  const [iniDate, setIniDate] = useState('');
  const [fimDate, setFimDate] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');

  const [hasGenerated, setHasGenerated] = useState(true);

  // Combine movements
  const allMovs = [
    ...entradas.map(e => ({
      data: e.data,
      tipo: 'Entrada' as const,
      codigo: e.codigo,
      nome: e.nome,
      qtd: e.qtd,
      valor_unit: e.valor_unit,
      valor_total: e.valor_total,
      fornecedorOuDestino: e.fornecedor
    })),
    ...saidas.map(s => ({
      data: s.data,
      tipo: 'Saída' as const,
      codigo: s.codigo,
      nome: s.nome,
      qtd: s.qtd,
      valor_unit: s.valor_unit,
      valor_total: s.valor_total,
      fornecedorOuDestino: s.destino || s.solicitante
    }))
  ];

  const filteredMovs = allMovs.filter(m => {
    if (iniDate && m.data < iniDate) return false;
    if (fimDate && m.data > fimDate) return false;
    if (tipoFilter && m.tipo.toLowerCase() !== tipoFilter.toLowerCase()) return false;
    return true;
  }).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  const handleExportPDF = () => {
    exportReportPDF(filteredMovs, { ini: iniDate, fim: fimDate, tipo: tipoFilter });
  };

  const handleExportExcel = () => {
    const data = filteredMovs.map(m => ({
      'Data': m.data,
      'Tipo': m.tipo,
      'Código': m.codigo,
      'Insumo': m.nome,
      'Quantidade': m.qtd,
      'Preço Unitário': m.valor_unit,
      'Valor Total': m.valor_total,
      'Fornecedor / Destino': m.fornecedorOuDestino || ''
    }));
    exportToExcel('Relatorio_Movimentacoes', 'Movimentacoes', data);
  };

  return (
    <div className="space-y-6">
      
      {/* Filter Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#C9A358]" />
          <span>Filtros do Relatório de Movimentações</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Data Inicial</label>
            <input
              type="date"
              value={iniDate}
              onChange={e => setIniDate(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Data Final</label>
            <input
              type="date"
              value={fimDate}
              onChange={e => setFimDate(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Tipo de Movimento</label>
            <select
              value={tipoFilter}
              onChange={e => setTipoFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
            >
              <option value="">Todas (Entradas e Saídas)</option>
              <option value="entrada">Apenas Entradas</option>
              <option value="saida">Apenas Saídas</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Excel</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow hover:bg-blue-700 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Exportar PDF Formatado</span>
          </button>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#C9A358]" />
            <span>Movimentações Localizadas ({filteredMovs.length})</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="p-2.5">Data</th>
                <th className="p-2.5 text-center">Tipo</th>
                <th className="p-2.5">Código</th>
                <th className="p-2.5">Insumo</th>
                <th className="p-2.5 text-right">Qtd</th>
                <th className="p-2.5 text-right">Unitário (R$)</th>
                <th className="p-2.5 text-right">Total (R$)</th>
                <th className="p-2.5">Forn. / Destino</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredMovs.map((m, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="p-2.5 text-slate-600 dark:text-slate-400">{m.data}</td>
                  <td className="p-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      m.tipo === 'Entrada'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400'
                    }`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td className="p-2.5 font-mono font-bold text-slate-700 dark:text-slate-300">{m.codigo}</td>
                  <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">{m.nome}</td>
                  <td className="p-2.5 text-right font-bold text-slate-800 dark:text-slate-200">{formatNumber(m.qtd)}</td>
                  <td className="p-2.5 text-right text-slate-600 dark:text-slate-400">{formatCurrency(m.valor_unit)}</td>
                  <td className="p-2.5 text-right font-bold text-[#C9A358]">{formatCurrency(m.valor_total)}</td>
                  <td className="p-2.5 text-slate-600 dark:text-slate-400 truncate max-w-[150px]">{m.fornecedorOuDestino || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
