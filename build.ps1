$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$source = Join-Path $PSScriptRoot 'addon'
$manifest = Get-Content -LiteralPath (Join-Path $source 'manifest.json') -Raw | ConvertFrom-Json
$dist = Join-Path $PSScriptRoot 'dist'
New-Item -ItemType Directory -Path $dist -Force | Out-Null

$package = Join-Path $dist "ThunderCards-$($manifest.version).xpi"
if (Test-Path -LiteralPath $package) {
    Remove-Item -LiteralPath $package
}

[System.IO.Compression.ZipFile]::CreateFromDirectory($source, $package)
Get-Item -LiteralPath $package
