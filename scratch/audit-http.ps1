$base = "http://localhost:3000"
$pages = @(
  "/",
  "/about",
  "/rooms",
  "/rooms/living-room",
  "/rooms/bedroom",
  "/rooms/kitchen",
  "/rooms/invalid-slug-xyz",
  "/start",
  "/request",
  "/privacy",
  "/terms",
  "/bookings",
  "/furniture",
  "/furniture/sofa",
  "/elite",
  "/elite/login",
  "/elite/dashboard",
  "/elite-brief",
  "/elite-intelligence",
  "/gate/login",
  "/admin",
  "/admin/agents",
  "/admin/browser",
  "/admin/computer",
  "/admin/database",
  "/admin/fate",
  "/admin/intel",
  "/admin/manufacturing",
  "/admin/owner-dashboard",
  "/admin/phone",
  "/admin/sales",
  "/admin/sandbox",
  "/admin/settings",
  "/admin/whatsapp",
  "/sitemap.xml",
  "/robots.txt"
)

$apis = @(
  "/api/config",
  "/api/system-health",
  "/api/navigation",
  "/api/theme",
  "/api/pexels?query=living+room&per_page=3",
  "/api/room-sections",
  "/api/cms/public-config",
  "/api/consultant/faq",
  "/api/bookings",
  "/api/leads",
  "/api/analytics",
  "/api/translations",
  "/api/curated-images",
  "/api/elite-gallery",
  "/api/growth-insights",
  "/api/reality/check",
  "/api/admin/2fa/status",
  "/api/admin/settings",
  "/api/admin/leads",
  "/api/admin/whatsapp/status",
  "/api/admin/ai/health",
  "/api/admin/keys/stats",
  "/api/admin/metrics/realtime",
  "/api/admin/sovereign/pulse",
  "/api/test-search",
  "/api/test-harvest"
)

function Test-Url($path) {
  try {
    $r = Invoke-WebRequest -Uri "$base$path" -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 0 -ErrorAction SilentlyContinue
    return @{ path=$path; status=$r.StatusCode; len=$r.Content.Length; ok=$true }
  } catch {
    $status = 0
    $len = 0
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        $len = $body.Length
      } catch {}
    }
    return @{ path=$path; status=$status; len=$len; ok=$false; err=$_.Exception.Message }
  }
}

Write-Host "=== PAGES ==="
foreach ($p in $pages) {
  $r = Test-Url $p
  Write-Host "$($r.status)`t$($r.len)`t$p"
}

Write-Host "`n=== APIs ==="
foreach ($a in $apis) {
  $r = Test-Url $a
  Write-Host "$($r.status)`t$($r.len)`t$a"
}
