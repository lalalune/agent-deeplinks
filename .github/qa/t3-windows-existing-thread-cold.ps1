$ErrorActionPreference = 'Stop'
$evidence = $env:T3_QA_EVIDENCE
$binary = $env:T3_QA_BINARY
$url = $env:T3_QA_URI
$expected = $env:T3_QA_EXPECTED
$proof = [ordered]@{ shellInput = $url; exactChildArgument = $false; visibleDraft = $null }

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class T3ColdWindow {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr window, IntPtr dc, uint flags);
  [DllImport("shell32.dll", SetLastError=true)] public static extern IntPtr CommandLineToArgvW([MarshalAs(UnmanagedType.LPWStr)] string command, out int count);
  [DllImport("kernel32.dll")] public static extern IntPtr LocalFree(IntPtr pointer);
}
'@

function Get-OwnedProcesses {
  $name = [IO.Path]::GetFileName($binary).Replace("'", "''")
  Get-CimInstance Win32_Process -Filter "Name = '$name'" |
    Where-Object { $_.ExecutablePath -ieq $binary }
}

function Get-Argument([string]$command) {
  $count = 0
  $buffer = [T3ColdWindow]::CommandLineToArgvW($command, [ref]$count)
  if ($buffer -eq [IntPtr]::Zero) { return $null }
  try {
    for ($offset = 1; $offset -lt $count; $offset++) {
      $argument = [Runtime.InteropServices.Marshal]::PtrToStringUni(
        [Runtime.InteropServices.Marshal]::ReadIntPtr($buffer, $offset * [IntPtr]::Size))
      if ($argument -like 't3code:*') { return $argument }
    }
  } finally { [void][T3ColdWindow]::LocalFree($buffer) }
}

function Read-EditableDraft([System.Diagnostics.Process]$process) {
  try {
    $window = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
    $condition = [System.Windows.Automation.PropertyCondition]::new(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::Edit)
    foreach ($editor in $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)) {
      $current = $editor.Current
      if ($current.IsOffscreen -or !$current.IsEnabled -or $current.IsPassword -or $current.BoundingRectangle.Width -le 0) { continue }
      $value = $null
      if ($editor.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$value) -and
          !$value.Current.IsReadOnly -and $value.Current.Value -ceq $expected) {
        return @{ method = 'UI Automation ValuePattern'; value = $value.Current.Value; editable = $true }
      }
      $text = $null
      if ($editor.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$text) -and
          $text.DocumentRange.GetText(-1).TrimEnd([char[]]"`r`n") -ceq $expected) {
        return @{ method = 'UI Automation TextPattern on enabled edit control'; value = $expected; editable = $true }
      }
    }
  } catch { $proof.lastAutomationError = $_.Exception.GetType().Name }
  return $null
}

function Save-Window([System.Diagnostics.Process]$process, [string]$filename) {
  $handle = $process.MainWindowHandle
  $rect = [T3ColdWindow+Rect]::new()
  if (![T3ColdWindow]::GetWindowRect($handle, [ref]$rect)) { return }
  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top
  if ($width -lt 100 -or $height -lt 100 -or $width -gt 3840 -or $height -gt 2160) { return }
  $bitmap = [Drawing.Bitmap]::new($width, $height)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  try {
    if ([T3ColdWindow]::GetForegroundWindow() -eq $handle) {
      $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
    } else {
      $dc = $graphics.GetHdc()
      try { if (![T3ColdWindow]::PrintWindow($handle, $dc, 2)) { return } }
      finally { $graphics.ReleaseHdc($dc) }
    }
    $bitmap.Save((Join-Path $evidence $filename), [Drawing.Imaging.ImageFormat]::Png)
    $proof.screenshot = $filename
  } catch { $proof.lastCaptureError = $_.Exception.GetType().Name }
  finally { $graphics.Dispose(); $bitmap.Dispose() }
}

try {
  for ($attempt = 0; $attempt -lt 20 -and @(Get-OwnedProcesses).Count -gt 0; $attempt++) {
    Start-Sleep -Milliseconds 250
  }
  $proof.before = @{ stopped = @(Get-OwnedProcesses).Count -eq 0 }
  if (!$proof.before.stopped) { throw 'The previous disposable app instance did not exit.' }
  $child = Start-Process -FilePath $url -PassThru
  if (!$child) { throw 'Windows Shell did not report a process.' }
  $proof.shellPid = $child.Id
  $deadline = (Get-Date).AddSeconds(43)
  while ((Get-Date) -lt $deadline) {
    foreach ($entry in @(Get-OwnedProcesses)) {
      $argument = Get-Argument $entry.CommandLine
      if ($argument -ceq $url) {
        $proof.exactChildArgument = $true
        $proof.launchPid = $entry.ProcessId
      } elseif ($argument) {
        $proof.observedProtocolArgument = $argument
      }
      $process = Get-Process -Id $entry.ProcessId -ErrorAction SilentlyContinue
      if (!$process -or $process.MainWindowHandle -eq [IntPtr]::Zero) { continue }
      $proof.window = @{ pid = $process.Id; title = $process.MainWindowTitle }
      $proof.visibleDraft = Read-EditableDraft $process
      if ($proof.visibleDraft) {
        Save-Window $process '03-cold-existing-thread-unsent.png'
        if ($proof.exactChildArgument) { break }
      } elseif (!$proof.screenshot) {
        Save-Window $process '04-cold-existing-thread-checkpoint.png'
      }
    }
    if ($proof.exactChildArgument -and $proof.visibleDraft) { break }
    Start-Sleep -Milliseconds 375
  }
  if (!$proof.exactChildArgument -or !$proof.visibleDraft) { throw 'No exact stock cold-launch URI and editable draft were observed together.' }
  if ($proof.launchPid -ne $proof.window.pid) { throw 'The observed editor was not owned by the cold launch process.' }
} finally {
  $proof | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $evidence 'cold-proof.json') -Encoding utf8
}
