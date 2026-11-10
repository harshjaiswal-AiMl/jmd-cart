package com.jmdcart.godown

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat

class ContinuousRingtoneService : Service() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var audioManager: AudioManager? = null
    private var focusRequest: AudioFocusRequest? = null
    private val handler = Handler(Looper.getMainLooper())
    private val timeoutRunnable = Runnable {
        stopRinging(this)
    }

    companion object {
        const val CHANNEL_ID = "jmd_order_ring_channel"
        const val NOTIFICATION_ID = 9001
        const val EXTRA_ORDER_ID = "order_id"
        const val EXTRA_ORDER_NUMBER = "order_number"
        const val EXTRA_CUSTOMER_NAME = "customer_name"
        const val EXTRA_AMOUNT = "amount"
        const val EXTRA_PHONE = "contact_phone"
        const val EXTRA_PACKAGING = "packaging_summary"
        const val EXTRA_MULTI_ORDERS_JSON = "multi_orders_json"
        const val ACTION_MUTE_SOUND_ONLY = "com.jmdcart.godown.MUTE_SOUND_ONLY"
        const val ACTION_SNOOZE = "com.jmdcart.godown.ACTION_SNOOZE"
        const val TIMEOUT_MILLIS = 120_000L // 2 minutes auto-timeout

        @Volatile
        var isCurrentlyRinging = false
            private set

        @Volatile
        var activeInstance: ContinuousRingtoneService? = null
            private set

        fun startRinging(
            context: Context,
            orderId: String,
            orderNumber: String,
            customerName: String,
            amount: String,
            contactPhone: String = "",
            packagingSummary: String = "",
            multiOrdersJson: String = ""
        ) {
            val intent = Intent(context, ContinuousRingtoneService::class.java).apply {
                putExtra(EXTRA_ORDER_ID, orderId)
                putExtra(EXTRA_ORDER_NUMBER, orderNumber)
                putExtra(EXTRA_CUSTOMER_NAME, customerName)
                putExtra(EXTRA_AMOUNT, amount)
                putExtra(EXTRA_PHONE, contactPhone)
                putExtra(EXTRA_PACKAGING, packagingSummary)
                putExtra(EXTRA_MULTI_ORDERS_JSON, multiOrdersJson)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun muteSoundOnly(context: Context) {
            try {
                activeInstance?.silenceAudioAndVibration()
            } catch (e: Exception) {
                // ignore
            }
            val intent = Intent(context, ContinuousRingtoneService::class.java).apply {
                action = ACTION_MUTE_SOUND_ONLY
            }
            context.startService(intent)
        }

        fun stopRinging(context: Context) {
            isCurrentlyRinging = false
            try {
                activeInstance?.silenceAudioAndVibration()
            } catch (e: Exception) {
                // ignore
            }
            val intent = Intent(context, ContinuousRingtoneService::class.java)
            context.stopService(intent)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        activeInstance = this
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        if (intent.action == ACTION_MUTE_SOUND_ONLY) {
            silenceAudioAndVibration()
            return START_NOT_STICKY
        }

        if (intent.action == ACTION_SNOOZE) {
            val orderId = intent.getStringExtra(EXTRA_ORDER_ID) ?: ""
            if (orderId.isNotEmpty()) {
                GodownAlertWatcherService.snoozeOrderLocally(orderId, 300)
                DeviceRegistrationManager.snoozeAlert(this, orderId, 300)
            }
            IncomingOrderCallActivity.currentInstance?.finish()
            stopSelf()
            return START_NOT_STICKY
        }

        isCurrentlyRinging = true

        val orderId = intent.getStringExtra(EXTRA_ORDER_ID) ?: ""
        val orderNumber = intent.getStringExtra(EXTRA_ORDER_NUMBER) ?: "New Order"
        val customerName = intent.getStringExtra(EXTRA_CUSTOMER_NAME) ?: "Customer"
        val amount = intent.getStringExtra(EXTRA_AMOUNT) ?: ""

        // 1. Build full-screen intent to wake phone and show incoming call activity
        val fullScreenIntent = Intent(this, IncomingOrderCallActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtras(intent)
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            0,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Quick action: Snooze 5 Min directly from notification
        val snoozeIntent = Intent(this, ContinuousRingtoneService::class.java).apply {
            action = ACTION_SNOOZE
            putExtra(EXTRA_ORDER_ID, orderId)
        }
        val snoozePendingIntent = PendingIntent.getService(
            this,
            202,
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 2. Start Foreground Notification with CATEGORY_ALARM and high priority
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("🚨 INCOMING GODOWN ORDER: $orderNumber")
            .setContentText("$customerName • $amount")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .addAction(android.R.drawable.ic_lock_idle_alarm, "Snooze 5 Min", snoozePendingIntent)
            .setOngoing(true)
            .setAutoCancel(false)
            .build()

        startForeground(NOTIFICATION_ID, notification)

        // 3. Play continuous looping alarm sound and vibration
        startLoopingSoundAndVibration()

        // 4. Reset 2-minute safety timeout
        handler.removeCallbacks(timeoutRunnable)
        handler.postDelayed(timeoutRunnable, TIMEOUT_MILLIS)

        return START_NOT_STICKY
    }

    private fun requestAudioFocus(): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val playbackAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(playbackAttributes)
                    .build()
                focusRequest = req
                audioManager?.requestAudioFocus(req) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            } else {
                @Suppress("DEPRECATION")
                audioManager?.requestAudioFocus(
                    null,
                    AudioManager.STREAM_ALARM,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT
                ) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            }
        } catch (e: Exception) {
            true
        }
    }

    private fun startLoopingSoundAndVibration() {
        requestAudioFocus()

        try {
            if (mediaPlayer == null) {
                val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

                mediaPlayer = MediaPlayer().apply {
                    setDataSource(this@ContinuousRingtoneService, alarmUri)
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    isLooping = true
                    prepare()
                    start()
                }
            } else if (!mediaPlayer!!.isPlaying) {
                mediaPlayer!!.start()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Vibrate in phone call pattern: 1 sec on, 1 sec off
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }

            val pattern = longArrayOf(0, 1000, 1000)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun silenceAudioAndVibration() {
        try {
            if (mediaPlayer != null) {
                if (mediaPlayer?.isPlaying == true) {
                    mediaPlayer?.stop()
                }
                mediaPlayer?.release()
                mediaPlayer = null
            }
        } catch (e: Exception) {
            mediaPlayer = null
        }
        try {
            vibrator?.cancel()
        } catch (e: Exception) {
            // ignore
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (activeInstance == this) {
            activeInstance = null
        }
        isCurrentlyRinging = false
        handler.removeCallbacks(timeoutRunnable)

        // Abandon Audio Focus
        try {
            focusRequest?.let { req ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    audioManager?.abandonAudioFocusRequest(req)
                }
            }
        } catch (e: Exception) {
            // ignore
        }

        silenceAudioAndVibration()

        try {
            vibrator?.cancel()
            vibrator = null
        } catch (e: Exception) {
            vibrator = null
        }

        // Clean up foreground notification
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.cancel(NOTIFICATION_ID)
        } catch (e: Exception) {
            // ignore
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.channel_ring_name),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = getString(R.string.channel_ring_desc)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                enableVibration(true)
                // Let MediaPlayer handle sound playback directly to prevent doubled sound
                setSound(null, null)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
}
