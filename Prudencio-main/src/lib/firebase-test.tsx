/**
 * ═══════════════════════════════════════════════════════════════
 * FirebaseConnectionTest — Componente de Diagnóstico
 *
 * Usa este componente temporariamente para validar que o Firebase
 * está configurado e a comunicar corretamente.
 *
 * Uso:
 *   import { FirebaseConnectionTest } from "~/lib/firebase-test";
 *   // ... dentro de qualquer página:
 *   <FirebaseConnectionTest />
 *
 * Remove depois de confirmar que tudo funciona ✅
 * ═══════════════════════════════════════════════════════════════
 */

import { useState, useCallback } from "react";
import { app, auth, firestore, db, storage } from "./firebase";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import {
  ref as dbRef,
  set as dbSet,
  get as dbGet,
  remove as dbRemove,
} from "firebase/database";

type TestStatus = "idle" | "running" | "pass" | "fail";

interface TestResult {
  name: string;
  status: TestStatus;
  message: string;
  durationMs?: number;
}

export function FirebaseConnectionTest() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateResult = useCallback(
    (index: number, update: Partial<TestResult>) => {
      setResults((prev) =>
        prev.map((r, i) => (i === index ? { ...r, ...update } : r))
      );
    },
    []
  );

  const runTests = useCallback(async () => {
    setIsRunning(true);

    const tests: TestResult[] = [
      { name: "🔧 Firebase App Init", status: "running", message: "A verificar..." },
      { name: "🔐 Auth Instance", status: "running", message: "A verificar..." },
      { name: "📄 Firestore R/W", status: "running", message: "A verificar..." },
      { name: "🗄️ Realtime DB R/W", status: "running", message: "A verificar..." },
      { name: "📦 Storage Instance", status: "running", message: "A verificar..." },
    ];
    setResults([...tests]);

    // 1. Firebase App
    const t0 = performance.now();
    try {
      const name = app.name;
      const projectId = app.options.projectId;
      updateResult(0, {
        status: "pass",
        message: `App "${name}" conectada ao projeto "${projectId}"`,
        durationMs: Math.round(performance.now() - t0),
      });
    } catch (err: any) {
      updateResult(0, {
        status: "fail",
        message: err.message,
        durationMs: Math.round(performance.now() - t0),
      });
    }

    // 2. Auth
    const t1 = performance.now();
    try {
      const config = auth.config;
      updateResult(1, {
        status: "pass",
        message: `Auth pronto — authDomain: ${config.authDomain || "default"}`,
        durationMs: Math.round(performance.now() - t1),
      });
    } catch (err: any) {
      updateResult(1, {
        status: "fail",
        message: err.message,
        durationMs: Math.round(performance.now() - t1),
      });
    }

    // 3. Firestore — escrever e ler um doc de teste
    const t2 = performance.now();
    try {
      const testDocRef = doc(firestore, "_connection_test", "ping");
      const testData = { ok: true, timestamp: Date.now() };
      await setDoc(testDocRef, testData);
      const snap = await getDoc(testDocRef);
      if (snap.exists() && snap.data()?.ok === true) {
        await deleteDoc(testDocRef); // limpar
        updateResult(2, {
          status: "pass",
          message: "Firestore: escrita + leitura + delete OK ✅",
          durationMs: Math.round(performance.now() - t2),
        });
      } else {
        updateResult(2, {
          status: "fail",
          message: "Firestore: doc escrito mas leitura não correspondeu",
          durationMs: Math.round(performance.now() - t2),
        });
      }
    } catch (err: any) {
      updateResult(2, {
        status: "fail",
        message: `Firestore: ${err.code || ""} ${err.message}`,
        durationMs: Math.round(performance.now() - t2),
      });
    }

    // 4. Realtime DB — escrever e ler
    const t3 = performance.now();
    try {
      const testRef = dbRef(db, "_connection_test/ping");
      await dbSet(testRef, { ok: true, timestamp: Date.now() });
      const snap = await dbGet(testRef);
      if (snap.exists() && snap.val()?.ok === true) {
        await dbRemove(testRef); // limpar
        updateResult(3, {
          status: "pass",
          message: "Realtime DB: escrita + leitura + delete OK ✅",
          durationMs: Math.round(performance.now() - t3),
        });
      } else {
        updateResult(3, {
          status: "fail",
          message: "Realtime DB: doc escrito mas leitura não correspondeu",
          durationMs: Math.round(performance.now() - t3),
        });
      }
    } catch (err: any) {
      updateResult(3, {
        status: "fail",
        message: `Realtime DB: ${err.code || ""} ${err.message}`,
        durationMs: Math.round(performance.now() - t3),
      });
    }

    // 5. Storage — verificar instância (sem upload real)
    const t4 = performance.now();
    try {
      const testStorageRef = storageRef(storage, "_connection_test/test.txt");
      // Apenas verificar que a referência foi criada (não faz upload)
      if (testStorageRef.fullPath === "_connection_test/test.txt") {
        updateResult(4, {
          status: "pass",
          message: `Storage bucket: ${storage.app.options.storageBucket || "default"}`,
          durationMs: Math.round(performance.now() - t4),
        });
      }
    } catch (err: any) {
      updateResult(4, {
        status: "fail",
        message: `Storage: ${err.message}`,
        durationMs: Math.round(performance.now() - t4),
      });
    }

    setIsRunning(false);
  }, [updateResult]);

  const statusIcon = (s: TestStatus) =>
    s === "pass" ? "✅" : s === "fail" ? "❌" : s === "running" ? "⏳" : "⬜";

  const allPassed =
    results.length > 0 && results.every((r) => r.status === "pass");
  const hasFailed = results.some((r) => r.status === "fail");

  return (
    <div
      style={{
        maxWidth: 600,
        margin: "2rem auto",
        padding: "1.5rem",
        fontFamily: "system-ui, sans-serif",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#fafbfc",
      }}
    >
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem" }}>
        🔥 Firebase Connection Test
      </h2>
      <p style={{ margin: "0 0 1rem", color: "#64748b", fontSize: "0.875rem" }}>
        Projeto: <strong>prudencio-main</strong> (
        {app.options.projectId || "não configurado"})
      </p>

      <button
        onClick={runTests}
        disabled={isRunning}
        style={{
          padding: "0.5rem 1.25rem",
          fontSize: "0.9rem",
          fontWeight: 600,
          border: "none",
          borderRadius: 8,
          cursor: isRunning ? "wait" : "pointer",
          background: isRunning ? "#94a3b8" : "#3b82f6",
          color: "#fff",
          marginBottom: "1rem",
        }}
      >
        {isRunning ? "A testar..." : "▶ Executar Testes"}
      </button>

      {results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {results.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "0.5rem 0.75rem",
                borderRadius: 8,
                background:
                  r.status === "pass"
                    ? "#f0fdf4"
                    : r.status === "fail"
                      ? "#fef2f2"
                      : "#f8fafc",
                border: `1px solid ${
                  r.status === "pass"
                    ? "#bbf7d0"
                    : r.status === "fail"
                      ? "#fecaca"
                      : "#e2e8f0"
                }`,
              }}
            >
              <span style={{ flexShrink: 0 }}>{statusIcon(r.status)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                  {r.name}
                  {r.durationMs !== undefined && (
                    <span
                      style={{
                        fontWeight: 400,
                        color: "#94a3b8",
                        marginLeft: 8,
                        fontSize: "0.75rem",
                      }}
                    >
                      {r.durationMs}ms
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: r.status === "fail" ? "#dc2626" : "#475569",
                    wordBreak: "break-word",
                  }}
                >
                  {r.message}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {allPassed && (
        <div
          style={{
            marginTop: 12,
            padding: "0.75rem",
            background: "#dcfce7",
            borderRadius: 8,
            textAlign: "center",
            fontWeight: 600,
            color: "#166534",
          }}
        >
          🎉 Todos os testes passaram! Firebase configurado corretamente.
        </div>
      )}

      {hasFailed && (
        <div
          style={{
            marginTop: 12,
            padding: "0.75rem",
            background: "#fee2e2",
            borderRadius: 8,
            fontSize: "0.85rem",
            color: "#991b1b",
          }}
        >
          💡 <strong>Dicas:</strong> Verifica se colaste o <code>apiKey</code> e{" "}
          <code>appId</code> no ficheiro <code>.env</code>, e que os serviços
          (Firestore, RTDB) estão ativados na consola Firebase.
        </div>
      )}
    </div>
  );
}
