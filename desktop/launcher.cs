// 2632? 任意数构造器 — Windows 桌面封装（WinForms + WebView2，单 EXE）
// 资源（网页 + WebView2 运行库 + 图标 + 版本戳）全部嵌入，首次运行解包到 %LOCALAPPDATA%\2632Calc
// 编译：desktop\build.ps1（需要 .NET Framework 4.x 的 csc.exe）
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("2632? 任意数构造器")]
[assembly: AssemblyDescription("用给定数字构造任意目标数的图形计算器")]
[assembly: AssemblyProduct("2632? Number Forge")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace NumberForgeDesktop
{
    internal static class Program
    {
        internal static string DataDir;
        internal static string AppDir;
        internal static string LibDir;
        internal static string ProfileDir;

        private const string RuntimeSubDir = "runtime";
        private const string AppSubDir = "app";

        [DllImport("kernel32", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern bool SetDllDirectory(string lpPathName);

        private static Assembly OnResolveAssembly(object sender, ResolveEventArgs args)
        {
            try
            {
                string name = new AssemblyName(args.Name).Name;
                string path = Path.Combine(LibDir, name + ".dll");
                if (File.Exists(path)) return Assembly.LoadFrom(path);
            }
            catch { }
            return null;
        }

        [STAThread]
        private static int Main(string[] args)
        {
            bool extractOnly = HasArg(args, "--extract-only");
            try
            {
                DataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "2632Calc");
                AppDir = Path.Combine(DataDir, AppSubDir);
                LibDir = Path.Combine(DataDir, RuntimeSubDir);
                ProfileDir = Path.Combine(DataDir, "webview2");
                Directory.CreateDirectory(DataDir);

                ExtractAll();

                AppDomain.CurrentDomain.AssemblyResolve += OnResolveAssembly;
                try { SetDllDirectory(LibDir); } catch { }

                if (extractOnly) return 0;

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new MainForm());
                return 0;
            }
            catch (Exception ex)
            {
                try
                {
                    MessageBox.Show(
                        "启动失败：" + ex.Message + Environment.NewLine + Environment.NewLine +
                        "如果提示缺少 WebView2，请安装 Microsoft Edge WebView2 Runtime（Windows 10/11 通常已自带）。",
                        "2632? 任意数构造器", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
                catch { }
                return 1;
            }
        }

        private static bool HasArg(string[] args, string name)
        {
            if (args == null) return false;
            for (int i = 0; i < args.Length; i++)
            {
                if (string.Equals(args[i], name, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        private static string ReadEmbeddedText(string name)
        {
            using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
            {
                if (s == null) throw new InvalidOperationException("缺少内嵌资源: " + name);
                using (StreamReader r = new StreamReader(s)) return r.ReadToEnd();
            }
        }

        private static void WriteEmbedded(string name, string targetPath)
        {
            using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
            {
                if (s == null) throw new InvalidOperationException("缺少内嵌资源: " + name);
                string tmp = targetPath + ".tmp";
                using (FileStream fs = new FileStream(tmp, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    s.CopyTo(fs);
                }
                if (File.Exists(targetPath)) File.Delete(targetPath);
                File.Move(tmp, targetPath);
            }
        }

        private static void ExtractAll()
        {
            string stamp = ReadEmbeddedText("stamp.txt").Trim();
            string stampFile = Path.Combine(DataDir, "stamp.txt");
            bool need = true;
            try
            {
                if (File.Exists(stampFile) && File.ReadAllText(stampFile).Trim() == stamp)
                {
                    need = !File.Exists(Path.Combine(AppDir, "index.html")) ||
                           !File.Exists(Path.Combine(LibDir, "Microsoft.Web.WebView2.Core.dll")) ||
                           !File.Exists(Path.Combine(LibDir, "Microsoft.Web.WebView2.WinForms.dll")) ||
                           !File.Exists(Path.Combine(LibDir, "WebView2Loader.dll"));
                }
            }
            catch { need = true; }

            if (!need) return;

            Directory.CreateDirectory(AppDir);
            Directory.CreateDirectory(LibDir);

            string[] appFiles = { "index.html", "styles.css", "engine.js", "app.js", "app.ico" };
            for (int i = 0; i < appFiles.Length; i++)
            {
                WriteEmbedded(appFiles[i], Path.Combine(AppDir, appFiles[i]));
            }
            string[] libFiles = { "Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll", "WebView2Loader.dll" };
            for (int i = 0; i < libFiles.Length; i++)
            {
                WriteEmbedded(libFiles[i], Path.Combine(LibDir, libFiles[i]));
            }
            File.WriteAllText(stampFile, stamp);
        }
    }

    internal sealed class MainForm : Form
    {
        private WebView2 _web;

        public MainForm()
        {
            Text = "2632？ · 任意数构造器";
            AutoScaleMode = AutoScaleMode.None;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(7, 11, 20);
            try
            {
                float dpi = 96f;
                using (Graphics g = Graphics.FromHwnd(IntPtr.Zero)) dpi = g.DpiX;
                Rectangle wa = Screen.PrimaryScreen.WorkingArea;
                int w = (int)(1280f * dpi / 96f);
                int h = (int)(880f * dpi / 96f);
                w = Math.Min(w, wa.Width - 60);
                h = Math.Min(h, wa.Height - 60);
                if (w < 960) w = Math.Min(960, wa.Width - 20);
                if (h < 660) h = Math.Min(660, wa.Height - 20);
                ClientSize = new Size(w, h);
            }
            catch
            {
                ClientSize = new Size(1280, 880);
            }
            MinimumSize = new Size(900, 600);
            try
            {
                using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("app.ico"))
                {
                    if (s != null) Icon = new Icon(s);
                }
            }
            catch { }

            _web = new WebView2();
            _web.Dock = DockStyle.Fill;
            _web.DefaultBackgroundColor = Color.FromArgb(7, 11, 20);
            Controls.Add(_web);

            Load += async delegate { await InitAsync(); };
        }

        private async Task InitAsync()
        {
            try
            {
                CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, Program.ProfileDir);
                await _web.EnsureCoreWebView2Async(env);
                CoreWebView2 core = _web.CoreWebView2;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.AreDefaultContextMenusEnabled = true;
                core.Settings.IsZoomControlEnabled = true;
                core.SetVirtualHostNameToFolderMapping("app.local", Program.AppDir, CoreWebView2HostResourceAccessKind.DenyCors);
                core.Navigate("https://app.local/index.html");
            }
            catch (Exception ex)
            {
                MessageBox.Show(this,
                    "无法初始化 WebView2 内核：" + Environment.NewLine + ex.Message + Environment.NewLine + Environment.NewLine +
                    "请安装 Microsoft Edge WebView2 Runtime（Windows 10/11 通常已自带）。",
                    Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        }
    }
}
