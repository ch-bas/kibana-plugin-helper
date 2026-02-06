# Kibana Plugin Helper — Getting Started Guide

A step-by-step guide to using the `kibana-plugin-helper` Claude Code plugin for Kibana plugin development.

---

## Prerequisites

- [Claude Code](https://claude.ai/code) installed
- Node.js 18+ 
- A Kibana source checkout (for plugin development)
- Elasticsearch running locally (optional, for MCP integration)

---

## Step 1: Install the Plugin

```bash
# Add the marketplace (once)
claude /plugin marketplace add your-username/kibana-plugin-helper

# Install the plugin
claude /plugin install kibana-plugin-helper
```

Verify installation:
```bash
claude /help
```

You should see new commands like `/new-plugin`, `/route`, `/saved-object`, etc.

---

## Step 2: Create a New Plugin

```bash
# Navigate to your Kibana plugins directory
cd /path/to/kibana/plugins

# Run the command
claude /new-plugin
```

Claude will ask you:
1. Plugin ID (snake_case, e.g., `my_awesome_plugin`)
2. Plugin name (human-readable)
3. Description
4. Server-side, browser-side, or both?
5. Required dependencies

**Output:** A complete plugin scaffold:
```
my_awesome_plugin/
├── kibana.jsonc
├── tsconfig.json
├── common/
│   └── index.ts
├── public/
│   ├── plugin.ts
│   ├── index.ts
│   └── application.tsx
└── server/
    ├── plugin.ts
    ├── index.ts
    └── routes/
        └── index.ts
```

---

## Step 3: Add Routes

```bash
claude /route
```

Claude will ask:
1. HTTP method (GET, POST, PUT, DELETE)
2. Route path (e.g., `/api/my_plugin/items`)
3. What it does
4. Request parameters, query, body schema
5. What it returns

**Output:** Route handler with validation, error handling, and TypeScript types.

Example generated code:
```typescript
router.get(
  {
    path: '/api/my_plugin/items',
    validate: {
      query: schema.object({
        page: schema.number({ defaultValue: 1 }),
        perPage: schema.number({ defaultValue: 20 }),
      }),
    },
  },
  async (context, request, response) => {
    const coreContext = await context.core;
    const esClient = coreContext.elasticsearch.client.asCurrentUser;
    // ... implementation
  }
);
```

---

## Step 4: Add Saved Objects

```bash
claude /saved-object
```

Claude will ask:
1. Type name (snake_case)
2. Attributes with types
3. Namespace type (single/multiple/agnostic)
4. Need migrations?
5. Import/export support?

**Output:**
- Type registration in `server/saved_objects/`
- CRUD service in `server/services/`
- Migration scaffolding if needed

---

## Step 5: Add Embeddables (Dashboard Panels)

```bash
claude /embeddable
```

Claude will ask:
1. Embeddable type ID
2. What it renders
3. Input parameters (from dashboard)
4. Output parameters (to dashboard)
5. Classic or React pattern (Kibana 8.8+)?

**Output:**
- Embeddable class
- Factory registration
- React component
- Input/output type definitions

---

## Step 6: Add UI Actions

```bash
claude /ui-action
```

For adding items to dashboard context menus, handling clicks, creating drilldowns.

---

## Step 7: Add Expressions

```bash
claude /expression
```

For Canvas/Lens custom functions and renderers.

---

## Step 8: Set Up Fast Development

Kibana takes 2-5 minutes to start. Skip that:

```bash
claude /fast-dev
```

This sets up:
- **Mock server** — test routes without Kibana (<1 sec startup)
- **Optimized config** — faster Kibana when you need it
- **Test infrastructure** — Jest with Kibana mocks
- **Storybook** — UI component development

### Using the Mock Server

```bash
cd your-plugin/dev/mock-server
npm install
npm start
```

Output:
```
🚀 Kibana Plugin Mock Server

   Plugin:  ../../
   ES:      http://localhost:9200
   Port:    3000

  📍 GET /api/my_plugin/items
  📍 POST /api/my_plugin/items

🟢 Mock server running at http://localhost:3000
```

Test your routes instantly:
```bash
curl http://localhost:3000/api/my_plugin/items
```

Edit a route file → server hot reloads → test again. No Kibana restart.

---

## Step 9: Set Up MCP Integration (Optional)

Connect Claude Code to your live Elasticsearch cluster:

```bash
claude /mcp-config
```

Claude will ask:
1. Which MCP servers? (ES, Kibana, or both)
2. Connection details

**Output:** `.mcp.json` configuration file.

### What MCP Enables

With MCP connected, Claude Code can:
- Read your actual index mappings when generating ES queries
- List existing saved object types (avoid naming conflicts)
- Test queries against real data
- Check cluster health

Example workflow:
```
You: "Generate a route that searches my logs-* index"

Claude Code:
1. Calls ES MCP → get_mappings("logs-*")
2. Sees your actual fields: @timestamp, message, level, host.name
3. Generates route with correct field names and types
```

---

## Step 10: Use Agents for Specific Tasks

### Performance Analysis

```
You: "Analyze my plugin for performance issues"

Claude Code uses the kibana-performance agent to:
- Check bundle size and code splitting
- Find React re-render issues
- Identify N+1 ES query patterns
- Spot memory leaks
```

### Debugging

```
You: "My route returns 404, here's the error..."

Claude Code uses the kibana-debugger agent to:
- Systematically diagnose the issue
- Check common causes
- Provide concrete fix
```

### Version Migration

```
You: "Migrate my plugin from 8.4 to 8.15"

Claude Code uses the kibana-migration agent to:
- Identify all breaking changes
- Generate ordered migration plan
- Provide before/after code examples
```

### Accessibility Audit

```
You: "Check my plugin for accessibility issues"

Claude Code uses the kibana-a11y agent to:
- Audit against WCAG 2.1 AA
- Check EUI component usage
- Find keyboard navigation issues
```

### Fast Development Help

```
You: "I'm changing routes and it's slow"

Claude Code uses the kibana-fast-dev agent to:
- Identify what can skip Kibana restart
- Suggest mock server or unit tests
- Set up faster workflow
```

---

## Common Workflows

### Workflow A: New Feature End-to-End

```bash
# 1. Create the plugin (if new)
claude /new-plugin

# 2. Add a saved object type
claude /saved-object

# 3. Add CRUD routes
claude /route  # repeat for each route

# 4. Set up fast dev
claude /fast-dev

# 5. Develop with mock server
cd dev/mock-server && npm start

# 6. Test routes
curl http://localhost:3000/api/my_plugin/items

# 7. When ready, test in real Kibana
yarn start
```

### Workflow B: Add Dashboard Integration

```bash
# 1. Create embeddable
claude /embeddable

# 2. Add to context menu (optional)
claude /ui-action

# 3. Test in Storybook first
yarn storybook my-plugin

# 4. Then test in real dashboard
yarn start
```

### Workflow C: Debug an Issue

```
You: "I'm getting this error: [paste error]"

Claude Code:
1. Uses debugger agent
2. Identifies root cause
3. Provides fix with code
```

### Workflow D: Upgrade Kibana Version

```
You: "Upgrade my plugin from 8.10 to 8.17"

Claude Code:
1. Uses migration agent
2. Lists all breaking changes
3. Generates migration plan
4. Provides code transformations
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `/new-plugin` | Scaffold a new Kibana plugin |
| `/route` | Add an API route |
| `/saved-object` | Add a saved object type |
| `/embeddable` | Add a dashboard embeddable |
| `/ui-action` | Add UI actions/triggers |
| `/expression` | Add expression functions |
| `/fast-dev` | Set up fast development environment |
| `/mcp-config` | Configure MCP server connections |

| Agent | Trigger |
|-------|---------|
| `kibana-performance` | "analyze performance", "check bundle size" |
| `kibana-debugger` | "debug this error", "why is X not working" |
| `kibana-migration` | "migrate from X to Y", "upgrade to 8.x" |
| `kibana-a11y` | "accessibility audit", "check a11y" |
| `kibana-fast-dev` | "speed up development", "too slow" |

---

## Tips

1. **Start with `/fast-dev`** — set up the mock server before heavy route development
2. **Use MCP** — Claude Code is much smarter with live cluster access
3. **Read the skill** — Claude Code has 4000+ lines of Kibana knowledge; ask it anything
4. **Test in isolation** — Storybook for UI, Jest for logic, mock server for routes
5. **Real Kibana last** — only boot full Kibana for final integration testing

---

## Troubleshooting

### Plugin not appearing in Claude Code

```bash
# Check installed plugins
claude /plugin list

# Reinstall if needed
claude /plugin uninstall kibana-plugin-helper
claude /plugin install kibana-plugin-helper
```

### MCP not connecting

```bash
# Verify MCP servers
claude /mcp

# Check your .mcp.json configuration
cat .mcp.json
```

### Mock server not loading routes

Make sure your routes are exported correctly:
```typescript
// server/routes/index.ts
export function registerRoutes(router: IRouter) {
  // ... routes
}
```

---

## Next Steps

- Browse the skill documentation: ask Claude "explain Kibana saved objects"
- Try the agents: "analyze my plugin for performance issues"
- Connect MCP: `/mcp-config` for live cluster integration
- Share with your team: publish your own marketplace
