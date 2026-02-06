---
description: Generate a Kibana server route with proper validation, error handling, and TypeScript types. Supports all HTTP methods and common patterns like CRUD operations and Elasticsearch queries.
---

# Generate Server Route

Create a server-side route for your Kibana plugin. Ask the user for:

1. **HTTP method:** GET, POST, PUT, DELETE, PATCH
2. **Route path:** e.g., `/api/my_plugin/items` or `/api/my_plugin/items/{id}`
3. **What it does:** Brief description
4. **Request parameters:**
   - Path params (from URL, e.g., `{id}`)
   - Query params (e.g., `?page=1&perPage=20`)
   - Body (for POST/PUT/PATCH)
5. **Response:** What it returns
6. **Needs authentication?** (default: yes)
7. **Data source:** Elasticsearch, Saved Objects, or external API

## Route Template

```typescript
import { schema } from '@kbn/config-schema';
import type { IRouter } from '@kbn/core/server';

export function register{RouteName}Route(router: IRouter) {
  router.{method}(
    {
      path: '{route_path}',
      options: {
        tags: ['access:{plugin_id}'],
      },
      validate: {
        params: schema.object({
          // Path parameters
          id: schema.string(),
        }),
        query: schema.object({
          // Query parameters
          page: schema.number({ defaultValue: 1, min: 1 }),
          perPage: schema.number({ defaultValue: 20, min: 1, max: 100 }),
          search: schema.maybe(schema.string()),
        }),
        body: schema.object({
          // Body parameters (POST/PUT/PATCH)
          name: schema.string({ minLength: 1, maxLength: 255 }),
          enabled: schema.boolean({ defaultValue: true }),
        }),
      },
    },
    async (context, request, response) => {
      try {
        const coreContext = await context.core;
        const { id } = request.params;
        const { page, perPage, search } = request.query;
        const { name, enabled } = request.body;

        // Implementation here

        return response.ok({
          body: {
            // Response data
          },
        });
      } catch (error) {
        // Error handling
        if (error.output?.statusCode === 404) {
          return response.notFound({
            body: { message: error.message },
          });
        }
        return response.customError({
          statusCode: error.output?.statusCode || 500,
          body: { message: error.message },
        });
      }
    }
  );
}
```

## Elasticsearch Query Pattern

```typescript
async (context, request, response) => {
  const coreContext = await context.core;
  const esClient = coreContext.elasticsearch.client.asCurrentUser;
  const { page, perPage, search } = request.query;

  const from = (page - 1) * perPage;

  const result = await esClient.search({
    index: 'my-index-*',
    from,
    size: perPage,
    query: search
      ? {
          bool: {
            must: [{ match: { name: search } }],
          },
        }
      : { match_all: {} },
    sort: [{ '@timestamp': 'desc' }],
  });

  const items = result.hits.hits.map((hit) => ({
    id: hit._id,
    ...hit._source,
  }));

  return response.ok({
    body: {
      items,
      total: typeof result.hits.total === 'number' 
        ? result.hits.total 
        : result.hits.total?.value ?? 0,
      page,
      perPage,
    },
  });
}
```

## Saved Objects Pattern

```typescript
async (context, request, response) => {
  const coreContext = await context.core;
  const soClient = coreContext.savedObjects.client;
  const { page, perPage, search } = request.query;

  const result = await soClient.find({
    type: 'my-saved-object-type',
    page,
    perPage,
    search: search ? `${search}*` : undefined,
    searchFields: ['name', 'description'],
    sortField: 'updated_at',
    sortOrder: 'desc',
  });

  return response.ok({
    body: {
      items: result.saved_objects.map((so) => ({
        id: so.id,
        ...so.attributes,
      })),
      total: result.total,
      page,
      perPage,
    },
  });
}
```

## CRUD Routes Set

For a complete resource, generate these routes:

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/{plugin}/items` | List all |
| POST | `/api/{plugin}/items` | Create |
| GET | `/api/{plugin}/items/{id}` | Get one |
| PUT | `/api/{plugin}/items/{id}` | Update |
| DELETE | `/api/{plugin}/items/{id}` | Delete |

## Schema Validation Types

```typescript
// Required string
schema.string()

// Optional string
schema.maybe(schema.string())

// String with constraints
schema.string({ minLength: 1, maxLength: 255 })

// Number with range
schema.number({ min: 1, max: 100, defaultValue: 20 })

// Boolean with default
schema.boolean({ defaultValue: true })

// Enum
schema.oneOf([schema.literal('draft'), schema.literal('published')])

// Array
schema.arrayOf(schema.string())

// Nested object
schema.object({
  nested: schema.string(),
})

// Record (key-value pairs)
schema.recordOf(schema.string(), schema.any())
```

## Response Helpers

```typescript
// Success responses
response.ok({ body: data })                    // 200
response.created({ body: data })               // 201  
response.noContent()                           // 204

// Error responses
response.badRequest({ body: { message } })     // 400
response.forbidden({ body: { message } })      // 403
response.notFound({ body: { message } })       // 404
response.conflict({ body: { message } })       // 409
response.customError({ statusCode, body })     // Custom
```

## Important Notes

- Routes must be registered in `setup()`, not `start()`
- Always use `await context.core` (async since Kibana 8.1)
- Path must start with `/api/` or `/internal/`
- Use `/internal/` for routes not meant for external use
- Always validate all inputs with schema
- Handle errors appropriately with try/catch
- Use `asCurrentUser` for user-scoped ES operations
- Use `asInternalUser` for system operations (with caution)
