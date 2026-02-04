---
description: Generate a new server-side Kibana route with validation, Elasticsearch client usage, error handling, and optional auth
---

# Generate Kibana Server Route

Create a new server route handler for an existing Kibana plugin. Ask the user for:

1. **Route path** (e.g. `/api/my_plugin/users`)
2. **HTTP method(s)** (GET, POST, PUT, DELETE — or full CRUD set)
3. **What it does** (brief description of the route's purpose)
4. **Validation schema** (what params/query/body fields are needed)
5. **Needs authentication?** (default: yes)
6. **Elasticsearch index** it operates on (if applicable)

## Generation Rules

- Create the route file in `server/routes/` following the naming convention `{resource}_routes.ts`
- Always use `@kbn/config-schema` for validation — never skip validation
- Always use `asCurrentUser` for the ES client unless the user explicitly needs `asInternalUser`
- Always wrap handler logic in try/catch with proper error responses
- Use `response.ok()`, `response.notFound()`, `response.badRequest()`, `response.customError()` appropriately
- If generating CRUD routes, create all four operations (list/get/create/update/delete) in the same file
- Add `refresh: 'wait_for'` on write operations by default
- Register the new route in `server/routes/index.ts`
- Use the Kibana Logger for error logging
- If auth is needed, include `security.authz.requiredPrivileges` in the route config
- Include JSDoc comments explaining each route

## CRUD Template Pattern

For full CRUD, generate these routes:
- `GET /api/{plugin}/{resource}` — List with pagination (page, perPage, search, sortField, sortOrder)
- `GET /api/{plugin}/{resource}/{id}` — Get single item
- `POST /api/{plugin}/{resource}` — Create
- `PUT /api/{plugin}/{resource}/{id}` — Update
- `DELETE /api/{plugin}/{resource}/{id}` — Delete

Always include proper pagination support in list routes with `from`, `size`, and total count in response.
