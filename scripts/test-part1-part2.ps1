# Test Script for Part 1 and Part 2
# Check if all files exist

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Testing Part 1 & Part 2 Implementation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$errors = 0
$passed = 0

# Test 1: Check if migrations exist
Write-Host "Test 1: Checking migration files..." -NoNewline
$migrations = @(
    "supabase/migrations/20260423_reconciliation.sql",
    "supabase/migrations/20260423_manufacturing.sql",
    "supabase/migrations/20260423_agents.sql"
)
$allMigrationsExist = $true
foreach ($migration in $migrations) {
    if (-not (Test-Path $migration)) {
        $allMigrationsExist = $false
    }
}
if ($allMigrationsExist) {
    Write-Host " [PASS]" -ForegroundColor Green
    $passed++
} else {
    Write-Host " [FAIL]" -ForegroundColor Red
    $errors++
}

# Test 2: Check Unified DAL
Write-Host "Test 2: Checking Unified DAL..." -NoNewline
if (Test-Path "lib/dal/unified-supabase.ts") {
    Write-Host " [PASS]" -ForegroundColor Green
    $passed++
} else {
    Write-Host " [FAIL]" -ForegroundColor Red
    $errors++
}

# Test 3: Check Services
Write-Host "Test 3: Checking Services..." -NoNewline
$services = @(
    "services/agent-scheduler.ts",
    "services/local-storage.ts",
    "services/offline-queue.ts",
    "services/workflow-learner.ts",
    "services/browser-voice.ts",
    "services/browser-notifications.ts",
    "services/free-whatsapp.ts"
)
$allServicesExist = $true
foreach ($service in $services) {
    if (-not (Test-Path $service)) {
        $allServicesExist = $false
    }
}
if ($allServicesExist) {
    Write-Host " [PASS] (7 services)" -ForegroundColor Green
    $passed++
} else {
    Write-Host " [FAIL]" -ForegroundColor Red
    $errors++
}

# Test 4: Check UI Components
Write-Host "Test 4: Checking UI Components..." -NoNewline
$components = @(
    "components/admin/agents/DeviceCard.tsx",
    "components/admin/agents/TaskQueue.tsx",
    "components/admin/agents/CommandConsole.tsx",
    "components/admin/agents/ApprovalGate.tsx",
    "components/admin/agents/ChatPanel.tsx"
)
$allComponentsExist = $true
foreach ($component in $components) {
    if (-not (Test-Path $component)) {
        $allComponentsExist = $false
    }
}
if ($allComponentsExist) {
    Write-Host " [PASS] (5 components)" -ForegroundColor Green
    $passed++
} else {
    Write-Host " [FAIL]" -ForegroundColor Red
    $errors++
}

# Test 5: Check API Routes
Write-Host "Test 5: Checking API Routes..." -NoNewline
$routes = @(
    "app/api/admin/agents/heartbeat/route.ts",
    "app/api/admin/agents/devices/route.ts",
    "app/api/admin/agents/tasks/route.ts",
    "app/api/admin/agents/lock/route.ts",
    "app/api/admin/agents/messages/route.ts"
)
$allRoutesExist = $true
foreach ($route in $routes) {
    if (-not (Test-Path $route)) {
        $allRoutesExist = $false
    }
}
if ($allRoutesExist) {
    Write-Host " [PASS] (5 routes)" -ForegroundColor Green
    $passed++
} else {
    Write-Host " [FAIL]" -ForegroundColor Red
    $errors++
}

# Test 6: Check Admin Page
Write-Host "Test 6: Checking Admin Page..." -NoNewline
if (Test-Path "app/admin/agents/page.tsx") {
    Write-Host " [PASS]" -ForegroundColor Green
    $passed++
} else {
    Write-Host " [FAIL]" -ForegroundColor Red
    $errors++
}

# Test 7: Check Docker files
Write-Host "Test 7: Checking Docker files..." -NoNewline
$dockerFiles = @(
    "docker-compose.browser-workspace.yml",
    "docker/agent-nodes/headless-node/Dockerfile",
    "docker/agent-nodes/headless-node/entrypoint.js"
)
$allDockerExist = $true
foreach ($file in $dockerFiles) {
    if (-not (Test-Path $file)) {
        $allDockerExist = $false
    }
}
if ($allDockerExist) {
    Write-Host " [PASS]" -ForegroundColor Green
    $passed++
} else {
    Write-Host " [FAIL]" -ForegroundColor Red
    $errors++
}

# Test 8: Check package.json scripts
Write-Host "Test 8: Checking package.json scripts..." -NoNewline
$packageContent = Get-Content "package.json" -Raw
$hasSupabaseScripts = $packageContent -match "supabase:push" -and $packageContent -match "db:migrate"
if ($hasSupabaseScripts) {
    Write-Host " [PASS]" -ForegroundColor Green
    $passed++
} else {
    Write-Host " [FAIL]" -ForegroundColor Red
    $errors++
}

# Test 9: Check next.config.ts
Write-Host "Test 9: Checking next.config.ts..." -NoNewline
$nextConfig = Get-Content "next.config.ts" -Raw
$hasBuildSafeguards = $nextConfig -match "ignoreBuildErrors:\s*false"
if ($hasBuildSafeguards) {
    Write-Host " [PASS]" -ForegroundColor Green
    $passed++
} else {
    Write-Host " [FAIL]" -ForegroundColor Red
    $errors++
}

# Test 10: Check Supabase config
Write-Host "Test 10: Checking Supabase config..." -NoNewline
if (Test-Path "supabase/config.toml") {
    Write-Host " [PASS]" -ForegroundColor Green
    $passed++
} else {
    Write-Host " [FAIL]" -ForegroundColor Red
    $errors++
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Results" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Passed: $passed/10" -ForegroundColor Green
Write-Host "Failed: $errors/10" -ForegroundColor $(if($errors -eq 0){'Green'}else{'Red'})
Write-Host ""

if ($errors -eq 0) {
    Write-Host "PERFECT! All tests passed!" -ForegroundColor Green
} elseif ($passed -ge 8) {
    Write-Host "Good! Most tests passed." -ForegroundColor Yellow
} else {
    Write-Host "Warning: Some tests failed." -ForegroundColor Red
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run: npm run supabase:push"
Write-Host "2. Run: docker-compose -f docker-compose.browser-workspace.yml up -d"
Write-Host "3. Run: npm run dev"
Write-Host "4. Open: http://localhost:3000/admin/agents"
