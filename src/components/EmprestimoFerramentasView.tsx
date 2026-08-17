import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Wrench, 
  Search, 
  Plus, 
  RotateCcw, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Shield, 
  User,
  Calendar
} from 'lucide-react';
import { ItemInsumo, EmprestimoFerramenta } from '../types';
import { Building2 } from 'lucide-react';
import { getInsumos, saveInsumos, getEmprestimos, saveEmprestimos, getNextEmprestimoId, getActiveObra } from '../lib/firestoreStorage';
import { useDebounce } from '../hooks/useDebounce';
import { VirtualizedTable, ColumnDef } from './VirtualizedTable';

interface EmprestimoFerramentasViewProps {
  obraId: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  'emprestado': { label: 'Ativo', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  'atrasado': { label: 'Vencido', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  'proximo-vencimento': { label: 'Próx. Vencimento', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  'devolvido': { label: 'Devolvido', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
};

const EmprestimoFerramentasViewInner: React.FC<EmprestimoFerramentasViewProps> = ({ obraId }) => {
  const [emprestimos, setEmprestimos] = useState<EmprestimoFerramenta[]>([]);
  const [insumos, setInsumos] = useState<ItemInsumo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [adminOverride, setAdminOverride] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [pendingLoan, setPendingLoan] = useState<EmprestimoFerramenta | null>(null);
  const [now, setNow] = useState(new Date());

  // Form state
  const [formInsumoCodigo, setFormInsumoCodigo] = useState('');
  const [formRetiradoPor, setFormRetiradoPor] = useState('');
  const [formFuncaoRetirante, setFormFuncaoRetirante] = useState('');
  const [formDataRetirada, setFormDataRetirada] = useState('');
  const [formHoraRetirada, setFormHoraRetirada] = useState('');
  const [formEmpresa, setFormEmpresa] = useState('');

  // Debounced search — evita recalcular filtro a cada keystroke
  const debouncedSearch = useDebounce(searchTerm, 300);

  const loadEmprestimos = useCallback(() => {
    const data = getEmprestimos();
    setEmprestimos(data);
  }, []);

  const loadInsumos = useCallback(() => {
    const allInsumos = getInsumos();
    const ferramentasEpi = allInsumos.filter(i => 
      i.familia === 'Ferramentas' || (i.familia === 'EPIs' && (i.nome === 'Cinto de Segurança' || i.nome === 'Talabarte'))
    );
    setInsumos(ferramentasEpi);
  }, []);

  useEffect(() => {
    loadEmprestimos();
    loadInsumos();
  }, [loadEmprestimos, loadInsumos]);

  // Timer for 16:30 notification check and status updates
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Memoized status map — compute getLoanStatus ONCE per emprestimo per tick
  const statusMap = useMemo(() => {
    const m = new Map<string, string>();
    emprestimos.forEach(emp => {
      if (emp.status === 'devolvido') {
        m.set(emp.id, 'devolvido');
      } else {
        const previsao = new Date(emp.dataPrevistaDevolucao + 'T' + emp.horaPrevistaDevolucao);
        const diffMs = previsao.getTime() - now.getTime();
        const diffH = diffMs / (1000 * 60 * 60);
        if (diffH < 0) m.set(emp.id, 'atrasado');
        else if (diffH <= 24) m.set(emp.id, 'proximo-vencimento');
        else m.set(emp.id, 'emprestado');
      }
    });
    return m;
  }, [emprestimos, now]);

  const is16h30Notification = useCallback((): boolean => {
    return now.getHours() === 16 && now.getMinutes() >= 25 && now.getMinutes() <= 35;
  }, [now]);

  // Memoized filtered lists using statusMap + debouncedSearch
  const overdueLoans = useMemo(
    () => emprestimos.filter(e => e.status !== 'devolvido' && statusMap.get(e.id) === 'atrasado'),
    [emprestimos, statusMap]
  );

  const nearDueLoans = useMemo(
    () => emprestimos.filter(e => e.status !== 'devolvido' && statusMap.get(e.id) === 'proximo-vencimento'),
    [emprestimos, statusMap]
  );

  const filteredEmprestimos = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase();
    return emprestimos.filter(emp => {
      const matchesSearch = 
        emp.insumoNome.toLowerCase().includes(searchLower) ||
        emp.retiradoPor.toLowerCase().includes(searchLower);
      const status = statusMap.get(emp.id) || 'emprestado';
      const matchesFilter = filterStatus === 'todos' || status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [emprestimos, debouncedSearch, filterStatus, statusMap]);

  const selectedInsumo = useMemo(
    () => insumos.find(i => i.codigo === formInsumoCodigo),
    [insumos, formInsumoCodigo]
  );

  const calculatePrevisao = useCallback((data: string, hora: string): { data: string; hora: string } => {
    const dt = new Date(data + 'T' + hora);
    dt.setHours(dt.getHours() + 48);
    return {
      data: dt.toISOString().slice(0, 10),
      hora: dt.toTimeString().slice(0, 5)
    };
  }, []);

  const handleAdminCheck = useCallback(() => {
    if (adminPassword === '1307') {
      setAdminOverride(true);
      setShowAdminPrompt(false);
      if (pendingLoan) {
        saveLoan(pendingLoan);
        setPendingLoan(null);
      }
    } else {
      setAdminPassword('');
    }
  }, [adminPassword, pendingLoan]);

  const saveLoan = useCallback((loan: EmprestimoFerramenta) => {
    // Deduct from inventory
    const allInsumos = getInsumos();
    const idx = allInsumos.findIndex(i => i.codigo === loan.insumoCodigo);
    if (idx >= 0 && allInsumos[idx].quantidade >= loan.quantidade) {
      allInsumos[idx].quantidade -= loan.quantidade;
      saveInsumos(allInsumos);
    }

    const currentEmprestimos = getEmprestimos();
    currentEmprestimos.push(loan);
    saveEmprestimos(currentEmprestimos);
    loadEmprestimos();
    loadInsumos();
    setShowForm(false);
    resetForm();
  }, [loadEmprestimos, loadInsumos]);

  const handleSubmit = useCallback(() => {
    if (!formInsumoCodigo || !formRetiradoPor || !formFuncaoRetirante || !formDataRetirada || !formHoraRetirada) {
      return;
    }

    // Empresa obrigatória quando retirante é Terceiro (case-insensitive)
    const isTerceiro = formFuncaoRetirante.toLowerCase().includes('terceiro');
    if (isTerceiro && !formEmpresa.trim()) {
      alert('Campo "Empresa" é obrigatório quando o retirante é Terceiro.');
      return;
    }

    if (!selectedInsumo || selectedInsumo.quantidade < 1) {
      return;
    }

    const previsao = calculatePrevisao(formDataRetirada, formHoraRetirada);
    const previsaoDate = new Date(previsao.data + 'T' + previsao.hora);
    const isOverdue48 = previsaoDate < new Date();

    const activeObra = getActiveObra();

    const newLoan: EmprestimoFerramenta = {
      id: getNextEmprestimoId(),
      insumoId: selectedInsumo.id || '',
      insumoNome: selectedInsumo.nome,
      insumoCodigo: selectedInsumo.codigo,
      quantidade: 1,
      retiradoPor: formRetiradoPor,
      funcaoRetirante: formFuncaoRetirante,
      empresa: isTerceiro ? formEmpresa.trim() : (formEmpresa.trim() || undefined),
      dataRetirada: formDataRetirada,
      horaRetirada: formHoraRetirada,
      dataPrevistaDevolucao: previsao.data,
      horaPrevistaDevolucao: previsao.hora,
      status: 'emprestado',
      obraId: activeObra ? String(activeObra.id) : '',
      obraNome: activeObra ? activeObra.nome : '-',
      isAdminOverride: false
    };

    // If 48h from now would be in the past, need admin override
    if (isOverdue48 && !adminOverride) {
      setPendingLoan(newLoan);
      setShowAdminPrompt(true);
      return;
    }

    if (adminOverride) {
      newLoan.isAdminOverride = true;
    }

    saveLoan(newLoan);
  }, [formInsumoCodigo, formRetiradoPor, formFuncaoRetirante, formEmpresa, formDataRetirada, formHoraRetirada, selectedInsumo, adminOverride, calculatePrevisao, saveLoan]);

  const handleReturn = useCallback((empId: string) => {
    const emp = emprestimos.find(e => e.id === empId);
    if (!emp) return;

    // Restore inventory
    const allInsumos = getInsumos();
    const idx = allInsumos.findIndex(i => i.codigo === emp.insumoCodigo);
    if (idx >= 0) {
      allInsumos[idx].quantidade += emp.quantidade;
      saveInsumos(allInsumos);
    }

    // Update emprestimo status
    const currentEmprestimos = getEmprestimos();
    const empIdx = currentEmprestimos.findIndex(e => e.id === empId);
    if (empIdx >= 0) {
      currentEmprestimos[empIdx].status = 'devolvido';
      currentEmprestimos[empIdx].dataDevolucao = new Date().toISOString().slice(0, 10);
      currentEmprestimos[empIdx].horaDevolucao = new Date().toTimeString().slice(0, 5);
      saveEmprestimos(currentEmprestimos);
    }

    loadEmprestimos();
    loadInsumos();
  }, [emprestimos, loadEmprestimos, loadInsumos]);

  const resetForm = useCallback(() => {
    setFormInsumoCodigo('');
    setFormRetiradoPor('');
    setFormFuncaoRetirante('');
    setFormEmpresa('');
    setFormDataRetirada('');
    setFormHoraRetirada('');
    setAdminOverride(false);
  }, []);

  const formatDate = useCallback((dateStr: string, timeStr?: string) => {
    const d = new Date(dateStr + 'T' + (timeStr || '00:00'));
    return d.toLocaleDateString('pt-BR') + (timeStr ? ' ' + timeStr : '');
  }, []);

  // Column definitions for VirtualizedTable
  const columns = useMemo<ColumnDef<EmprestimoFerramenta>[]>(() => [
    {
      key: 'insumoNome',
      header: 'Ferramenta/EPI',
      width: 200,
      render: (emp) => (
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-[#C9A358]" />
          <span className="font-medium text-slate-800 dark:text-slate-200">{emp.insumoNome}</span>
        </div>
      ),
    },
    {
      key: 'retiradoPor',
      header: 'Retirado Por',
      width: 160,
      render: (emp) => (
        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
          <User className="w-3.5 h-3.5" />
          {emp.retiradoPor}
        </div>
      ),
    },
    {
      key: 'funcaoRetirante',
      header: 'Função',
      width: 120,
      render: (emp) => <span className="text-slate-600 dark:text-slate-400">{emp.funcaoRetirante}</span>,
    },
    {
      key: 'empresa',
      header: 'Empresa',
      width: 130,
      render: (emp) => (
        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
          {emp.empresa && <Building2 className="w-3.5 h-3.5" />}
          {emp.empresa || '-'}
        </div>
      ),
    },
    {
      key: 'dataRetirada',
      header: 'Data Retirada',
      width: 140,
      render: (emp) => <span className="text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDate(emp.dataRetirada, emp.horaRetirada)}</span>,
    },
    {
      key: 'dataPrevistaDevolucao',
      header: 'Previsão Devolução',
      width: 160,
      render: (emp) => <span className="text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDate(emp.dataPrevistaDevolucao, emp.horaPrevistaDevolucao)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: 180,
      render: (emp) => {
        const status = statusMap.get(emp.id) || 'emprestado';
        const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG['emprestado'];
        const isOverdue = status === 'atrasado';
        const isNearDue = status === 'proximo-vencimento';
        return (
          <>
            <span className={'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ' + statusCfg.bg + ' ' + statusCfg.color}>
              {isOverdue && <XCircle className="w-3.5 h-3.5" />}
              {isNearDue && <AlertTriangle className="w-3.5 h-3.5" />}
              {status === 'emprestado' && <Clock className="w-3.5 h-3.5" />}
              {status === 'devolvido' && <CheckCircle className="w-3.5 h-3.5" />}
              {statusCfg.label}
            </span>
            {emp.isAdminOverride && (
              <span className="ml-1 text-[10px] text-yellow-600 dark:text-yellow-400" title="Override administrativo">★</span>
            )}
          </>
        );
      },
    },
    {
      key: 'acoes',
      header: 'Ações',
      width: 110,
      align: 'center',
      render: (emp) => (
        emp.status !== 'devolvido' ? (
          <button
            onClick={(e) => { e.stopPropagation(); handleReturn(emp.id); }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-[#4CAF50] bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Devolver
          </button>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
        )
      ),
    },
  ], [statusMap, formatDate, handleReturn]);

  // Row class for overdue / near-due highlighting
  const rowClassName = useCallback((emp: EmprestimoFerramenta) => {
    const status = statusMap.get(emp.id) || 'emprestado';
    if (status === 'atrasado') return 'bg-red-50 dark:bg-red-900/10';
    if (status === 'proximo-vencimento') return 'bg-yellow-50 dark:bg-yellow-900/10';
    return '';
  }, [statusMap]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-[#C9A358]" />
            Empréstimo de Ferramentas
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Controle de empréstimos com devolução prevista em 48h
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); resetForm(); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90"
          style={{ backgroundColor: '#4CAF50' }}
        >
          <Plus className="w-4 h-4" />
          Novo Empréstimo
        </button>
      </div>

      {/* 16:30 Notification Banner */}
      {is16h30Notification() && (overdueLoans.length > 0 || nearDueLoans.length > 0) && (
        <div className="rounded-xl p-4 border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <span className="font-bold text-yellow-800 dark:text-yellow-300">Aviso 16:30 — Verificação de Devoluções</span>
          </div>
          {overdueLoans.length > 0 && (
            <p className="text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              {overdueLoans.length} ferramenta(s) com devolução vencida!
            </p>
          )}
          {nearDueLoans.length > 0 && (
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              <Clock className="w-4 h-4 inline mr-1" />
              {nearDueLoans.length} ferramenta(s) próximas do vencimento (24h).
            </p>
          )}
        </div>
      )}

      {/* Overdue Alert */}
      {overdueLoans.length > 0 && !is16h30Notification() && (
        <div className="rounded-xl p-4 border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="font-bold text-red-800 dark:text-red-300">
              {overdueLoans.length} empréstimo(s) vencido(s)!
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por ferramenta ou pessoa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
        >
          <option value="todos">Todos</option>
          <option value="emprestado">Ativo</option>
          <option value="proximo-vencimento">Próx. Vencimento</option>
          <option value="atrasado">Vencido</option>
          <option value="devolvido">Devolvido</option>
        </select>
      </div>

      {/* Admin Password Prompt Modal */}
      {showAdminPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-yellow-500" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Autorização Administrativa</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              O prazo de 48h já foi ultrapassado. É necessária autorização administrativa para prosseguir com o empréstimo.
            </p>
            <input
              type="password"
              placeholder="Senha do administrador"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A358] mb-4"
              onKeyDown={(e) => e.key === 'Enter' && handleAdminCheck()}
            />
            <div className="flex gap-3">
              <button
                onClick={handleAdminCheck}
                className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm"
                style={{ backgroundColor: '#4CAF50' }}
              >
                Autorizar
              </button>
              <button
                onClick={() => { setShowAdminPrompt(false); setPendingLoan(null); setAdminPassword(''); }}
                className="flex-1 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Loan Form */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#C9A358]" />
            Novo Empréstimo
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Ferramenta / EPI *</label>
              <select
                value={formInsumoCodigo}
                onChange={(e) => setFormInsumoCodigo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              >
                <option value="">Selecione...</option>
                {insumos.filter(i => i.quantidade > 0).map(i => (
                  <option key={i.codigo} value={i.codigo}>
                    {i.nome} — Estq: {i.quantidade} {i.unidade}
                  </option>
                ))}
              </select>
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
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Função *</label>
              <input
                type="text"
                value={formFuncaoRetirante}
                onChange={(e) => setFormFuncaoRetirante(e.target.value)}
                placeholder="Ex: Pedreiro, Eletricista"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              />
            </div>
            {formFuncaoRetirante.toLowerCase().includes('terceiro') && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Empresa *</label>
                <input
                  type="text"
                  value={formEmpresa}
                  onChange={(e) => setFormEmpresa(e.target.value)}
                  placeholder="Nome da empresa"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                />
              </div>
            )}
            {!formFuncaoRetirante.toLowerCase().includes('terceiro') && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Empresa</label>
                <input
                  type="text"
                  value={formEmpresa}
                  onChange={(e) => setFormEmpresa(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Data Retirada *</label>
              <input
                type="date"
                value={formDataRetirada}
                onChange={(e) => setFormDataRetirada(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Hora Retirada *</label>
              <input
                type="time"
                value={formHoraRetirada}
                onChange={(e) => setFormHoraRetirada(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              />
            </div>
            {formDataRetirada && formHoraRetirada && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Previsão devolução: {(() => {
                    const p = calculatePrevisao(formDataRetirada, formHoraRetirada);
                    return formatDate(p.data, p.hora);
                  })()}
                </span>
              </div>
            )}
          </div>
          {adminOverride && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700">
              <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 flex items-center gap-1">
                <Shield className="w-4 h-4" /> Override administrativo ativo
              </span>
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <button
              onClick={handleSubmit}
              disabled={!formInsumoCodigo || !formRetiradoPor || !formFuncaoRetirante || !formDataRetirada || !formHoraRetirada || (formFuncaoRetirante.toLowerCase().includes('terceiro') && !formEmpresa.trim())}
              className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: '#4CAF50' }}
            >
              Registrar Empréstimo
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

      {/* Loans Table — Virtualizada */}
      <VirtualizedTable<EmprestimoFerramenta>
        columns={columns}
        data={filteredEmprestimos}
        rowHeight={48}
        maxHeight={480}
        emptyMessage="Nenhum empréstimo registrado"
        itemKey={(emp) => emp.id}
        rowClassName={rowClassName}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Ativos', count: emprestimos.filter(e => e.status !== 'devolvido' && statusMap.get(e.id) === 'emprestado').length, color: 'text-blue-600' },
          { label: 'Próx. Vencimento', count: nearDueLoans.length, color: 'text-yellow-600' },
          { label: 'Vencidos', count: overdueLoans.length, color: 'text-red-600' },
          { label: 'Devolvidos', count: emprestimos.filter(e => e.status === 'devolvido').length, color: 'text-green-600' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center">
            <p className={'text-2xl font-bold ' + stat.color}>{stat.count}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export const EmprestimoFerramentasView = React.memo(EmprestimoFerramentasViewInner);
