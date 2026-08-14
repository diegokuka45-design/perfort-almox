# PERFORT ALMOX

Sistema de Gestão de Almoxarifado para Construção Civil — desenvolvido com **React 19 + Vite 6 + TypeScript 5.8 + Tailwind CSS 4**.

## 🚀 Tecnologias

- **React 19** — Interface de usuário
- **Vite 6** — Build tool e dev server
- **TypeScript 5.8** — Tipagem estática
- **Tailwind CSS 4** — Estilização utilitária
- **shadcn/ui** — Componentes de UI
- **Lucide React** — Ícones
- **Firebase** — Backend e autenticação (opcional)
- **Gemini API** — Assistente de IA integrado

## 📋 Pré-requisitos

- [Node.js](https://nodejs.org/) 18+ (recomendado 20 LTS)
- npm, yarn, pnpm ou bun

## ⚙️ Instalação

Clone ou extraia o projeto e execute o comando de instalação:

```bash
# Usando npm
npm install

# Ou usando yarn
yarn install

# Ou usando pnpm
pnpm install

# Ou usando bun
bun install
```

## 🔑 Configuração de Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

```env
# Chave da API Gemini (obrigatória para o módulo de Assistente de IA)
GEMINI_API_KEY=sua_chave_aqui

# Configurações do Firebase (opcional — para sincronização em nuvem)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

> 💡 Obtenha sua chave Gemini em: https://ai.google.dev/

## ▶️ Executando o Projeto

### Ambiente de Desenvolvimento

```bash
# Inicia o servidor de desenvolvimento com hot reload
npm run dev

# O aplicativo estará disponível em:
# http://localhost:5173
```

### Build para Produção

```bash
# Compila o projeto para produção (pasta dist/)
npm run build

# O build otimizado será gerado em ./dist
```

### Preview da Build de Produção

```bash
# Serve localmente a build de produção para testar
npm run preview

# Disponível em: http://localhost:4173
```

### Type Check (sem emitir arquivos)

```bash
# Verifica tipagem do TypeScript sem gerar arquivos
npx tsc --noEmit
```

## 📁 Estrutura do Projeto

```
perfort-almox/
├── public/                  # Arquivos estáticos públicos
│   ├── _redirects           # SPA redirects (Netlify)
│   └── robots.txt           # Diretrizes para crawlers
├── src/
│   ├── components/          # Componentes de interface (views)
│   │   ├── DashboardView.tsx
│   │   ├── CadastroView.tsx
│   │   ├── EntradasView.tsx
│   │   ├── SaidasView.tsx
│   │   ├── InventarioView.tsx
│   │   ├── RelatoriosView.tsx
│   │   ├── AlertasView.tsx
│   │   ├── CQConcretagemView.tsx
│   │   ├── ObrasView.tsx
│   │   ├── UsuariosView.tsx
│   │   ├── BackupView.tsx
│   │   ├── ConfigView.tsx
│   │   ├── AssistenteIAView.tsx
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── LoginOverlay.tsx
│   ├── lib/                 # Utilitários e integrações
│   │   ├── storage.ts       # Persistência local (localStorage)
│   │   ├── firebase.ts      # Configuração Firebase
│   │   ├── gemini.ts        # Integração com Gemini API
│   │   └── imgbb.ts         # Upload de imagens
│   ├── data/                # Dados mockados e seeds
│   │   └── mockData.ts
│   ├── types.ts             # Tipos globais TypeScript
│   ├── App.tsx              # Componente raiz e roteamento
│   ├── main.tsx             # Ponto de entrada
│   └── index.css            # Estilos globais (Tailwind)
├── index.html               # HTML principal
├── vite.config.ts           # Configuração do Vite (otimizado para Netlify)
├── tsconfig.json            # Configuração do TypeScript
├── package.json             # Dependências e scripts
├── netlify.toml             # Configuração do Netlify (SPA, cache, build)
├── .nvmrc                   # Versão do Node.js (20)
├── .gitignore               # Arquivos ignorados pelo Git
├── .env.local               # Variáveis de ambiente (não versionar)
└── .github/workflows/        # CI/CD do GitHub Actions
    └── ci.yml
```

## 🧩 Módulos do Sistema

| Módulo | Descrição |
|--------|-----------|
| **Dashboard** | Visão geral com indicadores e gráficos |
| **Cadastro** | Cadastro de materiais e insumos |
| **Entradas** | Registro de entradas no estoque |
| **Saídas** | Registro de saídas/retiradas |
| **Inventário** | Contagem e ajuste de estoque |
| **Relatórios** | Geração de relatórios em PDF/Excel |
| **Alertas** | Notificações de estoque mínimo e validade |
| **CQ Concretagem** | Controle de qualidade de concreto |
| **Obras** | Gestão de obras e canteiros |
| **Usuários** | Controle de acessos e permissões |
| **Backup** | Exportação/importação de dados |
| **Configurações** | Ajustes do sistema |
| **Assistente IA** | Chat inteligente com Gemini |

## 🛠️ Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento |
| `npm run build` | Compila para produção |
| `npm run preview` | Preview da build de produção |
| `npx tsc --noEmit` | Verificação de tipos TypeScript |

## 🔄 CI/CD (GitHub Actions)

O projeto inclui um workflow de integração contínua em `.github/workflows/ci.yml` que executa automaticamente em **push** e **pull requests** para as branches `main` ou `master`:

| Etapa | Descrição |
|-------|-----------|
| **Checkout** | Faz checkout do código fonte |
| **Setup Node.js 20** | Configura ambiente com cache de dependências |
| **Instalar dependências** | Executa `npm ci` para instalação limpa e determinística |
| **Type Check** | Verifica tipagem com `npx tsc --noEmit` |
| **Build** | Compila o projeto para produção com `npm run build` |
| **Upload artefato** | Salva a pasta `dist/` como artefato do workflow (7 dias) |

Para ativar, basta fazer push deste repositório para o GitHub. O workflow aparecerá na aba **Actions**.

## 📦 Deploy no Netlify (Recomendado)

O projeto está **100% otimizado para deploy no Netlify** com as seguintes configurações:

### Arquivos de configuração incluídos:

| Arquivo | Função |
|---------|--------|
| `netlify.toml` | Build, redirects SPA, headers de cache |
| `public/_redirects` | Fallback para `index.html` (React Router) |
| `.nvmrc` | Fixa Node.js 20 no ambiente Netlify |

### Deploy via Git (GitHub + Netlify):

1. **Crie um repositório no GitHub** e envie este projeto:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/perfort-almox.git
   git push -u origin main
   ```

2. **No Netlify:**
   - Acesse [netlify.com](https://www.netlify.com/) → "Add new site" → "Import an existing project"
   - Conecte sua conta do GitHub
   - Selecione o repositório `perfort-almox`
   - O Netlify detectará automaticamente:
     - **Build command:** `npm run build`
     - **Publish directory:** `dist`
   - Clique em **Deploy site**

3. **Configure variáveis de ambiente no Netlify:**
   - Site settings → Environment variables
   - Adicione `GEMINI_API_KEY` (e as variáveis do Firebase, se usar)

4. **Pronto!** A cada `git push` na branch `main`, o site será rebuildado automaticamente.

### Deploy via Drag & Drop (sem Git):

1. Execute localmente: `npm run build`
2. Acesse [netlify.com](https://www.netlify.com/) → "Add new site" → "Deploy manually"
3. Arraste a pasta `dist/` para a área indicada

### Outras Plataformas:

- **Vercel** — compatível com SPA (configuração `base: '/'` já aplicada)
- **Firebase Hosting** — compatível com build estático
- **GitHub Pages** — use `base: '/nome-repo/'` no `vite.config.ts`

## 📝 Licença

Projeto desenvolvido para gestão interna de almoxarifado de construção civil.

---

> **Dica:** Para desenvolvimento local sem Firebase, o sistema funciona 100% com `localStorage`. A sincronização em nuvem é opcional.
