# Kibana External Plugin Development Skill

Use this skill whenever the user wants to create, modify, debug, or extend a Kibana external plugin. This covers plugin scaffolding, server routes, public UI, EUI components, Elasticsearch client usage, authentication, authorization (RBAC), testing, and deployment for Kibana 8.x+.

---

## Plugin Architecture Overview

Kibana plugins have two sides:

- **Server-side** (`server/`): Registers routes, handles auth, communicates with Elasticsearch, exposes server-side services.
- **Public-side** (`public/`): Registers the app in Kibana's UI, renders React components using EUI (Elastic UI), communicates with the server via HTTP.

A plugin's entry point is defined in `kibana.jsonc` (or `kibana.json`) and the plugin class implements `setup()` and `start()` lifecycle methods on both sides.

---

## Directory Structure (Standard External Plugin)

```
my-kibana-plugin/
├── kibana.jsonc                    # Plugin manifest
├── tsconfig.json                   # TypeScript config extending Kibana's
├── common/
│   ├── index.ts                    # Shared constants, types, routes
│   └── types.ts                    # Shared type definitions
├── server/
│   ├── index.ts                    # Server-side entry point (exports plugin)
│   ├── plugin.ts                   # Server plugin class (setup/start/stop)
│   ├── routes/
│   │   ├── index.ts                # Route registration aggregator
│   │   ├── example_route.ts        # Individual route handler
│   │   └── ...
│   ├── services/                   # Business logic / Elasticsearch wrappers
│   ├── lib/                        # Utility functions
│   └── types.ts                    # Server-specific types
├── public/
│   ├── index.ts                    # Public-side entry point (exports plugin)
│   ├── plugin.ts                   # Public plugin class (setup/start)
│   ├── application.tsx             # App mount point (renderApp)
│   ├── app.tsx                     # Root React component
│   ├── components/                 # React/EUI components
│   ├── hooks/                      # Custom React hooks
│   ├── services/                   # API service layer (HTTP client calls)
│   └── types.ts                    # Public-specific types
└── __tests__/                      # or colocated .test.ts files
```

---

## kibana.jsonc (Plugin Manifest)

```jsonc
{
  "type": "plugin",
  "id": "myKibanaPlugin",
  "owner": {
    "name": "Your Team",
    "githubTeam": "your-github-team"
  },
  "description": "Description of the plugin",
  "plugin": {
    "id": "myKibanaPlugin",
    "server": true,
    "browser": true,
    "configPath": ["myKibanaPlugin"],
    "requiredPlugins": ["navigation"],
    "optionalPlugins": ["security"],
    "requiredBundles": []
  }
}
```

