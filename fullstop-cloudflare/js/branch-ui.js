// js/branch-ui.js
// ============================================================
// Branch Dashboard — now backed by PHP API instead of localStorage
// ============================================================

// --- Custom Alert & Confirm Helpers -------------------------
window.showCustomAlert = function(message, title="Alert", type="info", onClose=null) {
    const modal = document.getElementById('custom-alert-modal');
    if (!modal) {
        alert(message);
        if (onClose) onClose();
        return;
    }

    document.getElementById('custom-alert-title').innerText = title;
    document.getElementById('custom-alert-msg').innerText = message;
    
    const icon = document.getElementById('custom-alert-icon');
    if (type === 'success') {
        icon.className = 'fa-solid fa-circle-check';
        icon.style.color = '#10B981';
    } else if (type === 'error') {
        icon.className = 'fa-solid fa-circle-xmark';
        icon.style.color = '#DC2626';
    } else {
        icon.className = 'fa-solid fa-circle-exclamation';
        icon.style.color = '#3B82F6';
    }

    // Replace button to completely unbind previous handlers and inline onclicks
    const oldBtn = modal.querySelector('button');
    const newBtn = oldBtn.cloneNode(true);
    newBtn.removeAttribute('onclick'); // strip the inline HTML onclick
    
    newBtn.onclick = function() {
        modal.style.display = 'none';
        if (typeof onClose === 'function') {
            onClose();
        }
    };
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);

    modal.style.display = 'flex';
};

window.showCustomConfirm = function(message, title="Confirm Action") {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        if (!modal) return resolve(confirm(message));

        document.getElementById('custom-confirm-title').innerText = title;
        document.getElementById('custom-confirm-msg').innerText = message;
        
        modal.style.display = 'flex';

        const btnOk = document.getElementById('btn-custom-confirm-ok');
        const btnCancel = document.getElementById('btn-custom-confirm-cancel');

        const cleanup = () => {
            modal.style.display = 'none';
            btnOk.onclick = null;
            btnCancel.onclick = null;
        };

        btnOk.onclick = () => { cleanup(); resolve(true); };
        btnCancel.onclick = () => { cleanup(); resolve(false); };
    });
};

// --- Auth Guard: verify session before anything renders ------
let currentBranch = null;

(async () => {
    const result = await API.session();
    if (!result || !result.success || result.data.role !== 'branch') {
        window.location.replace('system-portal.html');
        return;
    }
    currentBranch = result.data;
    initBranchUI();
})();

// --- Logout -------------------------------------------------
async function logoutBranch() {
    const modal = document.getElementById('logout-modal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    
    const confirmBtn = document.getElementById('btn-confirm-logout');
    confirmBtn.onclick = async () => {
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging out...';
        confirmBtn.disabled = true;
        
        await API.logout();
        sessionStorage.removeItem('fs_user');
        window.location.replace('system-portal.html');
    };
}

// ============================================================
// Initialize UI after auth check
// ============================================================
function initBranchUI() {
    // Personalize the UI
    const sidebarName = document.getElementById('sidebar-branch-name');
    const heroName    = document.getElementById('hero-branch-name');
    if (sidebarName) sidebarName.innerText = currentBranch.location.toUpperCase();
    if (heroName)    heroName.innerText    = currentBranch.location;

    // Sidebar toggle
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const mainSidebar      = document.getElementById('main-sidebar');
    const sidebarOverlay   = document.getElementById('sidebar-overlay');

    if (sidebarToggleBtn && mainSidebar) {
        sidebarToggleBtn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                mainSidebar.classList.toggle('active-mobile');
                if (sidebarOverlay) sidebarOverlay.classList.toggle('active');
            } else {
                mainSidebar.classList.toggle('collapsed');
            }
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebarMobile);
    }

    // Rush toggle styling
    const rushToggle = document.getElementById('rush-toggle');
    if (rushToggle) {
        rushToggle.addEventListener('change', function () {
            const displayDate = document.getElementById('delivery-date-display');
            const label       = document.getElementById('delivery-label');
            if (this.checked) {
                displayDate.style.color = '#DC2626';
                label.style.color       = '#DC2626';
            } else {
                displayDate.style.color = '#1E293B';
                label.style.color       = '#64748B';
            }
        });
    }

    // Load notification badge
    loadAnnouncements();

    // Load and render dynamic inventory
    loadDynamicInventory();
}

