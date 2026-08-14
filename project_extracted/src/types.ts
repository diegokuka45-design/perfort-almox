export type Role = 'Administrador' | 'Gerente' | 'Supervisor' | 'Operador';

export interface User {
  username: string;
  password?: string;
  role: Role;
  email?: string;
  permissoes?: string[];
}

export interface Obra {
  id: number;
  nome: string;
  endereco?: string;
  cliente?: string;
  responsavel?: string;
  inicio?: string;
  fim?: string;
  status: 'Ativa' | 'Pausada' | 'Concluída' | 'Cancelada';
  arquivada?: boolean;
  descricao?: string;
  estoque?: string;
  engenharia?: string;
  almoxarife?: string;
  createdAt?: string;
  updatedAt?: number;
}

export interface ItemInsumo {
  id?: number;
  codigo: string;
  nome: string;
  familia: string;
  unidade: string;
  detalhe?: string;
  quantidade: number; // Estoque inicial
  estoque_min: number;
  localizacao?: string;
  entradas_total?: number;
  saidas_total?: number;
  preco_medio?: number;
  custo_medio?: number;
  fornecedor?: string;
  qtd_contada?: number;
  obraId?: number;
  obraNome?: string;
  updatedAt?: number;
}

export interface EntradaStock {
  id: number;
  data: string;
  codigo: string;
  nome: string;
  qtd: number;
  valor_unit: number;
  valor_total: number;
  fornecedor?: string;
  nf?: string;
  obs?: string;
  obraId?: number;
  obraNome?: string;
  updatedAt?: number;
}

export interface SaidaStock {
  id: number;
  data: string;
  codigo: string;
  nome: string;
  qtd: number;
  valor_unit: number;
  valor_total: number;
  destino?: string;
  solicitante?: string;
  cc?: string;
  obs?: string;
  obraId?: number;
  obraNome?: string;
  updatedAt?: number;
}

export interface CQConcretagem {
  id: number;
  etapa: string;
  setor: string;
  fase: string;
  serie: string;
  data: string;
  torre: string;
  local: string;
  etiqueta: string;
  qtd: number;
  fck: string;
  slump: string;
  nf: string;
  concreteira: string;
  corpos?: string;
  responsavel?: string;
  obs?: string;
  obraId?: number;
  obraNome?: string;
}

export interface AuditLogEntry {
  timestamp: string;
  username: string;
  action: string;
  detail: string;
  obra: string;
}

export interface BackupSnapshot {
  name: string;
  timestamp: string;
  size: number;
  data: string;
}

export interface ProcessNotaActionItem {
  type: 'NEW' | 'EXISTING';
  codigo: string;
  nome: string;
  qtd: number;
  unidade: string;
  valor_unit: number;
  valor_total: number;
  familia?: string;
  estoque_min?: number;
}

export interface ProcessNotaAction {
  actionType: 'PROCESS_NOTA_FISCAL';
  nfNumber: string;
  fornecedor: string;
  dataEmissao?: string;
  obraId?: number;
  obraNome?: string;
  items: ProcessNotaActionItem[];
}

export interface IAMessage {
  role: 'user' | 'model';
  text: string;
  image?: string | null;
  timestamp?: string;
  actionPayload?: ProcessNotaAction;
  appliedAction?: boolean;
}

// ─── Empréstimo de Ferramentas ─────────────────────────────

export type TipoDestino = 'Funcionário' | 'Terceiros';
export type StatusEmprestimo = 'Pendente' | 'Devolvido' | 'Não Devolvido';

export interface FerramentaEmprestimo {
  id: string;
  dataEmprestimo: string;
  tipoDestino: TipoDestino;
  destinoNome: string;
  destinoLocal: string;
  ferramentas: string[];
  observacao?: string;
  status: StatusEmprestimo;
  obraId: number;
  obraNome: string;
  dataDevolucao?: string;
}

export interface RelatorioNaoDevolucao {
  id: string;
  dataGeracao: string;
  pendentes: string[];
  observacao: string;
}

export interface ExtensaoEnergia {
  id: string;
  sequencia: string;
  nome: string;
  local: string;
  descricao?: string;
  obraId?: number;
}
