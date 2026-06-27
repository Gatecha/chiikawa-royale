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

    // ── Direct GitHub LFS URL ──
    const string DOWNLOAD_URL = "https://media.githubusercontent.com/media/Gatecha/chiikawa-royale/main/Chiikawa_Royale.exe";
    const string APP_FOLDER   = "ChiikawaRoyale";
    const string EXE_NAME     = "Chiikawa_Royale.exe";

    static readonly Color C_BG     = Color.FromArgb(11, 12, 14);
    static readonly Color C_PANEL  = Color.FromArgb(7, 8, 10);
    static readonly Color C_PINK   = Color.FromArgb(255, 79, 115);
    static readonly Color C_PINK2  = Color.FromArgb(255, 143, 171);
    static readonly Color C_GOLD   = Color.FromArgb(255, 216, 111);
    static readonly Color C_FG     = Color.White;
    static readonly Color C_MUTED  = Color.FromArgb(110, 112, 124);
    static readonly Color C_TRACK  = Color.FromArgb(24, 26, 32);

    string installDir, exePath;

    Panel     pnlTitle, pnlProgress;
    Label     lblTitleText, lblStage, lblStatus, lblBytes;
    Button    btnClose, btnMin, btnInstall, btnLaunch;
    Image[]   charImgs = new Image[4];
    Image     logoImg;
    WebClient wc;
    Timer     animTimer;

    // Animation states
    float   tickCount      = 0f;
    float   smoothProgress = 0f;
    float   targetProgress = 0f;
    float   shimmerX       = -150f;
    bool    done           = false;

    public SetupForm()
    {
        installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), APP_FOLDER);
        exePath    = Path.Combine(installDir, EXE_NAME);

        // Delete corrupt files (less than 10MB) to fix "This app can't run on your PC"
        if (File.Exists(exePath))
        {
            try
            {
                FileInfo fi = new FileInfo(exePath);
                if (fi.Length < 10 * 1024 * 1024)
                {
                    File.Delete(exePath);
                }
            }
            catch {}
        }

        Text            = "Chiikawa Royale Setup";
        ClientSize      = new Size(800, 500);
        FormBorderStyle = FormBorderStyle.None;
        StartPosition   = FormStartPosition.CenterScreen;
        BackColor       = C_BG;
        DoubleBuffered  = true;

        LoadResources();
        BuildUI();

        // Start animation loop (30ms interval = ~33 FPS)
        animTimer = new Timer { Interval = 30 };
        animTimer.Tick += OnAnimTick;
        animTimer.Start();

        // Check if already installed
        if (File.Exists(exePath))
        {
            btnInstall.Visible = false;
            btnLaunch.Visible  = true;
            lblStage.Text      = "CHIIKAWA ROYALE IS INSTALLED";
            lblStatus.Text     = "Ready to play!";
            lblStatus.Visible  = true;
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
        pnlTitle = new Panel { Dock = DockStyle.Top, Height = 40, BackColor = C_PANEL };
        pnlTitle.MouseDown += (s, e) => { if (e.Button == MouseButtons.Left) { ReleaseCapture(); SendMessage(Handle, 0xA1, 2, 0); } };

        lblTitleText = new Label {
            Text = "CHIIKAWA ROYALE  —  PC INSTALLER",
            ForeColor = C_GOLD, BackColor = Color.Transparent,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            Location = new Point(14, 0), Size = new Size(500, 40),
            TextAlign = ContentAlignment.MiddleLeft
        };
        lblTitleText.MouseDown += (s, e) => { if (e.Button == MouseButtons.Left) { ReleaseCapture(); SendMessage(Handle, 0xA1, 2, 0); } };
        pnlTitle.Controls.Add(lblTitleText);

        // Native close/minimize styling
        btnMin = TitleBtn("−", new Point(730, 8));
        btnMin.Click += delegate { WindowState = FormWindowState.Minimized; };
        pnlTitle.Controls.Add(btnMin);

        btnClose = TitleBtn("✕", new Point(762, 8));
        btnClose.MouseEnter += delegate(object s, EventArgs e) { ((Button)s).BackColor = Color.FromArgb(210, 40, 40); ((Button)s).ForeColor = C_FG; };
        btnClose.MouseLeave += delegate(object s, EventArgs e) { ((Button)s).BackColor = Color.Transparent; ((Button)s).ForeColor = C_MUTED; };
        btnClose.Click += delegate { if (wc != null) wc.CancelAsync(); Application.Exit(); };
        pnlTitle.Controls.Add(btnClose);

        // ── Stage Label ────────────────────────────────
        lblStage = new Label {
            Text = "PC INSTALLATION STAGE",
            ForeColor = C_GOLD, BackColor = Color.Transparent,
            Font = new Font("Segoe UI", 11.5f, FontStyle.Bold),
            Location = new Point(0, 320), Size = new Size(800, 30),
            TextAlign = ContentAlignment.MiddleCenter
        };

        // ── Progress Bar Track ─────────────────────────
        pnlProgress = new Panel {
            Location = new Point(100, 364), Size = new Size(600, 16),
            BackColor = C_TRACK, Visible = false
        };
        var gp = new GraphicsPath();
        gp.AddArc(0, 0, 16, 16, 180, 90);
        gp.AddArc(584, 0, 16, 16, 270, 90);
        gp.AddArc(584, 0, 16, 16, 0, 90);
        gp.AddArc(0, 0, 16, 16, 90, 90);
        pnlProgress.Region = new Region(gp);
        pnlProgress.Paint += DrawProgressBar;

        // ── Status Label ───────────────────────────────
        lblStatus = new Label {
            Text = "",
            ForeColor = C_FG, BackColor = Color.Transparent,
            Font = new Font("Segoe UI", 10.5f),
            Location = new Point(0, 394), Size = new Size(800, 24),
            TextAlign = ContentAlignment.MiddleCenter, Visible = false
        };

        // ── Bytes Label ────────────────────────────────
        lblBytes = new Label {
            Text = "",
            ForeColor = C_MUTED, BackColor = Color.Transparent,
            Font = new Font("Segoe UI", 9f),
            Location = new Point(0, 420), Size = new Size(800, 20),
            TextAlign = ContentAlignment.MiddleCenter, Visible = false
        };

        // ── Install Button ─────────────────────────────
        btnInstall = new Button {
            Text = "INSTALL",
            Location = new Point(260, 364), Size = new Size(280, 54),
            FlatStyle = FlatStyle.Flat,
            BackColor = C_PINK, ForeColor = C_FG,
            Font = new Font("Segoe UI", 14f, FontStyle.Bold),
            Cursor = Cursors.Hand
        };
        btnInstall.FlatAppearance.BorderSize = 0;
        btnInstall.FlatAppearance.MouseOverBackColor = Color.FromArgb(255, 100, 130);
        btnInstall.FlatAppearance.MouseDownBackColor = Color.FromArgb(220, 50, 85);
        btnInstall.Click += StartInstall;
        RoundBtn(btnInstall, 12);

        // ── Launch Button ──────────────────────────────
        btnLaunch = new Button {
            Text = "PLAY GAME ▶",
            Location = new Point(260, 364), Size = new Size(280, 54),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(28, 180, 90), ForeColor = C_FG,
            Font = new Font("Segoe UI", 14f, FontStyle.Bold),
            Cursor = Cursors.Hand, Visible = false
        };
        btnLaunch.FlatAppearance.BorderSize = 0;
        btnLaunch.FlatAppearance.MouseOverBackColor = Color.FromArgb(40, 210, 110);
        btnLaunch.FlatAppearance.MouseDownBackColor = Color.FromArgb(20, 150, 70);
        btnLaunch.Click += delegate {
            Process.Start(new ProcessStartInfo(exePath) { WorkingDirectory = installDir });
            Application.Exit();
        };
        RoundBtn(btnLaunch, 12);

        Controls.AddRange(new Control[] {
            pnlTitle, lblStage, pnlProgress, lblStatus, lblBytes, btnInstall, btnLaunch
        });
    }

    void OnAnimTick(object sender, EventArgs e)
    {
        tickCount += 1f;

        // 1. Smooth progress bar transitions
        if (Math.Abs(smoothProgress - targetProgress) > 0.05f)
        {
            smoothProgress += (targetProgress - smoothProgress) * 0.08f;
            pnlProgress.Invalidate();
        }
        else if (smoothProgress != targetProgress)
        {
            smoothProgress = targetProgress;
            pnlProgress.Invalidate();
        }

        // 2. Shimmer sweep movement
        shimmerX += 6f;
        if (shimmerX > 750) shimmerX = -180f;
        if (pnlProgress.Visible) pnlProgress.Invalidate();

        // 3. Force paint redraw for floating images
        Invalidate();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        var g = e.Graphics;
        g.SmoothingMode      = SmoothingMode.AntiAlias;
        g.InterpolationMode  = InterpolationMode.HighQualityBicubic;

        // ── Radial background glow ─────────────────────
        using (var brush = new PathGradientBrush(new PointF[] {
            new PointF(400, 36), new PointF(100, 260), new PointF(700, 260)
        })) {
            brush.CenterColor    = Color.FromArgb(35, 255, 79, 115);
            brush.SurroundColors = new Color[] { Color.Transparent, Color.Transparent };
            g.FillEllipse(brush, 150, 40, 500, 260);
        }

        // ── Bobbing characters spread ──────────────────
        int[] xPos     = { 140, 270, 410, 540 };
        float[] rots   = { -8f, -3f, 3f, 8f };
        float[] scls   = { 1f, 1.08f, 1.08f, 1f };
        float[] phases = { 0.0f, 0.8f, 1.6f, 2.4f };

        for (int i = 0; i < 4; i++)
        {
            if (charImgs[i] != null)
            {
                int w = (int)(110 * scls[i]);
                int h = (int)(110 * scls[i]);
                int x = xPos[i] + (110 - w) / 2;

                // Bobbing Y calculation using sine waves
                float bobY = (float)Math.Sin(tickCount * 0.06f + phases[i]) * 7f;
                int y = 54 + (110 - h) / 2 + (int)bobY;

                g.TranslateTransform(x + w / 2, y + h / 2);
                g.RotateTransform(rots[i]);
                g.DrawImage(charImgs[i], -w / 2, -h / 2, w, h);
                g.ResetTransform();
            }
        }

        // ── Bobbing Logo ───────────────────────────────
        if (logoImg != null)
        {
            int lw = 220;
            int lh = (int)(220f * logoImg.Height / logoImg.Width);
            float bobLogoY = (float)Math.Sin(tickCount * 0.04f) * 4f;
            g.DrawImage(logoImg, (800 - lw) / 2, 175 + (int)bobLogoY, lw, lh);
        }
    }

    void DrawProgressBar(object sender, PaintEventArgs e)
    {
        var g   = e.Graphics;
        var pnl = (Panel)sender;
        g.SmoothingMode = SmoothingMode.AntiAlias;

        if (smoothProgress > 0)
        {
            int fillW = (int)(pnl.Width * smoothProgress / 100.0);
            if (fillW < 1) fillW = 1;

            Color barColor = done ? Color.FromArgb(30, 180, 90) : C_PINK;
            Color barEnd   = done ? Color.FromArgb(80, 220, 130) : C_PINK2;

            // Draw primary gradient bar
            using (var brush = new LinearGradientBrush(
                new Rectangle(0, 0, fillW, pnl.Height),
                barColor, barEnd, LinearGradientMode.Horizontal))
            {
                var gp = new GraphicsPath();
                int r = 8;
                gp.AddArc(0, 0, r * 2, r * 2, 180, 90);
                int rr = fillW > r * 2 ? fillW - r * 2 : 0;
                gp.AddArc(rr, 0, r * 2, r * 2, 270, 90);
                gp.AddArc(rr, 0, r * 2, r * 2, 0, 90);
                gp.AddArc(0, 0, r * 2, r * 2, 90, 90);
                gp.CloseAllFigures();
                g.FillPath(brush, gp);
            }

            // Draw sliding diagonal shimmer sweep
            if (!done && smoothProgress < 100)
            {
                g.SetClip(new Rectangle(0, 0, fillW, pnl.Height));
                using (var shimmerBrush = new LinearGradientBrush(
                    new Rectangle((int)shimmerX, 0, 150, pnl.Height),
                    Color.Transparent, Color.FromArgb(85, 255, 255, 255), LinearGradientMode.Horizontal))
                {
                    shimmerBrush.Blend = new Blend {
                        Factors = new float[] { 0f, 1f, 0f },
                        Positions = new float[] { 0f, 0.5f, 1f }
                    };
                    g.FillRectangle(shimmerBrush, shimmerX, 0, 150, pnl.Height);
                }
                g.ResetClip();
            }
        }
    }

    void StartInstall(object sender, EventArgs e)
    {
        btnInstall.Visible = false;

        pnlProgress.Visible = true;
        lblStatus.Visible   = true;
        lblBytes.Visible    = true;

        lblStatus.Text = "Initiating download...";
        lblBytes.Text  = "0.0 MB / 0.0 MB";

        try { Directory.CreateDirectory(installDir); }
        catch (Exception ex)
        {
            MessageBox.Show("Unable to create target installation directory:\n" + ex.Message);
            btnInstall.Visible  = true;
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
            targetProgress = ev.ProgressPercentage;

            string recv  = FmtB(ev.BytesReceived);
            string total = ev.TotalBytesToReceive > 0 ? FmtB(ev.TotalBytesToReceive) : "?";

            string step;
            if      (targetProgress < 12) step = "Connecting to content distribution network";
            else if (targetProgress < 45) step = "Downloading core game resources";
            else if (targetProgress < 75) step = "Extracting local engine components";
            else if (targetProgress < 90) step = "Finalizing package integration";
            else                          step = "Optimizing configurations";

            lblStatus.Text = step + "... (" + (int)targetProgress + "%)";
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
                // Delete corrupt partial files immediately
                try { if (File.Exists(exePath)) File.Delete(exePath); } catch {}

                string err = ev.Error != null ? ev.Error.Message : "Cancelled.";
                lblStatus.Text = "Download failed: " + err;
                lblBytes.Text  = "Ensure your internet is stable and try again.";
                targetProgress = 0f;
                smoothProgress = 0f;
                pnlProgress.Invalidate();
                btnInstall.Visible = true;
                btnInstall.Text    = "RETRY";
                return;
            }

            done           = true;
            targetProgress = 100f;
            smoothProgress = 100f;
            pnlProgress.Invalidate();

            lblStatus.Text = "Installation completed successfully!";
            lblBytes.Text  = "Shortcuts set up. Launch to start playing!";

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
        Button b = new Button {
            Text = text, Location = loc, Size = new Size(30, 24),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.Transparent, ForeColor = C_MUTED,
            Font = new Font("Segoe UI", 9f), Cursor = Cursors.Hand
        };
        b.FlatAppearance.BorderSize = 0;
        b.FlatAppearance.MouseOverBackColor = Color.FromArgb(35, 255, 255, 255);
        b.FlatAppearance.MouseDownBackColor = Color.FromArgb(55, 255, 255, 255);
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
