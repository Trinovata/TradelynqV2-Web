/**
 * Supabase schema types.
 *
 * ⚠️ PLACEHOLDER — regenerated from the live schema at playbook S048, and again in
 * the same commit as every migration thereafter (the seventh of the seven migration
 * laws, v2/17 §17.4).
 *
 * Regenerate with:
 *   npx supabase gen types typescript --local > types/database.ts
 *
 * Until Phase 1 lands the schema, this declares the shape without the tables, so the
 * client factories below are type-correct and the codebase compiles. Do not hand-edit
 * table definitions into this file — they come from the database, or they drift.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: Record<never, never>
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
