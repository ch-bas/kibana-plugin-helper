---
description: Scaffold a new Kibana plugin with the correct directory structure, configuration files, and TypeScript setup. Generates a complete plugin ready for development.
---

# Create New Kibana Plugin

## CRITICAL: Plugin Location

**Kibana plugins MUST be created inside the Kibana repository** in the `plugins/` directory. They cannot be developed outside the Kibana repo — the build tools require access to Kibana's scripts.

```
kibana/                    <- Kibana repository root
├── plugins/               <- YOUR PLUGINS GO HERE
│   └── my_plugin/         <- Your plugin
├── scripts/               <- Build scripts (plugin-helpers)
├── src/
└── package.json
```

## Recommended: Use Kibana's Built-in Generator

For the most reliable setup, use Kibana's official generator:

```bash
cd /path/to/kibana
node scripts/generate_plugin my_plugin_name
```

This creates a properly configured plugin with all necessary files.

## Manual Creation (if generator unavailable)

Ask the user for:

1. **Plugin ID** (snake_case, e.g., `my_awesome_plugin`)
2. **Display name** (human-readable, e.g., "My Awesome Plugin")
3. **Description** (one sentence)
4. **Plugin type:** Server-side, Browser-side, or Both
5. **Include app in navigation?** (yes/no)

## Generated Structure

```
kibana/plugins/{plugin_id}/
├── kibana.jsonc              # Plugin manifest (Kibana 8.x uses .jsonc)
├── package.json              # NPM package (REQUIRED - specific format)
├── tsconfig.json             # TypeScript config
├── common/
│   └── index.ts
├── public/                   # Browser-side (if selected)
│   ├── index.ts
│   ├── plugin.ts
│   └── types.ts
└── server/                   # Server-side (if selected)
    ├── index.ts
    ├── plugin.ts
    ├── types.ts
    └── routes/
        └── index.ts
```

## package.json Template (REQUIRED - EXACT FORMAT)

For **Kibana 8.x+** — use this minimal format:

```json
{
  "name": "{plugin_id}",
  "version": "1.0.0",
  "private": true
}
```

**That's it!** Modern Kibana 8.x plugins:
- Use `kibana.jsonc` for all plugin metadata
- Don't need scripts in package.json — run everything from Kibana root
- Should NOT have `"main"`, `"kibana"`, or build scripts

### What causes "package plugins" error:

| ❌ DO NOT include | Why it breaks |
|-------------------|---------------|
| `"main": "target/plugin"` | Triggers legacy package detection |
| `"kibana": { "version": "..." }` | Triggers legacy package detection |
| `"scripts": { "build": ... }` | Can confuse the build system |

### Run commands from Kibana root instead:

```bash
cd /path/to/kibana

# Start dev mode (auto-includes plugins/)
yarn start

# Build a specific plugin
node scripts/plugin_helpers build --plugin plugins/my_plugin
```

## kibana.jsonc Template

```jsonc
{
  "type": "plugin",
  "id": "{plugin_id}",
  "version": "1.0.0",
  "owner": {
    "name": "Your Name"
  },
  "description": "{description}",
  "server": true,
  "ui": true,
  "requiredPlugins": [],
  "optionalPlugins": []
}
```

Note: Use `kibana.jsonc` (with 'c') for Kibana 8.x. Older versions use `kibana.json`.

## tsconfig.json Template

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "target/types"
  },
  "include": [
    "common/**/*",
    "public/**/*",
    "server/**/*"
  ],
  "exclude": [
    "target/**/*"
  ]
}
```

## Server Plugin Template

```typescript
// server/plugin.ts
import type {
  CoreSetup,
  CoreStart,
  Plugin,
  PluginInitializerContext,
  Logger,
} from '@kbn/core/server';
import type { {PluginId}PluginSetup, {PluginId}PluginStart } from './types';
import { registerRoutes } from './routes';

export class {PluginClass}Plugin
  implements Plugin<{PluginId}PluginSetup, {PluginId}PluginStart>
{
  private readonly logger: Logger;

  constructor(initializerContext: PluginInitializerContext) {
    this.logger = initializerContext.logger.get();
  }

  public setup(core: CoreSetup) {
    this.logger.debug('{plugin_id}: Setup');
    
    const router = core.http.createRouter();
    registerRoutes(router);

    return {};
  }

  public start(core: CoreStart) {
    return {};
  }

  public stop() {}
}
```

## Public Plugin Template

```typescript
// public/plugin.ts
import type { CoreSetup, CoreStart, Plugin } from '@kbn/core/public';
import type {
  {PluginId}PluginSetup,
  {PluginId}PluginStart,
  {PluginId}SetupDeps,
  {PluginId}StartDeps,
} from './types';
import { PLUGIN_ID, PLUGIN_NAME } from '../common';

