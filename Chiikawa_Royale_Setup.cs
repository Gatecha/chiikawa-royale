using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class SetupForm : Form
{
    [DllImport("user32.dll")] static extern bool ReleaseCapture();
    [DllImport("user32.dll")] static extern int SendMessage(IntPtr h, int msg, int w, int l);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

    static Color BG    = Color.FromArgb(13, 14, 16);
    static Color PANEL = Color.FromArgb(10, 11, 13);
    static Color PINK  = Color.FromArgb(255, 79, 115);
    static Color GOLD  = Color.FromArgb(255, 216, 111);
    static Color FG    = Color.White;
    static Color FG2   = Color.FromArgb(120, 122, 130);
    static Color TRACK = Color.FromArgb(28, 30, 36);

    const string DOWNLOAD_URL = "https://media.githubusercontent.com/media/Gatecha/chiikawa-royale/main/Chiikawa_Royale.exe";
    const string APP_FOLDER   = "ChiikawaRoyale";
    const string EXE_NAME     = "Chiikawa_Royale.exe";

    string installDir;
    string exePath;

    Panel  titleBar, progressTrack, progressFill;
    Label  lblTitle, lblStatus, lblBytes, lblPath;
    Button btnInstall, btnLaunch, btnClose, btnMin;
    WebClient client;

    public SetupForm()
    {
        installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), APP_FOLDER);
        exePath    = Path.Combine(installDir, EXE_NAME);

        Text            = "Chiikawa Royale Setup";
        Size            = new Size(520, 400);
        FormBorderStyle = FormBorderStyle.None;
        StartPosition   = FormStartPosition.CenterScreen;
        BackColor       = BG;
        Font            = new Font("Segoe UI", 9f);
        DoubleBuffered  = true;

        Build();
    }

    void Build()
    {
        titleBar = new Panel { Dock = DockStyle.Top, Height = 36, BackColor = PANEL };
        titleBar.MouseDown += TitleBar_MouseDown;

        lblTitle = new Label {
            Text = "CHIIKAWA ROYALE — PC SETUP",
            ForeColor = GOLD, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
            Location = new Point(12, 0), Size = new Size(370, 36),
            TextAlign = ContentAlignment.MiddleLeft
        };

        btnMin = MakeBtn("−", new Point(450, 7), 28, 22);
        btnMin.Click += delegate { WindowState = FormWindowState.Minimized; };

        btnClose = MakeBtn("✕", new Point(481, 7), 28, 22);
        btnClose.MouseEnter += delegate(object s, EventArgs e) { ((Button)s).BackColor = Color.FromArgb(200, 40, 40); };
        btnClose.MouseLeave += delegate(object s, EventArgs e) { ((Button)s).BackColor = Color.FromArgb(38, 39, 44); };
        btnClose.Click += delegate { if (client != null) client.CancelAsync(); Application.Exit(); };

        titleBar.Controls.AddRange(new Control[] { lblTitle, btnMin, btnClose });

        Label lblGame = new Label {
            Text = "CHIIKAWA ROYALE",
            ForeColor = FG, Font = new Font("Segoe UI", 26f, FontStyle.Bold),
            Location = new Point(0, 52), Size = new Size(520, 52),
            TextAlign = ContentAlignment.MiddleCenter
        };

        Label lblSub = new Label {
            Text = "PC CLIENT INSTALLER  v1.1.13",
            ForeColor = PINK, Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            Location = new Point(0, 102), Size = new Size(520, 22),
            TextAlign = ContentAlignment.MiddleCenter
        };

        Label lblDesc = new Label {
            Text = "Downloads and installs the Chiikawa Royale game client.\nA desktop shortcut will be created automatically.",
            ForeColor = FG2, Font = new Font("Segoe UI", 8.5f),
            Location = new Point(50, 136), Size = new Size(420, 38),
            TextAlign = ContentAlignment.MiddleCenter
        };

        lblPath = new Label {
            Text = "Install to: " + installDir,
            ForeColor = Color.FromArgb(70, 72, 80), Font = new Font("Segoe UI", 7.5f),
            Location = new Point(40, 196), Size = new Size(440, 18),
            TextAlign = ContentAlignment.MiddleLeft
        };

        progressTrack = new Panel {
            Location = new Point(40, 224), Size = new Size(440, 10), BackColor = TRACK
        };

        progressFill = new Panel { Location = new Point(0, 0), Size = new Size(0, 10), BackColor = PINK };
        progressTrack.Controls.Add(progressFill);

        lblStatus = new Label {
            Text = "Ready to install.", ForeColor = FG2, Font = new Font("Segoe UI", 8.5f),
            Location = new Point(40, 240), Size = new Size(440, 18),
            TextAlign = ContentAlignment.MiddleLeft
        };

        lblBytes = new Label {
            Text = "", ForeColor = Color.FromArgb(80, 82, 90), Font = new Font("Segoe UI", 7.5f),
            Location = new Point(40, 258), Size = new Size(440, 16),
            TextAlign = ContentAlignment.MiddleLeft
        };

        btnInstall = new Button {
            Text = "INSTALL", Location = new Point(175, 300), Size = new Size(170, 46),
            FlatStyle = FlatStyle.Flat, BackColor = PINK, ForeColor = FG,
            Font = new Font("Segoe UI", 11f, FontStyle.Bold), Cursor = Cursors.Hand
        };
        btnInstall.FlatAppearance.BorderSize = 0;
        btnInstall.Click += StartInstall;

        btnLaunch = new Button {
            Text = "LAUNCH GAME", Location = new Point(150, 300), Size = new Size(220, 46),
            FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(30, 180, 90), ForeColor = FG,
            Font = new Font("Segoe UI", 11f, FontStyle.Bold), Cursor = Cursors.Hand, Visible = false
        };
        btnLaunch.FlatAppearance.BorderSize = 0;
        btnLaunch.Click += delegate {
            Process.Start(new ProcessStartInfo(exePath) { WorkingDirectory = installDir });
            Application.Exit();
        };

        Label lblVer = new Label {
            Text = "2026 Chiikawa Royale  All rights reserved",
            ForeColor = Color.FromArgb(45, 46, 52), Font = new Font("Segoe UI", 7f),
            Location = new Point(0, 372), Size = new Size(520, 18),
            TextAlign = ContentAlignment.MiddleCenter
        };

        Controls.AddRange(new Control[] {
            titleBar, lblGame, lblSub, lblDesc, lblPath,
            progressTrack, lblStatus, lblBytes,
            btnInstall, btnLaunch, lblVer
        });
    }

    void TitleBar_MouseDown(object sender, MouseEventArgs e)
    {
        if (e.Button == MouseButtons.Left) { ReleaseCapture(); SendMessage(Handle, 0xA1, 2, 0); }
    }

    void StartInstall(object sender, EventArgs e)
    {
        btnInstall.Enabled = false;
        btnInstall.Text    = "DOWNLOADING...";

        try { Directory.CreateDirectory(installDir); }
        catch (Exception ex)
        {
            MessageBox.Show("Cannot create install folder:\n" + ex.Message);
            btnInstall.Enabled = true; btnInstall.Text = "INSTALL";
            return;
        }

        client = new WebClient();
        client.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

        client.DownloadProgressChanged += OnProgress;
        client.DownloadFileCompleted   += OnComplete;
        client.DownloadFileAsync(new Uri(DOWNLOAD_URL), exePath);
    }

    void OnProgress(object sender, DownloadProgressChangedEventArgs ev)
    {
        if (IsDisposed) return;
        Invoke((Action)delegate
        {
            int pct = ev.ProgressPercentage;
            progressFill.Width = (int)(440 * pct / 100.0);

            string recv  = FormatBytes(ev.BytesReceived);
            string total = ev.TotalBytesToReceive > 0 ? FormatBytes(ev.TotalBytesToReceive) : "?";

            string step;
            if      (pct < 15) step = "Connecting to servers...";
            else if (pct < 40) step = "Downloading game client...";
            else if (pct < 70) step = "Downloading assets...";
            else if (pct < 90) step = "Finalizing download...";
            else               step = "Preparing installation...";

            lblStatus.Text = step + " (" + pct + "%)";
            lblBytes.Text  = recv + " / " + total;
        });
    }

    void OnComplete(object sender, System.ComponentModel.AsyncCompletedEventArgs ev)
    {
        if (IsDisposed) return;
        Invoke((Action)delegate
        {
            if (ev.Cancelled || ev.Error != null)
            {
                string msg = ev.Error != null ? "Download failed: " + ev.Error.Message : "Cancelled.";
                lblStatus.Text = msg;
                progressFill.BackColor = Color.FromArgb(200, 50, 50);
                btnInstall.Enabled = true;
                btnInstall.Text    = "RETRY";
                return;
            }

            progressFill.Width     = 440;
            progressFill.BackColor = Color.FromArgb(30, 180, 90);
            lblStatus.Text = "Installation complete!";
            lblBytes.Text  = "Desktop shortcut created. Ready to play!";

            CreateShortcut();

            btnInstall.Visible = false;
            btnLaunch.Visible  = true;
        });
    }

    void CreateShortcut()
    {
        try
        {
            string desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            string lnk     = Path.Combine(desktop, "Chiikawa Royale.lnk");
            Type   t       = Type.GetTypeFromProgID("WScript.Shell");
            object shell   = Activator.CreateInstance(t);
            object sc      = t.InvokeMember("CreateShortcut", System.Reflection.BindingFlags.InvokeMethod, null, shell, new object[] { lnk });
            Type   scType  = sc.GetType();
            scType.InvokeMember("TargetPath",       System.Reflection.BindingFlags.SetProperty, null, sc, new object[] { exePath });
            scType.InvokeMember("WorkingDirectory", System.Reflection.BindingFlags.SetProperty, null, sc, new object[] { installDir });
            scType.InvokeMember("Description",      System.Reflection.BindingFlags.SetProperty, null, sc, new object[] { "Chiikawa Royale - Game Launcher" });
            scType.InvokeMember("Save",             System.Reflection.BindingFlags.InvokeMethod, null, sc, new object[0]);
        }
        catch { /* shortcut creation is non-critical */ }
    }

    static Button MakeBtn(string text, Point loc, int w, int h)
    {
        Button b = new Button {
            Text = text, Location = loc, Size = new Size(w, h),
            FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(38, 39, 44),
            ForeColor = Color.FromArgb(180, 182, 190),
            Font = new Font("Segoe UI", 9.5f), Cursor = Cursors.Hand
        };
        b.FlatAppearance.BorderSize = 0;
        return b;
    }

    static string FormatBytes(long b)
    {
        if (b >= 1048576) return ((double)b / 1048576).ToString("F1") + " MB";
        if (b >= 1024)    return ((double)b / 1024).ToString("F0") + " KB";
        return b.ToString() + " B";
    }

    [STAThread]
    static void Main()
    {
        SetProcessDPIAware();
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new SetupForm());
    }
}
