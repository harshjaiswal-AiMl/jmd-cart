package com.jmdcart.godown

import android.app.AlarmManager
import android.content.ComponentName
import android.content.Context
import androidx.appcompat.app.AlertDialog
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

    companion object {
        @Volatile
        var isAppInForeground: Boolean = false
    }

    private lateinit var webView: WebView

    override fun onResume() {
        super.onResume()
        isAppInForeground = true
        // If ringtone was buzzing while opening app, silence sound
        ContinuousRingtoneService.muteSoundOnly(this)

        // Check if OEM guidance dialog should be shown after system popups finish
        if (isNotificationPermissionGranted() && DeviceRegistrationManager.isBatteryOptimizationIgnored(this)) {
            showOemGuidanceDialog()
        }
    }

    override fun onPause() {
        super.onPause()
        isAppInForeground = false
    }

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
            fun openAppSettings() {
                try {
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.parse("package:${this@MainActivity.packageName}")
                    }
                    this@MainActivity.startActivity(intent)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
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

    private fun isNotificationPermissionGranted(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    private fun checkNotificationAndBatteryPermissions() {
        // Step 1: Request Notification permission first (Native system popup on Android 13+)
        if (!isNotificationPermissionGranted()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        } else {
            // Notifications already granted -> proceed to battery optimization
            checkBatteryOptimizationSetup()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 101) {
            // Once user answers notification popup -> automatically trigger battery popup
            checkBatteryOptimizationSetup()
        }
    }

    private fun checkBatteryOptimizationSetup() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!DeviceRegistrationManager.isBatteryOptimizationIgnored(this)) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    e.printStackTrace()
                    showOemGuidanceDialog()
                }
            } else {
                showOemGuidanceDialog()
            }
        } else {
            showOemGuidanceDialog()
        }
    }

    private fun showOemGuidanceDialog() {
        val prefs = DeviceRegistrationManager.getPrefs(this)
        if (prefs.getBoolean("oem_guide_shown", false)) return

        val manufacturer = Build.MANUFACTURER.lowercase()
        val isOemPhone = manufacturer.contains("xiaomi") || manufacturer.contains("redmi") ||
                         manufacturer.contains("poco") || manufacturer.contains("vivo") ||
                         manufacturer.contains("iqoo") || manufacturer.contains("oppo") ||
                         manufacturer.contains("realme")

        if (!isOemPhone) {
            // For Pixel, Samsung, Motorola - standard permissions are sufficient!
            prefs.edit().putBoolean("oem_guide_shown", true).apply()
            return
        }

        AlertDialog.Builder(this)
            .setTitle("📞 Phone Band Rehne Pe Call Setup")
            .setMessage("Phone band ya lock rehne par bhi naye dispatch order ki telephone ring aane ke liye:\n\n1. 'Autostart' ko ON karein\n2. 'Show on Lock Screen' ko Allow karein\n\nNeeche button dabakar seedha phone setting kholiye.")
            .setPositiveButton("Open Settings") { dialog, _ ->
                prefs.edit().putBoolean("oem_guide_shown", true).apply()
                dialog.dismiss()
                openOemPermissions(this)
            }
            .setNegativeButton("Theek Hai") { dialog, _ ->
                prefs.edit().putBoolean("oem_guide_shown", true).apply()
                dialog.dismiss()
            }
            .setCancelable(false)
            .show()
    }

    private fun openOemPermissions(context: Context) {
        val manufacturer = Build.MANUFACTURER.lowercase()
        if (manufacturer.contains("xiaomi") || manufacturer.contains("redmi") || manufacturer.contains("poco")) {
            try {
                val intent = Intent("miui.intent.action.APP_PERM_EDITOR").apply {
                    setClassName("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity")
                    putExtra("extra_pkgname", context.packageName)
                }
                context.startActivity(intent)
                return
            } catch (e: Exception) {
                try {
                    val intent = Intent().apply {
                        component = ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")
                    }
                    context.startActivity(intent)
                    return
                } catch (e2: Exception) {
                    // fallback
                }
            }
        } else if (manufacturer.contains("vivo") || manufacturer.contains("iqoo")) {
            try {
                val intent = Intent().apply {
                    component = ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.PurviewTabActivity")
                }
                context.startActivity(intent)
                return
            } catch (e: Exception) {
                // fallback
            }
        } else if (manufacturer.contains("oppo") || manufacturer.contains("realme") || manufacturer.contains("oneplus")) {
            try {
                val intent = Intent().apply {
                    component = ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.PermissionManagerActivity")
                }
                context.startActivity(intent)
                return
            } catch (e: Exception) {
                // fallback
            }
        }

        // Universal Fallback: Application Details Settings
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${context.packageName}")
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
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
