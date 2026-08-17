// ============================================================================
// Compressed Storage — localStorage com LZ-String + sub-chaves + lazy load
// ============================================================================
// Substitui o modelo monolítico de getTenantData()/saveTenantData() que
// gravava TODOS os dados (items, entradas, saidas, emprestimos, epis,
// materiaisConsumo, IDs) em uma única chave `tenant_{obraId}_data`.
//
// Nova arquitetura:
//   - Cada coleção (items, entradas, saidas, emprestimos, epis,
//     materiaisConsumo) é gravada em sub-chave separada
//   - Valores são comprimidos com LZ-String antes de gravar
//   - Reads são lazy: só carrega/descomprime a sub-chave solicitada
//   - IDs autoincrement (nextXxxId) ficam em chave própria leve
//
// Formato da chave no localStorage:
//   tenant_{obraId}_col_{collectionName}   → dados comprimidos
//   tenant_{obraId}_ids                     → JSON puro (pequeno)
//
// Compatibilidade reversa:
//   - Ao inicializar, detecta o formato antigo monolítico e migra
//     automaticamente para sub-chaves (one-time migration per tenant)
//   - getTenantData() e saveTenantData() continuam funcionando,
//     mas agora operam sobre sub-chaves internamente
// ============================================================================

import LZString from 'lz-string';
import type {
  ItemInsumo,
  EntradaStock,
  SaidaStock,
  EmprestimoFerramenta,
  EpiFornecimento,
  MaterialConsumo,
} from '../types';
import { DEFAULT_INSUMOS_DEMO } from '../data/mockData';

// ---------- Constantes ----------

/** Prefixo base para sub-chaves de coleção */
const COL_PREFIX = 'col_';
/** Chave para os IDs autoincrement */
const IDS_KEY = 'ids';
/** Chave legada monolítica (formato antigo) */
const LEGACY_DATA_KEY = 'data';

/** Nomes das sub-coleções — corresponde às chaves de TenantData */
export const COLLECTION_NAMES = [
  'items',
  'entradas',
  'saidas',
  'emprestimos',
  'epis',
  'materiaisConsumo',
] as const;

export type CollectionName = (typeof COLLECTION_NAMES)[number];

/** Mapa de tipos por coleção para type safety */
export interface CollectionTypeMap {
  items: ItemInsumo[];
  entradas: EntradaStock[];
  saidas: SaidaStock[];
  emprestimos: EmprestimoFerramenta[];
  epis: EpiFornecimento[];
  materiaisConsumo: MaterialConsumo[];
}

/** IDs autoincrement — armazenados separadamente (JSON puro, sem compressão) */
export interface TenantIds {
  nextEntradaId: number;
  nextSaidaId: number;
  nextEmprestimoId: number;
  nextEpiId: number;
  nextMaterialConsumoId: number;
}

/** Valores padrão para IDs */
const DEFAULT_IDS: TenantIds = {
  nextEntradaId: 1,
  nextSaidaId: 1,
  nextEmprestimoId: 1,
  nextEpiId: 1,
  nextMaterialConsumoId: 1,
};

/** Dados padrão para cada coleção quando vazia */
const DEFAULT_COLLECTIONS: { [K in CollectionName]: CollectionTypeMap[K] } = {
  items: DEFAULT_INSUMOS_DEMO,
  entradas: [],
  saidas: [],
  emprestimos: [],
  epis: [],
  materiaisConsumo: [],
};

// ---------- Helpers de prefixo ----------

/** Retorna o prefixo do tenant ativo (mesma lógica de storage.ts) */
function getTenantPrefix(): string {
  try {
    const raw = localStorage.getItem('perfort_almox_obra_atual');
    if (!raw) return 'tenant_none_';
    const obra = JSON.parse(raw);
    return obra && obra.id ? `tenant_${obra.id}_` : 'tenant_none_';
  } catch {
    return 'tenant_none_';
  }
}

/** Monta a chave completa para uma sub-coleção */
function colKey(name: CollectionName): string {
  return getTenantPrefix() + COL_PREFIX + name;
}

/** Monta a chave completa para os IDs */
function idsKey(): string {
  return getTenantPrefix() + IDS_KEY;
}

/** Monta a chave legada (formato antigo monolítico) */
function legacyKey(): string {
  return getTenantPrefix() + LEGACY_DATA_KEY;
}

// ---------- Compressão / Descompressão ----------

/**
 * Comprime um valor JS para string usando LZ-String.
 * Usa `compressToUTF16` para manter compatibilidade com localStorage
 * (strings UTF-16 não têm problemas com caracteres especiais).
 */
function compress<T>(value: T): string {
  try {
    const json = JSON.stringify(value);
    return LZString.compressToUTF16(json);
  } catch (e) {
    console.error('[compressedStorage] Erro na compressão:', e);
    // Fallback: grava JSON puro
    return JSON.stringify(value);
  }
}

