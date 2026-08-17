import { Obra, ItemInsumo, User } from '../types';

export const MASTER_USER: User = {
  username: 'Diegokb',
  password: '1307',
  role: 'Administrador',
  email: 'admin@perfort.com.br',
  permissoes: [
    'dashboard', 'cadastro', 'entradas', 'saidas', 'inventario',
    'relatorio', 'alertas', 'config', 'usuarios', 'backup',
    'obras', 'cq-concretagem', 'assistente-ia', 'editar',
    'excluir', 'exportar', 'importar', 'sync',
    'emprestimo-ferramentas', 'epi-fornecimento', 'material-consumo'
  ]
};

export const DEFAULT_USERS: User[] = [
  MASTER_USER,
  {
    username: 'almoxarife.obra1',
    password: '123',
    role: 'Operador',
    email: 'almoxarife1@perfort.com.br',
    permissoes: ['dashboard', 'entradas', 'saidas', 'inventario', 'relatorio', 'alertas', 'cq-concretagem', 'exportar']
  },
  {
    username: 'engenheiro.obra1',
    password: '123',
    role: 'Supervisor',
    email: 'engenharia1@perfort.com.br',
    permissoes: ['dashboard', 'cadastro', 'entradas', 'saidas', 'inventario', 'relatorio', 'alertas', 'obras', 'cq-concretagem', 'editar', 'exportar']
  }
];

export const FAMILIAS = [
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

export const DEFAULT_OBRAS: Obra[] = [
  {
    id: '1',
    nome: 'Icon Residence - Centro de Custo 36',
    endereco: 'Av. Principal, 1500 - Centro',
    cliente: 'Icon Empreendimentos',
    responsavel: 'Eng. Roberto Silva',
    inicio: '2025-12-01',
    fim: '2026-08-30',
    status: 'Ativa',
    descricao: 'Obra residencial multifamiliar de 20 pavimentos',
    estoque: 'Eng. Roberto',
    engenharia: 'Carlos Eduardo',
    almoxarife: 'Marcos Souza'
  },
  {
    id: '2',
    nome: 'Edifício Horizon Tower',
    endereco: 'Rua das Palmeiras, 450 - Jardins',
    cliente: 'Horizon Imóveis',
    responsavel: 'Eng. Patricia Lima',
    inicio: '2026-01-15',
    fim: '2027-03-31',
    status: 'Ativa',
    descricao: 'Torre comercial corporativa',
    estoque: 'Patricia Lima',
    engenharia: 'Lucas Mendes',
    almoxarife: 'João Pedro'
  }
];

export const DEFAULT_INSUMOS_DEMO: ItemInsumo[] = [
  {
    codigo: 'ARM001',
    nome: 'Vergalhão CA-50 10mm (3/8")',
    familia: 'Armadura',
    categoria: 'Estrutural',
    unidade: 'KG',
    detalhe: 'Barra dobrada de 12 metros CA-50',
    quantidade: 500,
    estoque_min: 200,
    localizacao: 'Patio A',
    entradas_total: 1200,
    saidas_total: 850,
    preco_medio: 6.80,
    custo_medio: 6.50,
    fornecedor: 'Gerdau Aços',
    obraId: '1'
  },
  {
    codigo: 'ARM002',
    nome: 'Vergalhão CA-50 12.5mm (1/2")',
    familia: 'Armadura',
    categoria: 'Estrutural',
    unidade: 'KG',
    detalhe: 'Barra reta de 12 metros CA-50',
    quantidade: 300,
    estoque_min: 250,
    localizacao: 'Patio A',
    entradas_total: 800,
    saidas_total: 920,
    preco_medio: 6.90,
    custo_medio: 6.70,
    fornecedor: 'ArcelorMittal',
    obraId: '1'
  },
  {
    codigo: 'CNC001',
    nome: 'Cimento CP II-F 32 Saco 50kg',
    familia: 'Concretos',
    categoria: 'Alvenaria',
    unidade: 'SC',
    detalhe: 'Cimento Portland composto com fúler',
    quantidade: 100,
    estoque_min: 150,
    localizacao: 'Almox do Cimento',
    entradas_total: 400,
    saidas_total: 480,
    preco_medio: 38.50,
    custo_medio: 37.00,
    fornecedor: 'Votorantim Cimentos',
    obraId: '1'
  },
  {
    codigo: 'EPI001',
    nome: 'Capacete de Segurança Classe B com Carneira',
    familia: "Equipamentos de Proteção Individual (EPI's)",
    categoria: 'EPIs',
    unidade: 'UN',
    detalhe: 'Capacete branco com jugular CA 31469',
    quantidade: 40,
    estoque_min: 15,
    localizacao: 'Almox Central - Prateleira B1',
    entradas_total: 60,
    saidas_total: 45,
    preco_medio: 22.00,
    custo_medio: 21.50,
    fornecedor: 'Promat EPIs',
    obraId: '1'
  },
  {
    codigo: 'EPI002',
    nome: 'Luva de Vaqueta Cano Curto M',
    familia: "Equipamentos de Proteção Individual (EPI's)",
    categoria: 'EPIs',
    unidade: 'PAR',
    detalhe: 'Couro vaqueta para armadores e carpinteiros',
    quantidade: 10,
    estoque_min: 25,
    localizacao: 'Almox Central - Prateleira B2',
    entradas_total: 50,
    saidas_total: 52,
    preco_medio: 18.50,
    custo_medio: 18.00,
    fornecedor: 'Promat EPIs',
    obraId: '2'
  },
  {
    codigo: 'MAD001',
    nome: 'Tábua de Pinho 1" x 12" (2.5 x 30cm) 3m',
    familia: 'Madeira Serrada Para Uso Geral',
    categoria: 'Cobertura/Madeira',
    unidade: 'M',
    detalhe: 'Madeira para fôrmas e caixaria',
    quantidade: 200,
    estoque_min: 80,
    localizacao: 'Depósito Madeiras',
    entradas_total: 500,
    saidas_total: 380,
    preco_medio: 14.20,
    custo_medio: 13.80,
    fornecedor: 'Madeireira União',
    obraId: '1'
  },
  {
    codigo: 'FER001',
    nome: 'Disco de Corte Diamantado 4.5" Segmentado',
    familia: 'Ferramentas',
    categoria: 'Ferramentas',
    unidade: 'UN',
    detalhe: 'Para esmerilhadeira, corte de concreto e alvenaria',
    quantidade: 30,
    estoque_min: 10,
    localizacao: 'Ferramentaria - Armário 2',
    entradas_total: 80,
    saidas_total: 65,
    preco_medio: 28.00,
    custo_medio: 26.50,
    fornecedor: 'Makita Brasil',
    obraId: '1'
  }
];
