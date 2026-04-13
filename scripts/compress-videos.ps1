# Compress videos to under 4.5MB for Vercel
$videos = @(
    @{Name="hero-1.mp4"; TargetMB=4.0},
    @{Name="hero-2.mp4"; TargetMB=4.0},
    @{Name="hero-3.mp4"; TargetMB=4.0},
    @{Name="hero-4.mp4"; TargetMB=4.0},
    @{Name="hero-5.mp4"; TargetMB=4.0},
    @{Name="hero-6.mp4"; TargetMB=4.0}
)

$inputDir = "d:\azenith living\my-app\public\videos"
$outputDir = "d:\azenith living\my-app\public\videos\compressed"

# Create output directory
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

foreach ($video in $videos) {
    $inputFile = Join-Path $inputDir $video.Name
    $outputFile = Join-Path $outputDir $video.Name
    
    $originalSize = (Get-Item $inputFile).Length / 1MB
    Write-Host "Processing $($video.Name) (Original: $([math]::Round($originalSize,2)) MB)..."
    
    # Calculate target bitrate (video only, assuming audio at 128k)
    $targetVideoBitrate = [math]::Floor(($video.TargetMB * 8 * 0.85 * 1024 * 1024) / 15) # 15 seconds average
    
    # Compress with ffmpeg: reduce resolution to 720p, lower bitrate
    ffmpeg -i "$inputFile" `
        -vf "scale=-1:720:force_original_aspect_ratio=decrease" `
        -c:v libx264 `
        -b:v "${targetVideoBitrate}" `
        -maxrate "${targetVideoBitrate}" `
        -bufsize "$($targetVideoBitrate * 2)" `
        -c:a aac `
        -b:a 96k `
        -movflags +faststart `
        -y "$outputFile" 2>&1 | Select-String "Output|Error|frame" | Select-Object -Last 5
    
    $newSize = (Get-Item $outputFile).Length / 1MB
    Write-Host "✅ $($video.Name) compressed to $([math]::Round($newSize,2)) MB" -ForegroundColor Green
}

Write-Host "`nCompression complete! Replacing original files..."

# Replace original files with compressed versions
foreach ($video in $videos) {
    $compressed = Join-Path $outputDir $video.Name
    $original = Join-Path $inputDir $video.Name
    
    # Backup original
    Move-Item -Path $original -Destination "$original.backup" -Force
    
    # Move compressed to original location
    Move-Item -Path $compressed -Destination $original -Force
    
    $finalSize = (Get-Item $original).Length / 1MB
    Write-Host "✅ $([math]::Round($finalSize,2)) MB - $($video.Name)" -ForegroundColor Green
}

# Remove compressed folder and backups
Remove-Item -Path $outputDir -Recurse -Force
Get-ChildItem -Path $inputDir -Filter "*.backup" | Remove-Item -Force

Write-Host "`nAll videos compressed successfully!" -ForegroundColor Cyan
