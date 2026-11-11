package com.jmdcart.godown

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONArray
import org.json.JSONObject

data class OrderAlertItem(
    val orderId: String,
    val orderNumber: String,
    val customerName: String,
    val contactPhone: String,
    val amount: String,
    val packagingSummary: String
)

class IncomingOrderCallActivity : AppCompatActivity() {

    private val orderQueue = mutableListOf<OrderAlertItem>()
    private var currentIndex = 0

    companion object {
        var currentInstance: IncomingOrderCallActivity? = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        currentInstance = this

        // 1. Wake screen and show over keyguard (phone call behavior)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            keyguardManager?.requestDismissKeyguard(this, null)
        }
        @Suppress("DEPRECATION")
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )

        setContentView(R.layout.activity_incoming_order)

        // Parse orders list (supports multiple orders queue)
        parseOrderQueue(intent)
        displayCurrentOrder()
        setupActionButtons()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        @Suppress("DEPRECATION")
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        intent?.let {
            parseOrderQueue(it)
            displayCurrentOrder()
        }
    }

    fun updateOrders(array: JSONArray) {
        runOnUiThread {
            val seenIds = mutableSetOf<String>()
            val newQueue = mutableListOf<OrderAlertItem>()
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val id = obj.optString("orderId")
                if (id.isEmpty() || !seenIds.add(id)) continue

                val num = obj.optString("orderNumber", "New Order")
                val cust = obj.optString("customerName", "Customer")
                val phone = obj.optString("contactPhone", "")
                val amtPaise = obj.optLong("amountPaise", 0L)
                val cartons = obj.optInt("cartonCount", 0)
                val loose = obj.optInt("looseCount", 0)
                val totalPcs = obj.optInt("totalPieces", 0)

                val amtStr = if (amtPaise > 0) "₹" + String.format("%,.2f", amtPaise / 100.0) else ""
                val packStr = "📦 $cartons Cartons • $loose Loose Pieces (Total: $totalPcs Pcs)"

                newQueue.add(OrderAlertItem(id, num, cust, phone, amtStr, packStr))
            }
            if (newQueue.isNotEmpty()) {
                orderQueue.clear()
                orderQueue.addAll(newQueue)
                displayCurrentOrder()
            }
        }
    }

    private fun parseOrderQueue(intent: Intent) {
        orderQueue.clear()
        val seenIds = mutableSetOf<String>()
        val multiOrdersJson = intent.getStringExtra(ContinuousRingtoneService.EXTRA_MULTI_ORDERS_JSON)

        if (!multiOrdersJson.isNullOrEmpty()) {
            try {
                val array = JSONArray(multiOrdersJson)
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    val id = obj.optString("orderId")
                    if (id.isEmpty() || !seenIds.add(id)) continue

                    val num = obj.optString("orderNumber", "New Order")
                    val cust = obj.optString("customerName", "Customer")
                    val phone = obj.optString("contactPhone", "")
                    val amtPaise = obj.optLong("amountPaise", 0L)
                    val cartons = obj.optInt("cartonCount", 0)
                    val loose = obj.optInt("looseCount", 0)
                    val totalPcs = obj.optInt("totalPieces", 0)

                    val amtStr = if (amtPaise > 0) "₹" + String.format("%,.2f", amtPaise / 100.0) else ""
                    val packStr = "📦 $cartons Cartons • $loose Loose Pieces (Total: $totalPcs Pcs)"

                    orderQueue.add(OrderAlertItem(id, num, cust, phone, amtStr, packStr))
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        if (orderQueue.isEmpty()) {
            val orderId = intent.getStringExtra(ContinuousRingtoneService.EXTRA_ORDER_ID) ?: ""
            val orderNumber = intent.getStringExtra(ContinuousRingtoneService.EXTRA_ORDER_NUMBER) ?: "New Order"
            val customerName = intent.getStringExtra(ContinuousRingtoneService.EXTRA_CUSTOMER_NAME) ?: "Customer"
            val amount = intent.getStringExtra(ContinuousRingtoneService.EXTRA_AMOUNT) ?: ""
            val phone = intent.getStringExtra(ContinuousRingtoneService.EXTRA_PHONE) ?: ""
            val pack = intent.getStringExtra(ContinuousRingtoneService.EXTRA_PACKAGING) ?: "📦 1 Dispatch Order"

            orderQueue.add(OrderAlertItem(orderId, orderNumber, customerName, phone, amount, pack))
        }

        currentIndex = 0
    }

    private fun displayCurrentOrder() {
        if (orderQueue.isEmpty()) {
            finish()
            return
        }

        val totalCount = orderQueue.size
        val tvBadge = findViewById<TextView>(R.id.tvOrderBadge)
        val llSingleCard = findViewById<android.widget.LinearLayout>(R.id.llSingleOrderCard)
        val llMultiContainer = findViewById<android.widget.LinearLayout>(R.id.llMultiOrdersContainer)
        val tvNextPreview = findViewById<TextView>(R.id.tvNextOrderPreview)
        val btnAccept = findViewById<Button>(R.id.btnAccept)
        val btnSnooze = findViewById<Button>(R.id.btnSnooze)

        if (totalCount > 1) {
            tvBadge.text = "🚨 $totalCount NEW ORDERS PENDING 🚨"
            llSingleCard.visibility = View.GONE
            tvNextPreview.visibility = View.GONE
            llMultiContainer.visibility = View.VISIBLE
            llMultiContainer.removeAllViews()

            btnAccept.text = "✅ ACCEPT ALL ($totalCount ORDERS) & PACK"
            btnSnooze.text = "⏰ SNOOZE ALL (5 MINUTES)"

            for ((idx, item) in orderQueue.withIndex()) {
                val orderCard = android.widget.LinearLayout(this).apply {
                    orientation = android.widget.LinearLayout.VERTICAL
                    setBackgroundResource(R.drawable.bg_order_item_card)
                    setPadding(36, 28, 36, 28)
                    val lp = android.widget.LinearLayout.LayoutParams(
                        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        setMargins(0, 0, 0, 18)
                    }
                    layoutParams = lp
                }

                // Header row: Order Number + Amount
                val headerRow = android.widget.LinearLayout(this).apply {
                    orientation = android.widget.LinearLayout.HORIZONTAL
                    layoutParams = android.widget.LinearLayout.LayoutParams(
                        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
                    )
                }

                val tvNum = TextView(this).apply {
                    text = "${idx + 1}. ${item.orderNumber}"
                    textSize = 17f
                    setTextColor(android.graphics.Color.parseColor("#F59E0B"))
                    setTypeface(null, android.graphics.Typeface.BOLD)
                    layoutParams = android.widget.LinearLayout.LayoutParams(0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                }
                val tvAmt = TextView(this).apply {
                    text = item.amount
                    textSize = 17f
                    setTextColor(android.graphics.Color.parseColor("#10B981"))
                    setTypeface(null, android.graphics.Typeface.BOLD)
                }
                headerRow.addView(tvNum)
                headerRow.addView(tvAmt)
                orderCard.addView(headerRow)

                // Customer row
                val tvCust = TextView(this).apply {
                    text = item.customerName
                    textSize = 15f
                    setTextColor(android.graphics.Color.parseColor("#E2E8F0"))
                    setTypeface(null, android.graphics.Typeface.BOLD)
                    setPadding(0, 8, 0, 0)
                }
                orderCard.addView(tvCust)

                // Phone (if present)
                if (item.contactPhone.isNotEmpty()) {
                    val tvPhone = TextView(this).apply {
                        text = "📞 Tap to Call: ${item.contactPhone}"
                        textSize = 13f
                        setTextColor(android.graphics.Color.parseColor("#93C5FD"))
                        setPadding(0, 6, 0, 0)
                        setOnClickListener {
                            try {
                                startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${item.contactPhone}")))
                            } catch (e: Exception) {}
                        }
                    }
                    orderCard.addView(tvPhone)
                }

                // Packaging row
                val tvPack = TextView(this).apply {
                    text = item.packagingSummary
                    textSize = 13f
                    setTextColor(android.graphics.Color.parseColor("#94A3B8"))
                    setPadding(0, 6, 0, 0)
                }
                orderCard.addView(tvPack)

                llMultiContainer.addView(orderCard)
            }
        } else {
            // Single Order Display
            tvBadge.text = "🚨 INCOMING DISPATCH ORDER 🚨"
            llMultiContainer.visibility = View.GONE
            llSingleCard.visibility = View.VISIBLE
            tvNextPreview.visibility = View.GONE

            btnAccept.text = "✅ ACCEPT & PACK (STOP RING)"
            btnSnooze.text = "⏰ SNOOZE 5 MINUTES"

            val item = orderQueue[0]
            findViewById<TextView>(R.id.tvOrderNumber).text = item.orderNumber
            findViewById<TextView>(R.id.tvCustomerName).text = item.customerName

            val tvPhone = findViewById<TextView>(R.id.tvContactPhone)
            if (item.contactPhone.isNotEmpty()) {
                tvPhone.text = "📞 Tap to Call: ${item.contactPhone}"
                tvPhone.visibility = View.VISIBLE
                tvPhone.setOnClickListener {
                    try {
                        startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${item.contactPhone}")))
                    } catch (e: Exception) {}
                }
            } else {
                tvPhone.visibility = View.GONE
            }

            findViewById<TextView>(R.id.tvPackagingSummary).text = item.packagingSummary
            findViewById<TextView>(R.id.tvAmount).text = item.amount
        }
    }

    private fun setupActionButtons() {
        // 1. ACCEPT ALL Button
        findViewById<Button>(R.id.btnAccept).setOnClickListener {
            ContinuousRingtoneService.stopRinging(this)
            for (order in orderQueue) {
                if (order.orderId.isNotEmpty()) {
                    GodownAlertWatcherService.acknowledgeOrderLocally(order.orderId)
                    DeviceRegistrationManager.acknowledgeAlert(this, order.orderId)
                }
            }
            val firstOrderId = orderQueue.firstOrNull()?.orderId ?: ""
            orderQueue.clear()

            val mainIntent = Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                putExtra("tab", "orders")
                putExtra("orderId", firstOrderId)
            }
            startActivity(mainIntent)
            finish()
        }

        // 2. SNOOZE ALL (5 MINUTES) Button
        findViewById<Button>(R.id.btnSnooze).setOnClickListener {
            // 1. Instantly silence sound and vibration in 0ms
            ContinuousRingtoneService.stopRinging(this)

            // 2. Snooze all active pending alerts in the queue for 5 minutes
            for (order in orderQueue) {
                if (order.orderId.isNotEmpty()) {
                    GodownAlertWatcherService.snoozeOrderLocally(order.orderId, 300)
                    DeviceRegistrationManager.snoozeAlert(this, order.orderId, 300)
                }
            }
            orderQueue.clear()

            Toast.makeText(this, "All orders snoozed for 5 minutes", Toast.LENGTH_SHORT).show()
            finish()
        }

        // 3. MUTE RINGTONE (Silences sound only without dismissing screen)
        findViewById<Button>(R.id.btnDismiss).setOnClickListener {
            ContinuousRingtoneService.muteSoundOnly(this)
            Toast.makeText(this, "Ringtone muted", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Pressing physical Volume Up or Volume Down silences the ringtone immediately (like a real phone call)
     */
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            ContinuousRingtoneService.muteSoundOnly(this)
            Toast.makeText(this, "Ringtone muted", Toast.LENGTH_SHORT).show()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (currentInstance == this) {
            currentInstance = null
        }
    }
}
