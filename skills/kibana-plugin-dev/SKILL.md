---
name: kibana-plugin-dev
description: Comprehensive knowledge base for Kibana plugin development. Covers plugin architecture, server/client patterns, saved objects, embeddables, UI actions, expressions, state management, logging, HTTP resources, and inter-plugin communication. Use this skill when building, debugging, or maintaining Kibana plugins.
---

# Kibana Plugin Development

This skill provides comprehensive knowledge for developing Kibana plugins across all major subsystems.

## Plugin Architecture Overview

Kibana plugins consist of:
- **Server-side** (`server/`): Routes, saved objects, background tasks
- **Client-side** (`public/`): React UI, embeddables, applications
- **Common** (`common/`): Shared types and constants

### Plugin Lifecycle

```typescript
// server/plugin.ts
export class MyPlugin implements Plugin {
  setup(core: CoreSetup) {
    // Register routes, saved objects, capabilities
    // Called once at startup
  }
  
  start(core: CoreStart) {
    // Access other plugins' start contracts
    // Called after all plugins are set up
  }
  
  stop() {
    // Cleanup
  }
}
```

### Key Principles

1. Register everything in `setup()`, not `start()`
2. Use `await context.core` in route handlers (async since 8.1)
3. Export types for other plugins to consume
4. Use `common/` for shared code between server and browser


## Saved Objects

Saved Objects are Kibana's primary persistence layer for plugin data that needs to be managed, imported/exported, migrated across versions, and scoped to Kibana Spaces. Use Saved Objects when your data belongs to the Kibana application layer (configurations, user-created resources, plugin settings) rather than raw Elasticsearch data.

**When to use Saved Objects vs plain ES indices:**
- Use Saved Objects when: data needs space-scoping, import/export, version migrations, references to other Kibana objects, or management UI integration
- Use plain ES indices when: data is high-volume, time-series, search-heavy, or doesn't need Kibana management features

---

### Type Registration

Register custom saved object types in the server plugin's `setup()` method:

```typescript
// server/saved_objects/my_custom_type.ts
import { SavedObjectsType } from '@kbn/core/server';

export const MY_CUSTOM_TYPE = 'my-plugin-config';

export const myCustomType: SavedObjectsType = {
  name: MY_CUSTOM_TYPE,
  hidden: false,
  namespaceType: 'single', // 'single' | 'multiple' | 'agnostic'
  mappings: {
    dynamic: false,
    properties: {
      title: { type: 'text' },
      name: { type: 'keyword' },
      description: { type: 'text' },
      enabled: { type: 'boolean' },
      priority: { type: 'integer' },
      config: { type: 'object', dynamic: false },
      tags: { type: 'keyword' },
      created_at: { type: 'date' },
      updated_at: { type: 'date' },
      created_by: { type: 'keyword' },
    },
  },
  management: {
    importableAndExportable: true,
    icon: 'gear',
    defaultSearchField: 'title',
    getTitle(obj) {
      return obj.attributes.title || obj.attributes.name;
    },
    getInAppUrl(obj) {
      return {
        path: `/app/myPlugin#/config/${obj.id}`,
        uiCapabilitiesPath: 'myPlugin.show',
      };
    },
  },
  migrations: {
    // Version-keyed migration functions
    '1.1.0': migrateV1_1_0,
    '2.0.0': migrateV2_0_0,
  },
};
```

```typescript
// server/plugin.ts — register in setup()
import { myCustomType } from './saved_objects/my_custom_type';

public setup(core: CoreSetup) {
  core.savedObjects.registerType(myCustomType);
}
```

---

### Namespace Types

| Type | Behavior | Use Case |
|------|----------|----------|
| `single` | Belongs to exactly one Space. Isolated between spaces. | User configs, space-specific dashboards |
| `multiple` | Can be shared across multiple Spaces. | Shared templates, reusable configs |
| `agnostic` | Global — not scoped to any Space. | Global settings, license data, system state |

- `single` is the default and most common choice
- `multiple` requires the `multiple-isolated` or `multiple` sharing mode and is more complex to manage
- `agnostic` types are visible everywhere and cannot be restricted to a space

---

### Mappings

Every attribute must be mapped. Kibana uses these mappings to create the Elasticsearch index. Unmapped fields are silently dropped.

```typescript
mappings: {
  dynamic: false, // Always set to false — prevents mapping explosions
  properties: {
    // Text fields (full-text search)
    title: { type: 'text' },
    description: { type: 'text' },

    // Keyword fields (exact match, aggregations, sorting)
    name: { type: 'keyword' },
    status: { type: 'keyword' },
    type: { type: 'keyword' },
    tags: { type: 'keyword' },       // arrays of keywords work fine

    // Numeric
    count: { type: 'integer' },
    score: { type: 'float' },
    size: { type: 'long' },

    // Boolean
    enabled: { type: 'boolean' },
    is_default: { type: 'boolean' },

    // Date
    created_at: { type: 'date' },
    updated_at: { type: 'date' },

    // Nested/Object (for structured sub-objects)
    config: { type: 'object', dynamic: false },
    metadata: {
      properties: {
        version: { type: 'keyword' },
        source: { type: 'keyword' },
      },
    },

    // Flattened (for arbitrary key-value data without mapping each field)
    labels: { type: 'flattened' },

    // Binary (base64 encoded, not searchable)
    icon: { type: 'binary' },
  },
}
```

**Important:** `dynamic: false` is mandatory for saved object types. Setting it to `true` risks index mapping explosions from user-supplied data.

---

### Migrations

Migrations transform saved objects when Kibana upgrades. Every time you change the mappings or attribute structure of a saved object type, you must provide a migration.

```typescript
// server/saved_objects/migrations/index.ts
import { SavedObjectMigrationMap } from '@kbn/core/server';
import { migrateToV1_1_0 } from './to_v1_1_0';
import { migrateToV2_0_0 } from './to_v2_0_0';

export const myTypeMigrations: SavedObjectMigrationMap = {
  '1.1.0': migrateToV1_1_0,
  '2.0.0': migrateToV2_0_0,
};
```

```typescript
// server/saved_objects/migrations/to_v1_1_0.ts
import { SavedObjectMigrationFn, SavedObjectUnsanitizedDoc } from '@kbn/core/server';

// Adding a new field with a default value
export const migrateToV1_1_0: SavedObjectMigrationFn = (doc) => {
  return {
    ...doc,
    attributes: {
      ...doc.attributes,
      // Add new 'priority' field, default to 0
      priority: doc.attributes.priority ?? 0,
      // Rename a field
      name: doc.attributes.name ?? doc.attributes.title,
    },
  };
};
```

```typescript
// server/saved_objects/migrations/to_v2_0_0.ts
import { SavedObjectMigrationFn } from '@kbn/core/server';

// Restructuring attributes
export const migrateToV2_0_0: SavedObjectMigrationFn = (doc) => {
  const { oldField, deprecatedSetting, ...rest } = doc.attributes;

  return {
    ...doc,
    attributes: {
      ...rest,
      // Move old flat fields into a nested config object
      config: {
        ...(doc.attributes.config || {}),
        setting: deprecatedSetting ?? 'default',
      },
      // Remove the old field by not including it
    },
  };
};
```

**Migration rules:**
- Migrations must be idempotent — they may run multiple times
- Never delete the migration function for a version once released — old documents need it
- Migrations run sequentially from the document's version to the current version
- Always provide defaults for new fields (`??` operator)
- Never throw in a migration — return a best-effort result
- Test migrations with real document shapes from previous versions

---

### CRUD Service Pattern

Create a service class that wraps SavedObjectsClient operations:

```typescript
// server/services/my_config_service.ts
import {
  SavedObjectsClientContract,
  SavedObject,
  SavedObjectsFindResponse,
  SavedObjectsErrorHelpers,
} from '@kbn/core/server';
import { MY_CUSTOM_TYPE } from '../saved_objects/my_custom_type';

