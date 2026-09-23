const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');

// RDS subdomain prefix per Jotform environment.
const ENV_HOST_PREFIXES = {
  default: '',
  enterprise: 'enterprise-',
  hipaa: 'hipaa-',
  soc2: 'soc2-',
  gov: 'gov-'
};

// The host that serves /authorize is baked into the OAuth token, and the MCP server
// sends every API call to that host, so this is what selects the environment.
function buildAuthorizeBaseUrl(jotformEnv, backendUrl) {
  const prefix = ENV_HOST_PREFIXES[jotformEnv];
  if (prefix === undefined) {
    throw new Error(`Unknown ENV "${jotformEnv}". Use one of: ${Object.keys(ENV_HOST_PREFIXES).join(', ')}.`);
  }

  const { host } = new URL(backendUrl);
  if (!host.endsWith('.jotform.pro')) {
    if (jotformEnv !== 'default') {
      throw new Error(`ENV "${jotformEnv}" needs an RDS backend host, got "${host}".`);
    }
    return backendUrl.replace('mcp-', 'oauth2-');
  }

  const [rdsHost, ...domain] = host.split('.');
  const developer = rdsHost.replace(/^(mcp|oauth2|enterprise|hipaa|soc2|gov)-/, '');

  return `https://${prefix}${developer}.${domain.join('.')}/oa2`;
}

// Resolution order: config.json (per user/usecase + root defaults) → env vars override.
function get() {
  const env = process.env;
  let fromFile = {};

  if (fs.existsSync(CONFIG_PATH)) {
    const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const u = env.BASIC_PROXY_USER;
    const uc = env.BASIC_PROXY_USECASE;
    if (u && uc) {
      const b = c[u] && c[u][uc];
      if (!b || !b.BACKEND_BASE_URL) {
        throw new Error(`${CONFIG_PATH}: missing BACKEND_BASE_URL at ["${u}"]["${uc}"]`);
      }
      fromFile = {
        backend: b.BACKEND_BASE_URL,
        mcpBaseUrl: b.MCP_BASE_URL,
        jotformEnv: b.ENV,
        ngrok: b.NGROK_URL
      };
    }
    const filePort = Number(c.PORT);
    if (Number.isFinite(filePort) && filePort > 0) fromFile.port = filePort;
    if (c.ALWAYS_RETURN_200 !== undefined) {
      fromFile.alwaysReturn200 = c.ALWAYS_RETURN_200 === true || String(c.ALWAYS_RETURN_200).toLowerCase() === 'true';
    }
  }

  const envPort = Number(env.PORT);
  const out = {
    backend: env.BACKEND_BASE_URL || fromFile.backend,
    mcpBaseUrl: env.MCP_BASE_URL || fromFile.mcpBaseUrl,
    jotformEnv: env.ENV || fromFile.jotformEnv || 'default',
    ngrok: env.NGROK_URL || fromFile.ngrok,
    port: Number.isFinite(envPort) && envPort > 0 ? envPort : (fromFile.port || 3000),
    alwaysReturn200:
      env.ALWAYS_RETURN_200 !== undefined ? env.ALWAYS_RETURN_200 === 'true' : (fromFile.alwaysReturn200 || false),
  };

  if (!out.backend) {
    throw new Error(
      `BACKEND_BASE_URL not set. Either run ./start.sh, set BASIC_PROXY_USER + BASIC_PROXY_USECASE so ${CONFIG_PATH} can be read, or export BACKEND_BASE_URL directly.`
    );
  }

  out.authorizeBaseUrl = buildAuthorizeBaseUrl(out.jotformEnv, out.mcpBaseUrl || out.backend);

  return out;
}

module.exports = { get };
