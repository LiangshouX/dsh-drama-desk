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
  # 窗口相对坐标（按 1200 宽的缩略图空间给：x,y）。
  # 与 -ClickAt 的区别：-ClickAt 是**屏幕绝对**坐标，窗口不在 (0,0) 时会点空；
  # -ClickRel 永远按窗口自身的位置换算，所以窗口挪到哪儿都点得准。
  [string]$ClickRel = "",
  # 只把鼠标**移过去**，不点。用来验「这个点到底在不在那个元素上」：
  # 悬停态会露出来（虚线下划线、变亮…）。
  [string]$HoverRel = "",
  # 一串动作一次跑完，格式 `click:684,121; hover:500,447; click:500,447`。
  # 分号分隔，每步之间等一小会儿。坐标同样是 1200 宽的窗口相对空间。
  # 一趟里做完「打开面板 → 进阶段 → 点字 → 截图」，中间不会被别的窗口抢走。
  [string]$Seq = "",
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
  // **DPI**：PowerShell 默认是 DPI-unaware，于是 SetCursorPos / CopyFromScreen
  // 都在**逻辑像素**里说话，而 UIAutomation 的 BoundingRectangle 给的是
  // **物理像素**。两边差一个缩放系数，于是：
  //   · 点击落在错的地方（探针报「点了没反应」）；
  //   · 截图的裁剪框落在错的地方（裁出来是别处的界面）。
  // SetProcessDPIAware() 在 PowerShell 里**太晚**（控制台窗口已经建好），
  // 会返回 false——所以要用**每线程**的那一个，任何时候都能生效。
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr ctx);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public static uint PidOf(IntPtr h) { uint pid; GetWindowThreadProcessId(h, out pid); return pid; }
  public static bool DpiAware() {
    // DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = -4
    IntPtr ctx = new IntPtr(-4);
    IntPtr prev = SetThreadDpiAwarenessContext(ctx);
    // 句柄 -4 是常量，传 null（恢复默认）不适用，所以只报告是否生效。
    return prev != IntPtr.Zero;
  }
  public static uint DpiOf(IntPtr h) { return GetDpiForWindow(h); }
  public static void MoveTo(int x, int y) { SetCursorPos(x, y); }
  public static void Click(int x, int y) {
    SetCursorPos(x, y);
    System.Threading.Thread.Sleep(220);
    mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
    System.Threading.Thread.Sleep(70);
    mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
  }
}
"@

[void][DDShot]::DpiAware()

function Get-DshWindow {
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $wins = $root.FindAll([System.Windows.Automation.TreeScope]::Children,
    (New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
      [System.Windows.Automation.ControlType]::Window)))
  # **按进程认窗口，不要按标题认。**
  # 浏览器里开着的 DSH 网页版窗口标题也叫「DeepSeek Harness」——
  # 按标题认就会抓到那个浏览器窗口，于是「截桌面应用」截成了网页。
  $byProcess = $null
  foreach ($w in $wins) {
    if ($w.Current.BoundingRectangle.Width -le 400) { continue }
    $pid_ = [DDShot]::PidOf([IntPtr]$w.Current.NativeWindowHandle)
    $proc = Get-Process -Id $pid_ -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -eq 'DeepSeek Harness') {
      if ($null -eq $byProcess) { $byProcess = $w }
    }
  }
  if ($null -ne $byProcess) { return $byProcess }
  # 没有桌面应用（只有网页版）时，退回按标题认。
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

# 窗口相对（1200 宽的空间）→ 屏幕绝对（物理像素）。
function Resolve-Rel($win, [string]$xy) {
  $rect = $win.Current.BoundingRectangle
  $scale = $rect.Width / 1200.0
  $p = $xy -split ','
  return @([int]($rect.X + [double]$p[0] * $scale), [int]($rect.Y + [double]$p[1] * $scale))
}

$win = Get-DshWindow
if ($null -eq $win) { Write-Output "RESULT|no-window"; exit 1 }
$handle = [IntPtr]$win.Current.NativeWindowHandle
Write-Output ("DPI|" + [DDShot]::DpiOf($handle) + "|aware=" + [DDShot]::DpiAware())

# 这台机器有块屏，DSH 窗口默认可能落在副屏上（坐标为负）。
# 先把它挪到主屏的原点，CopyFromScreen 才读得到。
[void][DDShot]::ShowWindow($handle, 9)
[void][DDShot]::SetWindowPos($handle, [IntPtr]::Zero, 0, 0, 1536, 864, 0x0040)
Start-Sleep -Milliseconds 700
[void][DDShot]::SetForegroundWindow($handle)
Start-Sleep -Milliseconds 700

# ── 动作：按顺序执行（-Click 先开面板，-Seq 再在里面走）──────────────────
# DSH 的主槽位在「会话」与「插件面板」之间切换，窗口内容**两次运行之间
# 也会变**（会话在流式输出）。所以「打开面板 → 进阶段 → 点某处 → 截图」
# 必须**一趟跑完**，否则截到的是另一个界面。

if ($Click -ne "") {
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

if ($Seq -ne "") {
  # 一串动作一次跑完：每步之后都重新读窗口矩形（窗口可能被系统挪过）。
  foreach ($step in ($Seq -split ';')) {
    $step = $step.Trim()
    if ($step -eq "") { continue }
    $kind = $step -split ':'
    $xy = Resolve-Rel $win $kind[1]
    if ($kind[0] -eq 'hover') {
      [void][DDShot]::MoveTo($xy[0], $xy[1])
      Start-Sleep -Milliseconds 500
    } else {
      [DDShot]::Click($xy[0], $xy[1])
      # **点两次**：Windows 上「点一个没焦点的窗口」往往只是把它激活，
      # 那一下不会送进应用里。第一下激活，第二下才真的点到元素上。
      # `once:` 前缀只点一下——有些地方（就地编辑）两下会选中文字。
      if ($kind[0] -ne 'once') {
        Start-Sleep -Milliseconds 260
        [DDShot]::Click($xy[0], $xy[1])
      }
      Start-Sleep -Milliseconds 900
    }
  }
  Start-Sleep -Milliseconds $Wait
} elseif ($HoverRel -ne "") {
  $xy = Resolve-Rel $win $HoverRel
  [void][DDShot]::MoveTo($xy[0], $xy[1])
  Start-Sleep -Milliseconds $Wait
} elseif ($ClickAt -ne "" -or $ClickRel -ne "") {
  if ($ClickRel -ne "") {
    $xy = Resolve-Rel $win $ClickRel
    $cx = $xy[0]; $cy = $xy[1]
  } else {
    $p = $ClickAt -split ','
    $cx = [int]$p[0]; $cy = [int]$p[1]
  }
  [DDShot]::Click($cx, $cy)
  Start-Sleep -Milliseconds 260
  [DDShot]::Click($cx, $cy)
  Start-Sleep -Milliseconds $Wait
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
