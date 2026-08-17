import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  HardHat, 
  Search, 
  Plus, 
  FileText, 
  Save, 
  Trash2, 
  User, 
  X,
  Building2,
  Download
} from 'lucide-react';
import { ItemInsumo, EpiFornecimento, EpiItem } from '../types';
import { 
  getInsumos, 
  saveInsumos, 
  getEpis, 
  saveEpis, 
  getNextEpiId,
  getActiveObra,
  createEpiDailyBackup,
  getEpiDailyBackups,
  generateEpiFichaPDF,
  generateEpiConsumedReport,
  generateFichaEpiConsolidada
} from '../lib/firestoreStorage';
import { useDebounce } from '../hooks/useDebounce';
import { VirtualizedTable, ColumnDef } from './VirtualizedTable';

interface EpiFornecimentoViewProps {
  obraId: string;
}

const MAX_VISIBLE_EPIS = 2;

const EpiFornecimentoViewInner: React.FC<EpiFornecimentoViewProps> = ({ obraId }) => {
  const [epis, setEpis] = useState<EpiFornecimento[]>([]);
  const [insumos, setInsumos] = useState<ItemInsumo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [backups, setBackups] = useState<{ date: string; count: number }[]>([]);

  // Form state
  const [formNome, setFormNome] = useState('');
  const [formFuncao, setFormFuncao] = useState('');
  const [formSetor, setFormSetor] = useState('Obras');
  const [formTurno, setFormTurno] = useState('Diurno');
  const [formEmpresa, setFormEmpresa] = useState('');
  const [formEpiItems, setFormEpiItems] = useState<EpiItem[]>([]);
  const [selectedEpiInsumoCodigo, setSelectedEpiInsumoCodigo] = useState('');
  const [selectedEpiCa, setSelectedEpiCa] = useState('');
  const [selectedEpiQty, setSelectedEpiQty] = useState(1);

  // Search bar for EPI selection in form
  const [epiSearchTerm, setEpiSearchTerm] = useState('');

  // Ficha de EPIs modal state
  const [showFichaModal, setShowFichaModal] = useState(false);
  const [fichaNome, setFichaNome] = useState('');
  const [fichaEmpresa, setFichaEmpresa] = useState('');
  const [fichaDataInicio, setFichaDataInicio] = useState('');
  const [fichaDataFim, setFichaDataFim] = useState('');

  // Debounced search
  const debouncedSearch = useDebounce(searchTerm, 300);

  const loadEpis = useCallback(() => {
    const data = getEpis();
    setEpis(data);
  }, []);

  const loadInsumos = useCallback(() => {
    const allInsumos = getInsumos();
    const epiInsumos = allInsumos.filter(i => i.familia === 'EPIs' && i.quantidade > 0);
    setInsumos(epiInsumos);
  }, []);

  const loadBackups = useCallback(() => {
    const bks = getEpiDailyBackups();
    setBackups(bks);
  }, []);

  useEffect(() => {
    loadEpis();
    loadInsumos();
    loadBackups();
  }, [loadEpis, loadInsumos, loadBackups]);

  // Memoized filtered list with debounced search
  const filteredEpis = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase();
    if (!searchLower) return epis;
    return epis.filter(ep => 
      ep.funcionarioNome.toLowerCase().includes(searchLower) ||
      ep.funcionarioFuncao.toLowerCase().includes(searchLower)
    );
  }, [epis, debouncedSearch]);

  // Filtered insumos for form search bar
  const filteredFormInsumos = useMemo(() => {
    if (!epiSearchTerm.trim()) return insumos;
    const lower = epiSearchTerm.toLowerCase();
    return insumos.filter(i => i.nome.toLowerCase().includes(lower));
  }, [insumos, epiSearchTerm]);

  // Memoized stats
  const stats = useMemo(() => ({
    totalEntregas: epis.length,
    totalEpiItens: epis.reduce((sum, e) => sum + e.epiItens.length, 0),
  }), [epis]);

  const addEpiItem = useCallback(() => {
    if (!selectedEpiInsumoCodigo) return;
    const ins = insumos.find(i => i.codigo === selectedEpiInsumoCodigo);
    if (!ins) return;

    const newItem: EpiItem = {
      insumoId: ins.id || '',
      insumoNome: ins.nome,
      insumoCodigo: ins.codigo,
      numeroCA: selectedEpiCa,
      quantidade: selectedEpiQty
    };

    setFormEpiItems(prev => [...prev, newItem]);
    setSelectedEpiInsumoCodigo('');
    setSelectedEpiCa('');
    setSelectedEpiQty(1);
  }, [selectedEpiInsumoCodigo, selectedEpiCa, selectedEpiQty, insumos]);

  const removeEpiItem = useCallback((idx: number) => {
    setFormEpiItems(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!formNome || !formFuncao || formEpiItems.length === 0) return;

    const activeObra = getActiveObra();

    const newEpi: EpiFornecimento = {
      id: getNextEpiId(),
      funcionarioNome: formNome,
      funcionarioFuncao: formFuncao,
      funcionarioSetor: formSetor,
      funcionarioTurno: formTurno,
      empresa: formEmpresa.trim() || undefined,
      dataEntrega: new Date().toISOString().slice(0, 10),
      epiItens: formEpiItems,
      obraId: activeObra ? String(activeObra.id) : '',
      obraNome: activeObra ? activeObra.nome : '-'
    };

    // Deduct from inventory
    const allInsumos = getInsumos();
    formEpiItems.forEach(item => {
      const idx = allInsumos.findIndex(i => i.codigo === item.insumoCodigo);
      if (idx >= 0 && allInsumos[idx].quantidade >= item.quantidade) {
        allInsumos[idx].quantidade -= item.quantidade;
      }
    });
    saveInsumos(allInsumos);

    // Save EPI record
    const currentEpis = getEpis();
    currentEpis.push(newEpi);
    saveEpis(currentEpis);

    // Auto-backup
    createEpiDailyBackup();

    loadEpis();
    loadInsumos();
    loadBackups();
    setShowForm(false);
    resetForm();
  }, [formNome, formFuncao, formEmpresa, formEpiItems, formSetor, formTurno, loadEpis, loadInsumos, loadBackups]);

  const resetForm = useCallback(() => {
    setFormNome('');
    setFormFuncao('');
    setFormSetor('Obras');
    setFormTurno('Diurno');
    setFormEmpresa('');
    setFormEpiItems([]);
    setSelectedEpiInsumoCodigo('');
    setSelectedEpiCa('');
    setSelectedEpiQty(1);
    setEpiSearchTerm('');
  }, []);

  const handleDeleteEpi = useCallback((epiId: string) => {
    const currentEpis = getEpis();
    const filtered = currentEpis.filter(e => e.id !== epiId);
    saveEpis(filtered);
    loadEpis();
  }, [loadEpis]);

  const handleGenerateFicha = useCallback((epi: EpiFornecimento) => {
    generateEpiFichaPDF(epi);
  }, []);

  const handleOpenFichaModal = useCallback(() => {
    // Pre-fill with first filtered name if available
    if (filteredEpis.length > 0) {
      setFichaNome(filteredEpis[0].funcionarioNome);
      setFichaEmpresa(filteredEpis[0].empresa || '');
    }
    setShowFichaModal(true);
  }, [filteredEpis]);

  const handleGenerateFichaConsolidada = useCallback(() => {
    if (!fichaNome.trim()) {
      alert('Preencha o nome do funcionário.');
      return;
    }

    const allEpis = getEpis();
    // Filter by nome, empresa, and date range
    let filtered = allEpis.filter(e => 
      e.funcionarioNome.toLowerCase() === fichaNome.trim().toLowerCase()
    );

    if (fichaEmpresa.trim()) {
      filtered = filtered.filter(e => 
        (e.empresa || '').toLowerCase() === fichaEmpresa.trim().toLowerCase()
      );
    }

    if (fichaDataInicio) {
      filtered = filtered.filter(e => e.dataEntrega >= fichaDataInicio);
    }
    if (fichaDataFim) {
      filtered = filtered.filter(e => e.dataEntrega <= fichaDataFim);
    }

    if (filtered.length === 0) {
      alert('Nenhuma entrega encontrada para os filtros informados.');
      return;
    }

    generateFichaEpiConsolidada(filtered, fichaNome.trim(), fichaEmpresa.trim(), fichaDataInicio, fichaDataFim);
    setShowFichaModal(false);
  }, [fichaNome, fichaEmpresa, fichaDataInicio, fichaDataFim]);

  const handleGenerateConsumedReport = useCallback(() => {
    const allEpis = getEpis();
    const allItems = getInsumos();
    generateEpiConsumedReport(allEpis, allItems);
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
  }, []);

  // Column definitions for VirtualizedTable
  const columns = useMemo<ColumnDef<EpiFornecimento>[]>(() => [
    {
      key: 'funcionarioNome',
      header: 'Funcionário',
      width: 150,
      render: (epi) => (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-[#C9A358]" />
          <span className="font-medium text-slate-800 dark:text-slate-200">{epi.funcionarioNome}</span>
        </div>
      ),
    },
    {
      key: 'funcionarioFuncao',
      header: 'Função',
      width: 110,
      render: (epi) => <span className="text-slate-600 dark:text-slate-400">{epi.funcionarioFuncao}</span>,
    },
    {
      key: 'empresa',
      header: 'Empresa',
      width: 120,
      render: (epi) => (
        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
          {epi.empresa && <Building2 className="w-3.5 h-3.5" />}
          {epi.empresa || '-'}
        </div>
      ),
    },
    {
      key: 'funcionarioSetor',
      header: 'Setor',
      width: 90,
      render: (epi) => <span className="text-slate-600 dark:text-slate-400">{epi.funcionarioSetor}</span>,
    },
    {
      key: 'funcionarioTurno',
      header: 'Turno',
      width: 80,
      render: (epi) => <span className="text-slate-600 dark:text-slate-400">{epi.funcionarioTurno}</span>,
    },
    {
      key: 'dataEntrega',
      header: 'Data Entrega',
      width: 110,
      render: (epi) => <span className="text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDate(epi.dataEntrega)}</span>,
    },
    {
      key: 'epiItens',
      header: 'EPIs Entregues',
      width: 240,
      render: (epi) => {
        const items = epi.epiItens;
        const visible = items.slice(0, MAX_VISIBLE_EPIS);
        const remaining = items.length - MAX_VISIBLE_EPIS;
        return (
          <div className="space-y-0.5">
            {visible.map((item, idx) => (
              <div key={idx} className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                <HardHat className="w-3 h-3 inline mr-1 text-[#C9A358]" />
                {item.insumoNome} {item.numeroCA ? '(C.A. ' + item.numeroCA + ')' : ''} × {item.quantidade}
              </div>
            ))}
            {remaining > 0 && (
              <div className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                +{remaining} mais
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'acoes',
      header: 'Ações',
      width: 120,
      align: 'center',
      render: (epi) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleGenerateFicha(epi); }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            title="Gerar Ficha EPI"
          >
            <FileText className="w-3.5 h-3.5" />
            Ficha
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteEpi(epi.id); }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ], [formatDate, handleGenerateFicha, handleDeleteEpi]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <HardHat className="w-5 h-5 text-[#C9A358]" />
            Fornecimento de EPIs
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Registro de entrega de Equipamentos de Proteção Individual
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleOpenFichaModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 font-semibold text-sm transition-all hover:opacity-90"
          >
            <FileText className="w-4 h-4" />
            Ficha de EPIs
          </button>
          <button
            onClick={handleGenerateConsumedReport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 font-semibold text-sm transition-all hover:opacity-90"
          >
            <FileText className="w-4 h-4" />
            Relatório Consumo
          </button>
          <button
            onClick={() => { setShowForm(true); resetForm(); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90"
            style={{ backgroundColor: '#4CAF50' }}
          >
            <Plus className="w-4 h-4" />
            Nova Entrega
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou função..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
        />
      </div>

      {/* New EPI Form */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#C9A358]" />
            Registrar Entrega de EPI
          </h3>

          {/* Employee Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nome do Funcionário *</label>
              <input
                type="text"
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Nome completo"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Função *</label>
              <input
                type="text"
                value={formFuncao}
                onChange={(e) => setFormFuncao(e.target.value)}
                placeholder="Ex: Pedreiro, Eletricista"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Empresa</label>
              <input
                type="text"
                value={formEmpresa}
                onChange={(e) => setFormEmpresa(e.target.value)}
                placeholder="Nome da empresa (opcional)"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Setor</label>
              <input
                type="text"
                value={formSetor}
                onChange={(e) => setFormSetor(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Turno</label>
              <select
                value={formTurno}
                onChange={(e) => setFormTurno(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              >
                <option value="Diurno">Diurno</option>
                <option value="Noturno">Noturno</option>
              </select>
            </div>
          </div>

          {/* EPI Items Selection */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Adicionar EPIs</h4>

            {/* Search bar for EPIs */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar EPI por nome..."
                value={epiSearchTerm}
                onChange={(e) => setEpiSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">EPI *</label>
                <select
                  value={selectedEpiInsumoCodigo}
                  onChange={(e) => {
                    setSelectedEpiInsumoCodigo(e.target.value);
                    // Auto-fill C.A. from ItemInsumo
                    const sel = insumos.find(i => i.codigo === e.target.value);
                    if (sel && sel.caNumero) {
                      setSelectedEpiCa(sel.caNumero);
                    } else {
                      setSelectedEpiCa('');
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                >
                  <option value="">Selecione...</option>
                  {filteredFormInsumos.map(i => (
                    <option key={i.codigo} value={i.codigo}>
                      {i.nome} — Estq: {i.quantidade}{i.caNumero ? ' (C.A. ' + i.caNumero + ')' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nº C.A.</label>
                <input
                  type="text"
                  value={selectedEpiCa}
                  onChange={(e) => setSelectedEpiCa(e.target.value)}
                  placeholder="Certificado Aprovação"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Qtd</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={selectedEpiQty}
                    onChange={(e) => setSelectedEpiQty(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  />
                  <button
                    onClick={addEpiItem}
                    disabled={!selectedEpiInsumoCodigo}
                    className="px-3 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-40"
                    style={{ backgroundColor: '#4CAF50' }}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Selected EPI Items */}
            {formEpiItems.length > 0 && (
              <div className="space-y-2">
                {formEpiItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                    <HardHat className="w-4 h-4 text-[#C9A358]" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1">{item.insumoNome}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">C.A.: {item.numeroCA || 'N/A'}</span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Qtd: {item.quantidade}</span>
                    <button onClick={() => removeEpiItem(idx)} className="text-red-500 hover:text-red-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={handleSubmit}
              disabled={!formNome || !formFuncao || formEpiItems.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: '#4CAF50' }}
            >
              <Save className="w-4 h-4" />
              Registrar Entrega
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

      {/* Ficha de EPIs Modal */}
      {showFichaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#C9A358]" />
                Ficha de EPIs
              </h3>
              <button
                onClick={() => setShowFichaModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Preencha os filtros para gerar a ficha consolidada de entrega de EPIs.
            </p>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nome do Funcionário *</label>
                <input
                  type="text"
                  value={fichaNome}
                  onChange={(e) => setFichaNome(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Empresa</label>
                <input
                  type="text"
                  value={fichaEmpresa}
                  onChange={(e) => setFichaEmpresa(e.target.value)}
                  placeholder="Filtrar por empresa (opcional)"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Data Inicial</label>
                  <input
                    type="date"
                    value={fichaDataInicio}
                    onChange={(e) => setFichaDataInicio(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Data Final</label>
                  <input
                    type="date"
                    value={fichaDataFim}
                    onChange={(e) => setFichaDataFim(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleGenerateFichaConsolidada}
                disabled={!fichaNome.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: '#4CAF50' }}
              >
                <Download className="w-4 h-4" />
                Gerar Ficha
              </button>
              <button
                onClick={() => setShowFichaModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EPI Records Table — Virtualizada */}
      <VirtualizedTable<EpiFornecimento>
        columns={columns}
        data={filteredEpis}
        rowHeight={56}
        maxHeight={480}
        emptyMessage="Nenhuma entrega de EPI registrada"
        itemKey={(epi) => epi.id}
      />

      {/* Stats & Backups */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.totalEntregas}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Entregas Registradas</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center">
          <p className="text-2xl font-bold text-[#C9A358]">{stats.totalEpiItens}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">EPIs Distribuídos</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1">
            <Save className="w-3.5 h-3.5" /> Backups Diários
          </p>
          {backups.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum backup ainda</p>
          ) : (
            <div className="space-y-1">
              {backups.slice(0, 3).map((b, i) => (
                <p key={i} className="text-xs text-slate-600 dark:text-slate-400">
                  {b.date} — {b.count} registros
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const EpiFornecimentoView = React.memo(EpiFornecimentoViewInner);