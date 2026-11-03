package com.jmdcart.godown

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject

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

            @JavascriptInterface
            fun getDeviceToken(): String {
                return DeviceRegistrationManager.getDeviceToken(this@MainActivity)
            }

            @JavascriptInterface
            fun getDeviceInfo(): String {
                return JSONObject().apply {
                    put("isNativeApp", true)
                    put("deviceToken", DeviceRegistrationManager.getDeviceToken(this@MainActivity))
                    put("batteryOptDisabled", DeviceRegistrationManager.isBatteryOptimizationIgnored(this@MainActivity))
                    put("notificationPermitted", DeviceRegistrationManager.areNotificationsEnabled(this@MainActivity))
                    put("fullScreenPermitted", DeviceRegistrationManager.canUseFullScreenIntent(this@MainActivity))
                }.toString()
            }

            @JavascriptInterface
            fun testAlert() {
                ContinuousRingtoneService.startRinging(
                    this@MainActivity,
                    "TEST_ORDER",
                    "TEST-001",
                    "Test Customer (Sample Alert)",
                    "₹5,000"
                )
            }
        }, "AndroidGodownBridge")

        // Auto-register FCM token on launch
        try {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (task.isSuccessful && !task.result.isNullOrEmpty()) {
                    DeviceRegistrationManager.registerWithBackend(this, task.result)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Send initial heartbeat
        DeviceRegistrationManager.sendHeartbeat(this)

        // Check and request permissions
        checkNotificationAndBatteryPermissions()

        val targetUrl = "https://management.jmdcart.com/app/godown"
        val orderId = intent.getStringExtra("orderId")
        if (!orderId.isNullOrEmpty()) {
            webView.loadUrl("$targetUrl?tab=orders&orderId=$orderId")
        } else {
            webView.loadUrl(targetUrl)
        }
    }

    private fun checkNotificationAndBatteryPermissions() {
        // 1. Android 13+ Notification Permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }

        // 2. Battery Optimization Exemption
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!DeviceRegistrationManager.isBatteryOptimizationIgnored(this)) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
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
