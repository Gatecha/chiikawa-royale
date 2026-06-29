package com.example.chiikawaroyale

import android.annotation.SuppressLint
import android.app.Activity
import android.app.Dialog
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import android.webkit.PermissionRequest
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.JavascriptInterface
import android.Manifest
import android.content.pm.PackageManager
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var pendingPermissionRequest: PermissionRequest? = null
    
    // Auto-update variables
    @Volatile
    private var isUpdating = true
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val PREFS_NAME = "ChiikawaRoyalePrefs"
    private val KEY_COMMIT_SHA = "latest_commit_sha"

    @SuppressLint("SetJavaScriptEnabled", "AddJavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        webView = WebView(this)
        
        // Expose JavaScript Interface for updater checking
        webView.addJavascriptInterface(this, "AndroidUpdater")
        
        // Set WebViewClient with local file interception
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                if (request == null) return null
                val url = request.url.toString()
                
                if (url.startsWith("file:///android_asset/")) {
                    val path = url.substring("file:///android_asset/".length)
                    if (path == "index.html" || path == "game.js" || path == "styles.css") {
                        val updateFile = File(File(filesDir, "update"), path)
                        if (updateFile.exists()) {
                            try {
                                val mimeType = when {
                                    path.endsWith(".html") -> "text/html"
                                    path.endsWith(".js") -> "application/javascript"
                                    path.endsWith(".css") -> "text/css"
                                    else -> "text/plain"
                                }
                                val stream = FileInputStream(updateFile)
                                return WebResourceResponse(mimeType, "UTF-8", stream)
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                    }
                }
                return super.shouldInterceptRequest(view, request)
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                // Ensure page knows we are updating if Kotlin set the flag
                if (isUpdating) {
                    view?.evaluateJavascript("window.isUpdating = true;", null)
                }
            }
        }
        
        // Handle media permissions in WebView (e.g. microphone)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                val resources = request.resources
                for (resource in resources) {
                    if (resource == PermissionRequest.RESOURCE_AUDIO_CAPTURE) {
                        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                        } else {
                            pendingPermissionRequest = request
                            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 101)
                        }
                        return
                    }
                }
                super.onPermissionRequest(request)
            }
        }
        
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.textZoom = 88
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.databaseEnabled = true
        @Suppress("DEPRECATION")
        settings.allowFileAccessFromFileURLs = true
        @Suppress("DEPRECATION")
        settings.allowUniversalAccessFromFileURLs = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        
        // Enable immersive fullscreen mode
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            window.insetsController?.let { controller ->
                controller.hide(android.view.WindowInsets.Type.statusBars() or android.view.WindowInsets.Type.navigationBars())
                controller.systemBarsBehavior = android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                or android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
        }

        setContentView(webView)
        webView.setInitialScale(88)
        
        // Check for updates
        checkForUpdatesAndLoad()
    }

    @JavascriptInterface
    fun isUpdating(): Boolean {
        return isUpdating
    }

    @JavascriptInterface
    fun openOAuth(url: String) {
        mainHandler.post {
            showOAuthDialog(url)
        }
    }

    private fun showOAuthDialog(url: String) {
        val dialog = Dialog(this, android.R.style.Theme_Black_NoTitleBar_Fullscreen)
        val dialogWebView = WebView(this)
        
        val settings = dialogWebView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.allowFileAccess = true
        settings.databaseEnabled = true
        
        dialogWebView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, pageUrl: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, pageUrl, favicon)
                if (pageUrl != null && pageUrl.contains("access_token=")) {
                    mainHandler.post {
                        webView.evaluateJavascript("if (typeof handleOAuthCallback === 'function') handleOAuthCallback('$pageUrl');", null)
                        dialog.dismiss()
                    }
                }
            }
        }
        
        dialog.setContentView(dialogWebView)
        dialog.show()
        dialogWebView.loadUrl(url)
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val capabilities = cm.getNetworkCapabilities(cm.activeNetwork)
        return capabilities != null && (
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
        )
    }

    private fun checkForUpdatesAndLoad() {
        if (!isOnline()) {
            isUpdating = false
            webView.loadUrl("file:///android_asset/index.html")
            return
        }

        // Start background updater check
        executor.execute {
            var latestSha: String? = null
            try {
                val url = URL("https://github.com/Gatecha/chiikawa-royale.git/info/refs?service=git-upload-pack")
                val conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 5000
                conn.readTimeout = 5000
                val text = conn.inputStream.bufferedReader().use { it.readText() }
                val target = "refs/heads/main"
                val index = text.indexOf(target)
                if (index != -1) {
                    val shaStart = index - 41
                    if (shaStart >= 0) {
                        val sha = text.substring(shaStart, index - 1).trim()
                        if (sha.length == 40) {
                            latestSha = sha
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }

            if (latestSha == null) {
                // If checking fails, proceed to load normal game cache/assets without updating
                mainHandler.post {
                    isUpdating = false
                    webView.loadUrl("file:///android_asset/index.html")
                }
                return@execute
            }

            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val storedSha = prefs.getString(KEY_COMMIT_SHA, "")

            if (storedSha == latestSha) {
                // Already at latest version! No update needed
                mainHandler.post {
                    isUpdating = false
                    webView.loadUrl("file:///android_asset/index.html")
                }
            } else {
                // Update needed! Start downloading
                mainHandler.post {
                    // Load the webview page immediately so the user sees the styled loading screen
                    isUpdating = true
                    webView.loadUrl("file:///android_asset/index.html")
                    
                    // Run the download in background
                    startDownloadSequence(latestSha)
                }
            }
        }
    }

    private fun startDownloadSequence(targetSha: String) {
        executor.execute {
            try {
                val tempDir = File(filesDir, "update_temp")
                if (tempDir.exists()) tempDir.deleteRecursively()
                tempDir.mkdirs()

                val filesToDownload = arrayOf("index.html", "game.js", "styles.css")
                // Approximate weights for progress bar: index.html (20%), game.js (60%), styles.css (20%)
                val weights = intArrayOf(20, 60, 20)
                val offsets = intArrayOf(0, 20, 80)

                for (i in filesToDownload.indices) {
                    val fileName = filesToDownload[i]
                    val fileUrl = "https://raw.githubusercontent.com/Gatecha/chiikawa-royale/main/$fileName"
                    val destFile = File(tempDir, fileName)

                    downloadFileWithProgress(fileUrl, destFile, offsets[i], weights[i]) { progress ->
                        // Post progress update to webview
                        mainHandler.post {
                            webView.evaluateJavascript("""
                                (function() {
                                    var fill = document.getElementById('titleProgressBarFill');
                                    var status = document.getElementById('titleLoadingStatus');
                                    if (fill) fill.style.width = '$progress%';
                                    if (status) status.textContent = 'UPDATING GAME FILES... $progress%';
                                })();
                            """.trimIndent(), null)
                        }
                    }
                }

                // Successful download! Do atomic swap
                val updateDir = File(filesDir, "update")
                if (updateDir.exists()) updateDir.deleteRecursively()
                tempDir.renameTo(updateDir)

                // Save new SHA
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putString(KEY_COMMIT_SHA, targetSha).apply()

                // Finished updating, reload WebView so that shouldInterceptRequest serves new files
                mainHandler.post {
                    isUpdating = false
                    webView.reload()
                }

            } catch (e: Exception) {
                e.printStackTrace()
                // Error during download: fall back to normal cache
                mainHandler.post {
                    isUpdating = false
                    Toast.makeText(this@MainActivity, "Update failed. Starting game...", Toast.LENGTH_SHORT).show()
                    webView.evaluateJavascript("window.isUpdating = false; startTitleScreenLoading();", null)
                }
            }
        }
    }

    private fun downloadFileWithProgress(
        urlStr: String,
        destFile: File,
        progressOffset: Int,
        progressWeight: Int,
        onProgress: (Int) -> Unit
    ) {
        val url = URL(urlStr)
        val conn = url.openConnection() as HttpURLConnection
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        val totalBytes = conn.contentLength
        
        conn.inputStream.use { input ->
            FileOutputStream(destFile).use { output ->
                val buffer = ByteArray(4096)
                var bytesRead = 0
                var read: Int
                while (input.read(buffer).also { read = it } != -1) {
                    output.write(buffer, 0, read)
                    bytesRead += read
                    if (totalBytes > 0) {
                        val fileProgress = (bytesRead.toDouble() / totalBytes * progressWeight).toInt()
                        onProgress(progressOffset + fileProgress)
                    }
                }
            }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        if (requestCode == 101) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                pendingPermissionRequest?.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
            } else {
                pendingPermissionRequest?.deny()
            }
            pendingPermissionRequest = null
        }
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
