package com.jmdcart.godown

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
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
 * Uses both background scheduled executor AND hardware RTC AlarmManager
 * so that polling NEVER stops even when the phone screen is locked or in deep sleep.
 */
class GodownAlertWatcherService : Service() {

    private var scheduler: ScheduledExecutorService? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var cpuWakeLock: PowerManager.WakeLock? = null
    private var isScreenReceiverRegistered = false

    companion object {
        private const val TAG = "JMDGodownWatcher"
        const val WATCHER_CHANNEL_ID = "jmd_godown_watcher_channel"
        const val WATCHER_NOTIFICATION_ID = 8001
        const val ACTION_ALARM_POLL = "com.jmdcart.godown.ACTION_ALARM_POLL"
        private const val POLL_INTERVAL_SECONDS = 8L
        private const val RTC_WAKEUP_INTERVAL_SECONDS = 12L
        private const val ALARM_REQUEST_CODE = 9005
        private const val DEFAULT_BASE_URL = "https://management.jmdcart.com"

        @Volatile
        var isScreenOn = true

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

        /**
         * Schedules hardware RTC wake-up through AlarmManager.
         * Wakes CPU from Linux suspend / deep sleep when phone is locked.
         */
        fun scheduleNextRtcWakeup(context: Context, delaySeconds: Long = RTC_WAKEUP_INTERVAL_SECONDS) {
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
                val intent = Intent(context, AlarmPollReceiver::class.java).apply {
                    action = ACTION_ALARM_POLL
                }
                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    ALARM_REQUEST_CODE,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                val triggerAtMillis = SystemClock.elapsedRealtime() + (delaySeconds * 1000L)

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        if (alarmManager.canScheduleExactAlarms()) {
                            alarmManager.setExactAndAllowWhileIdle(
                                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                                triggerAtMillis,
                                pendingIntent
                            )
                        } else {
                            val showIntent = Intent(context, MainActivity::class.java)
                            val showPendingIntent = PendingIntent.getActivity(
                                context, 1008, showIntent,
                                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                            )
                            val alarmClockInfo = AlarmManager.AlarmClockInfo(
                                System.currentTimeMillis() + (delaySeconds * 1000L),
                                showPendingIntent
                            )
                            alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
                        }
                    } else {
                        alarmManager.setExactAndAllowWhileIdle(
                            AlarmManager.ELAPSED_REALTIME_WAKEUP,
                            triggerAtMillis,
                            pendingIntent
                        )
                    }
                } else {
                    alarmManager.setExact(
                        AlarmManager.ELAPSED_REALTIME_WAKEUP,
                        triggerAtMillis,
                        pendingIntent
                    )
                }
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Failed to schedule RTC wakeup", e)
            }
        }
    }

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                Intent.ACTION_SCREEN_OFF -> {
                    isScreenOn = false
                    // When phone screen turns off, schedule hardware RTC wake-up immediately!
                    context?.let { scheduleNextRtcWakeup(it, 4L) }
                }
                Intent.ACTION_SCREEN_ON -> {
                    isScreenOn = true
                    // Screen turned on -> trigger immediate poll!
                    scheduler?.execute { pollPendingAlerts() }
                }
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(WATCHER_NOTIFICATION_ID, buildOngoingNotification())

        // Acquire partial CPU wake lock to assist background thread execution
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            cpuWakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "jmdcart:watcher_cpu_wake")
            cpuWakeLock?.acquire()
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to acquire CPU wake lock", e)
        }

        // Register screen state changes to adapt polling mode
        try {
            val filter = IntentFilter().apply {
                addAction(Intent.ACTION_SCREEN_OFF)
                addAction(Intent.ACTION_SCREEN_ON)
            }
            registerReceiver(screenReceiver, filter)
            isScreenReceiverRegistered = true
        } catch (e: Exception) {
            e.printStackTrace()
        }

        startPollingLoop()
        scheduleNextRtcWakeup(this, 10L)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_ALARM_POLL) {
            // Wakeup triggered by hardware RTC alarm
            scheduler?.execute {
                try {
                    pollPendingAlerts()
                } finally {
                    scheduleNextRtcWakeup(this@GodownAlertWatcherService)
                }
            }
            return START_STICKY
        }

        // Ensure polling loop is running
        startPollingLoop()
        scheduleNextRtcWakeup(this)
        return START_STICKY
    }

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
                val seenOrderIds = mutableSetOf<String>()
                if (hasPendingAlerts && alertsArray != null) {
                    for (i in 0 until alertsArray.length()) {
                        val alertObj = alertsArray.getJSONObject(i)
                        val id = alertObj.optString("orderId")
                        val alertId = alertObj.optString("alertId")
                        if (!isOrderSnoozedOrAcknowledged(id) && !isOrderSnoozedOrAcknowledged(alertId)) {
                            // Deduplicate locally so the same order is NEVER processed twice!
                            if (seenOrderIds.add(id)) {
                                unhandledAlerts.put(alertObj)
                            }
                        }
                    }
                }

                // If user turned OFF loud incoming call popups, skip screen wakeup and ringing
                if (!DeviceRegistrationManager.isCallAlertsEnabled(this)) {
                    if (ContinuousRingtoneService.isCurrentlyRinging) {
                        ContinuousRingtoneService.stopRinging(this)
                        IncomingOrderCallActivity.currentInstance?.finish()
                    }
                    return
                }

                if (unhandledAlerts.length() > 0) {
                    // Check if MainActivity is currently in the foreground (user is actively using the app)
                    if (MainActivity.isAppInForeground) {
                        if (ContinuousRingtoneService.isCurrentlyRinging) {
                            ContinuousRingtoneService.muteSoundOnly(this)
                        }
                        IncomingOrderCallActivity.currentInstance?.finish()
                        return
                    }

                    // Check if IncomingOrderCallActivity is ALREADY active on screen:
                    val existingCallActivity = IncomingOrderCallActivity.currentInstance
                    if (existingCallActivity != null && !existingCallActivity.isFinishing) {
                        existingCallActivity.updateOrders(unhandledAlerts)
                    } else if (!ContinuousRingtoneService.isCurrentlyRinging) {
                        triggerCallScreen(unhandledAlerts)
                    }
                } else if (ContinuousRingtoneService.isCurrentlyRinging) {
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

        // 1. Acquire WakeLock to turn ON the screen even when locked
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (wakeLock == null || !wakeLock!!.isHeld) {
                @Suppress("DEPRECATION")
                wakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                    "jmdcart:incoming_order_wake"
                )
                wakeLock?.acquire(30000)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // 2. Start Continuous Ringtone & Full-Screen Notification
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

        // 3. Directly launch IncomingOrderCallActivity over lockscreen as well
        try {
            val callIntent = Intent(this, IncomingOrderCallActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
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

        if (isScreenReceiverRegistered) {
            try {
                unregisterReceiver(screenReceiver)
                isScreenReceiverRegistered = false
            } catch (e: Exception) {
                // ignore
            }
        }

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
