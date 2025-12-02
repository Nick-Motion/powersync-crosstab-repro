import {
  column,
  PowerSyncDatabase,
  Schema,
  Table,
  WASQLiteOpenFactory,
  WASQLiteVFS,
} from "@powersync/web";

/**
 * Schema definition
 */
const items = new Table({
  name: column.text,
  createdAt: column.text,
  tabId: column.text,
});

export const AppSchema = new Schema({
  items,
});

export type Database = (typeof AppSchema)["types"];
export type Item = Database["items"];

/**
 * PowerSync database with multi-tab support
 */
export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: new WASQLiteOpenFactory({
    dbFilename: "crosstab-repro.db",
    vfs: WASQLiteVFS.OPFSCoopSyncVFS,
    flags: {
      enableMultiTabs: typeof SharedWorker !== "undefined",
    },
  }),
  flags: {
    enableMultiTabs: typeof SharedWorker !== "undefined",
  },
});

/**
 * Initialize database (no remote sync - local only for repro)
 */
export async function initDb() {
  await db.init();
  console.log("[DB] Initialized");
}
