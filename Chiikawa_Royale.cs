using System;
using System.IO;
using System.Net;
using System.Diagnostics;
using System.Threading;

class Program
{
    static HttpListener listener;
    static string rootDir;
    static int port = 52200;

    [STAThread]
    static void Main(string[] args)
    {
        rootDir = AppDomain.CurrentDomain.BaseDirectory;
        
        // Find an open port
        for (int p = 52200; p < 52300; p++)
        {
            try
            {
                listener = new HttpListener();
                listener.Prefixes.Add("http://localhost:" + p + "/");
                listener.Start();
                port = p;
                break;
            }
            catch
            {
                listener = null;
            }
        }

        if (listener == null)
        {
            return;
        }

        // Start local server thread
        Thread serverThread = new Thread(StartServer);
        serverThread.IsBackground = true;
        serverThread.Start();

        // Launch Browser in App mode
        string url = "http://localhost:" + port + "/launcher.html";
        ProcessStartInfo startInfo = new ProcessStartInfo();
        
        // Find Microsoft Edge or Google Chrome
        string edgePath = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
        string chromePath = @"C:\Program Files\Google\Chrome\Application\chrome.exe";
        
        if (File.Exists(edgePath))
        {
            startInfo.FileName = edgePath;
            startInfo.Arguments = "--app=\"" + url + "\" --window-size=960,624";
        }
        else if (File.Exists(chromePath))
        {
            startInfo.FileName = chromePath;
            startInfo.Arguments = "--app=\"" + url + "\" --window-size=960,624";
        }
        else
        {
            // Fallback to default system browser
            startInfo.FileName = url;
            startInfo.UseShellExecute = true;
        }

        try
        {
            Process proc = Process.Start(startInfo);
            if (proc != null)
            {
                proc.WaitForExit();
            }
            else
            {
                // Fallback sleep
                Thread.Sleep(10000);
            }
        }
        catch
        {
            // Silent catch
        }
        finally
        {
            listener.Stop();
        }
    }

    static void StartServer()
    {
        try
        {
            while (listener.IsListening)
            {
                HttpListenerContext context = listener.GetContext();
                ThreadPool.QueueUserWorkItem((state) => HandleRequest(context));
            }
        }
        catch { }
    }

    static void HandleRequest(HttpListenerContext context)
    {
        try
        {
            string rawUrl = context.Request.RawUrl;
            if (rawUrl.Contains("?"))
            {
                rawUrl = rawUrl.Substring(0, rawUrl.IndexOf('?'));
            }
            
            // Decodes URL encoded spaces and special characters
            rawUrl = Uri.UnescapeDataString(rawUrl);
            
            string path = Path.Combine(rootDir, rawUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
            if (Directory.Exists(path))
            {
                path = Path.Combine(path, "launcher.html");
            }

            if (File.Exists(path))
            {
                byte[] bytes = File.ReadAllBytes(path);
                context.Response.ContentLength64 = bytes.Length;
                
                string ext = Path.GetExtension(path).ToLower();
                if (ext == ".html") context.Response.ContentType = "text/html";
                else if (ext == ".css") context.Response.ContentType = "text/css";
                else if (ext == ".js") context.Response.ContentType = "application/javascript";
                else if (ext == ".png") context.Response.ContentType = "image/png";
                else if (ext == ".jpg" || ext == ".jpeg") context.Response.ContentType = "image/jpeg";
                else if (ext == ".svg") context.Response.ContentType = "image/svg+xml";
                else if (ext == ".mp4") context.Response.ContentType = "video/mp4";
                else if (ext == ".mp3") context.Response.ContentType = "audio/mpeg";
                
                context.Response.OutputStream.Write(bytes, 0, bytes.Length);
            }
            else
            {
                context.Response.StatusCode = (int)HttpStatusCode.NotFound;
            }
            context.Response.OutputStream.Close();
        }
        catch { }
    }
}
