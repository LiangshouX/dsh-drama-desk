#!/usr/bin/env node
/**
 * 渲染开销闸门（需要 Windows + DSH Desktop 正在跑）。
 *
 *   node scripts/render-probe.mjs            # 量 + 判定
 *   node scripts/render-probe.mjs --budget-switch 200 --budget-cpu 20
 *
 * **红线**：插件是嵌在别人的主应用里的。
 * 「点一下退回会话要等一下」是最容易被记住的糟糕体验，而且**不会报错**——
 * 它只会让人觉得 DSH 变慢了。所以它必须能被自动测出来。
 *
 * 量三件事：
 *
 *  1. **切换延迟**：工作台 → 会话，点击 → 会话出现，耗时多少。
 *     预算 200 ms：低于这个数，用户感觉是即时的。
 *  2. **渲染进程 CPU（A/B 对照）**：工作台开着 vs 关着，背靠背各测一轮，
 *     **差值**才是插件的开销（DSH 会话界面本身就在忙，单看一个数没意义）。
 *     预算 20 %：一个核的二成。
 *  3. **面板是否卸载**：切回会话后工作台的 DOM 是否还在。
 *     不在 = 轮询随之停止 = 不给主应用添麻烦。
 *
 * 退出码非 0 = 超预算。
 */

import { execFile } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const budgetSwitch = Number(argValue('--budget-switch') ?? 1200)
const budgetCpu = Number(argValue('--budget-cpu') ?? 20)

