import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { VirtualizedTable, ColumnDef } from './VirtualizedTable';

import { ItemInsumo } from '../types';
import {
  getSaldo,
  getStatus,
  formatNumber,
  exportToExcel,
  addImportedInsumo,
  isInsumoAlreadyInObra,
  getImportedInsumos
} from '../lib/firestoreStorage';

import { FAMILIAS } from '../data/mockData';
import { CATALOGO_INSUMOS, CatalogoInsumo } from '../data/catalogoInsumos';
import { INSUMOS_IMPORTADOS, InsumoImportado } from '../data/insumosImportados';

import {
  Package,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Download,
  BookOpen,
  Upload,
  Square,
  X,
  Database
} from 'lucide-react';

interface CadastroViewProps {
  items: ItemInsumo[];
  onAddItem: (item: ItemInsumo) => void;
  onUpdateItem: (idx: number, item: ItemInsumo) => void;
  onDeleteItem: (idx: number) => void;
  canEdit: boolean;
  canDelete: boolean;
}

function getStatusBadgeClass(status: string): string {
  if (status === 'OK') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400';
  }
  if (status === 'BAIXO') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400';
  }
  return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400';
}

const CATEGORIAS: Record<string, string[]> = {
  'EPIs': ['Equipamentos de Proteção Individual (EPI\'s)'],
  'EPC': ['Equipamentos de Proteção Coletiva (EPC\'s)'],
  'Ferramentas': ['Ferramentas', 'Locação de Máquinas, Equipamentos e Ferramentas (Terceiros)'],
  'Serralheria / Fixação': ['Fechaduras e Ferragens'],
  'Estrutural / Concreto / Aço': ['Armadura', 'Concretos'],
  'Instalações Hidráulicas / Gás': ['Diversos'],
  'Instalações Elétricas': ['Materiais Elétricos Diversos', 'Interruptores, Tomadas e Conjuntos', 'Condicionador de Ar'],
  'Esquadrias / Portas / Janelas': ['Fechaduras e Ferragens', 'Madeira Serrada Para Uso Geral'],
  'Alvenaria / Vedação / Impermeabilização': ['Materiais Aplicados'],
  'Revestimento / Piso / Pintura': ['Pintura'],
  'Cobertura / Telhado / Madeira': ['Madeira Serrada Para Uso Geral'],
  'Paisagismo / Jardinagem': ['Diversos'],
  'Manutenção Veículos / Equipamentos': ['Peças Automotivas Para Manutenção de Imobilizado', 'Combustíveis, Óleos e Lubrificantes'],
  'Mobiliário / Administrativo / Limpeza': ['Expediente', 'Limpeza', 'Materiais de Limpeza', 'Materiais de Higiene', 'Suprimentos cozinha'],
  'Materiais de Consumo': ['Expediente', 'Materiais de Limpeza', 'Materiais de Higiene', 'Suprimentos cozinha'],
  'Insumo Geral': ['Diversos']
};

const CATEGORIA_KEYS = Object.keys(CATEGORIAS);

const CATALOGO_MAP: Record<string, CatalogoInsumo> = {};
CATALOGO_INSUMOS.forEach(c => {
  CATALOGO_MAP[c.codigo] = c;
});

