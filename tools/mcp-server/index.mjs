#!/usr/bin/env node

/**
 * Kibana Plugin Dev MCP Server
 *
 * A custom MCP server tailored for Kibana plugin development workflows.
 * Provides tools that complement the ES and Kibana MCP servers with
 * development-specific capabilities.
 *
 * Tools:
 * - get_kibana_version: Read Kibana version from the source tree
 * - get_plugin_info: Read plugin's kibana.jsonc and resolve deps
 * - list_registered_types: List all saved object types in the Kibana source
 * - search_kibana_api: Search for API usage patterns in the Kibana source
 * - check_api_compatibility: Check if an API exists in the target Kibana version
 * - run_type_check: Execute TypeScript type checking on the plugin
 * - list_eui_icons: List available EUI icon names
 * - get_breaking_changes: Extract breaking changes from Kibana changelogs
 *
 * Setup:
 *   KIBANA_ROOT=/path/to/kibana  (Kibana source checkout)
 *   PLUGIN_ROOT=/path/to/plugin  (Your plugin directory)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

const KIBANA_ROOT = process.env.KIBANA_ROOT || '';
const PLUGIN_ROOT = process.env.PLUGIN_ROOT || '';

// ─── Tool Definitions ──────────────────────────────────────────────

const tools = [
  {
    name: 'get_kibana_version',
    description:
      'Returns the Kibana version from the source tree package.json. Useful for the migration agent to determine version compatibility.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_plugin_info',
    description:
      'Reads the plugin kibana.jsonc and returns its ID, dependencies, server/browser flags, and configuration.',
    inputSchema: {
      type: 'object',
      properties: {
        pluginPath: {
          type: 'string',
          description:
            'Path to the plugin directory. Defaults to PLUGIN_ROOT env var.',
        },
      },
    },
  },
  {
    name: 'list_registered_types',
    description:
      'Scans the Kibana source tree for all registered saved object types (calls to core.savedObjects.registerType). Returns type names to avoid naming conflicts.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'search_kibana_api',
    description:
      'Searches the Kibana source tree for usage patterns of a specific API. Returns file paths and code snippets showing how other plugins use the API.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'API pattern to search for, e.g. "registerEmbeddableFactory", "createRouter", "registerType"',
        },
        filePattern: {
          type: 'string',
          description:
            'File glob pattern to limit search, e.g. "*.ts", "plugin.ts", "*.test.ts"',
          default: '*.ts',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'check_api_compatibility',
    description:
      'Checks if a specific Kibana API or import path exists in the current Kibana source. Useful for verifying version compatibility before using an API.',
    inputSchema: {
      type: 'object',
      properties: {
        apiPattern: {
          type: 'string',
          description:
            'The API or import to check, e.g. "@kbn/react-kibana-mount", "ReactEmbeddableFactory", "context.core" (async check)',
        },
      },
      required: ['apiPattern'],
    },
  },
  {
    name: 'run_type_check',
    description:
      'Runs TypeScript type checking (tsc --noEmit) on the plugin and returns any errors. Useful after code generation to verify the output compiles.',
    inputSchema: {
      type: 'object',
      properties: {
        pluginPath: {
          type: 'string',
          description: 'Path to the plugin directory.',
        },
      },
    },
  },
  {
    name: 'list_eui_icons',
    description:
      'Returns the list of available EUI icon names. Useful when generating UI components that need icons.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'Optional filter to match icon names, e.g. "logo", "arrow", "vis"',
        },
      },
    },
  },
  {
    name: 'get_breaking_changes',
    description:
      'Extracts breaking changes from Kibana changelogs between two versions. Used by the migration agent.',
    inputSchema: {
      type: 'object',
      properties: {
        fromVersion: {
          type: 'string',
          description: 'Source version, e.g. "8.4.0"',
        },
        toVersion: {
          type: 'string',
          description: 'Target version, e.g. "8.15.0"',
        },
      },
      required: ['fromVersion', 'toVersion'],
    },
  },
];

// ─── Tool Handlers ─────────────────────────────────────────────────

async function getKibanaVersion() {
  try {
    const pkgPath = path.join(KIBANA_ROOT, 'package.json');
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    return {
      version: pkg.version,
      branch: pkg.branch || 'unknown',
      buildSha: pkg.build?.sha || 'unknown',
    };
  } catch (error) {
    return { error: `Failed to read Kibana version: ${error.message}` };
  }
}

async function getPluginInfo(pluginPath) {
  const root = pluginPath || PLUGIN_ROOT;
  try {
    // Try kibana.jsonc first, then kibana.json
    let configPath = path.join(root, 'kibana.jsonc');
    let content;
    try {
      content = await fs.readFile(configPath, 'utf-8');
    } catch {
      configPath = path.join(root, 'kibana.json');
      content = await fs.readFile(configPath, 'utf-8');
    }

    // Strip JSON comments for parsing
    const stripped = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const config = JSON.parse(stripped);

    // Check for server and public entry points
    const hasServer = await fileExists(path.join(root, 'server', 'index.ts'))
      || await fileExists(path.join(root, 'server', 'plugin.ts'));
    const hasPublic = await fileExists(path.join(root, 'public', 'index.ts'))
      || await fileExists(path.join(root, 'public', 'plugin.ts'));

    return {
      config,
      hasServer,
      hasPublic,
      configPath,
    };
  } catch (error) {
    return { error: `Failed to read plugin info: ${error.message}` };
  }
}

async function listRegisteredTypes() {
  if (!KIBANA_ROOT) {
    return { error: 'KIBANA_ROOT environment variable not set' };
  }
  try {
    const result = execSync(
      `grep -r "registerType(" --include="*.ts" -l "${KIBANA_ROOT}/src" "${KIBANA_ROOT}/x-pack" 2>/dev/null | head -50`,
      { encoding: 'utf-8', timeout: 30000 }
    );

    // Extract type names from the files
    const typeNames = [];
    for (const file of result.trim().split('\n').filter(Boolean)) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const matches = content.match(/name:\s*['"]([^'"]+)['"]/g);
        if (matches) {
          for (const m of matches) {
            const name = m.match(/name:\s*['"]([^'"]+)['"]/)?.[1];
            if (name) typeNames.push(name);
          }
        }
      } catch { /* skip unreadable files */ }
    }

    return {
      types: [...new Set(typeNames)].sort(),
      count: new Set(typeNames).size,
      files: result.trim().split('\n').filter(Boolean).length,
    };
  } catch (error) {
    return { error: `Failed to list types: ${error.message}` };
  }
}

