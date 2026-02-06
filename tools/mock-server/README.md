# Kibana Plugin Mock Server

Test your Kibana plugin routes **without running Kibana**. Instant startup, hot reload on file changes.

## The Problem

```
Full Kibana startup:     2-5 minutes
Route change → test:     2-5 minutes (restart required)
10 iterations/hour:      20-50 minutes wasted
```

## The Solution

```
Mock server startup:     <1 second
Route change → test:     <1 second (hot reload)
10 iterations/hour:      <10 seconds total
```

## Quick Start

```bash
cd mock-server
npm install

# Point to your plugin and run
PLUGIN_PATH=../kibana/plugins/my-plugin npm start
```

Output:
```
🚀 Kibana Plugin Mock Server

   Plugin:  ../kibana/plugins/my-plugin
   ES:      http://localhost:9200
   Port:    3000

Loading routes...

  📍 GET /api/my_plugin/items
  📍 POST /api/my_plugin/items
  📍 GET /api/my_plugin/items/{id}
  📍 PUT /api/my_plugin/items/{id}
  📍 DELETE /api/my_plugin/items/{id}

✅ Loaded 5 routes from plugin

🟢 Mock server running at http://localhost:3000
   Hot reload enabled — edit your plugin and routes will reload
```

## Test Your Routes

```bash
# List items
curl http://localhost:3000/api/my_plugin/items

# Create item
curl -X POST http://localhost:3000/api/my_plugin/items \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Item"}'

# Get item
curl http://localhost:3000/api/my_plugin/items/abc123
```

## Configuration

| Env Variable | Default | Description |
|--------------|---------|-------------|
| `PLUGIN_PATH` | `./` | Path to your plugin directory |
| `PORT` | `3000` | Server port |
| `ES_URL` | `http://localhost:9200` | Elasticsearch URL |
| `ES_USERNAME` | `elastic` | ES username |
| `ES_PASSWORD` | `changeme` | ES password |
| `MOCK_ES` | `false` | Set to `true` for fully offline development |

## Fully Offline Mode

Don't have Elasticsearch running? Use mock mode:

```bash
PLUGIN_PATH=../my-plugin MOCK_ES=true npm start
```

The mock server will simulate ES responses (empty results, successful creates/deletes).

## What's Mocked

| Kibana API | Mock Behavior |
|------------|---------------|
| `context.core.elasticsearch.client` | Real ES client (or mocked) |
| `context.core.savedObjects.client` | In-memory saved objects store |
| `request.params` | Extracted from URL path |
| `request.query` | From query string |
| `request.body` | From JSON body |
| `response.ok/created/notFound/...` | Express response helpers |

## What's NOT Mocked (requires real Kibana)

- Saved object migrations
- Security/RBAC (all requests are "superuser")
- UI rendering
- Dashboard integration
- Full request lifecycle (interceptors, etc.)
- Plugin dependencies (other plugins' APIs)

## Plugin Route Structure

Your plugin should export routes like:

```typescript
// server/routes/index.ts
import { IRouter } from '@kbn/core/server';

export function registerRoutes(router: IRouter, deps: any) {
  router.get(
    {
      path: '/api/my_plugin/items',
      validate: {},
    },
    async (context, request, response) => {
      const coreContext = await context.core;
      const esClient = coreContext.elasticsearch.client.asCurrentUser;

      const result = await esClient.search({ index: 'my-index' });
      return response.ok({ body: result.hits.hits });
    }
  );
}
```

## Development Workflow

1. **Start the mock server** (once)
2. **Edit your route handlers**
3. **Server auto-reloads** (< 1 second)
4. **Test with curl or your frontend**
5. **Repeat 2-4** until it works
6. **Test in real Kibana** (final verification)

This lets you iterate 10-50x faster on route logic before doing the slow Kibana integration test.

## Limitations

- Schema validation is simplified (not full `@kbn/config-schema`)
- No plugin lifecycle (setup/start)
- No inter-plugin communication
- Hot reload may not catch all TypeScript compilation errors

For production testing, always verify in real Kibana before shipping.
