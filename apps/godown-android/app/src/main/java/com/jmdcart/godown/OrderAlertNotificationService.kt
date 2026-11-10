package com.jmdcart.godown

import android.content.Context
import android.content.Intent
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
            val contactPhone = data["contactPhone"] ?: ""
            val packagingSummary = data["packagingSummary"] ?: "📦 1 Dispatch Order"

            // 1. Acquire WakeLock to turn on the screen
            try {
                val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
                @Suppress("DEPRECATION")
                val wakeLock = powerManager.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
                    "jmdcart:incoming_order_wake"
                )
                wakeLock.acquire(30000) // 30 sec timeout
            } catch (e: Exception) {
                e.printStackTrace()
            }

            // 2. Start continuous ringing foreground service on ALARM stream
            ContinuousRingtoneService.startRinging(
                this,
                orderId,
                orderNumber,
                customerName,
                amount,
                contactPhone,
                packagingSummary
            )

            // 3. Directly launch IncomingOrderCallActivity over lockscreen
            try {
                val callIntent = Intent(this, IncomingOrderCallActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    putExtra(ContinuousRingtoneService.EXTRA_ORDER_ID, orderId)
                    putExtra(ContinuousRingtoneService.EXTRA_ORDER_NUMBER, orderNumber)
                    putExtra(ContinuousRingtoneService.EXTRA_CUSTOMER_NAME, customerName)
                    putExtra(ContinuousRingtoneService.EXTRA_AMOUNT, amount)
                    putExtra(ContinuousRingtoneService.EXTRA_PHONE, contactPhone)
                    putExtra(ContinuousRingtoneService.EXTRA_PACKAGING, packagingSummary)
                }
                startActivity(callIntent)
            } catch (e: Exception) {
                e.printStackTrace()
            }

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
