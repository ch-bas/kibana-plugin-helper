#!/usr/bin/env node

/**
 * Kibana Plugin Development Mock Server
 *
 * A lightweight Express server that simulates Kibana's core server APIs,
 * allowing you to develop and test plugin routes WITHOUT running Kibana.
 *
 * Features:
 * - Mocks core.http router patterns
 * - Connects to real Elasticsearch (or mocks it)
 * - Simulates saved objects client
 * - Simulates security context
 * - Hot reloads your plugin code on change
 *
 * Usage:
 *   PLUGIN_PATH=./my-plugin ES_URL=http://localhost:9200 node mock-server.mjs
 *
 * Your plugin routes work at http://localhost:3000/api/your_plugin/...
 */

import express from 'express';
import { Client } from '@elastic/elasticsearch';
import { watch } from 'chokidar';
import { pathToFileURL } from 'url';

// ─── Configuration ─────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
const PLUGIN_PATH = process.env.PLUGIN_PATH || './';
const ES_URL = process.env.ES_URL || 'http://localhost:9200';
const ES_USERNAME = process.env.ES_USERNAME || 'elastic';
const ES_PASSWORD = process.env.ES_PASSWORD || 'changeme';
const MOCK_ES = process.env.MOCK_ES === 'true';

// ─── Elasticsearch Client ──────────────────────────────────────────

let esClient;

if (!MOCK_ES) {
  esClient = new Client({
    node: ES_URL,
    auth: { username: ES_USERNAME, password: ES_PASSWORD },
    tls: { rejectUnauthorized: false },
  });
} else {
  // Mock ES client for fully offline development
  esClient = {
    search: async () => ({ hits: { hits: [], total: { value: 0 } } }),
    index: async (params) => ({ _id: `mock-${Date.now()}`, result: 'created' }),
    get: async () => ({ _source: {}, found: true }),
    delete: async () => ({ result: 'deleted' }),
    bulk: async () => ({ items: [], errors: false }),
    indices: {
      exists: async () => true,
      create: async () => ({ acknowledged: true }),
      getMapping: async () => ({}),
    },
  };
  console.log('⚠️  Running with mocked Elasticsearch');
}

// ─── Mock Saved Objects Client ─────────────────────────────────────

const savedObjectsStore = new Map();

const mockSavedObjectsClient = {
  async create(type, attributes, options = {}) {
    const id = options.id || `${type}-${Date.now()}`;
    const doc = {
      id,
      type,
      attributes,
      references: options.references || [],
      updated_at: new Date().toISOString(),
      version: 'WzEsMV0=',
    };
    savedObjectsStore.set(`${type}:${id}`, doc);
    return doc;
  },

  async get(type, id) {
    const doc = savedObjectsStore.get(`${type}:${id}`);
    if (!doc) {
      const error = new Error(`Saved object [${type}/${id}] not found`);
      error.output = { statusCode: 404 };
      throw error;
    }
    return doc;
  },

  async find(options) {
    const { type, search, searchFields, page = 1, perPage = 20 } = options;
    let results = [...savedObjectsStore.values()];

    if (type) {
      const types = Array.isArray(type) ? type : [type];
      results = results.filter((doc) => types.includes(doc.type));
    }

    if (search && searchFields) {
      const searchLower = search.toLowerCase();
      results = results.filter((doc) =>
        searchFields.some((field) =>
          String(doc.attributes[field] || '').toLowerCase().includes(searchLower)
        )
      );
    }

    const total = results.length;
    const start = (page - 1) * perPage;
    const paginated = results.slice(start, start + perPage);

    return {
      saved_objects: paginated,
      total,
      page,
      per_page: perPage,
    };
  },

  async update(type, id, attributes, options = {}) {
    const existing = await this.get(type, id);
    const updated = {
      ...existing,
      attributes: { ...existing.attributes, ...attributes },
      references: options.references || existing.references,
      updated_at: new Date().toISOString(),
    };
    savedObjectsStore.set(`${type}:${id}`, updated);
    return updated;
  },

  async delete(type, id) {
    const key = `${type}:${id}`;
    if (!savedObjectsStore.has(key)) {
      const error = new Error(`Saved object [${type}/${id}] not found`);
      error.output = { statusCode: 404 };
      throw error;
    }
    savedObjectsStore.delete(key);
    return {};
  },

  async bulkCreate(objects) {
    return {
      saved_objects: await Promise.all(
        objects.map((obj) => this.create(obj.type, obj.attributes, obj))
      ),
    };
  },

  async bulkGet(objects) {
    return {
      saved_objects: await Promise.all(
        objects.map(async (obj) => {
          try {
            return await this.get(obj.type, obj.id);
          } catch (e) {
            return { id: obj.id, type: obj.type, error: { statusCode: 404 } };
          }
        })
      ),
    };
  },
};

