import { useState, useEffect } from 'react';
import { User, Role, Obra, ItemInsumo, EntradaStock, SaidaStock, CQConcretagem } from './types';
import { 
  getCurrentSession, 
  setCurrentSession, 
  getActiveObra, 
  setActiveObra, 
  getObras, 
  saveObras, 
  getTenantData, 
  saveTenantData, 
  getCQList,
  saveCQList,
  auditLog, 
  getSaldo
} from './lib/storage';
import { Building2 } from 'lucide-react';

// Header & Navigation
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginOverlay } from './components/LoginOverlay';

// Views
import { DashboardView } from './components/DashboardView';
import { CadastroView } from './components/CadastroView';
import { EntradasView } from './components/EntradasView';
import { SaidasView } from './components/SaidasView';
import { InventarioView } from './components/InventarioView';
import { RelatoriosView } from './components/RelatoriosView';
import { AlertasView } from './components/AlertasView';
import { CQConcretagemView } from './components/CQConcretagemView';
import { EmprestimosView } from './components/EmprestimosView';
import { ObrasView } from './components/ObrasView';
import { UsuariosView } from './components/UsuariosView';
import { BackupView } from './components/BackupView';
import { ConfigView } from './components/ConfigView';


export default function App() {
  // Session & User State
  const [currentUserSession, setCurrentUserSession] = useState<{ username: string; role: string; permissoes: string[] } | null>(() => getCurrentSession());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('perfort_dark') === 'true';
  });

  // Navigation State
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [preselectedEntradaCodigo, setPreselectedEntradaCodigo] = useState<string | undefined>(undefined);

  // Obras & Active Tenant State
  const [obras, setObras] = useState<Obra[]>(() => getObras());

  // Obras não arquivadas para seleção ativa
  const obrasAtivas = obras.filter(o => !o.arquivada);
  const [activeObraState, setActiveObraState] = useState<Obra | null>(() => getActiveObra());

  // Tenant Insumos & Movements Data
  const [items, setItems] = useState<ItemInsumo[]>([]);
  const [entradas, setEntradas] = useState<EntradaStock[]>([]);
  const [saidas, setSaidas] = useState<SaidaStock[]>([]);
  const [cqList, setCqList] = useState<CQConcretagem[]>([]);

  // Load tenant data whenever activeObra changes
  const reloadTenantData = () => {
    const data = getTenantData();
    setItems(data.items || []);
    setEntradas(data.entradas || []);
    setSaidas(data.saidas || []);

    const cqData = getCQList();
    setCqList(cqData);
  };

  useEffect(() => {
    reloadTenantData();
  }, [activeObraState?.id]);

  // Se a obra ativa estiver arquivada, desativa-a automaticamente
  useEffect(() => {
    const obras = getObras();
    const active = getActiveObra();
    if (active && active.arquivada) {
      setActiveObra(null);
      setActiveObraState(null);
    }
  }, []);

  // Sync Dark Mode class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('perfort_dark', String(isDarkMode));
  }, [isDarkMode]);

  // Helper permission check
  const currentUserObj: User | null = currentUserSession ? {
    username: currentUserSession.username,
    role: currentUserSession.role as Role,
    permissoes: currentUserSession.permissoes
  } : null;

  const hasPermission = (module: string): boolean => {
    if (!currentUserSession) return false;
    if (currentUserSession.role === 'Administrador') return true;
    if (!currentUserSession.permissoes || currentUserSession.permissoes.length === 0) return true;
    return currentUserSession.permissoes.includes(module);
  };

  const canEdit = currentUserSession?.role === 'Administrador' || currentUserSession?.role === 'Gerente' || hasPermission('editar');
  const canDelete = currentUserSession?.role === 'Administrador' || hasPermission('excluir');

  // Login / Logout Handlers
  const handleLoginSuccess = (username: string, _role: string) => {
    const sess = getCurrentSession();
    setCurrentUserSession(sess);
    auditLog('LOGIN', `Usuário ${username} iniciou sessão`);
  };

  const handleLogout = () => {
    auditLog('LOGOUT', `Usuário ${currentUserSession?.username} encerrou sessão`);
    setCurrentSession(null);
    setCurrentUserSession(null);
  };

  // Obra Selection Handler
  const handleSelectObra = (obra: Obra | null) => {
    setActiveObra(obra);
    setActiveObraState(obra);
    auditLog('TROCA_OBRA', `Obra ativa alterada para ${obra ? obra.nome : 'Todas / Geral'}`);
  };

  // Item Insumo CRUD
  const handleAddItem = (newItem: ItemInsumo) => {
    const data = getTenantData();
    data.items.unshift(newItem);
    saveTenantData(data);
    setItems([...data.items]);
    auditLog('INCLUIR_INSUMO', `Insumo ${newItem.codigo} - ${newItem.nome} cadastrado`);
  };

  const handleUpdateItem = (idx: number, updatedItem: ItemInsumo) => {
    const data = getTenantData();
    data.items[idx] = updatedItem;
    saveTenantData(data);
    setItems([...data.items]);
    auditLog('EDITAR_INSUMO', `Insumo ${updatedItem.codigo} atualizado`);
  };

  const handleDeleteItem = (idx: number) => {
    const data = getTenantData();
    const item = data.items[idx];
    data.items.splice(idx, 1);
    saveTenantData(data);
    setItems([...data.items]);
    auditLog('EXCLUIR_INSUMO', `Insumo ${item?.codigo} excluído`);
  };

  // Entradas CRUD
  const handleAddEntrada = (entrada: Omit<EntradaStock, 'id'>) => {
    const data = getTenantData();
    const id = data.nextEntradaId || 1;
    const newEntrada: EntradaStock = { ...entrada, id };
    data.nextEntradaId = id + 1;
    data.entradas.unshift(newEntrada);

    // Update Insumo total entries and average price
    const item = data.items.find(i => i.codigo === entrada.codigo);
    if (item) {
      item.entradas_total = (item.entradas_total || 0) + entrada.qtd;
      
      // Calculate weighted average price
      const saldoAnterior = getSaldo(item) - entrada.qtd;
      const valAnterior = saldoAnterior > 0 ? (item.preco_medio || 0) * saldoAnterior : 0;
      const novoTotalQtd = Math.max(1, saldoAnterior + entrada.qtd);
      item.preco_medio = (valAnterior + entrada.valor_total) / novoTotalQtd;
    }

    saveTenantData(data);
    setItems([...data.items]);
    setEntradas([...data.entradas]);
    auditLog('REGISTRAR_ENTRADA', `Entrada NF ${entrada.nf || '-'} - ${entrada.qtd}x ${entrada.codigo}`);
  };

  const handleDeleteEntrada = (id: number) => {
    const data = getTenantData();
    const foundIdx = data.entradas.findIndex(e => e.id === id);
    if (foundIdx !== -1) {
      const ent = data.entradas[foundIdx];
      data.entradas.splice(foundIdx, 1);

      const item = data.items.find(i => i.codigo === ent.codigo);
      if (item) {
        item.entradas_total = Math.max(0, (item.entradas_total || 0) - ent.qtd);
      }

      saveTenantData(data);
      setItems([...data.items]);
      setEntradas([...data.entradas]);
      auditLog('EXCLUIR_ENTRADA', `Entrada #${id} removida`);
    }
  };

  // Saídas CRUD
  const handleAddSaida = (saida: Omit<SaidaStock, 'id'>) => {
    const data = getTenantData();
    const id = data.nextSaidaId || 1;
    const newSaida: SaidaStock = { ...saida, id };
    data.nextSaidaId = id + 1;
    data.saidas.unshift(newSaida);

    const item = data.items.find(i => i.codigo === saida.codigo);
    if (item) {
      item.saidas_total = (item.saidas_total || 0) + saida.qtd;
    }

    saveTenantData(data);
    setItems([...data.items]);
    setSaidas([...data.saidas]);
    auditLog('REGISTRAR_SAIDA', `Saída para ${saida.destino || '-'} - ${saida.qtd}x ${saida.codigo}`);
  };

  const handleDeleteSaida = (id: number) => {
    const data = getTenantData();
    const foundIdx = data.saidas.findIndex(s => s.id === id);
    if (foundIdx !== -1) {
      const sai = data.saidas[foundIdx];
      data.saidas.splice(foundIdx, 1);

      const item = data.items.find(i => i.codigo === sai.codigo);
      if (item) {
        item.saidas_total = Math.max(0, (item.saidas_total || 0) - sai.qtd);
      }

      saveTenantData(data);
      setItems([...data.items]);
      setSaidas([...data.saidas]);
      auditLog('EXCLUIR_SAIDA', `Saída #${id} removida`);
    }
  };

  // Inventory Contagem & Adjustment
  const handleUpdateContagem = (idx: number, qtdContada: number) => {
    const data = getTenantData();
    if (data.items[idx]) {
      data.items[idx].qtd_contada = qtdContada;
      saveTenantData(data);
      setItems([...data.items]);
    }
  };

  const handleAjustarInventario = (idx: number) => {
    const data = getTenantData();
    const item = data.items[idx];
    if (item && item.qtd_contada != null) {
      const saldoCalculado = getSaldo(item);
      const diferenca = item.qtd_contada - saldoCalculado;
      
      if (diferenca !== 0) {
        item.quantidade = item.quantidade + diferenca;
        item.qtd_contada = undefined;
        saveTenantData(data);
        setItems([...data.items]);
        auditLog('AJUSTE_INVENTARIO', `Ajuste de estoque para ${item.codigo}: variação de ${diferenca}`);
      }
    }
  };

  // CQ Concretagem CRUD
  const handleAddCQ = (item: Omit<CQConcretagem, 'id'>) => {
    const currentList = getCQList();
    const newId = currentList.length > 0 ? Math.max(...currentList.map(c => c.id)) + 1 : 1;
    const newItem: CQConcretagem = { 
      ...item, 
      id: newId, 
      obraId: activeObraState?.id, 
      obraNome: activeObraState?.nome 
    };
    currentList.unshift(newItem);
    saveCQList(currentList);
    setCqList([...currentList]);
    auditLog('REGISTRAR_CQ', `CP ${item.serie} cadastrado - ${item.qtd}m³ FCK ${item.fck}`);
  };

  const handleDeleteCQ = (id: number) => {
    const currentList = getCQList();
    const filtered = currentList.filter(c => c.id !== id);
    saveCQList(filtered);
    setCqList([...filtered]);
    auditLog('EXCLUIR_CQ', `Registro de CP #${id} removido`);
  };

  // Obras CRUD
  const handleCreateObra = (obraData: Omit<Obra, 'id'>) => {
    const currentObras = getObras();
    const newId = currentObras.length > 0 ? Math.max(...currentObras.map(o => o.id)) + 1 : 1;
    const newObra: Obra = { ...obraData, id: newId, createdAt: new Date().toISOString() };
    currentObras.unshift(newObra);
    saveObras(currentObras);
    setObras([...currentObras]);
    auditLog('CRIAR_OBRA', `Obra "${newObra.nome}" criada`);
  };

  const handleUpdateObra = (id: number, obraData: Partial<Obra>) => {
    const currentObras = getObras();
    const idx = currentObras.findIndex(o => o.id === id);
    if (idx !== -1) {
      currentObras[idx] = { ...currentObras[idx], ...obraData, updatedAt: Date.now() };
      saveObras(currentObras);
      setObras([...currentObras]);
      if (activeObraState?.id === id) {
        const updatedObra = currentObras[idx];
        if (updatedObra.arquivada) {
          setActiveObraState(null);
          setActiveObra(null);
        } else {
          setActiveObraState(updatedObra);
          setActiveObra(updatedObra);
        }
      }
      auditLog('EDITAR_OBRA', `Obra #${id} atualizada`);
    }
  };

  const handleDeleteObra = (id: number) => {
    let currentObras = getObras();
    currentObras = currentObras.filter(o => o.id !== id);
    saveObras(currentObras);
    setObras([...currentObras]);
    if (activeObraState?.id === id) {
      handleSelectObra(null);
    }
    auditLog('EXCLUIR_OBRA', `Obra #${id} excluída`);
  };

  // Direct Jump from Dashboard/Alerts to Entradas
  const handleIrParaEntrada = (codigo: string) => {
    setPreselectedEntradaCodigo(codigo);
    setActivePage('entradas');
  };

  // Show Login Overlay if no session
  if (!currentUserSession) {
    return <LoginOverlay onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      
      {/* Top Header */}
      <Header
        currentUser={currentUserObj}
        activeObra={activeObraState}
        obras={obras}
        obrasAtivas={obrasAtivas}
        onSelectObra={handleSelectObra}
        onLogout={handleLogout}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        onOpenPage={(pg) => setActivePage(pg)}
      />

      {/* Main Body Layout with Sidebar + View Content */}
      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto">
        
        {/* Left Sidebar Navigation */}
        <Sidebar
          activePage={activePage}
          onOpenPage={(pg) => {
            if (pg !== 'entradas') setPreselectedEntradaCodigo(undefined);
            setActivePage(pg);
          }}
          currentUser={currentUserObj}
          hasPermission={hasPermission}
        />

        {/* Primary View Workspace Container */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto min-w-0">
          
          {/* Active Obra Context Status Banner */}
          <div className="mb-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition-colors">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl font-bold flex items-center justify-center shrink-0 ${
                activeObraState 
                  ? 'bg-[#C9A358]/15 text-[#C9A358] border border-[#C9A358]/30' 
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
              }`}>
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <div className="font-black text-slate-800 dark:text-white flex items-center gap-2 flex-wrap">
                  <span className="text-sm">{activeObraState ? activeObraState.nome : 'Visão Geral (Todas as Obras)'}</span>
                  {activeObraState ? (
                    <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide">
                      Obra Selecionada #{activeObraState.id}
                    </span>
                  ) : (
                    <span className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide">
                      Visão Consolidada
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeObraState 
                    ? `Insumos, Almoxarifado, Entradas/Saídas e Controle de Qualidade (CQ) restritos a este canteiro.`
                    : 'Exibindo relatórios e insumos consolidados de todos os canteiros de obra cadastrados.'
                  }
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 whitespace-nowrap hidden md:inline">Alternar Obra:</span>
              <select
                value={activeObraState?.id || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    handleSelectObra(null);
                  } else {
                    const found = obrasAtivas.find(o => o.id === Number(val));
                    handleSelectObra(found || null);
                  }
                }}
                className="w-full sm:w-auto bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold py-1.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C9A358]"
              >
                <option value="">🌐 Visão Geral (Todas as Obras)</option>
                {obrasAtivas.map(o => (
                  <option key={o.id} value={o.id}>
                    🏗️ Obra: {o.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {activePage === 'dashboard' && (
            <DashboardView
              items={items}
              entradas={entradas}
              saidas={saidas}
              onOpenPage={setActivePage}
              onIrParaEntrada={handleIrParaEntrada}
            />
          )}

          {activePage === 'cadastro' && (
            <CadastroView
              items={items}
              onAddItem={handleAddItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          )}

          {activePage === 'entradas' && (
            <EntradasView
              items={items}
              entradas={entradas}
              onAddEntrada={handleAddEntrada}
              onDeleteEntrada={handleDeleteEntrada}
              canDelete={canDelete}
              preselectedCodigo={preselectedEntradaCodigo}
            />
          )}

          {activePage === 'saidas' && (
            <SaidasView
              items={items}
              saidas={saidas}
              onAddSaida={handleAddSaida}
              onDeleteSaida={handleDeleteSaida}
              canDelete={canDelete}
            />
          )}

          {activePage === 'inventario' && (
            <InventarioView
              items={items}
              onUpdateContagem={handleUpdateContagem}
              onAjustarInventario={handleAjustarInventario}
              canEdit={canEdit}
            />
          )}

          {activePage === 'emprestimos' && (
            <EmprestimosView
              activeObra={activeObraState}
            />
          )}

          {activePage === 'relatorio' && (
            <RelatoriosView
              items={items}
              entradas={entradas}
              saidas={saidas}
            />
          )}

          {activePage === 'alertas' && (
            <AlertasView
              items={items}
              onIrParaEntrada={handleIrParaEntrada}
            />
          )}

          {activePage === 'cq-concretagem' && (
            <CQConcretagemView
              cqList={cqList}
              onAddCQ={handleAddCQ}
              onDeleteCQ={handleDeleteCQ}
              canDelete={canDelete}
            />
          )}

          {activePage === 'obras' && (
            <ObrasView
              obras={obras}
              activeObra={activeObraState}
              onSelectObra={(o) => handleSelectObra(o)}
              onCreateObra={handleCreateObra}
              onUpdateObra={handleUpdateObra}
              onDeleteObra={handleDeleteObra}
              canEdit={canEdit}
            />
          )}

          {activePage === 'usuarios' && (
            <UsuariosView
              canManage={currentUserSession.role === 'Administrador'}
            />
          )}

          {activePage === 'backup' && (
            <BackupView
              canManage={currentUserSession.role === 'Administrador' || currentUserSession.role === 'Gerente'}
              onDataRestored={reloadTenantData}
            />
          )}

          {activePage === 'config' && (
            <ConfigView
              currentUser={currentUserObj}
              activeObra={activeObraState}
              isDarkMode={isDarkMode}
              onToggleTheme={() => setIsDarkMode(!isDarkMode)}
            />
          )}

        </main>
      </div>

    </div>
  );
}
