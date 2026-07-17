import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

if (process.env.VERCEL) {
  process.env.SERVER_PRESET = "vercel";
}

// Knex dynamically imports ALL database drivers (sqlite3, mysql2, etc.)
// even if only 'pg' is used. On Vercel, the unused drivers don't exist,
// causing ERR_MODULE_NOT_FOUND at runtime. We alias them to an empty
// module so the bundler replaces them with a harmless no-op.
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

const driverAliases: Record<string, string> = {};
for (const driver of unusedDrivers) {
  driverAliases[driver] = noopPath;
}

// Custom Rollup plugin that intercepts ALL resolution attempts for unused drivers
// This handles exact imports AND subpath imports like 'mysql2/callback' or 'sqlite3/lib/trace'
function mockUnusedDriversPlugin() {
  return {
    name: "mock-unused-knex-drivers",
    resolveId(id: string) {
      for (const driver of unusedDrivers) {
        if (id === driver || id.startsWith(driver + "/")) {
          return { id: noopPath, external: false };
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
    resolve: {
      alias: driverAliases,
    },
    server: {
      port: 8433,
      strictPort: false,
      open: true,
    },
    plugins: [
      nitro({
        preset: "vercel",
        alias: driverAliases,
        rollupConfig: {
          plugins: [mockUnusedDriversPlugin()],
        },
      }),
    ],
  },
});