export interface MyConfig {
  title: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  tags: string[];
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export class MyConfigService {
  constructor(private readonly savedObjectsClient: SavedObjectsClientContract) {}

  async create(
    attributes: Omit<MyConfig, 'created_at' | 'updated_at'>,
    references?: Array<{ id: string; type: string; name: string }>
  ): Promise<SavedObject<MyConfig>> {
    const now = new Date().toISOString();
    return this.savedObjectsClient.create<MyConfig>(
      MY_CUSTOM_TYPE,
      {
        ...attributes,
        created_at: now,
        updated_at: now,
      },
      { references }
    );
  }

  async get(id: string): Promise<SavedObject<MyConfig>> {
    return this.savedObjectsClient.get<MyConfig>(MY_CUSTOM_TYPE, id);
  }

  async find(params: {
    page?: number;
    perPage?: number;
    search?: string;
    searchFields?: string[];
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
    filter?: string;
  }): Promise<SavedObjectsFindResponse<MyConfig>> {
    return this.savedObjectsClient.find<MyConfig>({
      type: MY_CUSTOM_TYPE,
      page: params.page ?? 1,
      perPage: params.perPage ?? 20,
      search: params.search,
      searchFields: params.searchFields ?? ['title', 'name', 'description'],
      sortField: params.sortField ?? 'updated_at',
      sortOrder: params.sortOrder ?? 'desc',
      filter: params.filter,
    });
  }

  async update(
    id: string,
    attributes: Partial<MyConfig>,
    references?: Array<{ id: string; type: string; name: string }>
  ): Promise<SavedObject<MyConfig>> {
    return this.savedObjectsClient.update<MyConfig>(
      MY_CUSTOM_TYPE,
      id,
      {
        ...attributes,
        updated_at: new Date().toISOString(),
      },
      { references }
    );
  }

  async delete(id: string): Promise<{}> {
    return this.savedObjectsClient.delete(MY_CUSTOM_TYPE, id);
  }

  async bulkCreate(
    objects: Array<{
      attributes: Omit<MyConfig, 'created_at' | 'updated_at'>;
      id?: string;
      references?: Array<{ id: string; type: string; name: string }>;
    }>
  ): Promise<SavedObject<MyConfig>[]> {
    const now = new Date().toISOString();
    const result = await this.savedObjectsClient.bulkCreate<MyConfig>(
      objects.map((obj) => ({
        type: MY_CUSTOM_TYPE,
        id: obj.id,
        attributes: {
          ...obj.attributes,
          created_at: now,
          updated_at: now,
        } as MyConfig,
        references: obj.references,
      }))
    );
    return result.saved_objects;
  }

  async bulkGet(ids: string[]): Promise<SavedObject<MyConfig>[]> {
    const result = await this.savedObjectsClient.bulkGet<MyConfig>(
      ids.map((id) => ({ id, type: MY_CUSTOM_TYPE }))
    );
    return result.saved_objects;
  }
}
```

---

### Using the Service in Routes

```typescript
// server/routes/config_routes.ts
import { IRouter, Logger } from '@kbn/core/server';
import { schema } from '@kbn/config-schema';
import { MyConfigService } from '../services/my_config_service';
import { MY_CUSTOM_TYPE } from '../saved_objects/my_custom_type';

export function registerConfigRoutes(router: IRouter, logger: Logger) {
  // List
  router.get(
    {
      path: '/api/my_plugin/configs',
      validate: {
        query: schema.object({
          page: schema.number({ defaultValue: 1, min: 1 }),
          perPage: schema.number({ defaultValue: 20, min: 1, max: 100 }),
          search: schema.maybe(schema.string()),
          sortField: schema.string({ defaultValue: 'updated_at' }),
          sortOrder: schema.oneOf(
            [schema.literal('asc'), schema.literal('desc')],
            { defaultValue: 'desc' }
          ),
        }),
      },
    },
    async (context, request, response) => {
      try {
        const coreContext = await context.core;
        const client = coreContext.savedObjects.client;
        const service = new MyConfigService(client);

        const result = await service.find(request.query);
        return response.ok({
          body: {
            items: result.saved_objects.map((so) => ({
              id: so.id,
              ...so.attributes,
              references: so.references,
            })),
            total: result.total,
            page: result.page,
            perPage: result.per_page,
          },
        });
      } catch (error) {
        logger.error(`Error listing configs: ${error}`);
        return response.customError({
          statusCode: 500,
          body: { message: 'Failed to list configs' },
        });
      }
    }
  );

  // Get by ID
  router.get(
    {
      path: '/api/my_plugin/configs/{id}',
      validate: {
        params: schema.object({ id: schema.string() }),
      },
    },
    async (context, request, response) => {
      try {
        const client = (await context.core).savedObjects.client;
        const service = new MyConfigService(client);
        const result = await service.get(request.params.id);

        return response.ok({
          body: { id: result.id, ...result.attributes, references: result.references },
        });
      } catch (error: any) {
        if (error?.output?.statusCode === 404) {
          return response.notFound({ body: { message: `Config ${request.params.id} not found` } });
        }
        logger.error(`Error getting config: ${error}`);
        return response.customError({ statusCode: 500, body: { message: 'Failed to get config' } });
      }
    }
  );

  // Create
  router.post(
    {
      path: '/api/my_plugin/configs',
      validate: {
        body: schema.object({
          title: schema.string({ minLength: 1, maxLength: 255 }),
          name: schema.string({ minLength: 1, maxLength: 100 }),
          description: schema.maybe(schema.string()),
          enabled: schema.boolean({ defaultValue: true }),
          priority: schema.number({ defaultValue: 0, min: 0 }),
          tags: schema.arrayOf(schema.string(), { defaultValue: [] }),
          config: schema.recordOf(schema.string(), schema.any(), { defaultValue: {} }),
          references: schema.maybe(
            schema.arrayOf(
              schema.object({
                id: schema.string(),
                type: schema.string(),
                name: schema.string(),
              })
            )
          ),
        }),
      },
    },
    async (context, request, response) => {
      try {
        const coreContext = await context.core;
        const client = coreContext.savedObjects.client;
        const user = coreContext.security.authc.getCurrentUser();
        const service = new MyConfigService(client);

        const { references, ...attributes } = request.body;
        const result = await service.create(
          { ...attributes, created_by: user?.username ?? 'unknown' },
          references
        );

        return response.ok({
          body: { id: result.id, ...result.attributes },
        });
      } catch (error) {
        logger.error(`Error creating config: ${error}`);
        return response.customError({ statusCode: 500, body: { message: 'Failed to create config' } });
      }
    }
  );

  // Update
  router.put(
    {
      path: '/api/my_plugin/configs/{id}',
      validate: {
        params: schema.object({ id: schema.string() }),
        body: schema.object({
          title: schema.maybe(schema.string({ minLength: 1, maxLength: 255 })),
          name: schema.maybe(schema.string({ minLength: 1, maxLength: 100 })),
          description: schema.maybe(schema.string()),
          enabled: schema.maybe(schema.boolean()),
          priority: schema.maybe(schema.number({ min: 0 })),
          tags: schema.maybe(schema.arrayOf(schema.string())),
          config: schema.maybe(schema.recordOf(schema.string(), schema.any())),
          references: schema.maybe(
            schema.arrayOf(
              schema.object({
                id: schema.string(),
                type: schema.string(),
                name: schema.string(),
              })
            )
          ),
        }),
      },
    },
    async (context, request, response) => {
      try {
        const client = (await context.core).savedObjects.client;
        const service = new MyConfigService(client);
        const { references, ...attributes } = request.body;
        const result = await service.update(request.params.id, attributes, references);

        return response.ok({
          body: { id: result.id, ...result.attributes },
        });
      } catch (error: any) {
        if (error?.output?.statusCode === 404) {
          return response.notFound({ body: { message: `Config ${request.params.id} not found` } });
        }
        logger.error(`Error updating config: ${error}`);
        return response.customError({ statusCode: 500, body: { message: 'Failed to update config' } });
      }
    }
  );

  // Delete
  router.delete(
    {
      path: '/api/my_plugin/configs/{id}',
      validate: {
        params: schema.object({ id: schema.string() }),
      },
    },
    async (context, request, response) => {
      try {
        const client = (await context.core).savedObjects.client;
        const service = new MyConfigService(client);
        await service.delete(request.params.id);
        return response.ok({ body: { success: true } });
      } catch (error: any) {
        if (error?.output?.statusCode === 404) {
          return response.notFound({ body: { message: `Config ${request.params.id} not found` } });
        }
        logger.error(`Error deleting config: ${error}`);
        return response.customError({ statusCode: 500, body: { message: 'Failed to delete config' } });
      }
    }
  );
}
```

---

### Hidden Types

Hidden saved object types are not visible in the Saved Objects management UI and cannot be accessed via the standard client. Use them for internal plugin state, secrets, or system data.

```typescript
export const myHiddenType: SavedObjectsType = {
  name: 'my-plugin-internal-state',
  hidden: true,  // Not visible in management UI
  namespaceType: 'agnostic',
  mappings: {
    dynamic: false,
    properties: {
      state: { type: 'object', dynamic: false },
      last_run: { type: 'date' },
    },
  },
};
```

To access hidden types, request a client with explicit access:

```typescript
// In a route handler
const client = (await context.core).savedObjects.getClient({
  includedHiddenTypes: ['my-plugin-internal-state'],
});

// Or from the start contract
const client = core.savedObjects.createInternalRepository(['my-plugin-internal-state']);
```

---

### References

Saved object references create trackable links between objects. Kibana uses references for:
- Import/export dependency resolution
- Relocating objects between spaces
- Dashboard drilldowns, panel references

```typescript
// Creating with references
const dashboard = await savedObjectsClient.create(
  'my-plugin-widget',
  {
    title: 'My Widget',
    // DO NOT store the dashboard ID here
  },
  {
    references: [
      {
        id: 'some-dashboard-id',
        type: 'dashboard',
        name: 'linked_dashboard',  // Stable reference name (not the ID)
      },
      {
        id: 'some-index-pattern-id',
        type: 'index-pattern',
        name: 'primary_data_view',
      },
    ],
  }
);

// Reading references back
const widget = await savedObjectsClient.get('my-plugin-widget', widgetId);
const dashboardRef = widget.references.find((ref) => ref.name === 'linked_dashboard');
if (dashboardRef) {
  const linkedDashboard = await savedObjectsClient.get('dashboard', dashboardRef.id);
}
```

**Why references instead of embedded IDs:**
- When objects are imported into a different space, IDs change — references are automatically remapped
- Kibana tracks the dependency graph for import/export ordering
- The management UI shows relationships between objects

---

### Import/Export

Types with `management.importableAndExportable: true` can be exported and imported through the Kibana UI or API.

```typescript
management: {
  importableAndExportable: true,
  icon: 'gear',
  defaultSearchField: 'title',
  getTitle(obj) {
    return obj.attributes.title;
  },
  // Optional: custom URL for "View in app" link in management
  getInAppUrl(obj) {
    return {
      path: `/app/myPlugin#/config/${obj.id}`,
      uiCapabilitiesPath: 'myPlugin.show',
    };
  },
  // Optional: handle import conflicts
  onImport(savedObject) {
    // Return warnings or errors
    return { warnings: [] };
  },
  // Optional: run after all objects are imported
  onExport(savedObject) {
    return savedObject;
  },
},
```

**Server-side export/import APIs (for programmatic use):**

```typescript
// Export
const exportStream = await savedObjects.createExporter(savedObjectsClient).exportByTypes({
  types: [MY_CUSTOM_TYPE],
  hasReference: undefined,
  includeReferencesDeep: true,
});

// Import
const result = await savedObjects.createImporter(savedObjectsClient).import({
  readStream: importStream,
  overwrite: true,
  createNewCopies: false,
});
```

---

### Client-Side Usage (Public)

Access saved objects from the public side via the HTTP client (preferred) or the savedObjects client:

```typescript
// Option 1: Via your plugin's API routes (preferred — routes add validation and business logic)
const response = await http.get('/api/my_plugin/configs');

// Option 2: Direct savedObjects client (simpler but bypasses your route logic)
const result = await core.savedObjects.client.find({
  type: 'my-plugin-config',
  perPage: 100,
  search: 'keyword',
  searchFields: ['title'],
});
```

For most plugins, use **Option 1** — wrap saved object operations in server routes that add validation, authorization, and business logic. Direct client access is fine for simple reads.

---

### Saved Objects Best Practices

1. **Always set `dynamic: false`** in mappings to prevent mapping explosions from arbitrary user data
2. **Use references**, not embedded IDs, for links between saved objects
3. **Write migrations** for every mapping change — even adding a new field needs a migration that provides a default
4. **Make migrations idempotent** — they must produce correct output regardless of how many times they run
5. **Use `namespaceType: 'single'`** by default — only use `multiple` or `agnostic` when you have a clear reason
6. **Test migrations** with fixtures of real documents from previous versions
7. **Hide internal types** — if users shouldn't see or manage the type, set `hidden: true`
8. **Don't over-use saved objects** — high-volume data belongs in plain ES indices, not saved objects
9. **Handle 404s gracefully** — saved objects can be deleted by users via the management UI
10. **Use `created_by` tracking** — store the username from `security.authc.getCurrentUser()` for audit trails

## Embeddables Framework

Embeddables are reusable, stateful components that can be rendered inside Kibana Dashboards and other container contexts. If your plugin produces visualizations or widgets that users should be able to place on dashboards, you need the Embeddables framework.

**When to use Embeddables:**
- Your plugin renders content that belongs on dashboards
- You want users to configure and save widget instances
- Your content needs to react to dashboard-level time range, filters, and queries
- You want to support drilldowns or inter-widget communication

**When NOT to use Embeddables:**
- Your plugin is purely a settings/management page
- Your content is only shown within your plugin's own app
- You just need a standalone React component

---

### Architecture Overview

```
Dashboard (Container Embeddable)
├── Panel 1: Visualization Embeddable
├── Panel 2: Saved Search Embeddable
├── Panel 3: Your Custom Embeddable  ← this is what you build
└── Panel 4: Map Embeddable
```

Key concepts:
- **Embeddable**: A stateful unit of content with typed Input and Output
- **EmbeddableFactory**: Creates embeddable instances, provides metadata for the "Add panel" menu
- **EmbeddableInput**: Configuration that flows from the container (dashboard) to the embeddable — includes `id`, `timeRange`, `filters`, `query`, and your custom fields
- **EmbeddableOutput**: Data the embeddable exposes back to the container
- **Container**: A special embeddable that manages child embeddables (Dashboard is a container)

---

### Input and Output Types

```typescript
// public/embeddable/types.ts
import { EmbeddableInput, EmbeddableOutput } from '@kbn/embeddable-plugin/public';

// Input: what the dashboard/user provides to configure this embeddable
export interface MyWidgetInput extends EmbeddableInput {
  // EmbeddableInput already includes: id, title, timeRange, filters, query,
  // hidePanelTitles, enhancements, disabledActions, searchSessionId

  // Your custom input fields:
  indexPattern: string;
  metricField: string;
  aggregationType: 'avg' | 'sum' | 'min' | 'max' | 'count';
  colorThreshold?: number;
  savedObjectId?: string;
}

// Output: what this embeddable tells the container about its state
export interface MyWidgetOutput extends EmbeddableOutput {
  // EmbeddableOutput already includes: loading, error, editUrl, editApp,
  // defaultTitle, title, editable, savedObjectId

  // Your custom output fields:
  currentValue?: number;
  indexPatternId?: string;
}
```

---

### Classic Embeddable Class (Kibana < 8.8)

```typescript
// public/embeddable/my_widget_embeddable.tsx
import React from 'react';
import ReactDOM from 'react-dom';
import { Subscription } from 'rxjs';
import { Embeddable, IContainer } from '@kbn/embeddable-plugin/public';
import { CoreStart } from '@kbn/core/public';
import { MyWidgetInput, MyWidgetOutput } from './types';
import { MyWidgetComponent } from './my_widget_component';

export const MY_WIDGET_EMBEDDABLE = 'MY_WIDGET_EMBEDDABLE';

export class MyWidgetEmbeddable extends Embeddable<MyWidgetInput, MyWidgetOutput> {
  public readonly type = MY_WIDGET_EMBEDDABLE;
  private node: HTMLElement | null = null;
  private subscription: Subscription | undefined;

  constructor(
    input: MyWidgetInput,
    private readonly services: { core: CoreStart },
    parent?: IContainer
  ) {
    super(input, {}, parent);
  }

  public render(node: HTMLElement): void {
    this.node = node;

    // Subscribe to input changes to re-render
    this.subscription = this.getInput$().subscribe(() => {
      this.renderComponent();
    });

    this.renderComponent();
  }

  private renderComponent(): void {
    if (!this.node) return;

    const input = this.getInput();

    ReactDOM.render(
      <MyWidgetComponent
        indexPattern={input.indexPattern}
        metricField={input.metricField}
        aggregationType={input.aggregationType}
        colorThreshold={input.colorThreshold}
        timeRange={input.timeRange}
        filters={input.filters}
        query={input.query}
        http={this.services.core.http}
        onValueChange={(value) => {
          this.updateOutput({ currentValue: value });
        }}
        onError={(error) => {
          this.updateOutput({ error });
        }}
        onLoading={(loading) => {
          this.updateOutput({ loading });
        }}
      />,
      this.node
    );
  }

  public reload(): void {
    // Called when the dashboard wants to force a refresh
    this.renderComponent();
  }

