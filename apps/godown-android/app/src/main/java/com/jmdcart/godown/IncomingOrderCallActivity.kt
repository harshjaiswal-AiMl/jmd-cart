package com.jmdcart.godown

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class IncomingOrderCallActivity : AppCompatActivity() {

    companion object {
        var currentInstance: IncomingOrderCallActivity? = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        currentInstance = this

        // Wake screen and show over keyguard (phone call behavior)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            keyguardManager?.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }

        setContentView(R.layout.activity_incoming_order)

        val orderId = intent.getStringExtra(ContinuousRingtoneService.EXTRA_ORDER_ID) ?: ""
        val orderNumber = intent.getStringExtra(ContinuousRingtoneService.EXTRA_ORDER_NUMBER) ?: "New Order"
        val customerName = intent.getStringExtra(ContinuousRingtoneService.EXTRA_CUSTOMER_NAME) ?: "Customer"
        val amount = intent.getStringExtra(ContinuousRingtoneService.EXTRA_AMOUNT) ?: ""

        findViewById<TextView>(R.id.tvOrderNumber).text = orderNumber
        findViewById<TextView>(R.id.tvCustomerName).text = customerName
        findViewById<TextView>(R.id.tvAmount).text = amount

        // 1. ACCEPT Button: Stop ringtone, inform server, open app to order
        findViewById<Button>(R.id.btnAccept).setOnClickListener {
            ContinuousRingtoneService.stopRinging(this)

            if (orderId.isNotEmpty()) {
                DeviceRegistrationManager.acknowledgeAlert(this, orderId)
            }

            // Open Godown WebView to order
            val mainIntent = Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
                putExtra("orderId", orderId)
            }
            startActivity(mainIntent)
            finish()
        }

        // 2. SNOOZE 1 MINUTE Button
        findViewById<Button>(R.id.btnSnooze).setOnClickListener {
            ContinuousRingtoneService.stopRinging(this)

            if (orderId.isNotEmpty()) {
                DeviceRegistrationManager.snoozeAlert(this, orderId)
            }

            finish()
        }

        // 3. MUTE / DISMISS Button: Stop ringing only
        findViewById<Button>(R.id.btnDismiss).setOnClickListener {
            ContinuousRingtoneService.stopRinging(this)
            finish()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (currentInstance == this) {
            currentInstance = null
        }
    }
}
