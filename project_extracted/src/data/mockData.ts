import { Obra, ItemInsumo, User } from '../types';

export const MASTER_USER: User = {
  username: 'Diegokb',
  password: '1307',
  role: 'Administrador',
  email: 'admin@perfort.com.br',
  permissoes: [
    'dashboard', 'cadastro', 'entradas', 'saidas', 'inventario',
    'emprestimos', 'relatorio', 'alertas', 'config', 'usuarios', 'backup',
    'obras', 'cq-concretagem', 'editar',
    'excluir', 'exportar', 'importar', 'sync'
  ]
};

export const DEFAULT_USERS: User[] = [
  MASTER_USER
];

export const FAMILIAS = [
  "Geral",
  "Armadura",
  "Combustíveis, Óleos e Lubrificantes",
  "Concretos",
  "Condicionador de Ar",
  "Diversos",
  "Equipamentos de Proteção Coletiva (EPC's)",
  "Equipamentos de Proteção Individual (EPI's)",
  "Expediente",
  "Fechaduras e Ferragens",
  "Ferramentas",
  "Interruptores, Tomadas e Conjuntos",
  "Limpeza",
  "Locação de Máquinas, Equipamentos e Ferramentas (Terceiros)",
  "Madeira Serrada Para Uso Geral",
  "Materiais Aplicados",
  "Materiais Elétricos Diversos",
  "Materiais de Higiene",
  "Materiais de Limpeza",
  "Peças Automotivas Para Manutenção de Imobilizado",
  "Pintura",
  "Suprimentos cozinha"
];

export const DEFAULT_OBRAS: Obra[] = [];

export const DEFAULT_INSUMOS_DEMO: ItemInsumo[] = [];

export const OBRA_2_INSUMOS_DEMO: ItemInsumo[] = [];