  public destroy(): void {
    super.destroy();
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.node) {
      ReactDOM.unmountComponentAtNode(this.node);
    }
  }
}
```

---

### Embeddable Factory

```typescript
// public/embeddable/my_widget_factory.ts
import { i18n } from '@kbn/i18n';
import {
  EmbeddableFactoryDefinition,
  EmbeddableFactory,
  IContainer,
} from '@kbn/embeddable-plugin/public';
import { CoreStart } from '@kbn/core/public';
import {
  MyWidgetEmbeddable,
  MY_WIDGET_EMBEDDABLE,
} from './my_widget_embeddable';
import { MyWidgetInput, MyWidgetOutput } from './types';

export type MyWidgetEmbeddableFactory = EmbeddableFactory<
  MyWidgetInput,
  MyWidgetOutput,
  MyWidgetEmbeddable
>;

export class MyWidgetEmbeddableFactoryDefinition
  implements EmbeddableFactoryDefinition<MyWidgetInput, MyWidgetOutput, MyWidgetEmbeddable>
{
  public readonly type = MY_WIDGET_EMBEDDABLE;
  public readonly isContainerType = false;

  // Grouping controls where this appears in the "Add panel" menu
  public readonly grouping = [
    {
      id: 'my_plugin',
      getDisplayName: () => 'My Plugin',
      getIconType: () => 'logoElastic',
    },
  ];

  constructor(private getCore: () => CoreStart) {}

  public getDisplayName(): string {
    return i18n.translate('myPlugin.embeddable.widget.displayName', {
      defaultMessage: 'My Widget',
    });
  }

  public getIconType(): string {
    return 'visMetric';
  }

  public getDescription(): string {
    return i18n.translate('myPlugin.embeddable.widget.description', {
      defaultMessage: 'Displays a custom metric from your data.',
    });
  }

  public async isEditable(): Promise<boolean> {
    return true;
  }

  public canCreateNew(): boolean {
    return true;
  }

  // Called when user clicks "Add panel" > "My Widget" on the dashboard
  public async getExplicitInput(): Promise<Partial<MyWidgetInput>> {
    // Option 1: Return defaults (no wizard)
    return {
      indexPattern: 'logs-*',
      metricField: 'response_time',
      aggregationType: 'avg',
    };

    // Option 2: Show a modal and let user configure
    // return new Promise((resolve) => {
    //   const modal = this.getCore().overlays.openModal(
    //     toMountPoint(<ConfigWizard onSave={(config) => {
    //       modal.close();
    //       resolve(config);
    //     }} />)
    //   );
    // });
  }

  public async create(
    input: MyWidgetInput,
    parent?: IContainer
  ): Promise<MyWidgetEmbeddable> {
    return new MyWidgetEmbeddable(input, { core: this.getCore() }, parent);
  }
}
```

---

### Register the Factory

```typescript
// public/plugin.ts
import { CoreSetup, CoreStart, Plugin } from '@kbn/core/public';
import { EmbeddableSetup, EmbeddableStart } from '@kbn/embeddable-plugin/public';
import { MyWidgetEmbeddableFactoryDefinition } from './embeddable/my_widget_factory';
import { MY_WIDGET_EMBEDDABLE } from './embeddable/my_widget_embeddable';

interface MyPluginSetupDeps {
  embeddable: EmbeddableSetup;
}

interface MyPluginStartDeps {
  embeddable: EmbeddableStart;
}

export class MyPlugin implements Plugin<void, void, MyPluginSetupDeps, MyPluginStartDeps> {
  private coreStart: CoreStart | undefined;

  public setup(core: CoreSetup<MyPluginStartDeps>, { embeddable }: MyPluginSetupDeps): void {
    // Register the factory during setup
    const factory = new MyWidgetEmbeddableFactoryDefinition(
      () => this.coreStart!
    );
    embeddable.registerEmbeddableFactory(factory.type, factory);
  }

  public start(core: CoreStart): void {
    this.coreStart = core;
  }
}
```

Don't forget to add `embeddable` to your `kibana.jsonc`:

```jsonc
{
  "plugin": {
    "requiredPlugins": ["embeddable"],
    "requiredBundles": ["embeddable"]
  }
}
```

---

### The React Component

```typescript
// public/embeddable/my_widget_component.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  EuiPanel,
  EuiText,
  EuiLoadingSpinner,
  EuiEmptyPrompt,
  EuiCallOut,
} from '@elastic/eui';
import { HttpSetup } from '@kbn/core/public';
import { TimeRange, Filter, Query } from '@kbn/es-query';

interface MyWidgetComponentProps {
  indexPattern: string;
  metricField: string;
  aggregationType: string;
  colorThreshold?: number;
  timeRange?: TimeRange;
  filters?: Filter[];
  query?: Query;
  http: HttpSetup;
  onValueChange: (value: number) => void;
  onError: (error: Error) => void;
  onLoading: (loading: boolean) => void;
}

export const MyWidgetComponent: React.FC<MyWidgetComponentProps> = ({
  indexPattern,
  metricField,
  aggregationType,
  colorThreshold,
  timeRange,
  filters,
  query,
  http,
  onValueChange,
  onError,
  onLoading,
}) => {
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Memoize the query params to avoid unnecessary re-fetches
  const queryParams = useMemo(
    () => ({
      indexPattern,
      metricField,
      aggregationType,
      timeRange: timeRange ? JSON.stringify(timeRange) : undefined,
      filters: filters ? JSON.stringify(filters) : undefined,
      query: query ? JSON.stringify(query) : undefined,
    }),
    [indexPattern, metricField, aggregationType, timeRange, filters, query]
  );

  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        onLoading(true);

        const result = await http.get('/api/my_plugin/metric', {
          query: queryParams,
          signal: abortController.signal,
        });

        setValue(result.value);
        onValueChange(result.value);
        setError(null);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err);
          onError(err);
        }
      } finally {
        setLoading(false);
        onLoading(false);
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, [queryParams, http, onValueChange, onError, onLoading]);

  if (loading) {
    return (
      <EuiPanel hasShadow={false} style={{ textAlign: 'center', padding: 40 }}>
        <EuiLoadingSpinner size="xl" />
      </EuiPanel>
    );
  }

  if (error) {
    return (
      <EuiCallOut title="Error loading widget" color="danger" iconType="alert">
        {error.message}
      </EuiCallOut>
    );
  }

  if (value === null) {
    return (
      <EuiEmptyPrompt
        iconType="visMetric"
        title={<h3>No data</h3>}
        body={<p>No data found for the selected time range and filters.</p>}
      />
    );
  }

  const color = colorThreshold && value > colorThreshold ? 'danger' : 'success';

  return (
    <EuiPanel hasShadow={false} style={{ textAlign: 'center', padding: 20 }}>
      <EuiText size="s" color="subdued">
        {aggregationType.toUpperCase()} of {metricField}
      </EuiText>
      <EuiText color={color} style={{ fontSize: 48, fontWeight: 700 }}>
        {value.toLocaleString()}
      </EuiText>
    </EuiPanel>
  );
};
```

---

### React Embeddable Pattern (Kibana 8.8+)

Newer Kibana versions introduce a simpler React-first embeddable pattern:

```typescript
// public/embeddable/my_react_embeddable.tsx
import React, { useState, useEffect } from 'react';
import { ReactEmbeddableFactory } from '@kbn/embeddable-plugin/public';
import { EuiPanel, EuiText, EuiLoadingSpinner } from '@elastic/eui';

export const MY_REACT_EMBEDDABLE_TYPE = 'MY_REACT_WIDGET';

interface MyReactWidgetState {
  indexPattern: string;
  metricField: string;
  aggregationType: string;
}

export const myReactWidgetFactory: ReactEmbeddableFactory<MyReactWidgetState> = {
  type: MY_REACT_EMBEDDABLE_TYPE,

  deserializeState: (state) => {
    // Transform persisted state into runtime state
    return state.rawState as MyReactWidgetState;
  },

  buildEmbeddable: async (state, buildApi, uuid, parentApi) => {
    const api = buildApi(
      {
        serializeState: () => ({
          rawState: state,
        }),
      },
      {
        // Comparators for detecting state changes
        indexPattern: [() => state.indexPattern, (val: string) => { state.indexPattern = val; }],
        metricField: [() => state.metricField, (val: string) => { state.metricField = val; }],
      }
    );

    return {
      api,
      Component: () => {
        const [value, setValue] = useState<number | null>(null);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
          // Fetch data using state.indexPattern, state.metricField, etc.
          setLoading(true);
          fetch(`/api/my_plugin/metric?index=${state.indexPattern}&field=${state.metricField}`)
            .then((res) => res.json())
            .then((data) => {
              setValue(data.value);
              setLoading(false);
            });
        }, []);

        if (loading) return <EuiLoadingSpinner />;

        return (
          <EuiPanel hasShadow={false} style={{ textAlign: 'center' }}>
            <EuiText style={{ fontSize: 48 }}>{value}</EuiText>
          </EuiPanel>
        );
      },
    };
  },
};
```

Register with:
```typescript
embeddable.registerReactEmbeddableFactory(MY_REACT_EMBEDDABLE_TYPE, async () => myReactWidgetFactory);
```

---

### Embeddable with Saved Object

If your embeddable's configuration is persisted as a saved object:

```typescript
// In the factory
public savedObjectMetaData = {
  name: i18n.translate('myPlugin.embeddable.savedObject.name', {
    defaultMessage: 'My Widget',
  }),
  type: 'my-plugin-widget-config',   // Your saved object type
  getIconForSavedObject: () => 'visMetric',
};

public async createFromSavedObject(
  savedObjectId: string,
  input: Partial<MyWidgetInput>,
  parent?: IContainer
): Promise<MyWidgetEmbeddable> {
  const savedObject = await this.getCore().savedObjects.client.get(
    'my-plugin-widget-config',
    savedObjectId
  );

  return new MyWidgetEmbeddable(
    {
      ...input,
      ...savedObject.attributes,
      savedObjectId,
    } as MyWidgetInput,
    { core: this.getCore() },
    parent
  );
}
```

This enables the Dashboard's "Add from library" flow — users can select from previously saved widget configurations.

---

### Embeddable Best Practices

1. **Always implement `destroy()`** — unmount React, unsubscribe observables, cancel pending requests
2. **React to input changes** — subscribe to `getInput$()` and re-render when `timeRange`, `filters`, or `query` change
3. **Use `AbortController`** — cancel in-flight requests when input changes or the embeddable is destroyed
4. **Handle all states** — loading, error, empty, and success
5. **Minimize re-renders** — use `distinctUntilChanged()` on input subscriptions, memoize derived values
6. **Register during `setup()`** — factories must exist before dashboards load
7. **Support `reload()`** — dashboards call this when the user hits refresh
8. **Use EUI** — embeddables inherit the dashboard's theme, EUI ensures consistency
9. **Keep embeddables lightweight** — heavy logic should live in server routes, not in the embeddable component
10. **Test with the Dashboard** — embed your component in a real dashboard to verify time range, filters, and query propagation work correctly

## UI Actions & Triggers

UI Actions is Kibana's inter-plugin communication system. It connects user interactions (clicks, selections, context menus) to executable behaviors — across plugin boundaries. Dashboard panels use it for context menus, drilldowns, click handlers, and panel badges.

**When to use UI Actions:**
- Adding items to dashboard panel context menus ("..." menu)
- Reacting to user clicks on visualizations (value clicks, range selections)
- Creating drilldowns between dashboard panels and your plugin
- Emitting custom events from your components that other plugins can react to
- Adding badges or notifications to dashboard panel headers

---

### Core Concepts

```
Trigger (event)  →  Action (handler)
    ↑                     ↑
  Fired by             Registered by
  any plugin           any plugin

Example:
  CONTEXT_MENU_TRIGGER  →  OpenInMyPluginAction
  VALUE_CLICK_TRIGGER   →  FilterByValueAction
  MY_CUSTOM_TRIGGER     →  ShowDetailFlyoutAction
```

A **Trigger** is an event type (e.g. "user clicked a value"). An **Action** is a handler (e.g. "open a flyout"). Multiple actions can attach to one trigger. Multiple triggers can fire one action.

---

### Defining a Custom Trigger

```typescript
// public/triggers/my_row_click_trigger.ts
import { Trigger } from '@kbn/ui-actions-plugin/public';

export const MY_PLUGIN_ROW_CLICK_TRIGGER = 'MY_PLUGIN_ROW_CLICK_TRIGGER';

export const myRowClickTrigger: Trigger = {
  id: MY_PLUGIN_ROW_CLICK_TRIGGER,
  title: 'My Plugin Row Click',
  description: 'Fires when a user clicks a row in My Plugin tables.',
};
```

Register in setup:

```typescript
// public/plugin.ts
import { myRowClickTrigger, MY_PLUGIN_ROW_CLICK_TRIGGER } from './triggers/my_row_click_trigger';

