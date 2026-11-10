package com.jmdcart.godown

import android.app.NotificationManager
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import kotlin.concurrent.thread

object DeviceRegistrationManager {

    private const val PREFS_NAME = "jmd_godown_prefs"
    private const val KEY_DEVICE_TOKEN = "device_token"
    private const val KEY_FCM_TOKEN = "fcm_token"
    private const val KEY_CALL_ALERTS_ENABLED = "call_alerts_enabled"
    private const val DEFAULT_BASE_URL = "https://management.jmdcart.com"

    fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /**
     * User preference to enable/disable loud telephone incoming call popups
     * Default: true (active)
     */
    fun isCallAlertsEnabled(context: Context): Boolean {
        return getPrefs(context).getBoolean(KEY_CALL_ALERTS_ENABLED, true)
    }

    fun setCallAlertsEnabled(context: Context, enabled: Boolean) {
        getPrefs(context).edit().putBoolean(KEY_CALL_ALERTS_ENABLED, enabled).apply()
    }

    /**
     * Gets or generates a persistent, long-lived device token scoped to this Android device.
     */
    fun getDeviceToken(context: Context): String {
        val prefs = getPrefs(context)
        var token = prefs.getString(KEY_DEVICE_TOKEN, null)
        if (token.isNullOrEmpty()) {
            token = "dev_" + UUID.randomUUID().toString().replace("-", "")
            prefs.edit().putString(KEY_DEVICE_TOKEN, token).apply()
        }
        return token
    }

    fun getFcmToken(context: Context): String? {
        return getPrefs(context).getString(KEY_FCM_TOKEN, null)
    }

    fun saveFcmToken(context: Context, fcmToken: String) {
        getPrefs(context).edit().putString(KEY_FCM_TOKEN, fcmToken).apply()
    }

    fun isBatteryOptimizationIgnored(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            pm?.isIgnoringBatteryOptimizations(context.packageName) ?: true
        } else {
            true
        }
    }

    fun areNotificationsEnabled(context: Context): Boolean {
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    fun canUseFullScreenIntent(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            nm?.canUseFullScreenIntent() ?: true
        } else {
            true
        }
    }

    /**
     * Registers native device FCM token with backend /api/notifications/native-device/register
     */
    fun registerWithBackend(context: Context, fcmToken: String) {
        saveFcmToken(context, fcmToken)
        val deviceToken = getDeviceToken(context)
        val deviceLabel = "${Build.MANUFACTURER} ${Build.MODEL}"
        val batteryOptDisabled = isBatteryOptimizationIgnored(context)
        val notifPermitted = areNotificationsEnabled(context)
        val fullScreenPermitted = canUseFullScreenIntent(context)

        thread {
            try {
                val url = URL("$DEFAULT_BASE_URL/api/notifications/native-device/register")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                conn.doOutput = true

                val payload = JSONObject().apply {
                    put("deviceToken", deviceToken)
                    put("fcmToken", fcmToken)
                    put("deviceLabel", deviceLabel)
                    put("appVersion", "1.0.0")
                    put("batteryOptDisabled", batteryOptDisabled)
                    put("notificationPermitted", notifPermitted)
                    put("fullScreenPermitted", fullScreenPermitted)
                }

                conn.outputStream.use { os ->
                    os.write(payload.toString().toByteArray())
                }

                val responseCode = conn.responseCode
                conn.disconnect()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    /**
     * Sends periodic heartbeat reporting device status and permission health
     */
    fun sendHeartbeat(context: Context) {
        val deviceToken = getDeviceToken(context)
        val fcmToken = getFcmToken(context) ?: ""

        thread {
            try {
                val url = URL("$DEFAULT_BASE_URL/api/notifications/native-device/heartbeat")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("x-device-token", deviceToken)
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                conn.doOutput = true

                val payload = JSONObject().apply {
                    put("deviceToken", deviceToken)
                    put("fcmToken", fcmToken)
                    put("appVersion", "1.0.0")
                    put("batteryOptDisabled", isBatteryOptimizationIgnored(context))
                    put("notificationPermitted", areNotificationsEnabled(context))
                    put("fullScreenPermitted", canUseFullScreenIntent(context))
                }

                conn.outputStream.use { os ->
                    os.write(payload.toString().toByteArray())
                }

                conn.responseCode
                conn.disconnect()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    /**
     * Acknowledges order alert, stopping ringtone across all warehouse managers
     */
    fun acknowledgeAlert(context: Context, orderId: String) {
        val deviceToken = getDeviceToken(context)
        thread {
            try {
                val url = URL("$DEFAULT_BASE_URL/api/notifications/alerts/acknowledge")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("x-device-token", deviceToken)
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                conn.doOutput = true

                val payload = JSONObject().apply {
                    put("orderId", orderId)
                    put("deviceToken", deviceToken)
                }

                conn.outputStream.use { os ->
                    os.write(payload.toString().toByteArray())
                }

                conn.responseCode
                conn.disconnect()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    /**
     * Snoozes order alert for 5 minutes (300 seconds default)
     */
    fun snoozeAlert(context: Context, orderId: String, snoozeSeconds: Int = 300) {
        val deviceToken = getDeviceToken(context)
        thread {
            try {
                val url = URL("$DEFAULT_BASE_URL/api/notifications/native-device/snooze")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("x-device-token", deviceToken)
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                conn.doOutput = true

                val payload = JSONObject().apply {
                    put("orderId", orderId)
                    put("deviceToken", deviceToken)
                    put("snoozeSeconds", snoozeSeconds)
                }

                conn.outputStream.use { os ->
                    os.write(payload.toString().toByteArray())
                }

                conn.responseCode
                conn.disconnect()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
