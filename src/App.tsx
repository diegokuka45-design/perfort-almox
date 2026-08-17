import React, { useState, useEffect, useRef } from 'react';
import { hasRealConfig } from './lib/firebase';
import { User, Obra, ItemInsumo, EntradaStock, SaidaStock, CQConcretagem } from './types';
import { 
  getCurrentSession, 
  setCurrentSession, 
  getUsers,
  getActiveObra, 
  setActiveObra, 
  getObras, 
  saveObras, 
  getTenantData, 
  saveTenantData, 
  tget, 
  tset, 
  auditLog, 
  getSaldo, 
  getStatus,
  loadTenantDataFromFirestore,
  syncAllFromFirestore
} from './lib/firestoreStorage';
import { runMigration, isMigrationDone } from './lib/firebaseMigration';
import type { MigrationResult } from './lib/firebaseMigration';

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
import { ObrasView } from './components/ObrasView';
import { UsuariosView } from './components/UsuariosView';
import { BackupView } from './components/BackupView';
import { ConfigView } from './components/ConfigView';
import { AssistenteIAView } from './components/AssistenteIAView';
import { EmprestimoFerramentasView } from './components/EmprestimoFerramentasView';
import { EpiFornecimentoView } from './components/EpiFornecimentoView';
import { MaterialConsumoView } from './components/MaterialConsumoView';

