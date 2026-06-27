using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.ComponentModel;
using System.Reflection;

public class SetupForm : Form
{
    [DllImport("user32.dll")] static extern bool ReleaseCapture();
    [DllImport("user32.dll")] static extern int SendMessage(IntPtr h, int m, int w, int l);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

    const string DOWNLOAD_URL = "https://github.com/Gatecha/chiikawa-royale/raw/main/Chiikawa_Royale.exe";
    const string APP_FOLDER   = "ChiikawaRoyale";
    const string EXE_NAME     = "Chiikawa_Royale.exe";

    static readonly Color C_BG     = Color.FromArgb(13, 14, 16);
    static readonly Color C_PANEL  = Color.FromArgb(10, 11, 13);
    static readonly Color C_PINK   = Color.FromArgb(255, 79, 115);
    static readonly Color C_PINK2  = Color.FromArgb(255, 143, 171);
    static readonly Color C_GOLD   = Color.FromArgb(255, 216, 111);
    static readonly Color C_FG     = Color.White;
    static readonly Color C_MUTED  = Color.FromArgb(110, 112, 124);
    static readonly Color C_TRACK  = Color.FromArgb(28, 30, 36);

    string installDir, exePath;

    Panel     pnlTitle, pnlProgress;
    Label     lblTitleText, lblStage, lblStatus, lblBytes;
    Button    btnClose, btnMin, btnInstall, btnLaunch;
    Image[]   charImgs = new Image[4];
    Image     logoImg;
    WebClient wc;

    int       progressPct = 0;
    bool      done        = false;
    bool      installing  = false;