// ─── Mock Security ─────────────────────────────────────────────────

const mockUser = {
  username: 'dev-user',
  roles: ['superuser'],
  full_name: 'Development User',
  email: 'dev@localhost',
};

// ─── Mock Request Context ──────────────────────────────────────────

function createMockContext() {
  return {
    core: Promise.resolve({
      elasticsearch: {
        client: {
          asCurrentUser: esClient,
          asInternalUser: esClient,
        },
      },
      savedObjects: {
        client: mockSavedObjectsClient,
        getClient: () => mockSavedObjectsClient,
      },
      uiSettings: {
        client: {
          get: async (key) => null,
          getAll: async () => ({}),
        },
      },
    }),
  };
}

// ─── Mock Response ─────────────────────────────────────────────────

function createMockResponse(res) {
  return {
    ok: (options = {}) => {
      res.status(200).json(options.body || {});
      return { status: 200 };
    },
    created: (options = {}) => {
      res.status(201).json(options.body || {});
      return { status: 201 };
    },
    noContent: () => {
      res.status(204).send();
      return { status: 204 };
    },
    badRequest: (options = {}) => {
      res.status(400).json({ message: options.body?.message || 'Bad request' });
      return { status: 400 };
    },
    notFound: (options = {}) => {
      res.status(404).json({ message: options.body?.message || 'Not found' });
      return { status: 404 };
    },
    forbidden: (options = {}) => {
      res.status(403).json({ message: options.body?.message || 'Forbidden' });
      return { status: 403 };
    },
    customError: (options) => {
      res.status(options.statusCode || 500).json({ message: options.body?.message || 'Error' });
      return { status: options.statusCode };
    },
  };
}

// ─── Schema Validator (simplified) ─────────────────────────────────

function validateWithSchema(schema, data) {
  // Simplified validation — in real usage, you'd use @kbn/config-schema
  // This just passes through for dev purposes
  if (!schema) return data;
  if (typeof schema.validate === 'function') {
    return schema.validate(data);
  }
  return data;
}

// ─── Router Registry ──────────────────────────────────────────────

const routes = [];

function createMockRouter() {
  const register = (method) => (config, handler) => {
    routes.push({
      method,
      path: config.path,
      validate: config.validate || {},
      handler,
    });
    console.log(`  📍 ${method.toUpperCase()} ${config.path}`);
  };

  return {
    get: register('get'),
    post: register('post'),
    put: register('put'),
    delete: register('delete'),
    patch: register('patch'),
  };
}

// ─── Express App ───────────────────────────────────────────────────

const app = express();
app.use(express.json());

// CORS for local development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, kbn-xsrf, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Health check
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', mock: true, routes: routes.length });
});

// ─── Route Loader ──────────────────────────────────────────────────