export class {PluginClass}Plugin
  implements Plugin<{PluginId}PluginSetup, {PluginId}PluginStart, {PluginId}SetupDeps, {PluginId}StartDeps>
{
  public setup(core: CoreSetup<{PluginId}StartDeps>): {PluginId}PluginSetup {
    // Register app in navigation (if selected)
    core.application.register({
      id: PLUGIN_ID,
      title: PLUGIN_NAME,
      async mount(params) {
        const { renderApp } = await import('./application');
        const [coreStart, depsStart] = await core.getStartServices();
        return renderApp(coreStart, depsStart, params);
      },
    });

    return {};
  }

  public start(core: CoreStart): {PluginId}PluginStart {
    return {};
  }

  public stop() {}
}
```

## Application Template (if nav app)

```typescript
// public/application.tsx
import React from 'react';
import ReactDOM from 'react-dom';
import type { CoreStart, AppMountParameters } from '@kbn/core/public';
import type { {PluginId}StartDeps } from './types';
import { KibanaContextProvider } from '@kbn/kibana-react-plugin/public';

const App = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>{PLUGIN_NAME}</h1>
      <p>Your plugin is ready for development!</p>
    </div>
  );
};

export const renderApp = (
  core: CoreStart,
  deps: {PluginId}StartDeps,
  { element }: AppMountParameters
) => {
  ReactDOM.render(
    <KibanaContextProvider services={{ ...core, ...deps }}>
      <App />
    </KibanaContextProvider>,
    element
  );
  return () => ReactDOM.unmountComponentAtNode(element);
};
```

## common/index.ts Template

```typescript
export const PLUGIN_ID = '{plugin_id}';
export const PLUGIN_NAME = '{display_name}';
```

## Important Notes

1. **Plugin MUST be inside `kibana/plugins/`** — The build tools require this location
2. **Use Kibana's generator when possible** — `node scripts/generate_plugin my_plugin`
3. **package.json must NOT have a `"kibana"` field** — This causes the "package plugins" error
4. **package.json must NOT have `"main": "target/plugin"`** — Also causes errors
5. **The scripts in package.json must reference `../../scripts/`** — Relative path to Kibana root
6. Plugin ID must be snake_case
7. Class names should be PascalCase
8. Register routes in `setup()`, not `start()`
9. Use the logger from `initializerContext`
10. Export plugin function from index.ts: `export function plugin(ctx) { return new Plugin(ctx); }`

## Troubleshooting "package plugins" Error

If you see `ERROR the plugin helpers do not currently support "package plugins"`:

### Fix #1: Simplify package.json

Your `package.json` should be **minimal**:

```json
{
  "name": "my_plugin",
  "version": "1.0.0",
  "private": true
}
```

Remove these if present:
```json
"main": "...",           // ← DELETE THIS
"kibana": { ... },       // ← DELETE THIS  
"scripts": { ... }       // ← DELETE THIS (for 8.x)
```

### Fix #2: Check plugin location

Plugin MUST be at: `kibana/plugins/my_plugin/`

NOT:
- `kibana-extra/my_plugin/` (old location)
- `/some/other/path/my_plugin/` (outside Kibana)

### Fix #3: Run bootstrap

```bash
cd /path/to/kibana
yarn kbn bootstrap
```

### Fix #4: Use the generator

If all else fails, regenerate the plugin:

```bash
cd /path/to/kibana
rm -rf plugins/my_plugin
node scripts/generate_plugin my_plugin
```

## Running Your Plugin

```bash
# From Kibana root directory
cd /path/to/kibana

# Start Kibana in dev mode (includes your plugin)
yarn start

# Or with specific flags
yarn start --verbose
```

## Building for Distribution

```bash
# From your plugin directory
cd kibana/plugins/my_plugin

# Build distributable zip
yarn build
```

This creates a zip in `kibana/plugins/my_plugin/build/` that can be installed on production Kibana.