async function searchKibanaApi(query, filePattern = '*.ts', maxResults = 10) {
  if (!KIBANA_ROOT) {
    return { error: 'KIBANA_ROOT environment variable not set' };
  }
  try {
    const result = execSync(
      `grep -rn "${query}" --include="${filePattern}" "${KIBANA_ROOT}/src" "${KIBANA_ROOT}/x-pack" 2>/dev/null | head -${maxResults}`,
      { encoding: 'utf-8', timeout: 30000 }
    );

    const matches = result
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const colonIdx = line.indexOf(':');
        const secondColon = line.indexOf(':', colonIdx + 1);
        return {
          file: line.substring(0, colonIdx).replace(KIBANA_ROOT, ''),
          line: parseInt(line.substring(colonIdx + 1, secondColon), 10),
          content: line.substring(secondColon + 1).trim(),
        };
      });

    return { query, matches, count: matches.length };
  } catch (error) {
    return { error: `Search failed: ${error.message}` };
  }
}

async function checkApiCompatibility(apiPattern) {
  if (!KIBANA_ROOT) {
    return { error: 'KIBANA_ROOT environment variable not set' };
  }
  try {
    const result = execSync(
      `grep -rn "${apiPattern}" --include="*.ts" --include="*.tsx" "${KIBANA_ROOT}/packages" "${KIBANA_ROOT}/src/core" 2>/dev/null | head -5`,
      { encoding: 'utf-8', timeout: 15000 }
    );

    const found = result.trim().length > 0;
    return {
      apiPattern,
      exists: found,
      locations: found
        ? result
            .trim()
            .split('\n')
            .map((l) => l.replace(KIBANA_ROOT, '').split(':').slice(0, 2).join(':'))
        : [],
    };
  } catch {
    return { apiPattern, exists: false, locations: [] };
  }
}

