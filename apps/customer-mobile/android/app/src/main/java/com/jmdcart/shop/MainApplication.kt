package com.jmdcart.shop

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build

class MainApplication : Application() {

    companion object {
        const val CHANNEL_ORDER_UPDATES = "order_updates"
        const val CHANNEL_STOCK_ALERTS = "stock_alerts"
        const val CHANNEL_OFFERS = "offers"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(NotificationManager::class.java)

            // 1. Order Updates Channel (High Importance)
            val orderChannel = NotificationChannel(
                CHANNEL_ORDER_UPDATES,
                getString(R.string.channel_order_updates),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = getString(R.string.channel_order_desc)
                enableVibration(true)
                enableLights(true)
            }

            // 2. Stock Alerts Channel (Default Importance)
            val stockChannel = NotificationChannel(
                CHANNEL_STOCK_ALERTS,
                getString(R.string.channel_stock_alerts),
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = getString(R.string.channel_stock_desc)
            }

            // 3. Offers Channel (Low Importance, Opt-in)
            val offersChannel = NotificationChannel(
                CHANNEL_OFFERS,
                getString(R.string.channel_offers),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.channel_offers_desc)
            }

            notificationManager?.createNotificationChannels(
                listOf(orderChannel, stockChannel, offersChannel)
            )
        }
    }
}
