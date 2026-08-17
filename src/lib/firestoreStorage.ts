// ============================================================================
// Firestore-backed Storage — DROP-IN REPLACEMENT for storage.ts
// ============================================================================
// Every exported name and signature matches storage.ts exactly.
// Components only need to change their import path.
//
// When Firebase is not configured (no VITE_FIREBASE_* env vars),
// ALL calls fall through to the original localStorage functions
// so the app works identically in "offline / demo" mode.
//
// PDF generation and pure utility functions (formatCurrency, getSaldo, etc.)
// stay in storage.ts and are re-exported here for convenience.
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';

import { db, hasRealConfig } from './firebase';
import {
  COL_OBRAS,
  COL_USERS,
  COL_AUDIT,
  COL_TENANTS,
  SUBCOL_ITEMS,
  SUBCOL_ENTRADAS,
  SUBCOL_SAIDAS,
  SUBCOL_EMPRESTIMOS,
  SUBCOL_EPIS,
  SUBCOL_MATERIAIS_CONSUMO,
  SUBCOL_IMPORTED_INSUMOS,
  SUBCOL_CQ_CONCRETAGEM,
  SUBCOL_EPI_BACKUPS,
  SUBCOL_BACKUPS,
  tenantDocPath,
} from './firebaseCollections';

// ---------- Re-export ALL PDF / utility functions from storage.ts ----------
export {
  getSaldo,
  getStatus,
  formatCurrency,
  formatNumber,
  exportReportPDF,
  exportCQConcretagemPDF,
  generateEpiFichaPDF,
  generateEpiConsumedReport,
  generateFichaEpiConsolidada,
  exportToExcel,
} from './storage';

// ---------- Import original localStorage functions for fallback ----------
import {
  getActiveObra as _lsGetActiveObra,
  setActiveObra as _lsSetActiveObra,
  getTenantPrefix as _lsGetTenantPrefix,
  tset as _lsTset,
  tget as _lsTget,
  getUsers as _lsGetUsers,
  saveUsers as _lsSaveUsers,
  getCurrentSession as _lsGetCurrentSession,
  setCurrentSession as _lsSetCurrentSession,
  getObras as _lsGetObras,
  saveObras as _lsSaveObras,
  getTenantData as _lsGetTenantData,
  saveTenantData as _lsSaveTenantData,
  getInsumos as _lsGetInsumos,
  saveInsumos as _lsSaveInsumos,
  getEmprestimos as _lsGetEmprestimos,
  saveEmprestimos as _lsSaveEmprestimos,
  getNextEmprestimoId as _lsGetNextEmprestimoId,
  getEpis as _lsGetEpis,
  saveEpis as _lsSaveEpis,
  getNextEpiId as _lsGetNextEpiId,
  getMateriaisConsumo as _lsGetMateriaisConsumo,
  saveMateriaisConsumo as _lsSaveMateriaisConsumo,
  getNextMaterialConsumoId as _lsGetNextMaterialConsumoId,
  getImportedInsumos as _lsGetImportedInsumos,
  addImportedInsumo as _lsAddImportedInsumo,
  isInsumoAlreadyInObra as _lsIsInsumoAlreadyInObra,
  createEpiDailyBackup as _lsCreateEpiDailyBackup,
  getEpiDailyBackups as _lsGetEpiDailyBackups,
  auditLog as _lsAuditLog,
  getAuditLogs as _lsGetAuditLogs,
  createBackup as _lsCreateBackup,
  getBackupsList as _lsGetBackupsList,
  restoreBackup as _lsRestoreBackup,
  deleteBackup as _lsDeleteBackup,
} from './storage';

// ---------- Import types ----------
import type {
  Obra,
  User,
  ItemInsumo,
  EntradaStock,
  SaidaStock,
  CQConcretagem,
  EmprestimoFerramenta,
  EpiFornecimento,
  MaterialConsumo,
  AuditLogEntry,
  BackupSnapshot,
} from '../types';