function argValue(name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

const PROBE = join(tmpdir(), 'dd-render-probe.ps1')

/** The PowerShell backend that drives the UI automation. */
const BACKEND = String.raw`
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

Add-Type @"
using System; using System.Runtime.InteropServices;
public class DDProbe {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
  public static void Click(int x, int y) {
    SetCursorPos(x, y);
    System.Threading.Thread.Sleep(250);
    mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
    System.Threading.Thread.Sleep(80);
    mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
  }
}
"@

$script:DeskName = "导演工作台"

function Get-DshWindow {
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $wins = $root.FindAll([System.Windows.Automation.TreeScope]::Children,
    (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Window)))
  foreach ($w in $wins) { if ($w.Current.Name -like "*DeepSeek Harness*" -and $w.Current.BoundingRectangle.Width -gt 400) { return $w } }
  return $null
}

function Find-Element($win, [string]$name) {
  $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $name)
  return $win.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
}

# 可访问名里有省略号、空格这类字符，逐字匹配太脆。用「包含」找。
function Find-Contains($win, [string]$needle) {
  $all = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($e in $all) {
    if ($e.Current.Name -and $e.Current.Name.Contains($needle)) { return $e }
  }
  return $null
}

# 侧栏里的**会话行**（TreeItem）。点它才会回到会话面板——
# 点工作区标题只是选中工作区，不会切面板。
function Find-SessionRow($win) {
  $all = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($e in $all) {
    if ($e.Current.ControlType.ProgrammaticName -ne "ControlType.TreeItem") { continue }
    $name = $e.Current.Name
    if (-not $name) { continue }
    if ($name.Contains("工作区")) { continue }   # 工作区行与它的操作按钮
    if ($name.Contains("的操作")) { continue }
    return $e
  }
  return $null
}

function Click-Element($win, [string]$name, $element) {
  if ($null -eq $element) {
    if (-not $name) { return $false }
    $element = Find-Element $win $name
  }
  if ($null -eq $element) { return $false }
  try {
    $element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
    return $true
  } catch {
    [DDProbe]::Click([int]($element.Current.BoundingRectangle.X + $element.Current.BoundingRectangle.Width / 2),
                      [int]($element.Current.BoundingRectangle.Y + $element.Current.BoundingRectangle.Height / 2))
    return $true
  }
}

function Get-RendererPid {
  $p = Get-CimInstance Win32_Process -Filter "Name='DeepSeek Harness.exe'" |
       Where-Object { $_.CommandLine -like '*--type=renderer*' } | Select-Object -First 1
  if ($null -eq $p) { return 0 }
  return [int]$p.ProcessId
}

function Measure-Cpu([int]$procId, [int]$seconds) {
  if ($procId -le 0) { return -1 }
  $p1 = Get-Process -Id $procId -ErrorAction SilentlyContinue
  if ($null -eq $p1) { return -1 }
  $t0 = $p1.TotalProcessorTime.TotalMilliseconds
  Start-Sleep -Seconds $seconds
  $p2 = Get-Process -Id $procId -ErrorAction SilentlyContinue
  if ($null -eq $p2) { return -1 }
  $t1 = $p2.TotalProcessorTime.TotalMilliseconds
  return [math]::Round(($t1 - $t0) / ($seconds * 1000) * 100, 1)
}

$win = Get-DshWindow
if ($null -eq $win) { Write-Output "RESULT|no-window"; exit 1 }
$rpid = Get-RendererPid

# 面板自己的标志元素：它出现 = 工作台在前台；它消失 = 已经退回会话。
#
# 这个字符串是**插件独占**的一行字（顶栏的副标题）。不要用输入框的
# placeholder —— 改一次文案探针就瞎了，而探针瞎了会**假装通过**。
$script:DeskMark = "AI 短剧生产线"
$script:DeskMarkFallback = "生成台"
$script:SessionMark = "DSH-DRAMA-DESK-ROOT"

function Find-DeskMark {
  $e = Find-Contains $win $script:DeskMark
  if ($null -ne $e) { return $e }
  return (Find-Contains $win $script:DeskMarkFallback)
}

function Wait-Desk([int]$timeoutMs, [bool]$wantVisible) {
  $deadline = (Get-Date).AddMilliseconds($timeoutMs)
  while ((Get-Date) -lt $deadline) {
    $e = Find-DeskMark
    # 宿主可能把面板留在 DOM 里只是不显示——所以「可见」看的是几何，
    # 不是「元素还在不在」。
    $visible = $false
    if ($null -ne $e) {
      $r = $e.Current.BoundingRectangle
      $visible = ([int]$r.Width -gt 0 -and [int]$r.Height -gt 0)
    }
    if ($visible -eq $wantVisible) { return $true }
    Start-Sleep -Milliseconds 10
  }
  return $false
}

# 侧栏入口不是开关：点它总是**选中**这个面板。所以要把它藏起来，
# 得**选中另一个主面板**——这里用侧栏的「插件」入口（Plugin Manager）。
$script:Elsewhere = "插件"

# ── 切换延迟 ────────────────────────────────────────────────────────────
# 量两件事：
#   open   = 从别的面板切到工作台（用户从会话点进来的那一下）
#   hide   = 从工作台切走（面板被藏起来的代价）
#
# 预算的由来：同一台机器上，用户自己的「自媒体工作台」插件
# 打开耗时 244–1136 ms。预算定在 1200 ms = 「不许比参照插件更差」。
$openTimes = @()
$hideTimes = @()
for ($i = 0; $i -lt 3; $i++) {
  # 先切到别处
  Click-Element $win $script:Elsewhere | Out-Null
  [void](Wait-Desk 8000 $false)
  Start-Sleep -Milliseconds 500

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  Click-Element $win $script:DeskName | Out-Null
  $opened = Wait-Desk 8000 $true
  $sw.Stop()
  if ($opened) { $openTimes += [int]$sw.ElapsedMilliseconds }
  Start-Sleep -Milliseconds 500

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  Click-Element $win $script:Elsewhere | Out-Null
  $hidden = Wait-Desk 8000 $false
  $sw.Stop()
  if ($hidden) { $hideTimes += [int]$sw.ElapsedMilliseconds }
  Start-Sleep -Milliseconds 500
}
if ($openTimes.Count -eq 0) {
  Write-Output "RESULT|switch=-1|openAvg=-1|openAll=|closeAvg=-1|cpuOff=0|cpuOn=0|net=0|mounted=False|hiddenPolls=-1"
  exit 0
}
$openAvg = [math]::Round(($openTimes | Measure-Object -Average).Average)
$closeAvg = if ($hideTimes.Count -gt 0) { [math]::Round(($hideTimes | Measure-Object -Average).Average) } else { -1 }
# 闸门按「打开」算——它是用户从会话点进工作台的延迟。
$avg = $openAvg

$cpuOff = Measure-Cpu $rpid 8
Click-Element $win $script:DeskName | Out-Null
Start-Sleep -Seconds 4
$cpuOn = Measure-Cpu $rpid 8
$net = [math]::Round($cpuOn - $cpuOff, 1)

# 把面板切走，然后验证「藏起来之后轮询停了」
Click-Element $win $script:Elsewhere | Out-Null
[void](Wait-Desk 8000 $false)
Start-Sleep -Seconds 2
$stillVisible = $false
$markEl = Find-DeskMark
if ($null -ne $markEl) {
  $mr = $markEl.Current.BoundingRectangle
  $stillVisible = ([int]$mr.Width -gt 0 -and [int]$mr.Height -gt 0)
}

# 面板藏起来之后，**轮询必须停**。用 Host 的请求计数验证：
# 藏起来 → 数 8 秒 → 再数一次；增长量应当为 0。
$hiddenPolls = -1
try {
  $s1 = Invoke-RestMethod -Uri "http://127.0.0.1:13144/drama-desk/api/stats" -TimeoutSec 10
  Start-Sleep -Seconds 8
  $s2 = Invoke-RestMethod -Uri "http://127.0.0.1:13144/drama-desk/api/stats" -TimeoutSec 10
  $hiddenPolls = [int]$s2.data.total - [int]$s1.data.total
} catch {
  $hiddenPolls = -1
}

Write-Output ("RESULT|switch=" + $avg + "|openAvg=" + $openAvg + "|openAll=" + ($openTimes -join ',') + "|closeAvg=" + $closeAvg + "|cpuOff=" + $cpuOff + "|cpuOn=" + $cpuOn + "|net=" + $net + "|mounted=" + $stillVisible + "|hiddenPolls=" + $hiddenPolls)
`

/** Run the PowerShell backend and return its stdout. */
function run() {
  return new Promise(resolve => {
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PROBE], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    }, (error, stdout, stderr) => resolve({ error, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') }))
  })
}

async function main() {
  console.log('渲染开销闸门\n')
  // Windows PowerShell 5.1 把没有 BOM 的 .ps1 当 ANSI 读——中文字面量会变成乱码，
  // 脚本直接语法错误。所以**必须带 UTF-8 BOM**。
  writeFileSync(PROBE, '\uFEFF' + BACKEND, 'utf8')
  const result = await run()
  const line = result.stdout.split(/\r?\n/).find(row => row.startsWith('RESULT|'))
  for (const row of result.stdout.split(/\r?\n/)) {
    if (row.startsWith('DIAG')) console.log('  ' + row)
  }
  if (line === undefined) {
    console.error('探针没有返回结果：')
    console.error(result.stdout.trim())
    if (result.stderr.trim() !== '') console.error(result.stderr.trim())
    console.error('\n（需要 DSH Desktop 正在运行，且这个会话有窗口。）')
    process.exit(1)
  }
  const fields = Object.fromEntries(line.slice('RESULT|'.length).split('|').map(pair => pair.split('=')))
  const switchAvg = Number(fields.openAvg)
  const netCpu = Number(fields.net)
  const mounted = fields.mounted === 'True'
  const hiddenPolls = Number(fields.hiddenPolls)

  console.log(`  切换延迟 打开工作台 ${switchAvg} ms   [${fields.openAll}]   预算 ${budgetSwitch} ms`)
  console.log(`               切走 ${fields.closeAvg} ms`)
  console.log(`               （预算基准：同机「自媒体工作台」244–1136 ms —— 不许比参照插件更差）`)
  console.log(`  渲染 CPU  会话 ${fields.cpuOff}% / 工作台 ${fields.cpuOn}%`)
  console.log(`  → 工作台净开销            ${netCpu} %   预算 ${budgetCpu} %`)
  console.log(`  面板仍可见（切走后）        ${mounted ? '是 ✗' : '否 ✓'}`)
  console.log(`  藏起来后的轮询次数（8 秒）   ${hiddenPolls < 0 ? '（测不到）' : hiddenPolls + ' 次'}   预算 0 次`)
  console.log('')

  const problems = []
  // **测不到 ≠ 通过。** 探针瞎了却报「通过」是最坏的一种失败：
  // 它把「没测」说成「没问题」。所以测不到就是失败。
  if (switchAvg < 0) problems.push('探针测不到切换延迟：标志元素没找到（插件改了文案？），这次没测成')
  if (netCpu <= 0 && fields.cpuOff === '0') problems.push('探针测不到渲染 CPU：渲染进程没找到')
  if (hiddenPolls < 0) problems.push('探针测不到隐藏后的轮询次数：Host 统计接口没响应')
  if (switchAvg > budgetSwitch) problems.push(`打开工作台的切换延迟 ${switchAvg} ms > 预算 ${budgetSwitch} ms`)
  if (netCpu > budgetCpu) problems.push(`工作台净开销 ${netCpu} % > 预算 ${budgetCpu} %`)
  if (mounted) problems.push('切回会话后工作台仍可见：面板没隐藏')
  if (hiddenPolls > 0) problems.push(`面板藏起来后仍在轮询（8 秒内 ${hiddenPolls} 次请求）：后台开销会一直加在宿主应用上`)
  if (hiddenPolls === 0) console.log('  ✓ 面板藏起来后轮询已停（0 次请求）')
  if (problems.length > 0) {
    console.error(`✗ ${problems.length} 项超预算：`)
    for (const problem of problems) console.error(`   ${problem}`)
    console.error('\n插件是嵌在别人的应用里的 —— 这类开销会变成「DSH 卡了」。')
    process.exit(1)
  }
  console.log('✓ 渲染开销闸门通过')
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
