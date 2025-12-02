# PowerSync + TanStack DB Cross-Tab Bug Reproduction

This demonstrates data inconsistency issues when using TanStack DB's PowerSync collection across multiple browser tabs.

## Observed Behavior

- Each tab only sees its own changes
- Cross-tab updates never appear in TanStack collections
- SQLite has all the data (verified via direct query)

## To Reproduce

1. `yarn dev`
2. Open two tabs
3. Add an item in Tab A → Tab A sees it, Tab B doesn't
4. Add an item in Tab B → Tab B sees it, Tab A doesn't
5. Click "Query SQLite" in any tab → All items are there
6. Refresh any tab → All items appear (data was in SQLite all along)

## Root Cause

### TanStack DB uses TEMP triggers + BroadcastChannel table name mismatch

Each tab creates a randomly-named tracking table and TEMP trigger:

```javascript
// @tanstack/powersync-db-collection/src/powersync.ts:275-280
const trackedTableName = `__${viewName}_tracking_${Math.floor(
  Math.random() * 0xffffffff
).toString(16).padStart(8, '0')}`;
```

The collection then listens for changes to this tracking table:

```javascript
// Line ~360
onChangeWithCallback({ tables: [trackedTableName] })
```

But when PowerSync's BroadcastChannel notifies tabs of changes, it sends the **actual table name** (`items`), not the random tracking table names.

**Source code**: https://github.com/TanStack/db/blob/main/packages/powersync-db-collection/src/powersync.ts#L275-L280

## Potential Fixes

1. **Listen to BOTH the source table AND the tracking table** for change notifications
2. **Use a deterministic tracking table name** so all tabs can share triggers
3. **Add BroadcastChannel in TanStack DB** to explicitly notify collections across tabs
