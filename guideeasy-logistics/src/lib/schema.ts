/**
 * ═══════════════════════════════════════════════════════════════
 * Drizzle ORM Schema — Neon PostgreSQL
 * Projeto: GuidEasy Logistics (Prudêncio)
 *
 * Define todas as tabelas da base de dados.
 * Espelha a estrutura que existia no Firebase Firestore.
 * ═══════════════════════════════════════════════════════════════
 */

import { pgTable, text, bigint, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { ChecklistItem, PdfMetadata } from "./types";

// ─── Users (credenciais com password_hash) ──────────────────────────
export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("operator"),
  created_at: bigint("created_at", { mode: "number" }).notNull(),
});

// ─── App Users (colaboradores que fazem login na app) ───────────────
export const appUsers = pgTable("app_users", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  created_at: bigint("created_at", { mode: "number" }).notNull(),
});

// ─── Obras ──────────────────────────────────────────────────────────
export const obras = pgTable("obras", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  status: text("status").notNull().default("ativa"),
  created_by: text("created_by"),
  terminated_at: bigint("terminated_at", { mode: "number" }),
  created_at: bigint("created_at", { mode: "number" }).notNull(),
});

// ─── Checklists (Guias de Transporte) ───────────────────────────────
export const checklists = pgTable("checklists", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  codigo_at: text("codigo_at").notNull(),
  observacoes_renato: text("observacoes_renato").notNull(),
  items: jsonb("items").$type<ChecklistItem[]>().notNull().default([]),
  status: text("status").notNull().default("pendente"),
  created_at: bigint("created_at", { mode: "number" }).notNull(),
  created_by: text("created_by"),
  responsavel: text("responsavel"),
  observacoes_colaborador: text("observacoes_colaborador"),
  submitted_at: bigint("submitted_at", { mode: "number" }),
  // Datas extraídas do PDF
  data_documento: text("data_documento"),
  data_carga: text("data_carga"),
  hora_carga: text("hora_carga"),
  numero_guia: text("numero_guia"),
  pdf_name: text("pdf_name"),
  pdf_metadata: jsonb("pdf_metadata").$type<PdfMetadata>(),
  // Associação a Obra
  obra_id: text("obra_id"),
  obra_nome: text("obra_nome"),
  // Tipo de documento
  tipo_guia: text("tipo_guia"),
});

// ─── Histórico de Atividades ────────────────────────────────────────
export const activityLog = pgTable("activity_log", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  action: text("action").notNull(),
  entity_type: text("entity_type").notNull(),
  entity_id: text("entity_id"),
  entity_name: text("entity_name"),
  user_email: text("user_email"),
  user_name: text("user_name"),
  details: text("details"),
  created_at: bigint("created_at", { mode: "number" }).notNull(),
});
