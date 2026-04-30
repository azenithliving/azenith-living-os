export interface RemoteBrowserConfig {
  label: string;
  viewerUrl: string;
  healthcheckUrl: string;
  provider: "direct" | "novnc";
  source: "self-hosted" | "oci";
  vncPassword?: string;
}

export interface RemoteBrowserHealthResult {
  ok: boolean;
  status?: number;
  error?: string;
  checkedAt: string;
}

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readOptionalEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function parseHttpUrl(value: string, envName: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(`Unsupported protocol for ${envName}`);
    }

    return url;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Invalid URL in ${envName}: ${error.message}`
        : `Invalid URL in ${envName}`
    );
  }
}

function getSelfHostedBrowserConfig(): RemoteBrowserConfig | null {
  const viewerUrlValue = readOptionalEnv("BROWSER_WORKSPACE_VIEWER_URL");

  if (!viewerUrlValue) {
    return null;
  }

  const viewerUrl = parseHttpUrl(viewerUrlValue, "BROWSER_WORKSPACE_VIEWER_URL");
  const healthcheckUrlValue =
    readOptionalEnv("BROWSER_WORKSPACE_HEALTHCHECK_URL") || viewerUrl.toString();
  const healthcheckUrl = parseHttpUrl(
    healthcheckUrlValue,
    "BROWSER_WORKSPACE_HEALTHCHECK_URL"
  );

  return {
    label: readOptionalEnv("BROWSER_WORKSPACE_LABEL") || "Self-Hosted Browser",
    viewerUrl: viewerUrl.toString(),
    healthcheckUrl: healthcheckUrl.toString(),
    provider: "direct",
    source: "self-hosted",
  };
}

function getOciBrowserConfig(): RemoteBrowserConfig {
  const label = process.env.REMOTE_BROWSER_LABEL?.trim() || "OCI XFCE Browser";
  const viewerUrl = parseHttpUrl(
    readRequiredEnv("REMOTE_BROWSER_BASE_URL"),
    "REMOTE_BROWSER_BASE_URL"
  );
  const healthcheckUrl = parseHttpUrl(
    readRequiredEnv("REMOTE_BROWSER_HEALTHCHECK_URL"),
    "REMOTE_BROWSER_HEALTHCHECK_URL"
  );
  const vncPassword = readRequiredEnv("REMOTE_BROWSER_VNC_PASSWORD");

  return {
    label,
    viewerUrl: viewerUrl.toString(),
    healthcheckUrl: healthcheckUrl.toString(),
    provider: "novnc",
    source: "oci",
    vncPassword,
  };
}

export function getRemoteBrowserConfig(): RemoteBrowserConfig {
  const selfHostedConfig = getSelfHostedBrowserConfig();

  if (selfHostedConfig) {
    return selfHostedConfig;
  }

  return getOciBrowserConfig();
}

export function buildRemoteBrowserViewerUrl(config: RemoteBrowserConfig) {
  if (config.provider === "direct") {
    return config.viewerUrl;
  }

  const viewerUrl = new URL(config.viewerUrl);
  const fragment = new URLSearchParams({
    autoconnect: "1",
    resize: "scale",
    reconnect: "1",
    reconnect_delay: "2000",
    path: "websockify",
    password: config.vncPassword || "",
  });

  viewerUrl.hash = fragment.toString();
  return viewerUrl.toString();
}

export async function checkRemoteBrowserHealth(
  config: RemoteBrowserConfig = getRemoteBrowserConfig()
): Promise<RemoteBrowserHealthResult> {
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(config.healthcheckUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        "User-Agent": "AzenithRemoteBrowser/1.0",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `Healthcheck returned HTTP ${response.status}`,
        checkedAt,
      };
    }

    return {
      ok: true,
      status: response.status,
      checkedAt,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown remote browser healthcheck error",
      checkedAt,
    };
  }
}
