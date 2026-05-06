<#
.SYNOPSIS
    Save the clipboard image (or a given PNG file) to docs/images/<name>.png.

.DESCRIPTION
    Helper for filing screenshots into the project's docs/images/ folder
    with the exact filenames the markdown placeholders expect.

    Two modes:
      1. Clipboard mode (default): take a screenshot with Win+Shift+S so
         the image lands in your clipboard, then run this script with the
         target name.
      2. File mode: if the second positional argument is a path to an
         existing PNG, that file is copied instead. Useful when you've
         already saved a bunch of screenshots (e.g. via Win+PrtSc into
         Pictures\Screenshots\) and just want to file them.

.PARAMETER Name
    Target filename WITHOUT extension. The image is saved as
    docs/images/<Name>.png. See docs/images/README.md for the full list
    of expected names.

.PARAMETER From
    Optional path to an existing PNG to copy. If omitted, the clipboard
    image is used.

.EXAMPLE
    # After Win+Shift+S
    .\scripts\save-snip.ps1 usage-01-home

.EXAMPLE
    # Copy an existing PNG from Pictures\Screenshots\
    .\scripts\save-snip.ps1 usage-04-progress "$env:USERPROFILE\Pictures\Screenshots\Screenshot 2026-05-06 144213.png"
#>
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Name,

    [Parameter(Mandatory = $false, Position = 1)]
    [string]$From
)

$ErrorActionPreference = "Stop"

# Resolve docs/images relative to this script (scripts/ is a sibling of docs/).
$repoRoot  = Split-Path -Parent $PSScriptRoot
$imagesDir = Join-Path $repoRoot "docs\images"
if (-not (Test-Path $imagesDir)) {
    New-Item -ItemType Directory -Path $imagesDir -Force | Out-Null
}

# Strip .png if user accidentally included it in $Name.
if ($Name.ToLower().EndsWith(".png")) {
    $Name = $Name.Substring(0, $Name.Length - 4)
}
$target = Join-Path $imagesDir "$Name.png"

if ($From) {
    # File mode: copy an existing PNG.
    if (-not (Test-Path $From)) {
        Write-Host "[ERROR] Source file not found: $From" -ForegroundColor Red
        exit 1
    }
    Copy-Item -Path $From -Destination $target -Force
} else {
    # Clipboard mode: pull the image from the clipboard.
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $img = [System.Windows.Forms.Clipboard]::GetImage()
    if ($null -eq $img) {
        Write-Host ""
        Write-Host "[ERROR] No image in clipboard." -ForegroundColor Red
        Write-Host "        Take a screenshot first (Win+Shift+S), then re-run."
        Write-Host ""
        Write-Host "        Or pass a file path as the second arg:" -ForegroundColor Yellow
        Write-Host "          .\scripts\save-snip.ps1 $Name C:\path\to\file.png"
        exit 1
    }
    $img.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
}

Write-Host ""
Write-Host "[OK] Saved screenshot:" -ForegroundColor Green
Write-Host "     $target"
Write-Host ""
Write-Host "Next steps (commit to git):" -ForegroundColor Cyan
Write-Host "     git add `"docs/images/$Name.png`""
Write-Host "     git commit -m `"docs: add $Name screenshot`""
Write-Host "     git push origin main"
Write-Host ""
