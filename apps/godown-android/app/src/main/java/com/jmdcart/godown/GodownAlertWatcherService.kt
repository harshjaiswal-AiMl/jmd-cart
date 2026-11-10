package com.jmdcart.godown

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

/**
 * Always-On Native Background Alert Watcher Daemon.
 * Runs continuously in the background even when app is killed/swiped away.
 * Ensures the device wakes up, turns on screen, and rings like a telephone call on new orders.
 */
class GodownAlertWatcherService : Service() {

    private var scheduler: ScheduledExecutorService? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var cpuWakeLock: PowerManager.WakeLock? = null

    companion object {
        private const val TAG = "JMDGodownWatcher"
        const val WATCHER_CHANNEL_ID = "jmd_godown_watcher_channel"
        const val WATCHER_NOTIFICATION_ID = 8001
        private const val POLL_INTERVAL_SECONDS = 6L
        private const val DEFAULT_BASE_URL = "https://management.jmdcart.com"

        // In-memory cache of snoozed order IDs and expiry timestamps (prevents race-condition re-ringing)
        private val localSnoozedOrders = java.util.concurrent.ConcurrentHashMap<String, Long>()
        private val localAcknowledgedOrders = java.util.Collections.synchronizedSet(mutableSetOf<String>())

        fun snoozeOrderLocally(orderId: String, snoozeSeconds: Int = 300) {
            val expiry = System.currentTimeMillis() + (snoozeSeconds * 1000L)
            localSnoozedOrders[orderId] = expiry
        }

        fun acknowledgeOrderLocally(orderId: String) {
            localAcknowledgedOrders.add(orderId)
        }

        fun isOrderSnoozedOrAcknowledged(orderId: String): Boolean {
            if (orderId.isEmpty()) return false
            if (localAcknowledgedOrders.contains(orderId)) return true
            val snoozedUntil = localSnoozedOrders[orderId] ?: return false
            return if (System.currentTimeMillis() < snoozedUntil) {
                true
            } else {
                localSnoozedOrders.remove(orderId)
                false
            }
        }

        fun startService(context: Context) {
            val intent = Intent(context, GodownAlertWatcherService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(WATCHER_NOTIFICATION_ID, buildOngoingNotification())

        // Acquire partial CPU wake lock to ensure background thread execution even when phone is locked
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            cpuWakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "jmdcart:watcher_cpu_wake")
            cpuWakeLock?.acquire()
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to acquire CPU wake lock", e)
        }

        startPollingLoop()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Ensure polling loop is running
        startPollingLoop()
        // Return START_STICKY so Android OS auto-recreates the service if killed for memory
        return START_STICKY
    }

