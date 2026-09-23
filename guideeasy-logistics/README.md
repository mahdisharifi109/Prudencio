# Prudêncio — Sistema de Gestão de Guias de Transporte (PWA)

Aplicação **PWA** completa para gestão de guias de transporte e obras, com suporte a upload de PDFs, extração OCR/QR Code, exportação para Excel e controlo de checklists.

---

## 🗄️ Backend: Neon PostgreSQL + Drizzle ORM

O projeto utiliza **Neon PostgreSQL** como base de dados, com **Drizzle ORM** para queries type-safe. Totalmente compatível com deploy serverless na Vercel.

### Arquitetura:

- **Drizzle ORM + @neondatabase/serverless** — CRUD de dados via HTTP (sem pools persistentes)
- **JWT + Cookies HTTP-only** — Gestão de sessões
- **bcryptjs** — Hash de passwords
- **TanStack Start (SSR) + Nitro** — Framework full-stack

---

## 📋 Variáveis de Ambiente

Crie um ficheiro `.env.local` baseado no `.env.example`:

| Variável         | Descrição                                             | Obrigatório |
| ---------------- | ----------------------------------------------------- | ----------- |
| `DATABASE_URL`   | URL de conexão Neon PostgreSQL (pooled)               | ✅ Sim      |
| `JWT_SECRET`     | Chave secreta para tokens JWT                         | ✅ Sim      |
| `ADMIN_EMAIL`    | Email do administrador (padrão: `admin@prudencio.pt`) | ✅ Sim      |
| `ADMIN_PASSWORD` | Password do administrador                             | ✅ Sim      |
| `ADMIN_NAME`     | Nome do administrador (padrão: `Administrador`)       | Não         |

---

## 💻 Desenvolvimento Local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.local
# Editar .env.local com os valores corretos (DATABASE_URL do Neon)

# 3. Criar tabelas na base de dados
npm run db:push

# 4. Criar utilizador admin
npm run db:seed

# 5. Iniciar servidor de desenvolvimento
npm run dev

# 6. Aceder à aplicação
# http://localhost:8433
```

### Credenciais de Login (padrão):

- **Email:** `admin@prudencio.pt`
- **Password:** (definida em `ADMIN_PASSWORD` no `.env.local`)

---

## 🗃️ Gestão da Base de Dados

```bash
# Gerar ficheiros de migração a partir do schema
npm run db:generate

# Aplicar migrações ao Neon
npm run db:migrate

# Push direto do schema (dev rápido, sem ficheiros de migração)
npm run db:push

# Abrir Drizzle Studio (UI para explorar a DB)
npm run db:studio

# Criar/atualizar utilizador admin
npm run db:seed
```

---

## 🚀 Deploy na Vercel

1. Push para o GitHub
2. Criar projeto na Vercel e importar o repositório
3. Configurar variáveis de ambiente na Vercel:
   - `DATABASE_URL` — URL de conexão Neon (pooled)
   - `JWT_SECRET` — Chave secreta JWT
   - `ADMIN_EMAIL` — Email do admin
   - `ADMIN_PASSWORD` — Password do admin
   - `ADMIN_NAME` — Nome do admin (opcional)
4. Deploy automático

### Integração Neon + Vercel

Alternativamente, podes usar a [integração oficial Neon + Vercel](https://vercel.com/integrations/neon):
1. Vai a Vercel → Integrations → Neon
2. Conecta a tua conta Neon
3. A `DATABASE_URL` é configurada automaticamente

---

## 📱 PWA

A aplicação é uma Progressive Web App instalável:

- **Manifest** configurado com ícones e shortcuts
- **Service Worker** com estratégia network-first e cache fallback
- **Modo standalone** para experiência nativa
- **Suporte offline** para conteúdo em cache

---

## 🛠️ Stack Tecnológica

| Camada        | Tecnologia                                                |
| ------------- | --------------------------------------------------------- |
| Frontend      | React 19 + TanStack Router + shadcn/ui + Tailwind CSS 4  |
| Backend       | TanStack Start (SSR) + Nitro                              |
| Base de Dados | Neon PostgreSQL + Drizzle ORM                             |
| Autenticação  | JWT customizado + bcryptjs                                |
| Build         | Vite 7                                                    |
| Deploy        | Vercel (serverless)                                       |
