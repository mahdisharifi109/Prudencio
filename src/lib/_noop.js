// Empty module shim for unused database drivers (sqlite3, mysql2, etc.)
// Knex tries to import all dialect drivers at bundle time.
// This file replaces unused drivers so they don't cause runtime errors on Vercel.

// Support both ESM and CJS require patterns
module.exports = {};
module.exports.default = {};
export default {};
