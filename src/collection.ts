import { powerSyncCollectionOptions } from "@tanstack/powersync-db-collection";
import { createCollection } from "@tanstack/react-db";
import { z } from "zod";

import { AppSchema, db } from "./db";

/**
 * Zod schema for items
 */
const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  tabId: z.string(),
});

/**
 * TanStack DB Collection for Items
 *
 * NOTE: This creates a RANDOM tracking table name internally:
 * `__items_tracking_${randomHex}`
 *
 * Each browser tab gets its own random tracking table.
 * This is the root cause of the cross-tab sync issue.
 */
export const itemsCollection = createCollection(
  powerSyncCollectionOptions({
    database: db,
    table: AppSchema.props.items,
    schema: ItemSchema,
  }),
);

export type ItemsCollectionType = typeof itemsCollection;