/**
 * Descomprime uma string LZ-String de volta para valor JS.
 * Detecta automaticamente se o valor está comprimido ou é JSON puro
 * (para compatibilidade com dados legados não comprimidos).
 */
function decompress<T>(raw: string): T | null {
  try {
    // Se começa com '{' ou '[', é JSON puro (não comprimido)
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return JSON.parse(trimmed) as T;
    }
    // Tentar descomprimir como LZ-String UTF-16
    const json = LZString.decompressFromUTF16(raw);
    if (json !== null && json !== '') {
      return JSON.parse(json) as T;
    }
    // Fallback: tentar JSON puro
    return JSON.parse(trimmed) as T;
  } catch (e) {
    console.error('[compressedStorage] Erro na descompressão:', e);
    return null;
  }
}

// ---------- Migração do formato legado ----------

/**
 * Detecta e migra o formato monolítico legado para sub-chaves comprimidas.
 * Retorna true se realizou a migração (primeira execução por tenant).
 * Após migrar, remove a chave legada para liberar espaço.
 */
export function migrateFromLegacyIfNeeded(): boolean {
  const legacy = legacyKey();
  const raw = localStorage.getItem(legacy);

  if (!raw) return false; // não há dados legados

  // Já existe ao menos uma sub-chave? Migração já foi feita.
  const firstColKey = colKey('items');
  if (localStorage.getItem(firstColKey) !== null) {
    // Sub-chaves já existem — verificar se a legada é redundante
    // Se sim, remover para evitar conflito
    try {
      const parsed = decompress<any>(raw);
      if (parsed && parsed.items !== undefined) {
        // Legada ainda existe mas sub-chaves já presentes — só limpar
        localStorage.removeItem(legacy);
      }
    } catch {
      // não consegue parsear, provavelmente já comprimido — ignorar
    }
    return false;
  }

  // Tem dados legados e NÃO tem sub-chaves — fazer migração
  try {
    const legacyData = decompress<any>(raw);
    if (!legacyData || typeof legacyData !== 'object') return false;

    // Extrair cada coleção e gravar em sub-chave separada
    for (const name of COLLECTION_NAMES) {
      const collectionData = legacyData[name] ?? DEFAULT_COLLECTIONS[name];
      localStorage.setItem(colKey(name), compress(collectionData));
    }

    // Extrair IDs e gravar separadamente (JSON puro — arquivo pequeno)
    const ids: TenantIds = {
      nextEntradaId: legacyData.nextEntradaId ?? DEFAULT_IDS.nextEntradaId,
      nextSaidaId: legacyData.nextSaidaId ?? DEFAULT_IDS.nextSaidaId,
      nextEmprestimoId: legacyData.nextEmprestimoId ?? DEFAULT_IDS.nextEmprestimoId,
      nextEpiId: legacyData.nextEpiId ?? DEFAULT_IDS.nextEpiId,
      nextMaterialConsumoId: legacyData.nextMaterialConsumoId ?? DEFAULT_IDS.nextMaterialConsumoId,
    };
    localStorage.setItem(idsKey(), JSON.stringify(ids));

    // Remover chave legada para liberar espaço
    localStorage.removeItem(legacy);

    console.log('[compressedStorage] Migração legado → sub-chivas concluída.');
    return true;
  } catch (e) {
    console.error('[compressedStorage] Erro na migração legada:', e);
    return false;
  }
}

// ---------- API de sub-coleções (lazy load) ----------

/**
 * Lê uma sub-coleção específica do localStorage com descompressão.
 * Carrega apenas a coleção solicitada — lazy load.
 * Se a sub-chave não existir, retorna o valor padrão.
 */
export function getCollection<K extends CollectionName>(
  name: K
): CollectionTypeMap[K] {
  // Garantir que dados legados foram migrados antes de ler
  migrateFromLegacyIfNeeded();

  const raw = localStorage.getItem(colKey(name));
  if (raw === null) {
    return DEFAULT_COLLECTIONS[name] as CollectionTypeMap[K];
  }

  const data = decompress<CollectionTypeMap[K]>(raw);
  if (data === null) {
    return DEFAULT_COLLECTIONS[name] as CollectionTypeMap[K];
  }

  return data;
}

/**
 * Grava uma sub-coleção específica no localStorage com compressão.
 * Apenas a coleção modificada é re-escrita — não afeta as demais.
 */
export function setCollection<K extends CollectionName>(
  name: K,
  value: CollectionTypeMap[K]
): void {
  try {
    localStorage.setItem(colKey(name), compress(value));
  } catch (e) {
    console.error(`[compressedStorage] Erro ao gravar coleção "${name}":`, e);
  }
}

// ---------- API de IDs autoincrement ----------

