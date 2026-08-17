import type { InsumoPDF } from '../data/insumosImportados';

export type ImportedInsumo = {
  id: string;
  codigo: string;
  nome: string;
  familia: string;
};

function getKey(obraId: number) {
  return `tenant_${obraId}_importedInsumos`;
}

export function getImportedInsumos(obraId: number): ImportedInsumo[] {
  try {
    const raw = localStorage.getItem(getKey(obraId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addImportedInsumos(
  obraId: number,
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
}

export function isInsumoAlreadyImported(
  obraId: number,
  codigo: string
): boolean {
  const imported = getImportedInsumos(obraId);
  return imported.some((i) => i.codigo === codigo);
}

export function convertInsumoPDFToItem(
  insumo: InsumoPDF
): Omit<ImportedInsumo, 'id'> & { id: string } {
  return {
    id: insumo.id,
    codigo: insumo.codigo,
    nome: insumo.nome,
    familia: insumo.familia,
  };
}
