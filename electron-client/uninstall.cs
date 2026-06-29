using System;
using System.IO;
using System.Diagnostics;
using System.Windows.Forms;

class Uninstaller
{
    [STAThread]
    static void Main()
    {
        DialogResult result = MessageBox.Show(
            "Are you sure you want to completely uninstall Chiikawa Royale and all of its components?",
            "Uninstall Chiikawa Royale",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question
        );

        if (result == DialogResult.Yes)
        {
            try
            {
                // 1. Delete Desktop shortcut
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                string shortcutPath = Path.Combine(desktopPath, "Chiikawa Royale.lnk");
                if (File.Exists(shortcutPath))
                {
                    File.Delete(shortcutPath);
                }

                // 2. Kill any running game processes
                Process[] processes = Process.GetProcessesByName("Chiikawa_Royale");
                foreach (Process p in processes)
                {
                    try { p.Kill(); p.WaitForExit(3000); } catch {}
                }

                // 3. Get installation directory
                string installDir = AppDomain.CurrentDomain.BaseDirectory;
                
                // 4. Create a self-deleting batch script in Temp directory
                string tempBatchPath = Path.Combine(Path.GetTempPath(), "chiikawa_uninstall.bat");
                
                string batchContent = string.Format(
                    "@echo off\r\n" +
                    ":wait_loop\r\n" +
                    "tasklist /FI \"PID eq {0}\" 2>nul | find /I \"{0}\" >nul\r\n" +
                    "if %errorlevel% equ 0 (\r\n" +
                    "    timeout /t 1 /nobreak >nul\r\n" +
                    "    goto wait_loop\r\n" +
                    ")\r\n" +
                    "rd /s /q \"{1}\"\r\n" +
                    "del \"%~f0\"\r\n",
                    Process.GetCurrentProcess().Id,
                    installDir.TrimEnd('\\')
                );

                File.WriteAllText(tempBatchPath, batchContent);

                // 5. Run the batch script in background hidden
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "cmd.exe";
                psi.Arguments = "/c \"" + tempBatchPath + "\"";
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                Process.Start(psi);

                MessageBox.Show(
                    "Chiikawa Royale was successfully uninstalled from your computer.",
                    "Uninstall Complete",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "An error occurred during uninstallation: " + ex.Message,
                    "Uninstall Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }
    }
}
