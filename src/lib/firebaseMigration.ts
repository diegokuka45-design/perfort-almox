// ============================================================================
// Versioned Migration Utility — localStorage → Firestore + ID normalization
// ============================================================================
// Usage:
//   import { runMigration } from '../lib/firebaseMigration';
//   const result = await runMigration();
//
// Call once after Firebase is configured.
// Moves ALL localStorage data into Firestore collections.
// After migration completes, localStorage remains as a read-through cache.
//
// v2: Also normalizes all numeric IDs to strings across the codebase.
// ============================================================================

import { db, hasRealConfig } from './firebase';
import {
  COL_OBRAS,
  COL_USERS,
  COL_AUDIT,
  tenantDocPath,
  SUBCOL_ITEMS,
  SUBCOL_ENTRADAS,
  SUBCOL_SAIDAS,
  SUBCOL_EMPRESTIMOS,
  SUBCOL_EPIS,
  SUBCOL_MATERIAIS_CONSUMO,
  SUBCOL_CQ_CONCRETAGEM,
  SUBCOL_EPI_BACKUPS,
  SUBCOL_BACKUPS,
  SUBCOL_IMPORTED_INSUMOS,
  SUBCOL_COUNTERS,
} from './firebaseCollections';
import {
  collection,
  doc,
  setDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

// ---------- Import localStorage readers ----------
import { getObras, getUsers, getActiveObra, tget, getTenantData, getAuditLogs, getBackupsList, saveObras, saveTenantData, tset } from './storage';
import type { Obra, CQConcretagem, BackupSnapshot, EntradaStock, SaidaStock, EmprestimoFerramenta, EpiFornecimento, MaterialConsumo } from '../types';
import type { TenantData } from './storage';

export interface MigrationResult {
  success: boolean;
  obrasCount: number;
  usersCount: number;
  tenantDataMigrated: string[]; // obra IDs
  auditLogCount: number;
  backupsCount: number;
  errors: string[];
  durationMs: number;
  normalizedIds: number;
}

const CURRENT_MIGRATION_VERSION = 2;
const MIGRATION_VERSION_KEY = 'perfort_almox_migration_version';

/** Check if migration has already been run at the current version */
export function isMigrationDone(): boolean {
  const v = localStorage.getItem(MIGRATION_VERSION_KEY);
  return v !== null && Number(v) >= CURRENT_MIGRATION_VERSION;
}

/** Mark migration as completed at the current version */
export function markMigrationDone(): void {
  localStorage.setItem(MIGRATION_VERSION_KEY, String(CURRENT_MIGRATION_VERSION));
}

/** Reset migration flag (for re-running) */
export function resetMigrationFlag(): void {
  localStorage.removeItem(MIGRATION_VERSION_KEY);
}

/**
 * v2: Normalize all numeric IDs to strings in localStorage.
 * This runs BEFORE the Firestore upload so that all data is string-based.
 */
function normalizeIdsToStrings(): number {
  let normalizedCount = 0;

  // ---- Obras: id number → string ----
  const obras: Obra[] = getObras();
  obras.forEach(o => {
    if (typeof o.id === 'number') {
      (o as any).id = String(o.id);
      normalizedCount++;
    }
  });
  saveObras(obras);

  // ---- Per-obra tenant data ----
  const currentActiveObra = getActiveObra();

  obras.forEach(obra => {
    // Temporarily set active obra so tget reads correct data
    localStorage.setItem('perfort_almox_obra_atual', JSON.stringify(obra));

    const tenantData: TenantData = tget<TenantData>('data', {
      items: [], entradas: [], saidas: [],
      nextEntradaId: 1, nextSaidaId: 1,
      emprestimos: [], nextEmprestimoId: 1,
      epis: [], nextEpiId: 1,
      materiaisConsumo: [], nextMaterialConsumoId: 1,
    });

    // ---- Items: obraId number → string ----
    tenantData.items.forEach(item => {
      if (typeof (item as any).obraId === 'number') {
        (item as any).obraId = String((item as any).obraId);
        normalizedCount++;
      }
      if (typeof (item as any).id === 'number') {
        (item as any).id = String((item as any).id);
        normalizedCount++;
      }
    });

    // ---- Entradas: id number → string ----
    tenantData.entradas.forEach(e => {
      if (typeof e.id === 'number') {
        (e as any).id = String(e.id);
        normalizedCount++;
      }
    });

    // ---- Saídas: id number → string ----
    tenantData.saidas.forEach(s => {
      if (typeof s.id === 'number') {
        (s as any).id = String(s.id);
        normalizedCount++;
      }
    });

    // ---- Empréstimos: id/insumoId/obraId number → string ----
    tenantData.emprestimos.forEach(emp => {
      if (typeof emp.id === 'number') {
        (emp as any).id = String(emp.id);
        normalizedCount++;
      }
      if (typeof (emp as any).insumoId === 'number') {
        (emp as any).insumoId = String((emp as any).insumoId);
        normalizedCount++;
      }
      if (typeof (emp as any).obraId === 'number') {
        (emp as any).obraId = String((emp as any).obraId);
        normalizedCount++;
      }
    });

    // ---- EPIs: id/obraId number → string; epiItens[].insumoId number → string ----
    tenantData.epis.forEach(epi => {
      if (typeof epi.id === 'number') {
        (epi as any).id = String(epi.id);
        normalizedCount++;
      }
      if (typeof (epi as any).obraId === 'number') {
        (epi as any).obraId = String((epi as any).obraId);
        normalizedCount++;
      }
      if (epi.epiItens) {
        epi.epiItens.forEach(item => {
          if (typeof (item as any).insumoId === 'number') {
            (item as any).insumoId = String((item as any).insumoId);
            normalizedCount++;
          }
        });
      }
    });

    // ---- Materiais Consumo: id/insumoId/obraId number → string ----
    tenantData.materiaisConsumo.forEach(mc => {
      if (typeof mc.id === 'number') {
        (mc as any).id = String(mc.id);
        normalizedCount++;
      }
      if (typeof (mc as any).insumoId === 'number') {
        (mc as any).insumoId = String((mc as any).insumoId);
        normalizedCount++;
      }
      if (typeof (mc as any).obraId === 'number') {
        (mc as any).obraId = String((mc as any).obraId);
        normalizedCount++;
      }
    });

    // ---- CQ Concretagem: id number → string ----
    const cqList = tget<CQConcretagem[]>('cq_concretagem', []);
    cqList.forEach(cq => {
      if (typeof cq.id === 'number') {
        (cq as any).id = String(cq.id);
        normalizedCount++;
      }
    });
    if (cqList.length > 0) tset('cq_concretagem', cqList);

    saveTenantData(tenantData);
  });

  // Restore original active obra
  if (currentActiveObra) {
    localStorage.setItem('perfort_almox_obra_atual', JSON.stringify(currentActiveObra));
  }

  console.log(`[Migration v2] Normalized ${normalizedCount} IDs from number → string`);
  return normalizedCount;
}

/**
 * Run the full localStorage → Firestore migration (versioned).
 *
 * v1: Migrate all data to Firestore.
 * v2: Also normalize all numeric IDs to strings before uploading.
 *
 * Steps:
 * 1. Normalize IDs (v2)
 * 2. Migrate obras (global collection)
 * 3. Migrate users (global collection)
 * 4. For EACH obra: migrate tenant data (items, entradas, saidas, emprestimos, epis, materiaisConsumo, counters)
 * 5. Migrate CQ Concretagem per obra
 * 6. Migrate EPI backups per obra
 * 7. Migrate imported insumos per obra
 * 8. Migrate backups list per obra
 * 9. Migrate audit logs (global collection)
 */
export async function runMigration(): Promise<MigrationResult> {
  const startTime = Date.now();
  const result: MigrationResult = {
    success: false,
    obrasCount: 0,
    usersCount: 0,
    tenantDataMigrated: [],
    auditLogCount: 0,
    backupsCount: 0,
    errors: [],
    durationMs: 0,
    normalizedIds: 0,
  };

  if (!db || !hasRealConfig) {
    result.errors.push('Firebase not configured — cannot migrate.');
    result.durationMs = Date.now() - startTime;
    return result;
  }

  if (isMigrationDone()) {
    result.errors.push('Migration already completed at current version. Reset flag to re-run.');
    result.durationMs = Date.now() - startTime;
    return result;
  }

  try {
    // ---- Step 1: ID Normalization (v2) ----
    const normalizedCount = normalizeIdsToStrings();
    result.normalizedIds = normalizedCount;

    // ---- Step 2: Obras ----
    const obras: Obra[] = getObras();
    result.obrasCount = obras.length;
    await setDoc(doc(db, COL_OBRAS, '__list__'), { obras, updatedAt: serverTimestamp() });
    // Also write individual obra docs
    for (const obra of obras) {
      await setDoc(doc(db, COL_OBRAS, String(obra.id)), obra, { merge: true });
    }

    // ---- Step 3: Users ----
    const users = getUsers();
    result.usersCount = users.length;
    await setDoc(doc(db, COL_USERS, '__list__'), { users, updatedAt: serverTimestamp() });

    // ---- Step 4: For each obra, migrate tenant data ----
    const currentActiveObra = getActiveObra();

    for (const obra of obras) {
      try {
        const obraId = String(obra.id);
        const basePath = tenantDocPath(obraId);

        // Set active obra temporarily so tget reads correct data
        localStorage.setItem('perfort_almox_obra_atual', JSON.stringify(obra));

        const tenantData: TenantData = tget<TenantData>('data', {
          items: [], entradas: [], saidas: [],
          nextEntradaId: 1, nextSaidaId: 1,
          emprestimos: [], nextEmprestimoId: 1,
          epis: [], nextEpiId: 1,
          materiaisConsumo: [], nextMaterialConsumoId: 1,
        });

        // Use batched writes (max 500 per batch — Firebase limit)
        const batch = writeBatch(db);

        tenantData.items.forEach((item) => {
          batch.set(doc(db, basePath, SUBCOL_ITEMS, String(item.codigo)), { ...item, updatedAt: serverTimestamp() }, { merge: true });
        });

        tenantData.entradas.forEach(e => {
          batch.set(doc(db, basePath, SUBCOL_ENTRADAS, String(e.id)), { ...e, updatedAt: serverTimestamp() }, { merge: true });
        });

        tenantData.saidas.forEach(s => {
          batch.set(doc(db, basePath, SUBCOL_SAIDAS, String(s.id)), { ...s, updatedAt: serverTimestamp() }, { merge: true });
        });

        tenantData.emprestimos.forEach(emp => {
          batch.set(doc(db, basePath, SUBCOL_EMPRESTIMOS, String(emp.id)), { ...emp, updatedAt: serverTimestamp() }, { merge: true });
        });

        tenantData.epis.forEach(epi => {
          batch.set(doc(db, basePath, SUBCOL_EPIS, String(epi.id)), { ...epi, updatedAt: serverTimestamp() }, { merge: true });
        });

        tenantData.materiaisConsumo.forEach(mc => {
          batch.set(doc(db, basePath, SUBCOL_MATERIAIS_CONSUMO, String(mc.id)), { ...mc, updatedAt: serverTimestamp() }, { merge: true });
        });

        // Counters
        batch.set(doc(db, basePath, SUBCOL_COUNTERS, 'ids'), {
          nextEntradaId: tenantData.nextEntradaId,
          nextSaidaId: tenantData.nextSaidaId,
          nextEmprestimoId: tenantData.nextEmprestimoId,
          nextEpiId: tenantData.nextEpiId,
          nextMaterialConsumoId: tenantData.nextMaterialConsumoId,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        await batch.commit();

        // ---- Step 5: CQ Concretagem ----
        const cqList = tget<CQConcretagem[]>('cq_concretagem', []);
        if (cqList.length > 0) {
          await setDoc(doc(db, basePath, SUBCOL_CQ_CONCRETAGEM, 'main'), { payload: cqList, updatedAt: serverTimestamp() }, { merge: true });
        }

        // ---- Step 6: EPI Backups ----
        const epiBackups = tget<any[]>('epi_daily_backup', []);
        if (epiBackups.length > 0) {
          await setDoc(doc(db, basePath, SUBCOL_EPI_BACKUPS, 'main'), { payload: epiBackups, updatedAt: serverTimestamp() }, { merge: true });
        }

        // ---- Step 7: Imported Insumos ----
        const importedInsumos = tget<any[]>('importedInsumos', []);
        if (importedInsumos.length > 0) {
          const importBatch = writeBatch(db);
          importedInsumos.forEach((ii: any) => {
            importBatch.set(doc(db, basePath, SUBCOL_IMPORTED_INSUMOS, String(ii.codigo)), { ...ii, updatedAt: serverTimestamp() }, { merge: true });
          });
          await importBatch.commit();
        }

        // ---- Step 8: Backups list ----
        const backupsList = tget<BackupSnapshot[]>('backups_list', []);
        if (backupsList.length > 0) {
          const backupBatch = writeBatch(db);
          backupsList.forEach(b => {
            backupBatch.set(doc(db, basePath, SUBCOL_BACKUPS, b.name), { ...b, updatedAt: serverTimestamp() }, { merge: true });
          });
          await backupBatch.commit();
          result.backupsCount += backupsList.length;
        }

        result.tenantDataMigrated.push(obraId);
      } catch (err: any) {
        result.errors.push(`Obra ${obra.id} (${obra.nome}): ${err.message}`);
      }
    }

    // Restore original active obra
    if (currentActiveObra) {
      localStorage.setItem('perfort_almox_obra_atual', JSON.stringify(currentActiveObra));
    }

    // ---- Step 9: Audit Logs ----
    const auditLogs = getAuditLogs();
    result.auditLogCount = auditLogs.length;
    // Write logs in batches of 500
    for (let i = 0; i < auditLogs.length; i += 500) {
      const chunk = auditLogs.slice(i, i + 500);
      const batch = writeBatch(db);
      chunk.forEach((entry, j) => {
        batch.set(doc(db, COL_AUDIT, `log_${i + j}`), { ...entry, createdAt: serverTimestamp() });
      });
      await batch.commit();
    }

    // ---- Mark migration as done ----
    markMigrationDone();
    result.success = result.errors.length === 0;
    result.durationMs = Date.now() - startTime;

    console.log('[Migration v2] Complete:', result);
    return result;
  } catch (err: any) {
    result.errors.push(`Fatal error: ${err.message}`);
    result.durationMs = Date.now() - startTime;
    console.error('[Migration v2] Failed:', err);
    return result;
  }
}
