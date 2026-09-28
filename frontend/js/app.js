/**
 * Main Application Script for Event-Driven E-Commerce Frontend
 */

// Sample Product Catalog
const PRODUCTS = [
  {
    id: "prod-cloud-hoodie",
    name: "AWS Solutions Architect Hoodie",
    category: "Apparel",
    price: 6500,
    currency: "LKR",
    icon: "🧥",
    description: "Premium fleece hoodie featuring embroidered AWS architecture icons."
  },
  {
    id: "prod-serverless-book",
    name: "Serverless Architecture Guide",
    category: "Books",
    price: 3800,
    currency: "LKR",
    icon: "📖",
    description: "Comprehensive blueprint for event-driven systems with EventBridge and SQS."
  },
  {
    id: "prod-eventbridge-pin",
    name: "EventBridge Enamel Pin",
    category: "Swag",
    price: 950,
    currency: "LKR",
    icon: "⚡",
    description: "Collectible glossy pin for cloud developers and event architects."
  },
  {
    id: "prod-mech-keyboard",
    name: "Mechanical Keyboard (RGB Hot-swap)",
    category: "Hardware",
    price: 14500,
    currency: "LKR",
    icon: "⌨️",
    description: "Tactile mechanical switches tuned for high-velocity DevOps engineering."
  },
  {
    id: "prod-cloud-mug",
    name: "Cloud Engineer Coffee Mug",
    category: "Accessories",
    price: 1800,
    currency: "LKR",
    icon: "☕",
    description: "Ceramic 15oz mug with 'There is no cloud, just someone else's computer'."
  },
  {
    id: "prod-desk-mat",
    name: "DevOps Architecture Desk Mat",
    category: "Accessories",
    price: 2600,
    currency: "LKR",
    icon: "🖥️",
    description: "Large desk pad printed with full event choreography and CI/CD pipelines."
  }
];

// Application State
const state = {
  cart: [],
  activeTab: "store",
  lastPlacedOrderId: null,
  simulatePaymentFailure: false,
  simulateNotifFailure: false
};

// DOM References
const elements = {
  productsGrid: document.getElementById("products-grid"),
  cartCount: document.getElementById("cart-count"),
  cartDrawer: document.getElementById("cart-drawer-overlay"),
  cartItemsList: document.getElementById("cart-items-list"),
  cartSubtotal: document.getElementById("cart-subtotal"),
  btnCheckout: document.getElementById("btn-checkout"),
  terminalLogs: document.getElementById("terminal-logs"),
  apiUrlInput: document.getElementById("api-url-input"),
  modeBadge: document.getElementById("mode-badge"),
  paymentFailToggle: document.getElementById("payment-fail-toggle"),
  notifFailToggle: document.getElementById("notif-fail-toggle"),
  trackerInput: document.getElementById("tracker-input"),
  trackerResult: document.getElementById("tracker-result")
};

// Initialize Application
function init() {
  renderProducts();
  setupEventListeners();
  setupApiListener();
  updateModeIndicator();

  // Load saved API URL if present
  if (apiService.baseUrl) {
    elements.apiUrlInput.value = apiService.baseUrl;
  }
}

