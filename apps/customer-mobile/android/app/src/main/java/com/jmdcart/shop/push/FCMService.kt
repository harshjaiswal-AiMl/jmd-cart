package com.jmdcart.shop.push

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.jmdcart.shop.MainActivity
import com.jmdcart.shop.MainApplication
import com.jmdcart.shop.R

class FCMService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Store token in SharedPreferences for device registration
        val prefs = getSharedPreferences("jmd_prefs", Context.MODE_PRIVATE)
        prefs.edit().putString("fcm_token", token).apply()
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val title = remoteMessage.notification?.title ?: remoteMessage.data["title"] ?: "JMD Cart"
        val body = remoteMessage.notification?.body ?: remoteMessage.data["body"] ?: ""
        val type = remoteMessage.data["type"] ?: "orderUpdates"
        val orderId = remoteMessage.data["orderId"]
        val screen = remoteMessage.data["screen"]

        val channelId = when (type) {
            "orderUpdates" -> MainApplication.CHANNEL_ORDER_UPDATES
            "backInStock" -> MainApplication.CHANNEL_STOCK_ALERTS
            else -> MainApplication.CHANNEL_OFFERS
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            if (orderId != null) {
                putExtra("orderId", orderId)
                data = Uri.parse("https://jmdcart.com/orders/$orderId")
            } else if (screen != null) {
                putExtra("screen", screen)
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(
                if (type == "orderUpdates") NotificationCompat.PRIORITY_HIGH
                else NotificationCompat.PRIORITY_DEFAULT
            )
            .setContentIntent(pendingIntent)
            .build()

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify((System.currentTimeMillis() % 10000).toInt(), notification)
    }
}
