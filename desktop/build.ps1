# Build the Windows single-file EXE (WinForms + embedded WebView2).
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File desktop\build.ps1
# Requirements: .NET Framework 4.x csc.exe (ships with Windows),
#               desktop\lib\*.dll from the WebView2 SDK, desktop\app.ico.
# NOTE: keep this file ASCII-only so Windows PowerShell 5.1 parses it correctly.
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$desktopDir = $PSScriptRoot
$distDir = Join-Path $root 'dist'
$libDir = Join-Path $desktopDir 'lib'

# locate csc.exe (.NET Framework)
$cscCandidates = @(
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
)
$csc = $cscCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $csc) { throw 'csc.exe not found (need .NET Framework 4.x)' }

foreach ($f in @('launcher.cs', 'app.manifest', 'app.ico')) {
    if (-not (Test-Path (Join-Path $desktopDir $f))) { throw "missing desktop/$f" }
}
foreach ($f in @('Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll', 'WebView2Loader.dll')) {
    if (-not (Test-Path (Join-Path $libDir $f))) { throw "missing desktop/lib/$f (get it from the WebView2 NuGet package)" }
}
New-Item -ItemType Directory -Force $distDir | Out-Null

# content stamp: only re-extract embedded files at runtime when content changed
$stampFiles = @(
    (Join-Path $root 'index.html'),
    (Join-Path $root 'styles.css'),
    (Join-Path $root 'engine.js'),
    (Join-Path $root 'app.js'),
    (Join-Path $desktopDir 'app.ico'),
    (Join-Path $libDir 'Microsoft.Web.WebView2.Core.dll'),
    (Join-Path $libDir 'Microsoft.Web.WebView2.WinForms.dll'),
    (Join-Path $libDir 'WebView2Loader.dll')
)
$sha = [System.Security.Cryptography.SHA256]::Create()
$ms = New-Object System.IO.MemoryStream
foreach ($f in $stampFiles) {
    $bytes = [System.IO.File]::ReadAllBytes($f)
    $ms.Write($bytes, 0, $bytes.Length)
}
$stamp = ([System.BitConverter]::ToString($sha.ComputeHash($ms.ToArray())) -replace '-', '').ToLowerInvariant().Substring(0, 16)
$stampFile = Join-Path $desktopDir 'stamp.txt'
[System.IO.File]::WriteAllText($stampFile, $stamp)
Write-Host "stamp: $stamp"

# output file name: "2632" + U+8BA1 U+7B97 U+5668 (calculator) + ".exe" -> keep source ASCII
$outName = '2632' + [char]0x8BA1 + [char]0x7B97 + [char]0x5668 + '.exe'
$outExe = Join-Path $distDir $outName

$cscArgs = @(
    '/nologo',
    '/target:winexe',
    '/platform:x64',
    '/optimize+',
    '/codepage:65001',
    "/out:$outExe",
    "/win32icon:$(Join-Path $desktopDir 'app.ico')",
    "/win32manifest:$(Join-Path $desktopDir 'app.manifest')",
    "/reference:$(Join-Path $libDir 'Microsoft.Web.WebView2.Core.dll')",
    "/reference:$(Join-Path $libDir 'Microsoft.Web.WebView2.WinForms.dll')",
    '/reference:System.dll',
    '/reference:System.Core.dll',
    '/reference:System.Drawing.dll',
    '/reference:System.Windows.Forms.dll',
    "/resource:$(Join-Path $root 'index.html'),index.html",
    "/resource:$(Join-Path $root 'styles.css'),styles.css",
    "/resource:$(Join-Path $root 'engine.js'),engine.js",
    "/resource:$(Join-Path $root 'app.js'),app.js",
    "/resource:$(Join-Path $desktopDir 'app.ico'),app.ico",
    "/resource:$stampFile,stamp.txt",
    "/resource:$(Join-Path $libDir 'Microsoft.Web.WebView2.Core.dll'),Microsoft.Web.WebView2.Core.dll",
    "/resource:$(Join-Path $libDir 'Microsoft.Web.WebView2.WinForms.dll'),Microsoft.Web.WebView2.WinForms.dll",
    "/resource:$(Join-Path $libDir 'WebView2Loader.dll'),WebView2Loader.dll",
    (Join-Path $desktopDir 'launcher.cs')
)

Write-Host 'Compiling ...'
& $csc @cscArgs
if ($LASTEXITCODE -ne 0) { throw "csc failed (exit $LASTEXITCODE)" }

$size = (Get-Item $outExe).Length
Write-Host ("OK -> {0}  ({1:N0} KB)" -f $outExe, ($size / 1KB))
