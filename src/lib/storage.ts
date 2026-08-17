// ============================================================================
// Storage — módulo principal de persistência (localStorage)
// ============================================================================
// AGORA delega TenantData (getTenantData/saveTenantData) e CRUD por coleção
// para compressedStorage.ts, que usa:
//   - LZ-String compress/decompress em todas as chaves
//   - Sub-chavas por coleção (items, entradas, saidas, emprestimos, epis, materiaisConsumo)
//   - Lazy load: cada coleção é lida/gravada separadamente
//   - Migração automática do formato legado monolítico
//
// Este arquivo mantém:
//   - Chaves globais (obras, session, users, audit) — sem compressão (são pequenas)
//   - Helpers de formatação (getSaldo, getStatus, formatCurrency, formatNumber)
//   - PDFs inline (serão movidos para Web Worker na etapa 5)
//   - CRUD helpers por coleção — agora delegam para compressedStorage
//   - Wrappers para importedInsumos
//   - tset/tget — agora com compressão LZ-String delegados para compressedStorage
// ============================================================================

import { ItemInsumo, EntradaStock, SaidaStock, CQConcretagem, Obra, User, AuditLogEntry, BackupSnapshot, EmprestimoFerramenta, EpiFornecimento, MaterialConsumo } from '../types';
import { DEFAULT_OBRAS, DEFAULT_INSUMOS_DEMO, DEFAULT_USERS, MASTER_USER } from '../data/mockData';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

// ---------- Compressed Storage (sub-chaves + LZ-String) ----------
import {
  getTenantData as _getTenantData,
  saveTenantData as _saveTenantData,
  getCollection as _getCollection,
  setCollection as _setCollection,
  getTenantIds as _getTenantIds,
  setTenantIds as _setTenantIds,
  getNextId as _getNextId,
  compressedTset,
  compressedTget,
  TenantData as CompressedTenantData,
  TenantIds,
  migrateFromLegacyIfNeeded,
  CollectionName,
} from './compressedStorage';

// Re-export TenantData para compatibilidade
export type TenantData = CompressedTenantData;

// Constant Keys (globais — sem compressão, são pequenas)
const OBRAS_KEY = 'perfort_almox_obras';
const OBRA_ATUAL_KEY = 'perfort_almox_obra_atual';
const USERS_KEY = 'perfort_almox_users';
const SESSION_KEY = 'perfort_almox_session';
const AUDIT_LOG_KEY = 'perfort_almox_audit';