Key fields:
- `id`: Must be unique, camelCase, matches the plugin class registration.
- `server` / `browser`: Enable server-side and/or public-side.
- `requiredPlugins`: Plugins that MUST be present (Kibana won't start without them).
- `optionalPlugins`: Plugins that MAY be present (use conditional checks).
- `configPath`: Path for `kibana.yml` configuration.

---

## Server-Side Plugin Class

```typescript
// server/plugin.ts
import {
  PluginInitializerContext,
  CoreSetup,
  CoreStart,
  Plugin,
  Logger,
} from '@kbn/core/server';
import { MyPluginSetup, MyPluginStart, MyPluginSetupDeps, MyPluginStartDeps } from './types';
import { registerRoutes } from './routes';

export class MyKibanaPlugin implements Plugin<MyPluginSetup, MyPluginStart, MyPluginSetupDeps, MyPluginStartDeps> {
  private readonly logger: Logger;

  constructor(private readonly initializerContext: PluginInitializerContext) {
    this.logger = initializerContext.logger.get();
  }

  public setup(core: CoreSetup<MyPluginStartDeps>, plugins: MyPluginSetupDeps): MyPluginSetup {
    this.logger.info('Setting up MyKibanaPlugin');

    const router = core.http.createRouter();
    registerRoutes(router, this.logger);

    return {};
  }

  public start(core: CoreStart, plugins: MyPluginStartDeps): MyPluginStart {
    this.logger.info('MyKibanaPlugin started');
    return {};
  }

  public stop() {
    this.logger.info('MyKibanaPlugin stopped');
  }
}
```

```typescript
// server/index.ts
import { PluginInitializerContext } from '@kbn/core/server';
import { MyKibanaPlugin } from './plugin';

export function plugin(initializerContext: PluginInitializerContext) {
  return new MyKibanaPlugin(initializerContext);
}

export type { MyPluginSetup, MyPluginStart } from './types';
```

---

## Server Route Patterns

### Basic Route

```typescript
// server/routes/example_route.ts
import { IRouter, Logger } from '@kbn/core/server';
import { schema } from '@kbn/config-schema';

export function registerExampleRoute(router: IRouter, logger: Logger) {
  // GET route with params
  router.get(
    {
      path: '/api/my_plugin/example/{id}',
      validate: {
        params: schema.object({
          id: schema.string(),
        }),
      },
    },
    async (context, request, response) => {
      try {
        const { id } = request.params;
        const coreContext = await context.core;
        const esClient = coreContext.elasticsearch.client.asCurrentUser;

        const result = await esClient.get({
          index: 'my-index',
          id,
        });

        return response.ok({
          body: result,
        });
      } catch (error) {
        logger.error(`Error fetching example: ${error}`);
        return response.customError({
          statusCode: 500,
          body: { message: 'Internal server error' },
        });
      }
    }
  );

  // POST route with body validation
  router.post(
    {
      path: '/api/my_plugin/example',
      validate: {
        body: schema.object({
          name: schema.string({ minLength: 1, maxLength: 255 }),
          description: schema.maybe(schema.string()),
          enabled: schema.boolean({ defaultValue: true }),
          tags: schema.arrayOf(schema.string(), { defaultValue: [] }),
        }),
      },
    },
    async (context, request, response) => {
      try {
        const { name, description, enabled, tags } = request.body;
        const coreContext = await context.core;
        const esClient = coreContext.elasticsearch.client.asCurrentUser;

        const result = await esClient.index({
          index: 'my-index',
          document: { name, description, enabled, tags, created_at: new Date().toISOString() },
          refresh: 'wait_for',
        });

        return response.ok({
          body: { id: result._id, ...request.body },
        });
      } catch (error) {
        logger.error(`Error creating example: ${error}`);
        return response.customError({
          statusCode: 500,
          body: { message: 'Internal server error' },
        });
      }
    }
  );
}
```

### Route Registration Aggregator

```typescript
// server/routes/index.ts
import { IRouter, Logger } from '@kbn/core/server';
import { registerExampleRoute } from './example_route';
import { registerUserRoutes } from './user_routes';

export function registerRoutes(router: IRouter, logger: Logger) {
  registerExampleRoute(router, logger);
  registerUserRoutes(router, logger);
}
```

---

## Validation with @kbn/config-schema

Always validate ALL inputs using `@kbn/config-schema`. Never trust client data.

```typescript
import { schema } from '@kbn/config-schema';

// Common patterns
schema.string()                                    // required string
schema.string({ minLength: 1, maxLength: 100 })    // with constraints
schema.maybe(schema.string())                       // optional (can be undefined)
schema.nullable(schema.string())                    // can be null
schema.number({ min: 0, max: 1000 })               // number with range
schema.boolean({ defaultValue: false })             // with default
schema.arrayOf(schema.string())                     // array of strings
schema.object({ key: schema.string() })             // nested object
schema.oneOf([schema.literal('a'), schema.literal('b')])  // enum-like
schema.recordOf(schema.string(), schema.number())   // Record<string, number>

// Query params
validate: {
  query: schema.object({
    page: schema.number({ defaultValue: 1, min: 1 }),
    perPage: schema.number({ defaultValue: 20, min: 1, max: 100 }),
    search: schema.maybe(schema.string()),
    sortField: schema.string({ defaultValue: 'created_at' }),
    sortOrder: schema.oneOf([schema.literal('asc'), schema.literal('desc')], { defaultValue: 'desc' }),
  }),
}
```

---

## Elasticsearch Client Usage

```typescript
// Using asCurrentUser (inherits requesting user's permissions)
const esClient = (await context.core).elasticsearch.client.asCurrentUser;

// Using asInternalUser (uses Kibana's internal credentials - use sparingly)
const esClient = (await context.core).elasticsearch.client.asInternalUser;

// Search
const searchResult = await esClient.search({
  index: 'my-index-*',
  body: {
    query: {
      bool: {
        must: [
          { match: { status: 'active' } },
          { range: { created_at: { gte: 'now-30d' } } },
        ],
        filter: [
          { term: { tenant_id: tenantId } },
        ],
      },
    },
    sort: [{ created_at: { order: 'desc' } }],
    size: 20,
    from: 0,
  },
});

// Bulk operations
const bulkBody = items.flatMap((item) => [
  { index: { _index: 'my-index', _id: item.id } },
  { ...item, updated_at: new Date().toISOString() },
]);

const bulkResult = await esClient.bulk({ body: bulkBody, refresh: 'wait_for' });

// Index template management
await esClient.indices.putIndexTemplate({
  name: 'my-plugin-template',
  index_patterns: ['my-plugin-*'],
  template: {
    settings: { number_of_shards: 1, number_of_replicas: 1 },
    mappings: {
      properties: {
        name: { type: 'keyword' },
        description: { type: 'text' },
        created_at: { type: 'date' },
        metadata: { type: 'object', dynamic: true },
      },
    },
  },
});
```

---

## Authentication & Authorization (Security)

### Checking Security Plugin Availability

```typescript
// In setup, security is an optional dependency
public setup(core: CoreSetup, { security }: MyPluginSetupDeps) {
  const isSecurityEnabled = !!security;
}
```

### Route-Level Auth with requiredPrivileges

```typescript
router.get(
  {
    path: '/api/my_plugin/protected',
    security: {
      authz: {
        requiredPrivileges: ['my_plugin-read'],
      },
    },
    validate: {},
  },
  async (context, request, response) => {
    // Only users with the required privilege can reach here
    return response.ok({ body: { message: 'Authorized' } });
  }
);
```

### Getting Current User Info

```typescript
async (context, request, response) => {
  const coreContext = await context.core;
  // In Kibana 8.x, use security plugin to get user
  const user = coreContext.security.authc.getCurrentUser();

  if (!user) {
    return response.unauthorized({ body: { message: 'Not authenticated' } });
  }

  // user.username, user.roles, user.full_name, user.email
  return response.ok({ body: { username: user.username, roles: user.roles } });
}
```

### RBAC Pattern (Role-Based Access Control)

```typescript
// Define feature privileges in plugin setup
public setup(core: CoreSetup, { features }: MyPluginSetupDeps) {
  features.registerKibanaFeature({
    id: 'myKibanaPlugin',
    name: 'My Plugin',
    category: DEFAULT_APP_CATEGORIES.management,
    app: ['myKibanaPlugin'],
    privileges: {
      all: {
        app: ['myKibanaPlugin'],
        api: ['my_plugin-read', 'my_plugin-write'],
        savedObject: { all: [], read: [] },
        ui: ['show', 'save', 'delete'],
      },
      read: {
        app: ['myKibanaPlugin'],
        api: ['my_plugin-read'],
        savedObject: { all: [], read: [] },
        ui: ['show'],
      },
    },
  });
}
```

---

## Public-Side Plugin Class

```typescript
// public/plugin.ts
import { CoreSetup, CoreStart, Plugin, AppMountParameters } from '@kbn/core/public';
import { MyPluginPublicSetup, MyPluginPublicStart, MyPluginSetupDeps, MyPluginStartDeps } from './types';
import { PLUGIN_ID, PLUGIN_NAME } from '../common';

export class MyKibanaPublicPlugin implements Plugin<MyPluginPublicSetup, MyPluginPublicStart, MyPluginSetupDeps, MyPluginStartDeps> {

  public setup(core: CoreSetup<MyPluginStartDeps>, plugins: MyPluginSetupDeps): MyPluginPublicSetup {
    core.application.register({
      id: PLUGIN_ID,
      title: PLUGIN_NAME,
      // Optional: category, order, euiIconType
      async mount(params: AppMountParameters) {
        const { renderApp } = await import('./application');
        const [coreStart, pluginsStart] = await core.getStartServices();
        return renderApp(coreStart, pluginsStart, params);
      },
    });

    return {};
  }

  public start(core: CoreStart, plugins: MyPluginStartDeps): MyPluginPublicStart {
    return {};
  }

  public stop() {}
}
```

```typescript
// public/index.ts
import { MyKibanaPublicPlugin } from './plugin';

export function plugin() {
  return new MyKibanaPublicPlugin();
}

export type { MyPluginPublicSetup, MyPluginPublicStart } from './types';
```

### Application Mount

```typescript
// public/application.tsx
import React from 'react';
import ReactDOM from 'react-dom';
import { CoreStart, AppMountParameters } from '@kbn/core/public';
import { KibanaContextProvider } from '@kbn/kibana-react-plugin/public';
import { MyApp } from './app';

export function renderApp(
  core: CoreStart,
  plugins: any,
  { element, history }: AppMountParameters
) {
  const services = { ...core, ...plugins };

  ReactDOM.render(
    <KibanaContextProvider services={services}>
      <MyApp history={history} notifications={core.notifications} http={core.http} />
    </KibanaContextProvider>,
    element
  );

  // Return unmount function
  return () => ReactDOM.unmountComponentAtNode(element);
}
```

---

## EUI Component Patterns

Always use EUI (Elastic UI) for consistency with Kibana's design system.

### Page Layout

```tsx
import {
  EuiPage,
  EuiPageBody,
  EuiPageHeader,
  EuiPageSection,
  EuiSpacer,
} from '@elastic/eui';

export const MyPage: React.FC = () => (
  <EuiPage paddingSize="l">
    <EuiPageBody>
      <EuiPageHeader
        pageTitle="My Plugin"
        description="Plugin description here"
        rightSideItems={[<EuiButton fill>Action</EuiButton>]}
      />
      <EuiSpacer size="l" />
      <EuiPageSection>
        {/* Content */}
      </EuiPageSection>
    </EuiPageBody>
  </EuiPage>
);
```

### Table with Search and Pagination

```tsx
import {
  EuiInMemoryTable,
  EuiBasicTableColumn,
  EuiHealth,
  EuiBadge,
} from '@elastic/eui';

const columns: EuiBasicTableColumn<Item>[] = [
  { field: 'name', name: 'Name', sortable: true, truncateText: true },
  {
    field: 'status',
    name: 'Status',
    render: (status: string) => (
      <EuiHealth color={status === 'active' ? 'success' : 'danger'}>
        {status}
      </EuiHealth>
    ),
  },
  {
    name: 'Actions',
    actions: [
      { name: 'Edit', description: 'Edit', icon: 'pencil', onClick: handleEdit },
      { name: 'Delete', description: 'Delete', icon: 'trash', color: 'danger', onClick: handleDelete },
    ],
  },
];

<EuiInMemoryTable
  items={items}
  columns={columns}
  search={{ box: { incremental: true, placeholder: 'Search...' } }}
  pagination={{ initialPageSize: 20, pageSizeOptions: [10, 20, 50] }}
  sorting={{ sort: { field: 'name', direction: 'asc' } }}
  loading={isLoading}
  hasActions
/>
```

### Forms

```tsx
import {
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiTextArea,
  EuiSwitch,
  EuiSelect,
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
} from '@elastic/eui';

<EuiForm component="form" onSubmit={handleSubmit}>
  <EuiFormRow label="Name" isInvalid={!!errors.name} error={errors.name}>
    <EuiFieldText value={name} onChange={(e) => setName(e.target.value)} />
  </EuiFormRow>
  <EuiFormRow label="Description" helpText="Optional description">
    <EuiTextArea value={description} onChange={(e) => setDescription(e.target.value)} />
  </EuiFormRow>
  <EuiFormRow label="Enabled">
    <EuiSwitch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} label="" />
  </EuiFormRow>
  <EuiFlexGroup justifyContent="flexEnd">
    <EuiFlexItem grow={false}>
      <EuiButton type="submit" fill isLoading={isSubmitting}>Save</EuiButton>
    </EuiFlexItem>
  </EuiFlexGroup>
</EuiForm>
```

### Toasts / Notifications

```typescript
// Use core.notifications for user feedback
const { notifications } = useKibana().services;

notifications.toasts.addSuccess('Item created successfully');
notifications.toasts.addDanger('Failed to create item');
notifications.toasts.addWarning('Item created with warnings');
notifications.toasts.add({
  title: 'Custom notification',
  text: 'With detailed message',
  color: 'primary',
});
```

---

## HTTP Client (Public → Server Communication)

```typescript
// public/services/api.ts
import { HttpSetup } from '@kbn/core/public';

export class MyPluginApi {
  constructor(private http: HttpSetup) {}

  async getItems(params?: { page?: number; perPage?: number; search?: string }) {
    return this.http.get('/api/my_plugin/items', { query: params });
  }

  async getItem(id: string) {
    return this.http.get(`/api/my_plugin/items/${id}`);
  }

  async createItem(body: { name: string; description?: string }) {
    return this.http.post('/api/my_plugin/items', { body: JSON.stringify(body) });
  }

  async updateItem(id: string, body: Partial<{ name: string; description: string }>) {
    return this.http.put(`/api/my_plugin/items/${id}`, { body: JSON.stringify(body) });
  }

  async deleteItem(id: string) {
    return this.http.delete(`/api/my_plugin/items/${id}`);
  }
}
```

### Custom Hook for API Integration

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useKibana } from '@kbn/kibana-react-plugin/public';

