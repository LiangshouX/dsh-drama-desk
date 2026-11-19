#!/usr/bin/env pwsh
<#
  截一张 DSH Desktop 的图（用来**亲眼确认**界面画出来了）。

  为什么需要它：AGENTS.md §10 那几条渲染层陷阱，症状都是
  「DOM 在、几何对、就是不画」——自动化断言查不出来，只有截图能。

  用法：
    powershell -File scripts/shot.ps1 -Out shot.png
    powershell -File scripts/shot.ps1 -Out shot.png -Click "导演工作台"
    powershell -File scripts/shot.ps1 -Out shot.png -Crop "440,180,1090,520"

  参数：
    -Out       输出 PNG（默认 shot.png）
    -Click     先按可访问名点一下（比如侧栏入口的名字）
    -ClickAt   先按屏幕坐标点一下（"x,y"，物理像素）
    -Wait      点击后等多少毫秒（默认 900）
    -Crop      只截这一块（"x,y,w,h"，物理像素）
    -MaxEdge   最长边缩到多少像素（默认 1200 —— 见图幅纪律，§4）
#>
param(
  [string]$Out = "shot.png",
  [string]$Click = "",
  [string]$ClickAt = "",
  [int]$Wait = 900,
  [string]$Crop = "",
  [int]$MaxEdge = 1200
)

# 这份脚本里有中文字面量。**必须带 UTF-8 BOM**——PowerShell 5.1 把没有 BOM 的
# .ps1 当 ANSI 读，中文会变成乱码，匹配不到任何元素（§11）。
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

Add-Type @"
using System; using System.Runtime.InteropServices;
public class DDShot {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int X, int Y, int cx, int cy, uint flags);
  public static void Click(int x, int y) {
    SetCursorPos(x, y);
    System.Threading.Thread.Sleep(220);
    mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
    System.Threading.Thread.Sleep(70);
    mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
  }
}
"@

function Get-DshWindow {
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $wins = $root.FindAll([System.Windows.Automation.TreeScope]::Children,
    (New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::Window)))
  foreach ($w in $wins) {
    if ($w.Current.Name -like "*DeepSeek Harness*" -and $w.Current.BoundingRectangle.Width -gt 400) { return $w }
  }
  return $null
}

function Find-Contains($win, [string]$needle) {
  $all = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  # 先找**完全相等**的：会话名经常是插件名的超集（"导演工作台质感焕新"
  # 里就含有 "导演工作台"），包含匹配会先撞上它。
  foreach ($e in $all) {
    if ($e.Current.Name -eq $needle) { return $e }
  }
  foreach ($e in $all) {
    if ($e.Current.Name -and $e.Current.Name.Contains($needle)) { return $e }
  }
  return $null
}

function Invoke-Element($win, $element) {
  try { $element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); return $true } catch { return $false }
}

$win = Get-DshWindow
if ($null -eq $win) { Write-Output "RESULT|no-window"; exit 1 }
$handle = [IntPtr]$win.Current.NativeWindowHandle

# 这台机器有块屏，DSH 窗口默认可能落在副屏上（坐标为负）。
# 先把它挪到主屏的原点，CopyFromScreen 才读得到。
[void][DDShot]::ShowWindow($handle, 9)
[void][DDShot]::SetWindowPos($handle, [IntPtr]::Zero, 0, 0, 1536, 864, 0x0040)
Start-Sleep -Milliseconds 700
[void][DDShot]::SetForegroundWindow($handle)
Start-Sleep -Milliseconds 700

if ($ClickAt -ne "") {
  $p = $ClickAt -split ','
  [DDShot]::Click([int]$p[0], [int]$p[1])
  Start-Sleep -Milliseconds $Wait
} elseif ($Click -ne "") {
  $el = Find-Contains $win $Click
  if ($null -eq $el) {
    Write-Output "CLICK-MISS|$Click"
  } else {
    if (-not (Invoke-Element $win $el)) {
      [DDShot]::Click([int]($el.Current.BoundingRectangle.X + $el.Current.BoundingRectangle.Width / 2),
                      [int]($el.Current.BoundingRectangle.Y + $el.Current.BoundingRectangle.Height / 2))
    }
    Start-Sleep -Milliseconds $Wait
  }
}

$r = $win.Current.BoundingRectangle
$x = [int]$r.X; $y = [int]$r.Y
$w = [int]$r.Width; $h = [int]$r.Height
if ($w -le 0 -or $h -le 0) { Write-Output "RESULT|no-rect"; exit 1 }

$bitmap = New-Object System.Drawing.Bitmap $w, $h
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen((New-Object System.Drawing.Point $x, $y),
                         (New-Object System.Drawing.Point 0, 0),
                         (New-Object System.Drawing.Size $w, $h))
$graphics.Dispose()

if ($Crop -ne "") {
  $parts = $Crop -split ','
  $rect = New-Object System.Drawing.Rectangle ([int]$parts[0]), ([int]$parts[1]), ([int]$parts[2]), ([int]$parts[3])
  $cropped = $bitmap.Clone($rect, $bitmap.PixelFormat)
  $bitmap.Dispose()
  $bitmap = $cropped
  $w = $rect.Width; $h = $rect.Height
}

$scale = 1.0
$long = [Math]::Max($w, $h)
if ($long -gt $MaxEdge) { $scale = $MaxEdge / $long }
$nw = [int]($w * $scale); $nh = [int]($h * $scale)
$thumb = New-Object System.Drawing.Bitmap $nw, $nh
$g2 = [System.Drawing.Graphics]::FromImage($thumb)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.DrawImage($bitmap, 0, 0, $nw, $nh)
$g2.Dispose()
$thumb.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$thumb.Dispose(); $bitmap.Dispose()

Write-Output ("RESULT|" + $Out + "|" + $nw + "x" + $nh)
