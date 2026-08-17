import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  PackageOpen, 
  Search, 
  Plus, 
  Save, 
  User, 
  MapPin
} from 'lucide-react';
import { ItemInsumo, MaterialConsumo } from '../types';
import { getInsumos, saveInsumos, getMateriaisConsumo, saveMateriaisConsumo, getNextMaterialConsumoId, getActiveObra } from '../lib/firestoreStorage';
import { useDebounce } from '../hooks/useDebounce';
import { VirtualizedTable, ColumnDef } from './VirtualizedTable';

interface MaterialConsumoViewProps {
  obraId: string;
}

const MaterialConsumoViewInner: React.FC<MaterialConsumoViewProps> = ({ obraId }) => {
  const [materiais, setMateriais] = useState<MaterialConsumo[]>([]);
  const [insumos, setInsumos] = useState<ItemInsumo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formInsumoCodigo, setFormInsumoCodigo] = useState('');
  const [formQuantidade, setFormQuantidade] = useState(1);
  const [formRetiradoPor, setFormRetiradoPor] = useState('');
  const [formDestino, setFormDestino] = useState('');
  const [formData, setFormData] = useState('');
  const [formObservacao, setFormObservacao] = useState('');

  // Debounced search — evita recalcular filtro a cada keystroke
  const debouncedSearch = useDebounce(searchTerm, 300);

  const loadMateriais = useCallback(() => {
    const data = getMateriaisConsumo();
    setMateriais(data);
  }, []);

  const loadInsumos = useCallback(() => {
    const allInsumos = getInsumos();
    // Exclude Ferramentas and EPIs (those have their own modules)
    const consumoInsumos = allInsumos.filter(i => 
      i.familia !== 'Ferramentas' && i.familia !== 'EPIs' && i.quantidade > 0
    );
    setInsumos(consumoInsumos);
  }, []);

  useEffect(() => {
    loadMateriais();
    loadInsumos();
  }, [loadMateriais, loadInsumos]);

  // Memoized filtered list with debounced search
  const filteredMateriais = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase();
    if (!searchLower) return materiais;
    return materiais.filter(mat => 
      mat.insumoNome.toLowerCase().includes(searchLower) ||
      mat.retiradoPor.toLowerCase().includes(searchLower) ||
      mat.destino.toLowerCase().includes(searchLower)
    );
  }, [materiais, debouncedSearch]);

  const selectedInsumo = useMemo(
    () => insumos.find(i => i.codigo === formInsumoCodigo),
    [insumos, formInsumoCodigo]
  );

  const handleSubmit = useCallback(() => {
    if (!formInsumoCodigo || !formRetiradoPor || !formDestino || formQuantidade < 1) return;
    if (!selectedInsumo || selectedInsumo.quantidade < formQuantidade) return;

    const activeObra = getActiveObra();

    const newMaterial: MaterialConsumo = {
      id: getNextMaterialConsumoId(),
      insumoId: selectedInsumo.id || '',
      insumoNome: selectedInsumo.nome,
      insumoCodigo: selectedInsumo.codigo,
      quantidade: formQuantidade,
      retiradoPor: formRetiradoPor,
      destino: formDestino,
      data: formData || new Date().toISOString().slice(0, 10),
      observacao: formObservacao || undefined,
      obraId: activeObra ? String(activeObra.id) : '',
      obraNome: activeObra ? activeObra.nome : '-'
    };

    // Deduct from inventory
    const allInsumos = getInsumos();
    const idx = allInsumos.findIndex(i => i.codigo === formInsumoCodigo);
    if (idx >= 0 && allInsumos[idx].quantidade >= formQuantidade) {
      allInsumos[idx].quantidade -= formQuantidade;
      saveInsumos(allInsumos);
    }

    // Save material record
    const currentMateriais = getMateriaisConsumo();
    currentMateriais.push(newMaterial);
    saveMateriaisConsumo(currentMateriais);

    loadMateriais();
    loadInsumos();
    setShowForm(false);
    resetForm();
  }, [formInsumoCodigo, formRetiradoPor, formDestino, formQuantidade, formData, formObservacao, selectedInsumo, loadMateriais, loadInsumos]);

  const resetForm = useCallback(() => {
    setFormInsumoCodigo('');
    setFormQuantidade(1);
    setFormRetiradoPor('');
    setFormDestino('');
    setFormData('');
    setFormObservacao('');
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
  }, []);

  // Column definitions for VirtualizedTable
  const columns = useMemo<ColumnDef<MaterialConsumo>[]>(() => [
    {
      key: 'insumoNome',
      header: 'Material',
      width: 200,
      render: (mat) => (
        <div className="flex items-center gap-2">
          <PackageOpen className="w-4 h-4 text-[#C9A358]" />
          <span className="font-medium text-slate-800 dark:text-slate-200">{mat.insumoNome}</span>
        </div>
      ),
    },
    {
      key: 'insumoCodigo',
      header: 'Código',
      width: 100,
      render: (mat) => <span className="text-slate-600 dark:text-slate-400">{mat.insumoCodigo}</span>,
    },
    {
      key: 'quantidade',
      header: 'Qtd',
      width: 60,
      align: 'center',
      render: (mat) => <span className="font-bold text-slate-700 dark:text-slate-300">{mat.quantidade}</span>,
    },
    {
      key: 'retiradoPor',
      header: 'Retirado Por',
      width: 160,
      render: (mat) => (
        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
          <User className="w-3.5 h-3.5" />
          {mat.retiradoPor}
        </div>
      ),
    },
    {
      key: 'destino',
      header: 'Destino',
      width: 160,
      render: (mat) => (
        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
          <MapPin className="w-3.5 h-3.5" />
          {mat.destino}
        </div>
      ),
    },
    {
      key: 'data',
      header: 'Data',
      width: 110,
      render: (mat) => <span className="text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDate(mat.data)}</span>,
    },
    {
      key: 'observacao',
      header: 'Observação',
      width: 0, // flex-grow
      render: (mat) => <span className="text-slate-500 dark:text-slate-400 text-xs">{mat.observacao || '—'}</span>,
    },
  ], [formatDate]);

  // Memoized stats
  const stats = useMemo(() => ({
    totalSaidas: materiais.length,
    totalItens: materiais.reduce((sum, m) => sum + m.quantidade, 0),
    pessoasAtendidas: new Set(materiais.map(m => m.retiradoPor)).size,
  }), [materiais]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <PackageOpen className="w-5 h-5 text-[#C9A358]" />
            Fornecimento de Materiais de Consumo
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Registro de saída de materiais (sem devolução)
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); resetForm(); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90"
          style={{ backgroundColor: '#4CAF50' }}
        >
          <Plus className="w-4 h-4" />
          Nova Saída
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por material, pessoa ou destino..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
        />
      </div>

      {/* New Material Form */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#C9A358]" />
            Registrar Saída de Material
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Material *</label>
              <select
                value={formInsumoCodigo}
                onChange={(e) => setFormInsumoCodigo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              >
                <option value="">Selecione...</option>
                {insumos.map(i => (
                  <option key={i.codigo} value={i.codigo}>
                    {i.nome} — Estq: {i.quantidade} {i.unidade}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Quantidade *</label>
              <input
                type="number"
                value={formQuantidade}
                onChange={(e) => setFormQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={selectedInsumo ? selectedInsumo.quantidade : undefined}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              />
              {selectedInsumo && (
                <p className="text-xs text-slate-400 mt-1">Disponível: {selectedInsumo.quantidade} {selectedInsumo.unidade}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Retirado Por *</label>
              <input
                type="text"
                value={formRetiradoPor}
                onChange={(e) => setFormRetiradoPor(e.target.value)}
                placeholder="Nome da pessoa"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Destino *</label>
              <input
                type="text"
                value={formDestino}
                onChange={(e) => setFormDestino(e.target.value)}
                placeholder="Ex: Obra A, Setor B"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Data</label>
              <input
                type="date"
                value={formData}
                onChange={(e) => setFormData(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Observação</label>
              <input
                type="text"
                value={formObservacao}
                onChange={(e) => setFormObservacao(e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={handleSubmit}
              disabled={!formInsumoCodigo || !formRetiradoPor || !formDestino || formQuantidade < 1}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: '#4CAF50' }}
            >
              <Save className="w-4 h-4" />
              Registrar Saída
            </button>
            <button
              onClick={() => { setShowForm(false); resetForm(); }}
              className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Materials Table — Virtualizada */}
      <VirtualizedTable<MaterialConsumo>
        columns={columns}
        data={filteredMateriais}
        rowHeight={48}
        maxHeight={480}
        emptyMessage="Nenhuma saída de material registrada"
        itemKey={(mat) => mat.id}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">{stats.totalSaidas}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Saídas Registradas</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center">
          <p className="text-2xl font-bold text-[#C9A358]">{stats.totalItens}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total Itens Consumidos</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center">
          <p className="text-2xl font-bold text-slate-600">{stats.pessoasAtendidas}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Pessoas Atendidas</p>
        </div>
      </div>
    </div>
  );
};

export const MaterialConsumoView = React.memo(MaterialConsumoViewInner);
