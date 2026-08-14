import { ItemInsumo, EntradaStock, SaidaStock, CQConcretagem, Obra, User, AuditLogEntry, BackupSnapshot, FerramentaEmprestimo, RelatorioNaoDevolucao, ExtensaoEnergia, StatusEmprestimo } from '../types';
import { DEFAULT_OBRAS, DEFAULT_INSUMOS_DEMO, OBRA_2_INSUMOS_DEMO, DEFAULT_USERS, MASTER_USER } from '../data/mockData';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Seed initial CQ Concretagem data per Obra — vazio por padrão
const OBRA_1_CQ: CQConcretagem[] = [];
const OBRA_2_CQ: CQConcretagem[] = [];

// Constant Keys
const OBRAS_KEY = 'perfort_almox_obras';
const OBRA_ATUAL_KEY = 'perfort_almox_obra_atual';
const USERS_KEY = 'perfort_almox_users';
const SESSION_KEY = 'perfort_almox_session';
const AUDIT_LOG_KEY = 'perfort_almox_audit';
const IMPORTED_INSUMOS_KEY = 'perfort_almox_imported_insumos';

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

export function tset<T>(key: string, value: T): void {
  try {
    localStorage.setItem(getTenantPrefix() + key, JSON.stringify(value));
  } catch (e) {
    console.error('Error in tset:', e);
  }
}

export function tget<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(getTenantPrefix() + key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (e) {
    return defaultValue;
  }
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

// Tenant Data CRUD
export interface TenantData {
  items: ItemInsumo[];
  entradas: EntradaStock[];
  saidas: SaidaStock[];
  nextEntradaId: number;
  nextSaidaId: number;
  emprestimos?: FerramentaEmprestimo[];
  relatoriosNaoDevolucao?: RelatorioNaoDevolucao[];
  extensoesEnergia?: ExtensaoEnergia[];
}

export function getTenantData(obraIdOverride?: number | null): TenantData {
  const activeObra = obraIdOverride !== undefined
    ? (obraIdOverride === null ? null : getObras().find(o => o.id === obraIdOverride) || null)
    : getActiveObra();

  if (activeObra) {
    const key = `tenant_${activeObra.id}_data`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error("Error parsing tenant data:", e);
      }
    }

    // Sistema inicia limpo — sem dados demo
    const seed: TenantData = {
      items: [],
      entradas: [],
      saidas: [],
      nextEntradaId: 1,
      nextSaidaId: 1
    };

    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  }

  // Active Obra is null => Visão Geral (Consolidate across ALL obras)
  const obras = getObras();
  let consolidatedItems: ItemInsumo[] = [];
  let consolidatedEntradas: EntradaStock[] = [];
  let consolidatedSaidas: SaidaStock[] = [];
  let maxEntradaId = 1;
  let maxSaidaId = 1;

  for (const o of obras) {
    const data = getTenantData(o.id);
    consolidatedItems.push(...data.items.map(i => ({ ...i, obraId: o.id, obraNome: o.nome })));
    consolidatedEntradas.push(...data.entradas.map(e => ({ ...e, obraId: o.id, obraNome: o.nome })));
    consolidatedSaidas.push(...data.saidas.map(s => ({ ...s, obraId: o.id, obraNome: o.nome })));
    if (data.nextEntradaId > maxEntradaId) maxEntradaId = data.nextEntradaId;
    if (data.nextSaidaId > maxSaidaId) maxSaidaId = data.nextSaidaId;
  }

  return {
    items: consolidatedItems,
    entradas: consolidatedEntradas,
    saidas: consolidatedSaidas,
    nextEntradaId: maxEntradaId,
    nextSaidaId: maxSaidaId
  };
}

export function saveTenantData(data: TenantData, obraIdOverride?: number): void {
  const activeObra = obraIdOverride ? getObras().find(o => o.id === obraIdOverride) : getActiveObra();
  if (activeObra) {
    const key = `tenant_${activeObra.id}_data`;
    localStorage.setItem(key, JSON.stringify(data));
  } else {
    // If no active obra, save under first obra
    const first = getObras()[0];
    if (first) {
      localStorage.setItem(`tenant_${first.id}_data`, JSON.stringify(data));
    }
  }
}

export function getCQList(obraIdOverride?: number | null): CQConcretagem[] {
  const activeObra = obraIdOverride !== undefined 
    ? (obraIdOverride === null ? null : getObras().find(o => o.id === obraIdOverride) || null)
    : getActiveObra();

  if (activeObra) {
    const key = `tenant_${activeObra.id}_cq_concretagem`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error("Error parsing CQ list:", e);
      }
    }

    const seed: CQConcretagem[] = [];
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  }

  // Consolidate across all Obras
  const obras = getObras();
  let consolidatedCQ: CQConcretagem[] = [];
  for (const o of obras) {
    const list = getCQList(o.id);
    consolidatedCQ.push(...list.map(c => ({ ...c, obraId: o.id, obraNome: o.nome })));
  }
  return consolidatedCQ;
}