export function useItems() {
  const { http, notifications } = useKibana().services;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await http.get('/api/my_plugin/items');
      setItems(response.items);
      setError(null);
    } catch (err) {
      setError(err as Error);
      notifications.toasts.addDanger(`Failed to load items: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [http, notifications]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  return { items, loading, error, refetch: fetchItems };
}
```

---

## Testing Patterns

### Server Route Tests (Jest)

```typescript
import { httpServerMock, httpServiceMock, loggingSystemMock } from '@kbn/core/server/mocks';
import { registerExampleRoute } from './example_route';

describe('Example Route', () => {
  let router: ReturnType<typeof httpServiceMock.createRouter>;
  let logger: ReturnType<typeof loggingSystemMock.createLogger>;

  beforeEach(() => {
    router = httpServiceMock.createRouter();
    logger = loggingSystemMock.createLogger();
    registerExampleRoute(router, logger);
  });

  it('registers GET /api/my_plugin/example/{id}', () => {
    expect(router.get).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/my_plugin/example/{id}' }),
      expect.any(Function)
    );
  });

  it('returns data for valid id', async () => {
    const handler = router.get.mock.calls[0][1];
    const context = {
      core: Promise.resolve({
        elasticsearch: {
          client: {
            asCurrentUser: {
              get: jest.fn().mockResolvedValue({ _id: '1', _source: { name: 'Test' } }),
            },
          },
        },
      }),
    };
    const request = httpServerMock.createKibanaRequest({ params: { id: '1' } });
    const response = httpServerMock.createResponseFactory();

    await handler(context as any, request, response);

    expect(response.ok).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ _id: '1' }) })
    );
  });
});
```

### React Component Tests (React Testing Library)

```tsx
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MyComponent } from './my_component';

// Mock Kibana services
const mockHttp = { get: jest.fn(), post: jest.fn() };
const mockNotifications = { toasts: { addSuccess: jest.fn(), addDanger: jest.fn() } };

jest.mock('@kbn/kibana-react-plugin/public', () => ({
  useKibana: () => ({ services: { http: mockHttp, notifications: mockNotifications } }),
}));

describe('MyComponent', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('renders loading state', () => {
    mockHttp.get.mockReturnValue(new Promise(() => {})); // never resolves
    render(<MyComponent />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders items after loading', async () => {
    mockHttp.get.mockResolvedValue({ items: [{ id: '1', name: 'Test Item' }] });
    render(<MyComponent />);
    await waitFor(() => {
      expect(screen.getByText('Test Item')).toBeInTheDocument();
    });
  });
});
```

---

## Plugin Configuration (kibana.yml)

```typescript
// server/config.ts
import { schema, TypeOf } from '@kbn/config-schema';

export const configSchema = schema.object({
  enabled: schema.boolean({ defaultValue: true }),
  maxItems: schema.number({ defaultValue: 1000, min: 1 }),
  indexPrefix: schema.string({ defaultValue: 'my-plugin' }),
  features: schema.object({
    advancedMode: schema.boolean({ defaultValue: false }),
  }),
});

export type MyPluginConfig = TypeOf<typeof configSchema>;
```

In `kibana.yml`:
```yaml
myKibanaPlugin:
  enabled: true
  maxItems: 500
  indexPrefix: "custom-prefix"
  features:
    advancedMode: true
```

---

## Building for Production

External Kibana plugins must be built against a matching Kibana source checkout. The build tooling transpiles TypeScript, bundles browser code, and creates a distributable `.zip`.

### Prerequisites

```
workspace/
├── kibana/                  # Kibana source (exact version match required)
│   └── plugins/
│       └── my_plugin/       # Your plugin (symlinked or copied)
└── my_plugin/               # Plugin source repo
```

```bash
# Bootstrap (required once, or after Kibana version change)
cd kibana
nvm use           # Use Kibana's required Node.js version
yarn kbn bootstrap
```

### Dev Mode

```bash
# Terminal 1: Kibana
cd kibana && yarn start

# Terminal 2: Plugin browser bundle (if plugin has UI)
cd kibana/plugins/my_plugin && yarn dev --watch
```

Verify in logs: `[plugins-system.standard] Setting up [..., myPluginId, ...]`

### Production Build

```bash
cd kibana/plugins/my_plugin

# Pre-build checks
npx tsc --noEmit       # TypeScript
yarn lint              # Linting
yarn test              # Tests

# Build distributable archive
yarn plugin-helpers build
# Output: build/myPluginId-1.0.0.zip
```

The archive contains compiled JS (no `.ts` files), bundled browser assets, and production `node_modules` only.

### Installation

```bash
# Local file
bin/kibana-plugin install file:///path/to/myPluginId-1.0.0.zip

# URL
bin/kibana-plugin install https://releases.example.com/myPluginId-1.0.0.zip

# Verify
bin/kibana-plugin list

# Remove
bin/kibana-plugin remove myPluginId
```

### Docker

```dockerfile
FROM docker.elastic.co/kibana/kibana:8.17.0
COPY myPluginId-1.0.0.zip /tmp/
RUN /usr/share/kibana/bin/kibana-plugin install file:///tmp/myPluginId-1.0.0.zip \
    && rm /tmp/myPluginId-1.0.0.zip
RUN /usr/share/kibana/bin/kibana --optimize
```

Always run `--optimize` in the Docker build to avoid slow first startup.

### Version Matching

**Critical**: Kibana enforces exact version match. The `kibanaVersion` in `kibana.jsonc` must match the target Kibana deployment exactly. There is no semver range support.

Recommended version format: `{pluginVersion}-{kibanaVersion}` (e.g. `1.2.0-8.17.0`)

For multi-version support, maintain version branches (`main` → latest, `kibana-8.16` → 8.16.x).

### package.json Scripts

```json
{
  "scripts": {
    "build": "yarn plugin-helpers build",
    "dev": "yarn plugin-helpers dev --watch",
    "prebuild": "yarn typecheck && yarn lint && yarn test",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx",
    "test": "jest --config jest.config.js"
  }
}
```

---

## Common Patterns & Best Practices

1. **Always use `asCurrentUser`** unless you explicitly need internal (elevated) access. This respects the user's Elasticsearch permissions.
2. **Validate everything** with `@kbn/config-schema`. Never pass unvalidated data to Elasticsearch.
3. **Use `refresh: 'wait_for'`** on write operations when the UI needs to reflect changes immediately.
4. **Handle errors gracefully** — catch Elasticsearch errors and return appropriate HTTP status codes.
5. **Multi-tenancy**: If your plugin serves multiple tenants, always filter by `tenant_id` in queries and never expose cross-tenant data.
6. **Use EUI exclusively** for UI — don't mix in other component libraries unless absolutely necessary.
7. **Avoid saved objects** for simple CRUD — use plain Elasticsearch indices when saved object management overhead isn't needed.
8. **Bundle size**: Use dynamic imports (`import()`) for heavy components to keep initial bundle small.
9. **Naming conventions**: Plugin ID is camelCase, route paths are snake_case with `/api/` prefix, indices are kebab-case.
10. **Logging**: Always use the Kibana logger (`this.logger`) instead of `console.log`.
11. **TypeScript**: Always use strict typing. Define interfaces for all API request/response shapes.
12. **Test both sides**: Server routes with Jest mocks, React components with React Testing Library.

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Plugin not discovered | Check `kibana.jsonc` `id` matches, check directory location |
| Route 404 | Verify route path starts with `/api/`, check route is registered in `setup()` |
| TypeScript errors | Ensure `tsconfig.json` extends Kibana's config, check `@kbn/*` imports |
| CORS issues | Routes via Kibana's HTTP service handle CORS automatically |
| Auth not working | Ensure `security` is in `optionalPlugins`, check `requiredPrivileges` |
| ES client timeout | Use `requestTimeout` option, check cluster health |
| EUI version mismatch | Use the EUI version bundled with your target Kibana version |
