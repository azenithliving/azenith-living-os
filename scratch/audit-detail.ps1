$base = "http://localhost:3000"

function Get-Json($path, $method = "GET", $body = $null) {
  try {
    $params = @{
      Uri = "$base$path"
      UseBasicParsing = $true
      TimeoutSec = 45
      Method = $method
    }
    if ($body) {
      $params.Body = ($body | ConvertTo-Json)
      $params.ContentType = "application/json"
    }
    $r = Invoke-WebRequest @params
    return @{ status=$r.StatusCode; body=$r.Content.Substring(0, [Math]::Min(500, $r.Content.Length)) }
  } catch {
    $status = 0; $body = ""
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      try {
        $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $sr.ReadToEnd()
        if ($body.Length -gt 500) { $body = $body.Substring(0,500) }
      } catch {}
    }
    return @{ status=$status; body=$body; err=$_.Exception.Message }
  }
}

$checks = @(
  "/api/pexels?query=living+room&per_page=3",
  "/api/room-sections?slug=living-room",
  "/api/consultant/faq",
  "/api/elite-gallery",
  "/api/test-search?q=test",
  "/api/test-harvest",
  "/api/navigation?locale=ar",
  "/api/translations?locale=ar",
  "/api/curated-images?slug=living-room",
  "/api/config",
  "/api/system-health",
  "/api/checkout",
  "/api/consultant",
  "/api/content-generator",
  "/api/omnipotent",
  "/api/admin/whatsapp/status"
)

foreach ($c in $checks) {
  $r = Get-Json $c
  Write-Host "`n--- $c [$($r.status)] ---"
  Write-Host $r.body
}

# POST tests
$postChecks = @(
  @{ path="/api/leads"; body=@{ name="Audit"; email="audit@test.com"; phone="01000000000" } },
  @{ path="/api/consultant"; body=@{ message="test"; sessionId="audit-1" } },
  @{ path="/api/bookings"; body=@{ name="Audit"; email="audit@test.com"; date="2026-06-01" } }
)
foreach ($p in $postChecks) {
  $r = Get-Json $p.path "POST" $p.body
  Write-Host "`n--- POST $($p.path) [$($r.status)] ---"
  Write-Host $r.body
}

# Check admin redirect
try {
  $r = Invoke-WebRequest -Uri "$base/admin" -UseBasicParsing -MaximumRedirection 5
  Write-Host "`n--- /admin final URL ---"
  Write-Host $r.BaseResponse.ResponseUri.AbsoluteUri
  Write-Host "Status: $($r.StatusCode) Len: $($r.Content.Length)"
} catch {
  Write-Host "Admin redirect error: $($_.Exception.Message)"
}

# Compare page bodies for duplicate shell
$home = (Invoke-WebRequest "$base/" -UseBasicParsing).Content
$invalid = (Invoke-WebRequest "$base/rooms/invalid-slug-xyz" -UseBasicParsing).Content
$same = ($home -eq $invalid)
Write-Host "`n--- Home vs invalid room slug identical: $same ---"
Write-Host "Home title match: $($home -match '<title>')"
if ($home -match '<title>([^<]+)</title>') { Write-Host "Home title: $($Matches[1])" }
if ($invalid -match '<title>([^<]+)</title>') { Write-Host "Invalid title: $($Matches[1])" }
