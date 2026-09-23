# Prudêncio — Sistema de Gestão de Guias de Transporte (PWA)

Este repositório contém a aplicação **Prudêncio**, um sistema PWA completo para gestão de guias de transporte e obras, com suporte a upload de PDFs, extração OCR/QR Code, exportação para Excel e controlo de checklists.

---

## 🚀 Preparado para Produção com Firebase Firestore e Vercel

O projeto foi totalmente migrado para utilizar o **Firebase Firestore** como camada de persistência definitiva. Toda a dependência legada de SQLite (Knex, better-sqlite3, pg, etc.) foi removida do runtime do servidor para garantir builds rápidos, leves e sem erros de dependência binária na **Vercel**.

### Características da Configuração de Produção:
1. **Segurança de Segredos**: Credenciais do Firebase Admin SDK são mantidas estritamente no lado do servidor.
2. **Prevenção de Dupla Inicialização**: O inicializador do Firebase Admin SDK previne a recriação do app em ambientes serverless (Vercel/Nitro).
3. **Auto-seeding de Admin**: Se o Firestore estiver vazio no primeiro arranque, o sistema cria automaticamente o utilizador administrador padrão.
4. **Zero-Config na Vercel**: Configuração automática da build target do Vinxi para Vercel.
5. **Script de Migração**: Utilitário offline incluído para importar os dados do antigo ficheiro SQLite local para o Firestore.

---

## 📋 Variáveis de Ambiente Necessárias

Para colocar a aplicação em produção ou correr localmente com Firestore, configure as seguintes variáveis de ambiente no ficheiro `.env` ou no painel da Vercel:

### 1. Segurança e Autenticação
* `JWT_SECRET`: Chave secreta de segurança usada para assinar os tokens JWT da sessão (obrigatório em produção).

### 2. Credenciais do Firebase Admin SDK (Apenas Servidor/Privado)
Pode configurar as credenciais do Firebase de duas formas:

**Opção A: String JSON Única (Recomendado para Vercel)**
* `FIREBASE_SERVICE_ACCOUNT`: Conteúdo completo do ficheiro JSON da sua conta de serviço do Firebase (ex: `{"type": "service_account", "project_id": "...", ...}`).

**Opção B: Variáveis Individuais**
* `FIREBASE_PROJECT_ID` ou `VITE_FIREBASE_PROJECT_ID`: O ID do projeto Firebase.
* `FIREBASE_CLIENT_EMAIL`: O email do cliente da conta de serviço.
* `FIREBASE_PRIVATE_KEY`: A chave privada da conta de serviço (com as quebras de linha formatadas como `\n`).

### 3. Definições do Administrador Inicial (Seeding)
* `ADMIN_EMAIL`: E-mail do utilizador administrador inicial (padrão: `admin@prudencio.pt`).
* `ADMIN_PASSWORD`: Palavra-passe do administrador inicial (padrão: `Rpavg5n`).
* `ADMIN_NAME`: Nome do administrador inicial (padrão: `Administrador`).

---

## 🛠️ Passos de Deploy na Vercel

1. **Push para o GitHub**: Certifique-se de que todas as alterações estão enviadas para o seu repositório Git.
2. **Criar Projeto na Vercel**:
   - No painel da Vercel, clique em **Add New > Project**.
   - Importe o seu repositório do projeto.
3. **Configurações do Projeto**:
   - **Framework Preset**: Deixe em **Other** ou **Vite** (será auto-detetado).
   - **Root Directory**: Se o seu projeto estiver dentro da subpasta `guideeasy-logistics-main`, selecione-a como diretório raiz no assistente.
   - **Build Command**: `npm run build`.
   - **Output Directory**: Padrão.
4. **Adicionar Variáveis de Ambiente**:
   - Insira as variáveis descritas acima (`FIREBASE_SERVICE_ACCOUNT` ou chaves individuais, `JWT_SECRET`, etc.).
5. **Deploy**:
   - Clique em **Deploy**. A aplicação compilará em 20 segundos e estará funcional e segura.

---

## 💻 Desenvolvimento Local e Testes

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie ou edite o ficheiro `.env` com as variáveis de ambiente necessárias (como a sua chave do Firebase).
3. Inicie o servidor de desenvolvimento local:
   ```bash
   npm run dev
   ```
4. Aceda em `http://localhost:8433`. As credenciais padrão do utilizador seeded são:
   - **E-mail:** `admin@prudencio.pt`
   - **Palavra-passe:** `Rpavg5n`

---

## 📦 Migração de Dados (SQLite -> Firestore)

Se tem dados reais na base de dados SQLite local (`guideeasy.sqlite`) que deseja enviar para o Firestore:

1. Garanta que o ficheiro `guideeasy.sqlite` se encontra na raiz do projeto.
2. Certifique-se de que o ficheiro `.env` contém as credenciais do Firebase Firestore com permissões de escrita.
3. Execute o comando de migração:
   ```bash
   npm run migrate:firestore
   ```
4. O script lerá automaticamente as tabelas `users`, `obras`, `checklists`, `checklist_items` e `app_users`, formatará e agrupará os dados (aninhando itens de checklist dentro dos seus documentos pai), e carregará tudo para o Firestore.
