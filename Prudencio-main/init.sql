-- ═══════════════════════════════════════════════════════════════════
-- GuidEasy Logistics — Schema PostgreSQL (On-Premises)
-- Execute este ficheiro na primeira instalação.
-- ═══════════════════════════════════════════════════════════════════

-- Extensão para UUIDs (PostgreSQL 13+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Utilizadores (autenticação local) ──────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'operator'
                            CHECK (role IN ('admin', 'operator')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Obras (projectos / estaleiros) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS obras (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT        NOT NULL,
  descricao     TEXT,
  status        TEXT        NOT NULL DEFAULT 'ativa'
                            CHECK (status IN ('ativa', 'terminada')),
  created_by    TEXT,
  terminated_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Checklists (guias de transporte) ───────────────────────────────

CREATE TABLE IF NOT EXISTS checklists (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_at                TEXT,
  numero_guia              TEXT,
  data_documento           DATE,
  data_carga               DATE,
  hora_carga               TEXT,
  observacoes_renato       TEXT,
  status                   TEXT        NOT NULL DEFAULT 'pendente'
                                       CHECK (status IN ('pendente', 'concluida')),
  created_by               TEXT,
  responsavel              TEXT,
  observacoes_colaborador  TEXT,
  submitted_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  obra_id                  UUID        REFERENCES obras(id) ON DELETE SET NULL,
  tipo_guia                TEXT        DEFAULT 'transporte'
                                       CHECK (tipo_guia IN ('transporte', 'devolucao')),
  pdf_name                 TEXT,
  pdf_metadata             JSONB
);

-- ─── Itens de checklist ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS checklist_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id  UUID        NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  artigo        TEXT,
  descricao     TEXT,
  quantidade    TEXT,
  unidade       TEXT,
  checked       BOOLEAN     NOT NULL DEFAULT false,
  position      INTEGER     NOT NULL DEFAULT 0
);

-- ─── Registo de utilizadores da app ─────────────────────────────────

CREATE TABLE IF NOT EXISTS app_users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  phone      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Índices ────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklists_obra_id           ON checklists(obra_id);
CREATE INDEX IF NOT EXISTS idx_checklists_status            ON checklists(status);
CREATE INDEX IF NOT EXISTS idx_users_email                  ON users(email);

-- ═══════════════════════════════════════════════════════════════════
-- NOTA: Para criar o utilizador admin inicial, execute o script:
--   node scripts/create-user.mjs
--
-- Exemplo:
--   node scripts/create-user.mjs --email admin@empresa.pt --name Admin --role admin --password SuaPasswordSegura
-- ═══════════════════════════════════════════════════════════════════
