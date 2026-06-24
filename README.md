# Prudêncio — Sistema de Gestão de Guias de Transporte (PWA)

Este repositório contém a aplicação **Prudêncio**, um sistema PWA completo para gestão de guias de transporte e obras, com suporte a upload de PDFs, extração OCR/QR Code, exportação para Excel e controlo de checklists.

---

## 🚀 Preparado para Produção na Vercel

O projeto foi auditado e configurado com práticas recomendadas de segurança e DevOps, estando pronto para deploy na **Vercel** conectado a uma base de dados **PostgreSQL** (como Supabase, Neon ou AWS RDS).

### Características da Configuração de Produção:
1. **Segurança de Segredos**: O ficheiro `.env` local e a base de dados SQLite estão excluídos do Git.
2. **JWT Seguro**: Em ambiente de produção, a aplicação exige obrigatoriamente a configuração da variável `JWT_SECRET`, falhando de forma explícita caso não esteja definida.
3. **PostgreSQL com SSL**: Suporte nativo para ligações seguras PostgreSQL em ambiente serverless.
4. **Auto-seeding de Admin**: Ao iniciar a aplicação com uma base de dados vazia, a aplicação cria automaticamente o utilizador administrador inicial.
5. **Zero-Config na Vercel**: Configuração automática do build target do Vinxi para Vercel quando detetado o ambiente da cloud.

---

## 📋 Variáveis de Ambiente Necessárias na Vercel

Ao configurar o projeto na Vercel, adicione as seguintes variáveis de ambiente (**Environment Variables**):

| Variável | Descrição | Exemplo / Padrão | Obrigatório? |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | URL de ligação ao PostgreSQL (com SSL ativado) | `postgres://user:pass@host:5432/db` | **Sim** |
| `JWT_SECRET` | Chave secreta longa e aleatória para assinar tokens | *Gerar uma string aleatória* | **Sim** (em Prod) |
| `DB_CLIENT` | Driver da base de dados para o Knex | `pg` | Não (padrão se `DATABASE_URL` existir) |
| `ADMIN_EMAIL` | E-mail do administrador inicial criado no arranque | `admin@prudencio.pt` | Não |
| `ADMIN_PASSWORD`| Palavra-passe do administrador inicial | `Rpavg5n` (mude para algo seguro!) | Não |
| `ADMIN_NAME` | Nome do utilizador administrador inicial | `Administrador` | Não |

---

## 🛠️ Passos de Deploy na Vercel

1. **Push para o GitHub**: Garanta que todas as alterações estão enviadas para o seu repositório Git.
2. **Criar Projeto na Vercel**:
   - Vá ao painel da Vercel e clique em **Add New > Project**.
   - Importe o repositório `mahdisharifi109/Prudencio`.
3. **Configurações do Projeto**:
   - **Framework Preset**: Deixe em **Other** ou **Vite** (será auto-detetado).
   - **Root Directory**: Se o seu projeto estiver dentro da subpasta `guideeasy-logistics-main`, configure a pasta raiz apontando para ela no assistente de importação da Vercel.
   - **Build Command**: Deixe o padrão (`npm run build`).
   - **Output Directory**: Deixe o padrão.
4. **Adicionar Variáveis de Ambiente**:
   - Insira as variáveis especificadas na secção acima (`DATABASE_URL`, `JWT_SECRET`, etc.).
5. **Deploy**:
   - Clique em **Deploy**. O Vercel e o Vinxi irão compilar a aplicação e expô-la em ambiente serverless automaticamente!

---

## 💻 Desenvolvimento Local (SQLite)

Para correr o projeto na sua máquina local com SQLite (padrão):

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie um ficheiro `.env` com base no `.env.example`:
   ```env
   DB_CLIENT=sqlite3
   DB_FILE=./guideeasy.sqlite
   JWT_SECRET=UMA_CHAVE_ALEATORIA_PARA_DESENVOLVIMENTO
   PORT=3000
   ```
3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
4. Aceda em `http://localhost:8433`. As credenciais padrão criadas na primeira inicialização são:
   - **E-mail:** `admin@prudencio.pt`
   - **Palavra-passe:** `Rpavg5n`