public setup(core: CoreSetup, { uiActions }: MyPluginSetupDeps) {
  uiActions.registerTrigger(myRowClickTrigger);
}
```

Fire the trigger from your component:

```typescript
// In a React component
const { uiActions } = useKibana().services;

const handleRowClick = (item: MyItem) => {
  uiActions.getTrigger(MY_PLUGIN_ROW_CLICK_TRIGGER).exec({
    itemId: item.id,
    itemType: item.type,
    indexPattern: item.indexPattern,
  });
};
```

---

### Creating an Action

```typescript
// public/actions/open_detail_action.ts
import { Action, createAction } from '@kbn/ui-actions-plugin/public';
import { CoreStart } from '@kbn/core/public';

export const OPEN_DETAIL_ACTION = 'MY_PLUGIN_OPEN_DETAIL_ACTION';

interface OpenDetailContext {
  itemId: string;
  itemType: string;
}

export function createOpenDetailAction(getCore: () => CoreStart): Action<OpenDetailContext> {
  return createAction<OpenDetailContext>({
    id: OPEN_DETAIL_ACTION,
    type: OPEN_DETAIL_ACTION,
    getDisplayName: () => 'Open in My Plugin',
    getIconType: () => 'inspect',

    // Only show when context has the right shape
    isCompatible: async (context: OpenDetailContext) => {
      return Boolean(context.itemId && context.itemType === 'config');
    },

    // What happens when the action executes
    execute: async (context: OpenDetailContext) => {
      const core = getCore();
      core.application.navigateToApp('myPlugin', {
        path: `/detail/${context.itemId}`,
      });
    },

    // Optional: enables "open in new tab"
    getHref: async (context: OpenDetailContext) => {
      return `/app/myPlugin#/detail/${context.itemId}`;
    },
  });
}
```

---

### Action Class Pattern (for complex actions)

```typescript
// public/actions/show_flyout_action.tsx
import React from 'react';
import { Action } from '@kbn/ui-actions-plugin/public';
import { CoreStart } from '@kbn/core/public';
import { toMountPoint } from '@kbn/react-kibana-mount';

export const SHOW_FLYOUT_ACTION = 'MY_PLUGIN_SHOW_FLYOUT_ACTION';

interface FlyoutContext {
  embeddable?: { type: string };
  data?: { id: string; title: string };
}

export class ShowFlyoutAction implements Action<FlyoutContext> {
  public readonly id = SHOW_FLYOUT_ACTION;
  public readonly type = SHOW_FLYOUT_ACTION;
  public readonly order = 100; // Higher = appears earlier in menus

  constructor(private readonly getCore: () => CoreStart) {}

  public getDisplayName(): string {
    return 'Show details';
  }

  public getIconType(): string {
    return 'eye';
  }

  public async isCompatible(context: FlyoutContext): Promise<boolean> {
    // Only show for specific embeddable types or data conditions
    return context.data?.id !== undefined;
  }

  public async execute(context: FlyoutContext): Promise<void> {
    const core = this.getCore();

    const flyoutSession = core.overlays.openFlyout(
      toMountPoint(
        <DetailFlyout
          itemId={context.data!.id}
          title={context.data!.title}
          http={core.http}
          onClose={() => flyoutSession.close()}
        />
      ),
      {
        size: 'm',
        'data-test-subj': 'myPluginDetailFlyout',
        ownFocus: true,
      }
    );
  }
}
```

---

### Attaching Actions to Triggers

```typescript
// public/plugin.ts
import { UiActionsSetup } from '@kbn/ui-actions-plugin/public';
import { CONTEXT_MENU_TRIGGER, VALUE_CLICK_TRIGGER } from '@kbn/ui-actions-plugin/public';
import { createOpenDetailAction, OPEN_DETAIL_ACTION } from './actions/open_detail_action';
import { ShowFlyoutAction, SHOW_FLYOUT_ACTION } from './actions/show_flyout_action';
import { myRowClickTrigger, MY_PLUGIN_ROW_CLICK_TRIGGER } from './triggers/my_row_click_trigger';

export class MyPlugin {
  private coreStart: CoreStart | undefined;

  public setup(core: CoreSetup, { uiActions }: { uiActions: UiActionsSetup }) {
    // Register custom trigger
    uiActions.registerTrigger(myRowClickTrigger);

    // Register actions
    const openDetailAction = createOpenDetailAction(() => this.coreStart!);
    const showFlyoutAction = new ShowFlyoutAction(() => this.coreStart!);

    uiActions.registerAction(openDetailAction);
    uiActions.registerAction(showFlyoutAction);

    // Attach actions to triggers
    // "Open in My Plugin" appears in dashboard panel context menus
    uiActions.attachAction(CONTEXT_MENU_TRIGGER, OPEN_DETAIL_ACTION);

    // Show flyout when clicking a value in a visualization
    uiActions.attachAction(VALUE_CLICK_TRIGGER, SHOW_FLYOUT_ACTION);

    // Both actions available on custom row click
    uiActions.attachAction(MY_PLUGIN_ROW_CLICK_TRIGGER, OPEN_DETAIL_ACTION);
    uiActions.attachAction(MY_PLUGIN_ROW_CLICK_TRIGGER, SHOW_FLYOUT_ACTION);
  }

  public start(core: CoreStart) {
    this.coreStart = core;
  }
}
```

---

### Context Menu Action on Dashboard Panels

The most common use case — adding an item to the "..." menu on dashboard panels:

```typescript
import { CONTEXT_MENU_TRIGGER } from '@kbn/ui-actions-plugin/public';
import { isFilterableEmbeddable } from '@kbn/embeddable-plugin/public';

const analyzeAction = createAction({
  id: 'MY_PLUGIN_ANALYZE_PANEL',
  type: 'MY_PLUGIN_ANALYZE_PANEL',
  getDisplayName: () => 'Analyze in My Plugin',
  getIconType: () => 'inspect',
  order: 50,

  isCompatible: async ({ embeddable }) => {
    // Only show for visualization panels, not saved searches
    return embeddable?.type === 'visualization' || embeddable?.type === 'lens';
  },

  execute: async ({ embeddable }) => {
    const input = embeddable.getInput();
    const filters = input.filters || [];
    const timeRange = input.timeRange;

    // Navigate to your plugin with the panel's context
    core.application.navigateToApp('myPlugin', {
      path: `/analyze?filters=${encodeURIComponent(JSON.stringify(filters))}&timeRange=${encodeURIComponent(JSON.stringify(timeRange))}`,
    });
  },
});

uiActions.registerAction(analyzeAction);
uiActions.attachAction(CONTEXT_MENU_TRIGGER, analyzeAction.id);
```

---

### Value Click to Filter

React to clicks on visualization values:

```typescript
import { VALUE_CLICK_TRIGGER } from '@kbn/ui-actions-plugin/public';

const filterByValueAction = createAction({
  id: 'MY_PLUGIN_FILTER_BY_VALUE',
  type: 'MY_PLUGIN_FILTER_BY_VALUE',
  getDisplayName: () => 'Filter by this value',
  getIconType: () => 'filter',

  isCompatible: async (context) => {
    return Boolean(context.data?.data?.length);
  },

  execute: async (context) => {
    const { data } = context;
    // data.data contains the click point information
    // Use data plugin to create filters from the click
    const filters = await dataPlugin.actions.createFiltersFromValueClickAction({
      data: data.data,
    });

    // Apply filters to the dashboard
    dataPlugin.query.filterManager.addFilters(filters);
  },
});
```

---

### UI Actions Best Practices

1. **Always implement `isCompatible()`** — actions that return `true` for everything clutter every context menu
2. **Use `order`** to control menu position — higher values appear first
3. **Actions are singletons** — one instance handles all invocations, don't store per-invocation state on the instance
4. **Use `getHref()`** for navigating actions — enables right-click "open in new tab"
5. **Clean up overlays** — if your action opens a flyout/modal, provide a way to close it
6. **Keep `execute()` fast** — show loading indicators for async work
7. **Custom triggers are powerful** — they let other plugins extend your UI without modifying your code
8. **Test with real dashboards** — context menu visibility depends on the trigger context and `isCompatible()` logic
9. **Prefix IDs** with your plugin name to avoid collisions
10. **Don't use UI Actions for simple in-component state** — they're for cross-plugin/cross-component communication

## Expressions Framework

Kibana's Expressions framework is a pipeline-based execution engine that powers Canvas, Lens, and Dashboard visualizations. Expression functions are composable, stateless transformations that chain together: `essql 'SELECT * FROM logs' | mapColumn name='status_label' expression={...} | render type='my_chart'`.

**When to use Expressions:**
- Creating custom visualizations for Canvas or Lens
- Building reusable data transformations
- Rendering custom chart types on dashboards
- Creating server-side data processing functions that can also run in the browser

**When NOT to use Expressions:**
- Building standard CRUD UIs (use routes + React components)
- One-off data fetching (use the HTTP client or ES client directly)
- Complex stateful workflows (expressions are stateless and functional)

---

### Expression Function

An expression function takes an input, applies arguments, and produces an output:

```typescript
// common/expressions/my_metric.ts
import { ExpressionFunctionDefinition } from '@kbn/expressions-plugin/common';
import { Datatable } from '@kbn/expressions-plugin/common';

interface MyMetricArguments {
  column: string;
  operation: 'avg' | 'sum' | 'min' | 'max' | 'count';
  decimals: number;
}

interface MyMetricResult {
  type: 'my_metric_result';
  value: number;
  label: string;
  operation: string;
}

export const myMetricFunction: ExpressionFunctionDefinition<
  'my_metric',         // Function name
  Datatable,           // Input type
  MyMetricArguments,   // Arguments
  MyMetricResult       // Output type
> = {
  name: 'my_metric',
  type: 'my_metric_result',
  inputTypes: ['datatable'],
  help: 'Calculates a metric from a datatable column.',

  args: {
    column: {
      types: ['string'],
      help: 'Column name to aggregate.',
      required: true,
    },
    operation: {
      types: ['string'],
      help: 'Aggregation operation.',
      default: 'avg',
      options: ['avg', 'sum', 'min', 'max', 'count'],
    },
    decimals: {
      types: ['number'],
      help: 'Decimal places in the result.',
      default: 2,
    },
  },

  fn(input: Datatable, args: MyMetricArguments): MyMetricResult {
    const values = input.rows
      .map((row) => row[args.column])
      .filter((v): v is number => typeof v === 'number');

    let value: number;
    switch (args.operation) {
      case 'sum':
        value = values.reduce((a, b) => a + b, 0);
        break;
      case 'min':
        value = Math.min(...values);
        break;
      case 'max':
        value = Math.max(...values);
        break;
      case 'count':
        value = values.length;
        break;
      case 'avg':
      default:
        value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        break;
    }

    return {
      type: 'my_metric_result',
      value: Number(value.toFixed(args.decimals)),
      label: `${args.operation}(${args.column})`,
      operation: args.operation,
    };
  },
};
```

Register the function:

```typescript
// In server/plugin.ts AND/OR public/plugin.ts
import { myMetricFunction } from '../common/expressions/my_metric';

public setup(core: CoreSetup, { expressions }: MyPluginSetupDeps) {
  expressions.registerFunction(myMetricFunction);
}
```

Functions defined in `common/` can be registered on both server and browser — the server execution is used for Canvas server-side rendering and reporting.

---

### Expression Renderer

Renderers take a render config and mount a visualization into a DOM node:

```typescript
// public/expression_renderers/my_chart_renderer.tsx
import React from 'react';
import ReactDOM from 'react-dom';
import { ExpressionRenderDefinition } from '@kbn/expressions-plugin/common';
import { MyChartComponent } from './my_chart_component';

interface MyChartConfig {
  type: 'my_chart_config';
  data: Array<{ label: string; value: number }>;
  colorScheme: string;
  showLegend: boolean;
}

export const myChartRenderer: ExpressionRenderDefinition<MyChartConfig> = {
  name: 'my_chart',
  displayName: 'My Chart',
  help: 'Renders a custom chart visualization.',
  reuseDomNode: true, // Reuse DOM node on re-render (better performance)

  render(domNode: HTMLElement, config: MyChartConfig, handlers) {
    // handlers.done() MUST be called when rendering is complete
    // handlers.onDestroy() registers cleanup logic

    handlers.onDestroy(() => {
      ReactDOM.unmountComponentAtNode(domNode);
    });

    ReactDOM.render(
      <MyChartComponent
        data={config.data}
        colorScheme={config.colorScheme}
        showLegend={config.showLegend}
        onRenderComplete={() => handlers.done()}
      />,
      domNode
    );
  },
};
```

Register:

```typescript
// public/plugin.ts — renderers are browser-only
public setup(core: CoreSetup, { expressions }: MyPluginSetupDeps) {
  expressions.registerRenderer(myChartRenderer);
}
```

---

### Render Function (Bridge Between Data and Renderer)

A render function converts processed data into a render config that a renderer can display:

```typescript
// common/expressions/my_chart_render.ts
import { ExpressionFunctionDefinition } from '@kbn/expressions-plugin/common';

