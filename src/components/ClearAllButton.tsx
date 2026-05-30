// ClearAllButton — botão de limpeza total com 3 camadas de segurança.
// Visível apenas para o utilizador "Renato" (chef).
import { useState } from "react";
import { clearAllData, type ClearResult } from "@/lib/clear-all";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Trash2,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Loader2,
} from "lucide-react";

const NOME_CHEF = "Renato";

type Props = {
  nomeUtilizador: string;
  onClearComplete?: () => void;
};

export function ClearAllButton({ nomeUtilizador, onClearComplete }: Props) {
  const [step, setStep] = useState<"idle" | "warn" | "confirm" | "clearing" | "done">("idle");
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<ClearResult | null>(null);

  // Só visível para o chef
  const isChef = nomeUtilizador.trim().toLowerCase() === NOME_CHEF.toLowerCase();
  if (!isChef) return null;

  function reset() {
    setStep("idle");
    setConfirmText("");
    setResult(null);
  }

  async function executeClear() {
    setStep("clearing");
    try {
      const res = await clearAllData();
      setResult(res);
      setStep("done");
    } catch (err) {
      console.error("[ClearAll] Erro:", err);
      setStep("idle");
    }
  }

  function handleDone() {
    reset();
    onClearComplete?.();
  }

  const canConfirm = confirmText.trim().toUpperCase() === "APAGAR";

  return (
    <>
      {/* Botão principal — só aparece quando idle */}
      {step === "idle" && (
        <button
          onClick={() => setStep("warn")}
          className="w-full h-12 rounded-2xl bg-red-50 border-2 border-red-200/60 text-red-600 font-semibold flex items-center justify-center gap-2 text-sm hover:bg-red-100 hover:border-red-300 transition-all active:scale-[0.98]"
        >
          <ShieldAlert className="size-4" />
          Limpar Tudo (Chef)
        </button>
      )}

      {/* Passo 1 — Aviso inicial */}
      <AlertDialog open={step === "warn"} onOpenChange={(open) => { if (!open) reset(); }}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-600" />
              Limpar Tudo
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                <p className="text-sm text-muted-foreground">Esta ação vai apagar permanentemente:</p>
                <ul className="text-sm text-red-700 space-y-1 bg-red-50 border border-red-200 rounded-xl p-3">
                  <li className="flex items-center gap-2"><Trash2 className="size-3.5 shrink-0" /> Todas as guias de transporte</li>
                  <li className="flex items-center gap-2"><Trash2 className="size-3.5 shrink-0" /> Todas as obras</li>
                  <li className="flex items-center gap-2"><Trash2 className="size-3.5 shrink-0" /> Todos os artigos</li>
                  <li className="flex items-center gap-2"><Trash2 className="size-3.5 shrink-0" /> Todos os dados no Firebase</li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  A base de dados ficará como no primeiro dia. Esta ação <strong>não pode ser revertida</strong>.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" onClick={reset}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 hover:bg-red-500 text-white"
              onClick={() => setStep("confirm")}
            >
              <AlertTriangle className="size-4 mr-2" />
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Passo 2 — Confirmação por texto */}
      <Dialog open={step === "confirm"} onOpenChange={(open) => { if (!open) setStep("warn"); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-red-600" />
              Confirmação Final
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-left">
                <p className="text-sm text-muted-foreground">
                  Para confirmar que pretende apagar <strong>todos os dados</strong>, escreva a palavra{" "}
                  <span className="font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                    APAGAR
                  </span>{" "}
                  no campo abaixo:
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Escreva APAGAR para confirmar"
                  autoFocus
                  className="w-full h-12 rounded-xl border-2 border-red-200 bg-red-50/50 px-4 text-center text-lg font-bold tracking-widest text-red-700 uppercase outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition placeholder:text-red-300 placeholder:normal-case placeholder:tracking-normal placeholder:font-normal placeholder:text-sm"
                />
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setStep("warn")}
              className="h-11 px-4 rounded-xl bg-muted font-semibold text-sm transition hover:bg-muted/80"
            >
              Voltar
            </button>
            <button
              onClick={executeClear}
              disabled={!canConfirm}
              className="h-11 px-4 rounded-xl bg-red-600 text-white font-semibold text-sm transition hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Trash2 className="size-4" /> Apagar Tudo
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Passo 3 — A apagar */}
      <Dialog open={step === "clearing"} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm rounded-2xl" onInteractOutside={(e) => e.preventDefault()}>
          <div className="flex flex-col items-center justify-center gap-4 py-4">
            <div className="size-14 rounded-2xl bg-red-100 flex items-center justify-center">
              <Loader2 className="size-7 text-red-600 animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-bold text-foreground">A apagar todos os dados...</p>
              <p className="text-xs text-muted-foreground mt-1">Supabase e Firebase — não feche a aplicação</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Passo 4 — Concluído */}
      <Dialog open={step === "done"} onOpenChange={(open) => { if (!open) handleDone(); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 justify-center">
              <CheckCircle2 className="size-5 text-green-600" />
              Dados Limpos
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-left">
                {result && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                    <p className="text-sm text-green-800 flex items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span><strong>{result.checklists}</strong> guias apagadas</span>
                    </p>
                    <p className="text-sm text-green-800 flex items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span><strong>{result.obras}</strong> obras apagadas</span>
                    </p>
                    <p className="text-sm text-green-800 flex items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span><strong>{result.items}</strong> artigos apagados</span>
                    </p>
                    <p className="text-sm text-green-800 flex items-center gap-2">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span>Firebase {result.firebaseCleaned ? "limpo" : "erro parcial"}</span>
                    </p>
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={handleDone}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="size-4" /> Voltar ao Dashboard
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
