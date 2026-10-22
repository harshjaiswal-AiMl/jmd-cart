// JMD Cart Shared Cart & Interaction Manager (Safe for both file:// and http://)
(function() {
  const DEFAULT_COUNT = 3;
  const DEFAULT_TOTAL = 1648;

  // In-memory fallback if localStorage is blocked by browser in file:/// mode
  const memoryStore = {
    jmd_cart_count: DEFAULT_COUNT,
    jmd_cart_total: DEFAULT_TOTAL
  };

  function safeGet(key, fallback) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch (e) {
      // Storage restricted or file:// security policy
    }
    return memoryStore[key] !== undefined ? memoryStore[key] : fallback;
  }

  function safeSet(key, value) {
    memoryStore[key] = value;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      // Storage restricted
    }
  }

  function getCartState() {
    let count = parseInt(safeGet('jmd_cart_count', DEFAULT_COUNT), 10);
    let total = parseInt(safeGet('jmd_cart_total', DEFAULT_TOTAL), 10);
    if (isNaN(count)) count = DEFAULT_COUNT;
    if (isNaN(total)) total = DEFAULT_TOTAL;
    return { count, total };
  }

  function setCartState(count, total) {
    if (count < 0) count = 0;
    if (total < 0) total = 0;
    safeSet('jmd_cart_count', count);
    safeSet('jmd_cart_total', total);
    updateCartBadges(count, total);
  }

  function updateCartBadges(count, total) {
    try {
      const badges = document.querySelectorAll('[data-cart-count], header a[data-path="cart"] .bg-secondary-container, #cart-badge');
      badges.forEach(b => {
        b.textContent = count;
      });

      const prices = document.querySelectorAll('[data-cart-total], header a[data-path="cart"] .font-price-md');
      prices.forEach(p => {
        p.textContent = '₹' + total.toLocaleString('en-IN');
      });

      const floatBar = document.getElementById('floating-cart-bar');
      const floatCount = document.getElementById('floating-cart-count');
      const floatTotal = document.getElementById('floating-cart-total');
      if (floatBar) {
        if (count > 0) {
          floatBar.classList.remove('hidden');
        } else {
          floatBar.classList.add('hidden');
        }
      }
      if (floatCount) floatCount.textContent = count;
      if (floatTotal) floatTotal.textContent = '₹' + total.toLocaleString('en-IN');
    } catch (e) {
      console.warn('Cart badge update caught:', e);
    }
  }

  // Toast Notification
  function showToast(message, actionHtml = '') {
    try {
      let toastContainer = document.getElementById('jmd-toast-container');
      if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'jmd-toast-container';
        toastContainer.className = 'fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(toastContainer);
      }

      const toast = document.createElement('div');
      toast.className = 'pointer-events-auto flex items-center justify-between gap-3 bg-primary text-on-primary px-4 py-3 rounded-xl shadow-2xl border border-primary-container transform transition-all duration-300 translate-y-4 opacity-0 max-w-md';
      toast.innerHTML = `
        <div class="flex items-center gap-2 text-sm font-medium">
          <span class="material-symbols-outlined text-[20px] text-secondary-fixed">check_circle</span>
          <span>${message}</span>
        </div>
        <div class="flex items-center gap-2">
          ${actionHtml}
          <button onclick="this.closest('div.pointer-events-auto').remove()" class="text-on-primary/70 hover:text-on-primary text-lg leading-none p-1">&times;</button>
        </div>
      `;

      toastContainer.appendChild(toast);
      setTimeout(() => {
        toast.classList.remove('translate-y-4', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
      }, 10);

      setTimeout(() => {
        if (toast.parentElement) {
          toast.classList.add('opacity-0', 'translate-y-2');
          setTimeout(() => toast.remove(), 300);
        }
      }, 4000);
    } catch (e) {
      console.warn('Toast display caught:', e);
    }
  }

  window.jmdAddToCart = function(name, price = 150, qty = 1) {
    const state = getCartState();
    const newCount = state.count + qty;
    const newTotal = state.total + (price * qty);
    setCartState(newCount, newTotal);
    showToast(`Added <strong>${name}</strong> to Cart!`, `<a href="checkout.html" class="bg-secondary text-on-secondary px-3 py-1 rounded-lg text-xs font-bold hover:bg-secondary-container hover:text-on-secondary-container transition-colors shadow">Checkout &rarr;</a>`);
  };

  window.jmdSetCartState = setCartState;
  window.jmdGetCartState = getCartState;
  window.jmdShowToast = showToast;

  function initCart() {
    const state = getCartState();
    updateCartBadges(state.count, state.total);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCart);
  } else {
    initCart();
  }
})();
