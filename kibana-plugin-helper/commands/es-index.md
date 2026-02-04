---
description: Generate Elasticsearch index templates, mappings, and index management code for a Kibana plugin
---

# Set Up Elasticsearch Index

Generate the Elasticsearch index infrastructure for a Kibana plugin. Ask the user for:

1. **Index name / pattern** (e.g. `my-plugin-items`, `my-plugin-*`)
2. **Data model**: what fields, their types, and which are searchable/sortable
3. **Lifecycle needs**: ILM policy, retention period, rollover settings
4. **Write pattern**: single index, time-based indices, or alias-based

## What to Generate

### 1. Index Template Setup
- Generate a function that creates/updates the index template using `esClient.indices.putIndexTemplate()`
- Define proper mappings with correct field types (keyword, text, date, boolean, integer, object, nested)
- Set appropriate index settings (shards, replicas, refresh interval)
- Call this function during plugin `setup()` or `start()` using `asInternalUser`

### 2. Mapping Definition
- Use `keyword` for exact match / aggregation fields (IDs, statuses, tags, emails)
- Use `text` for full-text search fields (descriptions, content) — add `.keyword` sub-field if also need exact match
- Use `date` for timestamps with proper format
- Use `object` / `nested` for structured sub-documents
- Include `_meta` field for plugin version tracking (useful for migrations)

### 3. Service Layer
- Generate an Elasticsearch service class in `server/services/` that wraps common operations
- Include methods for: create, getById, search (with pagination), update, delete, bulk operations
- Include proper TypeScript types for documents
- Handle `version_conflict_engine_exception` for optimistic concurrency
- Include `refresh: 'wait_for'` option for write operations

### 4. Index Lifecycle Management (if requested)
- Generate ILM policy for automatic rollover and deletion
- Configure hot/warm/cold/delete phases as needed
- Wire up the ILM policy to the index template

### 5. Migration Support
- Generate a version check that compares index mapping version to plugin version
- Include a migration function pattern for updating mappings when plugin is upgraded
- Use `_meta.version` in the mapping to track schema version

## Rules
- Always use index templates over creating indices directly (future-proof)
- Use `asInternalUser` for index/template management (requires Kibana system privileges)
- Use `asCurrentUser` for CRUD operations on documents
- Never hardcode index names — use constants from `common/`
- Include proper error handling for index-not-found scenarios
