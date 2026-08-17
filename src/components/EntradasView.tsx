import React, { useState } from 'react';
import { ItemInsumo, EntradaStock } from '../types';
import { formatCurrency, formatNumber, exportToExcel, getInsumos, saveInsumos } from '../lib/firestoreStorage';
import { ArrowDownLeft, Plus, Search, Trash2, Download, Shield } from 'lucide-react';

interface EntradasViewProps {
  items: ItemInsumo[];
  entradas: EntradaStock[];
  onAddEntrada: (entrada: Omit<EntradaStock, 'id'>) => void;
  onDeleteEntrada: (id: string) => void;
  canDelete: boolean;
  preselectedCodigo?: string;
}

export const EntradasView: React.FC<EntradasViewProps> = ({
  items,
  entradas,
  onAddEntrada,
  onDeleteEntrada,
  canDelete,
  preselectedCodigo
}) => {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [selectedCodigo, setSelectedCodigo] = useState(preselectedCodigo || '');
  const [qtd, setQtd] = useState('');
  const [valorUnit, setValorUnit] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [nf, setNf] = useState('');
  const [obs, setObs] = useState('');
  const [formCaNumero, setFormCaNumero] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  // Detect if selected item is EPI
  const selectedItem = items.find(i => i.codigo === selectedCodigo);
  const isEpi = selectedItem?.familia === 'EPIs';

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCodigo) {
      alert('Selecione um insumo.');
      return;
    }
    const quantity = parseFloat(qtd);
    if (!quantity || quantity <= 0) {
      alert('Informe uma quantidade maior que zero.');
      return;
    }

    // Validate C.A when item is EPI
    if (isEpi && !formCaNumero.trim()) {
      alert('Campo "Número do C.A" é obrigatório para itens EPI.');
      return;
    }

    const item = items.find(i => i.codigo === selectedCodigo);
    if (!item) return;

    const unitPrice = parseFloat(valorUnit) || 0;

    onAddEntrada({
      data,
      codigo: selectedCodigo,
      nome: item.nome,
      qtd: quantity,
      valor_unit: unitPrice,
      valor_total: quantity * unitPrice,
      fornecedor,
      nf,
      obs,
      updatedAt: Date.now()
    });

    // Save caNumero to ItemInsumo when item is EPI
    if (isEpi && formCaNumero.trim()) {
      const allInsumos = getInsumos();
      const idx = allInsumos.findIndex(i => i.codigo === selectedCodigo);
      if (idx >= 0) {
        allInsumos[idx].caNumero = formCaNumero.trim();
        saveInsumos(allInsumos);
      }
    }

    setQtd('');
    setValorUnit('');
    setFornecedor('');
    setNf('');
    setObs('');
    setFormCaNumero('');
  };

  const filteredEntradas = entradas.filter(e => {
    return !searchTerm || (e.codigo + ' ' + e.nome + ' ' + (e.fornecedor || '') + ' ' + (e.nf || '')).toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleExportExcel = () => {
    const exportData = filteredEntradas.map(e => ({
      'ID': e.id,
      'Data': e.data,
      'Código': e.codigo,
      'Insumo': e.nome,
      'Quantidade': e.qtd,
      'Preço Unitário': e.valor_unit,
      'Valor Total': e.valor_total,
      'Fornecedor': e.fornecedor || '',
      'NF': e.nf || '',
      'Observação': e.obs || ''
    }));
    exportToExcel('Historico_Entradas', 'Entradas', exportData);
  };

  return (
    <div className="space-y-6">
      
      {/* Form Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
          <span>Registrar Entrada de Material</span>
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
                    {i.codigo} — {i.nome} ({i.unidade})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Campo C.A quando item selecionado for EPI */}
          {isEpi && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-[#C9A358]" />
                  Número do C.A *
                </label>
                <input
                  type="text"
                  value={formCaNumero}
                  onChange={e => setFormCaNumero(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  placeholder="Ex: 12345"
                  required
                />
              </div>
              <div className="flex items-end">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 pb-2">
                  Certificado de Aprovação obrigatório para EPIs
                </p>
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
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Preço Unitário (R$)</label>
              <input
                type="number"
                step="0.01"
                value={valorUnit}
                onChange={e => setValorUnit(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Fornecedor</label>
              <input
                type="text"
                value={fornecedor}
                onChange={e => setFornecedor(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                placeholder="Nome do fornecedor"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nº Nota Fiscal</label>
              <input
                type="text"
                value={nf}
                onChange={e => setNf(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                placeholder="Nº da NF"
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
              placeholder="Detalhes adicionais do recebimento"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs shadow hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Confirmar Entrada</span>
            </button>
          </div>
        </form>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-3 p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">
            Histórico de Entradas ({filteredEntradas.length})
          </h3>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar entradas..."
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
                <th className="p-2.5 text-right">Preço Unit.</th>
                <th className="p-2.5 text-right">Total (R$)</th>
                <th className="p-2.5">Fornecedor</th>
                <th className="p-2.5">NF</th>
                {canDelete && <th className="p-2.5 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredEntradas.slice().reverse().map(e => (
                <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="p-2.5 text-slate-400 font-mono">#{e.id}</td>
                  <td className="p-2.5 text-slate-600 dark:text-slate-400">{e.data}</td>
                  <td className="p-2.5 font-mono font-bold text-slate-700 dark:text-slate-300">{e.codigo}</td>
                  <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">{e.nome}</td>
                  <td className="p-2.5 text-right font-bold text-slate-800 dark:text-slate-200">{formatNumber(e.qtd)}</td>
                  <td className="p-2.5 text-right text-slate-600 dark:text-slate-400">{formatCurrency(e.valor_unit)}</td>
                  <td className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(e.valor_total)}</td>
                  <td className="p-2.5 text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{e.fornecedor || '-'}</td>
                  <td className="p-2.5 text-slate-600 dark:text-slate-400 font-mono">{e.nf || '-'}</td>
                  {canDelete && (
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => {
                          if (confirm('Excluir este registro de entrada?')) onDeleteEntrada(e.id);
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