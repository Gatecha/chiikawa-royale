using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.ComponentModel;

public class SetupForm : Form
{
    [DllImport("user32.dll")] static extern bool ReleaseCapture();
    [DllImport("user32.dll")] static extern int SendMessage(IntPtr h, int m, int w, int l);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

    // ── Download URL (full Electron launcher via GitHub LFS) ──
    const string DOWNLOAD_URL = "https://github.com/Gatecha/chiikawa-royale/raw/main/Chiikawa_Royale.exe";
    const string APP_FOLDER   = "ChiikawaRoyale";
    const string EXE_NAME     = "Chiikawa_Royale.exe";

    // ── Colors matching HTML design ───────────────────
    static readonly Color C_BG     = Color.FromArgb(13, 14, 16);
    static readonly Color C_PANEL  = Color.FromArgb(8,  9,  11);
    static readonly Color C_PINK   = Color.FromArgb(255, 79, 115);
    static readonly Color C_PINK2  = Color.FromArgb(255, 143, 171);
    static readonly Color C_GOLD   = Color.FromArgb(255, 216, 111);
    static readonly Color C_FG     = Color.White;
    static readonly Color C_MUTED  = Color.FromArgb(110, 112, 124);
    static readonly Color C_TRACK  = Color.FromArgb(26, 28, 34);

    string installDir, exePath;

    // ── Controls ──────────────────────────────────────
    Panel     pnlTitle, pnlProgress;
    Label     lblTitleText, lblStage, lblStatus, lblBytes;
    Button    btnClose, btnMin, btnInstall, btnLaunch;
    Image[]   charImgs = new Image[4];
    Image     logoImg;
    WebClient wc;
    int       imgsLoaded = 0;

    // Character image URLs (GitHub raw)
    string[] imgUrls = new string[] {
        "https://raw.githubusercontent.com/Gatecha/chiikawa-royale/main/assets/cards/chiikawa.png",
        "https://raw.githubusercontent.com/Gatecha/chiikawa-royale/main/assets/cards/hachiware.png",
        "https://raw.githubusercontent.com/Gatecha/chiikawa-royale/main/assets/cards/usagi.png",
        "https://raw.githubusercontent.com/Gatecha/chiikawa-royale/main/assets/cards/momonga.png"
    };
    string logoUrl = "https://raw.githubusercontent.com/Gatecha/chiikawa-royale/main/chiikawa-royale-logo.png";

    // Progress state
    int  progressPct = 0;
    bool done        = false;