// ---------- Import + Re-export TenantData & CadastroImportedInsumo ----------
import type { TenantData, CadastroImportedInsumo } from './storage';
export type { TenantData, CadastroImportedInsumo };

// ============================================================================
// In-memory cache — avoids redundant Firestore reads within the same render.
// Cleared on each write so stale data never persists.
// ============================================================================

const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_MS = 5_000; // 5 seconds

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data as T;
  cache.delete(key);
  return null;
}

function cacheSet(key: string, data: any): void {
  cache.set(key, { data, ts: Date.now() });
}

function cacheInvalidate(prefixes: string[]): void {
  for (const k of cache.keys()) {
    if (prefixes.some(p => k.startsWith(p))) cache.delete(k);
  }
}

// ============================================================================
// Helper — ensure db is available, else log & return false
// ============================================================================
function ensureDb(): NonNullable<typeof db> | null {
  if (!db || !hasRealConfig) {
    console.warn('[Firestore] No Firebase config — using localStorage fallback.');
    return null;
  }
  return db;
}

// ============================================================================
// Counter document pattern for auto-increment IDs
// ============================================================================
// In Firestore we use a dedicated counters document under each tenant:
//   tenants/{obraId}/counters  → { nextEntradaId, nextSaidaId, ... }
// ============================================================================

const SUBCOL_COUNTERS = 'counters';
const COUNTER_DOC_ID = 'ids';

interface CounterDoc {
  nextEntradaId: number;
  nextSaidaId: number;
  nextEmprestimoId: number;
  nextEpiId: number;
  nextMaterialConsumoId: number;
}

async function getNextId(obraId: number | string, field: keyof CounterDoc): Promise<string> {
  const d = ensureDb();
  if (!d) {
    // Fallback to localStorage sync counters
    const fnMap: Record<keyof CounterDoc, () => string> = {
      nextEntradaId: _lsGetNextEmprestimoId, // We read from tenant data directly below
      nextSaidaId: _lsGetNextEmprestimoId,
      nextEmprestimoId: _lsGetNextEmprestimoId,
      nextEpiId: _lsGetNextEpiId,
      nextMaterialConsumoId: _lsGetNextMaterialConsumoId,
    };
    return '0'; // will be handled by the sync wrappers below
  }

  const counterRef = doc(d, tenantDocPath(obraId), SUBCOL_COUNTERS, COUNTER_DOC_ID);
  const snap = await getDoc(counterRef);
  const current = snap.exists() ? (snap.data() as CounterDoc) : null;
  const next = (current?.[field] ?? 1);
  await setDoc(counterRef, { ...current, [field]: next + 1 }, { merge: true });
  return String(next);
}

// ============================================================================
// 1. Active Obra
// ============================================================================

export function getActiveObra(): Obra | null {
  // Always read from localStorage for synchronous access.
  // Firestore sync is handled by a separate hook (useActiveObraSync).
  return _lsGetActiveObra();
}

export function setActiveObra(obra: Obra | null): void {
  _lsSetActiveObra(obra);
  // Mirror to Firestore (async, non-blocking)
  if (obra && ensureDb()) {
    const d = ensureDb()!;
    setDoc(doc(d, COL_OBRAS, String(obra.id)), obra, { merge: true }).catch(console.error);
    // Also store the "active" pointer in a global doc
    setDoc(doc(d, 'app_state', 'active_obra'), { obraId: obra.id, updatedAt: serverTimestamp() }).catch(console.error);
  }
}

export function getTenantPrefix(): string {
  return _lsGetTenantPrefix();
}

// ============================================================================
// 2. tget / tset — Generic tenant-scoped access
// ============================================================================
// These are synchronous in the original localStorage API.
// For Firestore they fall back to localStorage (tenant data is better
// accessed via the specific get*/save* functions below that are async-aware).
// tget/tset are primarily used by App.tsx for cq_concretagem and epi backups.

