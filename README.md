# Kibana Plugin Helper

> A [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) plugin for developing Kibana 8.x+ external plugins.

Built from years of hands-on Kibana plugin development experience — scaffolding, routes, EUI components, security, testing, and production builds in one toolkit.

## Installation

```bash
# Add the marketplace
/plugin marketplace add ch-bas/kibana-plugin-helper

# Install the plugin
/plugin install kibana-plugin-helper@kibana-plugin-helper
```

## Commands

| Command | Description |
|---------|-------------|
| `/scaffold` | Scaffold a complete Kibana plugin (server + public + types + manifest) |
| `/route` | Generate server routes with `@kbn/config-schema` validation and ES client |
| `/component` | Generate EUI-based React components (tables, forms, modals, flyouts) |
| `/test` | Generate tests with Jest and React Testing Library |
| `/security` | Set up RBAC, feature privileges, auth middleware, multi-tenancy |
| `/es-index` | Generate Elasticsearch index templates, mappings, and service layer |
| `/build` | Build and package for production, Docker, and CI/CD pipelines |

## Agents

| Agent | Description |
|-------|-------------|
| `kibana-architect` | Reviews plugin architecture, detects anti-patterns, suggests improvements |
| `kibana-security` | Audits for auth bypass, injection risks, data leaks, validation gaps |
| `kibana-migration` | Assists with version upgrades (7.x → 8.x), breaking changes, migration code |

## Skill

The `kibana-plugin-dev` skill provides a comprehensive knowledge base covering:

- **Plugin architecture** — setup/start lifecycle, server/public/common structure
- **Server-side** — route registration, config-schema validation, ES client, error handling
- **Public-side** — app mounting, React/EUI components, HTTP client
- **Security** — authentication, RBAC, feature privileges, multi-tenancy
- **Elasticsearch** — index templates, mappings, CRUD services, bulk operations, ILM
- **EUI patterns** — pages, tables, forms, modals, flyouts, toasts, empty states
- **Testing** — Jest for server routes, React Testing Library for components
- **Build & deploy** — `@kbn/plugin-helpers`, Docker packaging, CI/CD pipelines

## Why This Exists

Kibana external plugin development has almost no public documentation or tooling. The official Kibana repo is the only real reference, and it's massive. This plugin distills that knowledge into actionable commands, agents, and a structured skill so Claude Code can help you build production-grade Kibana plugins without guessing.

## License

[MIT](LICENSE)
