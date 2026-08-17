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

export interface IAMessage {
  role: 'user' | 'model';
  text: string;
  image?: string | null;
  timestamp?: string;
}
