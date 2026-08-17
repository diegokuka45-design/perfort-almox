import React, { useState, useMemo } from 'react';
import { ItemInsumo } from '../types';
import { getSaldo, getStatus, formatNumber, exportToExcel, getActiveObra } from '../lib/storage';
import { FAMILIAS } from '../data/mockData';
import { INSUMOS_PDF } from '../data/insumosImportados';
import { addImportedInsumos, isInsumoAlreadyImported } from '../lib/importedInsumos';
import { Package, Plus, Search, Filter, Edit, Trash2, Download, Upload, CheckSquare, Square, X } from 'lucide-react';

interface CadastroViewProps {
  items: ItemInsumo[];
  onAddItem: (item: ItemInsumo) => void;
  onUpdateItem: (idx: number, item: ItemInsumo) => void;
  onDeleteItem: (idx: number) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export const CadastroView: React.FC<CadastroViewProps> = ({
  items,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  canEdit,
  canDelete
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFamilia, setFilterFamilia] = useState('');

  // Modal New / Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [familia, setFamilia] = useState(FAMILIAS[0]);
  const [unidade, setUnidade] = useState('UN');
  const [detalhe, setDetalhe] = useState('');
  const [estoqueInicial, setEstoqueInicial] = useState('0');
  const [estoqueMin, setEstoqueMin] = useState('0');
  const [localizacao, setLocalizacao] = useState('');
  const [precoMedio, setPrecoMedio] = useState('0');

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSearch, setImportSearch] = useState('');
  const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(new Set());

  const filteredItems = items.filter(i => {
    const matchSearch = !searchTerm || (i.codigo + ' ' + i.nome + ' ' + (i.detalhe || '')).toLowerCase().includes(searchTerm.toLowerCase());
    const matchFamilia = !filterFamilia || i.familia === filterFamilia;
    return matchSearch && matchFamilia;
  });

  const openNewModal = () => {
    setEditingIndex(null);
    setCodigo(`MAT${(items.length + 1).toString().padStart(3, '0')}`);
    setNome('');
    setFamilia(FAMILIAS[0]);
    setUnidade('UN');
    setDetalhe('');
    setEstoqueInicial('0');
    setEstoqueMin('10');
    setLocalizacao('');
    setPrecoMedio('0');
    setIsModalOpen(true);
  };

  const openEditModal = (idx: number) => {
    const item = items[idx];
    setEditingIndex(idx);
    setCodigo(item.codigo);
    setNome(item.nome);
    setFamilia(item.familia || FAMILIAS[0]);
    setUnidade(item.unidade || 'UN');
    setDetalhe(item.detalhe || '');
    setEstoqueInicial(item.quantidade.toString());
    setEstoqueMin((item.estoque_min || 0).toString());
    setLocalizacao(item.localizacao || '');
    setPrecoMedio((item.preco_medio || 0).toString());
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo || !nome) {
      alert('Código e nome são obrigatórios.');
      return;
    }

    const newItem: ItemInsumo = {
      codigo,
      nome,
      familia,
      unidade,
      detalhe,
      quantidade: parseFloat(estoqueInicial) || 0,
      estoque_min: parseFloat(estoqueMin) || 0,
      localizacao,
      preco_medio: parseFloat(precoMedio) || 0,
      updatedAt: Date.now()
    };

    if (editingIndex === null) {
      onAddItem(newItem);
    } else {
      onUpdateItem(editingIndex, newItem);
    }