/** Lê os IDs autoincrement do tenant ativo */
export function getTenantIds(): TenantIds {
  migrateFromLegacyIfNeeded();

  try {
    const raw = localStorage.getItem(idsKey());
    if (raw === null) return { ...DEFAULT_IDS };
    return JSON.parse(raw) as TenantIds;
  } catch {
    return { ...DEFAULT_IDS };
  }
}

/** Grava os IDs autoincrement do tenant ativo */
export function setTenantIds(ids: TenantIds): void {
  try {
    localStorage.setItem(idsKey(), JSON.stringify(ids));
  } catch (e) {
    console.error('[compressedStorage] Erro ao gravar IDs:', e);
  }
}

/** Incrementa e retorna o próximo ID para a coleção dada */
export function getNextId(
  idKey: keyof TenantIds
): string {
  const ids = getTenantIds();
  const current = ids[idKey] ?? 1;
  ids[idKey] = current + 1;
  setTenantIds(ids);
  return String(current);
}

// ---------- Compatibilidade: getTenantData / saveTenantData ----------

/**
 * Interface TenantData — mantida para compatibilidade com storage.ts.
 * Internamente, lê cada sub-coleção separadamente (lazy load + descompressão).
 */
export interface TenantData {
  items: ItemInsumo[];
  entradas: EntradaStock[];
  saidas: SaidaStock[];
  nextEntradaId: number;
  nextSaidaId: number;
  emprestimos: EmprestimoFerramenta[];
  nextEmprestimoId: number;
  epis: EpiFornecimento[];
  nextEpiId: number;
  materiaisConsumo: MaterialConsumo[];
  nextMaterialConsumoId: number;
}

/**
 * Lê todos os dados do tenant — montando a partir das sub-chaves.
 * ATENÇÃO: Prefira getCollection() para acessar apenas uma coleção
 * (lazy load). Esta função carrega TODAS as coleções de uma vez.
 */
export function getTenantData(): TenantData {
  const ids = getTenantIds();
  return {
    items: getCollection('items'),
    entradas: getCollection('entradas'),
    saidas: getCollection('saidas'),
    emprestimos: getCollection('emprestimos'),
    epis: getCollection('epis'),
    materiaisConsumo: getCollection('materiaisConsumo'),
    ...ids,
  };
}

/**
 * Grava todos os dados do tenant — distribuindo nas sub-chaves.
 * ATENÇÃO: Prefira setCollection() para gravar apenas uma coleção
 * (evita re-comprimir dados não modificados). Esta função
 * comprime e grava TODAS as coleções.
 */
export function saveTenantData(data: TenantData): void {
  setCollection('items', data.items);
  setCollection('entradas', data.entradas);
  setCollection('saidas', data.saidas);
  setCollection('emprestimos', data.emprestimos);
  setCollection('epis', data.epis);
  setCollection('materiaisConsumo', data.materiaisConsumo);
  setTenantIds({
    nextEntradaId: data.nextEntradaId,
    nextSaidaId: data.nextSaidaId,
    nextEmprestimoId: data.nextEmprestimoId,
    nextEpiId: data.nextEpiId,
    nextMaterialConsumoId: data.nextMaterialConsumoId,
  });
}

// ---------- tset / tget com compressão (para chaves gerais) ----------

/**
 * Versão comprimida de tset — para chaves gerais do tenant
 * (ex: cq_concretagem, backups, epi_daily_backup, etc.)
 */
export function compressedTset<T>(key: string, value: T): void {
  try {
    localStorage.setItem(getTenantPrefix() + key, compress(value));
  } catch (e) {
    console.error(`[compressedStorage] Erro em compressedTset("${key}"):`, e);
  }
}

/**
 * Versão descomprimida de tget — para chaves gerais do tenant.
 * Detecta automaticamente dados comprimidos vs JSON puro.
 */
export function compressedTget<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(getTenantPrefix() + key);
    if (raw === null) return defaultValue;
    const data = decompress<T>(raw);
    return data !== null ? data : defaultValue;
  } catch {
    return defaultValue;
  }
}

// ---------- Utilitários de diagnóstico ----------

/**
 * Retorna o tamanho estimado (bytes) de cada sub-coleção no localStorage.
 * Útil para debug e monitoramento de uso de espaço.
 */
export function getStorageStats(): Record<string, number> {
  const prefix = getTenantPrefix();
  const stats: Record<string, number> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      const raw = localStorage.getItem(key);
      const suffix = key.slice(prefix.length);
      stats[suffix] = raw ? raw.length * 2 : 0; // UTF-16 = 2 bytes/char
    }
  }

  return stats;
}

/**
 * Limpa todas as sub-chaves do tenant ativo.
 * Útil para reset de dados de uma obra específica.
 */
export function clearTenantStorage(): void {
  const prefix = getTenantPrefix();
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(k => localStorage.removeItem(k));
}
