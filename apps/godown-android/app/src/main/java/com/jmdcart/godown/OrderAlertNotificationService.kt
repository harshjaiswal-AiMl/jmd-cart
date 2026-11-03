package com.jmdcart.godown

import android.content.Context
import android.os.PowerManager
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class OrderAlertNotificationService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val data = remoteMessage.data
        val type = data["type"] ?: "ORDER_ALERT"

        if (type == "ORDER_ALERT") {
            val orderId = data["orderId"] ?: ""
            val orderNumber = data["orderNumber"] ?: "New Order"
            val customerName = data["customerName"] ?: (remoteMessage.notification?.title ?: "JMD Order")
            val amount = data["amount"] ?: (remoteMessage.notification?.body ?: "")

            // 1. Acquire WakeLock to turn on the screen
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            val wakeLock = powerManager.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "jmdcart:incoming_order_wake"
            )
            wakeLock.acquire(30000) // 30 sec timeout

            // 2. Start continuous ringing foreground service on ALARM stream
            ContinuousRingtoneService.startRinging(
                this,
                orderId,
                orderNumber,
                customerName,
                amount
            )

            // Send heartbeat on incoming alert
            DeviceRegistrationManager.sendHeartbeat(this)

        } else if (type == "CANCEL_ALERT") {
            // Another warehouse manager accepted the order -> cancel ring immediately!
            ContinuousRingtoneService.stopRinging(this)

            // Dismiss full-screen activity if currently visible
            IncomingOrderCallActivity.currentInstance?.finish()
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Automatically register with backend
        DeviceRegistrationManager.registerWithBackend(this, token)
    }
}
