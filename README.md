# PowerSync + TanStack DB Cross-Tab Bug Reproduction

This demonstrates data inconsistency issues when using TanStack DB's PowerSync collection across multiple browser tabs.

## The Problems

There are **two distinct issues** causing cross-tab sync failures:

### Issue 1: Random Tracking Table Names (TanStack DB)

TanStack DB's `powerSyncCollectionOptions` creates a **random tracking table name** for each collection instance:

```javascript
// From @tanstack/powersync-db-collection/dist/esm/powersync.js:39-41
const trackedTableName = `__${viewName}_tracking_${Math.floor(
  Math.random() * 4294967295
).toString(16).padStart(8, '0')}`;
```

Each tab gets its own random tracking table (e.g., `__items_tracking_abc123` vs `__items_tracking_xyz789`).

When data changes:
1. PowerSync broadcasts `tablesUpdated` with `tables: ['items']`
2. TanStack collection listens for its own tracking table: `tables: ['__items_tracking_xyz789']`
3. **No match = collection doesn't see the update**

### Issue 2: One-Directional Sync (PowerSync SharedWorker)

PowerSync's `SharedSyncImplementation` always uses the **last connected tab** for CRUD uploads:

```javascript
// From @powersync/web/src/worker/sync/SharedSyncImplementation.ts:439-452
uploadCrud: async () => {
  const lastPort = this.ports[this.ports.length - 1];  // Always the newest tab!
  // ...
  resolve(await lastPort.clientProvider.uploadCrud());
}
```

This means:
- Tab A opens first → `ports[0]`
- Tab B opens second → `ports[1]`
- ALL uploads go through Tab B's connector, regardless of which tab made the mutation
- If Tab B closes, sync breaks until reconnection

## To Reproduce

1. `yarn dev`
2. Open Tab A first
3. Open Tab B second
4. In Tab A, click "Add Item"
5. Observe: Item may appear in Tab B but NOT in Tab A's TanStack collection
6. Close Tab B
7. Try adding items in Tab A - sync may fail

## Expected Behavior

Both tabs should show the same data in real-time, regardless of which tab made the mutation or which tab opened first.

## Root Causes

### TanStack DB Collection (`@tanstack/powersync-db-collection`)
- Creates SQLite triggers that write to a randomly-named temp table
- Listens only to that temp table via `onChangeWithCallback({ tables: [trackedTableName] })`
- PowerSync broadcasts actual table names, TanStack listens for random names → **mismatch**

### PowerSync SharedWorker (`@powersync/web`)
- Uses `this.ports[this.ports.length - 1]` for credentials and uploads
- Tab order determines which connector handles sync
- Creates asymmetric sync behavior between tabs

## Potential Fixes

### For TanStack DB:
1. **Listen to the source table** (`items`) for cross-tab updates, not just the tracking table
2. **Use a deterministic tracking table name** so all tabs share the same trigger destination
3. **Implement BroadcastChannel** to explicitly notify collections across tabs

### For PowerSync:
1. **Round-robin or primary election** for upload handling
2. **Route uploads through the originating tab's connector**
3. **Fallback mechanism** when the primary tab closes