interface MyChartRenderArgs {
  colorScheme: string;
  showLegend: boolean;
}

interface MyChartRenderConfig {
  type: 'render';
  as: 'my_chart';  // Must match the renderer name
  value: {
    type: 'my_chart_config';
    data: Array<{ label: string; value: number }>;
    colorScheme: string;
    showLegend: boolean;
  };
}

export const myChartRenderFunction: ExpressionFunctionDefinition<
  'my_chart_render',
  { type: 'my_metric_result'; value: number; label: string } | any,
  MyChartRenderArgs,
  MyChartRenderConfig
> = {
  name: 'my_chart_render',
  type: 'render',
  inputTypes: ['my_metric_result', 'datatable'],
  help: 'Prepares data for the my_chart renderer.',

  args: {
    colorScheme: {
      types: ['string'],
      help: 'Color scheme name.',
      default: 'default',
    },
    showLegend: {
      types: ['boolean'],
      help: 'Whether to show the legend.',
      default: true,
    },
  },

  fn(input, args): MyChartRenderConfig {
    // Transform input into the renderer's expected config
    let data: Array<{ label: string; value: number }>;

    if (input.type === 'my_metric_result') {
      data = [{ label: input.label, value: input.value }];
    } else {
      // Assume datatable
      data = input.rows.map((row: any) => ({
        label: String(row.label || ''),
        value: Number(row.value || 0),
      }));
    }

    return {
      type: 'render',
      as: 'my_chart',  // References the renderer name
      value: {
        type: 'my_chart_config',
        data,
        colorScheme: args.colorScheme,
        showLegend: args.showLegend,
      },
    };
  },
};
```

---

### Custom Expression Type

If your functions use a custom data shape, register it as an expression type:

```typescript
// common/expressions/my_metric_result_type.ts
import { ExpressionTypeDefinition } from '@kbn/expressions-plugin/common';

export const myMetricResultType: ExpressionTypeDefinition<
  'my_metric_result',
  { type: 'my_metric_result'; value: number; label: string; operation: string }
> = {
  name: 'my_metric_result',
  validate: (value) => {
    if (typeof value.value !== 'number') {
      throw new Error('my_metric_result must have a numeric value');
    }
  },
  // Convert from other types
  from: {
    number: (value: number) => ({
      type: 'my_metric_result' as const,
      value,
      label: 'value',
      operation: 'raw',
    }),
  },
  // Convert to other types
  to: {
    number: (result) => result.value,
    datatable: (result) => ({
      type: 'datatable' as const,
      columns: [
        { id: 'label', name: 'Label', meta: { type: 'string' } },
        { id: 'value', name: 'Value', meta: { type: 'number' } },
      ],
      rows: [{ label: result.label, value: result.value }],
    }),
  },
};
```

Register:

```typescript
expressions.registerType(myMetricResultType);
```

---

### Datatable Reference

The `datatable` type is the standard interchange format — most functions consume and produce datatables:

```typescript
interface Datatable {
  type: 'datatable';
  columns: DatatableColumn[];
  rows: DatatableRow[];
}

interface DatatableColumn {
  id: string;         // Unique column identifier
  name: string;       // Display name
  meta: {
    type: 'number' | 'string' | 'boolean' | 'date' | 'null' | 'unknown';
    field?: string;          // Source ES field name
    index?: string;          // Source index
    params?: {               // Formatter parameters
      id?: string;           // Formatter ID (e.g. 'number', 'bytes', 'date')
      params?: Record<string, unknown>;
    };
    source?: string;         // Which expression produced this column
    sourceParams?: Record<string, unknown>;
  };
}

type DatatableRow = Record<string, unknown>;
```

Common operations on datatables:

```typescript
// Filter rows
const filtered = {
  ...input,
  rows: input.rows.filter((row) => row.status === 'active'),
};

// Add a column
const withColumn = {
  ...input,
  columns: [...input.columns, { id: 'new_col', name: 'New Column', meta: { type: 'string' } }],
  rows: input.rows.map((row) => ({
    ...row,
    new_col: computeValue(row),
  })),
};

// Sort rows
const sorted = {
  ...input,
  rows: [...input.rows].sort((a, b) =>
    (a[sortField] as number) - (b[sortField] as number)
  ),
};
```

---

### Using Expressions in Canvas

Once registered, your functions and renderers can be used in Canvas expressions:

```
essql "SELECT category, AVG(response_time) as avg_time FROM logs GROUP BY category"
| my_metric column="avg_time" operation="max"
| my_chart_render colorScheme="warm" showLegend=true
```

Or via the expression editor in Canvas workpads.

---

### Executing Expressions Programmatically

Run expressions from your plugin code:

```typescript
// In a React component
const { expressions } = useKibana().services;

const result = await expressions
  .execute('my_metric', null, {
    column: 'response_time',
    operation: 'avg',
  })
  .getData();
```

Or using the expression loader for rendering:

```typescript
import { ReactExpressionRenderer } from '@kbn/expressions-plugin/public';

<ReactExpressionRenderer
  expression='essql "SELECT * FROM logs" | my_metric column="value" | my_chart_render'
  onData$={(data) => console.log('Expression result:', data)}
  onRenderError={(error) => console.error('Render error:', error)}
/>
```

---

### Expressions Best Practices

1. **Functions must be pure** — same input + args = same output, no side effects
2. **Place functions in `common/`** — they can then run on both server (reporting, Canvas server rendering) and browser
3. **Renderers are browser-only** — they touch the DOM
4. **Always call `handlers.done()`** in renderers — Canvas and Dashboard wait for this signal to know rendering is complete
5. **Use `reuseDomNode: true`** on renderers that update frequently — avoids expensive DOM recreation
6. **Register cleanup via `handlers.onDestroy()`** — unmount React, cancel animations, remove listeners
7. **Use the `datatable` type** for data interchange — it's the standard and works with all built-in functions
8. **Keep functions focused** — one function = one transformation, chain them together
9. **Handle `null` input** — some pipeline positions may produce null
10. **Test functions independently** — they're pure functions, test with unit tests and fixture data

## State Management

Kibana has multiple state management layers that plugins can use. The right choice depends on where the state lives, how long it persists, and whether it needs to be shareable via URL.

**State lifecycle in Kibana:**
- **URL state** — survives page refresh, shareable via link (time range, filters, query)
- **Session state** — survives in-app navigation, lost on page refresh (expanded rows, scroll position)
- **App state** — plugin-specific state in the URL hash (selected tab, view mode)
- **Global state** — shared across plugins in the URL (time range, refresh interval, filters)
- **Saved object state** — persisted to Elasticsearch, survives everything (dashboard layouts, saved searches)

---

### URL State Sync (kbn-state-sync)

Kibana's `@kbn/kibana-utils-plugin` provides utilities to sync application state with the URL. This is how dashboards preserve filters, time range, and panel layout in the URL.

```typescript
// public/state/use_url_state_sync.ts
import {
  createStateContainer,
  syncState,
  createKbnUrlStateStorage,
  IKbnUrlStateStorage,
} from '@kbn/kibana-utils-plugin/public';
import { CoreStart } from '@kbn/core/public';
import { History } from 'history';

interface MyAppState {
  selectedTab: string;
  viewMode: 'table' | 'grid' | 'detail';
  sortField: string;
  sortDirection: 'asc' | 'desc';
  pageIndex: number;
}

const defaultState: MyAppState = {
  selectedTab: 'overview',
  viewMode: 'table',
  sortField: 'updated_at',
  sortDirection: 'desc',
  pageIndex: 0,
};

export function setupUrlStateSync(history: History) {
  // 1. Create a state container (observable store)
  const stateContainer = createStateContainer<MyAppState>(defaultState);

  // 2. Create URL storage that reads/writes the URL hash
  const kbnUrlStateStorage = createKbnUrlStateStorage({
    useHash: false,        // Use query params (readable) vs hash (compact)
    history,
  });

  // 3. Sync the state container ↔ URL
  const { start, stop } = syncState({
    storageKey: '_a',       // URL key: ?_a=(selectedTab:overview,viewMode:table,...)
    stateContainer: {
      get: () => stateContainer.get(),
      set: (state) => stateContainer.set(state),
      state$: stateContainer.state$,
    },
    stateStorage: kbnUrlStateStorage,
  });

  // 4. Start syncing — reads initial state from URL if present
  start();

  // 5. If URL had no state, push defaults to URL
  if (!kbnUrlStateStorage.get('_a')) {
    kbnUrlStateStorage.set('_a', defaultState);
  }

  return {
    stateContainer,
    stop,  // Call this in your app's unmount function
  };
}
```

Use in a React component:

```tsx
// public/app.tsx
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { setupUrlStateSync } from './state/use_url_state_sync';

export const MyApp: React.FC = () => {
  const history = useHistory();
  const [appState, setAppState] = useState(null);

  useEffect(() => {
    const { stateContainer, stop } = setupUrlStateSync(history);

    // Subscribe to state changes
    const sub = stateContainer.state$.subscribe((state) => {
      setAppState({ ...state });
    });

    // Initial state
    setAppState(stateContainer.get());

    return () => {
      sub.unsubscribe();
      stop();
    };
  }, [history]);

  if (!appState) return null;

  const handleTabChange = (tab: string) => {
    stateContainer.set({ ...stateContainer.get(), selectedTab: tab });
  };

  // URL automatically updates when stateContainer changes
  return <MyContent state={appState} onTabChange={handleTabChange} />;
};
```

---

### Global State (Time Range, Filters, Query)

Dashboard-level state (time range, filters, refresh interval) is managed by the `data` plugin. Access it through the query service:

```typescript
// Reading global state
const { data } = useKibana().services;

// Time range
const timeRange = data.query.timefilter.timefilter.getTime();
// { from: 'now-15m', to: 'now' }

// Filters
const filters = data.query.filterManager.getFilters();

// Query (KQL or Lucene)
const query = data.query.queryString.getQuery();
// { language: 'kuery', query: 'status: active' }

// Refresh interval
const refreshInterval = data.query.timefilter.timefilter.getRefreshInterval();
// { pause: false, value: 5000 }
```

```typescript
// Subscribing to global state changes
useEffect(() => {
  const timeSub = data.query.timefilter.timefilter.getTimeUpdate$().subscribe(() => {
    const newTimeRange = data.query.timefilter.timefilter.getTime();
    fetchData(newTimeRange);
  });

  const filterSub = data.query.filterManager.getUpdates$().subscribe(() => {
    const newFilters = data.query.filterManager.getFilters();
    fetchData(undefined, newFilters);
  });

  return () => {
    timeSub.unsubscribe();
    filterSub.unsubscribe();
  };
}, [data.query]);
```

```typescript
// Writing global state
data.query.timefilter.timefilter.setTime({ from: 'now-1h', to: 'now' });
data.query.filterManager.addFilters([{
  meta: { alias: null, disabled: false, negate: false },
  query: { match_phrase: { status: 'error' } },
}]);
data.query.queryString.setQuery({ language: 'kuery', query: 'host.name: "web-01"' });
```

---

### State Containers (createStateContainer)

State containers are lightweight observable stores. Use them for plugin-internal state that doesn't need URL sync:

```typescript
import { createStateContainer } from '@kbn/kibana-utils-plugin/public';

interface PluginState {
  isLoading: boolean;
  selectedItems: string[];
  expandedRowId: string | null;
  sidebarOpen: boolean;
}

const initialState: PluginState = {
  isLoading: false,
  selectedItems: [],
  expandedRowId: null,
  sidebarOpen: true,
};

// Create with transitions (named state mutations)
const container = createStateContainer(
  initialState,
  {
    setLoading: (state) => (isLoading: boolean) => ({ ...state, isLoading }),
    toggleSidebar: (state) => () => ({ ...state, sidebarOpen: !state.sidebarOpen }),
    selectItem: (state) => (id: string) => ({
      ...state,
      selectedItems: state.selectedItems.includes(id)
        ? state.selectedItems.filter((i) => i !== id)
        : [...state.selectedItems, id],
    }),
    expandRow: (state) => (id: string | null) => ({ ...state, expandedRowId: id }),
    clearSelection: (state) => () => ({ ...state, selectedItems: [] }),
  }
);

// Usage
container.transitions.setLoading(true);
container.transitions.selectItem('item-1');
container.transitions.toggleSidebar();

// Subscribe
container.state$.subscribe((state) => {
  console.log('State changed:', state);
});

