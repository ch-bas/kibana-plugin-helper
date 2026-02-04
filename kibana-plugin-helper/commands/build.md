---
description: Build and package a Kibana external plugin for production distribution. Covers pre-build checks, @kbn/plugin-helpers build, Docker packaging, versioning, and CI/CD pipeline setup.
---

# Build Kibana Plugin

Guide the user through building their Kibana plugin for production distribution. Assess the project first, then walk through the appropriate build steps.

## Step 1: Assess the Project

Check the following before building:

1. **Is the plugin inside or outside the Kibana repo?**
   - Inside: uses `@kbn/plugin-helpers` directly from the monorepo
   - Outside (standalone): needs a local Kibana checkout to link against
2. **Target Kibana version** — the plugin MUST match the exact Kibana version
3. **Does `kibana.jsonc` exist and have the correct `id`, `version`, and `server`/`browser` flags?**
4. **Does `tsconfig.json` extend Kibana's TypeScript config?**
5. **Are there any build-time dependencies that need resolving?**

## Step 2: Project Setup for External Plugins

External plugins must be developed alongside a Kibana source checkout. Verify the directory layout:

```
workspace/
├── kibana/              # Full Kibana source checkout (matching target version)
│   └── plugins/
│       └── my_plugin/   # Symlink or direct placement of the plugin
└── my_plugin/           # Plugin source (if developing outside)
```

### Link the plugin into Kibana

```bash
# Option A: Develop directly inside kibana/plugins/
cp -r my_plugin kibana/plugins/my_plugin

# Option B: Symlink (useful for separate git repos)
ln -s $(pwd)/my_plugin kibana/plugins/my_plugin
```

### Bootstrap Kibana (required before first build)

```bash
cd kibana
# Use the Node.js version Kibana requires (check .node-version)
nvm use
yarn kbn bootstrap
```

This installs all dependencies and links internal packages including `@kbn/plugin-helpers`.

## Step 3: Development Mode

Before building for production, verify the plugin works in dev mode:

```bash
# Terminal 1: Start Kibana in dev mode
cd kibana
yarn start

# Terminal 2: If your plugin has browser-side code, run the optimizer
cd kibana/plugins/my_plugin
yarn dev --watch
```

Verify:
- Kibana logs show: `[plugins-system.standard] Setting up [..., myPluginId, ...]`
- Plugin UI loads at `http://localhost:5601/app/myPluginId`
- Server routes respond at `http://localhost:5601/api/my_plugin/...`
- No TypeScript errors in the terminal
- Browser console is clean of errors

## Step 4: Pre-Build Checklist

Run these checks before building:

```bash
cd kibana/plugins/my_plugin

# 1. TypeScript compilation check
npx tsc --noEmit

# 2. Lint
yarn lint

# 3. Run tests
yarn test

# 4. Check for unused dependencies
# Review package.json — external plugins should have minimal dependencies
# Most deps come from Kibana core (@kbn/* packages)
```

### Verify kibana.jsonc

```jsonc
{
  "type": "plugin",
  "id": "myPluginId",                    // Must match plugin class registration
  "version": "1.0.0",                     // Your plugin version
  "kibanaVersion": "8.17.0",              // MUST match target Kibana exactly
  "owner": {
    "name": "Your Team",
    "githubTeam": "your-team"
  },
  "description": "What the plugin does",
  "plugin": {
    "id": "myPluginId",
    "server": true,
    "browser": true,
    "configPath": ["myPluginId"],
    "requiredPlugins": [],
    "optionalPlugins": [],
    "requiredBundles": []
  }
}
```

**Critical**: `kibanaVersion` must be an exact match. Kibana rejects plugins built for a different version.

## Step 5: Build for Production

### Using @kbn/plugin-helpers (Recommended)

```bash
cd kibana/plugins/my_plugin

# Build the distributable archive
yarn plugin-helpers build

# Or with specific options
yarn plugin-helpers build --skip-archive    # Build without creating .zip
yarn plugin-helpers build --kibana-version 8.17.0
```

This will:
1. Transpile TypeScript to JavaScript
2. Bundle browser-side code with webpack
3. Add required polyfills
4. Create a `.zip` archive in `kibana/plugins/my_plugin/build/`

The output will be something like:
```
build/
└── myPluginId-1.0.0.zip
```

### Verify the Build

```bash
# Check the archive contents
unzip -l build/myPluginId-1.0.0.zip

# The archive should contain:
# kibana/myPluginId/
# ├── kibana.jsonc
# ├── server/          (compiled JS, no .ts files)
# ├── public/          (bundled browser assets)
# ├── common/          (compiled shared code)
# ├── node_modules/    (production dependencies only)
# └── package.json
```

### Ensure package.json has build scripts

If not already present, add these to `package.json`:

```json
{
  "name": "my-plugin-id",
  "version": "1.0.0",
  "kibana": {
    "version": "8.17.0"
  },
  "scripts": {
    "build": "yarn plugin-helpers build",
    "dev": "yarn plugin-helpers dev --watch",
    "lint": "eslint . --ext .ts,.tsx",
    "test": "jest --config jest.config.js",
    "typecheck": "tsc --noEmit",
    "prebuild": "yarn typecheck && yarn lint && yarn test"
  }
}
```

## Step 6: Install the Built Plugin

### On a target Kibana instance

```bash
# Install from local file
bin/kibana-plugin install file:///path/to/myPluginId-1.0.0.zip

# Install from URL
bin/kibana-plugin install https://your-server.com/releases/myPluginId-1.0.0.zip

# Verify installation
bin/kibana-plugin list
```

### Via Docker

