package com.jmdcart.godown

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = userAgentString + " JMDGodownNativeWrapper/1.0"
        }

        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()

        // Expose JavaScript bridge to React Godown Client
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun triggerRing(orderId: String, orderNumber: String, customerName: String, amount: String) {
                ContinuousRingtoneService.startRinging(
                    this@MainActivity,
                    orderId,
                    orderNumber,
                    customerName,
                    amount
                )
            }

            @JavascriptInterface
            fun stopRing() {
                ContinuousRingtoneService.stopRinging(this@MainActivity)
            }
        }, "AndroidGodownBridge")

        val targetUrl = "https://management.jmdcart.com/app/godown"
        val orderId = intent.getStringExtra("orderId")
        if (!orderId.isNullOrEmpty()) {
            webView.loadUrl("$targetUrl?tab=orders&orderId=$orderId")
        } else {
            webView.loadUrl(targetUrl)
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