export function getActiveObra(): Obra | null {
  try {
    const raw = localStorage.getItem(OBRA_ATUAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setActiveObra(obra: Obra | null): void {
  if (obra) {
    localStorage.setItem(OBRA_ATUAL_KEY, JSON.stringify(obra));
  } else {
    localStorage.removeItem(OBRA_ATUAL_KEY);
  }
}

export function getTenantPrefix(): string {
  const obra = getActiveObra();
  return obra && obra.id ? `tenant_${obra.id}_` : 'tenant_none_';
}

/**
 * tset com compressão LZ-String.
 * Para chaves tenant-scoped (cq_concretagem, epi_daily_backup, backups_list, etc.).
 */
export function tset<T>(key: string, value: T): void {
  compressedTset(key, value);
}

/**
 * tget com descompressão LZ-String.
 * Detecta automaticamente dados comprimidos vs JSON puro legado.
 */
export function tget<T>(key: string, defaultValue: T): T {
  return compressedTget(key, defaultValue);
}

// Balance and Status Helpers
export function getSaldo(item: ItemInsumo): number {
  const init = item.quantidade || 0;
  const ent = item.entradas_total || 0;
  const sai = item.saidas_total || 0;
  return init + ent - sai;
}

export function getStatus(item: ItemInsumo): 'OK' | 'BAIXO' | 'CRÍTICO' {
  const saldo = getSaldo(item);
  const min = item.estoque_min || 0;
  if (saldo <= 0) return 'CRÍTICO';
  if (saldo <= min) return 'BAIXO';
  return 'OK';
}

export function formatCurrency(value?: number): string {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return 'R$ ' + value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatNumber(value?: number, decimals: number = 2): string {
  if (value == null || isNaN(value)) return '0,00';
  return value.toFixed(decimals).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// User Management
export function getUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    const list: User[] = JSON.parse(raw);
    if (!list.some(u => u.username === MASTER_USER.username)) {
      list.push(MASTER_USER);
      localStorage.setItem(USERS_KEY, JSON.stringify(list));
    }
    return list;
  } catch (e) {
    return DEFAULT_USERS;
  }
}

export function saveUsers(users: User[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getCurrentSession(): { username: string; role: string; permissoes: string[] } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setCurrentSession(session: { username: string; role: string; permissoes: string[] } | null): void {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

// Obras CRUD
export function getObras(): Obra[] {
  try {
    const raw = localStorage.getItem(OBRAS_KEY);
    if (!raw) {
      localStorage.setItem(OBRAS_KEY, JSON.stringify(DEFAULT_OBRAS));
      return DEFAULT_OBRAS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_OBRAS;
  }
}

export function saveObras(obras: Obra[]): void {
  localStorage.setItem(OBRAS_KEY, JSON.stringify(obras));
}

// ===================== Tenant Data (delegado ao compressedStorage) =====================

/**
 * Lê todos os dados do tenant — montando a partir das sub-chavas comprimidas.
 * ATENÇÃO: Para acessar apenas uma coleção, prefira getCollection() (lazy load).
 */
export function getTenantData(): TenantData {
  return _getTenantData();
}

/**
 * Grava todos os dados do tenant — distribuindo nas sub-chavas comprimidas.
 * ATENÇÃO: Para gravar apenas uma coleção modificada, prefira setCollection().
 */
export function saveTenantData(data: TenantData): void {
  _saveTenantData(data);
}

// ===================== CRUD por coleção (otimizado — sem read-modify-write) =====================

/** Lê apenas a coleção de items (lazy load, descomprime só esta sub-chave) */
export function getInsumos(): ItemInsumo[] {
  return _getCollection('items');
}

/** Grava apenas a coleção de items (não re-grava as demais) */
export function saveInsumos(items: ItemInsumo[]): void {
  _setCollection('items', items);
}

/** Lê apenas a coleção de entradas */
export function getEntradas(): EntradaStock[] {
  return _getCollection('entradas');
}

/** Grava apenas a coleção de entradas */
export function saveEntradas(entradas: EntradaStock[]): void {
  _setCollection('entradas', entradas);
}

/** Lê apenas a coleção de saidas */
export function getSaidas(): SaidaStock[] {
  return _getCollection('saidas');
}

/** Grava apenas a coleção de saidas */
export function saveSaidas(saidas: SaidaStock[]): void {
  _setCollection('saidas', saidas);
}

// ===================== Empréstimo de Ferramentas CRUD =====================

export function getEmprestimos(): EmprestimoFerramenta[] {
  return _getCollection('emprestimos');
}

export function saveEmprestimos(emprestimos: EmprestimoFerramenta[]): void {
  _setCollection('emprestimos', emprestimos);
}

export function getNextEmprestimoId(): string {
  return _getNextId('nextEmprestimoId');
}

// ===================== EPI Fornecimento CRUD =====================

export function getEpis(): EpiFornecimento[] {
  return _getCollection('epis');
}

export function saveEpis(epis: EpiFornecimento[]): void {
  _setCollection('epis', epis);
}

export function getNextEpiId(): string {
  return _getNextId('nextEpiId');
}

// ===================== Material de Consumo CRUD =====================

export function getMateriaisConsumo(): MaterialConsumo[] {
  return _getCollection('materiaisConsumo');
}

export function saveMateriaisConsumo(materiais: MaterialConsumo[]): void {
  _setCollection('materiaisConsumo', materiais);
}

export function getNextMaterialConsumoId(): string {
  return _getNextId('nextMaterialConsumoId');
}

// ===================== Imported Insumos Wrappers ====================

import { getImportedInsumos as _getImported, addImportedInsumos as _addImported, isInsumoAlreadyImported as _isAlreadyImported, ImportedInsumo } from './importedInsumos';

export interface CadastroImportedInsumo {
  id: string;
  nome: string;
  variacao?: string;
  codigo: string;
  unidade?: string;
  familia: string;
  obraId: string;
  obraNome?: string;
}

export function getImportedInsumos(): CadastroImportedInsumo[] {
  const obra = getActiveObra();
  if (!obra) return [];
  const obraId = String(obra.id);
  const raw: ImportedInsumo[] = _getImported(obraId);
  return raw.map(r => ({
    id: r.id,
    nome: r.nome,
    variacao: '',
    codigo: r.codigo,
    unidade: 'UN',
    familia: r.familia,
    obraId,
    obraNome: obra.nome
  }));
}

export function addImportedInsumo(insumo: CadastroImportedInsumo): void {
  const obraId = insumo.obraId;
  const entry: ImportedInsumo = {
    id: insumo.id,
    codigo: insumo.codigo,
    nome: insumo.nome + (insumo.variacao ? ' - ' + insumo.variacao : ''),
    familia: insumo.familia
  };
  _addImported(obraId, [entry]);
}

export function isInsumoAlreadyInObra(nome: string, variacao: string, obraId: string): boolean {
  const fullName = variacao ? nome + ' - ' + variacao : nome;
  const imported: ImportedInsumo[] = _getImported(obraId);
  return imported.some(i => i.nome === fullName);
}

// ===================== EPI Backup Helpers =====================

const EPI_BACKUP_KEY = 'epi_daily_backup';

export function createEpiDailyBackup(): void {
  const epiList = getEpis();
  if (epiList.length === 0) return;
  const backupEntry = {
    date: new Date().toISOString().slice(0, 10),
    timestamp: new Date().toLocaleString('pt-BR'),
    count: epiList.length,
    data: JSON.stringify(epiList)
  };
  const backups = tget<any[]>(EPI_BACKUP_KEY, []);
  // Keep only 1 backup per day, max 90 days
  const existingIdx = backups.findIndex((b: any) => b.date === backupEntry.date);
  if (existingIdx !== -1) {
    backups[existingIdx] = backupEntry;
  } else {
    backups.unshift(backupEntry);
  }
  if (backups.length > 90) backups.length = 90;
  tset(EPI_BACKUP_KEY, backups);
}

export function getEpiDailyBackups(): any[] {
  return tget<any[]>(EPI_BACKUP_KEY, []);
}

// ===================== EPI Ficha PDF Generation =====================

export function generateEpiFichaPDF(epi: EpiFornecimento): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const activeObra = getActiveObra();

  // Header Faixa Dourada
  doc.setFillColor(201, 163, 88);
  doc.rect(0, 0, pageW, 5, 'F');

  // Header Azul
  doc.setFillColor(13, 31, 45);
  doc.rect(0, 5, pageW, 22, 'F');

  doc.setFontSize(16);
  doc.setTextColor(201, 163, 88);
  doc.setFont('helvetica', 'bold');
  doc.text('PERFOR ENGENHARIA', 14, 16);

  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('FICHA DE CONTROLE DE ENTREGA DE EPI', 14, 22);

  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('Obra: ' + (epi.obraNome || (activeObra ? activeObra.nome : '-')), pageW - 14, 16, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text('Emitido em: ' + new Date().toLocaleString('pt-BR'), pageW - 14, 22, { align: 'right' });

  // Divider
  doc.setDrawColor(201, 163, 88);
  doc.setLineWidth(0.5);
  doc.line(14, 30, pageW - 14, 30);

  // Company Info Section
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('RAZÃO SOCIAL: Construtora Perfil LTDA', 14, 37);
  doc.setFont('helvetica', 'normal');
  doc.text('CNPJ: 33.172.828/0001-86', 14, 43);

  // Employee Info
  let y = 51;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y - 5, pageW - 28, 28, 'F');

  doc.setTextColor(13, 31, 45);
  doc.text('Nome do Funcionário:', 16, y);
  doc.setFont('helvetica', 'normal');
  doc.text(epi.funcionarioNome || '-', 65, y);

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Setor:', 16, y);
  doc.setFont('helvetica', 'normal');
  doc.text(epi.funcionarioSetor || 'Obras', 50, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Função:', 110, y);
  doc.setFont('helvetica', 'normal');
  doc.text(epi.funcionarioFuncao || '-', 135, y);

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Turno:', 16, y);
  doc.setFont('helvetica', 'normal');
  doc.text(epi.funcionarioTurno || 'Diurno', 50, y);

  // EPI Items Table
  y += 12;
  doc.setFillColor(13, 31, 45);
  doc.rect(14, y - 3, pageW - 28, 8, 'F');
  doc.setTextColor(201, 163, 88);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const colX = [16, 42, 72, 140, 162];
  doc.text('DATA ENTREGA', colX[0], y + 2);
  doc.text('QUANTIDADE', colX[1], y + 2);
  doc.text('DISCRIMINAÇÃO', colX[2], y + 2);
  doc.text('Nº C.A.', colX[3], y + 2);
  doc.text('ASSINATURA', colX[4], y + 2);

  y += 8;
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  (epi.epiItens || []).forEach((item, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 3, pageW - 28, 7, 'F');
    }
    doc.text(epi.dataEntrega ? new Date(epi.dataEntrega).toLocaleDateString('pt-BR') : '-', colX[0], y + 1);
    doc.text(String(item.quantidade), colX[1], y + 1);
    doc.text(item.insumoNome || '-', colX[2], y + 1);
    doc.text(item.numeroCA || '-', colX[3], y + 1);
    doc.text('', colX[4], y + 1);
    y += 7;
  });

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFillColor(13, 31, 45);
  doc.rect(0, footerY, pageW, 10, 'F');
  doc.setFontSize(7);
  doc.setTextColor(201, 163, 88);
  doc.text('Aplicativo criado por Engenheiro Civil Diego Kugert Betelli', 14, footerY + 4);
  doc.setTextColor(200, 200, 200);
  doc.text('Página 1', pageW - 14, footerY + 6, { align: 'right' });

  doc.save('Ficha_EPI_' + (epi.funcionarioNome || 'funcionario') + '_' + new Date().toISOString().slice(0, 10) + '.pdf');
}

// ===================== EPI Consumed Report (with 15% markup) =====================

export function generateEpiConsumedReport(epis: EpiFornecimento[], items: ItemInsumo[]): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const activeObra = getActiveObra();
  const session = getCurrentSession();

  // Header Faixa Dourada
  doc.setFillColor(201, 163, 88);
  doc.rect(0, 0, pageW, 6, 'F');

  // Header Azul
  doc.setFillColor(13, 31, 45);
  doc.rect(0, 6, pageW, 22, 'F');

  doc.setFontSize(16);
  doc.setTextColor(201, 163, 88);
  doc.setFont('helvetica', 'bold');
  doc.text('PERFOR ENGENHARIA', 14, 17);

  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('RELATÓRIO DE INSUMOS CONSUMIDOS — EPIs', 14, 23);

  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('Obra: ' + (activeObra ? activeObra.nome : 'Geral'), pageW - 14, 17, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text('Emissão: ' + new Date().toLocaleString('pt-BR') + ' | Usuário: ' + (session?.username || 'Sistema'), pageW - 14, 23, { align: 'right' });

  // Divider
  doc.setDrawColor(201, 163, 88);
  doc.setLineWidth(0.5);
  doc.line(14, 32, pageW - 14, 32);

  // Aggregate consumed items
  const consumedMap: Record<string, { nome: string; codigo: string; qtdTotal: number; custoMedio: number; custoComMarkup: number }> = {};

  epis.forEach(epi => {
    (epi.epiItens || []).forEach(item => {
      const key = item.insumoCodigo || item.insumoNome;
      if (!consumedMap[key]) {
        const matchingInsumo = items.find(i => i.codigo === item.insumoCodigo);
        const custoMedio = matchingInsumo?.preco_medio || matchingInsumo?.custo_medio || 0;
        consumedMap[key] = {
          nome: item.insumoNome,
          codigo: item.insumoCodigo,
          qtdTotal: 0,
          custoMedio,
          custoComMarkup: custoMedio * 1.15
        };
      }
      consumedMap[key].qtdTotal += item.quantidade;
    });
  });

  const consumedList = Object.values(consumedMap);
  const totalQtd = consumedList.reduce((s, c) => s + c.qtdTotal, 0);
  const totalCusto = consumedList.reduce((s, c) => s + (c.custoMedio * c.qtdTotal), 0);
  const totalComMarkup = consumedList.reduce((s, c) => s + (c.custoComMarkup * c.qtdTotal), 0);

  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('Total Fichas EPI: ' + epis.length + '  |  Itens Distintos: ' + consumedList.length + '  |  Qtd Total: ' + formatNumber(totalQtd), 14, 38);
  doc.setFont('helvetica', 'normal');
  doc.text('Custo Total (sem markup): ' + formatCurrency(totalCusto) + '  |  Custo Total (com 15% markup): ' + formatCurrency(totalComMarkup), 14, 44);

  // Table
  const tableData = consumedList.map(c => [
    c.codigo,
    c.nome,
    formatNumber(c.qtdTotal),
    formatCurrency(c.custoMedio),
    formatCurrency(c.custoMedio * c.qtdTotal),
    formatCurrency(c.custoComMarkup),
    formatCurrency(c.custoComMarkup * c.qtdTotal)
  ]);

  (doc as any).autoTable({
    startY: 50,
    head: [['Código', 'Nome do Insumo', 'Qtd Total', 'Custo Unit.', 'Custo Total', 'Unit. c/ 15%', 'Total c/ 15%']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [13, 31, 45], textColor: [201, 163, 88], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    didDrawPage: (data: any) => {
      doc.setFillColor(13, 31, 45);
      doc.rect(0, doc.internal.pageSize.height - 10, doc.internal.pageSize.width, 10, 'F');
      doc.setFontSize(8);
      doc.setTextColor(201, 163, 88);
      doc.text('Aplicativo criado por Engenheiro Civil Diego Kugert Betelli', 14, doc.internal.pageSize.height - 4);
      doc.setTextColor(200, 200, 200);
      doc.text('Página ' + data.pageNumber, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 4, { align: 'right' });
    }
  });

  doc.save('Relatorio_Insumos_Consumidos_EPI_' + new Date().toISOString().slice(0, 10) + '.pdf');
}

// ===================== Ficha de EPIs Consolidada =====================

export function generateFichaEpiConsolidada(
  epis: EpiFornecimento[],
  nomeFuncionario: string,
  empresa: string,
  dataInicio: string,
  dataFim: string
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const activeObra = getActiveObra();

  // Filter EPIs by nome, empresa and date range
  const filteredEpis = epis.filter(epi => {
    const matchNome = !nomeFuncionario || (epi.funcionarioNome || '').toLowerCase().includes(nomeFuncionario.toLowerCase());
    const matchEmpresa = !empresa || (epi.empresa || '').toLowerCase().includes(empresa.toLowerCase());
    const epiDate = epi.dataEntrega ? epi.dataEntrega.slice(0, 10) : '';
    const matchInicio = !dataInicio || epiDate >= dataInicio;
    const matchFim = !dataFim || epiDate <= dataFim;
    return matchNome && matchEmpresa && matchInicio && matchFim;
  });

  // Header Faixa Dourada
  doc.setFillColor(201, 163, 88);
  doc.rect(0, 0, pageW, 5, 'F');

  // Header Azul
  doc.setFillColor(13, 31, 45);
  doc.rect(0, 5, pageW, 22, 'F');

  doc.setFontSize(16);
  doc.setTextColor(201, 163, 88);
  doc.setFont('helvetica', 'bold');
  doc.text('PERFOR ENGENHARIA', 14, 16);

  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('FICHA DE ENTREGA DE EPIs — CONSOLIDADA', 14, 22);

  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('Obra: ' + (activeObra ? activeObra.nome : '-'), pageW - 14, 16, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text('Emitido em: ' + new Date().toLocaleString('pt-BR'), pageW - 14, 22, { align: 'right' });

  // Divider
  doc.setDrawColor(201, 163, 88);
  doc.setLineWidth(0.5);
  doc.line(14, 30, pageW - 14, 30);

  // Company Info
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('RAZÃO SOCIAL: Construtora Perfil LTDA', 14, 37);
  doc.setFont('helvetica', 'normal');
  doc.text('CNPJ: 33.172.828/0001-86', 14, 43);

  // Filter Info Section
  let y = 51;
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y - 5, pageW - 28, 32, 'F');

  doc.setFontSize(9);
  doc.setTextColor(13, 31, 45);
  doc.setFont('helvetica', 'bold');

  doc.text('Nome do Funcionário:', 16, y);
  doc.setFont('helvetica', 'normal');
  doc.text(nomeFuncionario || 'Todos', 65, y);

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Empresa:', 16, y);
  doc.setFont('helvetica', 'normal');
  doc.text(empresa || 'Todas', 50, y);

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Período:', 16, y);
  doc.setFont('helvetica', 'normal');
  const periodoText = (dataInicio ? new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR') : 'Início') +
    ' até ' + (dataFim ? new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR') : 'Fim');
  doc.text(periodoText, 50, y);

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Total de Entregas:', 16, y);
  doc.setFont('helvetica', 'normal');
  doc.text(String(filteredEpis.length), 65, y);

  // EPI Items Table
  y += 12;
  doc.setFillColor(13, 31, 45);
  doc.rect(14, y - 3, pageW - 28, 8, 'F');
  doc.setTextColor(201, 163, 88);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const colX = [16, 42, 72, 120, 148];
  doc.text('DATA', colX[0], y + 2);
  doc.text('QTD', colX[1], y + 2);
  doc.text('DISCRIMINAÇÃO', colX[2], y + 2);
  doc.text('Nº C.A.', colX[3], y + 2);
  doc.text('ASSINATURA', colX[4], y + 2);

  y += 8;
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  let pageNum = 1;

  filteredEpis.forEach((epi, epiIdx) => {
    (epi.epiItens || []).forEach((item, itemIdx) => {
      if (y > pageH - 20) {
        // Footer on current page before adding new one
        const fY = pageH - 10;
        doc.setFillColor(13, 31, 45);
        doc.rect(0, fY, pageW, 10, 'F');
        doc.setFontSize(7);
        doc.setTextColor(201, 163, 88);
        doc.text('Aplicativo criado por Engenheiro Civil Diego Kugert Betelli', 14, fY + 4);
        doc.setTextColor(200, 200, 200);
        doc.text('Página ' + pageNum, pageW - 14, fY + 6, { align: 'right' });

        doc.addPage();
        pageNum++;
        y = 20;
      }
      const rowIdx = epiIdx + itemIdx;
      if (rowIdx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y - 3, pageW - 28, 7, 'F');
      }
      doc.text(epi.dataEntrega ? new Date(epi.dataEntrega).toLocaleDateString('pt-BR') : '-', colX[0], y + 1);
      doc.text(String(item.quantidade), colX[1], y + 1);
      doc.text(item.insumoNome || '-', colX[2], y + 1);
      doc.text(item.numeroCA || '-', colX[3], y + 1);
      doc.text('', colX[4], y + 1);
      y += 7;
    });
  });

  // Signature lines
  y += 15;
  if (y > pageH - 30) {
    const fY = pageH - 10;
    doc.setFillColor(13, 31, 45);
    doc.rect(0, fY, pageW, 10, 'F');
    doc.setFontSize(7);
    doc.setTextColor(201, 163, 88);
    doc.text('Aplicativo criado por Engenheiro Civil Diego Kugert Betelli', 14, fY + 4);
    doc.setTextColor(200, 200, 200);
    doc.text('Página ' + pageNum, pageW - 14, fY + 6, { align: 'right' });
    doc.addPage();
    pageNum++;
    y = 20;
  }

  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('Entregue por:', 14, y);
  doc.line(50, y, 140, y);
  y += 10;
  doc.text('Recebido por:', 14, y);
  doc.line(55, y, 140, y);

  // Final Footer
  const footerY = pageH - 10;
  doc.setFillColor(13, 31, 45);
  doc.rect(0, footerY, pageW, 10, 'F');
  doc.setFontSize(7);
  doc.setTextColor(201, 163, 88);
  doc.text('Aplicativo criado por Engenheiro Civil Diego Kugert Betelli', 14, footerY + 4);
  doc.setTextColor(200, 200, 200);
  doc.text('Página ' + pageNum, pageW - 14, footerY + 6, { align: 'right' });

  doc.save('Ficha_EPIs_Consolidada_' + (nomeFuncionario || 'Todos') + '_' + new Date().toISOString().slice(0, 10) + '.pdf');
}

// Audit Log
export function auditLog(action: string, detail: string): void {
  try {
    const session = getCurrentSession();
    const activeObra = getActiveObra();
    const entry: AuditLogEntry = {
      timestamp: new Date().toLocaleString('pt-BR'),
      username: session ? session.username : 'desconhecido',
      action,
      detail,
      obra: activeObra ? activeObra.nome : 'Geral'
    };
    const current: AuditLogEntry[] = JSON.parse(localStorage.getItem(AUDIT_LOG_KEY) || '[]');
    current.unshift(entry);
    if (current.length > 500) current.length = 500;
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('Error writing audit log:', e);
  }
}

export function getAuditLogs(): AuditLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(AUDIT_LOG_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

// Backups
const BACKUP_LIST_KEY = 'backups_list';

export function createBackup(name?: string): BackupSnapshot {
  const data = getTenantData();
  const obras = getObras();
  const activeObra = getActiveObra();

  const backupContent = JSON.stringify({
    tenantData: data,
    obras,
    activeObraId: activeObra?.id || null,
    exportedAt: new Date().toISOString()
  });

  const snapshot: BackupSnapshot = {
    name: name || `Backup_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toLocaleString('pt-BR'),
    size: backupContent.length,
    data: backupContent
  };

  const backups = tget<BackupSnapshot[]>(BACKUP_LIST_KEY, []);
  backups.unshift(snapshot);
  if (backups.length > 20) backups.length = 20;
  tset<BackupSnapshot[]>(BACKUP_LIST_KEY, backups);

  auditLog('CRIAR_BACKUP', `Snapshot criado: ${snapshot.name}`);
  return snapshot;
}

export function getBackupsList(): BackupSnapshot[] {
  return tget<BackupSnapshot[]>(BACKUP_LIST_KEY, []);
}

export function restoreBackup(snapshot: BackupSnapshot): boolean {
  try {
    const parsed = JSON.parse(snapshot.data);
    if (parsed.tenantData) {
      saveTenantData(parsed.tenantData);
    }
    auditLog('RESTAURAR_BACKUP', `Snapshot restaurado: ${snapshot.name}`);
    return true;
  } catch (e) {
    console.error('Error restoring backup:', e);
    return false;
  }
}

export function deleteBackup(snapshotName: string): void {
  const backups = getBackupsList().filter(b => b.name !== snapshotName);
  tset<BackupSnapshot[]>(BACKUP_LIST_KEY, backups);
}

// PDF Export for Reports & CQ Concretagem
export function exportReportPDF(
  movimentos: Array<{
    data: string;
    tipo: 'Entrada' | 'Saída';
    codigo: string;
    nome: string;
    qtd: number;
    valor_unit: number;
    valor_total: number;
    fornecedorOuDestino?: string;
  }>,
  periodo: { ini?: string; fim?: string; tipo?: string }
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const activeObra = getActiveObra();
  const session = getCurrentSession();

  // Header Faixa Dourada
  doc.setFillColor(201, 163, 88);
  doc.rect(0, 0, doc.internal.pageSize.width, 6, 'F');

  // Header Azul
  doc.setFillColor(13, 31, 45);
  doc.rect(0, 6, doc.internal.pageSize.width, 22, 'F');

  doc.setFontSize(16);
  doc.setTextColor(201, 163, 88);
  doc.setFont('helvetica', 'bold');
  doc.text('PERFOR ENGENHARIA', 14, 17);

  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('GESTÃO • FISCALIZAÇÃO • GERENCIAMENTO DE OBRAS', 14, 23);

  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('PERFORT ALMOX — Relatório de Movimentações', doc.internal.pageSize.width - 14, 17, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text(`Obra: ${activeObra ? activeObra.nome : 'Geral'} | Emissão: ${new Date().toLocaleString('pt-BR')}`, doc.internal.pageSize.width - 14, 23, { align: 'right' });

  // Divider
  doc.setDrawColor(201, 163, 88);
  doc.setLineWidth(0.5);
  doc.line(14, 32, doc.internal.pageSize.width - 14, 32);

  // Period info
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  const iniText = periodo.ini || 'Início';
  const fimText = periodo.fim || 'Atual';
  const tipoText = periodo.tipo ? (periodo.tipo === 'entrada' ? 'Entradas' : 'Saídas') : 'Todas';
  doc.text(`Período: ${iniText} até ${fimText}  |  Filtro Tipo: ${tipoText}  |  Usuário: ${session?.username || 'Sistema'}`, 14, 38);

  const totalQTD = movimentos.reduce((s, m) => s + m.qtd, 0);
  const totalValor = movimentos.reduce((s, m) => s + m.valor_total, 0);

  doc.setFont('helvetica', 'bold');
  doc.text(`Total Registros: ${movimentos.length}  |  Qtd Total: ${formatNumber(totalQTD)}  |  Valor Total: ${formatCurrency(totalValor)}`, 14, 44);

  // Table
  const tableData = movimentos.map(m => [
    m.data,
    m.tipo,
    m.codigo,
    m.nome,
    formatNumber(m.qtd),
    formatCurrency(m.valor_unit),
    formatCurrency(m.valor_total),
    m.fornecedorOuDestino || '-'
  ]);

  (doc as any).autoTable({
    startY: 48,
    head: [['Data', 'Tipo', 'Código', 'Nome do Insumo', 'Qtd', 'Unitário', 'Total', 'Forn. / Destino']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [13, 31, 45], textColor: [201, 163, 88], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    didDrawPage: (data: any) => {
      // Footer
      doc.setFillColor(13, 31, 45);
      doc.rect(0, doc.internal.pageSize.height - 10, doc.internal.pageSize.width, 10, 'F');
      doc.setFontSize(8);
      doc.setTextColor(201, 163, 88);
      doc.text('PERFOR ENGENHARIA — SIENGE / STARIAN', 14, doc.internal.pageSize.height - 4);
      doc.setTextColor(200, 200, 200);
      doc.text(`Página ${data.pageNumber}`, doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 4, { align: 'right' });
    }
  });

  doc.save(`Relatorio_Movimentacoes_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// PDF Export for CQ Concretagem
export function exportCQConcretagemPDF(cqList: CQConcretagem[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const activeObra = getActiveObra();

  // Header Faixa Dourada
  doc.setFillColor(201, 163, 88);
  doc.rect(0, 0, doc.internal.pageSize.width, 6, 'F');

  // Header Azul
  doc.setFillColor(13, 31, 45);
  doc.rect(0, 6, doc.internal.pageSize.width, 22, 'F');

  doc.setFontSize(16);
  doc.setTextColor(201, 163, 88);
  doc.setFont('helvetica', 'bold');
  doc.text('PERFOR ENGENHARIA', 14, 17);

  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('CONTROLE DE QUALIDADE — CONCRETAGEM', 14, 23);

  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(`Obra: ${activeObra ? activeObra.nome : 'Icon Residence - CC 36'}`, doc.internal.pageSize.width - 14, 17, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text(`Relatório gerado em: ${new Date().toLocaleString('pt-BR')}`, doc.internal.pageSize.width - 14, 23, { align: 'right' });

  doc.setDrawColor(201, 163, 88);
  doc.setLineWidth(0.5);
  doc.line(14, 32, doc.internal.pageSize.width - 14, 32);

  const totalM3 = cqList.reduce((s, c) => s + (c.qtd || 0), 0);
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Registros: ${cqList.length}  |  Volume Total Concretado: ${formatNumber(totalM3, 2)} m³`, 14, 38);

  const tableData = cqList.map(c => [
    c.serie,
    c.data,
    c.etapa || '-',
    c.fase || '-',
    c.torre || '-',
    c.local || '-',
    c.fck ? `${c.fck} MPa` : '-',
    c.slump ? `${c.slump} mm` : '-',
    formatNumber(c.qtd, 2),
    c.nf || '-',
    c.concreteira || '-',
    c.responsavel || '-'
  ]);

  (doc as any).autoTable({
    startY: 42,
    head: [['Série CP', 'Data', 'Etapa', 'Fase/Local', 'Torre', 'Espec. Local', 'FCK', 'Slump', 'Vol (m³)', 'Nº NF', 'Concreteira', 'Resp.']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [13, 31, 45], textColor: [201, 163, 88], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 }
  });

  doc.save(`CQ_Concretagem_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// Excel Export
export function exportToExcel(filename: string, sheetName: string, data: any[]) {
  if (!data || data.length === 0) {
    alert('Nenhum dado para exportar.');
    return;
  }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
