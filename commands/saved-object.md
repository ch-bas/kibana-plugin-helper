---
description: Generate a custom Saved Object type with registration, mappings, migrations, CRUD service, and management integration for a Kibana plugin
---

# Generate Kibana Saved Object Type

Create a complete custom Saved Object type for a Kibana plugin. Ask the user for:

1. **Saved Object type name** (snake_case, e.g. `my_plugin_dashboard`)
2. **Attributes/fields** (name, type, required/optional for each)
3. **Namespace type**: `single` (space-scoped), `multiple` (shareable across spaces), or `agnostic` (global)
4. **Hidden?** (default: false — hidden types are only accessible via the internal API)
5. **Needs migrations?** (if upgrading from a previous version, describe schema changes)
6. **Needs management integration?** (visible in Kibana's Saved Objects management page)
7. **Needs references to other saved objects?** (e.g. references to dashboards, index patterns)
8. **Needs import/export support?** (default: yes for non-hidden types)

## Generation Steps

1. Create the saved object type definition in `server/saved_objects/` directory
2. Generate the type registration file with:
   - Type name constant in `common/index.ts`
   - Attribute mappings (keyword, text, boolean, integer, long, date, object, nested, etc.)
   - `namespaceType` setting
   - `hidden` flag
   - `management` section (importableAndExportable, icon, defaultSearchField, getTitle, getInAppUrl)
   - `mappings` with all properties correctly typed
3. Generate migrations if needed:
   - Create `server/saved_objects/migrations/` directory
   - Create versioned migration functions (e.g. `7.14.0`, `8.0.0`)
   - Each migration transforms the document from one version to the next
   - Use `SavedObjectMigrationFn` type signature
4. Generate a CRUD service class in `server/services/`:
   - `create()` — creates a new saved object
   - `get()` — retrieves by ID
   - `find()` — searches with filters, pagination, sorting
   - `update()` — partial update
   - `delete()` — removes the saved object
   - `bulkCreate()` / `bulkGet()` — batch operations
   - Proper error handling with `SavedObjectsErrorHelpers`
5. Register the type in the server plugin's `setup()` method using `core.savedObjects.registerType()`
6. Generate server routes that use the CRUD service
7. If management integration is needed, configure `management` properties in the type definition

## Important Rules

- Always define mappings for every attribute — Kibana won't index unmapped fields
- Use `namespaceType: 'single'` unless cross-space sharing is explicitly needed
- Always create migrations when changing attribute mappings between versions
- Migrations must be idempotent — they might run more than once
- Use `SavedObjectsUtils.generateId()` if you need deterministic IDs
- Hidden types require explicit access via `savedObjects.getClient({ includedHiddenTypes: ['type_name'] })`
- Never use the public `savedObjectsClient` directly for hidden types — it will throw
- References (to other saved objects) use the `references` array, not embedded IDs in attributes
- Always handle `SavedObjectsErrorHelpers.isNotFoundError()` in get/update/delete operations
- Use `schema.object()` validation on route bodies that map to saved object attributes
- Export saved object type constants from `common/` so both server and public can reference them
- For encrypted saved objects, use `encryptedSavedObjects` plugin dependency

## Migration Template Pattern

For versioned migrations, generate this structure:

```
server/saved_objects/migrations/
├── index.ts              # Aggregates all migrations per type
├── to_7_14_0.ts          # Migration to 7.14.0
└── to_8_0_0.ts           # Migration to 8.0.0
```

Each migration file exports a function:
```typescript
export const migrateToX: SavedObjectMigrationFn = (doc) => {
  // Transform doc.attributes
  return doc;
};
```

## Reference Pattern

When the saved object references other saved objects (dashboards, index patterns, etc.), use the references array:

```typescript
// DO: Use the references array
savedObjectsClient.create('my_type', attributes, {
  references: [{ id: dashboardId, type: 'dashboard', name: 'linked_dashboard' }]
});

// DON'T: Embed IDs in attributes
savedObjectsClient.create('my_type', { ...attributes, dashboardId });
```
