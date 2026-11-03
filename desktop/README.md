# Windows 桌面版（EXE）

`dist/2632计算器.exe` 是单文件桌面封装：**WinForms + WebView2 内嵌浏览器**，独立窗口、无地址栏。

## 运行

- 直接双击 `dist/2632计算器.exe`
- 依赖：**Windows 10/11 x64** + **Microsoft Edge WebView2 Runtime**（Windows 10/11 一般已自带）
- 首次运行会把网页/图标/运行库解包到 `%LOCALAPPDATA%\2632Calc`：
  - `app\` 网页文件
  - `runtime\` WebView2 DLL
  - `webview2\` 浏览器配置（历史记录存在这里）
  - `stamp.txt` 内容版本戳（内容变了才重新解包）
- 未签名 EXE，首次运行可能被 SmartScreen 提示：选择「更多信息 → 仍要运行」。
- 支持 `--extract-only` 参数（只解包不启动，用于排查）。

## 构建

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File desktop\build.ps1
# 或：npm run build:exe
```

产物：`dist/2632计算器.exe`（约 1 MB）。

构建依赖（都已在仓库里/系统自带）：

| 依赖 | 说明 |
|---|---|
| .NET Framework 4.x `csc.exe` | Windows 自带（`%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe`） |
| `desktop/lib/Microsoft.Web.WebView2.Core.dll` | 来自 NuGet `Microsoft.Web.WebView2 1.0.3351.48` |
| `desktop/lib/Microsoft.Web.WebView2.WinForms.dll` | 同上 |
| `desktop/lib/WebView2Loader.dll` | 同上（win-x64） |
| `desktop/app.ico` | 应用图标（`python desktop/make_icon.py` 可重新生成） |

WebView2 SDK 的许可文件见 `desktop/lib/LICENSE-WebView2.txt`。

## 原理

`desktop/launcher.cs`：

1. 启动时把嵌入 EXE 的资源（网页、WebView2 DLL、图标、版本戳）解包到 `%LOCALAPPDATA%\2632Calc`；
2. 通过 `AssemblyResolve` + `SetDllDirectory` 加载解包出来的 WebView2 托管/原生 DLL；
3. 创建 WinForms 窗口，用 WebView2 `SetVirtualHostNameToFolderMapping("app.local", appDir)` 把本地目录映射成 `https://app.local/`（安全上下文，localStorage/剪贴板可用）；
4. 窗口按 DPI 自动设置尺寸（1280×880 逻辑像素，受屏幕工作区限制）。

## 测试

```bash
# 1) 解包自检
dist\2632计算器.exe --extract-only

# 2) 界面冒烟测试（可选，需要 WebView2 远程调试）
#    先以调试端口启动 EXE（PowerShell）：
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9333'
Start-Process "dist\2632计算器.exe"
#    然后：
node test/exe_smoke.js
```
