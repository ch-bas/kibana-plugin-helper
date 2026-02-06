---
description: Generate a .mcp.json configuration file that connects Claude Code to Elasticsearch and Kibana MCP servers alongside this plugin, enabling live cluster access during plugin development
---

# Generate MCP Configuration

Set up MCP server connections so Claude Code has live access to your Elasticsearch cluster and Kibana instance while developing plugins. Ask the user for:

1. **Which MCP servers?** Options:
   - Elasticsearch MCP only (recommended minimum)
   - Elasticsearch + Kibana MCP (recommended for full-stack plugin dev)
   - Elasticsearch + Kibana Agent Builder MCP (for Kibana 9.2+ / Serverless)

2. **Elasticsearch connection:**
   - URL (default: `https://localhost:9200`)
   - Auth method: API key, username/password, or cloud ID
   - SSL verification (default: true)

3. **Kibana connection (if selected):**
   - URL (default: `https://localhost:5601`)
   - Auth method: API key or username/password
   - For Agent Builder: Kibana Cloud URL

4. **Docker or local?**
   - Docker (recommended — no local install needed)
   - Local Node.js (for Kibana MCP community server)

5. **Scope:**
   - Project-level (`.mcp.json` in project root)
   - Global (`~/.claude/mcp.json`)

## Generation Steps

1. Collect all connection details
2. Generate `.mcp.json` with the selected MCP servers
3. Generate a `.env` file for secrets (if not using env vars already)
4. Add `.env` to `.gitignore` if not already present
5. Test the connection by describing how to verify with `claude /mcp`

## Important Rules

- Never hardcode API keys or passwords in `.mcp.json` — always use environment variable references
- Always recommend read-only API keys for development
- Remind the user to add `.env` to `.gitignore`
- For Docker-based ES MCP, use `--network host` when ES runs on localhost
- For the Kibana community MCP server, verify the user has cloned and installed it
- Test connectivity: after generating, tell the user to run `claude /mcp` to verify servers are connected
- Recommend starting with ES MCP alone — it covers 80% of use cases

## Template: ES MCP Only (Docker)

```json
{
  "mcpServers": {
    "elasticsearch": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "--network", "host",
        "-e", "ES_URL",
        "-e", "ES_API_KEY",
        "docker.elastic.co/mcp/elasticsearch"
      ],
      "env": {
        "ES_URL": "${ELASTICSEARCH_URL}",
        "ES_API_KEY": "${ELASTICSEARCH_API_KEY}"
      }
    }
  }
}
```

## Template: ES + Kibana MCP (Docker + Node)

```json
{
  "mcpServers": {
    "elasticsearch": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "--network", "host",
        "-e", "ES_URL",
        "-e", "ES_API_KEY",
        "docker.elastic.co/mcp/elasticsearch"
      ],
      "env": {
        "ES_URL": "${ELASTICSEARCH_URL}",
        "ES_API_KEY": "${ELASTICSEARCH_API_KEY}"
      }
    },
    "kibana": {
      "command": "node",
      "args": ["${KIBANA_MCP_PATH}/src/index.js"],
      "env": {
        "KIBANA_URL": "${KIBANA_URL}",
        "KIBANA_API_KEY": "${KIBANA_API_KEY}",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## Template: Agent Builder MCP (Kibana 9.2+)

```json
{
  "mcpServers": {
    "elastic-agent-builder": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${KIBANA_URL}/api/agent_builder/mcp",
        "--header",
        "Authorization: ApiKey ${KIBANA_API_KEY}"
      ]
    }
  }
}
```

## Post-Generation Checklist

Tell the user:
1. `claude /mcp` — verify servers appear and tools are available
2. Test with a simple query: "List my Elasticsearch indices"
3. If connection fails, check: URL, credentials, network (Docker needs `--network host` for localhost)
4. Remind: API keys should be read-only for safety
