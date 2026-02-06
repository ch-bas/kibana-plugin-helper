# Kibana Plugin Dev MCP Server

A custom MCP server designed specifically for Kibana plugin development workflows. Provides tools that complement the Elasticsearch and Kibana MCP servers with development-specific capabilities.

## Tools

| Tool | Description |
|------|-------------|
| `get_kibana_version` | Read Kibana version from source tree |
| `get_plugin_info` | Parse `kibana.jsonc`, resolve dependencies |
| `list_registered_types` | List all saved object types in Kibana source (avoid naming conflicts) |
| `search_kibana_api` | Search for API usage patterns across the Kibana codebase |
| `check_api_compatibility` | Verify if an API/import exists in the current Kibana version |
| `run_type_check` | Execute `tsc --noEmit` on your plugin |
| `list_eui_icons` | Browse available EUI icons with optional filter |
| `get_breaking_changes` | Extract breaking changes between Kibana versions |

## Setup

```bash
cd mcp-server
npm install
```

## Configuration

Set environment variables:

```bash
export KIBANA_ROOT=/path/to/kibana          # Kibana source checkout
export PLUGIN_ROOT=/path/to/your-plugin     # Your plugin directory
```

Add to `.mcp.json`:

```json
{
  "mcpServers": {
    "kibana-plugin-dev": {
      "command": "node",
      "args": ["/path/to/mcp-server/index.mjs"],
      "env": {
        "KIBANA_ROOT": "/path/to/kibana",
        "PLUGIN_ROOT": "/path/to/your-plugin"
      }
    }
  }
}
```

## Full Stack Configuration

Combine with ES and Kibana MCP servers for the complete experience:

```json
{
  "mcpServers": {
    "elasticsearch": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "--network", "host",
        "-e", "ES_URL=https://localhost:9200",
        "-e", "ES_API_KEY=your-key",
        "docker.elastic.co/mcp/elasticsearch"]
    },
    "kibana-plugin-dev": {
      "command": "node",
      "args": ["/path/to/mcp-server/index.mjs"],
      "env": {
        "KIBANA_ROOT": "/path/to/kibana",
        "PLUGIN_ROOT": "/path/to/your-plugin"
      }
    }
  }
}
```

## Requirements

- Node.js 18+
- Kibana source checkout (for source introspection tools)
- Your plugin directory (for type checking)
