# GA PSS(R)E SLD bridge driver: launches the LICENSED local PSS(R)E 36.5 GUI, optionally opens a .sld,
# runs a Python script in its embedded interpreter (CLI window, so sliderPy is available),
# optionally drives File > Save As, waits for a done-marker and closes PSS(R)E.
# Usage: powershell -File psse_gui_driver.ps1 -Script x.py [-Sld in.sld] [-SaveAs out.sld|out.sldxml] [-Done marker.txt] [-Timeout 120]
param(
  [string]$Sld = "",
  [string]$Script = "",
  [string]$SaveAs = "",
  [string]$Done = "",
  [string]$Pre = "",          # python statements prepended, e.g. "GA_OUT=r'x.json';"
  [int]$Timeout = 120,
  [string]$Psse = "C:\Program Files\PTI\PSSE36\36.5\PSSBIN\psse36.exe",
  [int]$FilterIndex = -1,    # Save As file-type index (0=Slider Binary .sld, 1=Slider XML .sldxml)
  [string]$Shot = "",
  [switch]$KeepOpen
)
$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices; using System.Collections.Generic;
public class W32 {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr p, EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder sb, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder sb, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, string l);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h, int id);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  public static List<IntPtr> Children(IntPtr p, string cls) { var r=new List<IntPtr>(); EnumChildWindows(p,(h,l)=>{var sb=new StringBuilder(256);GetClassName(h,sb,256); if(sb.ToString()==cls) r.Add(h); return true;},IntPtr.Zero); return r; }
  public static List<IntPtr> TopWindows(uint pid) { var r=new List<IntPtr>(); EnumWindows((h,l)=>{uint p; GetWindowThreadProcessId(h,out p); if(p==pid) r.Add(h); return true;},IntPtr.Zero); return r; }
  public static string Text(IntPtr h){var sb=new StringBuilder(512);GetWindowText(h,sb,512);return sb.ToString();}
  public static string WinText(IntPtr h){var sb=new StringBuilder(65536);SendMessage(h,0x000D,(IntPtr)65535,sb);return sb.ToString();}
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, StringBuilder l);
  public static string Cls(IntPtr h){var sb=new StringBuilder(256);GetClassName(h,sb,256);return sb.ToString();}
}
'@
Add-Type -AssemblyName System.Windows.Forms