// Render Products Grid
function renderProducts() {
  elements.productsGrid.innerHTML = PRODUCTS.map(product => `
    <div class="product-card">
      <div class="product-image-container">
        <span>${product.icon}</span>
      </div>
      <div class="product-info">
        <h3 class="product-title">${product.name}</h3>
        <p class="product-description">${product.description}</p>
        <div class="product-footer">
          <span class="product-price">${product.currency} ${product.price.toLocaleString()}</span>
          <button class="btn-add-cart" onclick="addToCart('${product.id}')">
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

// Cart Operations
window.addToCart = function(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const existing = state.cart.find(item => item.id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ ...product, quantity: 1 });
  }

  updateCartUI();
  openCart();
};

window.updateQty = function(productId, delta) {
  const item = state.cart.find(i => i.id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    state.cart = state.cart.filter(i => i.id !== productId);
  }

  updateCartUI();
};

function updateCartUI() {
  const totalCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  elements.cartCount.textContent = totalCount;
  elements.cartSubtotal.textContent = `LKR ${subtotal.toLocaleString()}`;

  if (state.cart.length === 0) {
    elements.cartItemsList.innerHTML = `<p style="color: var(--text-muted); text-align: center; margin-top: 2rem;">Your cart is empty.</p>`;
    elements.btnCheckout.disabled = true;
  } else {
    elements.cartItemsList.innerHTML = state.cart.map(item => `
      <div class="cart-item">
        <div style="font-size: 1.5rem;">${item.icon}</div>
        <div class="cart-item-info">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-price">${item.currency} ${item.price.toLocaleString()}</div>
        </div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="updateQty('${item.id}', -1)">-</button>
          <span>${item.quantity}</span>
          <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
        </div>
      </div>
    `).join("");
    elements.btnCheckout.disabled = false;
  }
}

function openCart() {
  elements.cartDrawer.classList.add("open");
}

function closeCart() {
  elements.cartDrawer.classList.remove("open");
}

// Navigation Tabs
window.switchTab = function(tabName) {
  state.activeTab = tabName;

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  document.querySelectorAll(".tab-content").forEach(content => {
    content.classList.toggle("active", content.id === `tab-${tabName}`);
  });
};

// Visualizer Reset
function resetVisualizer() {
  document.querySelectorAll(".flow-node").forEach(node => {
    node.className = "flow-node";
    const statusElem = node.querySelector(".node-status");
    if (statusElem) {
      statusElem.className = "node-status";
      statusElem.textContent = "IDLE";
    }
  });
}

function updateNodeState(nodeId, status, statusText) {
  const node = document.getElementById(`node-${nodeId}`);
  if (!node) return;

  node.className = `flow-node ${status}`;
  const badge = node.querySelector(".node-status");
  if (badge) {
    badge.className = `node-status ${status}`;
    badge.textContent = statusText || status.toUpperCase();
  }
}

// Log to Terminal Console
function logTerminal(source, message, type = "info") {
  const timestamp = new Date().toLocaleTimeString();
  const entry = document.createElement("div");
  entry.className = "log-entry";

  let typeClass = "log-msg";
  if (type === "success") typeClass = "log-success";
  if (type === "warn") typeClass = "log-warn";
  if (type === "error") typeClass = "log-error";

  entry.innerHTML = `
    <span class="log-time">[${timestamp}]</span> 
    <span class="log-src">[${source}]</span> 
    <span class="${typeClass}">${message}</span>
  `;

  elements.terminalLogs.appendChild(entry);
  elements.terminalLogs.scrollTop = elements.terminalLogs.scrollHeight;
}

// Hook API Service events to Visualizer and Terminal
function setupApiListener() {
  apiService.onEvent((eventType, data) => {
    if (eventType === "log") {
      logTerminal(data.source, data.message, data.type);
    } else if (eventType === "step:start") {
      updateNodeState(data.step, "active", "PROCESSING");
    } else if (eventType === "step:success") {
      updateNodeState(data.step, "success", "SUCCESS");
    } else if (eventType === "step:error") {
      updateNodeState(data.step, "error", data.error || "FAILED");
    }
  });
}

// Checkout Trigger
async function handleCheckout() {
  if (state.cart.length === 0) return;

  closeCart();
  switchTab("visualizer");
  resetVisualizer();

  const customerId = "customer-" + Math.floor(100 + Math.random() * 900);
  const items = state.cart.map(item => ({
    productId: item.id,
    quantity: item.quantity,
    price: item.price
  }));

  elements.btnCheckout.disabled = true;
  elements.btnCheckout.textContent = "Processing...";

  const flags = {
    simulatePaymentFailure: elements.paymentFailToggle.checked,
    simulateNotifFailure: elements.notifFailToggle.checked
  };

  logTerminal("Client", `Initiating checkout for customer ${customerId} (${items.length} items)...`, "info");

  try {
    const result = await apiService.createOrder({
      customerId,
      currency: "LKR",
      items
    }, flags);

    state.lastPlacedOrderId = result.orderId;
    elements.trackerInput.value = result.orderId;

    // Clear cart on successful submission
    state.cart = [];
    updateCartUI();
  } catch (err) {
    logTerminal("Checkout", `Checkout failed: ${err.message}`, "error");
  } finally {
    elements.btnCheckout.disabled = false;
    elements.btnCheckout.textContent = "Place Order";
  }
}

// Order Status Tracker
async function handleTrackOrder() {
  const orderId = elements.trackerInput.value.trim();
  if (!orderId) return;

  elements.trackerResult.className = "order-detail-card active";
  elements.trackerResult.innerHTML = `<p style="color: var(--text-muted);">Fetching order ${orderId}...</p>`;

  try {
    const data = await apiService.getOrder(orderId);
    const order = data.order || data;

    let badgeColor = "var(--accent-amber)";
    if (order.status === "COMPLETED") badgeColor = "var(--accent-green)";
    if (order.status === "PAYMENT_FAILED") badgeColor = "var(--accent-red)";

    elements.trackerResult.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h4 style="font-size: 1.1rem; font-family: var(--font-mono);">${order.orderId}</h4>
        <span style="background: ${badgeColor}; color: #000; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 700;">
          ${order.status}
        </span>
      </div>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">
        <strong>Customer:</strong> ${order.customerId}
      </p>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">
        <strong>Total Amount:</strong> ${order.currency || "LKR"} ${order.totalAmount?.toLocaleString()}
      </p>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">
        <strong>Created At:</strong> ${new Date(order.createdAt).toLocaleString()}
      </p>
      ${order.transactionId ? `
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">
          <strong>Transaction ID:</strong> <span style="font-family: var(--font-mono);">${order.transactionId}</span>
        </p>
      ` : ''}
    `;
  } catch (err) {
    elements.trackerResult.innerHTML = `
      <p style="color: var(--accent-red);">Failed to retrieve order: ${err.message}</p>
    `;
  }
}

function updateModeIndicator() {
  if (apiService.isLocalSimulation) {
    elements.modeBadge.className = "mode-badge";
    elements.modeBadge.innerHTML = "<span>🟢</span> Local Simulation Mode";
  } else {
    elements.modeBadge.className = "mode-badge live";
    elements.modeBadge.innerHTML = "<span>☁️</span> Live AWS Gateway";
  }
}

// Setup Event Listeners
function setupEventListeners() {
  document.getElementById("btn-cart").addEventListener("click", openCart);
  document.getElementById("btn-close-cart").addEventListener("click", closeCart);
  elements.cartDrawer.addEventListener("click", (e) => {
    if (e.target === elements.cartDrawer) closeCart();
  });

  elements.btnCheckout.addEventListener("click", handleCheckout);

  document.getElementById("btn-save-api").addEventListener("click", () => {
    const url = elements.apiUrlInput.value.trim();
    apiService.setBaseUrl(url);
    updateModeIndicator();
    logTerminal("System", url ? `Connected to live AWS API Gateway: ${url}` : "Switched to Local In-Browser Simulation mode", "info");
  });

  document.getElementById("btn-track").addEventListener("click", handleTrackOrder);
  document.getElementById("btn-clear-logs").addEventListener("click", () => {
    elements.terminalLogs.innerHTML = "";
    logTerminal("System", "Event log cleared.", "info");
  });
}

// Start app on DOM loaded
document.addEventListener("DOMContentLoaded", init);