async function loadPluginRoutes() {
  routes.length = 0; // Clear existing routes

  try {
    // Dynamically import the plugin's route registration
    const routesPath = `${PLUGIN_PATH}/server/routes/index.ts`;
    const routeModule = await import(pathToFileURL(routesPath).href + `?t=${Date.now()}`);

    // Create mock core setup
    const mockCoreSetup = {
      http: {
        createRouter: createMockRouter,
        basePath: {
          prepend: (path) => path,
          get: () => '',
        },
      },
      getStartServices: async () => [
        {
          elasticsearch: { client: { asInternalUser: esClient } },
          savedObjects: { getScopedClient: () => mockSavedObjectsClient },
        },
        {},
        {},
      ],
    };

    // Call the route registration function
    if (typeof routeModule.registerRoutes === 'function') {
      await routeModule.registerRoutes(mockCoreSetup.http.createRouter(), {});
    } else if (typeof routeModule.default === 'function') {
      await routeModule.default(mockCoreSetup.http.createRouter(), {});
    }

    console.log(`\n✅ Loaded ${routes.length} routes from plugin\n`);
  } catch (error) {
    console.error('❌ Failed to load plugin routes:', error.message);
    console.log('\nMake sure your plugin exports routes like:');
    console.log('  export function registerRoutes(router: IRouter, deps: Deps) { ... }');
  }
}

// ─── Dynamic Route Handler ─────────────────────────────────────────

app.use('/api', async (req, res, next) => {
  const method = req.method.toLowerCase();
  const path = '/api' + req.path;

  // Find matching route
  const route = routes.find((r) => {
    if (r.method !== method) return false;

    // Convert Kibana path params {id} to Express :id
    const pattern = r.path.replace(/{(\w+)}/g, ':$1');
    const regex = new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$');
    return regex.test(path);
  });

  if (!route) {
    return res.status(404).json({ message: `Route not found: ${method.toUpperCase()} ${path}` });
  }

  // Extract path params
  const paramPattern = route.path.replace(/{(\w+)}/g, ':$1');
  const paramNames = [...route.path.matchAll(/{(\w+)}/g)].map((m) => m[1]);
  const paramRegex = new RegExp('^' + paramPattern.replace(/:\w+/g, '([^/]+)') + '$');
  const paramValues = path.match(paramRegex)?.slice(1) || [];
  const params = Object.fromEntries(paramNames.map((name, i) => [name, paramValues[i]]));

  // Build mock request
  const mockRequest = {
    params,
    query: req.query,
    body: req.body,
    headers: req.headers,
    auth: { isAuthenticated: true },
    route: { path: route.path, method: route.method },
  };

  try {
    // Validate inputs
    if (route.validate.params) {
      mockRequest.params = validateWithSchema(route.validate.params, params);
    }
    if (route.validate.query) {
      mockRequest.query = validateWithSchema(route.validate.query, req.query);
    }
    if (route.validate.body) {
      mockRequest.body = validateWithSchema(route.validate.body, req.body);
    }

    // Call handler
    await route.handler(createMockContext(), mockRequest, createMockResponse(res));
  } catch (error) {
    console.error(`Error in ${route.method.toUpperCase()} ${route.path}:`, error);
    res.status(500).json({ message: error.message, stack: error.stack });
  }
});

// ─── Hot Reload ────────────────────────────────────────────────────

const watcher = watch(`${PLUGIN_PATH}/server/**/*.ts`, {
  ignored: /node_modules/,
  persistent: true,
});

watcher.on('change', async (path) => {
  console.log(`\n🔄 File changed: ${path}`);
  console.log('Reloading routes...\n');
  await loadPluginRoutes();
});

// ─── Start Server ──────────────────────────────────────────────────

async function start() {
  console.log('\n🚀 Kibana Plugin Mock Server\n');
  console.log(`   Plugin:  ${PLUGIN_PATH}`);
  console.log(`   ES:      ${MOCK_ES ? 'MOCKED' : ES_URL}`);
  console.log(`   Port:    ${PORT}`);
  console.log('\nLoading routes...\n');

  await loadPluginRoutes();

  app.listen(PORT, () => {
    console.log(`\n🟢 Mock server running at http://localhost:${PORT}`);
    console.log('   Hot reload enabled — edit your plugin and routes will reload\n');
  });
}

start().catch(console.error);
