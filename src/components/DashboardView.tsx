import React, { useState } from 'react';
import { ItemInsumo, EntradaStock, SaidaStock } from '../types';
import { getSaldo, getStatus, formatCurrency, formatNumber } from '../lib/firestoreStorage';
import { FAMILIAS } from '../data/mockData';
import { Package, TrendingUp, AlertTriangle, ArrowDownLeft, ArrowUpRight, Filter, Sparkles, Plus } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement } from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

interface DashboardViewProps {
  items: ItemInsumo[];
  entradas: EntradaStock[];
  saidas: SaidaStock[];
  onOpenPage: (page: string) => void;
  onAnalisarIA: () => void;
  onIrParaEntrada: (codigo: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  items,
  entradas,
  saidas,
  onAnalisarIA,
  onIrParaEntrada
}) => {
  const [selectedFamilia, setSelectedFamilia] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Filter items
  const filteredItems = items.filter(i => {
    if (selectedFamilia && i.familia !== selectedFamilia) return false;
    if (selectedStatus && getStatus(i) !== selectedStatus) return false;
    return true;
  });

  // Calculate KPIs
  const totalItems = filteredItems.length;
  const totalValue = filteredItems.reduce((sum, i) => sum + getSaldo(i) * (i.preco_medio || i.custo_medio || 0), 0);
  const okCount = filteredItems.filter(i => getStatus(i) === 'OK').length;
  const baixoCount = filteredItems.filter(i => getStatus(i) === 'BAIXO').length;
  const criticoCount = filteredItems.filter(i => getStatus(i) === 'CRÍTICO').length;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const totalEntradasMonth = entradas
    .filter(e => e.data && e.data.startsWith(currentMonth))
    .reduce((s, e) => s + e.qtd, 0);

  const totalSaidasMonth = saidas
    .filter(s => s.data && s.data.startsWith(currentMonth))
    .reduce((s, x) => s + x.qtd, 0);

  const criticalValue = filteredItems
    .filter(i => getStatus(i) === 'CRÍTICO')
    .reduce((s, i) => s + getSaldo(i) * (i.preco_medio || 0), 0);

  const coverageRate = totalItems > 0 ? Math.round((okCount / totalItems) * 100) : 0;

  // Chart Data: Status Distribution
  const doughnutData = {
    labels: ['OK', 'Alerta (Baixo)', 'Crítico'],
    datasets: [
      {
        data: [okCount, baixoCount, criticoCount],
        backgroundColor: ['#38A169', '#D69E2E', '#E53E3E'],
        borderWidth: 0
      }
    ]
  };

  // Chart Data: Top 10 Value Insumos
  const top10Items = [...filteredItems]
    .sort((a, b) => getSaldo(b) * (b.preco_medio || 0) - getSaldo(a) * (a.preco_medio || 0))
    .slice(0, 10);

  const top10Data = {
    labels: top10Items.map(i => i.codigo),
    datasets: [
      {
        label: 'Valor em Estoque (R$)',
        data: top10Items.map(i => getSaldo(i) * (i.preco_medio || 0)),
        backgroundColor: '#C9A358',
        borderRadius: 6
      }
    ]
  };

  // Recent Movements Stream
  const recentMovements = [
    ...entradas.map(e => ({ ...e, tipo: 'Entrada' as const })),
    ...saidas.map(s => ({ ...s, tipo: 'Saída' as const }))
  ]
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      
      {/* Header Bar & Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#0D1F2D] text-[#C9A358] rounded-xl font-bold">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white">Painel Geral do Almoxarifado</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Visão consolidada em tempo real</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
            <select
              value={selectedFamilia}
              onChange={e => setSelectedFamilia(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-slate-200 font-semibold focus:outline-none pr-2"
            >
              <option value="">Todas as Famílias</option>
              {FAMILIAS.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-slate-200 font-semibold focus:outline-none pr-2"
            >
              <option value="">Todos os Status</option>
              <option value="OK">Status OK</option>
              <option value="BAIXO">Status BAIXO</option>
              <option value="CRÍTICO">Status CRÍTICO</option>
            </select>
          </div>

          <button
            onClick={onAnalisarIA}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs shadow hover:opacity-90 transition-opacity ml-auto"
          >
            <Sparkles className="w-4 h-4" />
            <span>Análise com IA</span>
          </button>
        </div>
      </div>

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm border-t-4 border-t-[#0D1F2D]">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Insumos</div>
          <div className="text-2xl font-black text-slate-800 dark:text-white mt-1">{totalItems}</div>
          <div className="text-[10px] text-slate-400 mt-1">cadastrados</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm border-t-4 border-t-[#C9A358]">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Valor em Estoque</div>
          <div className="text-xl font-black text-[#C9A358] mt-1">{formatCurrency(totalValue)}</div>
          <div className="text-[10px] text-slate-400 mt-1">saldo x preço médio</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm border-t-4 border-t-red-500">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Alertas Críticos</div>
          <div className="text-2xl font-black text-red-500 mt-1">{baixoCount + criticoCount}</div>
          <div className="text-[10px] text-red-400 mt-1">{criticoCount} zerados</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm border-t-4 border-t-emerald-500">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Entradas (Mês)</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{formatNumber(totalEntradasMonth)}</div>
          <div className="text-[10px] text-emerald-500 mt-1">volume acumulado</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm border-t-4 border-t-blue-500">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Saídas (Mês)</div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{formatNumber(totalSaidasMonth)}</div>
          <div className="text-[10px] text-blue-500 mt-1">consumo obra</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm border-t-4 border-t-indigo-500">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Taxa Cobertura</div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{coverageRate}%</div>
          <div className="text-[10px] text-indigo-400 mt-1">acima do mínimo</div>
        </div>

      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Status Doughnut Chart */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-3">Distribuição de Status</h3>
          <div className="h-48 flex items-center justify-center">
            <Doughnut data={doughnutData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>

        {/* Top 10 Value Insumos Bar Chart */}
        <div className="md:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-3">Top 10 Maior Valor em Estoque</h3>
          <div className="h-48">
            <Bar data={top10Data} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
          </div>
        </div>

      </div>

      {/* Low Stock Items List & Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Low Stock Table */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Itens com Estoque Baixo ou Crítico</span>
            </h3>
            <span className="text-xs text-slate-400">{baixoCount + criticoCount} itens</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="p-2">Código</th>
                  <th className="p-2">Nome</th>
                  <th className="p-2 text-right">Saldo</th>
                  <th className="p-2 text-right">Mínimo</th>
                  <th className="p-2 text-center">Status</th>
                  <th className="p-2 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.filter(i => getStatus(i) !== 'OK').slice(0, 8).map(i => {
                  const st = getStatus(i);
                  const saldo = getSaldo(i);
                  return (
                    <tr key={i.codigo} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-2 font-mono font-bold text-slate-700 dark:text-slate-300">{i.codigo}</td>
                      <td className="p-2 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{i.nome}</td>
                      <td className="p-2 text-right font-bold text-slate-800 dark:text-slate-200">{formatNumber(saldo)}</td>
                      <td className="p-2 text-right text-slate-400">{formatNumber(i.estoque_min)}</td>
                      <td className="p-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          st === 'CRÍTICO'
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                        }`}>
                          {st}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => onIrParaEntrada(i.codigo)}
                          className="p-1 text-xs bg-[#0D1F2D] text-[#C9A358] rounded-lg hover:bg-slate-800"
                          title="Registrar Entrada"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Movements Stream */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span>Últimas Movimentações</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="p-2">Data</th>
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Insumo</th>
                  <th className="p-2 text-right">Qtd</th>
                  <th className="p-2 text-right">Total (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentMovements.map(m => (
                  <tr key={`${m.tipo}-${m.id}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-2 text-slate-400">{m.data}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        m.tipo === 'Entrada'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                      }`}>
                        {m.tipo}
                      </span>
                    </td>
                    <td className="p-2 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[140px]">{m.nome}</td>
                    <td className="p-2 text-right font-bold text-slate-800 dark:text-slate-200">{formatNumber(m.qtd)}</td>
                    <td className="p-2 text-right font-semibold text-slate-600 dark:text-slate-400">{formatCurrency(m.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};