$args2 = @(); if ($Sld) { $args2 += ('"' + $Sld + '"') }
$wd = if ($Sld) { Split-Path $Sld } else { $PWD.Path }
$p = Start-Process $Psse -ArgumentList $args2 -PassThru -WorkingDirectory $wd
function Log($m) { Write-Output ("[{0}] {1}" -f (Get-Date -Format HH:mm:ss), $m) }
# wait for CLI RichEdit
$cli = [IntPtr]::Zero; $t0 = Get-Date
while (((Get-Date) - $t0).TotalSeconds -lt 90 -and $cli -eq [IntPtr]::Zero) {
  Start-Sleep -Milliseconds 700; $p.Refresh()
  if ($p.HasExited) { throw "PSSE exited early" }
  foreach ($tw in [W32]::TopWindows([uint32]$p.Id)) {
    $e = [W32]::Children($tw, "RichEdit20A")
    foreach ($h in $e) { $par = [W32]::Cls($h); if ([W32]::Text($tw) -like "PSS*") { $cli = $h } }
  }
}
Log "PSSE pid $($p.Id) main='$($p.MainWindowTitle)' cli=$cli"
if ($cli -eq [IntPtr]::Zero) { $p.Kill(); throw "CLI not found" }
$p.Refresh(); $main = $p.MainWindowHandle; if ($main -eq [IntPtr]::Zero) { foreach ($tw in [W32]::TopWindows([uint32]$p.Id)) { if ([W32]::Text($tw) -like "PSS*" -and [W32]::IsWindowVisible($tw)) { $main = $tw } } }; Log "main hwnd $main"
# the CLI dialog hosts two RichEdit: input is the one whose parent is the 'Command Line Input' dialog
$inputEdit = [IntPtr]::Zero
foreach ($d in [W32]::Children($main, "#32770")) { if ([W32]::Text($d) -eq "Command Line Input") { $r = [W32]::Children($d, "RichEdit20A"); if ($r.Count -gt 0) { $inputEdit = $r[0] } } }
if ($inputEdit -eq [IntPtr]::Zero) { $inputEdit = $cli }
Start-Sleep -Seconds 3
$main = [IntPtr]::Zero; foreach ($tw in [W32]::TopWindows([uint32]$p.Id)) { if ([W32]::IsWindowVisible($tw) -and [W32]::Text($tw) -like "PSS*") { $main = $tw } }
$inputEdit = [IntPtr]::Zero
foreach ($d in [W32]::Children($main, "#32770")) { if ([W32]::Text($d) -eq "Command Line Input") { $r = [W32]::Children($d, "RichEdit20A"); if ($r.Count -gt 0) { $inputEdit = $r[0] } } }
if ($inputEdit -eq [IntPtr]::Zero) { $inputEdit = $cli }
Log "main=$main input=$inputEdit"
function SendCli([string]$text) {
  [void][W32]::SendMessage($inputEdit, 0x000C, [IntPtr]::Zero, $text)   # WM_SETTEXT
  Start-Sleep -Milliseconds 300
  [void][W32]::PostMessage($inputEdit, 0x0100, [IntPtr]0x0D, [IntPtr]0x001C0001) # WM_KEYDOWN VK_RETURN
  [void][W32]::PostMessage($inputEdit, 0x0102, [IntPtr]0x0D, [IntPtr]0x001C0001) # WM_CHAR
  [void][W32]::PostMessage($inputEdit, 0x0101, [IntPtr]0x0D, [IntPtr]0xC01C0001) # WM_KEYUP
}
if ($Script) {
  if ($Done -and (Test-Path $Done)) { Remove-Item $Done -Force }
  SendCli ($Pre + "exec(open(r'" + $Script + "', encoding='utf-8-sig').read())")
  Log "script sent"
  if ($Done) {
    $t0 = Get-Date
    while (-not (Test-Path $Done) -and ((Get-Date) - $t0).TotalSeconds -lt $Timeout) { Start-Sleep -Milliseconds 500 }
    Log ("done marker: " + (Test-Path $Done))
    if (-not (Test-Path $Done)) {
      foreach ($tw in [W32]::TopWindows([uint32]$p.Id)) {
        Log ("  topwin: [" + [W32]::Cls($tw) + "] '" + [W32]::Text($tw) + "' vis=" + [W32]::IsWindowVisible($tw))
        foreach ($r in [W32]::Children($tw, "RichEdit20A")) {
          $t = [W32]::WinText($r)
          if ($t.Length -gt 600) { $t = $t.Substring($t.Length - 600) }
          Log ("  richedit " + $r + ": " + ($t -replace "\r\n"," | "))
        }
      }
    }
  } else { Start-Sleep -Seconds ([Math]::Min($Timeout, 10)) }
}
if ($SaveAs) {
  if (Test-Path $SaveAs) { Remove-Item $SaveAs -Force }
  [void][W32]::SetForegroundWindow($main); Start-Sleep -Milliseconds 500
  [void][W32]::PostMessage($main, 0x0111, [IntPtr]0xE104, [IntPtr]::Zero)   # WM_COMMAND ID_FILE_SAVE_AS
  $dlg = [IntPtr]::Zero; $t0 = Get-Date
  while ($dlg -eq [IntPtr]::Zero -and ((Get-Date) - $t0).TotalSeconds -lt 20) {
    Start-Sleep -Milliseconds 400
    foreach ($tw in [W32]::TopWindows([uint32]$p.Id)) { if ($tw -ne $main -and [W32]::IsWindowVisible($tw) -and [W32]::Cls($tw) -eq "#32770") { $dlg = $tw } }
  }
  foreach ($tw in [W32]::TopWindows([uint32]$p.Id)) { if ([W32]::IsWindowVisible($tw)) { Log ("  top: " + $tw + " [" + [W32]::Cls($tw) + "] " + [W32]::Text($tw)) } }; Log "save dialog: $dlg title='$([W32]::Text($dlg))'"
  if ($dlg -ne [IntPtr]::Zero) {
    if ($FilterIndex -ge 0) { $cb = [W32]::GetDlgItem($dlg, 0x470); [void][W32]::SendMessage($cb, 0x014E, [IntPtr]$FilterIndex, [IntPtr]::Zero); [void][W32]::SendMessage($dlg, 0x0111, [IntPtr](0x470 + 0x10000), $cb); Log "filter set $FilterIndex" ; Start-Sleep -Milliseconds 400 }
    $ed = [W32]::Children($dlg, "Edit")
    if ($ed.Count -gt 0) { [void][W32]::SendMessage($ed[0], 0x000C, [IntPtr]::Zero, $SaveAs) }
    Start-Sleep -Milliseconds 400
    [void][W32]::PostMessage($dlg, 0x0111, [IntPtr]1, [IntPtr]::Zero)  # IDOK
    $t0 = Get-Date
    while (-not (Test-Path $SaveAs) -and ((Get-Date) - $t0).TotalSeconds -lt 30) { Start-Sleep -Milliseconds 500 }
    Log ("saved file exists: " + (Test-Path $SaveAs))
    # dismiss any follow-up message box with Enter
    Start-Sleep -Seconds 1
  }
}if ($Shot) { Add-Type -AssemblyName System.Drawing; $bmp = New-Object Drawing.Bitmap ([Windows.Forms.SystemInformation]::VirtualScreen.Width), ([Windows.Forms.SystemInformation]::VirtualScreen.Height); $g = [Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen(0,0,0,0,$bmp.Size); $bmp.Save($Shot); Log "shot saved" }
if (-not $KeepOpen) { Start-Sleep -Seconds 1; if (-not $p.HasExited) { $p.Kill() } }
Log "finished"
