import { existsSync } from "node:fs";
import { readFileSync, writeFileSync } from "node:fs";

function write(file, content) {
  writeFileSync(file, content, "utf8");
  console.log(`updated ${file}`);
}

const deployKeys = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "HUGGINGFACE_API_KEY",
  "COHERE_API_KEY",
  "CEREBRAS_API_KEY",
  "POLLINATIONS_ENABLED",
  "LIBRETTS_ENABLED",
];

if (existsSync("scripts/vercel-spawn.mjs")) {
  let source = readFileSync("scripts/vercel-spawn.mjs", "utf8");
  source = source.replace(
    /const ENV_VARS = \[[\s\S]*?\];/,
    `const ENV_VARS = ${JSON.stringify(deployKeys, null, 2)}
  .map((key) => ({ key, value: process.env[key] }))
  .filter((entry) => entry.value);`,
  );
  source = source.replace(/cwd: ['"][^'"]*my-app['"]/g, "cwd: process.cwd()");
  write("scripts/vercel-spawn.mjs", source);
}

if (existsSync("scripts/add-vercel-api.mjs")) {
  let source = readFileSync("scripts/add-vercel-api.mjs", "utf8");
  source = source.replace(
    /const ENV_VARS = \[[\s\S]*?\];/,
    `const ENV_VARS = ${JSON.stringify(deployKeys, null, 2)}
  .map((key) => ({
    key,
    value: process.env[key],
    type: key.endsWith("_ENABLED") ? "plain" : "encrypted",
  }))
  .filter((entry) => entry.value);`,
  );
  write("scripts/add-vercel-api.mjs", source);
}

if (existsSync("scripts/add-to-vercel.ps1")) {
  const source = `# PowerShell script to add env vars to Vercel without hardcoding secrets
$ErrorActionPreference = "Continue"

$keys = @(
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "HUGGINGFACE_API_KEY",
    "COHERE_API_KEY",
    "CEREBRAS_API_KEY",
    "POLLINATIONS_ENABLED",
    "LIBRETTS_ENABLED"
)

$envVars = @()
foreach ($key in $keys) {
    $value = [Environment]::GetEnvironmentVariable($key)
    if ($value) {
        $envVars += @{ Key = $key; Value = $value }
    } else {
        Write-Host "Skipping $key because it is not set in the current environment" -ForegroundColor Yellow
    }
}

$environments = @("production", "preview", "development")

foreach ($targetEnv in $environments) {
    Write-Host "\`n=== Environment: $targetEnv ===" -ForegroundColor Cyan
    foreach ($var in $envVars) {
        $key = $var.Key
        $value = $var.Value

        $tempFile = [System.IO.Path]::GetTempFileName()
        if ($targetEnv -eq "preview") {
            @($value, "", "n") | Out-File -FilePath $tempFile -Encoding UTF8
        } else {
            @($value, "n") | Out-File -FilePath $tempFile -Encoding UTF8
        }

        try {
            $output = Get-Content $tempFile | vercel env add $key $targetEnv 2>&1
            if ($output -match "Added|already exists") {
                Write-Host "$key added to $targetEnv" -ForegroundColor Green
            } else {
                Write-Host "$key result: $output" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "$key failed: $_" -ForegroundColor Red
        } finally {
            Remove-Item $tempFile -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "\`nDone!" -ForegroundColor Green
`;
  write("scripts/add-to-vercel.ps1", source);
}

if (existsSync("scripts/test-gemini.js")) {
  let source = readFileSync("scripts/test-gemini.js", "utf8");
  source = source.replace(
    /const GEMINI_API_KEY = ['"][^'"]+['"];?/,
    `const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEYS?.split(",")[0];

if (!GEMINI_API_KEY) {
  console.log("Gemini key is not configured.");
  process.exit(1);
}`,
  );
  write("scripts/test-gemini.js", source);
}

if (existsSync("scripts/add-vercel-env.mjs")) {
  let source = readFileSync("scripts/add-vercel-env.mjs", "utf8");
  source = source.replace(
    /const ENV_VARS = \[[\s\S]*?\];/,
    `const ENV_VARS = [
  "HUGGINGFACE_KEYS",
]
  .map((key) => ({ key, value: process.env[key] }))
  .filter((entry) => entry.value);`,
  );
  source = source.replace(/cwd: ['"][^'"]*my-app['"]/g, "cwd: process.cwd()");
  write("scripts/add-vercel-env.mjs", source);
}

if (existsSync("scripts/test-gemini-keys.js")) {
  let source = readFileSync("scripts/test-gemini-keys.js", "utf8");
  source = source.replace(
    /const keys = \[[\s\S]*?\];/,
    `const keys = [
  ...(process.env.GOOGLE_AI_KEYS || "").split(","),
  ...(process.env.GEMINI_API_KEY || "").split(","),
].map((key) => key.trim()).filter(Boolean);`,
  );
  source = source.replace(
    /console\.log\('\\n🔑 Testing 6 Gemini API Keys\\n'\);/,
    "console.log(`\\nTesting ${keys.length} Gemini API key(s)\\n`);",
  );
  write("scripts/test-gemini-keys.js", source);
}