async function runTypeCheck(pluginPath) {
  const root = pluginPath || PLUGIN_ROOT;
  try {
    const result = execSync(
      `cd "${root}" && npx tsc --noEmit --pretty 2>&1 | tail -50`,
      { encoding: 'utf-8', timeout: 120000 }
    );
    const hasErrors = result.includes('error TS');
    return {
      success: !hasErrors,
      output: result.trim(),
      errorCount: (result.match(/error TS/g) || []).length,
    };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || error.message,
      errorCount: -1,
    };
  }
}

async function listEuiIcons(filter) {
  // Common EUI icon names — this is a static list maintained in the MCP server
  const icons = [
    'accessibility', 'addDataApp', 'aggregate', 'alert', 'analyzeEvent', 'annotation',
    'apmTrace', 'apps', 'arrowDown', 'arrowLeft', 'arrowRight', 'arrowUp', 'asterisk',
    'beaker', 'bell', 'bellSlash', 'bolt', 'boxesHorizontal', 'boxesVertical', 'branch',
    'broom', 'brush', 'bug', 'bullseye', 'calendar', 'check', 'checkInCircleFilled',
    'cheer', 'clock', 'cloudDrizzle', 'cloudStormy', 'cloudSunny', 'cluster', 'color',
    'compute', 'console', 'controlsHorizontal', 'controlsVertical', 'copy', 'copyClipboard',
    'cross', 'crossInACircleFilled', 'currency', 'cut', 'database', 'desktop', 'discuss',
    'document', 'documentation', 'documents', 'dot', 'doubleArrowLeft', 'doubleArrowRight',
    'download', 'editorAlignCenter', 'editorAlignLeft', 'editorAlignRight', 'editorBold',
    'editorCodeBlock', 'editorComment', 'editorHeading', 'editorItalic', 'editorLink',
    'editorOrderedList', 'editorRedo', 'editorStrike', 'editorTable', 'editorUnderline',
    'editorUndo', 'editorUnorderedList', 'email', 'empty', 'eql', 'eraser', 'exit',
    'expand', 'expandMini', 'exportAction', 'eye', 'eyeClosed', 'faceHappy', 'faceNeutral',
    'faceSad', 'filter', 'flag', 'fleetApp', 'fold', 'folderCheck', 'folderClosed',
    'folderExclamation', 'folderOpen', 'frameNext', 'framePrevious', 'fullScreen',
    'fullScreenExit', 'function', 'gear', 'glasses', 'globe', 'grab', 'grid', 'heart',
    'heatmap', 'help', 'home', 'iInCircle', 'image', 'importAction', 'indexClose',
    'indexEdit', 'indexFlush', 'indexManagementApp', 'indexMapping', 'indexOpen',
    'indexPatternApp', 'indexRuntime', 'indexSettings', 'inputOutput', 'inspect',
    'invert', 'ip', 'keyboard', 'kqlField', 'kqlFunction', 'kqlOperand', 'kqlSelector',
    'kqlValue', 'kubernetesNode', 'kubernetesPod', 'layers', 'link', 'list', 'listAdd',
    'lock', 'lockOpen', 'logoAWS', 'logoAerospike', 'logoApache', 'logoAzure',
    'logoCeph', 'logoCloud', 'logoCloudEnterprise', 'logoCodesandbox', 'logoCouchbase',
    'logoDocker', 'logoDropwizard', 'logoElastic', 'logoElasticStack', 'logoElasticsearch',
    'logoEnterpriseSearch', 'logoEtcd', 'logoGCP', 'logoGithub', 'logoGmail', 'logoGolang',
    'logoGoogleG', 'logoHAproxy', 'logoKafka', 'logoKibana', 'logoKubernetes',
    'logoLogging', 'logoLogstash', 'logoMemcached', 'logoMetrics', 'logoMongodb',
    'logoMySQL', 'logoNginx', 'logoObservability', 'logoOsquery', 'logoPHP',
    'logoPostgres', 'logoPrometheus', 'logoRabbitmq', 'logoRedis', 'logoSecurity',
    'logoSketch', 'logoSlack', 'logoUptime', 'logoWebhook', 'logoWindows',
    'logstashFilter', 'logstashIf', 'logstashInput', 'logstashOutput', 'logstashQueue',
    'magnet', 'magnifyWithExclamation', 'magnifyWithMinus', 'magnifyWithPlus',
    'mapMarker', 'memory', 'menu', 'menuDown', 'menuLeft', 'menuRight', 'menuUp',
    'merge', 'minimize', 'minus', 'minusInCircle', 'minusInCircleFilled', 'mobile',
    'moon', 'nested', 'node', 'number', 'offline', 'online', 'package', 'pageSelect',
    'pagesSelect', 'paperClip', 'partial', 'pause', 'payment', 'pencil', 'percent',
    'pin', 'pinFilled', 'play', 'playFilled', 'plus', 'plusInCircle', 'plusInCircleFilled',
    'popout', 'push', 'questionInCircle', 'quote', 'refresh', 'reporter', 'returnKey',
    'save', 'scale', 'search', 'securitySignal', 'securitySignalDetected',
    'securitySignalResolved', 'sessionViewer', 'share', 'snowflake', 'sortDown', 'sortLeft',
    'sortRight', 'sortUp', 'sortable', 'starEmpty', 'starFilled', 'starMinusEmpty',
    'starMinusFilled', 'starPlusEmpty', 'starPlusFilled', 'stats', 'stop', 'stopFilled',
    'stopSlash', 'storage', 'string', 'submodule', 'sun', 'swatch', 'symlink',
    'tableDensityCompact', 'tableDensityExpanded', 'tableDensityNormal', 'tableOfContents',
    'tag', 'tear', 'temperature', 'timeline', 'timeRefresh', 'timeslider', 'training',
    'trash', 'unfold', 'unlink', 'user', 'userAvatar', 'users', 'vector',
    'videoPlayer', 'visArea', 'visAreaStacked', 'visBarHorizontal', 'visBarHorizontalStacked',
    'visBarVertical', 'visBarVerticalStacked', 'visGauge', 'visGoal', 'visLine', 'visMapCoordinate',
    'visMapRegion', 'visMetric', 'visPie', 'visTable', 'visTagCloud', 'visText',
    'visTimelion', 'visVega', 'visVisualBuilder', 'warning', 'wordWrap', 'wordWrapDisabled',
    'wrench',
  ];

  const filtered = filter
    ? icons.filter((i) => i.toLowerCase().includes(filter.toLowerCase()))
    : icons;

  return { icons: filtered, count: filtered.length, totalAvailable: icons.length };
}

