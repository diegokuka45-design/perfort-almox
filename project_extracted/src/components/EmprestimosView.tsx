import { useState, useEffect, useMemo } from 'react';
import {
  Wrench, ArrowLeftRight, Clock, AlertTriangle, CheckCircle, XCircle,
  Users, UserCheck, Zap, FileText, Plus, Search, Trash2, Lock, Unlock,
  Bell, ChevronDown, ChevronUp, Filter, Download
} from 'lucide-react';
import { FerramentaEmprestimo, ItemInsumo, RelatorioNaoDevolucao, ExtensaoEnergia, StatusEmprestimo, Obra } from '../types';
import {
  getEmprestimos, saveEmprestimos, getTenantData,
  hasPendenciaMaior48h, getPendentesMaior48h, gerarRelatorioNaoDevolucao,
  getRelatoriosNaoDevolucao, getExtensoesEnergia, addExtensaoEnergia,
  deleteExtensaoEnergia, updateExtensaoEnergia, getProximaSequenciaExtensao,
  devolverEmprestimo, addEmprestimo, deleteEmprestimo, auditLog
} from '../lib/storage';
import { FAMILIAS } from '../data/mockData';

type SubAba = 'emprestimos' | 'relatorios' | 'extensoes';
type TipoDestino = 'Funcionário' | 'Terceiros';
type AbaEmprestimo = 'novo' | 'ativos' | 'historico';

interface EmprestimosViewProps {
  activeObra: Obra | null;
}

