/**
 * Build a Prisma `orderBy` from `?sortBy&sortDir` query params against a whitelist.
 * `fields` maps an allowed `sortBy` key to either a Prisma field name (string) or a
 * function `(dir) => orderBy` for relation/computed sorting. Unknown keys fall back
 * to `defaultKey` so a bad query param never becomes a Prisma/SQL error.
 */
function parseSort(query, fields, defaultKey) {
  const key = Object.prototype.hasOwnProperty.call(fields, query.sortBy) ? query.sortBy : defaultKey;
  const dir = query.sortDir === 'desc' ? 'desc' : 'asc';
  const shape = fields[key];
  return typeof shape === 'function' ? shape(dir) : { [shape]: dir };
}

module.exports = { parseSort };