// Get current value
const current = container.get();
```

---

### React Hooks for State

Custom hook for subscribing to a state container:

```typescript
// public/hooks/use_app_state.ts
import { useState, useEffect, useRef } from 'react';
import { Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

// Subscribe to the full state
export function useObservable<T>(observable$: Observable<T>, initialValue: T): T {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const sub = observable$.subscribe(setValue);
    return () => sub.unsubscribe();
  }, [observable$]);

  return value;
}

// Subscribe to a slice of state (avoids re-renders when unrelated state changes)
export function useStateSlice<T, R>(
  observable$: Observable<T>,
  selector: (state: T) => R,
  initialValue: R
): R {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const sub = observable$.pipe(
      map(selector),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    ).subscribe(setValue);

    return () => sub.unsubscribe();
  }, [observable$, selector]);

  return value;
}
```

Usage:

```tsx
const MyComponent: React.FC = () => {
  const isLoading = useStateSlice(
    container.state$,
    (state) => state.isLoading,
    false
  );

  const selectedItems = useStateSlice(
    container.state$,
    (state) => state.selectedItems,
    []
  );

  // Only re-renders when isLoading or selectedItems actually change
};
```

---

### Session Storage

For state that should survive in-app navigation but not page refresh:

```typescript
import { createSessionStorageStateStorage } from '@kbn/kibana-utils-plugin/public';

const sessionStorage = createSessionStorageStateStorage();

// Store state
sessionStorage.set('myPlugin:expandedRows', expandedRowIds);

// Retrieve state
const restored = sessionStorage.get<string[]>('myPlugin:expandedRows');
```

Use session storage for: expanded accordion sections, scroll positions, selected tab indices, temporary UI preferences.

---

### State Management Best Practices

1. **URL state for shareable context** — if a user should be able to share a link that reproduces their view, put it in the URL
2. **State containers for component state** — use `createStateContainer` instead of lifting state through many React component levels
3. **Subscribe to slices, not the whole state** — use `distinctUntilChanged` with selectors to avoid unnecessary re-renders
4. **Clean up subscriptions** — every `.subscribe()` needs an `.unsubscribe()` in the cleanup function
5. **Use `_a` for app state, `_g` for global state** — this is Kibana's convention for URL state keys
6. **Don't duplicate global state** — time range, filters, and query are managed by the `data` plugin; subscribe to them, don't re-implement
7. **Use transitions for predictable mutations** — named transitions make state changes traceable and testable
8. **Session storage for ephemeral UI state** — scroll position, expanded rows, sidebar open/closed
9. **Saved objects for persistent state** — anything the user explicitly "saves" should be a saved object
10. **Test state transitions independently** — state containers are plain objects with functions, easily unit-testable

## Logging & Monitoring

Kibana provides structured logging, usage telemetry, performance tracking, and event logging for plugins. Proper logging is critical for debugging production issues and understanding plugin usage.

---

### Server-Side Logging

Kibana uses a structured logging system based on Log4j-style levels and hierarchical logger names.

```typescript
// server/plugin.ts
import { PluginInitializerContext, Logger } from '@kbn/core/server';

export class MyPlugin {
  private readonly logger: Logger;

  constructor(private readonly initializerContext: PluginInitializerContext) {
    // Logger name is automatically scoped to your plugin: "plugins.myPlugin"
    this.logger = initializerContext.logger.get();
  }

  public setup(core: CoreSetup) {
    this.logger.info('Plugin setup started');

    // Create child loggers for subsystems
    const routeLogger = this.logger.get('routes');       // "plugins.myPlugin.routes"
    const serviceLogger = this.logger.get('services');   // "plugins.myPlugin.services"
    const syncLogger = this.logger.get('sync');          // "plugins.myPlugin.sync"

    registerRoutes(core.http.createRouter(), routeLogger);
    this.syncService = new SyncService(syncLogger);
  }
}
```

Log levels:

```typescript
this.logger.trace('Detailed tracing info — most verbose');
this.logger.debug('Debug info — useful during development');
this.logger.info('Normal operational messages');
this.logger.warn('Something unexpected but not fatal');
this.logger.error('Something failed');
this.logger.fatal('Unrecoverable error — plugin cannot function');
```

---

### Structured Logging with Meta

Always include structured metadata for searchable logs:

```typescript
// Good — structured and searchable
this.logger.info('User created', {
  userId: user.id,
  username: user.username,
  createdBy: request.auth?.username,
});

this.logger.error('Failed to sync data', {
  index: targetIndex,
  documentCount: docs.length,
  error: error.message,
  stack: error.stack,
});

this.logger.warn('Rate limit approaching', {
  currentRate: requestCount,
  limit: MAX_REQUESTS_PER_MINUTE,
  endpoint: '/api/my_plugin/sync',
});

// Bad — unstructured, hard to search
this.logger.info(`User ${user.username} created by ${request.auth?.username}`);
this.logger.error(`Failed: ${error}`);
```

---

### Logging in Route Handlers

Pass the logger to routes and use it consistently:

```typescript
// server/routes/items_routes.ts
import { IRouter, Logger } from '@kbn/core/server';

export function registerItemRoutes(router: IRouter, logger: Logger) {
  router.post(
    {
      path: '/api/my_plugin/items',
      validate: { /* ... */ },
    },
    async (context, request, response) => {
      const startTime = Date.now();

      try {
        logger.debug('Creating item', { body: request.body });

        const esClient = (await context.core).elasticsearch.client.asCurrentUser;
        const result = await esClient.index({ /* ... */ });

        const duration = Date.now() - startTime;
        logger.info('Item created', {
          itemId: result._id,
          duration: `${duration}ms`,
        });

        return response.ok({ body: { id: result._id } });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        logger.error('Failed to create item', {
          error: error.message,
          statusCode: error?.statusCode,
          duration: `${duration}ms`,
        });

        return response.customError({
          statusCode: error?.statusCode || 500,
          body: { message: 'Failed to create item' },
        });
      }
    }
  );
}
```

---

### Configuring Log Levels (kibana.yml)

```yaml
# Set log level for your plugin specifically
logging:
  loggers:
    - name: plugins.myPlugin
      level: debug
      appenders:
        - default

    # Even more granular — just the routes subsystem
    - name: plugins.myPlugin.routes
      level: trace

    # Quiet down noisy subsystems
    - name: plugins.myPlugin.sync
      level: warn

  # Custom appender (write to a separate file)
  appenders:
    my-plugin-file:
      type: file
      fileName: /var/log/kibana/my-plugin.log
      layout:
        type: json

  loggers:
    - name: plugins.myPlugin
      level: info
      appenders:
        - my-plugin-file
```

---

### Usage Telemetry (Usage Collector)

Register a usage collector to report plugin usage statistics to Elastic's telemetry system. This data helps understand how plugins are used (opt-in, anonymized).

```typescript
// server/collectors/usage_collector.ts
import { UsageCollectionSetup } from '@kbn/usage-collection-plugin/server';
import { SavedObjectsClientContract } from '@kbn/core/server';

interface MyPluginUsage {
  total_configs: number;
  active_configs: number;
  total_syncs_last_24h: number;
  avg_items_per_config: number;
  features_used: {
    advanced_mode: number;
    scheduled_sync: number;
    custom_mappings: number;
  };
}

export function registerUsageCollector(
  usageCollection: UsageCollectionSetup,
  getSavedObjectsClient: () => SavedObjectsClientContract | undefined
) {
  const collector = usageCollection.makeUsageCollector<MyPluginUsage>({
    type: 'my_plugin',
    isReady: () => !!getSavedObjectsClient(),
    schema: {
      total_configs: { type: 'long' },
      active_configs: { type: 'long' },
      total_syncs_last_24h: { type: 'long' },
      avg_items_per_config: { type: 'float' },
      features_used: {
        advanced_mode: { type: 'long' },
        scheduled_sync: { type: 'long' },
        custom_mappings: { type: 'long' },
      },
    },

    async fetch() {
      const client = getSavedObjectsClient();
      if (!client) {
        return {
          total_configs: 0,
          active_configs: 0,
          total_syncs_last_24h: 0,
          avg_items_per_config: 0,
          features_used: { advanced_mode: 0, scheduled_sync: 0, custom_mappings: 0 },
        };
      }

      const configs = await client.find({ type: 'my-plugin-config', perPage: 10000 });
      const activeConfigs = configs.saved_objects.filter((c) => c.attributes.enabled);

      return {
        total_configs: configs.total,
        active_configs: activeConfigs.length,
        total_syncs_last_24h: await countRecentSyncs(client),
        avg_items_per_config: calculateAverage(configs.saved_objects),
        features_used: countFeatureUsage(configs.saved_objects),
      };
    },
  });

  usageCollection.registerCollector(collector);
}
```

Register in setup:

```typescript
// server/plugin.ts
public setup(core: CoreSetup, { usageCollection }: MyPluginSetupDeps) {
  if (usageCollection) {
    registerUsageCollector(usageCollection, () => this.savedObjectsClient);
  }
}
```

Add `usageCollection` to `optionalPlugins` in `kibana.jsonc`.

---

### Performance Monitoring

Track operation timing for performance analysis:

```typescript
// server/lib/performance.ts
import { Logger } from '@kbn/core/server';

export function withTiming<T>(
  logger: Logger,
  operationName: string,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>
): Promise<T> {
  const start = performance.now();

  return fn()
    .then((result) => {
      const duration = performance.now() - start;
      logger.debug(`${operationName} completed`, {
        ...meta,
        duration_ms: Math.round(duration * 100) / 100,
      });

      if (duration > 5000) {
        logger.warn(`${operationName} slow execution`, {
          ...meta,
          duration_ms: Math.round(duration),
        });
      }

      return result;
    })
    .catch((error) => {
      const duration = performance.now() - start;
      logger.error(`${operationName} failed`, {
        ...meta,
        duration_ms: Math.round(duration),
        error: error.message,
      });
      throw error;
    });
}

// Usage in a route handler
const result = await withTiming(
  logger,
  'elasticsearch_search',
  () => esClient.search({ index: 'my-index', body: query }),
  { index: 'my-index', queryType: 'filtered_search' }
);
```

---

### Event Log (for auditable actions)

If your plugin performs actions that need an audit trail, use the Event Log:

```typescript
// server/plugin.ts
import { IEventLogService } from '@kbn/event-log-plugin/server';

public setup(core: CoreSetup, { eventLog }: { eventLog: IEventLogService }) {
  // Register your plugin's event provider
  eventLog.registerProviderActions('myPlugin', ['execute', 'create', 'delete', 'sync']);
}

public start(core: CoreStart, { eventLog }: { eventLog: IEventLogService }) {
  const eventLogger = eventLog.getLogger({ event: { provider: 'myPlugin' } });

  // Log an event
  eventLogger.logEvent({
    event: {
      action: 'execute',
      outcome: 'success',
    },
    message: 'Sync job completed',
    kibana: {
      saved_objects: [
        { rel: 'primary', type: 'my-plugin-config', id: configId },
      ],
    },
  });
}
```

Add `eventLog` to `optionalPlugins`.

---

### Client-Side Logging

On the public side, avoid `console.log` in production. Use the Kibana fatal error handler for unrecoverable errors and notifications for user-facing messages:

```typescript
// For development debugging — use sparingly
if (process.env.NODE_ENV !== 'production') {
  console.debug('[myPlugin] Debug info:', data);
}

// For unrecoverable errors
core.fatalErrors.add(new Error('My plugin failed to initialize'));

// For user-facing feedback — use notifications
core.notifications.toasts.addDanger({
  title: 'Sync failed',
  text: `Unable to sync data: ${error.message}`,
});
```

---

### Logging Best Practices

1. **Use structured meta** — pass objects, not interpolated strings, for searchability
2. **Create child loggers** — use `this.logger.get('subsystem')` to create hierarchical loggers
3. **Log at the right level** — `debug` for development, `info` for operations, `warn` for recoverable issues, `error` for failures
4. **Include timing** — log durations for ES queries, external API calls, and long-running operations
5. **Never log sensitive data** — don't log passwords, tokens, PII, or full request bodies in production
6. **Never use `console.log`** on the server — use the Kibana logger exclusively
7. **Log on boundaries** — log when entering and exiting important operations (route handlers, service methods, background tasks)
8. **Use telemetry for analytics** — don't parse logs for usage stats, use the Usage Collector
9. **Configure per-plugin levels** — use `kibana.yml` to turn up logging for debugging without drowning in noise from other plugins
10. **Include correlation data** — log request IDs, saved object IDs, and user identifiers to trace operations end-to-end

## HTTP Resources & Static Assets

Plugins can serve static files (images, fonts, CSS, JSON) and configure how Kibana handles HTTP resources including Content Security Policy headers.

---

### Serving Static Assets

Place static files in your plugin's `public/assets/` directory. Kibana bundles them and makes them available at a versioned URL path.

```
my-kibana-plugin/
└── public/
    └── assets/
        ├── images/
        │   ├── logo.svg
        │   └── icon.png
        ├── fonts/
        │   └── custom-font.woff2
        └── data/
            └── defaults.json