export function EmprestimosView({ activeObra }: EmprestimosViewProps) {
  const [subAba, setSubAba] = useState<SubAba>('emprestimos');
  const [abaEmp, setAbaEmp] = useState<AbaEmprestimo>('ativos');
  const [tipoDestino, setTipoDestino] = useState<TipoDestino>('Funcionário');
  const [emprestimos, setEmprestimos] = useState<FerramentaEmprestimo[]>([]);
  const [relatorios, setRelatorios] = useState<RelatorioNaoDevolucao[]>([]);
  const [extensoes, setExtensoes] = useState<ExtensaoEnergia[]>([]);
  const [itens, setItens] = useState<ItemInsumo[]>([]);
  const [searchFerramenta, setSearchFerramenta] = useState('');
  const [selectedFerramentas, setSelectedFerramentas] = useState<ItemInsumo[]>([]);
  const [destinoNome, setDestinoNome] = useState('');
  const [destinoLocal, setDestinoLocal] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');
  const [senhaError, setSenhaError] = useState('');
  const [notificacaoAtiva, setNotificacaoAtiva] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<StatusEmprestimo | 'Todos'>('Todos');
  const [buscaEmprestimo, setBuscaEmprestimo] = useState('');
  const [showRelatorioPendencias, setShowRelatorioPendencias] = useState(false);
  const [showRelatorioEmprestadas, setShowRelatorioEmprestadas] = useState(false);
  const [extForm, setExtForm] = useState({ nome: '', local: '', descricao: '' });
  const [extEditando, setExtEditando] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mostrarAtraso24h, setMostrarAtraso24h] = useState(false);

  const ferramentas = useMemo(() => {
    return itens.filter(i => i.familia === 'Ferramentas');
  }, [itens]);

  const ferramentasFiltradas = useMemo(() => {
    if (!searchFerramenta.trim()) return ferramentas;
    const q = searchFerramenta.toLowerCase();
    return ferramentas.filter(f =>
      f.nome.toLowerCase().includes(q) ||
      f.codigo.toLowerCase().includes(q) ||
      (f.detalhe || '').toLowerCase().includes(q)
    );
  }, [ferramentas, searchFerramenta]);

  const reload = () => {
    setEmprestimos(getEmprestimos());
    setRelatorios(getRelatoriosNaoDevolucao());
    setExtensoes(getExtensoesEnergia());
    const data = getTenantData();
    setItens(data.items || []);
  };

  useEffect(() => {
    reload();
  }, []);

  // Verificação de notificação 16:30 (simulação local)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hora = now.getHours();
      const min = now.getMinutes();
      // Verifica aproximadamente 16:30
      if (hora === 16 && min === 30) {
        const rel = gerarRelatorioNaoDevolucao();
        if (rel) {
          setNotificacaoAtiva(true);
          setToast('🔔 Notificação 16:30: Relatório de não devolução gerado!');
          reload();
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Verificação regra atraso 24h
  useEffect(() => {
    const pendentes = emprestimos.filter(e => e.status === 'Pendente');
    const now = new Date().getTime();
    const h24 = 24 * 60 * 60 * 1000;
    const temAtraso24h = pendentes.some(e => {
      const dataEmp = new Date(e.dataEmprestimo).getTime();
      return (now - dataEmp) > h24;
    });
    setMostrarAtraso24h(temAtraso24h);
  }, [emprestimos]);

  const emprestimosFiltrados = useMemo(() => {
    let lista = emprestimos;
    if (filtroStatus !== 'Todos') {
      lista = lista.filter(e => e.status === filtroStatus);
    }
    if (buscaEmprestimo.trim()) {
      const q = buscaEmprestimo.toLowerCase();
      lista = lista.filter(e =>
        e.destinoNome.toLowerCase().includes(q) ||
        e.destinoLocal.toLowerCase().includes(q) ||
        e.ferramentas.some(f => f.toLowerCase().includes(q))
      );
    }
    return lista;
  }, [emprestimos, filtroStatus, buscaEmprestimo]);

  const pendentesAtivos = emprestimos.filter(e => e.status === 'Pendente');
  const pendentes48h = getPendentesMaior48h();
  const bloqueado = hasPendenciaMaior48h();

  const toggleFerramenta = (item: ItemInsumo) => {
    if (selectedFerramentas.find(f => f.codigo === item.codigo)) {
      setSelectedFerramentas(prev => prev.filter(f => f.codigo !== item.codigo));
    } else {
      if (selectedFerramentas.length >= 5) {
        setToast('⚠️ Máximo de 5 ferramentas por empréstimo!');
        setTimeout(() => setToast(null), 3000);
        return;
      }
      setSelectedFerramentas(prev => [...prev, item]);
    }
  };

  const handleLiberar = () => {
    if (bloqueado) {
      setShowPasswordModal(true);
      setSenhaInput('');
      setSenhaError('');
      return;
    }
    handleSalvarEmprestimo();
  };

  const handleSalvarEmprestimo = () => {
    if (selectedFerramentas.length === 0) {
      setToast('⚠️ Selecione pelo menos uma ferramenta!');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    if (!destinoNome.trim()) {
      setToast('⚠️ Informe o nome do destinatário!');
      setTimeout(() => setToast(null), 3000);
      return;
    }

    if (!activeObra) {
      setToast('⚠️ Selecione uma obra para registrar o empréstimo!');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const novo = addEmprestimo({
      tipoDestino,
      destinoNome: destinoNome.trim(),
      destinoLocal: destinoLocal.trim(),
      ferramentas: selectedFerramentas.map(f => `${f.codigo} - ${f.nome}${f.detalhe ? ' (' + f.detalhe + ')' : ''}`),
      obraId: activeObra.id,
      obraNome: activeObra.nome
    });

    auditLog('EMPRESTIMO_FERRAMENTA', `Empréstimo ${novo.id} - ${tipoDestino}: ${destinoNome} - ${selectedFerramentas.length} ferramenta(s)`);
    setToast('✅ Empréstimo registrado com sucesso!');
    setTimeout(() => setToast(null), 3000);

    setSelectedFerramentas([]);
    setDestinoNome('');
    setDestinoLocal('');
    setSearchFerramenta('');
    setAbaEmp('ativos');
    reload();
  };

  const handleVerificarSenha = () => {
    if (senhaInput === '1307') {
      setShowPasswordModal(false);
      setSenhaError('');
      handleSalvarEmprestimo();
    } else {
      setSenhaError('Senha incorreta! Apenas MASTER (1307) pode liberar com pendência >48h.');
    }
  };

  const handleDevolver = (id: string) => {
    devolverEmprestimo(id);
    auditLog('DEVOLUCAO_FERRAMENTA', `Devolução do empréstimo ${id}`);
    setToast('✅ Ferramenta(s) devolvida(s) com sucesso!');
    setTimeout(() => setToast(null), 3000);
    reload();
  };

  const handleExcluirEmprestimo = (id: string) => {
    if (!confirm('Deseja realmente excluir este empréstimo?')) return;
    deleteEmprestimo(id);
    auditLog('EXCLUIR_EMPRESTIMO', `Empréstimo ${id} excluído`);
    setToast('🗑️ Empréstimo excluído!');
    setTimeout(() => setToast(null), 3000);
    reload();
  };

  const handleGerarRelatorioManual = () => {
    const rel = gerarRelatorioNaoDevolucao();
    if (rel) {
      setToast('📄 Relatório de não devolução gerado!');
      reload();
    } else {
      setToast('ℹ️ Não há pendências com mais de 48h.');
    }
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddExtensao = () => {
    if (!extForm.nome.trim() || !extForm.local.trim()) {
      setToast('⚠️ Preencha nome e local da extensão!');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    addExtensaoEnergia({
      nome: extForm.nome.trim(),
      local: extForm.local.trim(),
      descricao: extForm.descricao.trim()
    });
    setToast('⚡ Extensão de energia cadastrada!');
    setTimeout(() => setToast(null), 3000);
    setExtForm({ nome: '', local: '', descricao: '' });
    reload();
  };

  const handleDeleteExtensao = (id: string) => {
    if (!confirm('Deseja excluir esta extensão de energia?')) return;
    deleteExtensaoEnergia(id);
    setToast('🗑️ Extensão excluída!');
    setTimeout(() => setToast(null), 3000);
    reload();
  };

  const handleSalvarEdicaoExtensao = (id: string) => {
    if (!extForm.nome.trim() || !extForm.local.trim()) {
      setToast('⚠️ Preencha nome e local!');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    updateExtensaoEnergia(id, {
      nome: extForm.nome.trim(),
      local: extForm.local.trim(),
      descricao: extForm.descricao.trim()
    });
    setToast('✅ Extensão atualizada!');
    setTimeout(() => setToast(null), 3000);
    setExtEditando(null);
    setExtForm({ nome: '', local: '', descricao: '' });
    reload();
  };

  const iniciaEdicaoExtensao = (ext: ExtensaoEnergia) => {
    setExtEditando(ext.id);
    setExtForm({
      nome: ext.nome,
      local: ext.local,
      descricao: ext.descricao || ''
    });
  };

  const exportarRelatorioPendencias = () => {
    const p = getPendentesMaior48h();
    const data = p.map(e => ({
      'Data Empréstimo': new Date(e.dataEmprestimo).toLocaleString('pt-BR'),
      Tipo: e.tipoDestino,
      Destinatário: e.destinoNome,
      Local: e.destinoLocal,
      Ferramentas: e.ferramentas.join('; '),
      Status: e.status,
      'Dias Pendentes': Math.floor((Date.now() - new Date(e.dataEmprestimo).getTime()) / (1000 * 60 * 60 * 24))
    }));
    if (data.length === 0) {
      setToast('ℹ️ Não há pendências para exportar.');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      setToast('❌ Exportação indisponível no momento.');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pendências');
    XLSX.writeFile(wb, `Relatorio_Pendencias_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportarRelatorioEmprestadas = () => {
    const p = emprestimos.filter(e => e.status === 'Pendente');
    const data = p.map(e => ({
      'Data Empréstimo': new Date(e.dataEmprestimo).toLocaleString('pt-BR'),
      Tipo: e.tipoDestino,
      Destinatário: e.destinoNome,
      Local: e.destinoLocal,
      Ferramentas: e.ferramentas.join('; ')
    }));
    if (data.length === 0) {
      setToast('ℹ️ Não há ferramentas emprestadas para exportar.');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      setToast('❌ Exportação indisponível no momento.');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Emprestadas');
    XLSX.writeFile(wb, `Relatorio_Emprestadas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-slate-900 border border-[#C9A358]/40 shadow-lg rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-100 animate-bounce">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Wrench className="w-6 h-6 text-[#C9A358]" />
            Empréstimo de Ferramentas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Controle de ferramentas emprestadas, relatórios de pendências e extensão de energia
          </p>
        </div>
        <div className="flex items-center gap-2">
          {notificacaoAtiva && (
            <span className="bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <Bell className="w-3 h-3" /> Notificação 16:30
            </span>
          )}
          {bloqueado && (
            <span className="bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <Lock className="w-3 h-3" /> Bloqueado: Pendência {'>'}48h
            </span>
          )}
          {mostrarAtraso24h && (
            <span className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <Clock className="w-3 h-3" /> Atraso {'>'}24h detectado
            </span>
          )}
        </div>
      </div>

      {/* Sub-navegação */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          { key: 'emprestimos', label: 'Empréstimos', icon: ArrowLeftRight },
          { key: 'relatorios', label: 'Relatórios', icon: FileText },
          { key: 'extensoes', label: 'Extensão de Energia', icon: Zap }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setSubAba(tab.key as SubAba)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              subAba === tab.key
                ? 'bg-[#C9A358] text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== ABA EMPRÉSTIMOS ===== */}
      {subAba === 'emprestimos' && (
        <div className="space-y-4">
          {/* Abas internas */}
          <div className="flex gap-2">
            {[
              { key: 'ativos', label: 'Empréstimos Ativos' },
              { key: 'novo', label: 'Novo Empréstimo' },
              { key: 'historico', label: 'Histórico' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setAbaEmp(tab.key as AbaEmprestimo)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  abaEmp === tab.key
                    ? 'bg-[#C9A358] text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-[#C9A358]/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ABA ATIVOS */}
          {abaEmp === 'ativos' && (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-lg"><ArrowLeftRight className="w-5 h-5" /></div>
                  <div>
                    <div className="text-lg font-black text-slate-800 dark:text-white">{pendentesAtivos.length}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Empréstimos Ativos</div>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-3">
                  <div className="p-2.5 bg-red-500/10 text-red-600 rounded-lg"><AlertTriangle className="w-5 h-5" /></div>
                  <div>
                    <div className="text-lg font-black text-slate-800 dark:text-white">{pendentes48h.length}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Pendentes {'>'}48h</div>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-lg"><CheckCircle className="w-5 h-5" /></div>
                  <div>
                    <div className="text-lg font-black text-slate-800 dark:text-white">{emprestimos.filter(e => e.status === 'Devolvido').length}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Devolvidos</div>
                  </div>
                </div>
              </div>

              {/* Filtros */}
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                <div className="flex gap-2 items-center">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar empréstimo..."
                      value={buscaEmprestimo}
                      onChange={e => setBuscaEmprestimo(e.target.value)}
                      className="pl-8 pr-3 py-2 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A358] w-56"
                    />
                  </div>
                  <select
                    value={filtroStatus}
                    onChange={e => setFiltroStatus(e.target.value as StatusEmprestimo | 'Todos')}
                    className="px-3 py-2 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Devolvido">Devolvido</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRelatorioEmprestadas(true)}
                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
                  >
                    <FileText className="w-4 h-4" /> Relatório Emprestadas
                  </button>
                  <button
                    onClick={() => setShowRelatorioPendencias(true)}
                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
                  >
                    <AlertTriangle className="w-4 h-4" /> Relatório Pendências
                  </button>
                </div>
              </div>

              {/* Tabela */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wide">
                        <th className="px-4 py-3 text-left">Data</th>
                        <th className="px-4 py-3 text-left">Tipo</th>
                        <th className="px-4 py-3 text-left">Destinatário</th>
                        <th className="px-4 py-3 text-left">Ferramentas</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {emprestimosFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs font-bold">
                            Nenhum empréstimo encontrado.
                          </td>
                        </tr>
                      ) : (
                        emprestimosFiltrados.map(emp => {
                          const isAtraso48h = emp.status === 'Pendente' && (Date.now() - new Date(emp.dataEmprestimo).getTime()) > 48 * 60 * 60 * 1000;
                          const isAtraso24h = emp.status === 'Pendente' && (Date.now() - new Date(emp.dataEmprestimo).getTime()) > 24 * 60 * 60 * 1000;
                          return (
                            <tr key={emp.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 ${isAtraso48h ? 'bg-red-50 dark:bg-red-900/10' : ''} ${isAtraso24h && !isAtraso48h ? 'bg-orange-50 dark:bg-orange-900/10' : ''}`}>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-bold text-slate-800 dark:text-slate-100">{new Date(emp.dataEmprestimo).toLocaleDateString('pt-BR')}</div>
                                <div className="text-[10px] text-slate-400">{new Date(emp.dataEmprestimo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  emp.tipoDestino === 'Funcionário'
                                    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                                    : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20'
                                }`}>
                                  {emp.tipoDestino === 'Funcionário' ? <UserCheck className="w-3 h-3 inline mr-1" /> : <Users className="w-3 h-3 inline mr-1" />}
                                  {emp.tipoDestino}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-800 dark:text-slate-100">{emp.destinoNome}</div>
                                <div className="text-[10px] text-slate-400">{emp.destinoLocal}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="max-w-[200px] truncate text-slate-700 dark:text-slate-300 text-[11px]">
                                  {emp.ferramentas.map((f, i) => (
                                    <span key={i} className="block">{f}</span>
                                  ))}
                                </div>
                                <span className="text-[10px] text-slate-400 font-bold">{emp.ferramentas.length} item(s)</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  emp.status === 'Pendente'
                                    ? isAtraso48h
                                      ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
                                      : isAtraso24h
                                        ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20'
                                        : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20'
                                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                                }`}>
                                  {emp.status === 'Pendente' ? 'Pendente' : 'Devolvido'}
                                  {isAtraso48h && ' >48h'}
                                  {isAtraso24h && !isAtraso48h && ' >24h'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {emp.status === 'Pendente' && (
                                    <button
                                      onClick={() => handleDevolver(emp.id)}
                                      className="p-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded-lg transition-colors"
                                      title="Devolver"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleExcluirEmprestimo(emp.id)}
                                    className="p-1.5 bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg transition-colors"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ABA NOVO EMPRÉSTIMO */}
          {abaEmp === 'novo' && (
            <div className="space-y-4">
              {/* Alerta de bloqueio */}
              {bloqueado && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-red-800 dark:text-red-300">Bloqueio ativo: Pendência {'>'}48h</div>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Existem empréstimos pendentes há mais de 48h. Para liberar novo empréstimo, é necessário a senha MASTER (1307).
                    </p>
                  </div>
                </div>
              )}

              {/* Tipo de destino */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#C9A358]" />
                  Tipo de Destinatário
                </div>
                <div className="flex gap-2">
                  {(['Funcionário', 'Terceiros'] as TipoDestino[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setTipoDestino(t)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                        tipoDestino === t
                          ? 'bg-[#C9A358] text-white border-[#C9A358]'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#C9A358]/50'
                      }`}
                    >
                      {t === 'Funcionário' ? <UserCheck className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dados do destinatário */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-sm font-bold text-slate-800 dark:text-white">Dados do Destinatário</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Nome</label>
                    <input
                      type="text"
                      value={destinoNome}
                      onChange={e => setDestinoNome(e.target.value)}
                      placeholder={`Nome do ${tipoDestino.toLowerCase()}`}
                      className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Local / Setor</label>
                    <input
                      type="text"
                      value={destinoLocal}
                      onChange={e => setDestinoLocal(e.target.value)}
                      placeholder="Local ou setor de uso"
                      className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                    />
                  </div>
                </div>
              </div>

              {/* Seleção de ferramentas */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-[#C9A358]" />
                    Seleção de Ferramentas
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                    selectedFerramentas.length >= 5
                      ? 'bg-red-500/10 text-red-600 border-red-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                  }`}>
                    {selectedFerramentas.length}/5 selecionadas
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchFerramenta}
                    onChange={e => setSearchFerramenta(e.target.value)}
                    placeholder="Buscar ferramenta por nome, código ou variação..."
                    className="w-full pl-8 pr-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                  />
                </div>

                {selectedFerramentas.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedFerramentas.map(f => (
                      <span key={f.codigo} className="inline-flex items-center gap-1 px-2 py-1 bg-[#C9A358]/10 text-[#C9A358] border border-[#C9A358]/20 rounded-lg text-[10px] font-bold">
                        {f.nome} ({f.codigo})
                        <button onClick={() => toggleFerramenta(f)} className="hover:text-red-500"><XCircle className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                  {ferramentasFiltradas.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs font-bold text-slate-400">
                      Nenhuma ferramenta encontrada.
                    </div>
                  ) : (
                    ferramentasFiltradas.map(f => {
                      const selecionado = selectedFerramentas.find(sf => sf.codigo === f.codigo);
                      return (
                        <div
                          key={f.codigo}
                          onClick={() => toggleFerramenta(f)}
                          className={`px-4 py-2.5 cursor-pointer flex items-center justify-between border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                            selecionado ? 'bg-[#C9A358]/5' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              selecionado ? 'bg-[#C9A358] border-[#C9A358]' : 'border-slate-300 dark:border-slate-600'
                            }`}>
                              {selecionado && <CheckCircle className="w-3 h-3 text-white" />}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{f.nome}</div>
                              <div className="text-[10px] text-slate-400">{f.codigo}{f.detalhe ? ` • ${f.detalhe}` : ''}</div>
                            </div>
                          </div>
                          <div className="text-[10px] font-bold text-slate-400">Família: {f.familia}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Botão salvar */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLiberar}
                  className="px-5 py-2.5 bg-[#C9A358] hover:bg-[#b08d38] text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2"
                >
                  {bloqueado ? <Unlock className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {bloqueado ? 'Liberar com Senha MASTER' : 'Registrar Empréstimo'}
                </button>
                {bloqueado && (
                  <span className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Requer senha 1307
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ABA HISTÓRICO */}
          {abaEmp === 'historico' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="text-sm font-bold text-slate-800 dark:text-white mb-3">Histórico Completo</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wide">
                        <th className="px-4 py-3 text-left">Data</th>
                        <th className="px-4 py-3 text-left">Tipo</th>
                        <th className="px-4 py-3 text-left">Destinatário</th>
                        <th className="px-4 py-3 text-left">Ferramentas</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Devolução</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {emprestimos.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs font-bold">
                            Nenhum empréstimo no histórico.
                          </td>
                        </tr>
                      ) : (
                        emprestimos.map(emp => (
                          <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-bold text-slate-800 dark:text-slate-100">{new Date(emp.dataEmprestimo).toLocaleDateString('pt-BR')}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                emp.tipoDestino === 'Funcionário'
                                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                                  : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20'
                              }`}>
                                {emp.tipoDestino}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-800 dark:text-slate-100">{emp.destinoNome}</div>
                              <div className="text-[10px] text-slate-400">{emp.destinoLocal}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-[11px] text-slate-700 dark:text-slate-300">
                                {emp.ferramentas.map((f, i) => <span key={i} className="block">{f}</span>)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                emp.status === 'Pendente'
                                  ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20'
                                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                              }`}>
                                {emp.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                              {emp.dataDevolucao ? new Date(emp.dataDevolucao).toLocaleDateString('pt-BR') : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== ABA RELATÓRIOS ===== */}
      {subAba === 'relatorios' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setShowRelatorioEmprestadas(true)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-left hover:border-[#C9A358]/50 transition-colors group"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg group-hover:bg-blue-500/20 transition-colors"><ArrowLeftRight className="w-5 h-5" /></div>
                <div className="text-sm font-bold text-slate-800 dark:text-white">Relatório de Ferramentas Emprestadas</div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Lista todas as ferramentas atualmente emprestadas (status Pendente).</p>
            </button>
            <button
              onClick={() => setShowRelatorioPendencias(true)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-left hover:border-[#C9A358]/50 transition-colors group"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-red-500/10 text-red-600 rounded-lg group-hover:bg-red-500/20 transition-colors"><AlertTriangle className="w-5 h-5" /></div>
                <div className="text-sm font-bold text-slate-800 dark:text-white">Relatório de Pendências {'>'}48h</div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Lista empréstimos pendentes há mais de 48 horas.</p>
            </button>
          </div>

          {/* Relatórios gerados automaticamente */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#C9A358]" />
                Relatórios de Não Devolução (Gerados Automaticamente)
              </div>
              <button
                onClick={handleGerarRelatorioManual}
                className="px-3 py-1.5 bg-[#C9A358] text-white text-[10px] font-bold rounded-lg hover:bg-[#b08d38] transition-colors"
              >
                Gerar Agora
              </button>
            </div>
            {relatorios.length === 0 ? (
              <div className="text-xs text-slate-400 font-bold py-4 text-center">Nenhum relatório gerado ainda.</div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {relatorios.map(rel => {
                  const pendentesRel = emprestimos.filter(e => rel.pendentes.includes(e.id));
                  return (
                    <div key={rel.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-slate-500">{new Date(rel.dataGeracao).toLocaleString('pt-BR')}</span>
                        <span className="px-2 py-0.5 bg-red-500/10 text-red-600 text-[10px] font-bold rounded-full border border-red-500/20">{rel.pendentes.length} pendente(s)</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mb-2">{rel.observacao}</p>
                      <div className="space-y-1">
                        {pendentesRel.map(emp => (
                          <div key={emp.id} className="text-[10px] text-slate-500 dark:text-slate-400 pl-2 border-l-2 border-red-300">
                            {emp.destinoNome} — {emp.ferramentas.length} ferramenta(s) — {new Date(emp.dataEmprestimo).toLocaleDateString('pt-BR')}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== ABA EXTENSÃO DE ENERGIA ===== */}
      {subAba === 'extensoes' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#C9A358]" />
              {extEditando ? 'Editar Extensão de Energia' : 'Nova Extensão de Energia'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Nome / Identificação</label>
                <input
                  type="text"
                  value={extForm.nome}
                  onChange={e => setExtForm({ ...extForm, nome: e.target.value })}
                  placeholder="Ex: Extensão 01"
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Local</label>
                <input
                  type="text"
                  value={extForm.local}
                  onChange={e => setExtForm({ ...extForm, local: e.target.value })}
                  placeholder="Ex: Setor A - Bloco 2"
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 block">Descrição (opcional)</label>
                <input
                  type="text"
                  value={extForm.descricao}
                  onChange={e => setExtForm({ ...extForm, descricao: e.target.value })}
                  placeholder="Observações..."
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {extEditando ? (
                <>
                  <button
                    onClick={() => handleSalvarEdicaoExtensao(extEditando)}
                    className="px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 transition-colors"
                  >
                    Salvar Alterações
                  </button>
                  <button
                    onClick={() => { setExtEditando(null); setExtForm({ nome: '', local: '', descricao: '' }); }}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  onClick={handleAddExtensao}
                  className="px-4 py-2 bg-[#C9A358] text-white text-xs font-bold rounded-lg hover:bg-[#b08d38] transition-colors flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Cadastrar Extensão
                </button>
              )}
            </div>
          </div>

          {/* Lista de extensões */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Sequência</th>
                    <th className="px-4 py-3 text-left">Nome</th>
                    <th className="px-4 py-3 text-left">Local</th>
                    <th className="px-4 py-3 text-left">Descrição</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {extensoes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-xs font-bold">
                        Nenhuma extensão de energia cadastrada.
                      </td>
                    </tr>
                  ) : (
                    extensoes.map(ext => (
                      <tr key={ext.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-[#C9A358]/10 text-[#C9A358] border border-[#C9A358]/20 rounded-lg text-[10px] font-bold">{ext.sequencia}</span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{ext.nome}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{ext.local}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{ext.descricao || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => iniciaEdicaoExtensao(ext)}
                              className="p-1.5 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteExtensao(ext.id)}
                              className="p-1.5 bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Senha MASTER */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 p-5 w-full max-w-sm space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <Lock className="w-5 h-5" />
              <h3 className="text-sm font-black">Liberação MASTER Requerida</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Existe pendência de empréstimo há mais de 48h. Informe a senha MASTER para liberar novo empréstimo.
            </p>
            <input
              type="password"
              value={senhaInput}
              onChange={e => setSenhaInput(e.target.value)}
              placeholder="Senha MASTER (1307)"
              className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              onKeyDown={e => { if (e.key === 'Enter') handleVerificarSenha(); }}
            />
            {senhaError && <div className="text-[10px] text-red-500 font-bold">{senhaError}</div>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleVerificarSenha}
                className="px-3 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
              >
                Liberar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Relatório Emprestadas */}
      {showRelatorioEmprestadas && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 p-5 w-full max-w-3xl max-h-[80vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Relatório de Ferramentas Emprestadas
              </h3>
              <button onClick={() => setShowRelatorioEmprestadas(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><XCircle className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase">
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Destinatário</th>
                    <th className="px-3 py-2 text-left">Local</th>
                    <th className="px-3 py-2 text-left">Ferramentas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {emprestimos.filter(e => e.status === 'Pendente').length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400 text-xs font-bold">Nenhuma ferramenta emprestada.</td></tr>
                  ) : (
                    emprestimos.filter(e => e.status === 'Pendente').map(emp => (
                      <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-3 py-2 whitespace-nowrap">{new Date(emp.dataEmprestimo).toLocaleDateString('pt-BR')}</td>
                        <td className="px-3 py-2">{emp.tipoDestino}</td>
                        <td className="px-3 py-2 font-bold">{emp.destinoNome}</td>
                        <td className="px-3 py-2">{emp.destinoLocal}</td>
                        <td className="px-3 py-2">{emp.ferramentas.join('; ')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRelatorioEmprestadas(false)} className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">Fechar</button>
              <button onClick={exportarRelatorioEmprestadas} className="px-3 py-2 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1"><Download className="w-4 h-4" /> Exportar Excel</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Relatório Pendências */}
      {showRelatorioPendencias && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 p-5 w-full max-w-3xl max-h-[80vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Relatório de Pendências {'>'}48h
              </h3>
              <button onClick={() => setShowRelatorioPendencias(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><XCircle className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase">
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-left">Destinatário</th>
                    <th className="px-3 py-2 text-left">Ferramentas</th>
                    <th className="px-3 py-2 text-left">Dias</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {getPendentesMaior48h().length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400 text-xs font-bold">Nenhuma pendência {'>'}48h.</td></tr>
                  ) : (
                    getPendentesMaior48h().map(emp => {
                      const dias = Math.floor((Date.now() - new Date(emp.dataEmprestimo).getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-2 whitespace-nowrap">{new Date(emp.dataEmprestimo).toLocaleDateString('pt-BR')}</td>
                          <td className="px-3 py-2">{emp.tipoDestino}</td>
                          <td className="px-3 py-2 font-bold">{emp.destinoNome}</td>
                          <td className="px-3 py-2">{emp.ferramentas.join('; ')}</td>
                          <td className="px-3 py-2"><span className="px-2 py-0.5 bg-red-500/10 text-red-600 rounded-full text-[10px] font-bold border border-red-500/20">{dias}d</span></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRelatorioPendencias(false)} className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">Fechar</button>
              <button onClick={exportarRelatorioPendencias} className="px-3 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1"><Download className="w-4 h-4" /> Exportar Excel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
