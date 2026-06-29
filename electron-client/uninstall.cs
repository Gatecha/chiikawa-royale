using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

class Uninstaller : Form
{
    private readonly string installRoot;
    private readonly Label statusLabel;
    private readonly Button uninstallButton;
    private readonly Button cancelButton;

    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new Uninstaller());
    }

    Uninstaller()
    {
        installRoot = ResolveInstallRoot();

        Text = "Chiikawa Royale Uninstaller";
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        MinimizeBox = false;
        ClientSize = new Size(520, 330);
        BackColor = Color.FromArgb(8, 8, 12);

        TrySetIcon();

        Panel header = new Panel();
        header.Dock = DockStyle.Top;
        header.Height = 120;
        header.BackColor = Color.FromArgb(20, 20, 28);
        Controls.Add(header);

        Label logo = new Label();
        logo.Text = "CHIIKAWA\nROYALE";
        logo.ForeColor = Color.White;
        logo.BackColor = Color.Transparent;
        logo.Font = new Font("Arial Rounded MT Bold", 19, FontStyle.Bold);
        logo.TextAlign = ContentAlignment.MiddleCenter;
        logo.SetBounds(24, 20, 150, 76);
        header.Controls.Add(logo);

        Label title = new Label();
        title.Text = "Uninstall Chiikawa Royale?";
        title.ForeColor = Color.White;
        title.BackColor = Color.Transparent;
        title.Font = new Font("Segoe UI", 18, FontStyle.Bold);
        title.SetBounds(190, 30, 300, 34);
        header.Controls.Add(title);

        Label subtitle = new Label();
        subtitle.Text = "This removes the PC client, launcher files, and desktop shortcut.";
        subtitle.ForeColor = Color.FromArgb(180, 180, 190);
        subtitle.BackColor = Color.Transparent;
        subtitle.Font = new Font("Segoe UI", 9, FontStyle.Regular);
        subtitle.SetBounds(192, 67, 300, 40);
        header.Controls.Add(subtitle);

        Label pathLabel = new Label();
        pathLabel.Text = "Install folder:";
        pathLabel.ForeColor = Color.FromArgb(255, 216, 111);
        pathLabel.Font = new Font("Segoe UI", 9, FontStyle.Bold);
        pathLabel.SetBounds(34, 145, 430, 22);
        Controls.Add(pathLabel);

        TextBox pathBox = new TextBox();
        pathBox.Text = installRoot;
        pathBox.ReadOnly = true;
        pathBox.BorderStyle = BorderStyle.FixedSingle;
        pathBox.BackColor = Color.FromArgb(18, 18, 24);
        pathBox.ForeColor = Color.White;
        pathBox.Font = new Font("Segoe UI", 9, FontStyle.Regular);
        pathBox.SetBounds(34, 170, 452, 25);
        Controls.Add(pathBox);

        statusLabel = new Label();
        statusLabel.Text = "Ready to uninstall.";
        statusLabel.ForeColor = Color.FromArgb(185, 185, 195);
        statusLabel.Font = new Font("Segoe UI", 9, FontStyle.Regular);
        statusLabel.SetBounds(34, 210, 452, 35);
        Controls.Add(statusLabel);

        uninstallButton = new Button();
        uninstallButton.Text = "UNINSTALL";
        uninstallButton.FlatStyle = FlatStyle.Flat;
        uninstallButton.BackColor = Color.FromArgb(255, 79, 115);
        uninstallButton.ForeColor = Color.White;
        uninstallButton.Font = new Font("Segoe UI", 10, FontStyle.Bold);
        uninstallButton.SetBounds(270, 270, 130, 38);
        uninstallButton.Click += OnUninstall;
        Controls.Add(uninstallButton);

        cancelButton = new Button();
        cancelButton.Text = "CANCEL";
        cancelButton.FlatStyle = FlatStyle.Flat;
        cancelButton.BackColor = Color.FromArgb(42, 42, 50);
        cancelButton.ForeColor = Color.White;
        cancelButton.Font = new Font("Segoe UI", 10, FontStyle.Bold);
        cancelButton.SetBounds(410, 270, 76, 38);
        cancelButton.Click += delegate { Close(); };
        Controls.Add(cancelButton);
    }

    private void OnUninstall(object sender, EventArgs e)
    {
        DialogResult result = MessageBox.Show(
            "Remove Chiikawa Royale from this PC?",
            "Confirm Uninstall",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question
        );
        if (result != DialogResult.Yes) return;

        try
        {
            uninstallButton.Enabled = false;
            cancelButton.Enabled = false;
            statusLabel.Text = "Preparing uninstall...";

            DeleteDesktopShortcut();
            KillGameProcesses();
            CreateSelfDeleteScript();

            MessageBox.Show(
                "Chiikawa Royale uninstall has started. The folder will disappear after this window closes.",
                "Uninstall Started",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information
            );
            Close();
        }
        catch (Exception ex)
        {
            uninstallButton.Enabled = true;
            cancelButton.Enabled = true;
            statusLabel.Text = "Uninstall failed.";
            MessageBox.Show(ex.Message, "Uninstall Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private string ResolveInstallRoot()
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        if (string.Equals(Path.GetFileName(dir), "Launcher", StringComparison.OrdinalIgnoreCase))
        {
            DirectoryInfo parent = Directory.GetParent(dir);
            if (parent != null) return parent.FullName;
        }
        return dir;
    }

    private void TrySetIcon()
    {
        string[] candidates = {
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "gamelogo.ico"),
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Launcher", "gamelogo.ico")
        };

        foreach (string candidate in candidates)
        {
            try
            {
                if (File.Exists(candidate))
                {
                    Icon = new Icon(candidate);
                    return;
                }
            }
            catch {}
        }
    }

    private void DeleteDesktopShortcut()
    {
        string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
        string shortcutPath = Path.Combine(desktopPath, "Chiikawa Royale.lnk");
        if (File.Exists(shortcutPath)) File.Delete(shortcutPath);
    }

    private void KillGameProcesses()
    {
        foreach (string name in new[] { "Chiikawa_Royale", "Chiikawa Royale" })
        {
            foreach (Process p in Process.GetProcessesByName(name))
            {
                try
                {
                    if (p.Id == Process.GetCurrentProcess().Id) continue;
                    p.Kill();
                    p.WaitForExit(3000);
                }
                catch {}
            }
        }
    }

    private void CreateSelfDeleteScript()
    {
        string tempBatchPath = Path.Combine(Path.GetTempPath(), "chiikawa_royale_uninstall.bat");
        string currentPid = Process.GetCurrentProcess().Id.ToString();
        string safeInstallRoot = installRoot.TrimEnd('\\');

        string batchContent =
            "@echo off\r\n" +
            ":wait_loop\r\n" +
            "tasklist /FI \"PID eq " + currentPid + "\" 2>nul | find /I \"" + currentPid + "\" >nul\r\n" +
            "if %errorlevel% equ 0 (\r\n" +
            "    timeout /t 1 /nobreak >nul\r\n" +
            "    goto wait_loop\r\n" +
            ")\r\n" +
            "rd /s /q \"" + safeInstallRoot + "\"\r\n" +
            "del \"%~f0\"\r\n";

        File.WriteAllText(tempBatchPath, batchContent);

        ProcessStartInfo psi = new ProcessStartInfo();
        psi.FileName = "cmd.exe";
        psi.Arguments = "/c \"" + tempBatchPath + "\"";
        psi.CreateNoWindow = true;
        psi.UseShellExecute = false;
        Process.Start(psi);
    }
}
