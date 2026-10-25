# Run from any directory. Compile the actual 3D game before launching it.
$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot "package.json"))) {
    throw "WORLD-GUARD- repository was not found beside this script."
}
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "Node.js/npm is required to compile the 3D game. Install Node.js 22 or newer."
}
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python 3 is required by START_3D.cmd to serve the game."
}
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot "node_modules"))) {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
}
npm run build:game
if ($LASTEXITCODE -ne 0) { throw "3D bundle compilation failed." }
npm test
if ($LASTEXITCODE -ne 0) { throw "Tests failed. The game was not launched." }
& (Join-Path $PSScriptRoot "START_3D.cmd")
if ($LASTEXITCODE -ne 0) { throw "Game launcher failed." }
