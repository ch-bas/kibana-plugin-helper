# Kibana MCP Integration Guide

## Overview

The `kibana-plugin-helper` plugin provides **static knowledge** (skill docs, commands, agents) for building Kibana plugins. MCP servers provide **live access** to running Kibana and Elasticsearch instances. Together, Claude Code gets both the domain expertise AND real-time cluster context — meaning it can write code that matches your actual index mappings, existing saved objects, current plugin structure, and live API responses.

```
┌──────────────────────────────────────────────────────────┐
│                     Claude Code                          │
│                                                          │
│  ┌─────────────────────┐   ┌──────────────────────────┐ │
│  │ kibana-plugin-helper │   │     MCP Servers           │ │
│  │                      │   │                           │ │
│  │ • /new-plugin        │   │ • Elasticsearch MCP       │ │
│  │ • /route             │   │   (indices, mappings,     │ │
│  │ • /saved-object      │   │    queries, health)       │ │
│  │ • /embeddable        │   │                           │ │
│  │ • /ui-action         │   │ • Kibana MCP              │ │
│  │ • /expression        │   │   (dashboards, saved      │ │
│  │ • Performance agent  │   │    objects, data views)    │ │
│  │ • Debugger agent     │   │                           │ │
│  │ • Migration agent    │   │ • Plugin Dev MCP          │ │
│  │ • A11y agent         │   │   (Kibana source, API     │ │
│  │ • SKILL.md (4000+    │   │    introspection, build)  │ │
│  │   lines of patterns) │   │                           │ │
│  └─────────────────────┘   └──────────────────────────┘ │
│         Knowledge               Live Data                │
└──────────────────────────────────────────────────────────┘
```

---

## Integration Tiers

### Tier 1: Elasticsearch MCP (Essential)

Elastic's official MCP server gives Claude Code direct access to your cluster data. This is the most impactful integration.

**What it unlocks:**
- Claude reads your actual index mappings when generating ES queries in routes
- Checks cluster health before suggesting performance optimizations
- Lists real indices when scaffolding data views or index patterns
- Tests queries against live data to verify they work

**Setup with Docker (recommended):**

```bash
# Pull the official Elastic MCP server
docker pull docker.elastic.co/mcp/elasticsearch
```

Add to your Claude Code MCP config (`.mcp.json` in your project root or `~/.claude/mcp.json` globally):