const CadastroViewInner: React.FC<CadastroViewProps> = ({
  items,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  canEdit,
  canDelete
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [filterFamilia, setFilterFamilia] = useState('');

  const familias = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.familia) set.add(i.familia);
    });
    return [...set].sort();
  }, [items]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterFamilia]);

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
  const [categoria, setCategoria] = useState(CATEGORIA_KEYS[0]);

  const [catalogoQuery, setCatalogoQuery] = useState('');
  const [selectedCatalogo, setSelectedCatalogo] = useState<CatalogoInsumo | null>(null);
  const [showCatalogoDropdown, setShowCatalogoDropdown] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSearchTerm, setImportSearchTerm] = useState('');
  const [importFilterFamilia, setImportFilterFamilia] = useState('');
  const [importCurrentPage, setImportCurrentPage] = useState(1);
  const [selectedInsumos, setSelectedInsumos] = useState<Set<string>>(new Set());
  const [expandedInsumo, setExpandedInsumo] = useState<number | null>(null);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState(CATEGORIA_KEYS[0]);
  const [familiaSelecionada, setFamiliaSelecionada] = useState(CATEGORIAS[CATEGORIA_KEYS[0]][0]);

  const importItemsPerPage = 50;

  const familiasDaCategoria = useMemo(() => {
    return CATEGORIAS[categoriaSelecionada] || [];
  }, [categoriaSelecionada]);

  useEffect(() => {
    const fams = CATEGORIAS[categoriaSelecionada] || [];
    setFamiliaSelecionada(fams.length > 0 ? fams[0] : '');
  }, [categoriaSelecionada]);

  const importDebouncedSearch = useDebounce(importSearchTerm, 300);

  useEffect(() => {
    setImportCurrentPage(1);
  }, [importDebouncedSearch, importFilterFamilia]);

  const importFamilias = useMemo(() => {
    const set = new Set<string>();
    INSUMOS_IMPORTADOS.forEach(i => {
      const catItem = CATALOGO_MAP[i.id.toString()];
      if (catItem && catItem.familia) {
        set.add(catItem.familia);
      } else {
        set.add('Sem Família');
      }
    });
    return [...set].sort();
  }, []);

  const catalogoResults = useMemo(() => {
    if (!catalogoQuery.trim()) return [];
    const q = catalogoQuery.toLowerCase();
    return CATALOGO_INSUMOS.filter(
      c =>
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
    setCategoria(item.categoria || CATEGORIA_KEYS[0]);

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

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      const matchSearch =
        !debouncedSearch ||
        (i.codigo + ' ' + i.nome + ' ' + (i.detalhe || '')).toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchFamilia = !filterFamilia || i.familia === filterFamilia;
      return matchSearch && matchFamilia;
    });
  }, [items, debouncedSearch, filterFamilia]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  const getPageNumbers = useCallback((): number[] => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages]);

  const openNewModal = () => {
    setEditingIndex(null);
    setCodigo('MAT' + (items.length + 1).toString().padStart(3, '0'));
    setNome('');
    setFamilia(FAMILIAS[0]);
    setUnidade('UN');
    setDetalhe('');
    setEstoqueInicial('0');
    setEstoqueMin('10');
    setLocalizacao('');
    setPrecoMedio('0');
    setCategoria(CATEGORIA_KEYS[0]);
    setCatalogoQuery('');
    setSelectedCatalogo(null);
    setShowCatalogoDropdown(false);
    setIsModalOpen(true);
  };

  const openEditModal = useCallback((idx: number) => {
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
    setCategoria(item.categoria || CATEGORIA_KEYS[0]);
    setCatalogoQuery('');
    setSelectedCatalogo(null);
    setShowCatalogoDropdown(false);
    setIsModalOpen(true);
  }, [items]);

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
      categoria: selectedCatalogo?.categoria || categoria,
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

  const obraId: string | undefined = items.length > 0 && items[0].obraId != null ? items[0].obraId : undefined;

  const isVariacaoAlreadyImported = (nome: string, variacao: string, obraId?: string) => {
    const all = getImportedInsumos();
    return all.some(
      r =>
        r.nome.toLowerCase() === nome.toLowerCase() &&
        r.variacao.toLowerCase() === variacao.toLowerCase() &&
        (obraId === undefined || r.obraId === obraId)
    );
  };

  const importModalFilteredItems = useMemo(() => {
    return INSUMOS_IMPORTADOS.filter(i => {
      const matchSearch =
        !importDebouncedSearch ||
        i.nome.toLowerCase().includes(importDebouncedSearch.toLowerCase()) ||
        i.id.toString().includes(importDebouncedSearch) ||
        i.variacoes.some(v => v.toLowerCase().includes(importDebouncedSearch.toLowerCase()));

      let matchFamilia = true;
      if (importFilterFamilia) {
        const catItem = CATALOGO_MAP[i.id.toString()];
        const fam = catItem && catItem.familia ? catItem.familia : 'Sem Família';
        matchFamilia = fam === importFilterFamilia;
      }

      return matchSearch && matchFamilia;
    });
  }, [importDebouncedSearch, importFilterFamilia]);

  const importTotalPages = Math.ceil(importModalFilteredItems.length / importItemsPerPage);
  const importStartIndex = (importCurrentPage - 1) * importItemsPerPage;
  const importEndIndex = importStartIndex + importItemsPerPage;
  const importPaginatedItems = importModalFilteredItems.slice(importStartIndex, importEndIndex);

  const getImportPageNumbers = useCallback((): number[] => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, importCurrentPage - Math.floor(maxVisible / 2));
    let end = Math.min(importTotalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [importCurrentPage, importTotalPages]);

  const isVariacaoBlocked = (insumo: InsumoImportado, variacao: string) => {
    return isInsumoAlreadyInObra(insumo.nome, variacao, obraId ?? '');
  };

  const toggleVariacao = (insumoId: number, variacao: string) => {
    const key = insumoId.toString() + '::' + variacao;
    setSelectedInsumos(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const deselectAll = () => setSelectedInsumos(new Set());

  const handleImportSelected = () => {
    if (selectedInsumos.size === 0) {
      alert('Selecione pelo menos um insumo para importar.');
      return;
    }

    if (!familiaSelecionada) {
      alert('Selecione uma família para os insumos importados.');
      return;
    }

    let count = 0;

    selectedInsumos.forEach(key => {
      const parts = key.split('::');
      const insIdStr = parts[0];
      const variacao = parts[1];
      const insumo = INSUMOS_IMPORTADOS.find(i => i.id === parseInt(insIdStr, 10));

      if (insumo && !isVariacaoAlreadyImported(insumo.nome, variacao, obraId ?? undefined)) {
        const impFamilia = familiaSelecionada;
        const impUnidade = (() => {
          const catItem = CATALOGO_MAP[insumo.id.toString()];
          return catItem && catItem.unidade ? catItem.unidade : 'UN';
        })();

        addImportedInsumo({
          id: insumo.id.toString(),
          nome: insumo.nome,
          variacao,
          codigo: 'IMP' + insumo.id.toString().padStart(4, '0'),
          unidade: impUnidade,
          familia: impFamilia,
          obraId: obraId ?? '0',
          obraNome: ''
        });

        const catalogItem: ItemInsumo = {
          codigo: 'IMP' + insumo.id.toString().padStart(4, '0'),
          nome: insumo.nome,
          familia: impFamilia,
          categoria: categoriaSelecionada,
          unidade: impUnidade,
          detalhe: variacao,
          quantidade: 0,
          estoque_min: 0,
          localizacao: '',
          preco_medio: 0,
          obraId: obraId,
          updatedAt: Date.now()
        };
        onAddItem(catalogItem);

        count++;
      }
    });

    alert(count + ' insumo(s) importado(s) e inserido(s) no catálogo com sucesso!');
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

  const handleDeleteItem = useCallback((idx: number, nome: string) => {
    if (confirm('Excluir ' + nome + '?')) {
      onDeleteItem(idx);
    }
  }, [onDeleteItem]);

  const columns = useMemo<ColumnDef<ItemInsumo>[]>(() => [
    { key: 'codigo', header: 'Código', width: 80, render: (item: ItemInsumo) => (
      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{item.codigo}</span>
    )},
    { key: 'nome', header: 'Nome / Especificação', width: 0, render: (item: ItemInsumo) => (
      <div>
        <div className="font-bold text-slate-800 dark:text-slate-200">{item.nome}</div>
        {item.detalhe && <div className="text-[10px] text-slate-400">{item.detalhe}</div>}
      </div>
    )},
    { key: 'familia', header: 'Família', width: 120, render: (item: ItemInsumo) => (
      <span className="text-slate-600 dark:text-slate-400 font-medium">{item.familia}</span>
    )},
    { key: 'unidade', header: 'Unidade', width: 60, align: 'center' as const, render: (item: ItemInsumo) => (
      <span className="font-bold text-slate-500">{item.unidade}</span>
    )},
    { key: 'saldo', header: 'Saldo Atual', width: 90, align: 'right' as const, render: (item: ItemInsumo) => (
      <span className="font-black text-slate-800 dark:text-slate-200">{formatNumber(getSaldo(item))}</span>
    )},
    { key: 'estoque_min', header: 'Mínimo', width: 70, align: 'right' as const, render: (item: ItemInsumo) => (
      <span className="text-slate-400">{formatNumber(item.estoque_min)}</span>
    )},
    { key: 'status', header: 'Status', width: 80, align: 'center' as const, render: (item: ItemInsumo) => {
      const st = getStatus(item);
      const badgeClass = getStatusBadgeClass(st);
      return <span className={'px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ' + badgeClass}>{st}</span>;
    }},
    { key: 'actions', header: 'Ações', width: 100, align: 'center' as const, render: (item: ItemInsumo) => {
      const idx = items.indexOf(item);
      return (
        <div className="flex items-center justify-center gap-1">
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
              onClick={() => handleDeleteItem(idx, item.nome)}
              className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 hover:bg-red-100"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      );
    }},
  ], [items, canEdit, canDelete, getSaldo, getStatus, formatNumber, openEditModal, handleDeleteItem]);

  return (
    <div className="space-y-6">
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
              {familias.map(f => (
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
            onClick={() => setIsImportModalOpen(true)}
            style={{ backgroundColor: '#4CAF50', color: 'white', padding: '8px 12px', borderRadius: '8px' }}
            className="flex items-center gap-1.5 font-bold text-xs shadow hover:opacity-90 transition-opacity"
          >
            <Upload className="w-4 h-4" />
            <span>Importar Insumos</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-[#C9A358]" />
            <span>Catálogo de Insumos ({filteredItems.length})</span>
          </h3>
          {filteredItems.length > itemsPerPage && (
            <span className="text-xs text-slate-400">
              Exibindo {startIndex + 1}–{Math.min(endIndex, filteredItems.length)} de {filteredItems.length}
            </span>
          )}
        </div>

        <VirtualizedTable<ItemInsumo>
          columns={columns}
          data={paginatedItems}
          rowHeight={44}
          maxHeight={480}
          itemKey={(item, index) => (item.obraId ?? '') + '-' + item.codigo + '-' + index}
          headerClassName="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase font-bold text-[10px]"
        />

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 py-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className={'px-3 py-1 rounded text-sm ' + (currentPage === 1 ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white')}
            >
              &larr;
            </button>

            {currentPage > 3 && (
              <>
                <button
                  onClick={() => setCurrentPage(1)}
                  className="px-3 py-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  1
                </button>
                <span className="text-slate-300 dark:text-slate-600">...</span>
              </>
            )}

            {getPageNumbers().map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={'px-3 py-1 rounded ' + (currentPage === page ? 'font-bold text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white')}
              >
                {page}
              </button>
            ))}

            {currentPage < totalPages - 2 && (
              <>
                <span className="text-slate-300 dark:text-slate-600">...</span>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className="px-3 py-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={'px-3 py-1 rounded text-sm ' + (currentPage === totalPages ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white')}
            >
              &rarr;
            </button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">

            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              {editingIndex === null ? '➕ Cadastrar Novo Insumo' : '✏️ Editar Insumo'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  <BookOpen className="w-3.5 h-3.5 inline mr-1" />
                  Buscar no Catálogo
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
                        <span className="font-mono text-slate-500 mr-2">
                          {selectedCatalogo.codigo}.{d.codigo}
                        </span>
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
                <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Categoria</label>
                <select
                  value={categoria}
                  onChange={e => setCategoria(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                >
                  {CATEGORIA_KEYS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Família</label>
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
                  onClick={() => {
                    setCatalogoQuery('');
                    setSelectedCatalogo(null);
                    setShowCatalogoDropdown(false);
                    setIsModalOpen(false);
                  }}
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

      {isImportModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-6 w-[600px] max-w-[90vw] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-bold mb-4">Importar Insumos</h2>

            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar insumo..."
                    value={importSearchTerm}
                    onChange={e => setImportSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358] text-xs"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs shrink-0">
                  <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
                  <select
                    value={importFilterFamilia}
                    onChange={e => setImportFilterFamilia(e.target.value)}
                    className="bg-transparent text-slate-700 dark:text-slate-200 font-semibold focus:outline-none pr-1 max-w-[150px] truncate"
                  >
                    <option value="">Todas as Famílias</option>
                    {importFamilias.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1 text-[10px]">Categoria</label>
                  <select
                    value={categoriaSelecionada}
                    onChange={e => setCategoriaSelecionada(e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358] text-xs"
                  >
                    {CATEGORIA_KEYS.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="block font-bold text-slate-600 dark:text-slate-300 uppercase mb-1 text-[10px]">Família</label>
                  <select
                    value={familiaSelecionada}
                    onChange={e => setFamiliaSelecionada(e.target.value)}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358] text-xs"
                  >
                    {familiasDaCategoria.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                    {familiasDaCategoria.length === 0 && (
                      <option value="">Sem famílias</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {importModalFilteredItems.length > importItemsPerPage && (
              <div className="flex items-center justify-between mb-3 text-xs text-slate-500 dark:text-slate-400">
                <span>Exibindo {importStartIndex + 1}–{Math.min(importEndIndex, importModalFilteredItems.length)} de {importModalFilteredItems.length}</span>
                <span>Página {importCurrentPage} de {importTotalPages}</span>
              </div>
            )}

            <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg mb-3">
              {importPaginatedItems.map(insumo => (
                <div key={insumo.id + '-' + insumo.nome} className="border-b border-slate-100 dark:border-slate-800 p-2">
                  <div
                    className="flex justify-between items-center cursor-pointer"
                    onClick={() =>
                      setExpandedInsumo(expandedInsumo === insumo.id ? null : insumo.id)
                    }
                  >
                    <span className="font-bold text-sm">{insumo.nome}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {expandedInsumo === insumo.id ? '▲' : '▼'}
                    </span>
                  </div>

                  {expandedInsumo === insumo.id && (
                    <div className="mt-2 pl-2">
                      {insumo.variacoes.map(variacao => {
                        const vKey = insumo.id.toString() + '::' + variacao;
                        const blocked = isVariacaoBlocked(insumo, variacao);
                        const selected = selectedInsumos.has(vKey);

                        return (
                          <div key={vKey} className="flex items-center gap-2 py-1">
                            <input
                              type="checkbox"
                              disabled={blocked}
                              checked={selected}
                              onChange={() => toggleVariacao(insumo.id, variacao)}
                            />
                            <span className={blocked ? 'text-red-500' : ''}>
                              {variacao}
                              {blocked && ' (já importado)'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {importModalFilteredItems.length === 0 && (
                <div className="p-4 text-center text-slate-400 text-xs">
                  Nenhum insumo encontrado.
                </div>
              )}
            </div>

            {importTotalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mb-3">
                <button
                  onClick={() => setImportCurrentPage(importCurrentPage - 1)}
                  disabled={importCurrentPage === 1}
                  className={'px-2.5 py-1 rounded text-xs ' + (importCurrentPage === 1 ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white')}
                >
                  &lt;
                </button>

                {importCurrentPage > 3 && (
                  <>
                    <button
                      onClick={() => setImportCurrentPage(1)}
                      className="px-2.5 py-1 rounded text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                      1
                    </button>
                    <span className="text-slate-300 dark:text-slate-600 text-xs">...</span>
                  </>
                )}

                {getImportPageNumbers().map(page => (
                  <button
                    key={page}
                    onClick={() => setImportCurrentPage(page)}
                    className={'px-2.5 py-1 rounded text-xs ' + (importCurrentPage === page ? 'font-bold text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white')}
                  >
                    {page}
                  </button>
                ))}

                {importCurrentPage < importTotalPages - 2 && (
                  <>
                    <span className="text-slate-300 dark:text-slate-600 text-xs">...</span>
                    <button
                      onClick={() => setImportCurrentPage(importTotalPages)}
                      className="px-2.5 py-1 rounded text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                      {importTotalPages}
                    </button>
                  </>
                )}

                <button
                  onClick={() => setImportCurrentPage(importCurrentPage + 1)}
                  disabled={importCurrentPage === importTotalPages}
                  className={'px-2.5 py-1 rounded text-xs ' + (importCurrentPage === importTotalPages ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white')}
                >
                  &gt;
                </button>
              </div>
            )}

            {selectedInsumos.size > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={deselectAll}
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Limpar Seleção
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedInsumos.size} selecionado(s)
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 bg-slate-300 dark:bg-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-400 dark:hover:bg-slate-600 font-bold"
              >
                Fechar
              </button>

              <button
                onClick={handleImportSelected}
                style={{ backgroundColor: '#4CAF50', color: '#fff' }}
                className="px-4 py-2 rounded-md font-bold hover:opacity-90"
              >
                Importar Selecionados
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const CadastroView = React.memo(CadastroViewInner);