```

Access them in your React components:

```typescript
// In a React component
import logoSvg from './assets/images/logo.svg';

const MyHeader: React.FC = () => (
  <img src={logoSvg} alt="My Plugin Logo" height={32} />
);
```

Or build the URL dynamically using the HTTP base path:

```typescript
const { http } = useKibana().services;

// basePath handles Kibana's server.basePath config
const logoUrl = http.basePath.prepend(
  '/plugins/myKibanaPlugin/assets/images/logo.svg'
);
```

---

### Custom CSS

For plugin-specific styling that goes beyond EUI, create CSS/SCSS files and import them:

```typescript
// public/application.tsx
import './styles/my_plugin.scss';  // Loaded when the app mounts
```

```scss
// public/styles/my_plugin.scss

// Namespace everything to avoid global conflicts
.myPlugin {
  &__header {
    border-bottom: 1px solid $euiColorLightShade;
    padding: $euiSizeM;
  }

  &__content {
    max-width: 1200px;
    margin: 0 auto;
  }

  &__metric {
    font-size: $euiFontSizeXL;
    font-weight: $euiFontWeightBold;

    &--success { color: $euiColorSuccess; }
    &--danger { color: $euiColorDanger; }
    &--warning { color: $euiColorWarning; }
  }
}
```

**CSS rules:**
- Always namespace your CSS with a plugin-specific prefix (`.myPlugin__`)
- Use EUI's SCSS variables (`$euiColorPrimary`, `$euiSizeM`, `$euiFontSizeL`) for consistency
- Never override global EUI styles — it will break other plugins
- Use EUI components instead of custom CSS whenever possible
- Prefer CSS modules or BEM naming over generic class names

---

### Available EUI SCSS Variables

EUI exposes variables you can use in your SCSS for theme-consistent styling:

```scss
// Colors
$euiColorPrimary       // Primary action color
$euiColorSuccess       // Success state
$euiColorWarning       // Warning state
$euiColorDanger        // Error / danger state
$euiColorEmptyShade    // Background (white in light theme)
$euiColorLightShade    // Borders, dividers
$euiColorDarkShade     // Secondary text
$euiColorFullShade     // Primary text (near-black)
$euiTextColor          // Default text color

// Sizing
$euiSizeXS   // 4px
$euiSizeS    // 8px
$euiSizeM    // 12px
$euiSize     // 16px (base)
$euiSizeL    // 24px
$euiSizeXL   // 32px
$euiSizeXXL  // 40px

// Font
$euiFontSizeXS    // 12px
$euiFontSizeS     // 14px
$euiFontSize      // 16px (base)
$euiFontSizeM     // 18px
$euiFontSizeL     // 20px
$euiFontSizeXL    // 28px
$euiFontWeightRegular   // 400
$euiFontWeightMedium    // 500
$euiFontWeightSemiBold  // 600
$euiFontWeightBold      // 700

// Border radius
$euiBorderRadius        // Default border radius
$euiBorderRadiusSmall

// Breakpoints
$euiBreakpointS   // 575px
$euiBreakpointM   // 768px
$euiBreakpointL   // 992px
$euiBreakpointXL  // 1200px
```

---

### Content Security Policy (CSP)

Kibana enforces a strict Content Security Policy. If your plugin loads external resources, you may need to configure CSP.

```yaml
# kibana.yml — only if your plugin MUST load external resources
csp:
  rules:
    - "script-src 'self'"
    - "style-src 'self' 'unsafe-inline'"    # EUI requires unsafe-inline for styles
    - "img-src 'self' data: https://your-cdn.example.com"
    - "font-src 'self' https://fonts.gstatic.com"
    - "connect-src 'self' https://api.example.com"
  strict: true
  warnLegacyBrowsers: true
```

**CSP rules for plugins:**
- Avoid loading external scripts — bundle everything into your plugin
- If you must load external images (e.g. user avatars), update `img-src`
- For external API calls from the browser, update `connect-src` or proxy through your server routes
- Never weaken `script-src` to `'unsafe-eval'` or `'unsafe-inline'` — use Kibana's bundling instead
- Custom fonts should be bundled in `public/assets/fonts/`; don't load from external CDNs in production

---

### Proxying External APIs

Instead of calling external APIs directly from the browser (which requires CSP changes), proxy through server routes:

```typescript
// server/routes/proxy_routes.ts
import { IRouter, Logger } from '@kbn/core/server';
import { schema } from '@kbn/config-schema';

export function registerProxyRoutes(router: IRouter, logger: Logger) {
  router.get(
    {
      path: '/api/my_plugin/external/status',
      validate: {
        query: schema.object({
          resourceId: schema.string(),
        }),
      },
    },
    async (context, request, response) => {
      try {
        // Call external API from the server — no CSP issues
        const externalResponse = await fetch(
          `https://api.example.com/status/${request.query.resourceId}`,
          {
            headers: {
              'Authorization': `Bearer ${getApiToken()}`,
            },
          }
        );

        const data = await externalResponse.json();
        return response.ok({ body: data });
      } catch (error) {
        logger.error('External API call failed', { error: error.message });
        return response.customError({
          statusCode: 502,
          body: { message: 'External service unavailable' },
        });
      }
    }
  );
}
```

---

### Registering Custom App Icons

Set your plugin's icon in the navigation:

```typescript
// public/plugin.ts
core.application.register({
  id: PLUGIN_ID,
  title: PLUGIN_NAME,
  euiIconType: 'logoElastic',     // EUI icon name
  // Or use a custom SVG:
  // euiIconType: '/plugins/myKibanaPlugin/assets/images/icon.svg',
  category: DEFAULT_APP_CATEGORIES.management,
  order: 1000,
  async mount(params: AppMountParameters) { /* ... */ },
});
```

---

### HTTP Resources Best Practices

1. **Bundle everything possible** — external resources are a security and reliability risk
2. **Use EUI icons over custom images** — EUI has hundreds of icons, check the icon library first
3. **Namespace CSS** — prefix all classes with your plugin ID using BEM notation
4. **Use EUI SCSS variables** — hardcoded colors and sizes will break in dark mode and custom themes
5. **Proxy external calls** — route browser-to-external-API calls through your server routes
6. **Never weaken CSP** — if you think you need `unsafe-eval`, you're doing something wrong
7. **Serve assets from `public/assets/`** — they get proper caching headers and versioned URLs
8. **Use `http.basePath.prepend()`** — never hardcode `/plugins/...` paths, the base path may change
9. **Test in dark mode** — if you use custom CSS, verify it looks correct in both light and dark themes
10. **Minimize custom CSS** — every line of custom CSS is a line that can break with EUI upgrades

## Inter-Plugin Dependencies

Kibana plugins communicate through typed contracts — setup and start APIs that plugins expose to each other. Understanding dependencies is critical when your plugin integrates with security, data, navigation, embeddable, or other core plugins.

---

### Dependency Types in kibana.jsonc

```jsonc
{
  "plugin": {
    "id": "myPlugin",
    "server": true,
    "browser": true,

    // Required: Kibana won't start if these are missing
    "requiredPlugins": [
      "data",           // Search, filters, index patterns
      "navigation"      // Top nav, breadcrumbs
    ],

    // Optional: Plugin works without these, but gets extra features when present
    "optionalPlugins": [
      "security",       // Auth, RBAC — not always enabled
      "features",       // Feature registration for RBAC
      "embeddable",     // Dashboard embedding
      "usageCollection" // Telemetry
    ],

    // Required bundles: plugins whose browser code must be available for yours to compile
    // Needed when you import types or components from another plugin's public directory
    "requiredBundles": [
      "kibanaReact"     // For useKibana(), KibanaContextProvider
    ]
  }
}
```

**Key difference:**
- `requiredPlugins` — hard dependency. Kibana throws a fatal error if the dependency is missing.
- `optionalPlugins` — soft dependency. Your plugin starts regardless, but must check if the dependency is available.
- `requiredBundles` — build-time dependency. Ensures the other plugin's browser code is bundled before yours. Does NOT make the plugin a runtime dependency.

---

### Plugin Contracts (Setup & Start APIs)

Every plugin exposes a typed contract through its `setup()` and `start()` return values:

```typescript
// server/types.ts — what your plugin exposes to others

// What you provide during setup phase
export interface MyPluginSetup {
  registerCustomType: (type: CustomTypeConfig) => void;
  getConfigSchema: () => typeof configSchema;
}

// What you provide during start phase
export interface MyPluginStart {
  getClient: () => MyPluginClient;
  isFeatureEnabled: (featureId: string) => boolean;
}

// What you consume from other plugins during setup
export interface MyPluginSetupDeps {
  data: DataPluginSetup;
  navigation: NavigationPublicSetup;
  security?: SecurityPluginSetup;      // Optional — might be undefined
  features?: FeaturesPluginSetup;      // Optional
  usageCollection?: UsageCollectionSetup; // Optional
}

// What you consume from other plugins during start
export interface MyPluginStartDeps {
  data: DataPluginStart;
  navigation: NavigationPublicStart;
  security?: SecurityPluginStart;
  embeddable?: EmbeddableStart;
}
```

```typescript
// server/plugin.ts — implementing contracts

export class MyPlugin implements Plugin<
  MyPluginSetup,      // What setup() returns
  MyPluginStart,      // What start() returns
  MyPluginSetupDeps,  // What setup() receives
  MyPluginStartDeps   // What start() receives
> {
  private registeredTypes: CustomTypeConfig[] = [];

  public setup(core: CoreSetup<MyPluginStartDeps>, deps: MyPluginSetupDeps): MyPluginSetup {
    // Use required deps directly — they're guaranteed to exist
    const router = core.http.createRouter();
    registerRoutes(router, deps.data);

    // Check optional deps before using
    if (deps.security) {
      registerSecureRoutes(router, deps.security);
    }

    if (deps.features) {
      deps.features.registerKibanaFeature({
        id: 'myPlugin',
        name: 'My Plugin',
        // ...
      });
    }

    // Return your setup contract — other plugins can use this
    return {
      registerCustomType: (config) => {
        this.registeredTypes.push(config);
      },
      getConfigSchema: () => configSchema,
    };
  }

  public start(core: CoreStart, deps: MyPluginStartDeps): MyPluginStart {
    return {
      getClient: () => new MyPluginClient(core, deps.data),
      isFeatureEnabled: (id) => this.registeredTypes.some((t) => t.id === id),
    };
  }
}
```

---

### Consuming Optional Dependencies Safely

Always guard optional dependencies with type checks:

```typescript
// Pattern 1: Simple presence check
public setup(core: CoreSetup, deps: MyPluginSetupDeps) {
  if (deps.security) {
    // TypeScript narrows the type — security is SecurityPluginSetup here
    this.securitySetup = deps.security;
    registerSecureFeatures(deps.security);
  }

  if (deps.usageCollection) {
    registerUsageCollector(deps.usageCollection);
  }
}

// Pattern 2: Feature flags based on available plugins
public start(core: CoreStart, deps: MyPluginStartDeps) {
  return {
    capabilities: {
      hasRBAC: !!deps.security,
      hasDashboardIntegration: !!deps.embeddable,
    },
  };
}

// Pattern 3: Conditional route registration
public setup(core: CoreSetup, deps: MyPluginSetupDeps) {
  const router = core.http.createRouter();

  // Always register base routes
  registerBaseRoutes(router);

  // Only register admin routes if security is available
  if (deps.security) {
    registerAdminRoutes(router, deps.security);
  }
}
```

---

### Accessing Start Dependencies from Setup

A common pattern: you need start-phase services inside routes registered during setup. Use `core.getStartServices()`:

```typescript
public setup(core: CoreSetup<MyPluginStartDeps>) {
  const router = core.http.createRouter();

  router.get(
    { path: '/api/my_plugin/data', validate: {} },
    async (context, request, response) => {
      // Get start services — available after all plugins have started
      const [coreStart, pluginsStart] = await core.getStartServices();

      // Now you can use start-phase APIs
      const dataClient = pluginsStart.data.search.getSearchStrategy('es');

      return response.ok({ body: { status: 'ok' } });
    }
  );
}
```

This is safe because route handlers only execute after Kibana has fully started.

---

### Exposing APIs to Other Plugins

If your plugin provides services for other plugins:

```typescript
// Step 1: Define and export your contract types
// common/types.ts or server/types.ts
export interface MyPluginSetup {
  /**
   * Register a custom data source that My Plugin will index and manage.
   * Call this during your plugin's setup phase.
   */
  registerDataSource: (config: DataSourceConfig) => void;
}

export interface MyPluginStart {
  /**
   * Get a client for interacting with My Plugin's data.
   * Available after all plugins have started.
   */
  getClient: () => MyPluginClient;
}

