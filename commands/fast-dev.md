---
description: Set up a fast development environment for Kibana plugin development — mock server, optimized config, test infrastructure, and Storybook setup to minimize Kibana restarts
---

# Set Up Fast Development Environment

Configure your plugin for maximum development speed. Ask the user:

1. **What's your biggest bottleneck?**
   - Waiting for Kibana to start
   - Route changes requiring restarts
   - Testing UI components
   - Running integration tests
   - All of the above

2. **Do you have Elasticsearch running locally?**
   - Yes (we'll connect the mock server to it)
   - No (we'll use fully mocked ES)

3. **Which parts of your plugin are you actively developing?**
   - Server routes
   - React components
   - Saved object types
   - Embeddables
   - All of the above

## Generation Steps

Based on answers, generate the appropriate setup:

### For Route Development: Mock Server

Create `dev/mock-server/` with the mock server that simulates Kibana's core APIs:

```bash
# Start mock server (< 1 second startup)
cd dev/mock-server && npm install && npm start
```

Routes are available at `http://localhost:3000/api/your_plugin/...` with hot reload.

### For UI Development: Storybook

Create `.storybook/` config and example stories:

```bash
# Run Storybook (no Kibana needed)
yarn storybook your-plugin
```

### For Unit Tests: Jest with Mocks

Create `test/mocks/` with pre-configured Kibana core mocks:

```bash
# Run tests in watch mode (instant feedback)
yarn jest plugins/your-plugin --watch
```

### For Faster Kibana Startup: Optimized Config

Create `kibana.dev.yml` with disabled plugins and optimized settings:

```bash
# Start Kibana with minimal plugins
yarn start --config kibana.dev.yml
```

### For Integration Tests: Functional Test Config

Create `test/api_integration/config.ts` for lighter-weight API testing.

## Files to Generate

Depending on selections, create:

```
your-plugin/
├── dev/
│   └── mock-server/           # Standalone route testing
│       ├── mock-server.mjs
│       ├── package.json
│       └── README.md
├── .storybook/                # UI component development
│   ├── main.ts
│   └── preview.tsx
├── test/
│   ├── mocks/                 # Kibana core mocks for Jest
│   │   ├── core_mocks.ts
│   │   ├── es_client_mock.ts
│   │   └── saved_objects_mock.ts
│   └── api_integration/       # Lightweight integration tests
│       └── config.ts
├── kibana.dev.yml             # Fast Kibana startup config
└── scripts/
    └── dev.sh                 # One-command dev environment
```

## Dev Script

Generate a convenience script:

```bash
#!/bin/bash
# scripts/dev.sh — Fast development environment

case "$1" in
  mock)
    echo "Starting mock server..."
    cd dev/mock-server && npm start
    ;;
  story)
    echo "Starting Storybook..."
    cd ../.. && yarn storybook $(basename $(pwd))
    ;;
  test)
    echo "Running tests in watch mode..."
    cd ../.. && yarn jest plugins/$(basename $(pwd)) --watch
    ;;
  kibana)
    echo "Starting optimized Kibana..."
    cd ../.. && yarn start --config plugins/$(basename $(pwd))/kibana.dev.yml
    ;;
  *)
    echo "Usage: ./scripts/dev.sh [mock|story|test|kibana]"
    echo ""
    echo "  mock   - Start mock server for route development (instant)"
    echo "  story  - Start Storybook for UI development (fast)"
    echo "  test   - Run Jest tests in watch mode (fast)"
    echo "  kibana - Start Kibana with optimized config (faster)"
    ;;
esac
```

## Important Notes

- Mock server is for rapid iteration — always verify in real Kibana before shipping
- Storybook requires your components to be decoupled from Kibana context
- The optimized Kibana config disables many plugins — re-enable if you depend on them
- Hot reload only works for client-side code in real Kibana; server changes need restart

## Verification Checklist

After setup, verify:

```bash
# Mock server starts and routes work
./scripts/dev.sh mock
curl http://localhost:3000/api/your_plugin/items

# Tests run
./scripts/dev.sh test

# Storybook starts (if UI components)
./scripts/dev.sh story

# Kibana starts faster
./scripts/dev.sh kibana
```
