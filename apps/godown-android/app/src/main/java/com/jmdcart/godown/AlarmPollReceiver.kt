package com.jmdcart.godown

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager

/**
 * Hardware RTC Alarm Receiver.
 * Wakes the Linux kernel and CPU from deep sleep / Doze mode
 * so the godown background service can reliably poll orders.
 */
class AlarmPollReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wakeLock = pm?.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "jmdcart:alarm_poll_receiver_wake"
        )
        wakeLock?.acquire(15_000L) // 15s wake window

        try {
            val serviceIntent = Intent(context, GodownAlertWatcherService::class.java).apply {
                action = GodownAlertWatcherService.ACTION_ALARM_POLL
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            // Schedule the next RTC wakeup
            GodownAlertWatcherService.scheduleNextRtcWakeup(context)
        }
    }
}