export function saveCQList(cqList: CQConcretagem[], obraIdOverride?: number): void {
  const activeObra = obraIdOverride ? getObras().find(o => o.id === obraIdOverride) : getActiveObra();
  if (activeObra) {
    const key = `tenant_${activeObra.id}_cq_concretagem`;
    localStorage.setItem(key, JSON.stringify(cqList));
  } else {
    const first = getObras()[0];
    if (first) {
      localStorage.setItem(`tenant_${first.id}_cq_concretagem`, JSON.stringify(cqList));
    }
  }
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

// ─── Insumos Importados (banco separado) ─────────────────────────────
export interface ImportedInsumoRecord {
  id: number;
  nome: string;
  variacao: string;
  codigo: string;
  unidade: string;
  familia: string;
  importedAt: string;
  obraId: number;
  obraNome: string;
}

export function getImportedInsumos(): ImportedInsumoRecord[] {
  try {
    return JSON.parse(localStorage.getItem(IMPORTED_INSUMOS_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

export function saveImportedInsumos(records: ImportedInsumoRecord[]): void {
  localStorage.setItem(IMPORTED_INSUMOS_KEY, JSON.stringify(records));
}

export function isInsumoAlreadyImported(nome: string, variacao: string, obraId?: number): boolean {
  const all = getImportedInsumos();
  return all.some(r =>
    r.nome.toLowerCase() === nome.toLowerCase() &&
    r.variacao.toLowerCase() === variacao.toLowerCase() &&
    (obraId === undefined || r.obraId === obraId)
  );
}

export function isInsumoAlreadyInObra(nome: string, variacao: string, obraId?: number): boolean {
  if (!obraId) return false;
  const data = getTenantData(obraId);
  return data.items.some(i =>
    i.nome.toLowerCase() === nome.toLowerCase() &&
    (i.detalhe || '').toLowerCase() === variacao.toLowerCase()
  );
}

export function addImportedInsumo(record: Omit<ImportedInsumoRecord, 'importedAt'>): ImportedInsumoRecord {
  const all = getImportedInsumos();
  const newRecord: ImportedInsumoRecord = {
    ...record,
    importedAt: new Date().toISOString()
  };
  all.unshift(newRecord);
  saveImportedInsumos(all);
  return newRecord;
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

  const totalQtd = movimentos.reduce((s, m) => s + m.qtd, 0);
  const totalValor = movimentos.reduce((s, m) => s + m.valor_total, 0);

  doc.setFont('helvetica', 'bold');
  doc.text(`Total Registros: ${movimentos.length}  |  Qtd Total: ${formatNumber(totalQtd)}  |  Valor Total: ${formatCurrency(totalValor)}`, 14, 44);

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

  autoTable(doc, {
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

  autoTable(doc, {
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

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

// ===== EMPRÉSTIMO DE FERRAMENTAS =====

export function getEmprestimos(obraId?: number): FerramentaEmprestimo[] {
  const data = getTenantData(obraId);
  return data.emprestimos || [];
}

export function saveEmprestimos(emprestimos: FerramentaEmprestimo[], obraId?: number): void {
  const data = getTenantData(obraId);
  data.emprestimos = emprestimos;
  saveTenantData(data, obraId);
}

export function getRelatoriosNaoDevolucao(obraId?: number): RelatorioNaoDevolucao[] {
  const data = getTenantData(obraId);
  return data.relatoriosNaoDevolucao || [];
}

export function saveRelatoriosNaoDevolucao(relatorios: RelatorioNaoDevolucao[], obraId?: number): void {
  const data = getTenantData(obraId);
  data.relatoriosNaoDevolucao = relatorios;
  saveTenantData(data, obraId);
}

export function getExtensoesEnergia(obraId?: number): ExtensaoEnergia[] {
  const data = getTenantData(obraId);
  return data.extensoesEnergia || [];
}

export function saveExtensoesEnergia(extensoes: ExtensaoEnergia[], obraId?: number): void {
  const data = getTenantData(obraId);
  data.extensoesEnergia = extensoes;
  saveTenantData(data, obraId);
}

// Verifica se há alguma pendência ativa com mais de 48h
export function hasPendenciaMaior48h(obraId?: number): boolean {
  const emprestimos = getEmprestimos(obraId).filter(e => e.status === 'Pendente');
  if (emprestimos.length === 0) return false;
  const now = new Date().getTime();
  const h48 = 48 * 60 * 60 * 1000;
  return emprestimos.some(e => {
    const dataEmp = new Date(e.dataEmprestimo).getTime();
    return (now - dataEmp) > h48;
  });
}

// Retorna lista de empréstimos pendentes com mais de 48h
export function getPendentesMaior48h(obraId?: number): FerramentaEmprestimo[] {
  const emprestimos = getEmprestimos(obraId).filter(e => e.status === 'Pendente');
  const now = new Date().getTime();
  const h48 = 48 * 60 * 60 * 1000;
  return emprestimos.filter(e => {
    const dataEmp = new Date(e.dataEmprestimo).getTime();
    return (now - dataEmp) > h48;
  });
}

// Gera relatório de não devolução automaticamente (chamado na notificação 16:30)
export function gerarRelatorioNaoDevolucao(obraId?: number): RelatorioNaoDevolucao | null {
  const pendentes = getPendentesMaior48h(obraId);
  if (pendentes.length === 0) return null;

  const relatorio: RelatorioNaoDevolucao = {
    id: generateId(),
    dataGeracao: new Date().toISOString(),
    pendentes: pendentes.map(e => e.id),
    observacao: `Relatório gerado automaticamente: ${pendentes.length} empréstimo(s) pendente(s) há mais de 48h.`
  };

  const relatorios = getRelatoriosNaoDevolucao(obraId);
  relatorios.unshift(relatorio);
  saveRelatoriosNaoDevolucao(relatorios, obraId);
  return relatorio;
}

// ===== EXTENSÃO DE ENERGIA =====

export function getProximaSequenciaExtensao(obraId?: number): string {
  const extensoes = getExtensoesEnergia(obraId);
  const ano = new Date().getFullYear().toString().slice(-2);
  const maxSeq = extensoes
    .filter(e => e.sequencia.endsWith(`/${ano}`))
    .reduce((max, e) => {
      const num = parseInt(e.sequencia.split('/')[0], 10) || 0;
      return Math.max(max, num);
    }, 0);
  return `${String(maxSeq + 1).padStart(3, '0')}/${ano}`;
}

export function addExtensaoEnergia(extensao: Omit<ExtensaoEnergia, 'id' | 'sequencia'>): ExtensaoEnergia {
  const all = getExtensoesEnergia();
  const novo: ExtensaoEnergia = {
    ...extensao,
    id: generateId(),
    sequencia: getProximaSequenciaExtensao()
  };
  all.unshift(novo);
  saveExtensoesEnergia(all);
  return novo;
}

export function getExtensaoById(id: string): ExtensaoEnergia | undefined {
  return getExtensoesEnergia().find(e => e.id === id);
}

export function getExtensaoBySequencia(sequencia: string): ExtensaoEnergia | undefined {
  return getExtensoesEnergia().find(e => e.sequencia === sequencia);
}

export function deleteExtensaoEnergia(id: string): void {
  const all = getExtensoesEnergia().filter(e => e.id !== id);
  saveExtensoesEnergia(all);
}

export function updateExtensaoEnergia(id: string, updates: Partial<ExtensaoEnergia>): ExtensaoEnergia | null {
  const all = getExtensoesEnergia();
  const idx = all.findIndex(e => e.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates };
  saveExtensoesEnergia(all);
  return all[idx];
}

export function getExtensaoEnergiaCount(): number {
  return getExtensoesEnergia().length;
}

export function extensaoSequenciaExists(sequencia: string): boolean {
  return getExtensoesEnergia().some(e => e.sequencia === sequencia);
}

// Função para marcar empréstimo como devolvido
export function devolverEmprestimo(id: string, obraId?: number): FerramentaEmprestimo | null {
  const all = getEmprestimos(obraId);
  const idx = all.findIndex(e => e.id === id);
  if (idx === -1) return null;
  all[idx] = {
    ...all[idx],
    status: 'Devolvido' as StatusEmprestimo,
    dataDevolucao: new Date().toISOString()
  };
  saveEmprestimos(all, obraId);
  return all[idx];
}

export function addEmprestimo(emprestimo: Omit<FerramentaEmprestimo, 'id' | 'status' | 'dataEmprestimo'>): FerramentaEmprestimo {
  const all = getEmprestimos();
  const novo: FerramentaEmprestimo = {
    ...emprestimo,
    id: generateId(),
    status: 'Pendente' as StatusEmprestimo,
    dataEmprestimo: new Date().toISOString()
  };
  all.unshift(novo);
  saveEmprestimos(all);
  return novo;
}

export function getEmprestimoById(id: string): FerramentaEmprestimo | undefined {
  return getEmprestimos().find(e => e.id === id);
}

export function deleteEmprestimo(id: string): void {
  const all = getEmprestimos().filter(e => e.id !== id);
  saveEmprestimos(all);
}

