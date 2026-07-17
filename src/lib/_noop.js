// Empty module shim for unused database drivers (sqlite3, mysql2, etc.)
// Knex tries to dynamically require all dialect drivers at runtime.
// This file replaces unused drivers so they don't cause errors on Vercel.
//
// Works as ESM — the Rollup plugin resolves unused drivers to this file.
const noop = () => {
  throw new Error("This database driver is not installed. Only PostgreSQL (pg) is supported.");
};

export default noop;
export const Client = noop;