// ---------------------------------------------------------------------------
// Migration overlay — shown while localStorage → Firestore migration runs
// ---------------------------------------------------------------------------
function MigrationOverlay({ status, result }: { status: MigrationStatus; result: MigrationResult | null }) {
  if (status !== 'migrating' && status !== 'checking') return null;

  const isChecking = status === 'checking';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
        {/* Spinner */}
        <div className="flex justify-center mb-5">
          <svg
            className="animate-spin h-12 w-12 text-blue-600 dark:text-blue-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          {isChecking ? 'Verificando migração…' : 'Migrando dados para a nuvem…'}
        </h2>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {isChecking
            ? 'Aguarde enquanto verificamos se seus dados locais já foram sincronizados.'
            : 'Seus dados locais estão sendo enviados ao Firestore. Isso ocorre apenas uma vez e pode levar alguns minutos.'
          }
        </p>

        {result && !isChecking && (
          <div className="text-xs text-slate-400 dark:text-slate-500 space-y-1">
            <p>Obras: {result.obrasCount} · Usuários: {result.usersCount}</p>
            <p>Obras migradas: {result.tenantDataMigrated.length}</p>
            <p>Logs de auditoria: {result.auditLogCount}</p>
            {result.errors.length > 0 && (
              <p className="text-amber-500">{result.errors.length} erro(s) — verifique o console</p>
            )}
          </div>
        )}

        <div className="mt-4">
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
            <div
              className="bg-blue-600 dark:bg-blue-400 h-1.5 rounded-full transition-all duration-700"
              style={{ width: isChecking ? '30%' : '70%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type MigrationStatus = 'idle' | 'checking' | 'migrating' | 'done' | 'skipped' | 'error';

export default function App() {
  // Session & User State — ALWAYS start with null (show login first)
  const [currentUserSession, setCurrentUserSession] = useState<{ username: string; role: string; permissoes: string[] } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('perfort_dark') === 'true';
  });

  // Network status — if offline, force logout back to login
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineToast, setOfflineToast] = useState<string | null>(null);
  const sessionRef = useRef(currentUserSession);
  sessionRef.current = currentUserSession;

  // Navigation State
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [preselectedEntradaCodigo, setPreselectedEntradaCodigo] = useState<string | undefined>(undefined);

  // Obras & Active Tenant State
  const [obras, setObras] = useState<Obra[]>(() => getObras());
  const [activeObraState, setActiveObraState] = useState<Obra | null>(() => getActiveObra());

  // Tenant Insumos & Movements Data
  const [items, setItems] = useState<ItemInsumo[]>([]);
  const [entradas, setEntradas] = useState<EntradaStock[]>([]);
  const [saidas, setSaidas] = useState<SaidaStock[]>([]);
  const [cqList, setCqList] = useState<CQConcretagem[]>([]);

  // ---------------------------------------------------------------------------
  // Migration state — tracks localStorage → Firestore one-time migration
  // ---------------------------------------------------------------------------
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>('idle');
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

  // Load tenant data whenever activeObra changes
  const reloadTenantData = () => {
    const data = getTenantData();
    setItems(data.items || []);
    setEntradas(data.entradas || []);
    setSaidas(data.saidas || []);

    const cqData = tget<CQConcretagem[]>('cq_concretagem', []);
    setCqList(cqData);
  };

  useEffect(() => {
    reloadTenantData();
  }, [activeObraState?.id]);

  // ---------------------------------------------------------------------------
  // On mount: Run migration (if needed), then pull Firestore → localStorage
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!hasRealConfig) return;

    let cancelled = false;

    (async () => {
      try {
        // --- Phase 1: Check & run migration (localStorage → Firestore) ---
        setMigrationStatus('checking');

        if (!isMigrationDone()) {
          console.log('[App] localStorage → Firestore migration starting…');
          setMigrationStatus('migrating');

          const result = await runMigration();
          if (cancelled) return;

          setMigrationResult(result);

          if (result.success) {
            setMigrationStatus('done');
            console.log(
              `[App] Migration complete: ${result.obrasCount} obras, ${result.usersCount} users, ` +
              `${result.tenantDataMigrated.length} tenants migrated in ${result.durationMs}ms`
            );
          } else if (result.errors.length === 1 && result.errors[0]?.includes('already completed')) {
            // Race: another tab/device ran it — treat as already done
            setMigrationStatus('skipped');
            console.log('[App] Migration was already completed (flag set).');
          } else {
            setMigrationStatus('error');
            console.error('[App] Migration failed:', result.errors);
          }
        } else {
          setMigrationStatus('skipped');
          console.log('[App] Migration already done — skipping.');
        }

        // --- Phase 2: Pull latest data from Firestore → localStorage ---
        //    This runs regardless of whether migration happened, ensuring the
        //    local cache is always fresh after the first cloud-connected load.
        console.log('[App] Syncing from Firestore…');
        await syncAllFromFirestore();
        if (activeObraState?.id) {
          await loadTenantDataFromFirestore(activeObraState.id);
        }

        // Refresh all React state from the now-up-to-date localStorage
        reloadTenantData();
        setObras(getObras());

        console.log('[App] Firestore sync + reload complete.');
      } catch (err) {
        console.error('[App] Failed during mount initialization:', err);
        setMigrationStatus(prev => prev === 'migrating' || prev === 'checking' ? 'error' : prev);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    role: currentUserSession.role as any,
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
  const handleLoginSuccess = (username: string, role: string) => {
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
    const id = String(data.nextEntradaId || 1);
    const newEntrada: EntradaStock = { ...entrada, id };
    data.nextEntradaId = Number(id) + 1;
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

  const handleDeleteEntrada = (id: string) => {
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
    const id = String(data.nextSaidaId || 1);
    const newSaida: SaidaStock = { ...saida, id };
    data.nextSaidaId = Number(id) + 1;
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

  const handleDeleteSaida = (id: string) => {
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
    const currentList = tget<CQConcretagem[]>('cq_concretagem', []);
    const newId = currentList.length > 0 ? String(Math.max(...currentList.map(c => Number(c.id))) + 1) : '1';
    const newItem = { ...item, id: newId };
    currentList.unshift(newItem);
    tset('cq_concretagem', currentList);
    setCqList([...currentList]);
    auditLog('REGISTRAR_CQ', `CP ${item.serie} cadastrado - ${item.qtd}m³ FCK ${item.fck}`);
  };

  const handleDeleteCQ = (id: string) => {
    const currentList = tget<CQConcretagem[]>('cq_concretagem', []);
    const filtered = currentList.filter(c => c.id !== id);
    tset('cq_concretagem', filtered);
    setCqList([...filtered]);
    auditLog('EXCLUIR_CQ', `Registro de CP #${id} removido`);
  };

  // Obras CRUD
  const handleCreateObra = (obraData: Omit<Obra, 'id'>) => {
    const currentObras = getObras();
    const newId = Date.now().toString();
    const newObra: Obra = { ...obraData, id: newId, createdAt: new Date().toISOString() };
    currentObras.unshift(newObra);
    saveObras(currentObras);
    setObras([...currentObras]);
    auditLog('CRIAR_OBRA', `Obra "${newObra.nome}" criada`);
  };

  const handleUpdateObra = (id: string, obraData: Partial<Obra>) => {
    const currentObras = getObras();
    const idx = currentObras.findIndex(o => o.id === id);
    if (idx !== -1) {
      currentObras[idx] = { ...currentObras[idx], ...obraData, updatedAt: Date.now() };
      saveObras(currentObras);
      setObras([...currentObras]);
      if (activeObraState?.id === id) {
        setActiveObraState(currentObras[idx]);
        setActiveObra(currentObras[idx]);
      }
      auditLog('EDITAR_OBRA', `Obra #${id} atualizada`);
    }
  };

  const handleDeleteObra = (id: string) => {
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

  // ---------------------------------------------------------------------------
  // Auto-validate saved session on mount (after login screen is shown)
  // If a valid session exists in localStorage, silently restore it so the
  // user doesn't need to re-type credentials every page load.
  // ---------------------------------------------------------------------------
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const saved = getCurrentSession();
    if (saved) {
      // Re-validate: user still exists in the user list?
      const users = getUsers();
      const stillValid = users.some(u => u.username.toLowerCase() === saved.username.toLowerCase());
      if (stillValid) {
        setCurrentUserSession(saved);
      } else {
        setCurrentSession(null);
      }
    }
    setSessionChecked(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Network connectivity monitor — on offline → force logout back to login
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const goOffline = () => {
      setIsOnline(false);
      // Force logout — clear session, return to login
      if (sessionRef.current) {
        setCurrentSession(null);
        setCurrentUserSession(null);
      }
      setOfflineToast('Conexão com a internet perdida. Você foi redirecionado para o login.');
    };

    const goOnline = () => {
      setIsOnline(true);
      setOfflineToast('Conexão restabelecida. Faça login para continuar.');
      // Clear the online toast after 5 seconds
      setTimeout(() => {
        setOfflineToast(prev => prev === 'Conexão restabelecida. Faça login para continuar.' ? null : prev);
      }, 5000);
    };

    // Set initial state
    setIsOnline(navigator.onLine);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // Show Login Overlay if no session
  if (!currentUserSession) {
    return (
      <>
        {offlineToast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-bounce">
            <div className={`px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-2 ${
              isOnline
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white'
            }`}>
              {!isOnline ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M12 9v4m0 0v2m0-2h.01" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              )}
              {offlineToast}
            </div>
          </div>
        )}
        <LoginOverlay onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      
      {/* Network Status Banner — warns when offline before forced logout */}
      {!isOnline && (
        <div className="bg-red-600 text-white px-4 py-2 text-center text-sm font-bold animate-pulse flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M12 9v4m0 0v2m0-2h.01" /></svg>
          SEM CONEXÃO COM A INTERNET — Você será redirecionado para o login.
        </div>
      )}

      {/* Migration Overlay — shown during one-time localStorage → Firestore migration */}
      <MigrationOverlay status={migrationStatus} result={migrationResult} />

      {/* Top Header */}
      <Header
        currentUser={currentUserObj}
        activeObra={activeObraState}
        obras={obras}
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
          
          {activePage === 'dashboard' && (
            <DashboardView
              items={items}
              entradas={entradas}
              saidas={saidas}
              onOpenPage={setActivePage}
              onAnalisarIA={() => setActivePage('assistente-ia')}
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

          {activePage === 'assistente-ia' && (
            <AssistenteIAView
              items={items}
              entradas={entradas}
              saidas={saidas}
            />
          )}

          {activePage === 'emprestimo-ferramentas' && (
            <EmprestimoFerramentasView
              obraId={String(activeObraState?.id || 0)}
            />
          )}

          {activePage === 'epi-fornecimento' && (
            <EpiFornecimentoView
              obraId={String(activeObraState?.id || 0)}
            />
          )}

          {activePage === 'material-consumo' && (
            <MaterialConsumoView
              obraId={String(activeObraState?.id || 0)}
            />
          )}

        </main>
      </div>

    </div>
  );
}
