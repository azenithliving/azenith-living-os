/**
 * GitHub API client — read/write repo files from Vercel (real code changes via PR).
 */

export interface GitHubFilePatch {
  path: string;
  content: string;
  message?: string;
}

export interface GitHubRepoConfig {
  token: string;
  owner: string;
  repo: string;
  defaultBranch?: string;
}

export function getGitHubConfig(): GitHubRepoConfig | null {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) return null;
  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) return null;
  return {
    token,
    owner,
    repo: repoName,
    defaultBranch: process.env.GITHUB_DEFAULT_BRANCH || "main",
  };
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function readRepoFile(
  cfg: GitHubRepoConfig,
  path: string,
  ref?: string
): Promise<{ success: boolean; content?: string; sha?: string; error?: string }> {
  const branch = ref || cfg.defaultBranch || "main";
  const res = await fetch(
    `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${branch}`,
    { headers: headers(cfg.token) }
  );
  if (!res.ok) {
    return { success: false, error: `${res.status} ${path}` };
  }
  const json = (await res.json()) as { content: string; sha: string };
  const content = Buffer.from(json.content.replace(/\n/g, ""), "base64").toString("utf-8");
  return { success: true, content, sha: json.sha };
}

export async function writeRepoFile(
  cfg: GitHubRepoConfig,
  path: string,
  content: string,
  opts: { branch: string; message: string; sha?: string }
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(
    `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`,
    {
      method: "PUT",
      headers: headers(cfg.token),
      body: JSON.stringify({
        message: opts.message,
        content: Buffer.from(content, "utf-8").toString("base64"),
        branch: opts.branch,
        sha: opts.sha,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: err.slice(0, 300) };
  }
  return { success: true };
}

export async function createAgentBranch(
  cfg: GitHubRepoConfig,
  suffix: string
): Promise<{ success: boolean; branch?: string; error?: string }> {
  const branch = `agent/evolve-${suffix.slice(0, 10)}`;
  const base = cfg.defaultBranch || "main";
  const refRes = await fetch(
    `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${base}`,
    { headers: headers(cfg.token) }
  );
  if (!refRes.ok) return { success: false, error: "base ref failed" };
  const baseSha = ((await refRes.json()) as { object: { sha: string } }).object.sha;

  const createRes = await fetch(
    `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/git/refs`,
    {
      method: "POST",
      headers: headers(cfg.token),
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
    }
  );
  if (!createRes.ok) {
    const existing = await fetch(
      `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${branch}`,
      { headers: headers(cfg.token) }
    );
    if (existing.ok) return { success: true, branch };
    return { success: false, error: "branch create failed" };
  }
  return { success: true, branch };
}

export async function applyRepoPatches(
  cfg: GitHubRepoConfig,
  patches: GitHubFilePatch[],
  opts?: { branchSuffix?: string; prTitle?: string }
): Promise<{ success: boolean; prUrl?: string; branch?: string; filesWritten: string[]; errors: string[] }> {
  const suffix = opts?.branchSuffix || crypto.randomUUID();
  const branchResult = await createAgentBranch(cfg, suffix);
  if (!branchResult.success || !branchResult.branch) {
    return { success: false, filesWritten: [], errors: [branchResult.error || "branch"] };
  }
  const branch = branchResult.branch;
  const filesWritten: string[] = [];
  const errors: string[] = [];

  for (const patch of patches) {
    const existing = await readRepoFile(cfg, patch.path, branch);
    const sha = existing.sha;
    const w = await writeRepoFile(cfg, patch.path, patch.content, {
      branch,
      message: patch.message || `agent: ${patch.path}`,
      sha,
    });
    if (w.success) filesWritten.push(patch.path);
    else errors.push(`${patch.path}: ${w.error}`);
  }

  if (filesWritten.length === 0) {
    return { success: false, branch, filesWritten, errors };
  }

  const prRes = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/pulls`, {
    method: "POST",
    headers: headers(cfg.token),
    body: JSON.stringify({
      title: opts?.prTitle || `[Agent] ${filesWritten.length} file update(s)`,
      head: branch,
      base: cfg.defaultBranch || "main",
      body: `Automated by Azenith admin.\n\nFiles:\n${filesWritten.map((f) => `- ${f}`).join("\n")}`,
    }),
  });
  if (!prRes.ok) {
    return {
      success: true,
      branch,
      filesWritten,
      errors: [...errors, "PR create failed — branch pushed"],
    };
  }
  const pr = (await prRes.json()) as { html_url: string };
  return { success: true, prUrl: pr.html_url, branch, filesWritten, errors };
}
