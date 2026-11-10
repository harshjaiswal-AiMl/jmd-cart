package com.jmdcart.godown

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            // 1. Re-affirm heartbeat and device status on phone restart
            DeviceRegistrationManager.sendHeartbeat(context)

            // 2. Start always-on background alert watcher service
            GodownAlertWatcherService.startService(context)
        }
    }
}