    setIsModalOpen(false);
  };

  const handleExportExcel = () => {
    const data = filteredItems.map(i => ({
      'Código': i.codigo,
      'Nome': i.nome,
      'Família': i.familia,
      'Unidade': i.unidade,
      'Detalhe/Especificação': i.detalhe || '',
      'Estoque Inicial': i.quantidade,
      'Entradas Total': i.entradas_total || 0,
      'Saídas Total': i.saidas_total || 0,
      'Saldo Atual': getSaldo(i),
      'Estoque Mínimo': i.estoque_min,
      'Status': getStatus(i),
      'Localização': i.localizacao || ''
    }));
    exportToExcel('Cadastro_Insumos', 'Insumos', data);
  };

  // ── Import Insumos Logic ──
  const openImportModal = () => {
    setImportSearch('');
    setSelectedImportIds(new Set());
    setIsImportModalOpen(true);
  };

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setImportSearch('');
    setSelectedImportIds(new Set());
  };

  const toggleSelectImport = (id: string) => {
    setSelectedImportIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const obraAtual = useMemo(() => getActiveObra(), [isImportModalOpen]);

  const importList = useMemo(() => {
    const term = importSearch.trim().toLowerCase();
    return INSUMOS_PDF.filter(i =>
      !term ||
      i.codigo.toLowerCase().includes(term) ||
      i.nome.toLowerCase().includes(term) ||
      i.familia.toLowerCase().includes(term)
    );
  }, [importSearch]);

  const isInCatalogo = (codigo: string) => items.some(it => it.codigo === codigo);

  const handleImport = () => {
    const obra = getActiveObra();
    if (!obra) {
      alert('Nenhuma obra ativa selecionada.');
      return;
    }
    if (selectedImportIds.size === 0) {
      alert('Selecione pelo menos um insumo para importar.');
      return;
    }

    const selecionados = INSUMOS_PDF.filter(i => selectedImportIds.has(i.id));
    const novosParaCatalogo = selecionados.filter(i => !isInCatalogo(i.codigo));
    const jaImportados = selecionados.filter(i =>
      isInsumoAlreadyImported(obra.id, i.codigo)
    );

    if (jaImportados.length > 0) {
      const msg = jaImportados.map(i => i.codigo).join(', ');
      if (!confirm(`Alguns insumos já foram importados anteriormente (${msg}). Deseja importar mesmo assim?`)) {
        return;
      }
    }

    // Add to catalog (if not already there)
    novosParaCatalogo.forEach(i => {
      onAddItem({
        codigo: i.codigo,
        nome: i.nome,
        familia: i.familia,
        unidade: 'UN',
        detalhe: '',
        quantidade: 0,
        estoque_min: 0,
        localizacao: '',
        preco_medio: 0,
        updatedAt: Date.now()
      });
    });

    // Register as imported
    addImportedInsumos(
      obra.id,
      selecionados.map(i => ({ id: i.id, codigo: i.codigo, nome: i.nome, familia: i.familia }))
    );

    alert(`${selecionados.length} insumo(s) importado(s) com sucesso!`);
    closeImportModal();
  };

  return (
    <div className="space-y-6">

      {/* Search & Actions Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">

        <div className="flex flex-1 items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por código, nome ou especificação..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
            <select
              value={filterFamilia}
              onChange={e => setFilterFamilia(e.target.value)}
              className="bg-transparent text-slate-700 dark:text-slate-200 font-semibold focus:outline-none pr-1 max-w-[150px] truncate"
            >
              <option value="">Todas as Famílias</option>
              {FAMILIAS.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          <button
            onClick={openNewModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D1F2D] text-[#C9A358] font-bold text-xs shadow hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Insumo</span>
          </button>

          <button
            onClick={openImportModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#C9A358] text-[#0D1F2D] font-bold text-xs shadow hover:bg-[#b08d45] transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Importar Insumos</span>
          </button>
        </div>

      </div>

      {/* Main Catalog Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-[#C9A358]" />
            <span>Catálogo de Insumos ({filteredItems.length})</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Nome / Especificação</th>
                <th className="p-3">Família</th>
                <th className="p-3 text-center">Unidade</th>
                <th className="p-3 text-right">Saldo Atual</th>
                <th className="p-3 text-right">Mínimo</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.map(item => {
                const idx = items.indexOf(item);
                const saldo = getSaldo(item);
                const st = getStatus(item);

                return (
                  <tr key={item.codigo} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">{item.codigo}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{item.nome}</div>
                      {item.detalhe && <div className="text-[10px] text-slate-400">{item.detalhe}</div>}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400 font-medium">{item.familia}</td>
                    <td className="p-3 text-center font-bold text-slate-500">{item.unidade}</td>
                    <td className="p-3 text-right font-black text-slate-800 dark:text-slate-200">{formatNumber(saldo)}</td>
                    <td className="p-3 text-right text-slate-400">{formatNumber(item.estoque_min)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                        st === 'OK'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : st === 'BAIXO'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400'
                      }`}>
                        {st}
                      </span>
                    </td>
                    <td className="p-3 text-center space-x-1">
                      {canEdit && (
                        <button
                          onClick={() => openEditModal(idx)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                          title="Editar"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => {
                            if (confirm(`Excluir ${item.nome}?`)) onDeleteItem(idx);
                          }}
                          className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 hover:bg-red-100"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              {editingIndex === null ? '➕ Cadastrar Novo Insumo' : '✏️ Editar Insumo'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Código</label>
                  <input
                    type="text"
                    value={codigo}
                    onChange={e => setCodigo(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Unidade</label>
                  <select
                    value={unidade}
                    onChange={e => setUnidade(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  >
                    {['UN', 'KG', 'M2', 'M3', 'L', 'ML', 'M', 'JG', 'CX', 'SC', 'GL', 'PAR'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Nome do Insumo</label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  placeholder="Nome do material"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Família / Categoria</label>
                <select
                  value={familia}
                  onChange={e => setFamilia(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                >
                  {FAMILIAS.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Especificação / Detalhe</label>
                <input
                  type="text"
                  value={detalhe}
                  onChange={e => setDetalhe(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  placeholder="Detalhes técnicos do material"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Estoque Inicial</label>
                  <input
                    type="number"
                    step="0.01"
                    value={estoqueInicial}
                    onChange={e => setEstoqueInicial(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Estoque Mínimo</label>
                  <input
                    type="number"
                    step="0.01"
                    value={estoqueMin}
                    onChange={e => setEstoqueMin(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Localização no Almoxarifado</label>
                <input
                  type="text"
                  value={localizacao}
                  onChange={e => setLocalizacao(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  placeholder="Ex: Prateleira B3, Pátio A"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#0D1F2D] text-[#C9A358] font-bold shadow hover:bg-slate-800"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Import Insumos Modal ── */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#C9A358]" />
                Importar Insumos
              </h3>
              <button onClick={closeImportModal} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={importSearch}
                  onChange={e => setImportSearch(e.target.value)}
                  placeholder="Buscar por código, nome ou família..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                />
              </div>
              <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                {importList.length} insumo(s) encontrado(s) · {selectedImportIds.size} selecionado(s)
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2">
              {importList.length === 0 && (
                <div className="text-center text-xs text-slate-400 py-8">
                  Nenhum insumo disponível para importação.
                </div>
              )}
              {importList.map(insumo => {
                const jaCadastrado = isInCatalogo(insumo.codigo);
                const jaImportado = obraAtual ? isInsumoAlreadyImported(obraAtual.id, insumo.codigo) : false;
                const isSelected = selectedImportIds.has(insumo.id);
                return (
                  <div
                    key={insumo.id}
                    onClick={() => toggleSelectImport(insumo.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-[#C9A358] bg-[#C9A358]/5 dark:bg-[#C9A358]/10'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="shrink-0 text-[#C9A358]">
                      {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-700 dark:text-slate-300">{insumo.codigo}</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{insumo.nome}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{insumo.familia}</div>
                    </div>
                    <div className="shrink-0 flex flex-col gap-1 items-end">
                      {jaCadastrado && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          Já cadastrado
                        </span>
                      )}
                      {!jaCadastrado && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                          Novo
                        </span>
                      )}
                      {jaImportado && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                          Já importado
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={closeImportModal}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={selectedImportIds.size === 0}
                className={`px-4 py-2 rounded-xl font-bold text-xs shadow transition-colors ${
                  selectedImportIds.size === 0
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-[#0D1F2D] text-[#C9A358] hover:bg-slate-800'
                }`}
              >
                Importar {selectedImportIds.size > 0 ? `(${selectedImportIds.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