    public SetupForm()
    {
        installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), APP_FOLDER);
        exePath    = Path.Combine(installDir, EXE_NAME);

        Text            = "Chiikawa Royale Setup";
        ClientSize      = new Size(800, 560);
        FormBorderStyle = FormBorderStyle.None;
        StartPosition   = FormStartPosition.CenterScreen;
        BackColor       = C_BG;
        DoubleBuffered  = true;

        LoadResources();
        BuildUI();

        // Check if already installed
        if (File.Exists(exePath))
        {
            btnInstall.Visible = false;
            btnLaunch.Visible  = true;
            lblStage.Text      = "CHIIKAWA ROYALE IS INSTALLED";
            lblStatus.Text     = "Ready to play!";
            lblStatus.Visible  = true;
            pnlProgress.Visible = false;
        }
    }

    void LoadResources()
    {
        charImgs[0] = LoadEmbeddedImage("chiikawa.png");
        charImgs[1] = LoadEmbeddedImage("hachiware.png");
        charImgs[2] = LoadEmbeddedImage("usagi.png");
        charImgs[3] = LoadEmbeddedImage("momonga.png");
        logoImg     = LoadEmbeddedImage("logo.png");
    }

    Image LoadEmbeddedImage(string name)
    {
        try
        {
            Assembly asm = Assembly.GetExecutingAssembly();
            using (Stream s = asm.GetManifestResourceStream(name))
            {
                if (s != null) return Image.FromStream(s);
            }
        }
        catch {}
        return null;
    }

    void BuildUI()
    {
        // ── Title Bar ──────────────────────────────────
        pnlTitle = new Panel { Dock = DockStyle.Top, Height = 36, BackColor = C_PANEL };
        pnlTitle.MouseDown += (s, e) => { if (e.Button == MouseButtons.Left) { ReleaseCapture(); SendMessage(Handle, 0xA1, 2, 0); } };

        lblTitleText = new Label {
            Text = "CHIIKAWA ROYALE  —  PC INSTALLER",
            ForeColor = C_GOLD, BackColor = Color.Transparent,
            Font = new Font("Segoe UI", 9f, FontStyle.Bold),
            Location = new Point(14, 0), Size = new Size(500, 36),
            TextAlign = ContentAlignment.MiddleLeft
        };
        pnlTitle.Controls.Add(lblTitleText);

        btnMin = TitleBtn("−", new Point(735, 7));
        btnMin.Click += delegate { WindowState = FormWindowState.Minimized; };
        pnlTitle.Controls.Add(btnMin);

        btnClose = TitleBtn("✕", new Point(764, 7));
        btnClose.MouseEnter += delegate(object s, EventArgs e) { ((Button)s).BackColor = Color.FromArgb(210, 40, 40); ((Button)s).ForeColor = C_FG; };
        btnClose.MouseLeave += delegate(object s, EventArgs e) { ((Button)s).BackColor = Color.FromArgb(30, 31, 38); ((Button)s).ForeColor = C_MUTED; };
        btnClose.Click += delegate { if (wc != null) wc.CancelAsync(); Application.Exit(); };
        pnlTitle.Controls.Add(btnClose);

        // ── PC Installation Stage Label ────────────────
        lblStage = new Label {
            Text = "PC INSTALLATION STAGE",
            ForeColor = C_GOLD, BackColor = Color.Transparent,
            Font = new Font("Segoe UI", 11f, FontStyle.Bold),
            Location = new Point(0, 390), Size = new Size(800, 30),
            TextAlign = ContentAlignment.MiddleCenter
        };

        // ── Progress Bar Track ─────────────────────────
        pnlProgress = new Panel {
            Location = new Point(100, 430), Size = new Size(600, 14),
            BackColor = C_TRACK, Visible = false
        };
        var gp = new GraphicsPath();
        gp.AddArc(0, 0, 14, 14, 180, 90);
        gp.AddArc(586, 0, 14, 14, 270, 90);
        gp.AddArc(586, 0, 14, 14, 0, 90);
        gp.AddArc(0, 0, 14, 14, 90, 90);
        pnlProgress.Region = new Region(gp);
        pnlProgress.Paint += DrawProgressBar;

        // ── Status Text ────────────────────────────────
        lblStatus = new Label {
            Text = "",
            ForeColor = C_FG, BackColor = Color.Transparent,
            Font = new Font("Segoe UI", 10.5f),
            Location = new Point(0, 455), Size = new Size(800, 24),
            TextAlign = ContentAlignment.MiddleCenter, Visible = false
        };

        // ── Bytes downloaded text ──────────────────────
        lblBytes = new Label {
            Text = "",
            ForeColor = C_MUTED, BackColor = Color.Transparent,
            Font = new Font("Segoe UI", 9f),
            Location = new Point(0, 482), Size = new Size(800, 20),
            TextAlign = ContentAlignment.MiddleCenter, Visible = false
        };

        // ── Install Button ─────────────────────────────
        btnInstall = new Button {
            Text = "INSTALL",
            Location = new Point(260, 430), Size = new Size(280, 54),
            FlatStyle = FlatStyle.Flat,
            BackColor = C_PINK, ForeColor = C_FG,
            Font = new Font("Segoe UI", 14f, FontStyle.Bold),
            Cursor = Cursors.Hand
        };
        btnInstall.FlatAppearance.BorderSize = 0;
        btnInstall.Click += StartInstall;
        RoundBtn(btnInstall, 12);

        // ── Launch Button ──────────────────────────────
        btnLaunch = new Button {
            Text = "PLAY GAME ▶",
            Location = new Point(260, 430), Size = new Size(280, 54),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(28, 180, 90), ForeColor = C_FG,
            Font = new Font("Segoe UI", 14f, FontStyle.Bold),
            Cursor = Cursors.Hand, Visible = false
        };
        btnLaunch.FlatAppearance.BorderSize = 0;
        btnLaunch.Click += delegate {
            Process.Start(new ProcessStartInfo(exePath) { WorkingDirectory = installDir });
            Application.Exit();
        };
        RoundBtn(btnLaunch, 12);

        Controls.AddRange(new Control[] {
            pnlTitle, lblStage, pnlProgress, lblStatus, lblBytes, btnInstall, btnLaunch
        });
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        var g = e.Graphics;
        g.SmoothingMode      = SmoothingMode.AntiAlias;
        g.InterpolationMode  = InterpolationMode.HighQualityBicubic;

        // ── Pink glow top center ───────────────────────
        using (var brush = new PathGradientBrush(new PointF[] {
            new PointF(400, 36), new PointF(100, 280), new PointF(700, 280)
        })) {
            brush.CenterColor    = Color.FromArgb(40, 255, 79, 115);
            brush.SurroundColors = new Color[] { Color.Transparent, Color.Transparent };
            g.FillEllipse(brush, 150, 40, 500, 300);
        }

        // ── Draw 4 character cards rotating/scaling ────
        int[] xPos   = { 130, 270, 410, 550 };
        float[] rots = { -8f, -3f, 3f, 8f };
        float[] scls = { 1f, 1.08f, 1.08f, 1f };

        for (int i = 0; i < 4; i++)
        {
            if (charImgs[i] != null)
            {
                int w = (int)(120 * scls[i]);
                int h = (int)(120 * scls[i]);
                int x = xPos[i] + (120 - w) / 2;
                int y = 70 + (120 - h) / 2;

                g.TranslateTransform(x + w / 2, y + h / 2);
                g.RotateTransform(rots[i]);
                g.DrawImage(charImgs[i], -w / 2, -h / 2, w, h);
                g.ResetTransform();
            }
        }

        // ── Draw Logo ──────────────────────────────────
        if (logoImg != null)
        {
            int lw = 240;
            int lh = (int)(240f * logoImg.Height / logoImg.Width);
            g.DrawImage(logoImg, (800 - lw) / 2, 210, lw, lh);
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
        }
    }

    void StartInstall(object sender, EventArgs e)
    {
        installing = true;
        btnInstall.Visible = false;

        pnlProgress.Visible = true;
        lblStatus.Visible   = true;
        lblBytes.Visible    = true;

        lblStatus.Text = "Connecting to download servers...";
        lblBytes.Text  = "0 MB / 0 MB";

        try { Directory.CreateDirectory(installDir); }
        catch (Exception ex)
        {
            MessageBox.Show("Cannot create install folder:\n" + ex.Message);
            btnInstall.Visible = true;
            pnlProgress.Visible = false;
            lblStatus.Visible   = false;
            lblBytes.Visible    = false;
            return;
        }

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
            if      (progressPct < 15) step = "Connecting to server...";
            else if (progressPct < 45) step = "Downloading game assets...";
            else if (progressPct < 75) step = "Extracting files...";
            else if (progressPct < 92) step = "Optimizing setup...";
            else                       step = "Configuring local environment...";

            lblStatus.Text = step + "... (" + progressPct + "%)";
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
                lblBytes.Text  = "Please verify your internet connection and try again.";
                progressPct = 0;
                pnlProgress.Invalidate();
                btnInstall.Visible = true;
                btnInstall.Text    = "RETRY";
                return;
            }

            done        = true;
            progressPct = 100;
            pnlProgress.Invalidate();

            lblStatus.Text = "Installation complete!";
            lblBytes.Text  = "Desktop shortcut created. Ready to launch!";

            CreateShortcut();

            pnlProgress.Visible = false;
            lblStatus.Visible   = true;
            lblBytes.Visible    = true;
            btnLaunch.Visible   = true;
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
        return new Button {
            Text = text, Location = loc, Size = new Size(26, 22),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(30, 31, 38), ForeColor = C_MUTED,
            Font = new Font("Segoe UI", 9.5f), Cursor = Cursors.Hand
        };
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