    public SetupForm()
    {
        installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), APP_FOLDER);
        exePath    = Path.Combine(installDir, EXE_NAME);

        Text            = "Chiikawa Royale Setup";
        ClientSize      = new Size(600, 460);
        FormBorderStyle = FormBorderStyle.None;
        StartPosition   = FormStartPosition.CenterScreen;
        BackColor       = C_BG;
        DoubleBuffered  = true;

        BuildUI();
        this.Load += OnLoad;
    }

    void BuildUI()
    {
        // ── Title bar ─────────────────────────────────
        pnlTitle = new Panel { Dock = DockStyle.Top, Height = 36, BackColor = C_PANEL };
        pnlTitle.MouseDown += (s, e) => { if (e.Button == MouseButtons.Left) { ReleaseCapture(); SendMessage(Handle, 0xA1, 2, 0); } };

        lblTitleText = new Label {
            Text = "CHIIKAWA ROYALE  —  PC INSTALLER",
            ForeColor = C_GOLD, BackColor = C_PANEL,
            Font = new Font("Segoe UI", 8f, FontStyle.Bold),
            Location = new Point(12, 0), Size = new Size(460, 36),
            TextAlign = ContentAlignment.MiddleLeft
        };
        pnlTitle.Controls.Add(lblTitleText);

        btnMin = TitleBtn("−", new Point(535, 7));
        btnMin.Click += delegate { WindowState = FormWindowState.Minimized; };
        pnlTitle.Controls.Add(btnMin);

        btnClose = TitleBtn("✕", new Point(564, 7));
        btnClose.MouseEnter += delegate(object s, EventArgs e) { ((Button)s).BackColor = Color.FromArgb(210, 40, 40); ((Button)s).ForeColor = C_FG; };
        btnClose.MouseLeave += delegate(object s, EventArgs e) { ((Button)s).BackColor = Color.FromArgb(30, 31, 38); ((Button)s).ForeColor = C_MUTED; };
        btnClose.Click += delegate { if (wc != null) wc.CancelAsync(); Application.Exit(); };
        pnlTitle.Controls.Add(btnClose);

        // ── Stage label ───────────────────────────────
        lblStage = new Label {
            Text = "PC INSTALLATION STAGE",
            ForeColor = C_MUTED, BackColor = Color.Transparent,
            Font = new Font("Segoe UI", 9f, FontStyle.Bold),
            Location = new Point(0, 314), Size = new Size(600, 24),
            TextAlign = ContentAlignment.MiddleCenter
        };

        // ── Progress track (custom drawn) ─────────────
        pnlProgress = new Panel {
            Location = new Point(70, 346), Size = new Size(460, 14),
            BackColor = C_TRACK
        };
        // Rounded region
        var gp = new GraphicsPath();
        gp.AddArc(0, 0, 14, 14, 180, 90);
        gp.AddArc(446, 0, 14, 14, 270, 90);
        gp.AddArc(446, 0, 14, 14, 0, 90);
        gp.AddArc(0, 0, 14, 14, 90, 90);
        pnlProgress.Region = new Region(gp);
        pnlProgress.Paint += DrawProgressBar;

        // ── Status label ──────────────────────────────
        lblStatus = new Label {
            Text = "Ready to install.",
            ForeColor = C_MUTED, BackColor = Color.Transparent,
            Font = new Font("Segoe UI", 8.5f),
            Location = new Point(70, 366), Size = new Size(340, 18),
            TextAlign = ContentAlignment.MiddleLeft
        };

        lblBytes = new Label {
            Text = "",
            ForeColor = Color.FromArgb(70, 72, 84), BackColor = Color.Transparent,
            Font = new Font("Segoe UI", 7.5f),
            Location = new Point(70, 384), Size = new Size(460, 16),
            TextAlign = ContentAlignment.MiddleLeft
        };

        // ── Install button ────────────────────────────
        btnInstall = new Button {
            Text = "INSTALL",
            Location = new Point(215, 410), Size = new Size(170, 44),
            FlatStyle = FlatStyle.Flat,
            BackColor = C_PINK, ForeColor = C_FG,
            Font = new Font("Segoe UI", 11f, FontStyle.Bold),
            Cursor = Cursors.Hand
        };
        btnInstall.FlatAppearance.BorderSize = 0;
        btnInstall.Click += StartInstall;
        RoundBtn(btnInstall, 10);

        // ── Launch button (shown after install) ───────
        btnLaunch = new Button {
            Text = "LAUNCH GAME  ▶",
            Location = new Point(190, 410), Size = new Size(220, 44),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(28, 180, 90), ForeColor = C_FG,
            Font = new Font("Segoe UI", 11f, FontStyle.Bold),
            Cursor = Cursors.Hand, Visible = false
        };
        btnLaunch.FlatAppearance.BorderSize = 0;
        btnLaunch.Click += delegate {
            Process.Start(new ProcessStartInfo(exePath) { WorkingDirectory = installDir });
            Application.Exit();
        };
        RoundBtn(btnLaunch, 10);

        Controls.AddRange(new Control[] {
            pnlTitle, lblStage, pnlProgress, lblStatus, lblBytes, btnInstall, btnLaunch
        });
    }

    void OnLoad(object sender, EventArgs e)
    {
        // Asynchronously load images from GitHub for the visual header
        for (int i = 0; i < 4; i++)
        {
            int idx = i;
            var bgw = new BackgroundWorker();
            bgw.DoWork += delegate(object s, DoWorkEventArgs args) {
                try {
                    var wc2 = new WebClient();
                    wc2.Headers.Add("User-Agent", "Mozilla/5.0");
                    byte[] data = wc2.DownloadData(imgUrls[idx]);
                    args.Result = Image.FromStream(new MemoryStream(data));
                } catch { args.Result = null; }
            };
            bgw.RunWorkerCompleted += delegate(object s, RunWorkerCompletedEventArgs args) {
                charImgs[idx] = args.Result as Image;
                imgsLoaded++;
                if (!IsDisposed) Invalidate();
            };
            bgw.RunWorkerAsync();
        }

        // Load logo
        var bgwLogo = new BackgroundWorker();
        bgwLogo.DoWork += delegate(object s, DoWorkEventArgs args) {
            try {
                var wc2 = new WebClient();
                wc2.Headers.Add("User-Agent", "Mozilla/5.0");
                byte[] data = wc2.DownloadData(logoUrl);
                args.Result = Image.FromStream(new MemoryStream(data));
            } catch { args.Result = null; }
        };
        bgwLogo.RunWorkerCompleted += delegate(object s, RunWorkerCompletedEventArgs args) {
            logoImg = args.Result as Image;
            if (!IsDisposed) Invalidate();
        };
        bgwLogo.RunWorkerAsync();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        var g = e.Graphics;
        g.SmoothingMode      = SmoothingMode.AntiAlias;
        g.InterpolationMode  = InterpolationMode.HighQualityBicubic;

        // ── Pink radial glow at top ────────────────────
        using (var brush = new PathGradientBrush(new PointF[] {
            new PointF(300, 36), new PointF(0, 200), new PointF(600, 200)
        })) {
            brush.CenterColor   = Color.FromArgb(40, 255, 79, 115);
            brush.SurroundColors = new Color[] { Color.Transparent, Color.Transparent };
            g.FillEllipse(brush, 100, 20, 400, 220);
        }

        // ── Character images ───────────────────────────
        int[] xPos   = { 60, 170, 300, 420 };
        float[] rots = { -8f, -3f, 3f, 8f };
        float[] scls = { 1f, 1.08f, 1.08f, 1f };

        for (int i = 0; i < 4; i++)
        {
            if (charImgs[i] != null)
            {
                int w = (int)(90 * scls[i]);
                int h = (int)(90 * scls[i]);
                int x = xPos[i] + (90 - w) / 2;
                int y = 50 + (90 - h) / 2;

                g.TranslateTransform(x + w / 2, y + h / 2);
                g.RotateTransform(rots[i]);
                g.DrawImage(charImgs[i], -w / 2, -h / 2, w, h);
                g.ResetTransform();
            }
            else
            {
                // Placeholder circle
                int cx = xPos[i] + 45, cy = 95;
                using (var b = new SolidBrush(Color.FromArgb(25, 255, 255, 255)))
                    g.FillEllipse(b, cx - 34, cy - 34, 68, 68);
                using (var p = new Pen(Color.FromArgb(40, 255, 255, 255), 1.5f))
                    g.DrawEllipse(p, cx - 34, cy - 34, 68, 68);
            }
        }

        // ── Logo ───────────────────────────────────────
        if (logoImg != null)
        {
            int lw = 200, lh = (int)(200f * logoImg.Height / logoImg.Width);
            g.DrawImage(logoImg, (600 - lw) / 2, 150, lw, lh);
        }
        else
        {
            // Fallback text logo
            using (var f = new Font("Segoe UI", 24f, FontStyle.Bold))
            using (var b = new SolidBrush(C_FG))
                g.DrawString("CHIIKAWA ROYALE", f, b, new RectangleF(0, 160, 600, 60), new StringFormat { Alignment = StringAlignment.Center });
        }
    }

    void DrawProgressBar(object sender, PaintEventArgs e)
    {
        var g   = e.Graphics;
        var pnl = (Panel)sender;
        g.SmoothingMode = SmoothingMode.AntiAlias;

        if (progressPct > 0)
        {
            int fillW = (int)(pnl.Width * progressPct / 100.0);
            if (fillW < 1) fillW = 1;

            Color barColor = done ? Color.FromArgb(30, 180, 90) : C_PINK;
            Color barEnd   = done ? Color.FromArgb(80, 220, 130) : C_PINK2;

            using (var brush = new LinearGradientBrush(
                new Rectangle(0, 0, fillW, pnl.Height),
                barColor, barEnd, LinearGradientMode.Horizontal))
            {
                var gp = new GraphicsPath();
                int r = 7;
                gp.AddArc(0, 0, r * 2, r * 2, 180, 90);
                int rr = fillW > r * 2 ? fillW - r * 2 : 0;
                gp.AddArc(rr, 0, r * 2, r * 2, 270, 90);
                gp.AddArc(rr, 0, r * 2, r * 2, 0, 90);
                gp.AddArc(0, 0, r * 2, r * 2, 90, 90);
                gp.CloseAllFigures();
                g.FillPath(brush, gp);
            }

            // Shimmer highlight
            if (!done && progressPct < 100)
            {
                using (var shimmer = new LinearGradientBrush(
                    new Rectangle(0, 0, pnl.Width, pnl.Height / 2),
                    Color.FromArgb(60, 255, 255, 255), Color.Transparent,
                    LinearGradientMode.Vertical))
                {
                    g.FillRectangle(shimmer, 0, 0, (int)(pnl.Width * progressPct / 100.0), pnl.Height / 2);
                }
            }
        }
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

        // ── FIX: Enable TLS 1.2 for GitHub downloads ──
        try { ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | (SecurityProtocolType)768 | SecurityProtocolType.Ssl3 | SecurityProtocolType.Tls; }
        catch { }

        wc = new WebClient();
        wc.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        wc.DownloadProgressChanged += OnProgress;
        wc.DownloadFileCompleted   += OnComplete;
        wc.DownloadFileAsync(new Uri(DOWNLOAD_URL), exePath);
    }

    void OnProgress(object sender, DownloadProgressChangedEventArgs ev)
    {
        if (IsDisposed) return;
        Invoke((Action)delegate
        {
            progressPct = ev.ProgressPercentage;
            pnlProgress.Invalidate();

            string recv  = FmtB(ev.BytesReceived);
            string total = ev.TotalBytesToReceive > 0 ? FmtB(ev.TotalBytesToReceive) : "?";

            string step;
            if      (progressPct < 10) step = "Connecting to servers...";
            else if (progressPct < 35) step = "Downloading game client...";
            else if (progressPct < 65) step = "Downloading assets...";
            else if (progressPct < 88) step = "Finalizing download...";
            else                       step = "Preparing installation...";

            lblStatus.Text = step + " (" + progressPct + "%)";
            lblBytes.Text  = recv + " / " + total;
        });
    }

    void OnComplete(object sender, AsyncCompletedEventArgs ev)
    {
        if (IsDisposed) return;
        Invoke((Action)delegate
        {
            if (ev.Cancelled || ev.Error != null)
            {
                string err = ev.Error != null ? ev.Error.Message : "Cancelled.";
                lblStatus.Text = "Download failed: " + err;
                progressPct = 0;
                pnlProgress.Invalidate();
                btnInstall.Enabled = true;
                btnInstall.Text    = "RETRY";
                return;
            }

            done        = true;
            progressPct = 100;
            pnlProgress.Invalidate();
            lblStatus.Text = "Installation complete!";
            lblBytes.Text  = "Desktop shortcut created — ready to play!";

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
            Type   st      = sc.GetType();
            st.InvokeMember("TargetPath",       System.Reflection.BindingFlags.SetProperty, null, sc, new object[] { exePath });
            st.InvokeMember("WorkingDirectory", System.Reflection.BindingFlags.SetProperty, null, sc, new object[] { installDir });
            st.InvokeMember("Description",      System.Reflection.BindingFlags.SetProperty, null, sc, new object[] { "Chiikawa Royale - Game Launcher" });
            st.InvokeMember("Save",             System.Reflection.BindingFlags.InvokeMethod, null, sc, new object[0]);
        }
        catch { }
    }

    static Button TitleBtn(string text, Point loc)
    {
        var b = new Button {
            Text = text, Location = loc, Size = new Size(26, 22),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(30, 31, 38), ForeColor = C_MUTED,
            Font = new Font("Segoe UI", 9.5f), Cursor = Cursors.Hand
        };
        b.FlatAppearance.BorderSize = 0;
        return b;
    }

    static void RoundBtn(Button b, int r)
    {
        var gp = new GraphicsPath();
        gp.AddArc(0, 0, r * 2, r * 2, 180, 90);
        gp.AddArc(b.Width - r * 2, 0, r * 2, r * 2, 270, 90);
        gp.AddArc(b.Width - r * 2, b.Height - r * 2, r * 2, r * 2, 0, 90);
        gp.AddArc(0, b.Height - r * 2, r * 2, r * 2, 90, 90);
        gp.CloseAllFigures();
        b.Region = new Region(gp);
    }

    static string FmtB(long b)
    {
        if (b >= 1048576) return ((double)b / 1048576).ToString("F1") + " MB";
        if (b >= 1024)    return ((double)b / 1024).ToString("F0") + " KB";
        return b + " B";
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
