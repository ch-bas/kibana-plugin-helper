[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Plugin-blueviolet)](https://docs.anthropic.com/en/docs/claude-code)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
# kibana-plugin-helper

A Claude Code plugin that gives Claude deep expertise in Kibana plugin development.

## Local Installation (No GitHub Required)

### Option 1: Direct Plugin Directory (Recommended for Development)

```bash
# Clone or copy this directory to your machine
# Then load it directly when running Claude Code:

claude --plugin-dir /path/to/kibana-plugin-helper
```

Every time you start Claude Code with this flag, the plugin is loaded.

### Option 2: Add to Claude Code Settings

Add the plugin path to your Claude Code settings file:

**Linux/macOS:** `~/.claude/settings.json`
**Windows:** `%APPDATA%\claude\settings.json`

```json
{
  "pluginDirs": [
    "/path/to/kibana-plugin-helper"
  ]
}
```

Then restart Claude Code — the plugin loads automatically every session.

### Option 3: Create a Local Marketplace

```bash
# Create a local marketplace directory
mkdir -p ~/claude-plugins/.claude-plugin

# Create the marketplace manifest
cat > ~/claude-plugins/.claude-plugin/marketplace.json << 'EOF'
{
  "name": "local-marketplace",
  "description": "My local Claude Code plugins",
  "plugins": ["kibana-plugin-helper"]
}
EOF

# Copy or symlink the plugin into the marketplace
cp -r /path/to/kibana-plugin-helper ~/claude-plugins/

# Add the marketplace to Claude Code
claude /plugin marketplace add ~/claude-plugins

# Install the plugin
claude /plugin install kibana-plugin-helper
```

## Verify Installation

```bash
# Check if plugin is loaded
claude /help
```

You should see commands like `/new-plugin`, `/route`, `/saved-object`, etc.

## Quick Start

```bash
cd /path/to/kibana/plugins

# Create a new plugin
claude /new-plugin

# Add a route
claude /route

# Add a saved object type
claude /saved-object

# Set up fast development (avoid Kibana restarts)
claude /fast-dev
```

## What's Included

### Commands (8)

| Command | Description |
|---------|-------------|
| `/new-plugin` | Scaffold a complete Kibana plugin |
| `/route` | Generate server routes with validation |
| `/saved-object` | Create saved object types with CRUD |
| `/embeddable` | Create dashboard embeddable widgets |
| `/ui-action` | Create triggers/actions for inter-plugin communication |
| `/expression` | Create expression functions for Canvas/Lens |
| `/mcp-config` | Set up Elasticsearch/Kibana MCP connections |
| `/fast-dev` | Set up fast development environment |

### Agents (5)

| Agent | Trigger |
|-------|---------|
| `kibana-debugger` | Errors, "debug", "not working" |
| `kibana-performance` | "analyze performance", "slow" |
| `kibana-a11y` | "accessibility", "a11y audit" |
| `kibana-migration` | "migrate from X to Y", "upgrade" |
| `kibana-fast-dev` | "speed up", "too slow to start" |

### Skill (3,600+ lines)

Comprehensive knowledge covering:
- Saved Objects (types, migrations, CRUD, references)
- Embeddables (classic + React patterns, factories)
- UI Actions (triggers, actions, context menus)
- Expressions (functions, renderers, Canvas/Lens)
- State Management (URL sync, global state)
- Logging & Monitoring (structured logs, telemetry)
- HTTP Resources (static assets, CSP)
- Inter-Plugin Dependencies (contracts, type sharing)
- Fast Development (mock server, testing)

### Tools

#### Mock Server (`tools/mock-server/`)

Test routes without running Kibana:

```bash
cd tools/mock-server
npm install

# Point to your plugin
PLUGIN_PATH=/path/to/your-plugin npm start

# Test routes instantly
curl http://localhost:3000/api/your_plugin/items
```

#### MCP Server (`tools/mcp-server/`)

Custom MCP server for plugin development:

```bash
cd tools/mcp-server
npm install

# Add to your .mcp.json
```

## Directory Structure

```
kibana-plugin-helper/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── commands/                  # Slash commands
│   ├── new-plugin.md
│   ├── route.md
│   ├── saved-object.md
│   ├── embeddable.md
│   ├── ui-action.md
│   ├── expression.md
│   ├── mcp-config.md
│   └── fast-dev.md
├── agents/                    # Specialized agents
│   ├── kibana-debugger.md
│   ├── kibana-performance.md
│   ├── kibana-a11y.md
│   ├── kibana-migration.md
│   └── kibana-fast-dev.md
├── skills/
│   └── kibana-plugin-dev/
│       └── SKILL.md          # 3,600+ lines of Kibana knowledge
├── tools/
│   ├── mock-server/          # Route testing without Kibana
│   └── mcp-server/           # Custom MCP for plugin dev
└── README.md
```

## Requirements

- Claude Code
- Node.js 18+ (for tools)
- (Optional) Kibana source checkout
- (Optional) Elasticsearch for MCP

## Usage Examples

### Create a Complete Plugin

```bash
claude /new-plugin
# Answer: my_metrics, My Metrics, Track metrics, yes, yes, yes

claude /route
# Answer: GET /api/my_metrics/data, returns metrics from ES

claude /saved-object  
# Answer: my_metrics_config, name/enabled/thresholds

claude /fast-dev
# Sets up mock server for instant iteration
```

### Debug an Issue

```
You: "My route returns 404, here's the error: [paste error]"

Claude: Uses kibana-debugger agent to diagnose and fix
```

### Upgrade Kibana Version

```
You: "Migrate my plugin from 8.4 to 8.15"

Claude: Uses kibana-migration agent to list breaking changes and provide fixes
```

## Tips

1. **Use `--plugin-dir` for development** — reload changes by restarting Claude Code
2. **Add to settings for permanent install** — always available
3. **Use mock server** — 1 second vs 5 minute iteration cycles
4. **Ask Claude anything** — 3,600 lines of Kibana knowledge available