// ============================================================
// Dynamic Inventory Rendering
// ============================================================
async function loadDynamicInventory() {
    const container = document.getElementById('dynamic-inventory-container');
    if (!container) return;

    const result = await API.getInventory();
    if (!result || !result.success) {
        container.innerHTML = '<p style="text-align:center;color:#DC2626;">Failed to load inventory.</p>';
        return;
    }

    const items = result.data;
    if (items.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#64748B;">No inventory available.</p>';
        return;
    }

    // Group items by category
    const grouped = {};
    items.forEach(item => {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
    });

    let html = '';
    const categoryIcons = {
        'Main Items': 'fa-burger',
        'Cheese & Sauces': 'fa-bottle-droplet',
        'Packaging & Buns': 'fa-box-open',
        'Store Add-ons': 'fa-plus'
    };

    Object.keys(grouped).forEach(category => {
        const icon = categoryIcons[category] || 'fa-box';
        html += `<h3 class="category-header"><i class="fa-solid ${icon}"></i> ${category}</h3>`;
        html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">`;
        
        grouped[category].forEach(item => {
            // Replace spaces and special chars to make a valid ID
            const safeId = item.item_name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const price = parseFloat(item.unit_price || 0).toFixed(2);
            
            html += `
                <div class="item-card">
                    <div>
                        <h3 style="margin: 0; font-family: 'Rubik'; color: #1E293B;">${item.item_name}</h3>
                        <p style="font-size: 0.85rem; color: #64748B;">₱${price} / ${item.unit}</p>
                    </div>
                    <div class="qty-control">
                        <button class="qty-btn" onclick="updateQty('${safeId}', -1)">-</button>
                        <input type="number" id="qty-${safeId}" class="qty-input" value="0" data-name="${item.item_name}" data-price="${price}">
                        <button class="qty-btn" onclick="updateQty('${safeId}', 1)">+</button>
                    </div>
                </div>`;
        });
        
        html += `</div>`;
    });

    container.innerHTML = html;

    // Attach listeners to newly created inputs
    attachQtyListeners();
}

function attachQtyListeners() {
    document.querySelectorAll('.qty-input').forEach(input => {
        // Allow user to type directly
        input.setAttribute('min', '0');
        input.style.cursor = 'text';

        input.addEventListener('input', function () {
            // Numbers only — strip any non-digit characters
            this.value = this.value.replace(/[^0-9]/g, '');

            // Treat empty field as 0 for total calculation but keep blank so user can type
            const val = parseInt(this.value) || 0;

            // Update card highlight
            const card = this.closest('.item-card');
            if (card) val > 0 ? card.classList.add('has-order') : card.classList.remove('has-order');

            computeLiveTotal();
        });

        // On blur (leaving the field), fill empty with 0
        input.addEventListener('blur', function () {
            if (this.value === '' || isNaN(parseInt(this.value))) {
                this.value = 0;
                const card = this.closest('.item-card');
                if (card) card.classList.remove('has-order');
                computeLiveTotal();
            }
        });

        // Select all text when clicking into the field (easy to retype)
        input.addEventListener('focus', function () {
            this.select();
        });
    });
}

// ============================================================
// Helpers
// ============================================================
function closeSidebarMobile() {
    const mainSidebar    = document.getElementById('main-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (window.innerWidth <= 768) {
        if (mainSidebar)    mainSidebar.classList.remove('active-mobile');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    }
}



function formatCurrency(amount) {
    return parseFloat(amount).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
}

