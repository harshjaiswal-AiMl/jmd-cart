package com.jmdcart.shop

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var offlineBanner: TextView

    private val defaultUrl = "https://jmdcart.com/store"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        progressBar = findViewById(R.id.progressBar)
        offlineBanner = findViewById(R.id.offlineBanner)

        setupWebView()
        setupSwipeRefresh()
        setupBackNavigation()
        handleIntent(intent)
        checkNetworkStatus()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        intent?.let { handleIntent(it) }
    }

    private fun handleIntent(intent: Intent) {
        val appLinkData: Uri? = intent.data
        if (appLinkData != null) {
            val targetUrl = appLinkData.toString()
            if (targetUrl.startsWith("https://jmdcart.com") || targetUrl.startsWith("http://jmdcart.com")) {
                webView.loadUrl(targetUrl)
                return
            }
        }
        val orderId = intent.getStringExtra("orderId")
        if (orderId != null) {
            webView.loadUrl("https://jmdcart.com/store/orders/$orderId")
            return
        }
        if (webView.url == null) {
            webView.loadUrl(defaultUrl)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.cacheMode = if (isNetworkAvailable()) WebSettings.LOAD_DEFAULT else WebSettings.LOAD_CACHE_ELSE_NETWORK

        // In-app JavaScript Bridge for Native Capabilities
        webView.addJavascriptInterface(NativeAppBridge(this), "NativeBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false
                checkNetworkStatus()
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                if (!isNetworkAvailable()) {
                    offlineBanner.visibility = View.VISIBLE
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false

                // External intents: WhatsApp, tel:, mailto:
                if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("whatsapp:") || url.startsWith("https://wa.me/")) {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    try {
                        startActivity(intent)
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                    return true
                }

                // Keep jmdcart.com within the webview
                if (url.contains("jmdcart.com") || url.contains("localhost")) {
                    return false
                }

                // Other external URLs open in system browser
                val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                startActivity(browserIntent)
                return true
            }
        }
    }

    private fun setupSwipeRefresh() {
        swipeRefresh.setColorSchemeResources(R.color.primary, R.color.secondary)
        swipeRefresh.setOnRefreshListener {
            checkNetworkStatus()
            webView.reload()
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val actNw = cm.getNetworkCapabilities(network) ?: return false
        return actNw.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun checkNetworkStatus() {
        if (!isNetworkAvailable()) {
            offlineBanner.visibility = View.VISIBLE
        } else {
            offlineBanner.visibility = View.GONE
        }
    }

    // Native Bridge class
    class NativeAppBridge(private val context: Context) {
        @JavascriptInterface
        fun triggerHaptic() {
            val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(20, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                vibrator.vibrate(20)
            }
        }

        @JavascriptInterface
        fun shareText(text: String) {
            val sendIntent = Intent().apply {
                action = Intent.ACTION_SEND
                putExtra(Intent.EXTRA_TEXT, text)
                type = "text/plain"
            }
            val shareIntent = Intent.createChooser(sendIntent, "Share with")
            context.startActivity(shareIntent)
        }
    }
}
