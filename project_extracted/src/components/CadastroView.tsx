import React, { useState, useMemo } from 'react';
import { ItemInsumo } from '../types';
import { getSaldo, getStatus, formatNumber, exportToExcel, addImportedInsumo, isInsumoAlreadyInObra, getImportedInsumos } from '../lib/storage';
import { FAMILIAS } from '../data/mockData';
import { CATALOGO_INSUMOS, CatalogoInsumo } from '../data/catalogoInsumos';
import { INSUMOS_IMPORTADOS, InsumoImportado } from '../data/insumosImportados';
import { Package, Plus, Search, Filter, Edit, Trash2, Download, BookOpen, Upload, CheckSquare, Square, X, Database } from 'lucide-react';

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

  // Catálogo autocomplete
  const [catalogoQuery, setCatalogoQuery] = useState('');
  const [selectedCatalogo, setSelectedCatalogo] = useState<CatalogoInsumo | null>(null);
  const [showCatalogoDropdown, setShowCatalogoDropdown] = useState(false);

  // Importar Insumos Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSearch, setImportSearch] = useState('');
  const [selectedInsumos, setSelectedInsumos] = useState<Set<string>>(new Set());
  const [expandedInsumo, setExpandedInsumo] = useState<number | null>(null);

  const catalogoResults = useMemo(() => {
    if (!catalogoQuery.trim()) return [];
    const q = catalogoQuery.toLowerCase();
    return CATALOGO_INSUMOS.filter(c =>
      c.nome.toLowerCase().includes(q) ||
      c.codigo.includes(q)
    ).slice(0, 50);
  }, [catalogoQuery]);

  const applyCatalogoItem = (item: CatalogoInsumo, descricao?: string) => {
    setSelectedCatalogo(item);
    setCodigo(item.codigo);
    setNome(item.nome);
    setFamilia(item.familia && FAMILIAS.includes(item.familia) ? item.familia : FAMILIAS[0]);
    setUnidade(item.unidade || 'UN');
    if (descricao) {
      setDetalhe(descricao);
    } else if (item.descricoes.length === 1) {
      setDetalhe(item.descricoes[0].descricao);
    } else {
      setDetalhe('');
    }
    setCatalogoQuery('');
    setShowCatalogoDropdown(false);
  };

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
    setCatalogoQuery('');
    setSelectedCatalogo(null);
    setShowCatalogoDropdown(false);
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
    setCatalogoQuery('');
    setSelectedCatalogo(null);
    setShowCatalogoDropdown(false);
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

    setCatalogoQuery('');
    setSelectedCatalogo(null);
    setShowCatalogoDropdown(false);
    setIsModalOpen(false);
  };

  // ── Importar Insumos helpers ──
  const obraId = items.length > 0 && items[0].obraId ? items[0].obraId : undefined;

  const isVariacaoAlreadyImported = (nome: string, variacao: string, obraId?: number) => {
    const all = getImportedInsumos();
    return all.some(r =>
      r.nome.toLowerCase() === nome.toLowerCase() &&
      r.variacao.toLowerCase() === variacao.toLowerCase() &&
      (obraId === undefined || r.obraId === obraId)
    );
  };

  const filteredImportInsumos = useMemo(() => {
    if (!importSearch.trim()) return INSUMOS_IMPORTADOS;
    const q = importSearch.toLowerCase();
    return INSUMOS_IMPORTADOS.filter(i =>
      i.nome.toLowerCase().includes(q) ||
      i.id.toString().includes(q) ||
      i.variacoes.some(v => v.toLowerCase().includes(q))
    );
  }, [importSearch]);

  const isVariacaoBlocked = (insumo: InsumoImportado, variacao: string) => {
    return isInsumoAlreadyInObra(insumo.nome, variacao, obraId);
  };

  const toggleVariacao = (insumoId: number, variacao: string) => {
    const key = `${insumoId}::${variacao}`;
    setSelectedInsumos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllVisible = () => {
    const allKeys = new Set<string>();
    filteredImportInsumos.forEach(ins => {
      ins.variacoes.forEach(v => {
        if (!isVariacaoBlocked(ins, v)) {
          allKeys.add(`${ins.id}::${v}`);
        }
      });
    });
    setSelectedInsumos(allKeys);
  };

  const deselectAll = () => setSelectedInsumos(new Set());

  const handleImportSelected = () => {
    if (selectedInsumos.size === 0) {
      alert('Selecione pelo menos um insumo para importar.');
      return;
    }
    let count = 0;
    selectedInsumos.forEach(key => {
      const [insIdStr, variacao] = key.split('::');
      const insumo = INSUMOS_IMPORTADOS.find(i => i.id === parseInt(insIdStr, 10));
      if (insumo && !isVariacaoAlreadyImported(insumo.nome, variacao, obraId)) {
        addImportedInsumo({
          id: insumo.id,
          nome: insumo.nome,
          variacao,
          codigo: `IMP${insumo.id.toString().padStart(4, '0')}`,
          unidade: 'UN',
          familia: 'Importado',
          obraId: obraId || 0,
          obraNome: ''
        });
        count++;
      }
    });
    alert(`${count} insumo(s) importado(s) com sucesso para o banco de dados separado!`);
    setSelectedInsumos(new Set());
    setIsImportModalOpen(false);
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
            onClick={() => {
              setIsImportModalOpen(true);
              setImportSearch('');
              setSelectedInsumos(new Set());
              setExpandedInsumo(null);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C9A358] text-[#0D1F2D] font-bold text-xs shadow hover:bg-amber-400 transition-colors"
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
                  <tr key={`${item.obraId || 0}-${item.codigo}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
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

              {/* Busca no Catálogo */}
              {editingIndex === null && (
                <div className="relative">
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-[#C9A358]" />
                    Buscar no Catálogo Viezzer
                  </label>
                  <input
                    type="text"
                    value={catalogoQuery}
                    onChange={e => {
                      setCatalogoQuery(e.target.value);
                      setShowCatalogoDropdown(true);
                      setSelectedCatalogo(null);
                    }}
                    onFocus={() => setShowCatalogoDropdown(true)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                    placeholder="Digite código ou nome do insumo..."
                  />
                  {showCatalogoDropdown && catalogoResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg">
                      {catalogoResults.map(item => (
                        <button
                          key={item.codigo}
                          type="button"
                          onClick={() => {
                            if (item.descricoes.length <= 1) {
                              applyCatalogoItem(item, item.descricoes[0]?.descricao);
                            } else {
                              setSelectedCatalogo(item);
                              setShowCatalogoDropdown(false);
                            }
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0"
                        >
                          <div className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                            {item.codigo} — {item.nome}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {item.unidade} · {item.familia} · {item.descricoes.length} variação{item.descricoes.length > 1 ? 's' : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Se o catálogo selecionado tiver múltiplas descrições */}
              {selectedCatalogo && selectedCatalogo.descricoes.length > 1 && (
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                    Selecione a Descrição / Variação
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedCatalogo.descricoes.map(d => (
                      <button
                        key={d.codigo}
                        type="button"
                        onClick={() => applyCatalogoItem(selectedCatalogo, d.descricao)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px]"
                      >
                        <span className="font-mono text-slate-500 mr-2">{selectedCatalogo.codigo}.{d.codigo}</span>
                        <span className="text-slate-700 dark:text-slate-300">{d.descricao}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                  onClick={() => { setCatalogoQuery(''); setSelectedCatalogo(null); setShowCatalogoDropdown(false); setIsModalOpen(false); }}
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

      {/* Modal Importar Insumos */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#C9A358]" />
                  Importar Insumos do Banco Geral
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  {INSUMOS_IMPORTADOS.length.toLocaleString()} insumos disponíveis. Importados vão para um banco de dados separado.
                </p>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search & Actions */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={importSearch}
                  onChange={e => setImportSearch(e.target.value)}
                  placeholder="Buscar por nome, código ou variação..."
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={selectAllVisible}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 transition-colors"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Selecionar Todos
                </button>
                <button
                  onClick={deselectAll}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 transition-colors"
                >
                  <Square className="w-3.5 h-3.5" />
                  Limpar
                </button>
              </div>
            </div>

            {/* Insumos List */}
            <div className="flex-1 overflow-y-auto p-0">
              {filteredImportInsumos.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Nenhum insumo encontrado para "{importSearch}".
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredImportInsumos.map(insumo => {
                    const isExpanded = expandedInsumo === insumo.id;
                    const allBlocked = insumo.variacoes.every(v => isVariacaoBlocked(insumo, v));
                    const someSelected = insumo.variacoes.some(v => selectedInsumos.has(`${insumo.id}::${v}`));
                    return (
                      <div key={insumo.id} className="p-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setExpandedInsumo(isExpanded ? null : insumo.id)}
                            className="flex items-center gap-2 text-left flex-1"
                          >
                            <span className="font-mono text-[10px] text-slate-400 w-12 shrink-0">#{insumo.id}</span>
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{insumo.nome}</span>
                            <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {insumo.variacoes.length} variação{insumo.variacoes.length > 1 ? 's' : ''}
                            </span>
                            {allBlocked && (
                              <span className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950/50 px-1.5 py-0.5 rounded font-bold">JÁ CADASTRADO</span>
                            )}
                          </button>
                          <div className="flex items-center gap-2">
                            {someSelected && !isExpanded && (
                              <span className="text-[10px] font-bold text-[#C9A358]">
                                {insumo.variacoes.filter(v => selectedInsumos.has(`${insumo.id}::${v}`)).length} selec.
                              </span>
                            )}
                            <button
                              onClick={() => setExpandedInsumo(isExpanded ? null : insumo.id)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200"
                            >
                              {isExpanded ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Variações expanded */}
                        {isExpanded && (
                          <div className="mt-2 ml-14 space-y-1">
                            {insumo.variacoes.map((variacao, vIdx) => {
                              const key = `${insumo.id}::${variacao}`;
                              const checked = selectedInsumos.has(key);
                              const blocked = isVariacaoBlocked(insumo, variacao);
                              const alreadyImp = isVariacaoAlreadyImported(insumo.nome, variacao, obraId);
                              return (
                                <label
                                  key={vIdx}
                                  className={`flex items-center gap-2 p-2 rounded-lg border ${
                                    blocked
                                      ? 'border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20 opacity-60 cursor-not-allowed'
                                      : alreadyImp
                                      ? 'border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/20'
                                      : checked
                                      ? 'border-[#C9A358]/30 bg-[#C9A358]/5 dark:bg-[#C9A358]/10'
                                      : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 cursor-pointer'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={blocked}
                                    onChange={() => !blocked && toggleVariacao(insumo.id, variacao)}
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-[#C9A358] focus:ring-[#C9A358] disabled:opacity-30"
                                  />
                                  <span className="text-[11px] text-slate-700 dark:text-slate-300 flex-1">{variacao}</span>
                                  {blocked && (
                                    <span className="text-[10px] text-red-500 font-bold">Já cadastrado na obra</span>
                                  )}
                                  {alreadyImp && !blocked && (
                                    <span className="text-[10px] text-amber-500 font-bold">Já importado</span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                <span className="font-bold text-[#C9A358]">{selectedInsumos.size}</span> insumo(s) selecionado(s)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImportSelected}
                  className="px-4 py-2 rounded-xl bg-[#0D1F2D] text-[#C9A358] font-bold text-xs shadow hover:bg-slate-800"
                >
                  Importar Selecionados
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