export function tset<T>(key: string, value: T): void {
  _lsTset(key, value); // keep localStorage as hot cache
  if (!ensureDb()) return;
  const d = ensureDb()!;
  const obra = getActiveObra();
  if (!obra) return;
  const obraId = String(obra.id);

  // Map well-known keys to Firestore sub-collections
  const keyToSubcol: Record<string, string> = {
    data: SUBCOL_ITEMS, // we handle 'data' via saveTenantData below, ignore here
    cq_concretagem: SUBCOL_CQ_CONCRETAGEM,
    epi_daily_backup: SUBCOL_EPI_BACKUPS,
    backups_list: SUBCOL_BACKUPS,
  };

  const subcol = keyToSubcol[key];
  if (subcol) {
    // Store as a single document with id = 'main' under the sub-collection
    setDoc(doc(d, tenantDocPath(obraId), subcol, 'main'), { payload: value, updatedAt: serverTimestamp() }, { merge: true }).catch(console.error);
  }
}

export function tget<T>(key: string, defaultValue: T): T {
  // Synchronous — always from localStorage cache
  // Firestore data is loaded asynchronously and updates localStorage
  return _lsTget(key, defaultValue);
}

// ============================================================================
// 3. Users
// ============================================================================

export function getUsers(): User[] {
  if (!ensureDb()) return _lsGetUsers();
  // For sync calls, return localStorage copy.
  // Firestore users collection is kept in sync by useFirestoreSync hook.
  return _lsGetUsers();
}

export function saveUsers(users: User[]): void {
  _lsSaveUsers(users); // keep localStorage current
  if (!ensureDb()) return;
  const d = ensureDb()!;
  // Write each user as a document: users/{username}
  // Also write the whole array to a single doc for quick reads
  setDoc(doc(d, COL_USERS, '__list__'), { users, updatedAt: serverTimestamp() }).catch(console.error);
}

// ============================================================================
// 4. Session
// ============================================================================

export function getCurrentSession(): { username: string; role: string; permissoes: string[] } | null {
  return _lsGetCurrentSession();
}

export function setCurrentSession(session: { username: string; role: string; permissoes: string[] } | null): void {
  _lsSetCurrentSession(session);
  // Session is intentionally NOT written to Firestore for security.
  // Firebase Auth manages sessions server-side.
}

// ============================================================================
// 5. Obras
// ============================================================================

export function getObras(): Obra[] {
  if (!ensureDb()) return _lsGetObras();
  return _lsGetObras(); // sync read from localStorage cache
}

export function saveObras(obras: Obra[]): void {
  _lsSaveObras(obras);
  if (!ensureDb()) return;
  const d = ensureDb()!;
  // Write list doc
  setDoc(doc(d, COL_OBRAS, '__list__'), { obras, updatedAt: serverTimestamp() }).catch(console.error);
  // Write individual docs
  obras.forEach(obra => {
    setDoc(doc(d, COL_OBRAS, String(obra.id)), obra, { merge: true }).catch(console.error);
  });
}

// ============================================================================
// 6. TenantData — The Big One
// ============================================================================
// In localStorage, TenantData is a single JSON blob.
// In Firestore, we split it into sub-collections for better performance,
// but getTenantData/saveTenantData still work with the assembled object.
//
// Firestore layout per tenant:
//   tenants/{obraId}/items/{codigo}        → ItemInsumo (keyed by codigo)
//   tenants/{obraId}/entradas/{id}         → EntradaStock
//   tenants/{obraId}/saidas/{id}           → SaidaStock
//   tenants/{obraId}/emprestimos/{id}      → EmprestimoFerramenta
//   tenants/{obraId}/epis/{id}             → EpiFornecimento
//   tenants/{obraId}/materiaisConsumo/{id}  → MaterialConsumo
//   tenants/{obraId}/counters/ids           → { nextEntradaId, ... }
// ============================================================================

export function getTenantData(): TenantData {
  // Synchronous — returns localStorage cached version.
  // Use loadTenantDataFromFirestore() to populate the cache.
  return _lsGetTenantData();
}

