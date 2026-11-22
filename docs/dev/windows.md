# Windows / 跨语言三坑

这个仓库的开发与运行环境是**中文 Windows + Node + Python**。下面每一条都真实踩过，
症状都不像它真正的原因。

---

## W1 `rename` 会 `EBUSY`

原子写是「写临时文件 → rename 覆盖目标」。目标文件正被别的进程打开时（杀毒软件、
索引器、文件预览、甚至另一个读者），`rename` 会报
`EBUSY: resource busy or locked`，**整个写操作失败**。

> 对策（`src/host/fsx.js` 的 `replaceFile()`）：重试几次（0 / 40 / 120 / 300 ms），
> 仍不行就**就地覆盖**（`copyFile` + 删临时文件）——那不原子，但**不丢数据**。

## W2 中文 Windows 的 Python stdout 是 GBK

体检器用 `ensure_ascii=False` 打印中文 JSON，Python 按 cp936 编码写 stdout，Node 按
UTF-8 解码 —— **每一个中文字段都变成乱码**（`无可拍动作` → `�޿��Ķ���`）。
这条直接打到界面上（表演层的问题清单）。

> 对策：所有 `execFile` 调 Python 的地方都带
> `env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }`。
> 涉及 `src/host/qc.js`、`src/host/compile.js`、`src/host/api.js`。

## W3 不要用 PowerShell 改作品 JSON

PowerShell 5.1 的 `Get-Content -Raw` 把**无 BOM 的 UTF-8** 当 ANSI 读，中文在内存里就
变成乱码；再 `Set-Content -Encoding UTF8` 写回去，乱码就**落到盘上**了，而且会带上 BOM
让 `JSON.parse` 直接失败。

> 改 `state.json` / `scenes.json` 这类文件，**用 Node**（`readFileSync(p,'utf8')`），
> 或者干脆走插件自己的 service 方法。写坏了就用
> `scripts/make_demo_work.py --force` 重建。

## W4 `.ps1` 必须带 UTF-8 BOM（中文字面量 / 中文注释都会咬人）

`powershell -File` 读 `.ps1` 时，PowerShell 5.1 把**没有 BOM** 的文件当 ANSI 读：
UTF-8 的中文被误解码后可能带出反斜杠，把下一行续接掉，于是脚本变成语法错误。

- 症状是 `ParserError: UnexpectedToken`，与脚本内容看起来毫无关系。
- `scripts/shot.ps1` 有中文注释，所以它**必须带 UTF-8 BOM**。用编辑工具改过它之后
  要重新补上 BOM（用 `node` 读原始字节再拼回去）。
- 探针脚本里的中文字面量同理（`performance.md` P4）。