// ============================================================
// Live order total computation (pure frontend, prices are in HTML)
// ============================================================
function computeLiveTotal() {
    let grandTotal = 0;
    let selectedItemsHTML = '';
    
    document.querySelectorAll('.qty-input').forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
            const price = parseFloat(input.getAttribute('data-price')) || 0;
            const itemTotal = qty * price;
            grandTotal += itemTotal;
            
            selectedItemsHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; padding: 10px 15px; border-radius: 8px; border: 1px solid #E2E8F0;">
                    <div>
                        <span style="font-family: 'Rubik', sans-serif; font-size: 1.1rem; font-weight: 500; color: #1E293B;">${input.getAttribute('data-name')}</span>
                        <span style="margin-left: 10px; font-size: 0.9rem; color: #64748B; font-weight: bold;">x${qty}</span>
                    </div>
                    <div style="font-family: 'Rubik', sans-serif; color: #D31225; font-weight: bold; font-size: 1.1rem;">
                        ${formatCurrency(itemTotal)}
                    </div>
                </div>
            `;
        }
    });
    
    document.getElementById('live-total-display').innerText = formatCurrency(grandTotal);
    
    const displayElement = document.getElementById('delivery-date-display');
    if (displayElement) {
        if (selectedItemsHTML === '') {
            displayElement.innerHTML = '<span style="color: #94A3B8; font-style: italic; font-size: 0.9rem;">No items selected yet.</span>';
        } else {
            displayElement.innerHTML = selectedItemsHTML;
        }
    }
    
    return grandTotal;
}

function updateQty(itemId, change) {
    const inputField = document.getElementById(`qty-${itemId}`);
    if (!inputField) return;

    let newVal = (parseInt(inputField.value) || 0) + change;
    if (newVal < 0) newVal = 0;          // Floor at 0
    inputField.value = newVal;

    const card = inputField.closest('.item-card');
    if (card) newVal > 0 ? card.classList.add('has-order') : card.classList.remove('has-order');

    computeLiveTotal();
}

// ============================================================
// Order placement
// ============================================================
let pendingOrderSnapshot = null;

function placeOrder(event) {
    if (event) event.preventDefault();
    closeSidebarMobile();

    const receiptContainer = document.getElementById('receipt-items-container');
    let totalItems = 0, grandTotal = 0, itemsInThisOrder = [];

    if (receiptContainer) receiptContainer.innerHTML = '';

    document.querySelectorAll('.qty-input').forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
            totalItems++;
            const itemName  = input.getAttribute('data-name') || 'Item';
            const unitPrice = parseFloat(input.getAttribute('data-price'));
            const lineTotal = qty * unitPrice;
            grandTotal     += lineTotal;
            itemsInThisOrder.push({ item_name: itemName, quantity: qty, unit_price: unitPrice, line_total: lineTotal });

            if (receiptContainer) {
                receiptContainer.innerHTML += `<div class="receipt-item-row"><span>${qty}x ${itemName}</span><span>${formatCurrency(lineTotal)}</span></div>`;
            }
        }
    });

    if (totalItems === 0) {
        showCustomAlert('Please add at least 1 item to your order before submitting.', 'Empty Order', 'error');
        return;
    }

    const isRush = document.getElementById('rush-toggle')?.checked || false;
    const badge  = document.getElementById('receipt-type-badge');

    if (badge) {
        badge.innerText             = isRush ? 'RUSH ORDER' : 'STANDARD ORDER';
        badge.style.backgroundColor = isRush ? '#FEF2F2'    : '#F0FDF4';
        badge.style.color           = isRush ? '#DC2626'    : '#10B981';
        document.getElementById('receipt-date').innerText = isRush
            ? 'Delivery: SAME DAY / NEXT DAY'
            : `Delivery: ${document.getElementById('delivery-date-display').innerText}`;
    }

    if (document.getElementById('receipt-total-amount')) {
        document.getElementById('receipt-total-amount').innerText = formatCurrency(grandTotal);
    }

    pendingOrderSnapshot = {
        type:  isRush ? 'RUSH' : 'STANDARD',
        items: itemsInThisOrder,
    };

    const modal = document.getElementById('receipt-modal');
    if (modal) modal.style.display = 'flex';
}

function cancelOrder() {
    const modal = document.getElementById('receipt-modal');
    if (modal) modal.style.display = 'none';
    pendingOrderSnapshot = null;
}

async function closeReceipt() {
    const modal = document.getElementById('receipt-modal');
    if (modal) modal.style.display = 'none';

    if (!pendingOrderSnapshot) return;

    // Show a brief 'submitting' toast
    showToast('Submitting order...', 'success');

    const result = await API.placeOrder(pendingOrderSnapshot.type, pendingOrderSnapshot.items);
    pendingOrderSnapshot = null;

    if (result && result.success) {
        showToast('✅ Order Placed! HQ will review it shortly.', 'success');

        // Reset all qty inputs to 0
        document.querySelectorAll('.qty-input').forEach(input => {
            input.value = 0;
            const card = input.closest('.item-card');
            if (card) card.classList.remove('has-order');
        });

        const rushToggle = document.getElementById('rush-toggle');
        if (rushToggle) { rushToggle.checked = false; rushToggle.dispatchEvent(new Event('change')); }

        computeLiveTotal();
    } else {
        // Show a prominent alert so it's not missed
        const errMsg = result?.message || 'Failed to place order.';
        showCustomAlert(
            errMsg + '\n\nMake sure:\n' +
            '  • XAMPP Apache + MySQL are running\n' +
            '  • You visited setup.php at least once\n' +
            '  • You are on http://localhost/fullstop/ (not file://)',
            'Order Failed',
            'error'
        );
    }
}

// ============================================================
// Order History
// ============================================================
async function openHistory(event) {
    if (event) event.preventDefault();
    closeSidebarMobile();

    const historyContainer = document.getElementById('history-list-container');
    if (!historyContainer) return;

    historyContainer.innerHTML = '<p style="text-align:center;color:#64748B;margin-top:20px;">Loading...</p>';
    const histModal = document.getElementById('history-modal');
    if (histModal) histModal.style.display = 'flex';

    const result = await API.getOrders();
    const orders = (result && result.success) ? result.data : [];

    historyContainer.innerHTML = '';

    if (orders.length === 0) {
        historyContainer.innerHTML = `<p style="color:#64748B;text-align:center;margin-top:20px;">No orders yet. Start restocking!</p>`;
        return;
    }

    orders.forEach(order => {
        const typeColor   = order.type === 'RUSH' ? '#DC2626' : '#10B981';
        const isApproved  = order.status === 'Approved';
        const isCancelled = order.status === 'Cancelled';

        let statusBadge;
        if (isApproved) {
            statusBadge = `<span style="color:#10B981;font-size:0.8rem;font-weight:bold;"><i class="fa-solid fa-check-circle"></i> Approved by HQ</span>`;
        } else if (isCancelled) {
            statusBadge = `<span style="color:#94A3B8;font-size:0.8rem;font-weight:bold;"><i class="fa-solid fa-ban"></i> Cancelled</span>`;
        } else {
            statusBadge = `<span style="color:#F59E0B;font-size:0.8rem;font-weight:bold;"><i class="fa-solid fa-clock"></i> Pending Approval</span>`;
        }

        const cancelBtn = (!isApproved && !isCancelled)
            ? `<button onclick="deleteOrder(${order.id})" style="background:none;border:1px solid #DC2626;color:#DC2626;padding:2px 8px;border-radius:6px;font-size:0.7rem;cursor:pointer;font-weight:bold;"><i class="fa-solid fa-trash"></i> Cancel</button>`
            : '';

        let breakdownHTML = '';
        if (order.items) {
            order.items.forEach(item => {
                breakdownHTML += `
                    <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:#475569;padding:3px 0;border-bottom:1px dashed #E2E8F0;">
                        <span>${item.quantity}x ${item.item_name}</span>
                        <span>${formatCurrency(item.line_total)}</span>
                    </div>`;
            });
        }

        const formatted = formatCurrency(order.total_amount);

        historyContainer.innerHTML += `
            <div class="history-item">
                <div class="history-item-header">
                    <span>#${order.order_code}</span>
                    <span style="color:${typeColor};">${formatted}</span>
                </div>
                <div style="margin-bottom:5px;">${statusBadge}</div>
                <div style="font-size:0.85rem;color:#64748B;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <div>
                        <span>Placed: ${new Date(order.date_placed).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span><br>
                        <span style="color:#10B981;">Expected Delivery: ${order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'TBD'}</span>
                    </div>
                    <div style="display:flex;gap:10px;align-items:center;">
                        <span style="font-weight:bold;background:${order.type==='RUSH'?'#FEF2F2':'#F0FDF4'};color:${typeColor};padding:2px 8px;border-radius:12px;font-size:0.75rem;">${order.type}</span>
                        ${cancelBtn}
                    </div>
                </div>
                <div style="background:white;padding:10px;border-radius:8px;border:1px solid #E2E8F0;">
                    <strong style="font-size:0.75rem;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;">Items Ordered:</strong>
                    <div style="margin-top:5px;">${breakdownHTML}</div>
                </div>
            </div>`;
    });
}

function closeHistory() {
    const histModal = document.getElementById('history-modal');
    if (histModal) histModal.style.display = 'none';
}

async function deleteOrder(orderId) {
    if (!await showCustomConfirm(`Are you sure you want to cancel this order?`, 'Cancel Order')) return;

    const result = await API.cancelOrder(orderId);
    if (result && result.success) {
        showToast('Order Cancelled Successfully', 'warning');
        openHistory();
    } else {
        showCustomAlert(result?.message || 'Failed to cancel order.', 'Error', 'error');
    }
}

// ============================================================
// Toast notifications
// ============================================================
function showToast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast   = document.createElement('div');
    const bgColor = type === 'warning' ? '#DC2626' : '#10B981';
    const icon    = type === 'warning' ? 'fa-bolt' : 'fa-check-circle';
    toast.style.cssText = `background-color:${bgColor};color:white;padding:15px 25px;border-radius:8px;font-family:'Inter',sans-serif;box-shadow:0 10px 25px rgba(0,0,0,0.2);display:flex;align-items:center;gap:10px;animation:slideInRight 0.3s ease;margin-bottom:10px;`;
    toast.innerHTML     = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity    = '0';
        toast.style.transition = 'opacity 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// ============================================================
// Announcements
// ============================================================
async function loadAnnouncements() {
    const result = await API.getUnreadCount();
    const badge  = document.getElementById('notif-badge');
    if (!badge) return;

    if (result && result.success && result.data.unread_count > 0) {
        badge.style.display = 'flex';
        badge.innerText     = result.data.unread_count;

        // Auto-open the custom alert modal upon load if there are unread announcements
        if (!sessionStorage.getItem('notified_unread_' + result.data.unread_count)) {
            sessionStorage.setItem('notified_unread_' + result.data.unread_count, 'true');
            setTimeout(() => {
                const countElem = document.getElementById('unread-alert-count');
                const modal = document.getElementById('unread-alert-modal');
                if (countElem && modal) {
                    countElem.innerText = result.data.unread_count;
                    modal.style.display = 'flex';
                }
            }, 800);
        }
    } else {
        badge.style.display = 'none';
    }
}

async function openAnnouncements() {
    const container = document.getElementById('announcement-list-container');
    if (!container) return;

    container.innerHTML = '<p style="text-align:center;color:#64748B;padding:20px;">Loading...</p>';
    document.getElementById('announcement-modal').style.display = 'flex';

    const result        = await API.getAnnouncements();
    const announcements = (result && result.success) ? result.data : [];

    container.innerHTML = '';

    if (announcements.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#64748B;padding:20px;">No announcements from Main Office.</p>';
    } else {
        announcements.forEach(ann => {
            const dateStr = new Date(ann.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            container.innerHTML += `
                <div style="background:#F8FAFC;border-left:4px solid #D31225;padding:15px;margin-bottom:10px;border-radius:4px;">
                    <small style="color:#64748B;font-weight:bold;"><i class="fa-solid fa-clock"></i> ${dateStr}</small>
                    <p style="margin:5px 0 0 0;color:#1E293B;line-height:1.4;">${ann.message}</p>
                </div>`;
        });
    }

    // Mark all as read
    await API.markAllRead();
    loadAnnouncements(); // Refresh badge
}

// ============================================================
// Ingredient Search
// ============================================================
function handleIngredientSearch() {
    const query = document.getElementById('ingredient-search-input').value.toLowerCase();
    const container = document.getElementById('dynamic-inventory-container');
    if (!container) return;

    const headers = container.querySelectorAll('.category-header');
    
    headers.forEach(header => {
        const grid = header.nextElementSibling;
        if (!grid) return;
        
        let hasVisibleItem = false;
        const cards = grid.querySelectorAll('.item-card');
        
        cards.forEach(card => {
            const itemName = card.querySelector('h3').innerText.toLowerCase();
            if (itemName.includes(query)) {
                card.style.display = ''; // Fallback to CSS default (flex usually)
                hasVisibleItem = true;
            } else {
                card.style.display = 'none';
            }
        });
        
        if (hasVisibleItem) {
            header.style.display = 'block';
            grid.style.display = 'grid'; // restoring the inline display style
        } else {
            header.style.display = 'none';
            grid.style.display = 'none';
        }
    });
}