/**
 * Async: Load full TenantData from Firestore and update localStorage cache.
 * Call this on app init or obra switch.
 */
export async function loadTenantDataFromFirestore(obraId: number | string): Promise<TenantData | null> {
  const d = ensureDb();
  if (!d) return null;

  const basePath = tenantDocPath(obraId);

  try {
    const [itemsSnap, entradasSnap, saidasSnap, emprestimosSnap, episSnap, materiaisSnap, countersSnap] = await Promise.all([
      getDocs(collection(d, basePath, SUBCOL_ITEMS)),
      getDocs(collection(d, basePath, SUBCOL_ENTRADAS)),
      getDocs(collection(d, basePath, SUBCOL_SAIDAS)),
      getDocs(collection(d, basePath, SUBCOL_EMPRESTIMOS)),
      getDocs(collection(d, basePath, SUBCOL_EPIS)),
      getDocs(collection(d, basePath, SUBCOL_MATERIAIS_CONSUMO)),
      getDoc(doc(d, basePath, SUBCOL_COUNTERS, COUNTER_DOC_ID)),
    ]);

    const items: ItemInsumo[] = itemsSnap.docs.map(s => s.data() as ItemInsumo);
    const entradas: EntradaStock[] = entradasSnap.docs.map(s => s.data() as EntradaStock);
    const saidas: SaidaStock[] = saidasSnap.docs.map(s => s.data() as SaidaStock);
    const emprestimos: EmprestimoFerramenta[] = emprestimosSnap.docs.map(s => s.data() as EmprestimoFerramenta);
    const epis: EpiFornecimento[] = episSnap.docs.map(s => s.data() as EpiFornecimento);
    const materiaisConsumo: MaterialConsumo[] = materiaisSnap.docs.map(s => s.data() as MaterialConsumo);
    const counters: CounterDoc = countersSnap.exists() ? (countersSnap.data() as CounterDoc) : {
      nextEntradaId: 1, nextSaidaId: 1, nextEmprestimoId: 1, nextEpiId: 1, nextMaterialConsumoId: 1,
    };

    const tenantData: TenantData = {
      items,
      entradas,
      saidas,
      nextEntradaId: counters.nextEntradaId,
      nextSaidaId: counters.nextSaidaId,
      emprestimos,
      nextEmprestimoId: counters.nextEmprestimoId,
      epis,
      nextEpiId: counters.nextEpiId,
      materiaisConsumo,
      nextMaterialConsumoId: counters.nextMaterialConsumoId,
    };

    // Update localStorage cache
    _lsSaveTenantData(tenantData);

    return tenantData;
  } catch (err) {
    console.error('[Firestore] Error loading tenant data:', err);
    return null;
  }
}

