import React, { useState } from 'react';
import { ItemInsumo, SaidaStock } from '../types';
import { getSaldo, formatCurrency, formatNumber, exportToExcel } from '../lib/storage';
import { ArrowUpRight, Plus, Search, Trash2, Download, AlertCircle } from 'lucide-react';

interface SaidasViewProps {
  items: ItemInsumo[];
  saidas: SaidaStock[];
  onAddSaida: (saida: Omit<SaidaStock, 'id'>) => void;
  onDeleteSaida: (id: number) => void;
  canDelete: boolean;
}

export const SaidasView: React.FC<SaidasViewProps> = ({
  items,
  saidas,
  onAddSaida,
  onDeleteSaida,
  canDelete
}) => {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [selectedCodigo, setSelectedCodigo] = useState('');
  const [qtd, setQtd] = useState('');
  const [destino, setDestino] = useState('Térreo');
  const [solicitante, setSolicitante] = useState('');
  const [cc, setCc] = useState('CC 36');
  const [obs, setObs] = useState('');

  const [destinosList, setDestinosList] = useState([
    'Térreo', '1º Pavimento', '2º Pavimento', '3º Pavimento', '4º Pavimento',
    'Área Comum', 'Fachada', 'Muro / Calçada', 'Estacionamento', 'Área Técnica', 'Geral / Não especificado'
  ]);

  const [searchTerm, setSearchTerm] = useState('');

  const selectedItem = items.find(i => i.codigo === selectedCodigo);
  const currentSaldo = selectedItem ? getSaldo(selectedItem) : 0;
  const requestedQtd = parseFloat(qtd) || 0;
  const isInsufficient = selectedItem && requestedQtd > currentSaldo;

  const handleAddDestino = () => {
    const newDest = prompt('Digite o novo destino / pavimento:');
    if (newDest && !destinosList.includes(newDest)) {
      setDestinosList([...destinosList, newDest]);
      setDestino(newDest);
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCodigo) {
      alert('Selecione um insumo.');
      return;
    }
    if (!requestedQtd || requestedQtd <= 0) {
      alert('Informe uma quantidade maior que zero.');
      return;
    }

    if (isInsufficient) {
      if (!confirm(`Atenção: A quantidade solicitada (${requestedQtd}) é maior que o saldo disponível (${currentSaldo}). Deseja prosseguir mesmo assim?`)) {
        return;
      }
    }

    if (!selectedItem) return;
    const unitPrice = selectedItem.preco_medio || selectedItem.custo_medio || 0;

    onAddSaida({
      data,
      codigo: selectedCodigo,
      nome: selectedItem.nome,
      qtd: requestedQtd,
      valor_unit: unitPrice,
      valor_total: requestedQtd * unitPrice,
      destino,
      solicitante,
      cc,
      obs,
      updatedAt: Date.now()
    });

    setQtd('');
    setSolicitante('');
    setObs('');
  };

  const filteredSaidas = saidas.filter(s => {
    return !searchTerm || (s.codigo + ' ' + s.nome + ' ' + (s.destino || '') + ' ' + (s.solicitante || '')).toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleExportExcel = () => {
    const exportData = filteredSaidas.map(s => ({
      'ID': s.id,
      'Data': s.data,
      'Código': s.codigo,
      'Insumo': s.nome,
      'Quantidade': s.qtd,
      'Preço Unitário': s.valor_unit,
      'Valor Total': s.valor_total,
      'Destino / Pavimento': s.destino || '',
      'Solicitante': s.solicitante || '',
      'Centro de Custo': s.cc || '',
      'Observação': s.obs || ''
    }));
    exportToExcel('Historico_Saidas', 'Saidas', exportData);
  };

  return (
    <div className="space-y-6">
      
      {/* Form Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <ArrowUpRight className="w-4 h-4 text-blue-500" />
          <span>Registrar Saída de Material (Consumo)</span>
        </h3>

        <form onSubmit={handleRegister} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Data</label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Insumo / Material</label>
              <select
                value={selectedCodigo}
                onChange={e => setSelectedCodigo(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                required
              >
                <option value="">Selecione o insumo...</option>
                {items.map(i => (
                  <option key={i.codigo} value={i.codigo}>
                    {i.codigo} — {i.nome} (Saldo: {formatNumber(getSaldo(i))} {i.unidade})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedItem && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400">Saldo Disponível:</span>{' '}
                <strong className="text-slate-800 dark:text-white font-bold">{formatNumber(currentSaldo)} {selectedItem.unidade}</strong>
              </div>
              <div>
                <span className="text-slate-400">Valor Unitário Médio:</span>{' '}
                <strong className="text-[#C9A358] font-bold">{formatCurrency(selectedItem.preco_medio || selectedItem.custo_medio || 0)}</strong>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Quantidade</label>
              <input
                type="number"
                step="0.01"
                value={qtd}
                onChange={e => setQtd(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Destino / Pavimento
              </label>
              <div className="flex gap-1">
                <select
                  value={destino}
                  onChange={e => setDestino(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                >
                  {destinosList.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddDestino}
                  className="px-2 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold hover:bg-slate-300"
                  title="Novo Destino"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Solicitante</label>
              <input
                type="text"
                value={solicitante}
                onChange={e => setSolicitante(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                placeholder="Nome do responsável"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Centro de Custo (CC)</label>
              <input
                type="text"
                value={cc}
                onChange={e => setCc(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                placeholder="CC 36"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Observações</label>
            <input
              type="text"
              value={obs}
              onChange={e => setObs(e.target.value)}
              className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              placeholder="Ex: Aplicação em fôrmas do 3º pavimento"
            />
          </div>

          {isInsufficient && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Aviso: Quantidade solicitada excede o saldo atual em estoque!</span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-xs shadow hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Confirmar Saída</span>
            </button>
          </div>
        </form>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-3 p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">
            Histórico de Saídas ({filteredSaidas.length})
          </h3>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar saídas..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none"
              />
            </div>

            <button
              onClick={handleExportExcel}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              title="Exportar Excel"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="p-2.5">ID</th>
                <th className="p-2.5">Data</th>
                <th className="p-2.5">Código</th>
                <th className="p-2.5">Insumo</th>
                <th className="p-2.5 text-right">Qtd</th>
                <th className="p-2.5">Destino</th>
                <th className="p-2.5">Solicitante</th>
                <th className="p-2.5">CC</th>
                {canDelete && <th className="p-2.5 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSaidas.slice().reverse().map((s, idx) => (
                <tr key={`${s.obraId || 0}-${s.id}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="p-2.5 text-slate-400 font-mono">#{s.id}</td>
                  <td className="p-2.5 text-slate-600 dark:text-slate-400">{s.data}</td>
                  <td className="p-2.5 font-mono font-bold text-slate-700 dark:text-slate-300">{s.codigo}</td>
                  <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">{s.nome}</td>
                  <td className="p-2.5 text-right font-bold text-blue-600 dark:text-blue-400">{formatNumber(s.qtd)}</td>
                  <td className="p-2.5 text-slate-600 dark:text-slate-400 font-medium">{s.destino || '-'}</td>
                  <td className="p-2.5 text-slate-600 dark:text-slate-400">{s.solicitante || '-'}</td>
                  <td className="p-2.5 text-slate-400 font-mono">{s.cc || '-'}</td>
                  {canDelete && (
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => {
                          if (confirm('Excluir este registro de saída?')) onDeleteSaida(s.id);
                        }}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
