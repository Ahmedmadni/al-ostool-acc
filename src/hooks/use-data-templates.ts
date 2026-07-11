import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TemplateField = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "boolean" | "select" | "currency";
  required?: boolean;
};

export type DataTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  table_key: string;
  fields: TemplateField[];
  mapping: Record<string, string>;
  version: number;
  history: { version: number; updated_at: string; fields: TemplateField[]; mapping: Record<string, string> }[];
  created_at: string;
  updated_at: string;
};

// Templates now live in Supabase (data_templates table) instead of localStorage,
// so a mapping saved by one user while importing is immediately reusable by
// anyone else importing the same table — this is the actual "link to all
// tables" requirement: filtering by table_key is what connects a template to
// every page that imports/exports that table.
export function useDataTemplates(tableKey?: string) {
  return useQuery({
    queryKey: ["data_templates", tableKey ?? "all"],
    queryFn: async () => {
      let q = (supabase as any).from("data_templates").select("*").order("updated_at", { ascending: false });
      if (tableKey) q = q.eq("table_key", tableKey);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DataTemplate[];
    },
  });
}

export function useSaveDataTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opts: {
      id?: string;
      name: string;
      description?: string;
      tableKey: string;
      category?: string;
      fields: TemplateField[];
      mapping?: Record<string, string>;
    }) => {
      if (opts.id) {
        const { data: existing, error: fetchErr } = await (supabase as any)
          .from("data_templates").select("*").eq("id", opts.id).single();
        if (fetchErr) throw fetchErr;
        const newHistory = [
          ...(existing.history ?? []),
          { version: existing.version, updated_at: existing.updated_at, fields: existing.fields, mapping: existing.mapping },
        ].slice(-10);
        const { error } = await (supabase as any).from("data_templates").update({
          name: opts.name,
          description: opts.description ?? existing.description,
          fields: opts.fields,
          mapping: opts.mapping ?? existing.mapping,
          version: existing.version + 1,
          history: newHistory,
        }).eq("id", opts.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("data_templates").insert({
          name: opts.name,
          description: opts.description ?? null,
          table_key: opts.tableKey,
          category: opts.category ?? "import",
          fields: opts.fields,
          mapping: opts.mapping ?? {},
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["data_templates"] }),
  });
}

export function useDeleteDataTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("data_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["data_templates"] }),
  });
}