export function saveTenantData(data: TenantData): void {
  _lsSaveTenantData(data); // always keep localStorage current
  if (!ensureDb()) return;
  const d = ensureDb()!;
  const obra = getActiveObra();
  if (!obra) return;
  const obraId = String(obra.id);
  const basePath = tenantDocPath(obraId);

  // Write sub-collections (fire-and-forget, non-blocking)
  // Items — keyed by codigo
  data.items.forEach(item => {
    const docId = String(item.codigo);
    setDoc(doc(d, basePath, SUBCOL_ITEMS, docId), { ...item, updatedAt: serverTimestamp() }, { merge: true }).catch(console.error);
  });

  // Entradas — keyed by id
  data.entradas.forEach(e => {
    setDoc(doc(d, basePath, SUBCOL_ENTRADAS, String(e.id)), { ...e, updatedAt: serverTimestamp() }, { merge: true }).catch(console.error);
  });

  // Saidas
  data.saidas.forEach(s => {
    setDoc(doc(d, basePath, SUBCOL_SAIDAS, String(s.id)), { ...s, updatedAt: serverTimestamp() }, { merge: true }).catch(console.error);
  });

  // Emprestimos
  data.emprestimos.forEach(emp => {
    setDoc(doc(d, basePath, SUBCOL_EMPRESTIMOS, String(emp.id)), { ...emp, updatedAt: serverTimestamp() }, { merge: true }).catch(console.error);
  });

  // Epis
  data.epis.forEach(epi => {
    setDoc(doc(d, basePath, SUBCOL_EPIS, String(epi.id)), { ...epi, updatedAt: serverTimestamp() }, { merge: true }).catch(console.error);
  });

  // Materiais Consumo
  data.materiaisConsumo.forEach(mc => {
    setDoc(doc(d, basePath, SUBCOL_MATERIAIS_CONSUMO, String(mc.id)), { ...mc, updatedAt: serverTimestamp() }, { merge: true }).catch(console.error);
  });

  // Counters
  const counterDoc: CounterDoc = {
    nextEntradaId: data.nextEntradaId,
    nextSaidaId: data.nextSaidaId,
    nextEmprestimoId: data.nextEmprestimoId,
    nextEpiId: data.nextEpiId,
    nextMaterialConsumoId: data.nextMaterialConsumoId,
  };
  setDoc(doc(d, basePath, SUBCOL_COUNTERS, COUNTER_DOC_ID), { ...counterDoc, updatedAt: serverTimestamp() }, { merge: true }).catch(console.error);
}

// ============================================================================
// 7. Insumos Helpers
// ============================================================================

export function getInsumos(): ItemInsumo[] {
  return _lsGetInsumos();
}

export function saveInsumos(items: ItemInsumo[]): void {
  _lsSaveInsumos(items);
  // Firestore is updated via saveTenantData call chain
}

// ============================================================================
// 8. Emprestimo de Ferramentas
// ============================================================================

export function getEmprestimos(): EmprestimoFerramenta[] {
  return _lsGetEmprestimos();
}

export function saveEmprestimos(emprestimos: EmprestimoFerramenta[]): void {
  _lsSaveEmprestimos(emprestimos);
}

export function getNextEmprestimoId(): string {
  return _lsGetNextEmprestimoId();
}

// ============================================================================
// 9. EPI Fornecimento
// ============================================================================

export function getEpis(): EpiFornecimento[] {
  return _lsGetEpis();
}

export function saveEpis(epis: EpiFornecimento[]): void {
  _lsSaveEpis(epis);
}

export function getNextEpiId(): string {
  return _lsGetNextEpiId();
}

// ============================================================================
// 10. Material de Consumo
// ============================================================================

export function getMateriaisConsumo(): MaterialConsumo[] {
  return _lsGetMateriaisConsumo();
}

export function saveMateriaisConsumo(materiais: MaterialConsumo[]): void {
  _lsSaveMateriaisConsumo(materiais);
}

export function getNextMaterialConsumoId(): string {
  return _lsGetNextMaterialConsumoId();
}

// ============================================================================
// 11. Imported Insumos (CadastroView)
// ============================================================================

export function getImportedInsumos(): CadastroImportedInsumo[] {
  return _lsGetImportedInsumos();
}

export function addImportedInsumo(insumo: CadastroImportedInsumo): void {
  _lsAddImportedInsumo(insumo);
  if (!ensureDb()) return;
  const d = ensureDb()!;
  const obra = getActiveObra();
  if (!obra) return;

  const entry = {
    id: insumo.id,
    codigo: insumo.codigo,
    nome: insumo.nome + (insumo.variacao ? ' - ' + insumo.variacao : ''),
    familia: insumo.familia,
  };
  setDoc(doc(d, tenantDocPath(String(obra.id)), SUBCOL_IMPORTED_INSUMOS, insumo.codigo), entry, { merge: true }).catch(console.error);
}

export function isInsumoAlreadyInObra(nome: string, variacao: string, obraId: string): boolean {
  return _lsIsInsumoAlreadyInObra(nome, variacao, obraId);
}

// ============================================================================
// 12. EPI Daily Backups
// ============================================================================