```dockerfile
FROM docker.elastic.co/kibana/kibana:8.17.0

# Install the plugin
COPY myPluginId-1.0.0.zip /tmp/myPluginId-1.0.0.zip
RUN /usr/share/kibana/bin/kibana-plugin install file:///tmp/myPluginId-1.0.0.zip
RUN rm /tmp/myPluginId-1.0.0.zip

# Run the optimizer (important — avoids slow first startup)
RUN /usr/share/kibana/bin/kibana --optimize
```

Build and run:
```bash
docker build -t kibana-with-my-plugin:8.17.0 .
docker run -p 5601:5601 \
  -e ELASTICSEARCH_HOSTS=http://elasticsearch:9200 \
  kibana-with-my-plugin:8.17.0
```

### Via Docker Compose

```yaml
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.17.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"

  kibana:
    build:
      context: .
      dockerfile: Dockerfile.kibana
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch
```

## Step 7: CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Build Kibana Plugin

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  KIBANA_VERSION: '8.17.0'
  NODE_VERSION: '20'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Clone Kibana
        run: |
          git clone --depth 1 --branch v${{ env.KIBANA_VERSION }} \
            https://github.com/elastic/kibana.git /tmp/kibana

      - name: Link plugin
        run: |
          mkdir -p /tmp/kibana/plugins
          ln -s ${{ github.workspace }} /tmp/kibana/plugins/my_plugin

      - name: Bootstrap Kibana
        run: |
          cd /tmp/kibana
          yarn kbn bootstrap

      - name: Type check
        run: |
          cd /tmp/kibana/plugins/my_plugin
          npx tsc --noEmit

      - name: Lint
        run: |
          cd /tmp/kibana/plugins/my_plugin
          yarn lint

      - name: Test
        run: |
          cd /tmp/kibana/plugins/my_plugin
          yarn test --ci --coverage

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Clone Kibana
        run: |
          git clone --depth 1 --branch v${{ env.KIBANA_VERSION }} \
            https://github.com/elastic/kibana.git /tmp/kibana

      - name: Link plugin
        run: |
          mkdir -p /tmp/kibana/plugins
          ln -s ${{ github.workspace }} /tmp/kibana/plugins/my_plugin

      - name: Bootstrap Kibana
        run: |
          cd /tmp/kibana
          yarn kbn bootstrap

      - name: Build plugin
        run: |
          cd /tmp/kibana/plugins/my_plugin
          yarn plugin-helpers build

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: kibana-plugin-${{ github.sha }}
          path: build/*.zip

  release:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Download artifact
        uses: actions/download-artifact@v4
        with:
          name: kibana-plugin-${{ github.sha }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: '*.zip'
          generate_release_notes: true
```

### GitLab CI Example

```yaml
stages:
  - test
  - build
  - release

variables:
  KIBANA_VERSION: '8.17.0'

.setup-kibana: &setup-kibana
  before_script:
    - git clone --depth 1 --branch v${KIBANA_VERSION} https://github.com/elastic/kibana.git /tmp/kibana
    - mkdir -p /tmp/kibana/plugins
    - ln -s ${CI_PROJECT_DIR} /tmp/kibana/plugins/my_plugin
    - cd /tmp/kibana && yarn kbn bootstrap

test:
  stage: test
  <<: *setup-kibana
  script:
    - cd /tmp/kibana/plugins/my_plugin
    - npx tsc --noEmit
    - yarn lint
    - yarn test --ci --coverage
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

build:
  stage: build
  <<: *setup-kibana
  script:
    - cd /tmp/kibana/plugins/my_plugin
    - yarn plugin-helpers build
  artifacts:
    paths:
      - build/*.zip
    expire_in: 30 days

release:
  stage: release
  only:
    - tags
  script:
    - echo "Upload build/*.zip to your artifact registry"
```

## Step 8: Version Management

### Versioning Strategy

Follow this convention for plugin versioning:

```
{pluginVersion}-{kibanaVersion}

Example: 1.2.0-8.17.0
```

This makes it clear which Kibana version the build targets.

### Multi-Version Builds

If you need to support multiple Kibana versions, use a matrix build strategy:

```yaml
# GitHub Actions matrix
strategy:
  matrix:
    kibana-version: ['8.15.0', '8.16.0', '8.17.0']
```

Maintain version-specific branches if APIs differ between Kibana versions:
```
main          → latest Kibana version
kibana-8.16   → Kibana 8.16.x support
kibana-8.15   → Kibana 8.15.x support
```

## Common Build Issues

| Issue | Solution |
|---|---|
| `kibanaVersion mismatch` | Ensure `kibana.jsonc` version exactly matches the Kibana source you're building against |
| `Cannot find module @kbn/...` | Run `yarn kbn bootstrap` in the Kibana root |
| `Optimizer error` | Check for circular imports, missing exports, or incompatible dynamic imports |
| `Build succeeds but plugin fails at runtime` | Test in dev mode first; check that all server imports are available at runtime |
| `Plugin too large` | Check `node_modules` — exclude devDependencies, use Kibana's bundled packages |
| `TypeScript errors during build` | Ensure `tsconfig.json` extends Kibana's config correctly |
| `EACCES permission denied` during install | Run `bin/kibana-plugin install` as the Kibana user, not root |
| Docker build hangs at optimize | Increase Docker memory to at least 4GB; optimize is memory-intensive |

## Rules

- NEVER skip the TypeScript check before building
- ALWAYS verify the plugin works in dev mode before attempting a production build
- ALWAYS run tests before building
- ALWAYS match the exact Kibana version — there is no semver range support
- Include a `prebuild` script in package.json that runs typecheck + lint + test
- Tag releases with both plugin version and Kibana version
- Document the required Kibana version prominently in README
- Test the built .zip installation on a fresh Kibana instance before releasing
