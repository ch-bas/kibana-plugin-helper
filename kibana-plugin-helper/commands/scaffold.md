---
description: Scaffold a new Kibana external plugin with full directory structure, server/public sides, TypeScript config, and boilerplate code
---

# Scaffold Kibana Plugin

Generate a complete Kibana external plugin from scratch. Ask the user for these details before generating:

1. **Plugin ID** (camelCase, e.g. `myAwesomePlugin`)
2. **Plugin display name** (human-readable, e.g. "My Awesome Plugin")
3. **Description**
4. **Features needed**: server-side only, public-side only, or both
5. **Optional dependencies**: security, features, navigation, data
6. **Target Kibana version** (default: 8.x latest)

## Generation Steps

1. Create the full directory structure as defined in the kibana-plugin-dev skill
2. Generate `kibana.jsonc` with the correct plugin ID, dependencies, and config
3. Generate `tsconfig.json` extending Kibana's TypeScript config
4. Generate `common/index.ts` with plugin constants (PLUGIN_ID, PLUGIN_NAME, route paths)
5. Generate `common/types.ts` with shared type definitions
6. If server-side:
   - Generate `server/index.ts`, `server/plugin.ts`, `server/types.ts`
   - Generate `server/routes/index.ts` with a sample health-check route
   - Include proper Logger setup and lifecycle methods
7. If public-side:
   - Generate `public/index.ts`, `public/plugin.ts`, `public/types.ts`
   - Generate `public/application.tsx` with renderApp and KibanaContextProvider
   - Generate `public/app.tsx` with a basic EUI page layout
   - Generate `public/components/` with a sample component
   - Generate `public/services/api.ts` with HTTP client wrapper class
8. Generate a basic `__tests__/` structure with example test files
9. Generate a `README.md` with setup instructions

## Important Rules

- Always use TypeScript (.ts / .tsx)
- Always use `@kbn/config-schema` for route validation
- Always use EUI components for the public side
- Use proper Kibana core type imports from `@kbn/core/server` and `@kbn/core/public`
- Include proper error handling in all route handlers
- Follow Kibana naming conventions (camelCase plugin ID, snake_case routes)
- Make sure server entry point exports the `plugin` function
- Make sure public entry point exports the `plugin` function