export function createEpiDailyBackup(): void {
  _lsCreateEpiDailyBackup();
  if (!ensureDb()) return;
  const d = ensureDb()!;
  const obra = getActiveObra();
  if (!obra) return;

  const backups = _lsGetEpiDailyBackups();
  // Overwrite the 'main' doc
  setDoc(doc(d, tenantDocPath(String(obra.id)), SUBCOL_EPI_BACKUPS, 'main'), { payload: backups, updatedAt: serverTimestamp() }, { merge: true }).catch(console.error);
}

export function getEpiDailyBackups(): any[] {
  return _lsGetEpiDailyBackups();
}

// ============================================================================
// 13. Audit Log
// ============================================================================

export function auditLog(action: string, detail: string): void {
  _lsAuditLog(action, detail);
  if (!ensureDb()) return;
  const d = ensureDb()!;
  const session = getCurrentSession();
  const activeObra = getActiveObra();

  const entry = {
    timestamp: new Date().toLocaleString('pt-BR'),
    username: session ? session.username : 'desconhecido',
    action,
    detail,
    obra: activeObra ? activeObra.nome : 'Geral',
    createdAt: serverTimestamp(),
  };

  addDoc(collection(d, COL_AUDIT), entry).catch(console.error);
}

export function getAuditLogs(): AuditLogEntry[] {
  return _lsGetAuditLogs();
}

/**
 * Async: Load audit logs from Firestore (for BackupView).
 */
export async function loadAuditLogsFromFirestore(): Promise<AuditLogEntry[]> {
  const d = ensureDb();
  if (!d) return _lsGetAuditLogs();

  try {
    const q = query(collection(d, COL_AUDIT), orderBy('createdAt', 'desc'), limit(500));
    const snap = await getDocs(q);
    const logs: AuditLogEntry[] = snap.docs.map(s => {
      const d = s.data();
      return {
        timestamp: d.timestamp,
        username: d.username,
        action: d.action,
        detail: d.detail,
        obra: d.obra,
      };
    });
    // Cache to localStorage
    localStorage.setItem('perfort_almox_audit', JSON.stringify(logs));
    return logs;
  } catch (err) {
    console.error('[Firestore] Error loading audit logs:', err);
    return _lsGetAuditLogs();
  }
}

// ============================================================================
// 14. Backups
// ============================================================================

export function createBackup(name?: string): BackupSnapshot {
  const snapshot = _lsCreateBackup(name);
  if (!ensureDb()) return snapshot;
  const d = ensureDb()!;
  const obra = getActiveObra();
  if (!obra) return snapshot;

  // Store backup in Firestore
  setDoc(doc(d, tenantDocPath(obra.id), SUBCOL_BACKUPS, snapshot.name), {
    ...snapshot,
    createdAt: serverTimestamp(),
  }).catch(console.error);

  return snapshot;
}

export function getBackupsList(): BackupSnapshot[] {
  return _lsGetBackupsList();
}

export function restoreBackup(snapshot: BackupSnapshot): boolean {
  return _lsRestoreBackup(snapshot);
}

export function deleteBackup(snapshotName: string): void {
  _lsDeleteBackup(snapshotName);
  if (!ensureDb()) return;
  const d = ensureDb()!;
  const obra = getActiveObra();
  if (!obra) return;

  deleteDoc(doc(d, tenantDocPath(String(obra.id)), SUBCOL_BACKUPS, snapshotName)).catch(console.error);
}

// ============================================================================
// 15. CQ Concretagem — App.tsx uses tget/tset directly
// ============================================================================
// The generic tset/tget functions above handle the 'cq_concretagem' key.
// For explicit typed access:

export function getCQConcretagem(): CQConcretagem[] {
  return tget<CQConcretagem[]>('cq_concretagem', []);
}

export function saveCQConcretagem(list: CQConcretagem[]): void {
  tset('cq_concretagem', list);
}

// ============================================================================
// 16. Firestore Real-time Sync Hook Helpers
// ============================================================================
// These are NEW functions (not in original storage.ts) that components
// can opt-in to use for real-time Firestore subscriptions.
// They are optional — the app works fine without them.
// ============================================================================

