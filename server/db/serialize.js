// Mongoose's `.lean()` output shaped `_id` as the id key and JS Dates for
// timestamps. The client (`client/src/utils/api.js` and every page) reads
// that shape verbatim (`_id`, populated refs as nested objects). Rather than
// touch 8 client pages, every PG row is reshaped to look exactly like the
// Mongoose documents it replaces before it leaves a controller.
//
// `id` is kept alongside `_id` (harmless) so nothing that already reads `.id`
// breaks either.
function withId(row) {
  if (!row) return row;
  const { id, ...rest } = row;
  return { ...rest, _id: id, id };
}

function withIds(rows) {
  return (rows || []).map(withId);
}

module.exports = { withId, withIds };
