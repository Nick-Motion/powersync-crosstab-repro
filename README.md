# PowerSync + TanStack DB Cross-Tab Bug Reproduction

This demonstrates a data inconsistency issue when using TanStack DB's PowerSync collection across multiple browser tabs.

## The Problem

TanStack DB's `powerSyncCollectionOptions` creates a **random tracking table name** for each collection instance:

```javascript
// From @tanstack/powersync-db-collection/dist/esm/powersync.js:39-41
const trackedTableName = `__${viewName}_tracking_${Math.floor(
  Math.random() * 4294967295
)
  .toString(16)
  .padStart(8, `0`)}`;
```

Each tab gets its own random tracking table (e.g., `__items_tracking_abc123` vs `__items_tracking_xyz789`).

When data changes:

1. PowerSync broadcasts `tablesUpdated` with `tables: ['items']`
2. TanStack collection listens for changes to its own tracking table: `tables: ['__items_tracking_xyz789']`
3. **No match = collection doesn't see the update**

## To Reproduce

1. `yarn dev`
2. Open a second tab with the same URL
3. In Tab 1, click "Add Item"
4. Observe Tab 2 - the item does NOT appear (but it's in SQLite)

## Expected Behavior

Both tabs should show the same data in real-time.

## Root Cause

In `@tanstack/powersync-db-collection`, the collection:

- Creates a trigger that writes changes to a randomly-named temp table
- Listens only to that temp table via `onChangeWithCallback({ tables: [trackedTableName] })`

PowerSync's cross-tab notification broadcasts the actual table name (`items`), but TanStack's collection is listening for its random tracking table name.

## Potential Fixes

1. **TanStack DB should listen to the source table** (`items`) for cross-tab updates, not just the tracking table
2. **Use a deterministic tracking table name** so all tabs share the same trigger destination
3. **Implement BroadcastChannel in TanStack DB** to explicitly notify collections across tabs