/** Subscribe to real-time updates for obras collection */
export function subscribeToObras(onUpdate: (obras: Obra[]) => void): Unsubscribe | null {
  const d = ensureDb();
  if (!d) return null;

  return onSnapshot(doc(d, COL_OBRAS, '__list__'), (snap) => {
    if (snap.exists()) {
      const obras = snap.data().obras as Obra[];
      _lsSaveObras(obras);
      onUpdate(obras);
    }
  }, console.error);
}

/** Subscribe to real-time updates for users collection */
export function subscribeToUsers(onUpdate: (users: User[]) => void): Unsubscribe | null {
  const d = ensureDb();
  if (!d) return null;

  return onSnapshot(doc(d, COL_USERS, '__list__'), (snap) => {
    if (snap.exists()) {
      const users = snap.data().users as User[];
      _lsSaveUsers(users);
      onUpdate(users);
    }
  }, console.error);
}

/** Subscribe to real-time tenant data updates */
export function subscribeToTenantData(
  obraId: number | string,
  onUpdate: (data: TenantData) => void
): Unsubscribe | null {
  const d = ensureDb();
  if (!d) return null;

  // Subscribe to each sub-collection and assemble TenantData
  let items: ItemInsumo[] = [];
  let entradas: EntradaStock[] = [];
  let saidas: SaidaStock[] = [];
  let emprestimos: EmprestimoFerramenta[] = [];
  let epis: EpiFornecimento[] = [];
  let materiaisConsumo: MaterialConsumo[] = [];
  let counters: CounterDoc = { nextEntradaId: 1, nextSaidaId: 1, nextEmprestimoId: 1, nextEpiId: 1, nextMaterialConsumoId: 1 };

  const basePath = tenantDocPath(obraId);

  const emit = () => {
    const data: TenantData = {
      items,
      entradas,
      saidas,
      nextEntradaId: counters.nextEntradaId,
      nextSaidaId: counters.nextSaidaId,
      emprestimos,
      nextEmprestimoId: counters.nextEmprestimoId,
      epis,
      nextEpiId: counters.nextEpiId,
      materiaisConsumo,
      nextMaterialConsumoId: counters.nextMaterialConsumoId,
    };
    _lsSaveTenantData(data);
    onUpdate(data);
  };

  // We use a single listener on the counters doc to trigger assembly.
  // Individual sub-collection listeners would be too many.
  // For a robust real-time experience, use loadTenantDataFromFirestore on init
  // and then subscribe to counters for change detection.
  const unsub = onSnapshot(doc(d, basePath, SUBCOL_COUNTERS, COUNTER_DOC_ID), async () => {
    // Something changed — reload all data
    const loaded = await loadTenantDataFromFirestore(obraId);
    if (loaded) onUpdate(loaded);
  }, console.error);

  return unsub;
}

// ============================================================================
// 17. Batch Write — Full sync from localStorage to Firestore
// ============================================================================
// Used by migration utility and manual sync buttons.

