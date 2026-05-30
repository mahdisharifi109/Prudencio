import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  getChecklistStore as getChecklist,
  updateChecklistStore as updateChecklist,
  deleteChecklistStore,
  type Checklist,
} from "@/lib/store";
import { exportChecklistToExcel } from "@/lib/excel-export";
import { shareViaWhatsApp } from "@/lib/whatsapp";
import { getSession } from "@/lib/session";
import { InstallAppButton } from "@/components/InstallAppButton";
import { toast } from "sonner";
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
  ArrowLeft, Send, MessageCircle, Loader2, Download, CheckCircle2,
  Package, Save, Trash2, FolderOpen, Building2,
} from "lucide-react";

export const Route = createFileRoute("/checklist/$id")({
  component: GuiaPage,
  head: () => ({ meta: [{ title: "Guia de Transporte — Prudêncio" }] }),
});

function GuiaPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [c, setC] = useState<Checklist | null>(null);
  const [resp, setResp] = useState("");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    getChecklist(id).then((data) => {
      if (!data) {
        toast.error("Guia não encontrada");
        navigate({ to: "/dashboard" });
        return;
      }
      setC(data);
      const s = getSession();
      if (s) setResp(s.name);
    }).finally(() => setLoading(false));
  }, [id, navigate]);

  function toggle(i: number) {
    if (!c) return;
    setC({
      ...c,
      items: c.items.map((it, idx) => idx === i ? { ...it, checked: !it.checked } : it),
    });
  }

  async function submit() {
    if (!c) return;
    if (!resp.trim()) { toast.error("Indique o responsável"); return; }
    setBusy(true);
    try {
      await updateChecklist(id, {
        items: c.items,
        responsavel: resp.trim(),
        observacoes_colaborador: obs,
        status: "concluida",
        submitted_at: Date.now(),
      });
      toast.success("Guia validada com sucesso");
      navigate({ to: "/completed/$id", params: { id } });
    } catch (e: unknown) {
      toast.error("Erro: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteChecklistStore(c!.id);
      toast.success("Guia apagada");
      navigate({ to: "/dashboard" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  if (loading || !c) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  const done = c.items.filter((i) => i.checked).length;
  const pct = c.items.length ? Math.round((done / c.items.length) * 100) : 0;
  const totalQty = c.items
    .reduce((s, i) => s + parseFloat(i.quantidade.replace(",", ".") || "0"), 0)
    .toFixed(2);
  const isTransporte = c.tipo_guia !== "devolucao";

  return (
    <main className="min-h-[100dvh] bg-background pb-44">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary via-primary to-[oklch(0.22_0.07_255)] text-primary-foreground px-5 pt-6 pb-7 rounded-b-3xl shadow-lg">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100 transition">
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
              isTransporte ? "bg-blue-400/30 text-blue-100" : "bg-orange-400/30 text-orange-100"
            }`}>
              {isTransporte ? "Transporte" : "Devolução"}
            </span>
          </div>
          <h1 className="text-xl font-bold">Guia de {isTransporte ? "Transporte" : "Devolução"}</h1>
          <p className="text-sm opacity-80 font-mono">{c.numero_guia || c.codigo_at}</p>
          {c.obra_nome && (
            <p className="text-xs opacity-60 flex items-center gap-1 mt-1">
              <Building2 className="size-3" /> {c.obra_nome}
            </p>
          )}
        </div>

        {/* Barra de progresso */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span>Progresso: <span className="font-bold">{done}/{c.items.length}</span></span>
            <span className="font-bold">{pct}%</span>
          </div>
          <div className="h-2 bg-primary-foreground/15 rounded-full overflow-hidden">
            <div
              className="h-full progress-bar rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </header>

      {/* Resumo */}
      <section className="px-5 mt-4">
        <div className="bg-card rounded-xl border p-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Chave AT: <span className="font-mono font-semibold text-foreground">{c.codigo_at || "—"}</span>
          </span>
          <span className="text-muted-foreground">
            Total: <span className="font-bold text-foreground">{totalQty}</span>
          </span>
        </div>
      </section>

      {c.observacoes_renato && (
        <section className="px-5 mt-3">
          <div className="bg-secondary/10 border-l-4 border-secondary rounded-lg p-4">
            <p className="text-xs uppercase tracking-wider font-semibold text-secondary mb-1">Observações</p>
            <p className="text-sm whitespace-pre-wrap">{c.observacoes_renato}</p>
          </div>
        </section>
      )}

      {/* Lista de artigos */}
      <section className="px-5 mt-4 space-y-2">
        {c.items.map((it, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all active:scale-[0.99] ${
              it.checked
                ? "border-secondary bg-secondary/8 shadow-sm"
                : "border-border bg-card hover:border-muted-foreground/20"
            }`}
          >
            <div
              className={`size-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                it.checked ? "bg-secondary border-secondary text-secondary-foreground" : "border-input"
              }`}
            >
              {it.checked && <CheckCircle2 className="size-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium leading-tight">{it.descricao}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
                <Package className="size-3" /> {it.artigo}
              </p>
            </div>
            <span className="text-base font-bold tabular-nums shrink-0">
              {it.quantidade} <span className="text-xs text-muted-foreground">{it.unidade}</span>
            </span>
          </button>
        ))}
      </section>

      {/* Responsável + Observações */}
      <section className="px-5 mt-6 space-y-3">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Responsável</label>
          <input
            value={resp}
            onChange={(e) => setResp(e.target.value)}
            className="mt-1 h-12 w-full rounded-lg border border-input bg-card px-3 focus:ring-2 focus:ring-ring outline-none transition"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Observações</label>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-input bg-card p-3 resize-none focus:ring-2 focus:ring-ring outline-none transition"
          />
        </div>
      </section>

      {/* Acções */}
      <div className="mt-8 mb-6 px-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={submit}
            disabled={busy}
            className="h-14 rounded-xl bg-secondary text-secondary-foreground font-bold flex items-center justify-center gap-2 text-sm shadow-lg transition hover:bg-secondary/90 active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
            Guardar
          </button>

          <button
            onClick={() => { exportChecklistToExcel(c); toast.success("Excel exportado"); }}
            className="h-14 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2 text-sm shadow-lg transition hover:bg-blue-500 active:scale-[0.98]"
          >
            <Download className="size-5" /> Excel
          </button>

          <button
            onClick={() => shareViaWhatsApp(c, `${window.location.origin}/checklist/${id}`)}
            className="h-14 rounded-xl bg-[#25D366] text-white font-bold flex items-center justify-center gap-2 text-sm shadow-lg transition hover:bg-[#20b858] active:scale-[0.98]"
          >
            <MessageCircle className="size-5" /> WhatsApp
          </button>

          <Link
            to="/dashboard"
            className="h-14 rounded-xl border-2 border-muted bg-card text-foreground font-bold flex items-center justify-center gap-2 text-sm shadow-sm transition hover:bg-muted/50 active:scale-[0.98]"
          >
            <FolderOpen className="size-5" /> Histórico
          </Link>
        </div>

        <button
          onClick={() => setConfirmDelete(true)}
          disabled={busy}
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
              Tem a certeza que deseja apagar esta guia? Esta ação é irreversível — o documento e os dados extraídos serão eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="rounded-xl bg-red-600 hover:bg-red-500 text-white"
            >
              {busy ? <Loader2 className="size-4 animate-spin mr-2" /> : <Trash2 className="size-4 mr-2" />}
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
