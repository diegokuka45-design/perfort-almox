// ============================================================================
// Firestore Collection Path Helpers — PerfortAlmox
// ============================================================================
// Mirrors the localStorage tenant-prefix pattern:
//   Global keys  → top-level Firestore collections
//   tenant_XX_YY → sub-collections under tenants/{obraId}
//
// This module is the single source of truth for every Firestore path.
// All Firestore reads/writes MUST go through these helpers.
// ============================================================================

// ---------- Top-level (global) collections ----------
export const COL_OBRAS     = 'obras';
export const COL_USERS    = 'users';
export const COL_SESSIONS = 'sessions';   // not really needed (Firebase Auth)
export const COL_AUDIT    = 'audit';

// ---------- Tenant root document ----------
export const COL_TENANTS = 'tenants';

/** Returns the Firestore doc path for a tenant root doc: tenants/{obraId} */
export function tenantDocPath(obraId: number | string): string {
  return `${COL_TENANTS}/${obraId}`;
}

// ---------- Tenant sub-collections ----------
// Each tenant obra has these sub-collections:
export const SUBCOL_ITEMS           = 'items';
export const SUBCOL_ENTRADAS       = 'entradas';
export const SUBCOL_SAIDAS         = 'saidas';
export const SUBCOL_EMPRESTIMOS   = 'emprestimos';
export const SUBCOL_EPIS          = 'epis';
export const SUBCOL_MATERIAIS_CONSUMO = 'materiaisConsumo';
export const SUBCOL_IMPORTED_INSUMOS = 'importedInsumos';
export const SUBCOL_CQ_CONCRETAGEM   = 'cq_concretagem';
export const SUBCOL_EPI_BACKUPS     = 'epi_backups';
export const SUBCOL_BACKUPS         = 'backups';
export const SUBCOL_COUNTERS        = 'counters';

// ---------- Path builder helpers ----------

export function itemsColPath(obraId: number | string): string {
  return `${tenantDocPath(obraId)}/${SUBCOL_ITEMS}`;
}

export function entradasColPath(obraId: number | string): string {
  return `${tenantDocPath(obraId)}/${SUBCOL_ENTRADAS}`;
}

export function saidasColPath(obraId: number | string): string {
  return `${tenantDocPath(obraId)}/${SUBCOL_SAIDAS}`;
}

export function emprestimosColPath(obraId: number | string): string {
  return `${tenantDocPath(obraId)}/${SUBCOL_EMPRESTIMOS}`;
}

export function episColPath(obraId: number | string): string {
  return `${tenantDocPath(obraId)}/${SUBCOL_EPIS}`;
}

export function materiaisConsumoColPath(obraId: number | string): string {
  return `${tenantDocPath(obraId)}/${SUBCOL_MATERIAIS_CONSUMO}`;
}

export function importedInsumosColPath(obraId: number | string): string {
  return `${tenantDocPath(obraId)}/${SUBCOL_IMPORTED_INSUMOS}`;
}

export function cqConcretagemColPath(obraId: number | string): string {
  return `${tenantDocPath(obraId)}/${SUBCOL_CQ_CONCRETAGEM}`;
}

export function epiBackupsColPath(obraId: number | string): string {
  return `${tenantDocPath(obraId)}/${SUBCOL_EPI_BACKUPS}`;
}

export function backupsColPath(obraId: number | string): string {
  return `${tenantDocPath(obraId)}/${SUBCOL_BACKUPS}`;
}
