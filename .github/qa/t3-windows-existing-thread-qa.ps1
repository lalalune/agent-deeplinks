$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$scratch = Join-Path $env:RUNNER_TEMP 't3-windows-existing-thread'
$evidence = Join-Path $scratch 'evidence'
$installer = Join-Path $scratch 'T3-Code-0.1.13-x64.exe'
$install = Join-Path $scratch 'installed'
$cliZip = Join-Path $scratch 't3-0.1.13-win32-x64.zip'
$package = Join-Path $scratch 'agent-deeplinks.tgz'
$record = [ordered]@{
  os = (Get-CimInstance Win32_OperatingSystem).Caption
  accountUsed = $false
  phase = 'official release setup'
}
$blockGroup = "T3 existing-thread ephemeral QA $PID"
$binary = $null
$cli = $null
$node = (Get-Command node.exe).Source
$git = (Get-Command git.exe).Source
$pwsh = (Get-Command pwsh.exe).Source
New-Item -ItemType Directory -Path $evidence -Force | Out-Null

function Assert-Digest([string]$path, [string]$expected, [Int64]$size = 0) {
  $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hash -cne $expected -or ($size -gt 0 -and (Get-Item -LiteralPath $path).Length -ne $size)) {
    throw "Published asset hash or length mismatch: $([IO.Path]::GetFileName($path))"
  }
  return $hash
}

function Assert-Signed([string]$path) {
  $signature = Get-AuthenticodeSignature -LiteralPath $path
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'CN=T3 Tools Inc(?:,|$)') {
    throw "Unexpected Authenticode signature: $([IO.Path]::GetFileName($path))"
  }
  return @{ status = $signature.Status.ToString(); subject = $signature.SignerCertificate.Subject }
}