export async function syncAllToFirestore(): Promise<void> {
  const d = ensureDb();
  if (!d) return;

  const obras = _lsGetObras();
  const users = _lsGetUsers();
  const tenantData = _lsGetTenantData();
  const obra = _lsGetActiveObra();

  // Global data
  await setDoc(doc(d, COL_OBRAS, '__list__'), { obras, updatedAt: serverTimestamp() });
  await setDoc(doc(d, COL_USERS, '__list__'), { users, updatedAt: serverTimestamp() });

  // Per-obra tenant data
  if (obra) {
    const obraId = String(obra.id);
    const basePath = tenantDocPath(obraId);

    // Batch write all sub-collections
    const batch = writeBatch(d);

    tenantData.items.forEach(item => {
      batch.set(doc(d, basePath, SUBCOL_ITEMS, String(item.codigo)), { ...item, updatedAt: serverTimestamp() }, { merge: true });
    });

    tenantData.entradas.forEach(e => {
      batch.set(doc(d, basePath, SUBCOL_ENTRADAS, String(e.id)), { ...e, updatedAt: serverTimestamp() }, { merge: true });
    });

    tenantData.saidas.forEach(s => {
      batch.set(doc(d, basePath, SUBCOL_SAIDAS, String(s.id)), { ...s, updatedAt: serverTimestamp() }, { merge: true });
    });

    tenantData.emprestimos.forEach(emp => {
      batch.set(doc(d, basePath, SUBCOL_EMPRESTIMOS, String(emp.id)), { ...emp, updatedAt: serverTimestamp() }, { merge: true });
    });

    tenantData.epis.forEach(epi => {
      batch.set(doc(d, basePath, SUBCOL_EPIS, String(epi.id)), { ...epi, updatedAt: serverTimestamp() }, { merge: true });
    });

    tenantData.materiaisConsumo.forEach(mc => {
      batch.set(doc(d, basePath, SUBCOL_MATERIAIS_CONSUMO, String(mc.id)), { ...mc, updatedAt: serverTimestamp() }, { merge: true });
    });

    // Counters
    batch.set(doc(d, basePath, SUBCOL_COUNTERS, COUNTER_DOC_ID), {
      nextEntradaId: tenantData.nextEntradaId,
      nextSaidaId: tenantData.nextSaidaId,
      nextEmprestimoId: tenantData.nextEmprestimoId,
      nextEpiId: tenantData.nextEpiId,
      nextMaterialConsumoId: tenantData.nextMaterialConsumoId,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // CQ Concretagem
    const cqData = _lsTget<CQConcretagem[]>('cq_concretagem', []);
    if (cqData.length > 0) {
      batch.set(doc(d, basePath, SUBCOL_CQ_CONCRETAGEM, 'main'), { payload: cqData, updatedAt: serverTimestamp() }, { merge: true });
    }

    // EPI backups
    const epiBackups = _lsTget<any[]>('epi_daily_backup', []);
    if (epiBackups.length > 0) {
      batch.set(doc(d, basePath, SUBCOL_EPI_BACKUPS, 'main'), { payload: epiBackups, updatedAt: serverTimestamp() }, { merge: true });
    }

    // Backups list
    const backupsList = _lsTget<BackupSnapshot[]>('backups_list', []);
    if (backupsList.length > 0) {
      backupsList.forEach(b => {
        batch.set(doc(d, basePath, SUBCOL_BACKUPS, b.name), { ...b, updatedAt: serverTimestamp() }, { merge: true });
      });
    }

    // Imported Insumos
    const importedInsumos = _lsTget<any[]>('importedInsumos', []);
    if (importedInsumos.length > 0) {
      importedInsumos.forEach((ii: any) => {
        batch.set(doc(d, basePath, SUBCOL_IMPORTED_INSUMOS, String(ii.codigo)), { ...ii, updatedAt: serverTimestamp() }, { merge: true });
      });
    }

    await batch.commit();
  }

  console.log('[Firestore] Full sync completed.');
}

// ============================================================================
// 18. Batch Read — Full sync from Firestore to localStorage
// ============================================================================

export async function syncAllFromFirestore(): Promise<void> {
  const d = ensureDb();
  if (!d) return;

  // Global data
  const [obrasSnap, usersSnap] = await Promise.all([
    getDoc(doc(d, COL_OBRAS, '__list__')),
    getDoc(doc(d, COL_USERS, '__list__')),
  ]);

  if (obrasSnap.exists()) _lsSaveObras(obrasSnap.data().obras as Obra[]);
  if (usersSnap.exists()) _lsSaveUsers(usersSnap.data().users as User[]);

  // Tenant data — load for active obra
  const obra = _lsGetActiveObra();
  if (obra) {
    await loadTenantDataFromFirestore(obra.id);
  }

  console.log('[Firestore] Full pull from Firestore completed.');
}