```json
{
  "mcpServers": {
    "elasticsearch": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-e", "ES_URL",
        "-e", "ES_API_KEY",
        "docker.elastic.co/mcp/elasticsearch"
      ],
      "env": {
        "ES_URL": "https://localhost:9200",
        "ES_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Alternative — local username/password:**

```json
{
  "mcpServers": {
    "elasticsearch": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "--network", "host",
        "-e", "ES_URL=https://localhost:9200",
        "-e", "ES_USERNAME=elastic",
        "-e", "ES_PASSWORD=changeme",
        "docker.elastic.co/mcp/elasticsearch"
      ]
    }
  }
}
```

**Available tools:**
- `list_indices` — List all ES indices
- `get_mappings` — Get field mappings for an index
- `search` — Execute ES queries with full Query DSL
- `get_shards` — Shard information and allocation

**How the plugin uses it:**
When you run `/route` or `/saved-object`, Claude Code can first call `get_mappings` to understand your actual data structure, then generate route handlers with correct field names and types.

---

### Tier 2: Kibana MCP (Recommended)

A Kibana-specific MCP server adds access to dashboards, saved objects, data views, and visualizations.

**What it unlocks:**
- Claude reads existing saved object types when generating new ones (avoids naming conflicts)
- Inspects dashboard layouts when building embeddables
- Lists data views when scaffolding search functionality
- Exports/imports saved objects for testing

**Setup (jb-kibana-mcp):**

```bash
git clone https://github.com/jerrelblankenship/jb-kibana-mcp.git
cd jb-kibana-mcp
npm install
cp .env.example .env
# Edit .env with your Kibana URL and credentials
```

```json
{
  "mcpServers": {
    "elasticsearch": { "..." : "..." },
    "kibana": {
      "command": "node",
      "args": ["path/to/jb-kibana-mcp/src/index.js"],
      "env": {
        "KIBANA_URL": "https://localhost:5601",
        "KIBANA_API_KEY": "your-kibana-api-key",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

**Or with Docker:**

```json
{
  "mcpServers": {
    "kibana": {
      "url": "http://localhost:3000",
      "env": {
        "KIBANA_URL": "https://localhost:5601",
        "KIBANA_API_KEY": "your-api-key",
        "MCP_TRANSPORT": "http",
        "HTTP_PORT": "3000"
      }
    }
  }
}
```

**Available resources & tools:**
- List dashboards, visualizations, saved searches, data views
- Export dashboard definitions
- Execute ES queries through Kibana's proxy (inherits Kibana security)
- Read saved object details

---

### Tier 3: Kibana Agent Builder MCP (Kibana 9.2+ / Serverless)

If you're on Kibana 9.2+ or Elastic Serverless, the built-in Agent Builder MCP server is the most powerful option — it exposes all Elastic's built-in tools plus any custom tools you define.

**Setup:**

```json
{
  "mcpServers": {
    "elastic-agent-builder": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-kibana.cloud.es.io/api/agent_builder/mcp",
        "--header",
        "Authorization: ApiKey your-api-key"
      ]
    }
  }
}
```

**API key requirements:**
```json
POST /_security/api_key
{
  "name": "claude-code-mcp-key",
  "role_descriptors": {
    "mcp-access": {
      "cluster": ["monitor"],
      "indices": [
        {
          "names": ["*"],
          "privileges": ["read", "view_index_metadata"]
        }
      ],
      "applications": [
        {
          "application": "kibana-.kibana",
          "privileges": ["read_onechat", "space_read"],
          "resources": ["space:default"]
        }
      ]
    }
  }
}
```

---

## Combined Configuration

Here's a complete `.mcp.json` that combines the plugin with both MCP tiers:

```json
{
  "mcpServers": {
    "elasticsearch": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "--network", "host",
        "-e", "ES_URL=https://localhost:9200",
        "-e", "ES_USERNAME=elastic",
        "-e", "ES_PASSWORD=changeme",
        "docker.elastic.co/mcp/elasticsearch"
      ]
    },
    "kibana": {
      "command": "node",
      "args": ["/path/to/jb-kibana-mcp/src/index.js"],
      "env": {
        "KIBANA_URL": "https://localhost:5601",
        "KIBANA_USERNAME": "elastic",
        "KIBANA_PASSWORD": "changeme",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

Then install the plugin separately:
```bash
claude /plugin install your-username/kibana-plugin-helper
```

Now Claude Code has:
- **Knowledge** from the plugin (how to build Kibana plugins correctly)
- **ES data** from the ES MCP (real mappings, indices, query testing)
- **Kibana context** from the Kibana MCP (dashboards, saved objects, data views)

---

## Practical Workflows

### Workflow 1: "Generate a saved object type for my existing data"

1. Claude Code uses ES MCP → `get_mappings` on your index to see the actual field types
2. Claude Code uses the plugin → `/saved-object` command to scaffold the type
3. The generated mappings match your real data — no guessing

### Workflow 2: "Add my widget to existing dashboards"

1. Claude Code uses Kibana MCP → lists dashboards, reads their panel layout
2. Claude Code uses the plugin → `/embeddable` to generate the embeddable
3. Claude Code uses the plugin's embeddable skill → correct factory registration
4. The generated embeddable is compatible with the actual dashboard version

### Workflow 3: "Debug why my route returns 404"

1. Claude Code uses the debugger agent → systematic diagnosis checklist
2. Claude Code uses Kibana MCP → checks if the plugin is actually loaded
3. Claude Code uses ES MCP → verifies the index exists and is accessible
4. Concrete fix with full context

### Workflow 4: "Optimize my ES queries"

1. Claude Code uses the performance agent → identifies N+1 patterns, missing pagination
2. Claude Code uses ES MCP → `search` to test the current query performance
3. Claude Code uses ES MCP → `get_mappings` to verify field types for optimization
4. Generates optimized queries tested against real data

### Workflow 5: "Migrate my plugin from 8.4 to 8.15"

1. Claude Code uses the migration agent → identifies all breaking changes
2. Claude Code uses Kibana MCP → checks the target Kibana version's APIs
3. Claude Code reads the plugin source → finds every affected pattern
4. Produces ordered migration plan with tested replacements

---

## Building a Custom Plugin Dev MCP Server

For maximum integration, you can build a custom MCP server tailored to Kibana plugin development. This server would provide tools that neither the ES nor Kibana MCP servers offer:

### Proposed Tools

| Tool | Description | Use Case |
|------|-------------|----------|
| `get_kibana_version` | Returns the Kibana version from `package.json` | Migration agent needs this |
| `list_plugin_types` | Lists all registered saved object types | Avoid naming conflicts |
| `check_api_exists` | Checks if a Kibana API exists in the current version | Version compatibility |
| `get_plugin_deps` | Reads `kibana.jsonc` and resolves the dependency tree | Dependency management |
| `run_type_check` | Executes `tsc --noEmit` and returns errors | Build verification |
| `search_kibana_source` | Searches the Kibana source tree for API usage examples | Learning by example |
| `get_changelog` | Returns breaking changes between two versions | Migration planning |
| `list_eui_icons` | Lists available EUI icons | UI development |
| `validate_route` | Tests a route against the running Kibana instance | Route debugging |

See `mcp-server/` directory in this repository for a reference implementation.

---

## Security Considerations

- **Never commit API keys** — use environment variables or `.env` files (add to `.gitignore`)
- **Use read-only API keys** for development MCP servers — Claude Code doesn't need write access to your production cluster
- **Scope API keys narrowly** — only grant access to indices and spaces your plugin needs
- **Use a development cluster** — don't point MCP servers at production Elasticsearch
- **Review MCP tool calls** — Claude Code shows you what tools it's calling; verify before accepting changes that modify data

```bash
# Generate a read-only API key for development
curl -X POST "localhost:9200/_security/api_key" -H 'Content-Type: application/json' -d'
{
  "name": "claude-code-dev-readonly",
  "role_descriptors": {
    "readonly": {
      "cluster": ["monitor"],
      "indices": [{ "names": ["*"], "privileges": ["read", "view_index_metadata"] }]
    }
  }
}'
```