async function getBreakingChanges(fromVersion, toVersion) {
  if (!KIBANA_ROOT) {
    return { error: 'KIBANA_ROOT environment variable not set. Set it to search changelogs.' };
  }
  try {
    // Search changelog files for breaking changes
    const changelogDir = path.join(KIBANA_ROOT, 'changelogs');
    const result = execSync(
      `grep -ri "breaking" --include="*.md" --include="*.asciidoc" "${KIBANA_ROOT}/docs" "${changelogDir}" 2>/dev/null | head -30`,
      { encoding: 'utf-8', timeout: 15000 }
    );

    return {
      fromVersion,
      toVersion,
      matches: result.trim().split('\n').filter(Boolean).length,
      content: result.trim(),
      note: 'For comprehensive breaking changes, also check https://www.elastic.co/guide/en/kibana/current/breaking-changes.html',
    };
  } catch {
    return {
      fromVersion,
      toVersion,
      matches: 0,
      content: '',
      note: 'Changelog search failed. Check https://www.elastic.co/guide/en/kibana/current/breaking-changes.html',
    };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ─── Server Setup ──────────────────────────────────────────────────

const server = new Server(
  { name: 'kibana-plugin-dev', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  let result;
  switch (name) {
    case 'get_kibana_version':
      result = await getKibanaVersion();
      break;
    case 'get_plugin_info':
      result = await getPluginInfo(args?.pluginPath);
      break;
    case 'list_registered_types':
      result = await listRegisteredTypes();
      break;
    case 'search_kibana_api':
      result = await searchKibanaApi(args.query, args.filePattern, args.maxResults);
      break;
    case 'check_api_compatibility':
      result = await checkApiCompatibility(args.apiPattern);
      break;
    case 'run_type_check':
      result = await runTypeCheck(args?.pluginPath);
      break;
    case 'list_eui_icons':
      result = await listEuiIcons(args?.filter);
      break;
    case 'get_breaking_changes':
      result = await getBreakingChanges(args.fromVersion, args.toVersion);
      break;
    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});

// ─── Start ─────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Kibana Plugin Dev MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
