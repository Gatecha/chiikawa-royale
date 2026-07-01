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
import org.json.JSONObject
import java.security.MessageDigest

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
                    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    val storedSha = prefs.getString(KEY_COMMIT_SHA, "")
                    if (!storedSha.isNullOrEmpty()) {
                        val updateDir = File(filesDir, "update")
                        val updateFile = File(updateDir, path)
                        if (updateFile.exists() && updateFile.isFile && updateFile.length() > 0) {
                            try {
                                val mimeType = when {
                                    path.endsWith(".html") -> "text/html"
                                    path.endsWith(".js") -> "application/javascript"
                                    path.endsWith(".css") -> "text/css"
                                    path.endsWith(".png") -> "image/png"
                                    path.endsWith(".jpg") || path.endsWith(".jpeg") -> "image/jpeg"
                                    path.endsWith(".ico") -> "image/x-icon"
                                    path.endsWith(".mp3") -> "audio/mpeg"
                                    path.endsWith(".mp4") -> "video/mp4"
                                    else -> "application/octet-stream"
                                }
                                val encoding = when {
                                    path.endsWith(".html") || path.endsWith(".js") || path.endsWith(".css") -> "UTF-8"
                                    else -> null
                                }
                                val stream = FileInputStream(updateFile)
                                return WebResourceResponse(mimeType, encoding, stream)
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
        
        // Load the webview page immediately so the user sees the styled loading screen
        webView.loadUrl("file:///android_asset/index.html")
        
        // Start checking for updates in the background
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
        return try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
            val activeNetwork = cm.activeNetwork ?: return false
            val capabilities = cm.getNetworkCapabilities(activeNetwork) ?: return false
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    private fun checkForUpdatesAndLoad() {
        if (!isOnline()) {
            isUpdating = false
            mainHandler.post {
                webView.evaluateJavascript("window.isUpdating = false; if (typeof startTitleScreenLoading === 'function') startTitleScreenLoading();", null)
            }
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
                // Set User-Agent to prevent GitHub blocking rate limits
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36")
                
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
                // If checking fails, proceed to load normal cache/assets without updating
                mainHandler.post {
                    isUpdating = false
                    webView.evaluateJavascript("window.isUpdating = false; if (typeof startTitleScreenLoading === 'function') startTitleScreenLoading();", null)
                }
                return@execute
            }

            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val storedSha = prefs.getString(KEY_COMMIT_SHA, "")

            if (storedSha == latestSha) {
                // Already at latest version! No update needed
                mainHandler.post {
                    isUpdating = false
                    webView.evaluateJavascript("window.isUpdating = false; if (typeof startTitleScreenLoading === 'function') startTitleScreenLoading();", null)
                }
            } else {
                // Update needed! Start downloading
                mainHandler.post {
                    isUpdating = true
                    startDownloadSequence(latestSha)
                }
            }
        }
    }

    private fun downloadUrlAsString(urlStr: String): String {
        val url = URL(urlStr)
        val conn = url.openConnection() as HttpURLConnection
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36")
        return conn.inputStream.bufferedReader().use { it.readText() }
    }

    private fun getFileMD5(file: File): String {
        if (!file.exists() || !file.isFile) return ""
        return try {
            val digest = MessageDigest.getInstance("MD5")
            val buffer = ByteArray(8192)
            val fis = FileInputStream(file)
            var read: Int
            while (fis.read(buffer).also { read = it } != -1) {
                digest.update(buffer, 0, read)
            }
            fis.close()
            val md5Bytes = digest.digest()
            val sb = java.lang.StringBuilder()
            for (b in md5Bytes) {
                sb.append(String.format("%02x", b))
            }
            sb.toString()
        } catch (e: Exception) {
            ""
        }
    }

    private fun getAssetMD5(assetName: String): String {
        return try {
            val digest = MessageDigest.getInstance("MD5")
            val buffer = ByteArray(8192)
            assets.open(assetName).use { input ->
                var read: Int
                while (input.read(buffer).also { read = it } != -1) {
                    digest.update(buffer, 0, read)
                }
            }
            val md5Bytes = digest.digest()
            val sb = java.lang.StringBuilder()
            for (b in md5Bytes) {
                sb.append(String.format("%02x", b))
            }
            sb.toString()
        } catch (e: Exception) {
            ""
        }
    }

    private fun copyAssetToFile(assetName: String, destFile: File) {
        destFile.parentFile?.mkdirs()
        assets.open(assetName).use { input ->
            FileOutputStream(destFile).use { output ->
                input.copyTo(output)
            }
        }
    }

    private fun downloadFile(urlStr: String, destFile: File) {
        val url = URL(urlStr)
        val conn = url.openConnection() as HttpURLConnection
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36")
        conn.inputStream.use { input ->
            FileOutputStream(destFile).use { output ->
                input.copyTo(output)
            }
        }
    }

    private fun startDownloadSequence(targetSha: String) {
        executor.execute {
            try {
                mainHandler.post {
                    webView.evaluateJavascript("""
                        (function() {
                            var fill = document.getElementById('titleProgressBarFill');
                            var status = document.getElementById('titleLoadingStatus');
                            if (fill) fill.style.width = '5%';
                            if (status) status.textContent = 'CHECKING FOR GAME UPDATES...';
                        })();
                    """.trimIndent(), null)
                }

                val manifestStr = downloadUrlAsString("https://raw.githubusercontent.com/Gatecha/chiikawa-royale/main/update-manifest.json")
                val manifestObj = org.json.JSONObject(manifestStr)
                val filesObj = manifestObj.getJSONObject("files")

                val tempDir = File(filesDir, "update_temp")
                if (tempDir.exists()) tempDir.deleteRecursively()
                tempDir.mkdirs()

                val updateDir = File(filesDir, "update")
                val keys = filesObj.keys()
                val filesToProcess = mutableListOf<Pair<String, String>>()
                while (keys.hasNext()) {
                    val k = keys.next()
                    filesToProcess.add(Pair(k, filesObj.getString(k)))
                }

                val downloads = mutableListOf<String>()
                val copiesFromUpdate = mutableListOf<String>()
                val copiesFromAssets = mutableListOf<String>()

                for (item in filesToProcess) {
                    val fileName = item.first
                    val expectedHash = item.second
                    val localFile = File(updateDir, fileName)
                    
                    val currentHash = getFileMD5(localFile)
                    if (currentHash == expectedHash) {
                        copiesFromUpdate.add(fileName)
                    } else {
                        val assetHash = getAssetMD5(fileName)
                        if (assetHash == expectedHash) {
                            copiesFromAssets.add(fileName)
                        } else {
                            downloads.add(fileName)
                        }
                    }
                }

                // Process copies from update cache
                for (fileName in copiesFromUpdate) {
                    val srcFile = File(updateDir, fileName)
                    val destFile = File(tempDir, fileName)
                    destFile.parentFile?.mkdirs()
                    srcFile.copyTo(destFile, overwrite = true)
                }

                // Process copies from shipped assets
                for (fileName in copiesFromAssets) {
                    val destFile = File(tempDir, fileName)
                    copyAssetToFile(fileName, destFile)
                }

                val totalDownloads = downloads.size
                var downloadedCount = 0

                if (totalDownloads > 0) {
                    for (fileName in downloads) {
                        val fileUrl = "https://raw.githubusercontent.com/Gatecha/chiikawa-royale/main/$fileName"
                        val destFile = File(tempDir, fileName)
                        destFile.parentFile?.mkdirs()

                        downloadFile(fileUrl, destFile)
                        downloadedCount++
                        
                        val progress = 10 + (downloadedCount.toDouble() / totalDownloads * 85).toInt()
                        mainHandler.post {
                            webView.evaluateJavascript("""
                                (function() {
                                    var fill = document.getElementById('titleProgressBarFill');
                                    var status = document.getElementById('titleLoadingStatus');
                                    if (fill) fill.style.width = '$progress%';
                                    if (status) status.textContent = 'DOWNLOADING UPDATES ($downloadedCount/$totalDownloads)... $progress%';
                                })();
                            """.trimIndent(), null)
                        }
                    }
                }

                // Successful download! Do atomic swap
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
                try {
                    File(filesDir, "update_temp").deleteRecursively()
                } catch (ex: Exception) {}

                mainHandler.post {
                    isUpdating = false
                    Toast.makeText(this@MainActivity, "Update failed. Starting game...", Toast.LENGTH_SHORT).show()
                    webView.evaluateJavascript("window.isUpdating = false; if (typeof startTitleScreenLoading === 'function') startTitleScreenLoading();", null)
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
