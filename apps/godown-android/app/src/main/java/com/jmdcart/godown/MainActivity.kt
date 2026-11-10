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

        // 1. Start always-on native alert watcher daemon immediately
        GodownAlertWatcherService.startService(this)

        webView = WebView(this)
        setContentView(webView)

        webView.clearCache(true)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_NO_CACHE
            userAgentString = userAgentString + " JMDGodownNativeWrapper/1.1"
        }

        val neutralizeScript = """
            (function() {
                // 1. Completely neutralize Web Audio API so "tu tu" beep sound can NEVER play
                window.AudioContext = function() {
                    return {
                        state: 'suspended',
                        resume: function() { return Promise.resolve(); },
                        suspend: function() { return Promise.resolve(); },
                        close: function() { return Promise.resolve(); },
                        createOscillator: function() {
                            return {
                                type: 'sine',
                                frequency: { setValueAtTime: function() {} },
                                connect: function() {},
                                start: function() {},
                                stop: function() {}
                            };
                        },
                        createGain: function() {
                            return {
                                gain: { setValueAtTime: function() {}, exponentialRampToValueAtTime: function() {} },
                                connect: function() {}
                            };
                        },
                        destination: {}
                    };
                };
                window.webkitAudioContext = window.AudioContext;
                if (navigator.vibrate) { navigator.vibrate = function() { return true; }; }

                // 2. Hide any legacy web red alert modal
                var style = document.getElementById('native-suppress-style');
                if (!style) {
                    style = document.createElement('style');
                    style.id = 'native-suppress-style';
                    style.type = 'text/css';
                    style.innerHTML = '.bg-red-650, .bg-red-600, [class*="animate-pulse fixed inset-0"], .fixed.inset-0.z-50 { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }';
                    (document.head || document.documentElement).appendChild(style);
                }
            })();
        """.trimIndent()

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                view?.evaluateJavascript(neutralizeScript, null)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                view?.evaluateJavascript(neutralizeScript, null)
            }
        }
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
                try {
                    val callIntent = Intent(this@MainActivity, IncomingOrderCallActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                        putExtra(ContinuousRingtoneService.EXTRA_ORDER_ID, orderId)
                        putExtra(ContinuousRingtoneService.EXTRA_ORDER_NUMBER, orderNumber)
                        putExtra(ContinuousRingtoneService.EXTRA_CUSTOMER_NAME, customerName)
                        putExtra(ContinuousRingtoneService.EXTRA_AMOUNT, amount)
                    }
                    this@MainActivity.startActivity(callIntent)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            @JavascriptInterface
            fun stopRing() {
                ContinuousRingtoneService.stopRinging(this@MainActivity)
            }

            @JavascriptInterface
            fun setCallAlertsEnabled(enabled: Boolean) {
                DeviceRegistrationManager.setCallAlertsEnabled(this@MainActivity, enabled)
            }

            @JavascriptInterface
            fun isCallAlertsEnabled(): Boolean {
                return DeviceRegistrationManager.isCallAlertsEnabled(this@MainActivity)
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

        loadGodownUrl(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        intent?.let { loadGodownUrl(it) }
    }

    private fun loadGodownUrl(intent: Intent) {
        val targetUrl = "https://management.jmdcart.com/app/godown"
        val orderId = intent.getStringExtra("orderId") ?: ""
        val tab = intent.getStringExtra("tab") ?: if (orderId.isNotEmpty()) "orders" else null

        if (tab != null) {
            // Instantly switch tab in existing loaded WebView in 0 ms
            webView.evaluateJavascript("if (window.switchGodownTab) { window.switchGodownTab('$tab', '$orderId'); }", null)
            if (webView.url == null) {
                webView.loadUrl("$targetUrl?tab=$tab&orderId=$orderId")
            }
        } else if (webView.url == null) {
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

        // 3. Android 14+ Full Screen Intent Permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            if (!DeviceRegistrationManager.canUseFullScreenIntent(this)) {
                try {
                    val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    // ignore
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