    /**
     * When user swipes app away from Recents, schedule instant restart via AlarmManager
     */
    override fun onTaskRemoved(rootIntent: Intent?) {
        try {
            val restartServiceIntent = Intent(applicationContext, GodownAlertWatcherService::class.java).also {
                it.setPackage(packageName)
            }
            val restartServicePendingIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                PendingIntent.getForegroundService(
                    this, 101, restartServiceIntent,
                    PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
                )
            } else {
                PendingIntent.getService(
                    this, 101, restartServiceIntent,
                    PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
                )
            }
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.set(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + 1000,
                restartServicePendingIntent
            )
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to schedule service resurrection on task removed", e)
        }
        super.onTaskRemoved(rootIntent)
    }

    private fun startPollingLoop() {
        if (scheduler == null || scheduler!!.isShutdown) {
            scheduler = Executors.newSingleThreadScheduledExecutor()
            scheduler?.scheduleWithFixedDelay({
                try {
                    pollPendingAlerts()
                } catch (e: Exception) {
                    // ignore network errors in background poll
                }
            }, 2, POLL_INTERVAL_SECONDS, TimeUnit.SECONDS)
        }
    }

    private fun pollPendingAlerts() {
        val deviceToken = DeviceRegistrationManager.getDeviceToken(this)
        if (deviceToken.isEmpty()) return

        var conn: HttpURLConnection? = null
        try {
            val url = URL("$DEFAULT_BASE_URL/api/notifications/native-device/poll")
            conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("x-device-token", deviceToken)
            conn.connectTimeout = 6000
            conn.readTimeout = 6000

            val responseCode = conn.responseCode
            if (responseCode == 200) {
                val responseText = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
                val json = JSONObject(responseText)
                val hasPendingAlerts = json.optBoolean("hasPendingAlerts", false)
                val alertsArray = json.optJSONArray("alerts")

                // Filter out any locally snoozed or acknowledged orders to guarantee zero race-condition re-ringing
                val unhandledAlerts = org.json.JSONArray()
                if (hasPendingAlerts && alertsArray != null) {
                    for (i in 0 until alertsArray.length()) {
                        val alertObj = alertsArray.getJSONObject(i)
                        val id = alertObj.optString("orderId")
                        val alertId = alertObj.optString("alertId")
                        if (!isOrderSnoozedOrAcknowledged(id) && !isOrderSnoozedOrAcknowledged(alertId)) {
                            unhandledAlerts.put(alertObj)
                        }
                    }
                }

                if (unhandledAlerts.length() > 0) {
                    triggerCallScreen(unhandledAlerts)
                } else if (ContinuousRingtoneService.isCurrentlyRinging) {
                    // All pending orders resolved or snoozed! Silence ringtone
                    ContinuousRingtoneService.stopRinging(this)
                    IncomingOrderCallActivity.currentInstance?.finish()
                }
            }
        } catch (e: Exception) {
            // ignore network/timeout blips
        } finally {
            conn?.disconnect()
        }
    }

    private fun triggerCallScreen(alertsArray: org.json.JSONArray) {
        val firstAlert = alertsArray.getJSONObject(0)
        val orderId = firstAlert.optString("orderId")
        val orderNumber = firstAlert.optString("orderNumber", "New Order")
        val customerName = firstAlert.optString("customerName", "Customer")
        val contactPhone = firstAlert.optString("contactPhone", "")
        val amountPaise = firstAlert.optLong("amountPaise", 0L)
        val cartonCount = firstAlert.optInt("cartonCount", 0)
        val looseCount = firstAlert.optInt("looseCount", 0)
        val totalPieces = firstAlert.optInt("totalPieces", 0)

        val amountStr = if (amountPaise > 0) "₹" + String.format("%,.2f", amountPaise / 100.0) else ""
        val packagingStr = "📦 $cartonCount Cartons • $looseCount Loose Pieces (Total: $totalPieces Pcs)"

        // 1. Acquire WakeLock to turn on screen even when locked
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (wakeLock == null || !wakeLock!!.isHeld) {
                @Suppress("DEPRECATION")
                wakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "jmdcart:incoming_order_wake"
                )
                wakeLock?.acquire(30000)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // 2. Start Continuous Ringtone & Vibration
        ContinuousRingtoneService.startRinging(
            this,
            orderId,
            orderNumber,
            customerName,
            amountStr,
            contactPhone,
            packagingStr,
            alertsArray.toString()
        )

        // 3. Directly launch IncomingOrderCallActivity over lockscreen
        try {
            val callIntent = Intent(this, IncomingOrderCallActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra(ContinuousRingtoneService.EXTRA_ORDER_ID, orderId)
                putExtra(ContinuousRingtoneService.EXTRA_ORDER_NUMBER, orderNumber)
                putExtra(ContinuousRingtoneService.EXTRA_CUSTOMER_NAME, customerName)
                putExtra(ContinuousRingtoneService.EXTRA_AMOUNT, amountStr)
                putExtra(ContinuousRingtoneService.EXTRA_PHONE, contactPhone)
                putExtra(ContinuousRingtoneService.EXTRA_PACKAGING, packagingStr)
                putExtra(ContinuousRingtoneService.EXTRA_MULTI_ORDERS_JSON, alertsArray.toString())
            }
            startActivity(callIntent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun buildOngoingNotification(): Notification {
        val launchIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, WATCHER_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("JMD Godown Alert Monitor Active")
            .setContentText("Listening for incoming dispatch orders 24x7")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                WATCHER_CHANNEL_ID,
                getString(R.string.channel_watcher_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.channel_watcher_desc)
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        scheduler?.shutdownNow()
        scheduler = null
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (e: Exception) {
            // ignore
        }
        try {
            if (cpuWakeLock?.isHeld == true) {
                cpuWakeLock?.release()
            }
        } catch (e: Exception) {
            // ignore
        }
        super.onDestroy()
    }
}