export interface DataSourceConfig {
  id: string;
  name: string;
  fetchFn: () => Promise<Record<string, unknown>[]>;
  refreshInterval?: number;
}
```

```typescript
// Step 2: Export types from your plugin's index.ts
// server/index.ts
export type { MyPluginSetup, MyPluginStart, DataSourceConfig } from './types';
export { plugin } from './plugin';
```

```typescript
// Step 3: Other plugins consume your API
// In another-plugin/server/plugin.ts
import { MyPluginSetup, MyPluginStart } from 'my-plugin/server';

interface AnotherPluginSetupDeps {
  myPlugin: MyPluginSetup;
}

export class AnotherPlugin {
  public setup(core: CoreSetup, { myPlugin }: AnotherPluginSetupDeps) {
    myPlugin.registerDataSource({
      id: 'my-custom-source',
      name: 'Custom Source',
      fetchFn: async () => fetchFromExternalApi(),
      refreshInterval: 60000,
    });
  }
}
```

---

### Type Sharing Between Plugins

When multiple plugins need shared types:

```typescript
// common/types.ts — shared types in the common/ directory
// Both server and public code can import from here

export interface SharedItem {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
}

export interface SharedApiResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

export const PLUGIN_ID = 'myPlugin';
export const PLUGIN_NAME = 'My Plugin';

// Route constants — shared between server (registration) and public (HTTP calls)
export const API_BASE = '/api/my_plugin';
export const ROUTES = {
  ITEMS: `${API_BASE}/items`,
  ITEM_BY_ID: `${API_BASE}/items/{id}`,
  CONFIGS: `${API_BASE}/configs`,
  SYNC: `${API_BASE}/sync`,
} as const;
```

Import from common on both sides:

```typescript
// server/routes/items.ts
import { ROUTES } from '../../common';
router.get({ path: ROUTES.ITEMS, validate: { /* ... */ } }, handler);

// public/services/api.ts
import { ROUTES, SharedApiResponse, SharedItem } from '../../common';
const result = await http.get<SharedApiResponse<SharedItem>>(ROUTES.ITEMS);
```

---

### Common Plugin Dependencies Reference

| Plugin | Provides | Required/Optional |
|--------|----------|-------------------|
| `data` | Search, filters, index patterns, query bar, time picker | Usually required |
| `navigation` | Top navigation, breadcrumbs | Usually required for UI plugins |
| `security` | Auth, current user, RBAC | Optional (not always enabled) |
| `features` | Feature registration for RBAC privilege control | Optional |
| `embeddable` | Dashboard panel embedding | Optional |
| `uiActions` | Triggers, actions, context menus, drilldowns | Optional |
| `expressions` | Expression functions and renderers | Optional |
| `usageCollection` | Telemetry and usage stats | Optional |
| `eventLog` | Audit trail and event logging | Optional |
| `savedObjects` | (Part of core) Saved object registration and client | Core — always available |
| `kibanaReact` | `useKibana()`, `KibanaContextProvider`, React utilities | requiredBundles (build-time) |
| `savedObjectsManagement` | Registration in the SO management UI | Optional |
| `home` | Tutorial and sample data registration | Optional |

---

### Dependency Best Practices

1. **Minimize required dependencies** — every required dependency is a hard coupling that can break your plugin when the dependency changes or is absent
2. **Use optional for non-critical features** — security, telemetry, embeddable integration should be optional
3. **Always check optional deps** — TypeScript types should use `?` and your code should null-check
4. **Export clean, stable contracts** — your setup/start return types are your public API; changing them breaks consumers
5. **Use `common/` for shared code** — types, constants, and route paths shared between server and browser go in `common/`
6. **Put types in `requiredBundles`, not `requiredPlugins`** — if you only need types/components at build time, not runtime APIs
7. **Use `core.getStartServices()`** — when routes registered in setup need start-phase services
8. **Document your contracts** — add JSDoc comments to every exported interface method
9. **Version your contracts semantically** — breaking changes to your setup/start types should be major versions
10. **Don't circular-depend** — if plugin A requires plugin B and B requires A, refactor shared logic into a third plugin or `common/`

## Fast Development Workflow

Kibana takes 2-5 minutes to start, and server-side changes require a restart. This section covers strategies to iterate 10-50x faster by avoiding full Kibana boots whenever possible.

---

### What Requires a Restart vs Hot Reload

| Change Type | Restart Required? | Strategy |
|-------------|-------------------|----------|
| React components | No | Hot reload works automatically |
| SCSS/CSS styles | No | Hot reload works automatically |
| Client-side TypeScript | No | Hot reload works (use `--watch`) |
| Server route handlers | **Yes** | Use mock server or extract to testable functions |
| `kibana.jsonc` changes | **Yes** | Batch changes, restart once |
| Saved object registration | **Yes** | Test mapping with unit tests first |
| Plugin setup/start changes | **Yes** | Minimize changes to lifecycle methods |
| New npm dependencies | **Yes** | Add all needed deps at once |

---

### Strategy 1: Extract Testable Logic

Move business logic out of route handlers into pure functions that can be tested without Kibana:

```typescript
// ❌ Hard to test — logic buried in route handler
router.get({ path: '/api/my_plugin/analyze', validate: {} }, async (context, req, res) => {
  const coreContext = await context.core;
  const esClient = coreContext.elasticsearch.client.asCurrentUser;
  const result = await esClient.search({
    index: 'logs-*',
    body: {
      query: { range: { '@timestamp': { gte: 'now-1h' } } },
      aggs: { status_counts: { terms: { field: 'status' } } },
    },
  });
  const buckets = result.aggregations?.status_counts?.buckets || [];
  const errorRate = buckets.find(b => b.key === 'error')?.doc_count || 0;
  const total = buckets.reduce((sum, b) => sum + b.doc_count, 0);
  return res.ok({ body: { errorRate: total ? errorRate / total : 0 } });
});

// ✅ Easy to test — logic extracted
// server/lib/analyze.ts
export function buildAnalyzeQuery(timeRange: string): QueryDslQueryContainer {
  return { range: { '@timestamp': { gte: timeRange } } };
}

export function calculateErrorRate(buckets: Array<{ key: string; doc_count: number }>): number {
  const errorCount = buckets.find(b => b.key === 'error')?.doc_count || 0;
  const total = buckets.reduce((sum, b) => sum + b.doc_count, 0);
  return total ? errorCount / total : 0;
}

// server/lib/analyze.test.ts — runs in milliseconds, no Kibana needed
import { buildAnalyzeQuery, calculateErrorRate } from './analyze';

describe('calculateErrorRate', () => {
  it('returns 0.5 when half are errors', () => {
    const buckets = [
      { key: 'error', doc_count: 50 },
      { key: 'success', doc_count: 50 },
    ];
    expect(calculateErrorRate(buckets)).toBe(0.5);
  });

  it('returns 0 when no buckets', () => {
    expect(calculateErrorRate([])).toBe(0);
  });
});
```

---

### Strategy 2: Use Kibana's Official Mocks

Kibana provides mock utilities for unit testing:

```typescript
// test/mocks/core_mocks.ts
import {
  coreMock,
  elasticsearchServiceMock,
  savedObjectsClientMock,
  httpServerMock,
} from '@kbn/core/server/mocks';

export function createMockContext() {
  const coreContext = coreMock.createRequestHandlerContext();
  return {
    core: Promise.resolve(coreContext),
  };
}

export function createMockRequest(overrides = {}) {
  return httpServerMock.createKibanaRequest(overrides);
}

export function createMockResponse() {
  return httpServerMock.createResponseFactory();
}

// Using in tests:
import { createMockContext, createMockRequest, createMockResponse } from '../test/mocks/core_mocks';
import { myRouteHandler } from './my_route';

describe('myRouteHandler', () => {
  it('returns items from ES', async () => {
    const context = createMockContext();
    const coreContext = await context.core;

    // Set up mock ES response
    coreContext.elasticsearch.client.asCurrentUser.search.mockResolvedValue({
      hits: { hits: [{ _id: '1', _source: { name: 'Test' } }] },
    });

    const request = createMockRequest({ query: { page: 1 } });
    const response = createMockResponse();

    await myRouteHandler(context, request, response);

    expect(response.ok).toHaveBeenCalledWith({
      body: { items: [{ id: '1', name: 'Test' }] },
    });
  });
});
```

---

### Strategy 3: Optimized Kibana Config

Create `kibana.dev.yml` to disable plugins you don't need:

```yaml
# kibana.dev.yml — minimal config for faster startup

# Disable heavy plugins you're not using
xpack.fleet.enabled: false
xpack.osquery.enabled: false
xpack.apm.enabled: false
xpack.uptime.enabled: false
xpack.infra.enabled: false
xpack.securitySolution.enabled: false
xpack.ml.enabled: false
xpack.canvas.enabled: false
xpack.graph.enabled: false
monitoring.enabled: false
telemetry.enabled: false

# Faster optimizer
optimize.watch: true
optimize.watchPrebuild: true

# Dev-friendly settings
server.host: "0.0.0.0"
elasticsearch.hosts: ["http://localhost:9200"]
elasticsearch.username: "kibana_system"
elasticsearch.password: "changeme"

# Skip some startup checks
server.uuid: "dev-uuid-static"
pid.file: /tmp/kibana-dev.pid
```

Start with:
```bash
yarn start --config kibana.dev.yml --no-base-path
```

This can reduce startup time by 30-50% depending on which plugins you disable.

---

### Strategy 4: Parallel Development

Run multiple terminals for different concerns:

```bash
# Terminal 1: Kibana (start once, leave running)
yarn start --config kibana.dev.yml

# Terminal 2: Plugin client-side watcher (instant rebuilds)
cd plugins/my-plugin && yarn kbn watch

# Terminal 3: Tests in watch mode (instant feedback)
yarn jest plugins/my-plugin --watch

# Terminal 4: Your editor
code plugins/my-plugin
```

Client-side changes reflect in seconds via hot reload. Server changes still need a Kibana restart, but you've isolated that to only when necessary.

---

### Strategy 5: Storybook for UI Components

Develop React components in isolation:

```typescript
// public/components/metric_card.stories.tsx
import React from 'react';
import { MetricCard } from './metric_card';

export default {
  title: 'Components/MetricCard',
  component: MetricCard,
};

export const Default = () => (
  <MetricCard
    title="Error Rate"
    value={0.05}
    format="percent"
    trend="up"
    trendValue={0.02}
  />
);

export const Loading = () => <MetricCard title="Error Rate" isLoading />;

export const NoData = () => <MetricCard title="Error Rate" value={null} />;

export const Critical = () => (
  <MetricCard title="Error Rate" value={0.25} threshold={0.1} />
);
```

Run with:
```bash
yarn storybook my-plugin
```

Iterate on components at full speed, then integrate into Kibana.

---

### Strategy 6: Dev Console for ES Queries

Before implementing ES queries in your plugin:

1. Open Kibana → Dev Tools → Console
2. Write and test your query interactively
3. Get instant feedback on results
4. Copy the working query into your plugin code

This avoids the restart cycle for query development.

---

### Strategy 7: Mock Server for Routes

For heavy route development, use a standalone mock server that simulates Kibana's core APIs:

```bash
# Instant startup, hot reload on changes
cd dev/mock-server
PLUGIN_PATH=../.. npm start

# Test routes immediately
curl http://localhost:3000/api/my_plugin/items
```

The mock server provides:
- Real ES client connection (or fully mocked ES)
- In-memory saved objects store
- Hot reload when you change route files
- Sub-second feedback loop

---

### Development Speed Cheat Sheet

| Task | Fastest Approach | Time |
|------|-----------------|------|
| Test ES query | Dev Console | Instant |
| Test route logic | Unit test with mocks | < 1 sec |
| Test route handler | Mock server | < 1 sec |
| Test React component | Storybook | < 2 sec |
| Test client-side change | Hot reload | < 5 sec |
| Test server-side change | Kibana restart | 2-5 min |
| Test full integration | Kibana + manual | 5+ min |

**Rule of thumb:** Only restart Kibana when you absolutely must test the full integration. For everything else, there's a faster path.

---

### Fast Dev Best Practices

1. **Extract logic into pure functions** — test them directly with Jest
2. **Use Kibana's mock utilities** — `@kbn/core/server/mocks` is comprehensive
3. **Develop UI in Storybook** — no Kibana context needed
4. **Test queries in Dev Console** — instant feedback before coding
5. **Batch server changes** — make multiple changes, restart once
6. **Use `--watch` flags** — client rebuilds are automatic
7. **Disable unused plugins** — faster Kibana startup
8. **Keep route handlers thin** — delegate to testable service functions
9. **Mock external dependencies** — don't wait for real services in tests
10. **Final verification in real Kibana** — but only after fast iteration
