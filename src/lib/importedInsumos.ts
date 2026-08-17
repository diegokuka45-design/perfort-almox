// ============================================================================
// Imported Insumos — localStorage + Firestore
// ============================================================================
// Maintains the same function signatures as the original localStorage-only
// version. Writes go to localStorage synchronously AND to Firestore async.
// Reads always come from localStorage (fast sync cache).
//
// Firestore path: tenants/{obraId}/importedInsumos/{codigo}
// ============================================================================

import { db, hasRealConfig } from './firebase';
import { tenantDocPath, SUBCOL_IMPORTED_INSUMOS } from './firebaseCollections';
import { doc, setDoc, deleteDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';

export type ImportedInsumo = {
  id: string;
  codigo: string;
  nome: string;
  familia: string;
};

function getKey(obraId: string) {
  return `tenant_${obraId}_importedInsumos`;
}

// ---------- Firestore helpers ----------

async function writeToFirestore(obraId: string, insumos: ImportedInsumo[]) {
  if (!db || !hasRealConfig) return;
  try {
    const basePath = tenantDocPath(obraId);
    for (const insumo of insumos) {
      await setDoc(
        doc(db, basePath, SUBCOL_IMPORTED_INSUMOS, String(insumo.codigo)),
        { ...insumo, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
  } catch (err) {
    console.error('[ImportedInsumos] Firestore write error:', err);
  }
}

async function removeFromFirestore(obraId: string, codigo: string) {
  if (!db || !hasRealConfig) return;
  try {
    const basePath = tenantDocPath(obraId);
    await deleteDoc(doc(db, basePath, SUBCOL_IMPORTED_INSUMOS, String(codigo)));
  } catch (err) {
    console.error('[ImportedInsumos] Firestore delete error:', err);
  }
}

/** Load all imported insumos from Firestore into localStorage cache */
export async function loadImportedInsumosFromFirestore(obraId: string): Promise<void> {
  if (!db || !hasRealConfig) return;
  try {
    const basePath = tenantDocPath(obraId);
    const snap = await getDocs(collection(db, basePath, SUBCOL_IMPORTED_INSUMOS));
    const items: ImportedInsumo[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      items.push({
        id: data.id || doc.id,
        codigo: data.codigo || doc.id,
        nome: data.nome || '',
        familia: data.familia || '',
      });
    });
    localStorage.setItem(getKey(obraId), JSON.stringify(items));
  } catch (err) {
    console.error('[ImportedInsumos] Firestore load error:', err);
  }
}

// ---------- Public API (same signatures as before) ----------

export function getImportedInsumos(obraId: string): ImportedInsumo[] {
  try {
    const raw = localStorage.getItem(getKey(obraId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addImportedInsumos(
  obraId: string,
  novos: ImportedInsumo[]
) {
  const atuais = getImportedInsumos(obraId);
  const merged = [
    ...atuais,
    ...novos.filter(
      (n) => !atuais.some((a) => a.codigo === n.codigo)
    ),
  ];
  localStorage.setItem(getKey(obraId), JSON.stringify(merged));

  // Fire-and-forget Firestore write
  writeToFirestore(obraId, merged);
}

export function isInsumoAlreadyImported(
  obraId: string,
  codigo: string
): boolean {
  const imported = getImportedInsumos(obraId);
  return imported.some((i) => i.codigo === codigo);
}
