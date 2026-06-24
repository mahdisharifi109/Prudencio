import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getChecklistStore as getChecklist,
  deleteChecklistStore,
  type Checklist,
} from "@/lib/store";
import { exportChecklistToExcel } from "@/lib/excel-export";
import { shareViaWhatsApp } from "@/lib/whatsapp";
import { InstallAppButton } from "@/components/InstallAppButton";
import { useAuth } from "@/lib/session";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  MessageCircle,
  FileSpreadsheet,
  Calendar,
  User,
  Hash,
  FileText,
  Package,
  BarChart3,
  Trash2,
  FolderOpen,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { formatarDataParaPT } from "@/lib/utils";

export const Route = createFileRoute("/completed/$id")({
  component: CompletedPage,
  head: () => ({ meta: [{ title: "Guia Validada — Prudêncio" }] }),
});

function CompletedPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [c, setC] = useState<Checklist | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate({ to: "/" });
      return;
    }
    getChecklist(id).then((data) => {
      if (!data) {
        toast.error("Guia não encontrada");
        navigate({ to: "/dashboard" });
        return;
      }
      setC(data);
    });
  }, [id, user, navigate]);

  if (!user) return null;

  if (!c) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  const totalQty = c.items
    .reduce((s, i) => s + parseFloat(i.quantidade.replace(",", ".") || "0"), 0)
    .toFixed(2);
  const confirmed = c.items.filter((i) => i.checked).length;
  const isTransporte = c.tipo_guia !== "devolucao";

  function exportCSV() {
    if (!c) return;
    const h = ["Data", "Artigo", "Chave AT", "Descricao", "Quantidade", "Unidade", "Confirmado"];
    const rows = c.items.map((i) =>
      [
        c.data_documento || "",
        i.artigo,
        c.codigo_at || "",
        `"${i.descricao}"`,
        i.quantidade,
        i.unidade,
        i.checked ? "Sim" : "Nao",
      ].join(";"),
    );
    const csv = [h.join(";"), ...rows].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `guia_${c.codigo_at || c.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteChecklistStore(c!.id);
      toast.success("Guia apagada");
      navigate({ to: "/dashboard" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-background pb-32">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary via-primary to-[oklch(0.22_0.07_255)] text-primary-foreground px-5 pt-6 pb-8 rounded-b-3xl shadow-lg">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100 transition"
        >
          <ArrowLeft className="size-4" /> Dashboard
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <div className="size-12 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shadow-lg animate-scale-in">
            <CheckCircle2 className="size-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                  isTransporte ? "bg-blue-400/30 text-blue-100" : "bg-orange-400/30 text-orange-100"
                }`}
              >
                {isTransporte ? "Transporte" : "Devolução"}
              </span>
            </div>
            <h1 className="text-xl font-bold">Guia Validada</h1>
            <p className="text-sm opacity-80 font-mono">{c.numero_guia || c.codigo_at}</p>
          </div>
        </div>
        {c.obra_nome && (
          <p className="text-xs opacity-60 flex items-center gap-1 mt-2">
            <Building2 className="size-3" /> {c.obra_nome}
          </p>
        )}
      </header>

      <section className="px-5 mt-5 space-y-4">
        {/* Resumo */}
        <div className="bg-card rounded-2xl border p-4 grid grid-cols-2 gap-3 text-sm animate-fade-in-up">
          <Field
            icon={<User className="size-4" />}
            label="Responsável"
            value={c.responsavel || "—"}
          />
          <Field
            icon={<Calendar className="size-4" />}
            label="Validada em"
            value={c.submitted_at ? new Date(c.submitted_at).toLocaleString("pt-PT") : "—"}
          />
          <Field icon={<Hash className="size-4" />} label="Chave AT" value={c.codigo_at || "—"} />
          <Field
            icon={<FileText className="size-4" />}
            label="N. Guia"
            value={c.numero_guia || "—"}
          />
          <Field
            icon={<CheckCircle2 className="size-4" />}
            label="Confirmados"
            value={`${confirmed}/${c.items.length}`}
          />
          <Field icon={<BarChart3 className="size-4" />} label="Qtd. Total" value={totalQty} />
          <Field
            icon={<Calendar className="size-4" />}
            label="Data Doc."
            value={formatarDataParaPT(c.data_documento)}
          />
          <Field
            icon={<Calendar className="size-4" />}
            label="Criada em"
            value={new Date(c.created_at).toLocaleDateString("pt-PT")}
          />
        </div>

        {c.observacoes_renato && <Block title="Observações" body={c.observacoes_renato} accent />}
        {c.observacoes_colaborador && (
          <Block title="Observações do Colaborador" body={c.observacoes_colaborador} />
        )}

        {/* Artigos */}
        <div className="bg-card rounded-2xl border overflow-hidden">
          <div className="px-4 py-3 bg-muted border-b flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider font-semibold flex items-center gap-2">
              <span className="size-6 bg-primary text-primary-foreground rounded-md flex items-center justify-center text-xs font-bold">
                {c.items.length}
              </span>
              Artigos
            </p>
            <p className="text-xs text-muted-foreground font-semibold">Total: {totalQty}</p>
          </div>
          <ul className="divide-y">
            {c.items.map((it, i) => (
              <li key={i} className="p-3 flex items-center gap-3">
                <span
                  className={`size-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    it.checked ? "bg-secondary text-secondary-foreground" : "bg-muted border"
                  }`}
                >
                  {it.checked && <CheckCircle2 className="size-3.5" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-tight">{it.descricao}</p>
                  <p className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                    <Package className="size-3" /> {it.artigo}
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums whitespace-nowrap">
                  {it.quantidade}{" "}
                  <span className="text-xs text-muted-foreground">{it.unidade}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Acções */}
      <div className="mt-8 mb-6 px-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              exportChecklistToExcel(c);
              toast.success("Excel exportado");
            }}
            className="h-14 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2 text-sm shadow-lg transition hover:bg-blue-500 active:scale-[0.98]"
          >
            <Download className="size-5" /> Excel
          </button>

          <button
            onClick={() => shareViaWhatsApp(c, `${window.location.origin}/completed/${id}`)}
            className="h-14 rounded-xl bg-[#25D366] text-white font-bold flex items-center justify-center gap-2 text-sm shadow-lg transition hover:bg-[#20b858] active:scale-[0.98]"
          >
            <MessageCircle className="size-5" /> WhatsApp
          </button>

          <button
            onClick={exportCSV}
            className="h-14 rounded-xl border-2 border-primary text-primary font-bold flex items-center justify-center gap-2 text-sm transition hover:bg-primary/10 active:scale-[0.98]"
          >
            <FileSpreadsheet className="size-5" /> CSV
          </button>

          <Link
            to="/dashboard"
            className="h-14 rounded-xl border-2 border-muted bg-card text-foreground font-bold flex items-center justify-center gap-2 text-sm transition hover:bg-muted/50 active:scale-[0.98]"
          >
            <FolderOpen className="size-5" /> Histórico
          </Link>
        </div>

        <button
          onClick={() => setConfirmDelete(true)}
          className="w-full h-12 rounded-xl bg-red-50 text-red-600 font-bold flex items-center justify-center gap-2 text-sm transition hover:bg-red-100 active:scale-[0.98]"
        >
          <Trash2 className="size-4" /> Apagar Guia
        </button>

        <div className="pt-4 border-t">
          <InstallAppButton variant="full" />
        </div>
      </div>

      {/* AlertDialog — Confirmar apagar */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-5 text-red-500" />
              Apagar Guia
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja apagar esta guia validada? Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl bg-red-600 hover:bg-red-500 text-white"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="size-4 mr-2" />
              )}
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

function Block({ title, body, accent }: { title: string; body: string; accent?: boolean }) {
  return (
    <div
      className={`bg-card rounded-2xl border p-4 ${accent ? "border-l-4 border-l-secondary" : ""}`}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{title}</p>
      <p className="text-sm whitespace-pre-wrap">{body}</p>
    </div>
  );
}
