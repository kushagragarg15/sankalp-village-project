/**
 * A stand-in for the Drizzle `db` object that every controller and middleware
 * obtains via `getDb()`. Tests queue the rows each query should return, in
 * the order the code under test issues them:
 *
 *   const db = createMockDb();
 *   db.queueSelect([sessionRow]);       // first db.select()...
 *   db.queueSelect([registrationRow]);  // second db.select()...
 *   db.queueExecute({ rows: [...] });   // first db.execute(sql`...`)
 *
 * Every builder method (`from`, `where`, `limit`, ...) returns the same
 * thenable, so any chain length `await`s to the queued result.
 */
const createMockDb = () => {
  const selects = [];
  const executes = [];

  const thenable = (result) => {
    const promise = Promise.resolve(result);
    const chain = {};
    for (const m of ['from', 'where', 'limit', 'orderBy', 'innerJoin', 'leftJoin', 'groupBy', 'set', 'values', 'returning', 'offset']) {
      chain[m] = jest.fn(() => chain);
    }
    chain.then = promise.then.bind(promise);
    chain.catch = promise.catch.bind(promise);
    chain.finally = promise.finally.bind(promise);
    return chain;
  };

  const next = (queue, kind) => {
    if (!queue.length) throw new Error(`mockDb: no queued result for db.${kind}()`);
    return queue.shift();
  };

  const db = {
    select: jest.fn(() => thenable(next(selects, 'select'))),
    insert: jest.fn(() => thenable(next(selects, 'insert'))),
    update: jest.fn(() => thenable(next(selects, 'update'))),
    delete: jest.fn(() => thenable(next(selects, 'delete'))),
    execute: jest.fn(() => Promise.resolve(next(executes, 'execute'))),
    queueSelect: (rows) => selects.push(rows),
    queueExecute: (result) => executes.push(result),
    pending: () => ({ selects: selects.length, executes: executes.length })
  };
  return db;
};

module.exports = { createMockDb };
