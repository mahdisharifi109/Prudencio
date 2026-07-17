import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";
import { resolve } from "path";
import { fileURLToPath } from "url";
import type { Plugin } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

if (process.env.VERCEL) {
  process.env.SERVER_PRESET = "vercel";
}

// Knex dynamically imports ALL database drivers (sqlite3, mysql2, etc.)
// even if only 'pg' is used. On Vercel, the unused drivers don't exist,
// causing ERR_MODULE_NOT_FOUND at runtime.
const unusedDrivers = [
  "sqlite3",
  "better-sqlite3",
  "mysql",
  "mysql2",
  "mariadb",
  "tedious",
  "oracledb",
  "pg-native",
  "pg-query-stream",
  "oracle",
  "strong-oracle",
  "mssql",
  "sql.js",
];

const noopPath = resolve(__dirname, "src/lib/_noop.js");

// Custom Rollup plugin that intercepts ALL resolution attempts for unused drivers.
// Unlike resolve.alias (which does string replacement and breaks subpaths like
// mysql2/callback → _noop.js/callback), this plugin properly resolves both
// exact imports AND subpath imports to the noop module.
function mockUnusedDriversPlugin(): Plugin {
  return {
    name: "mock-unused-knex-drivers",
    enforce: "pre",
    resolveId(id: string) {
      for (const driver of unusedDrivers) {
        if (id === driver || id.startsWith(driver + "/")) {
          return noopPath;
        }
      }
      return null;
    },
  };
}

// TanStack Start entry — points to our SSR error wrapper.
export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      port: 8433,
      strictPort: false,
      open: true,
    },
    plugins: [
      mockUnusedDriversPlugin(),
      nitro({
        preset: "vercel",
        rollupConfig: {
          plugins: [
            {
              name: "mock-unused-knex-drivers-nitro",
              resolveId(id: string) {
                for (const driver of unusedDrivers) {
                  if (id === driver || id.startsWith(driver + "/")) {
                    return { id: noopPath, external: false };
                  }
                }
                return null;
              },
            },
          ],
        },
      }),
    ],
  },
});
