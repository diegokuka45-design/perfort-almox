export type Role = 'Administrador' | 'Gerente' | 'Supervisor' | 'Operador';

export interface User {
  username: string;
  password?: string;
  role: Role;
  email?: string;
  permissoes?: string[];
}

export interface Obra {
  id: string;
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
  id?: string;
  codigo: string;
  nome: string;
  familia: string;
  categoria: string;
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
  obraId?: string;
  updatedAt?: number;
  caNumero?: string; // Número do Certificado de Aprovação (C.A.) para EPIs
}

export interface EntradaStock {
  id: string;
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
  id: string;
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
  id: string;
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

// ===================== Empréstimo de Ferramentas =====================

export interface EmprestimoFerramenta {
  id: string;
  insumoId: string;
  insumoNome: string;
  insumoCodigo: string;
  quantidade: number;
  retiradoPor: string;
  funcaoRetirante: string;
  empresa?: string; // Empresa obrigatória quando retirante for "Terceiro"
  dataRetirada: string;
  horaRetirada: string;
  dataPrevistaDevolucao: string;
  horaPrevistaDevolucao: string;
  dataDevolucao?: string;
  horaDevolucao?: string;
  status: 'emprestado' | 'devolvido' | 'atrasado' | 'bloqueado';
  observacao?: string;
  obraId: string;
  obraNome: string;
  isAdminOverride?: boolean;
}

// ===================== Fornecimento de EPIs =====================

export interface EpiFornecimento {
  id: string;
  funcionarioNome: string;
  funcionarioFuncao: string;
  funcionarioSetor: string;
  funcionarioTurno: string;
  empresa?: string; // Empresa do funcionário
  epiItens: EpiItem[];
  dataEntrega: string;
  observacao?: string;
  obraId: string;
  obraNome: string;
}

export interface EpiItem {
  insumoId: string;
  insumoNome: string;
  insumoCodigo: string;
  numeroCA: string;
  quantidade: number;
}

// ===================== Fornecimento de Materiais de Consumo =====================

export interface MaterialConsumo {
  id: string;
  insumoId: string;
  insumoNome: string;
  insumoCodigo: string;
  quantidade: number;
  retiradoPor: string;
  destino: string;
  data: string;
  observacao?: string;
  obraId: string;
  obraNome: string;
}