try {
  $handlerPath = 'Registry::HKEY_CLASSES_ROOT\t3code\shell\open\command'
  if (Test-Path -LiteralPath $handlerPath) { throw 'Expected an unregistered hosted runner' }
  $vendor = 'https://github.com/pingdotgg/t3code/releases/download/v0.1.13'
  $downloads = @(
    @{ url = "$vendor/T3-Code-0.1.13-x64.exe"; target = $installer },
    @{ url = "$vendor/t3-0.1.13-win32-x64.zip"; target = $cliZip },
    @{ url = 'https://registry.npmjs.org/agent-deeplinks/-/agent-deeplinks-0.1.66.tgz'; target = $package }
  )
  $downloads | ForEach-Object -Parallel {
    & curl.exe --fail --silent --show-error --location --proto '=https' --connect-timeout 25 --max-time 130 --output $_.target $_.url
    if ($LASTEXITCODE -ne 0) { throw 'Official release asset download failed' }
  }
  $record.installerSHA256 = Assert-Digest $installer '244f6992aade889b9fae763d8bc41d194992d8f89f70d9a3fdbbfab15ba68594' 395318896
  $record.cliSHA256 = Assert-Digest $cliZip '691457b9fb0fec2de132a0da1e801997a79e9be9c148981d291c37bf6d312a3e' 170018815
  $record.helperSHA256 = Assert-Digest $package '51d42aeb4932005fb89590f9779121f39f1b9a91ef941b3ea13207d6bf4aceca'
  $record.installerSignature = Assert-Signed $installer
  Copy-Item .github/qa/t3-windows-existing-thread-qa.mjs (Join-Path $scratch 'check.mjs')
  Copy-Item .github/qa/t3-windows-existing-thread-cold.ps1 (Join-Path $scratch 'cold.ps1')
  Push-Location $scratch
  try {
    & npm.cmd install --ignore-scripts --no-fund --no-audit --save-exact playwright-core@1.58.2 ./agent-deeplinks.tgz
    if ($LASTEXITCODE -ne 0) { throw 'Could not install the pinned helper dependencies' }
  } finally { Pop-Location }
  $cliDirectory = Join-Path $scratch 'cli'
  Expand-Archive -LiteralPath $cliZip -DestinationPath $cliDirectory
  $binaries = @(Get-ChildItem -LiteralPath $cliDirectory -Recurse -File -Filter 't3.exe')
  if ($binaries.Count -ne 1) { throw 'Expected one official t3.exe' }
  $cli = $binaries[0].FullName

  $record.phase = 'stock signed app installation'
  $env:HOME = Join-Path $scratch 'home'
  $env:USERPROFILE = $env:HOME
  $env:APPDATA = Join-Path $scratch 'appdata'
  $env:LOCALAPPDATA = Join-Path $scratch 'local-appdata'
  $env:T3CODE_HOME = Join-Path $scratch 't3-home'
  $env:TEMP = Join-Path $scratch 'tmp'
  $env:TMP = $env:TEMP
  $env:T3CODE_TELEMETRY_ENABLED = 'false'
  $env:T3CODE_DISABLE_AUTO_UPDATE = 'true'
  $env:GIT_CONFIG_NOSYSTEM = '1'
  $env:GIT_TERMINAL_PROMPT = '0'
  $env:LANG = 'en_US.UTF-8'
  New-Item -ItemType Directory -Force -Path $env:HOME, $env:APPDATA, $env:LOCALAPPDATA, $env:T3CODE_HOME,
    $env:TEMP, (Join-Path $scratch 'fixture') | Out-Null
  foreach ($entry in Get-ChildItem Env:) {
    if ($entry.Name -match '(^|_)(API_KEY|ACCESS_TOKEN|AUTH_TOKEN|GITHUB_TOKEN|GH_TOKEN)$' -or $entry.Name -match '^T3(CODE)?_.*(SECRET|TOKEN)$') {
      Remove-Item ("Env:" + $entry.Name) -ErrorAction SilentlyContinue
    }
  }
  $setup = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$install") -PassThru
  if (!$setup.WaitForExit(110000) -or $setup.ExitCode -ne 0) { throw 'The official installer did not complete' }
  $binary = Join-Path $install 'T3 Code (Beta).exe'
  $file = Get-Item -LiteralPath $binary
  if ($file.VersionInfo.ProductVersion -notmatch '^0\.1\.13(?:\D|$)') { throw 'Unexpected installed T3 version' }
  $record.app = @{ productVersion = $file.VersionInfo.ProductVersion; signature = (Assert-Signed $binary) }

  $record.phase = 'owned executables outbound isolation'
  $enabled = @(Get-NetFirewallProfile -PolicyStore ActiveStore | Where-Object { $_.Enabled -ne 'True' }).Count -eq 0
  if (!$enabled) { throw 'An active Windows Firewall profile is disabled' }
  # Exclude only 127/8 and ::1 so the packaged server and renderer can use loopback.
  $nonLoopback = @('0.0.0.0-126.255.255.255', '128.0.0.0-255.255.255.255', '::2-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')
  foreach ($program in @($cli, $binary)) {
    New-NetFirewallRule -DisplayName ("T3 QA " + [IO.Path]::GetFileName($program)) -Group $blockGroup -Direction Outbound -Action Block -Program $program -RemoteAddress $nonLoopback -Profile Any | Out-Null
  }
  $rules = @(Get-NetFirewallRule -PolicyStore ActiveStore -Group $blockGroup)
  if ($rules.Count -ne 2 -or @($rules | Where-Object { $_.Action -ne 'Block' -or $_.Enabled -ne 'True' }).Count -ne 0) {
    throw 'Expected both scoped executable restrictions in the active policy'
  }
  $record.egress = @{ activeFirewallEnabled = $enabled; scopedOutboundBlockCount = $rules.Count; remote = $nonLoopback }
  $record.phase = 'stock native link and renderer observation'
  $record | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $evidence 'installer-and-egress.json') -Encoding utf8
  $env:T3_QA_BINARY = $binary
  $env:T3_QA_CLI = $cli
  $env:T3_QA_SHELL = $pwsh
  $env:PATH = @((Split-Path $node), (Split-Path $git), (Split-Path $pwsh), "$env:SystemRoot\System32", $env:SystemRoot) -join ';'
  & $node (Join-Path $scratch 'check.mjs') $scratch
  if ($LASTEXITCODE -ne 0) { throw 'The stock native observation fixture failed' }
  $record.phase = 'complete'
} finally {
  foreach ($program in @($cli, $binary)) {
    if (!$program) { continue }
    $name = [IO.Path]::GetFileName($program).Replace("'", "''")
    Get-CimInstance Win32_Process -Filter "Name = '$name'" -ErrorAction SilentlyContinue |
      Where-Object { $_.ExecutablePath -ieq $program } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  }
  Remove-NetFirewallRule -Group $blockGroup -ErrorAction SilentlyContinue
  $record | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $evidence 'installer-and-egress.json') -Encoding utf8
  $record | ConvertTo-Json -Depth 6
}
