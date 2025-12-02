import { useLiveQuery } from "@tanstack/react-db";
import { useCallback, useEffect, useState } from "react";

import { itemsCollection } from "./collection";
import { db, initDb, type Item } from "./db";

const TAB_ID = Math.random().toString(36).substring(2, 8);

export function App() {
  const [isReady, setIsReady] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const log = useCallback((msg: string) => {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);
    setLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
    console.log(`[Tab ${TAB_ID}] ${msg}`);
  }, []);

  // Initialize DB
  useEffect(() => {
    initDb().then(() => {
      setIsReady(true);
      log("Database initialized");
    });
  }, [log]);

  if (!isReady) {
    return <div>Initializing PowerSync...</div>;
  }

  return <ItemsView log={log} logs={logs} />;
}

function ItemsView({
  log,
  logs,
}: {
  log: (msg: string) => void;
  logs: string[];
}) {
  // TanStack DB live query - should auto-update when data changes
  const { data: items, isLoading } = useLiveQuery((q) =>
    q
      .from({ items: itemsCollection })
      .orderBy(({ items }) => items.createdAt, "desc"),
  );

  const [sqliteItems, setSqliteItems] = useState<Item[]>([]);

  // Add new item via TanStack DB collection
  const handleAddItem = useCallback(async () => {
    const newItem = {
      id: crypto.randomUUID(),
      name: `Item ${(items?.length ?? 0) + 1}`,
      createdAt: new Date().toISOString(),
      tabId: TAB_ID,
    };

    log(`Adding item: ${newItem.name}`);

    // Insert via TanStack DB collection
    itemsCollection.insert(newItem);

    log(`Item added via TanStack collection`);
  }, [items?.length, log]);

  // Query SQLite directly to compare
  const handleQuerySqlite = useCallback(async () => {
    log("Querying SQLite directly...");
    const result = await db.getAll<Item>(
      "SELECT * FROM items ORDER BY createdAt DESC",
    );
    setSqliteItems(result);
    log(`SQLite has ${result.length} items`);
  }, [log]);

  // Log when items change
  useEffect(() => {
    if (items) {
      log(`TanStack collection updated: ${items.length} items`);
    }
  }, [items, log]);

  const itemCount = items?.length ?? 0;
  const sqliteCount = sqliteItems.length;

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 900,
        margin: "2rem auto",
        padding: "0 1rem",
      }}
    >
      <h1>PowerSync + TanStack DB Cross-Tab Bug</h1>

      <div
        style={{
          background: "#f0f0f0",
          padding: "0.5rem 1rem",
          borderRadius: 4,
          marginBottom: "1rem",
        }}
      >
        <strong>Tab ID:</strong> <code>{TAB_ID}</code>
      </div>

      <p>
        <strong>To reproduce:</strong> Open this page in two tabs. Add an item
        in Tab 1. Observe that Tab 2 does NOT see the item (but SQLite has it).
      </p>

      <div style={{ marginBottom: "1rem" }}>
        <button
          onClick={handleAddItem}
          style={{ marginRight: "0.5rem", padding: "0.5rem 1rem" }}
        >
          Add Item
        </button>
        <button onClick={handleQuerySqlite} style={{ padding: "0.5rem 1rem" }}>
          Query SQLite Directly
        </button>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}
      >
        <div>
          <h3>TanStack Collection ({itemCount} items)</h3>
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 4,
              minHeight: 150,
            }}
          >
            {isLoading ? (
              <div style={{ padding: "1rem", color: "#999" }}>Loading...</div>
            ) : itemCount === 0 ? (
              <div style={{ padding: "1rem", color: "#999" }}>No items</div>
            ) : (
              items?.map((item) => (
                <div
                  key={item.id}
                  style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}
                >
                  <strong>{item.name}</strong>
                  <span
                    style={{
                      color: "#999",
                      marginLeft: "0.5rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    (tab {item.tabId})
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h3>SQLite Direct Query ({sqliteCount} items)</h3>
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 4,
              minHeight: 150,
            }}
          >
            {sqliteCount === 0 ? (
              <div style={{ padding: "1rem", color: "#999" }}>
                Click "Query SQLite" to check
              </div>
            ) : (
              sqliteItems.map((item) => (
                <div
                  key={item.id}
                  style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}
                >
                  <strong>{item.name}</strong>
                  <span
                    style={{
                      color: "#999",
                      marginLeft: "0.5rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    (tab {item.tabId})
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {itemCount !== sqliteCount && sqliteCount > 0 && (
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            background: "#fee",
            borderRadius: 4,
            color: "#c00",
          }}
        >
          <strong>Bug detected!</strong> TanStack collection has {itemCount}{" "}
          items but SQLite has {sqliteCount}. The collection is not receiving
          cross-tab updates.
        </div>
      )}

      <h3>Event Log</h3>
      <div
        style={{
          background: "#1e1e1e",
          color: "#d4d4d4",
          padding: "1rem",
          borderRadius: 4,
          fontFamily: "monospace",
          fontSize: "0.8rem",
          maxHeight: 200,
          overflow: "auto",
        }}
      >
        {logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>

      <h3>Root Cause</h3>
      <pre
        style={{
          background: "#f5f5f5",
          padding: "1rem",
          borderRadius: 4,
          overflow: "auto",
          fontSize: "0.85rem",
        }}
      >
        {`// In @tanstack/powersync-db-collection/dist/esm/powersync.js:39-41
const trackedTableName = \`__\${viewName}_tracking_\${Math.floor(
  Math.random() * 4294967295
).toString(16).padStart(8, '0')}\`;

// Each tab gets a RANDOM tracking table name!
// Tab A: __items_tracking_a1b2c3d4
// Tab B: __items_tracking_e5f6g7h8

// Line 98: Collection only listens to its own tracking table
tables: [trackedTableName]

// When PowerSync broadcasts "items" changed,
// TanStack is listening for "__items_tracking_xxx" - no match!`}
      </pre>
    </div>
  );
}
