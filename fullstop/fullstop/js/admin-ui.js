// js/admin-ui.js
// ============================================================
// Admin Dashboard
// ============================================================

// --- Global Click Listeners -----------------------------------
document.addEventListener('click', function() {
    document.querySelectorAll('.action-dropdown').forEach(el => el.classList.add('d-none'));
});

// --- Custom Alert & Confirm Helpers -------------------------
window.showCustomAlert = function (message, title = "Alert", type = "info", onClose = null) {
    const modal = document.getElementById('custom-alert-modal');
    if (!modal) {
        alert(message);
        if (onClose) onClose();
        return;
    }

    document.getElementById('custom-alert-title').innerText = title;
    document.getElementById('custom-alert-msg').innerHTML = message;

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

    const oldBtn = modal.querySelector('button');
    const newBtn = oldBtn.cloneNode(true);
    newBtn.removeAttribute('onclick'); // strip the inline HTML onclick

    newBtn.onclick = function () {
        modal.classList.add('d-none');
        if (typeof onClose === 'function') {
            onClose();
        }
    };
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);

    modal.classList.remove('d-none');
};

window.showCustomConfirm = function (message, title = "Confirm Action") {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        if (!modal) return resolve(confirm(message));

        document.getElementById('custom-confirm-title').innerText = title;
        document.getElementById('custom-confirm-msg').innerText = message;

        modal.classList.remove('d-none');

        const btnOk = document.getElementById('btn-custom-confirm-ok');
        const btnCancel = document.getElementById('btn-custom-confirm-cancel');

        const cleanup = () => {
            modal.classList.add('d-none');
            btnOk.onclick = null;
            btnCancel.onclick = null;
        };

        btnOk.onclick = () => { cleanup(); resolve(true); };
        btnCancel.onclick = () => { cleanup(); resolve(false); };
    });
};

// --- Auth Guard: verify session before anything renders ------
(async () => {
    const result = await API.session();
    if (!result || !result.success || result.data.role !== 'admin') {
        window.location.replace('system-portal.html');
    }
})();

// --- Logout -------------------------------------------------
async function logoutAdmin() {
    const modal = document.getElementById('logout-modal');
    if (!modal) return;

    modal.classList.remove('d-none');

    const confirmBtn = document.getElementById('btn-confirm-logout');
    confirmBtn.onclick = async () => {
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging out...';
        confirmBtn.disabled = true;

        await API.logout();
        sessionStorage.removeItem('fs_user');
        window.location.replace('system-portal.html');
    };
}

// --- Chart instance tracker ---------------------------------
let demandChart7Instance = null;
let demandChart30Instance = null;
let globalAllOrders = null;

// ============================================================
// Password Generator
// ============================================================
function regeneratePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const specials = '@#$!';
    let password = '';
    // Guarantee at least one uppercase, one number, one special
    password += chars[Math.floor(Math.random() * 26)];           // uppercase
    password += chars[26 + Math.floor(Math.random() * 26)];      // lowercase
    password += chars[52 + Math.floor(Math.random() * 8)];       // number
    password += specials[Math.floor(Math.random() * specials.length)]; // special
    for (let i = 4; i < 8; i++) {
        password += chars[Math.floor(Math.random() * chars.length)];
    }
    // Shuffle
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    const pinInput = document.getElementById('new-branch-pin');
    if (pinInput) pinInput.value = password;
}

// ============================================================
// DOMContentLoaded — Bootstrap everything
// ============================================================
document.addEventListener('DOMContentLoaded', () => {

    // Sidebar toggle
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const mainSidebar = document.getElementById('main-sidebar');
    if (sidebarToggleBtn && mainSidebar) {
        sidebarToggleBtn.onclick = () => {
            if (window.innerWidth <= 768) mainSidebar.classList.toggle('active-mobile');
            else mainSidebar.classList.toggle('collapsed');
        };
    }

    // Add Branch modal
    const btnAddBranch = document.getElementById('btn-add-branch');
    const modalAddBranch = document.getElementById('add-branch-modal');
    if (btnAddBranch) {
        btnAddBranch.onclick = () => {
            // Reset form and generate a fresh password each time modal opens
            document.getElementById('new-franchisee').value = '';
            document.getElementById('new-location').value = '';
            document.getElementById('new-branch-id').value = '';
            regeneratePassword();
            modalAddBranch.classList.remove('d-none');
        };
    }

    const closeModalBtn = document.getElementById('close-modal');
    if (closeModalBtn) closeModalBtn.onclick = () => modalAddBranch.classList.add('d-none');

    // Create Branch form
    const btnCreateBranch = document.getElementById('btn-create-branch');
    if (btnCreateBranch) {
        btnCreateBranch.onclick = async function (e) {
            e.preventDefault();
            const name = document.getElementById('new-franchisee').value.trim();
            const location = document.getElementById('new-location').value.trim();
            const password = document.getElementById('new-branch-pin').value.trim();

            if (!name || !location) return showCustomAlert('Fill in Franchisee Name and Location!');
            if (!password) return showCustomAlert('Password cannot be empty. Click the refresh icon to generate one.');

            btnCreateBranch.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';
            btnCreateBranch.disabled = true;

            const result = await API.createBranch(name, location, password);

            if (result && result.success) {
                const d = result.data;
                // Show the generated Login ID in the modal field
                document.getElementById('new-branch-id').value = d.login_id;
                document.getElementById('new-branch-id').style.color = '#D31225';
                document.getElementById('new-branch-id').style.fontWeight = 'bold';
                document.getElementById('new-branch-id').style.background = '#FEF2F2';
                document.getElementById('new-branch-id').style.borderColor = '#D31225';
                document.getElementById('new-branch-id').style.fontStyle = 'normal';

                // Show a clean summary popup
                const successHTML = `
                    <div style="background: #F8FAFC; padding: 20px; border-radius: 12px; border: 1px solid #E2E8F0; margin-top: 10px; text-align: left;">
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #E2E8F0; padding-bottom:10px; margin-bottom:15px;">
                            <span style="font-weight:600; color:#1E293B; font-size: 1.1rem;"><i class="fa-solid fa-location-dot" style="color:#D31225; margin-right:8px;"></i>${d.location}</span>
                        </div>
                        
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                            <div>
                                <div style="font-size:0.75rem; color:#64748B; text-transform:uppercase; font-weight:bold;">Owner</div>
                                <div style="color:#0F172A; font-weight:500;">${d.name}</div>
                            </div>
                            <div>
                                <div style="font-size:0.75rem; color:#64748B; text-transform:uppercase; font-weight:bold;">Role</div>
                                <div style="color:#0F172A; font-weight:500;">Franchisee</div>
                            </div>
                            <div style="grid-column: span 2; background:#FEF2F2; padding:15px; border-radius:8px; border: 1px solid #FECACA;">
                                <div style="font-size:0.75rem; color:#DC2626; text-transform:uppercase; font-weight:bold; margin-bottom:10px;">Login Credentials</div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                                    <span style="color:#64748B; font-size:0.85rem; font-weight:500;">Login ID:</span>
                                    <span style="font-family:monospace; font-weight:bold; color:#1E293B; font-size:1.1rem; background:#fff; padding:4px 10px; border-radius:6px; border:1px solid #E2E8F0;">${d.login_id}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="color:#64748B; font-size:0.85rem; font-weight:500;">Password:</span>
                                    <span style="font-family:monospace; font-weight:bold; color:#1E293B; font-size:1.1rem; background:#fff; padding:4px 10px; border-radius:6px; border:1px solid #E2E8F0;">${d.password}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div style="background:#FFFBEB; border:1px solid #FDE68A; padding:12px; border-radius:8px; display:flex; gap:10px; align-items:flex-start;">
                            <i class="fa-solid fa-triangle-exclamation" style="color:#F59E0B; margin-top:2px;"></i>
                            <span style="font-size:0.85rem; color:#92400E; line-height:1.4;">Please write these credentials down and securely provide them to the franchisee.</span>
                        </div>
                    </div>`;
                    
                showCustomAlert(successHTML, 'Branch Account Created!', 'success');

                await renderBranchGrid();
                modalAddBranch.classList.add('d-none');
            } else {
                showCustomAlert(result?.message || 'Failed to create branch. Make sure the database is set up (run setup.php first).');
            }

            btnCreateBranch.innerHTML = '<i class="fa-solid fa-store"></i> Create Branch Account';
            btnCreateBranch.disabled = false;
        };
    }

    // Broadcast modal
    const btnBroadcast = document.getElementById('btn-broadcast');
    if (btnBroadcast) {
        btnBroadcast.onclick = () => document.getElementById('broadcast-modal').classList.remove('d-none');
    }

    // Load everything
    loadBranchOrders();
    renderBranchGrid();
    renderInventory();
    loadAdminInquiries();
});

// ============================================================
// View Switcher
// ============================================================
function switchView(viewId) {
    document.querySelectorAll('.workspace').forEach(el => el.classList.add('d-none'));
    document.getElementById(viewId).classList.remove('d-none');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    if (viewId === 'main-view') {
        document.getElementById('nav-dashboard').classList.add('active');
    } else if (viewId === 'inventory-view') {
        document.getElementById('nav-inventory').classList.add('active');
        renderInventory();
    } else if (viewId === 'inquiry-view') {
        document.getElementById('nav-inquiry').classList.add('active');
        loadAdminInquiries();
    } else if (viewId === 'terminated-branches-view') {
        loadTerminatedBranches();
    }
}

// ============================================================
// Inventory
// ============================================================
let globalInventoryData = [];

async function renderInventory() {
    const tableBody = document.getElementById('inventory-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#64748B;">Loading inventory...</td></tr>`;

    const result = await API.getInventory();
    if (!result || !result.success) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#DC2626;">Failed to load inventory.</td></tr>`;
        return;
    }

    globalInventoryData = result.data;
    populateInventoryTable(globalInventoryData);
    if (typeof renderDemandCharts === 'function') renderDemandCharts();
}

function filterMainInventory() {
    const query = document.getElementById('main-inventory-search').value.toLowerCase();
    const filtered = globalInventoryData.filter(item =>
        item.item_name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
    populateInventoryTable(filtered);
}

function populateInventoryTable(items) {
    const tableBody = document.getElementById('inventory-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (items.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#64748B;">No items found.</td></tr>`;
        return;
    }

    items.forEach(item => {
        let statusClass, statusText;
        if (item.stock <= 0) { statusClass = 'inv-status-crit'; statusText = 'Out of Stock'; }
        else if (item.stock <= item.threshold) { statusClass = 'inv-status-low'; statusText = 'Low Stock'; }
        else { statusClass = 'inv-status-good'; statusText = 'Good'; }

        tableBody.innerHTML += `
            <tr>
                <td style="font-weight:600;">${item.item_name}</td>
                <td style="color:#64748B;">${item.category}</td>
                <td style="font-weight:bold;font-size:1.1rem;color:#1E293B;">${Number(item.stock).toLocaleString()}</td>
                <td style="color:#64748B;">${item.unit}</td>
                <td style="font-weight:bold;color:#D31225;">₱${parseFloat(item.unit_price || 0).toFixed(2)}</td>
                <td><span class="${statusClass}">${statusText}</span></td>
                <td>
                    <button class="action-btn-sm" style="background:#10B981;" onclick="openAddStockModal('${item.item_name.replace(/'/g, "\\'")}', ${item.stock})">
                        <i class="fa-solid fa-plus" style="margin-right:3px;"></i>Add Stock
                    </button>
                    <button class="action-btn-sm" style="background:#3B82F6;margin-left:5px;" onclick="openEditPriceModal('${item.item_name.replace(/'/g, "\\'")}', ${item.unit_price || 0})">
                        <i class="fa-solid fa-tag" style="margin-right:3px;"></i>Price
                    </button>
                </td>
            </tr>`;
    });
}

async function resetInventory() {
    if (!await showCustomConfirm('Are you sure you want to reset all stocks to maximum capacity?')) return;

    const result = await API.restock();
    if (result && result.success) {
        showCustomAlert('Inventory Restocked!');
        renderInventory();
    } else {
        showCustomAlert(result?.message || 'Failed to restock inventory.');
    }
}

// ============================================================
// Add New Item Modal
// ============================================================
function openAddItemModal() {
    // Clear fields
    ['new-item-name', 'new-item-stock', 'new-item-max', 'new-item-threshold', 'new-item-price'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const unitEl = document.getElementById('new-item-unit');
    if (unitEl) unitEl.value = 'pcs'; // default
    document.getElementById('add-item-modal').classList.remove('d-none');
}

async function saveNewItem() {
    const name = document.getElementById('new-item-name').value.trim();
    const category = document.getElementById('new-item-category').value;
    const stock = parseInt(document.getElementById('new-item-stock').value) || 0;
    const unit = document.getElementById('new-item-unit').value || 'pcs';
    const price = parseFloat(document.getElementById('new-item-price').value) || 0.00;

    const maxStock = parseInt(document.getElementById('new-item-max').value) || stock;
    const threshold = parseInt(document.getElementById('new-item-threshold').value) || Math.max(1, Math.floor(stock * 0.2));

    if (!name) return showCustomAlert('Please enter an item name.');

    const btn = document.getElementById('btn-save-new-item');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;

    const result = await apiFetch('/inventory.php?action=add_item', 'POST', {
        item_name: name, category, stock, max_stock: maxStock, unit, unit_price: price, threshold
    });

    if (result && result.success) {
        showCustomAlert(`✅ "${name}" added to inventory!`);
        document.getElementById('add-item-modal').classList.add('d-none');
        renderInventory();
    } else {
        showCustomAlert(result?.message || 'Failed to add item.');
    }

    btn.innerHTML = '<i class="fa-solid fa-plus"></i> Add to Inventory';
    btn.disabled = false;
}

// ============================================================
// Add Stock Modal (per item)
// ============================================================
function openAddStockModal(itemName, currentStock) {
    document.getElementById('add-stock-item-name').value = itemName;
    document.getElementById('add-stock-label').textContent =
        `📦 ${itemName}  —  Current stock: ${Number(currentStock).toLocaleString()}`;
    document.getElementById('add-stock-qty').value = '';
    document.getElementById('add-stock-modal').classList.remove('d-none');
    setTimeout(() => document.getElementById('add-stock-qty').focus(), 100);
}

async function saveAddStock() {
    const itemName = document.getElementById('add-stock-item-name').value;
    const qty = parseInt(document.getElementById('add-stock-qty').value) || 0;

    if (!itemName) return;
    if (qty <= 0) return showCustomAlert('Please enter a quantity greater than 0.');

    const btn = document.getElementById('btn-save-add-stock');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;

    const result = await apiFetch('/inventory.php?action=add_stock', 'POST', {
        item_name: itemName, quantity: qty
    });

    if (result && result.success) {
        showCustomAlert(`✅ Stock added! ${itemName} now has ${Number(result.data.new_stock).toLocaleString()} units.`);
        document.getElementById('add-stock-modal').classList.add('d-none');
        renderInventory();
    } else {
        showCustomAlert(result?.message || 'Failed to add stock.');
    }

    btn.innerHTML = '<i class="fa-solid fa-plus"></i> Confirm Add Stock';
    btn.disabled = false;
}

// ============================================================
// Edit Price Modal (per item)
// ============================================================
function openEditPriceModal(itemName, currentPrice) {
    document.getElementById('edit-price-item-name').value = itemName;
    document.getElementById('edit-price-label').textContent = `🏷️ ${itemName}`;
    document.getElementById('edit-price-val').value = parseFloat(currentPrice).toFixed(2);
    document.getElementById('edit-price-modal').classList.remove('d-none');
    setTimeout(() => document.getElementById('edit-price-val').focus(), 100);
}

async function saveEditPrice() {
    const itemName = document.getElementById('edit-price-item-name').value;
    const price = parseFloat(document.getElementById('edit-price-val').value);

    if (!itemName) return;
    if (isNaN(price) || price < 0) return showCustomAlert('Please enter a valid price (0 or greater).');

    const btn = document.getElementById('btn-save-edit-price');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;

    const result = await apiFetch('/inventory.php?action=update_price', 'POST', {
        item_name: itemName, unit_price: price
    });

    if (result && result.success) {
        showCustomAlert(`✅ Price updated! ${itemName} is now ₱${price.toFixed(2)}.`);
        document.getElementById('edit-price-modal').classList.add('d-none');
        renderInventory();
    } else {
        showCustomAlert(result?.message || 'Failed to update price.');
    }

    btn.innerHTML = '<i class="fa-solid fa-check"></i> Save Price';
    btn.disabled = false;
}

// ============================================================
// Delete Item Modal
// ============================================================
let allInventoryItemsForDelete = [];

async function openDeleteItemModal() {
    const list = document.getElementById('delete-item-list');
    const search = document.getElementById('delete-search-input');

    search.value = '';
    list.innerHTML = '<p style="padding:20px;text-align:center;color:#64748B;">Loading items...</p>';
    document.getElementById('delete-item-modal').classList.remove('d-none');

    const result = await API.getInventory();
    if (!result || !result.success) {
        list.innerHTML = '<p style="padding:20px;text-align:center;color:#DC2626;">Failed to load items.</p>';
        return;
    }

    allInventoryItemsForDelete = result.data;
    renderDeleteList(allInventoryItemsForDelete);
    setTimeout(() => search.focus(), 100);
}

function renderDeleteList(items) {
    const list = document.getElementById('delete-item-list');
    list.innerHTML = '';

    if (items.length === 0) {
        list.innerHTML = '<p style="padding:20px;text-align:center;color:#64748B;">No items found.</p>';
        return;
    }

    items.forEach(item => {
        const escapedName = item.item_name.replace(/'/g, "\\'");
        list.innerHTML += `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 15px;border-bottom:1px solid #F1F5F9;transition:0.2s;" onmouseover="this.style.background='#FEF2F2'" onmouseout="this.style.background='transparent'">
                <div>
                    <div style="font-weight:600;color:#1E293B;">${item.item_name}</div>
                    <div style="font-size:0.8rem;color:#64748B;">${item.category} • Stock: ${item.stock}</div>
                </div>
                <button class="action-btn-sm" style="background:#DC2626;" onclick="confirmDeleteItem('${escapedName}')">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            </div>`;
    });
}

function filterDeleteList() {
    const query = document.getElementById('delete-search-input').value.toLowerCase();
    const filtered = allInventoryItemsForDelete.filter(item => item.item_name.toLowerCase().includes(query));
    renderDeleteList(filtered);
}

async function confirmDeleteItem(itemName) {
    if (!await showCustomConfirm(`WARNING: Are you sure you want to completely remove "${itemName}" from the inventory?\n\nThis action cannot be undone.`)) return;

    const result = await apiFetch('/inventory.php?action=delete', 'POST', { item_name: itemName });

    if (result && result.success) {
        showCustomAlert(`✅ "${itemName}" has been deleted.`);
        // Refresh the modal list and the main inventory table
        await openDeleteItemModal();
        renderInventory();
    } else {
        showCustomAlert(result?.message || 'Failed to delete item.');
    }
}

// ============================================================
// Orders & Stats
// ============================================================
async function loadBranchOrders() {
    const tableBody = document.getElementById('admin-orders-table');
    const revenueDisplay = document.getElementById('total-revenue-display');
    const pendingDisplay = document.getElementById('pending-orders-display');
    const alertsContainer = document.getElementById('sidebar-order-alerts');

    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:#64748B;">Loading orders...</td></tr>`;

    const result = await API.getOrders();
    if (!result || !result.success) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#DC2626;">Failed to load orders.</td></tr>`;
        return;
    }

    const orders = result.data;
    let totalRevenue = 0, pendingCount = 0, hasAlerts = false;

    tableBody.innerHTML = '';
    if (alertsContainer) alertsContainer.innerHTML = '';

    if (orders.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748B;padding:30px;">No orders yet.</td></tr>`;
        if (alertsContainer) alertsContainer.innerHTML = `<p style="color:#64748B;font-size:0.8rem;padding:0 20px;">No pending alerts.</p>`;
        if (revenueDisplay) revenueDisplay.innerText = '₱0.00';
        if (pendingDisplay) pendingDisplay.innerText = '0';
        updateDynamicChart(orders);
        return;
    }

    const today = new Date();
    let emergencyAlertsHTML = '';
    let missedAlertsHTML = '';

    orders.forEach(order => {
        if (order.status === 'Approved' && order.approved_at) {
            const approvalDate = new Date(order.approved_at);
            if (approvalDate.getFullYear() === today.getFullYear() &&
                approvalDate.getMonth() === today.getMonth() &&
                approvalDate.getDate() === today.getDate()) {
                totalRevenue += parseFloat(order.total_amount);
            }
        }

        const isApproved = order.status === 'Approved';
        const isCancelled = order.status === 'Cancelled';
        const isBranchActive = order.branch_is_active == 1;

        if (!isApproved && !isCancelled && isBranchActive) {
            pendingCount++;

            const orderDate = new Date(order.date_placed);
            const hoursPending = (today - orderDate) / (1000 * 60 * 60);
            const isEmergency = order.type === 'RUSH' || order.type === 'EMERGENCY';
            const isMissed = hoursPending >= 12;
            const orderJsonStr = encodeURIComponent(JSON.stringify(order));

            if (isEmergency || isMissed) {
                hasAlerts = true;
            }

            if (isEmergency) {
                emergencyAlertsHTML += `
                    <div class="alert-item" style="display:flex;align-items:center;padding:10px 20px;gap:10px;cursor:pointer;transition:0.3s;" onmouseover="this.style.background='#F1F5F9'" onmouseout="this.style.background='transparent'" onclick="highlightOrder('${order.order_code}', '#FEF2F2')">
                        <span class="status-dot red" style="width:8px;height:8px;background:#DC2626;border-radius:50%;box-shadow:0 0 5px rgba(220,38,38,0.5);"></span>
                        <div class="alert-info" style="line-height:1.2;">
                            <strong style="font-size:0.85rem;color:#1E293B;">${order.branch_location}</strong><br>
                            <span style="font-size:0.75rem;color:#64748B;">#${order.order_code} - ${order.type}</span>
                        </div>
                    </div>`;
            }
            if (isMissed) {
                missedAlertsHTML += `
                    <div class="alert-item" style="display:flex;align-items:center;padding:10px 20px;gap:10px;cursor:pointer;transition:0.3s;" onmouseover="this.style.background='#F1F5F9'" onmouseout="this.style.background='transparent'" onclick="highlightOrder('${order.order_code}', '#FFFBEB')">
                        <span class="status-dot orange" style="width:8px;height:8px;background:#F59E0B;border-radius:50%;box-shadow:0 0 5px rgba(245,158,11,0.5);"></span>
                        <div class="alert-info" style="line-height:1.2;">
                            <strong style="font-size:0.85rem;color:#1E293B;">${order.branch_location}</strong><br>
                            <span style="font-size:0.75rem;color:#64748B;">#${order.order_code} - Pending >24h</span>
                        </div>
                    </div>`;
            }
        }

        if (!isApproved && !isCancelled && isBranchActive) {
            const badgeClass = order.type === 'RUSH' ? 'badge-rush' : 'badge-std';
            const actionButton = `<button class="action-btn-sm" onclick="approveOrder(${order.id}, this)">Approve</button>`;

            const formatted = parseFloat(order.total_amount).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

            const tr = document.createElement('tr');
            tr.id = 'order-row-' + order.order_code;
            // Store order data in a data attribute for the modal
            const orderJson = encodeURIComponent(JSON.stringify(order));
            const deliveryText = order.delivery_date
                ? new Date(order.delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '<span style="color:#94A3B8;">TBD</span>';

            tr.innerHTML = `
                <td style="font-weight:bold;">#${order.order_code}</td>
                <td><i class="fa-solid fa-location-dot" style="color:#D31225;margin-right:5px;"></i>${order.branch_location}</td>
                <td>${new Date(order.date_placed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td>${deliveryText}</td>
                <td><span class="${badgeClass}">${order.type}</span></td>
                <td style="color:#D31225;font-weight:bold;">${formatted}</td>
                <td><button class="action-btn-sm" style="background:#3B82F6;" onclick="showOrderDetails(decodeURIComponent('${orderJson}'))"><i class="fa-solid fa-list" style="margin-right:4px;"></i>View</button></td>
                <td>${actionButton}</td>`;
            tableBody.appendChild(tr);
        }
    });

    if (pendingCount === 0 && orders.length > 0) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#64748B;padding:30px;">No pending orders.</td></tr>`;
    }

    if (alertsContainer) {
        if (!hasAlerts) {
            alertsContainer.innerHTML = `<p style="color:#64748B;font-size:0.8rem;padding:0 20px;">No pending alerts.</p>`;
        } else {
            alertsContainer.innerHTML = '';
            if (emergencyAlertsHTML) {
                alertsContainer.innerHTML += `
                    <div style="padding: 10px 20px 5px 20px; font-size: 0.75rem; font-weight: bold; color: #DC2626; text-transform: uppercase; margin-top: 5px;">Emergency Orders</div>
                    ${emergencyAlertsHTML}
                `;
            }
            if (missedAlertsHTML) {
                alertsContainer.innerHTML += `
                    <div style="padding: 10px 20px 5px 20px; font-size: 0.75rem; font-weight: bold; color: #F59E0B; text-transform: uppercase; margin-top: 5px;">Missed Orders</div>
                    ${missedAlertsHTML}
                `;
            }
        }
    }

    if (revenueDisplay) {
        revenueDisplay.innerText = totalRevenue.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    }
    if (pendingDisplay) pendingDisplay.innerText = pendingCount;

    updateDynamicChart(orders);
}

function approveOrder(orderId, btnElement) {
    document.getElementById('approve-order-id').value = orderId;

    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('approve-delivery-date').value = tomorrow.toISOString().split('T')[0];

    document.getElementById('approve-order-modal').classList.remove('d-none');
}

async function confirmApproveOrder() {
    const orderId = document.getElementById('approve-order-id').value;
    const deliveryDate = document.getElementById('approve-delivery-date').value;
    const btn = document.getElementById('btn-save-approval');

    if (!deliveryDate) {
        showCustomAlert('Please select a delivery date.', 'Error', 'error');
        return;
    }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Approving...';
    btn.disabled = true;

    // Use a custom fetch because API.approveOrder doesn't currently accept deliveryDate
    const result = await apiFetch(`/orders.php?id=${orderId}`, 'PATCH', { delivery_date: deliveryDate });

    btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm Approval';
    btn.disabled = false;

    if (result && result.success) {
        document.getElementById('approve-order-modal').classList.add('d-none');
        showCustomAlert('Order approved successfully!', 'Done', 'success');

        // Find if we are in branch details or main view to refresh properly
        const activeView = document.querySelector('.workspace:not(.d-none)').id;
        if (activeView === 'main-view') {
            await loadBranchOrders();
        } else if (activeView === 'branch-details-view' && currentBranchDetails.location) {
            // Find branch ID
            const branch = globalBranchesData.find(b => b.location === currentBranchDetails.location && b.name === currentBranchDetails.managerName);
            if (branch) {
                const res = await API.getOrders(branch.id);
                globalBranchOrdersData = (res && res.success) ? res.data : [];
                renderBranchOrdersTable(globalBranchOrdersData);
            }
        }

        await renderInventory();
    } else {
        showCustomAlert(result?.message || 'Failed to approve order.', 'Error', 'error');
    }
}

// ============================================================
// Global Search Logic
// ============================================================
function handleGlobalSearch() {
    const query = document.getElementById('global-search-input').value.toLowerCase();

    // Check which view is active
    const activeView = document.querySelector('.workspace:not(.d-none)').id;

    if (activeView === 'inventory-view') {
        const filtered = globalInventoryData.filter(item =>
            item.item_name.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query)
        );
        populateInventoryTable(filtered);
    } else if (activeView === 'main-view') {
        const filtered = globalBranchesData.filter(branch =>
            branch.name.toLowerCase().includes(query) ||
            branch.location.toLowerCase().includes(query) ||
            branch.login_id.toLowerCase().includes(query)
        );
        populateBranchGrid(filtered);
    } else if (activeView === 'branch-details-view') {
        const filtered = globalBranchOrdersData.filter(order =>
            order.order_code.toLowerCase().includes(query) ||
            order.status.toLowerCase().includes(query) ||
            parseFloat(order.total_amount).toString().includes(query) ||
            new Date(order.date_placed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase().includes(query)
        );
        renderBranchOrdersTable(filtered);
    }
}

// ============================================================
// Branch Grid
// ============================================================
let globalBranchesData = [];

async function renderBranchGrid() {
    const gridContainer = document.querySelector('.branch-grid');
    if (!gridContainer) return;

    gridContainer.innerHTML = '<p style="padding:20px;color:#64748B;">Loading branches...</p>';

    const result = await API.getBranches();
    if (!result || !result.success) {
        gridContainer.innerHTML = '<p style="padding:20px;color:#DC2626;">Failed to load branches.</p>';
        return;
    }

    globalBranchesData = result.data;
    populateBranchGrid(globalBranchesData);
}

function populateBranchGrid(branches) {
    const gridContainer = document.querySelector('.branch-grid');
    const sidebarContainer = document.getElementById('sidebar-branch-list');

    if (gridContainer) gridContainer.innerHTML = '';

    // We only want to populate sidebar when rendering all branches initially, 
    // but doing it dynamically is fine. Let's just update the grid for now.

    if (branches.length === 0) {
        if (gridContainer) {
            gridContainer.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;padding:40px;color:#64748B;">
                    <i class="fa-solid fa-store" style="font-size:2rem;margin-bottom:15px;display:block;"></i>
                    No branches found.
                </div>`;
        }
        return;
    }

    let sidebarHTML = '';

    branches.forEach((branch) => {
        const cardHTML = `
            <div class="branch-card" onclick="openBranchDetails(${branch.id}, '${branch.location}', '${branch.name}')">
                <div class="card-top bg-red">
                    <div class="card-top-header">
                        <h3>${branch.location}</h3>
                        <div class="action-menu-container">
                            <button class="more-btn" onclick="toggleDropdown(event, this)"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                            <div class="action-dropdown d-none">
                                <a href="javascript:void(0)" onclick="event.stopPropagation();"><i class="fa-solid fa-pen"></i> Edit</a>
                                <hr>
                                <a href="javascript:void(0)" class="text-red" onclick="terminateBranch(event, ${branch.id})"><i class="fa-solid fa-ban"></i> Terminate</a>
                            </div>
                        </div>
                    </div>
                    <p class="manager-name">Owner: ${branch.name}</p>
                    <div class="manager-avatar"><i class="fa-solid fa-user"></i></div>
                </div>
                <div class="card-bottom">
                    <div class="stat-row"><span>Login ID</span><strong style="color:#D31225;">${branch.login_id}</strong></div>
                    <div class="stat-row"><span>Pending Orders</span><strong>${branch.pending_orders}</strong></div>
                    <div class="alert-box alert-none"><i class="fa-solid fa-check-circle"></i> Active</div>
                </div>
            </div>`;
        if (gridContainer) gridContainer.insertAdjacentHTML('beforeend', cardHTML);

        sidebarHTML += `
            <a href="javascript:void(0)" class="nav-item plain" id="nav-branch-${branch.id}" onclick="openBranchDetails(${branch.id}, '${branch.location}', '${branch.name}')">
                <i class="fa-solid fa-location-dot"></i> <span>${branch.location}</span>
            </a>`;
    });

    // We only update the sidebar if the search query is empty (otherwise sidebar gets filtered too which is okay)
    if (sidebarContainer && document.getElementById('global-search-input').value === '') {
        sidebarContainer.innerHTML = sidebarHTML;
        // Update active branches count badge when not filtering
        document.querySelectorAll('.badge-count').forEach(b => b.innerText = branches.length);
    }
}

function toggleDropdown(event, btn) {
    event.stopPropagation();
    document.querySelectorAll('.action-dropdown').forEach(el => el.classList.add('d-none'));
    const dropdown = btn.nextElementSibling;
    if (dropdown) dropdown.classList.toggle('d-none');
}

async function terminateBranch(event, branchId) {
    event.stopPropagation();
    document.getElementById('terminate-branch-id').value = branchId;
    document.getElementById('terminate-admin-password').value = '';
    document.getElementById('terminate-verify-modal').classList.remove('d-none');
}

async function confirmTerminateBranch() {
    const branchId = document.getElementById('terminate-branch-id').value;
    const password = document.getElementById('terminate-admin-password').value;
    const btn = document.getElementById('btn-confirm-terminate');

    if (!password) {
        showCustomAlert('Please enter your admin password to continue.', 'Error', 'error');
        return;
    }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    btn.disabled = true;

    const result = await API.terminateBranch(branchId, password);

    btn.innerHTML = '<i class="fa-solid fa-user-shield"></i> Verify & Terminate';
    btn.disabled = false;

    if (result && result.success) {
        document.getElementById('terminate-verify-modal').classList.add('d-none');
        showCustomAlert('Branch successfully terminated.', 'Terminated', 'success');
        await renderBranchGrid();
        loadBranchOrders();
    } else {
        showCustomAlert(result?.message || 'Failed to terminate branch.', 'Error', 'error');
    }
}

async function loadTerminatedBranches() {
    const gridContainer = document.getElementById('terminated-branches-grid');
    if (!gridContainer) return;

    gridContainer.innerHTML = '<p style="text-align:center;width:100%;color:#64748B;">Loading terminated branches...</p>';

    const result = await apiFetch('/branches.php?status=terminated', 'GET');
    const branches = (result && result.success) ? result.data : [];

    if (branches.length === 0) {
        gridContainer.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:40px;color:#64748B;">
                <i class="fa-solid fa-store-slash" style="font-size:2rem;margin-bottom:15px;display:block;"></i>
                No terminated branches found.
            </div>`;
        return;
    }

    gridContainer.innerHTML = '';
    branches.forEach(branch => {
        const cardHTML = `
            <div class="branch-card" style="filter: grayscale(1); opacity: 0.8; pointer-events: auto;">
                <div class="card-top" style="background:#475569;">
                    <div class="card-top-header">
                        <h3>${branch.location}</h3>
                    </div>
                    <p class="manager-name">Owner: ${branch.name}</p>
                    <div class="manager-avatar"><i class="fa-solid fa-user-slash"></i></div>
                </div>
                <div class="card-bottom">
                    <div class="stat-row"><span>Login ID</span><strong style="color:#1E293B;">${branch.login_id}</strong></div>
                    <div class="alert-box" style="background:#F1F5F9; color:#64748B;"><i class="fa-solid fa-ban"></i> Terminated</div>
                    <button onclick="revertTerminate(${branch.id})" style="width:100%;margin-top:15px;background:#10B981;color:white;padding:10px;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                        <i class="fa-solid fa-rotate-left"></i> Revert Terminate
                    </button>
                </div>
            </div>`;
        gridContainer.insertAdjacentHTML('beforeend', cardHTML);
    });
}

async function revertTerminate(branchId) {
    if (!await showCustomConfirm('Are you sure you want to restore this branch account?', 'Restore Branch')) return;

    const result = await apiFetch(`/branches.php?id=${branchId}`, 'PATCH', { action: 'revert_terminate' });
    if (result && result.success) {
        showCustomAlert('Branch successfully restored!', 'Restored', 'success');
        loadTerminatedBranches(); // Refresh terminated view
        renderBranchGrid(); // Refresh global active branches in the background
        loadBranchOrders(); // Refresh orders grid to restore past orders
    } else {
        showCustomAlert(result?.message || 'Failed to restore branch.', 'Error', 'error');
    }
}

let globalBranchOrdersData = [];
let currentBranchDetails = { location: '', managerName: '' };

async function openBranchDetails(branchId, location, managerName) {
    switchView('branch-details-view');
    document.getElementById('detail-branch-name').innerText = location + ' Branch';
    document.getElementById('detail-manager-name').innerText = 'Owner: ' + managerName;

    // Apply active effect to the clicked branch on the sidebar
    const activeBranchNav = document.getElementById(`nav-branch-${branchId}`);
    if (activeBranchNav) activeBranchNav.classList.add('active');

    currentBranchDetails = { location, managerName };

    const detailView = document.getElementById('branch-details-view');
    const tableContainer = detailView.querySelector('.table-container');
    if (!tableContainer) return;

    tableContainer.innerHTML = '<p style="padding:20px;color:#64748B;">Loading orders...</p>';

    const result = await API.getOrders(branchId);
    globalBranchOrdersData = (result && result.success) ? result.data : [];

    renderBranchOrdersTable(globalBranchOrdersData);
}

function renderBranchOrdersTable(orders) {
    const detailView = document.getElementById('branch-details-view');
    const tableContainer = detailView.querySelector('.table-container');
    if (!tableContainer) return;

    let tableHTML = `
        <div class="section-header" style="padding:25px 25px 0 25px;margin-bottom:20px;">
            <h2 style="font-family:'Rubik',sans-serif;color:#1E293B;margin:0;">Order History</h2>
            <span style="color:#64748B;font-size:0.9rem;">Showing transactions from this branch</span>
        </div>
        <table style="width:100%;border-collapse:collapse;text-align:left;">
            <thead><tr>
                <th style="padding:15px;border-bottom:2px solid #E2E8F0;">Order ID</th>
                <th style="padding:15px;border-bottom:2px solid #E2E8F0;">Date Placed</th>
                <th style="padding:15px;border-bottom:2px solid #E2E8F0;">Delivery</th>
                <th style="padding:15px;border-bottom:2px solid #E2E8F0;">Status</th>
                <th style="padding:15px;border-bottom:2px solid #E2E8F0;">Details</th>
                <th style="padding:15px;border-bottom:2px solid #E2E8F0;">Amount</th>
            </tr></thead>
            <tbody>`;

    if (orders.length === 0) {
        tableHTML += `<tr><td colspan="5" style="text-align:center;padding:20px;color:#64748B;">No orders found.</td></tr>`;
    } else {
        orders.forEach(order => {
            const statColor = order.status === 'Approved' ? '#10B981' : order.status === 'Cancelled' ? '#94A3B8' : '#F59E0B';
            const formatted = parseFloat(order.total_amount).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
            const orderJson = encodeURIComponent(JSON.stringify({ ...order, branch_location: currentBranchDetails.location, branch_name: currentBranchDetails.managerName }));
            const deliveryText = order.delivery_date
                ? new Date(order.delivery_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '<span style="color:#94A3B8;">TBD</span>';

            tableHTML += `
                <tr>
                    <td style="padding:15px;"><strong>#${order.order_code}</strong></td>
                    <td style="padding:15px;">${new Date(order.date_placed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td style="padding:15px;">${deliveryText}</td>
                    <td style="padding:15px;color:${statColor};font-weight:bold;">${order.status}</td>
                    <td style="padding:15px;"><button class="action-btn-sm" style="background:#3B82F6;" onclick="showOrderDetails(decodeURIComponent('${orderJson}'))"><i class="fa-solid fa-list" style="margin-right:4px;"></i>View</button></td>
                    <td style="padding:15px;color:#D31225;font-weight:bold;">${formatted}</td>
                </tr>`;
        });
    }

    tableHTML += `</tbody></table>`;
    tableContainer.innerHTML = tableHTML;
}

// ============================================================
// Demand Forecast Chart
// ============================================================
function updateDynamicChart(orders = []) {
    globalAllOrders = orders;
    renderDemandCharts();
}

function renderDemandCharts() {
    if (!globalAllOrders || !globalInventoryData) return;

    const ctx7 = document.getElementById('demandChart7');
    const ctx30 = document.getElementById('demandChart30');
    if (!ctx7 || !ctx30 || typeof Chart === 'undefined') return;

    // Find main items from inventory
    const mainItems = globalInventoryData.filter(i => i.category.toLowerCase().includes('main'));
    if (mainItems.length === 0) return; // fallback if no main items

    const itemNames = mainItems.map(i => i.item_name);
    const colors = ['#D31225', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#14B8A6', '#F43F5E'];

    // Prepare 7-day labels (Last 7 days, ending today)
    const labels7 = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels7.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
    }

    // Prepare 30-day labels (Last 30 days)
    const labels30 = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels30.push(d.getDate()); // Just date number
    }

    // Initialize datasets
    const datasets7 = itemNames.map((name, idx) => ({
        label: name,
        data: Array(7).fill(0),
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length] + '20', // 20 hex is approx 12% opacity
        fill: idx === 0, // Fill the first one to keep some of the old aesthetic
        tension: 0.4
    }));

    const datasets30 = itemNames.map((name, idx) => ({
        label: name,
        data: Array(30).fill(0),
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length] + '20',
        fill: false,
        tension: 0.4
    }));

    // Helper to zero out time for accurate day difference calculation
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    globalAllOrders.forEach(order => {
        const d = new Date(order.date_placed);
        d.setHours(0, 0, 0, 0);
        const diffTime = today - d;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (order.items) {
            order.items.forEach(item => {
                const itemIdx = itemNames.indexOf(item.item_name);
                if (itemIdx !== -1) {
                    if (diffDays >= 0 && diffDays < 7) {
                        // For 7 days array: index 6 is today (diffDays = 0)
                        datasets7[itemIdx].data[6 - diffDays] += parseInt(item.quantity) || 0;
                    }
                    if (diffDays >= 0 && diffDays < 30) {
                        // For 30 days array: index 29 is today (diffDays = 0)
                        datasets30[itemIdx].data[29 - diffDays] += parseInt(item.quantity) || 0;
                    }
                }
            });
        }
    });

    if (demandChart7Instance) demandChart7Instance.destroy();
    demandChart7Instance = new Chart(ctx7, {
        type: 'line',
        data: { labels: labels7, datasets: datasets7 },
        options: { responsive: true, maintainAspectRatio: false }
    });

    if (demandChart30Instance) demandChart30Instance.destroy();
    demandChart30Instance = new Chart(ctx30, {
        type: 'line',
        data: { labels: labels30, datasets: datasets30 },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// ============================================================
// Broadcast Announcement
// ============================================================
async function sendBroadcast() {
    const msgInput = document.getElementById('broadcast-msg');
    const msg = msgInput.value.trim();
    if (!msg) return showCustomAlert('Please type a message first!');

    const result = await API.sendAnnouncement(msg);
    if (result && result.success) {
        showCustomAlert('Announcement successfully sent to all branches!');
        msgInput.value = '';
        document.getElementById('broadcast-modal').classList.add('d-none');
    } else {
        showCustomAlert(result?.message || 'Failed to send announcement.');
    }
}

// ============================================================
// Order Details Modal
// ============================================================
function showOrderDetails(orderJsonStr) {
    let order;
    try { order = JSON.parse(orderJsonStr); } catch (e) { showCustomAlert('Could not load order details.'); return; }

    // Header
    document.getElementById('odm-code').textContent = '#' + order.order_code;
    document.getElementById('odm-branch').textContent = (order.branch_location || order.branch_name || 'Branch') + ' Branch';
    document.getElementById('odm-date').textContent = '🗓 ' + new Date(order.date_placed).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
    document.getElementById('odm-total').textContent = parseFloat(order.total_amount).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

    // Type badge
    const typeBadge = document.getElementById('odm-type-badge');
    typeBadge.textContent = order.type;
    typeBadge.style.background = order.type === 'RUSH' ? '#FEF2F2' : '#F0FDF4';
    typeBadge.style.color = order.type === 'RUSH' ? '#DC2626' : '#10B981';

    // Status badge
    const statusBadge = document.getElementById('odm-status-badge');
    const statusColors = { Approved: '#DCFCE7', Pending: '#FFFBEB', Cancelled: '#F1F5F9' };
    const statusText = { Approved: '#16A34A', Pending: '#D97706', Cancelled: '#64748B' };
    statusBadge.textContent = order.status;
    statusBadge.style.background = statusColors[order.status] || '#F1F5F9';
    statusBadge.style.color = statusText[order.status] || '#64748B';

    // Items list
    const list = document.getElementById('odm-items-list');
    const items = order.items || [];
    list.innerHTML = '';

    if (items.length === 0) {
        list.innerHTML = '<p style="color:#94A3B8;text-align:center;padding:20px 0;">No item details available.</p>';
    } else {
        items.forEach((item, i) => {
            const lineTotal = parseFloat(item.line_total).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
            const unitPrice = parseFloat(item.unit_price).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
            list.innerHTML += `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid ${i < items.length - 1 ? '#F1F5F9' : 'transparent'};gap:10px;">
                    <div style="flex:1;">
                        <p style="margin:0;font-weight:600;color:#1E293B;font-size:0.9rem;">${item.item_name}</p>
                        <p style="margin:2px 0 0 0;font-size:0.77rem;color:#94A3B8;">${item.quantity} pcs × ${unitPrice}</p>
                    </div>
                    <span style="font-weight:700;color:#1E293B;white-space:nowrap;">${lineTotal}</span>
                </div>`;
        });
    }

    const modal = document.getElementById('order-details-modal');
    if (modal) modal.style.display = 'flex';
}

function closeOrderDetails() {
    const modal = document.getElementById('order-details-modal');
    if (modal) modal.style.display = 'none';
}

function highlightOrder(orderCode, highlightColor = '#FEF2F2') {
    switchView('main-view');
    setTimeout(() => {
        const row = document.getElementById('order-row-' + orderCode);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const originalBg = row.style.backgroundColor;
            row.style.transition = 'background-color 0.5s ease';
            row.style.backgroundColor = highlightColor; // subtle highlight
            setTimeout(() => {
                row.style.backgroundColor = originalBg || '';
                setTimeout(() => {
                    row.style.transition = '';
                }, 500);
            }, 2000);
        }
    }, 100);
}

// ============================================================
// INQUIRIES (Admin)
// ============================================================
let _adminInquiriesCache = [];

async function loadAdminInquiries() {
    const res = await API.getAdminInquiries();
    if (res && res.success) {
        _adminInquiriesCache = res.data;
        renderAdminInquiryList();
        
        // Update badge count (unread)
        const unreadCount = _adminInquiriesCache.filter(i => i.status === 'Unread').length;
        const badge = document.getElementById('badge-inquiries');
        if (badge) {
            badge.innerText = unreadCount;
            badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        }
    }
}

function renderAdminInquiryList() {
    const list = document.getElementById('admin-inquiry-list');
    if (!list) return;

    if (_adminInquiriesCache.length === 0) {
        list.innerHTML = '<div style="padding: 20px; color: #94A3B8; text-align: center;">No inquiries yet.</div>';
        return;
    }

    list.innerHTML = _adminInquiriesCache.map(inq => {
        const time = inq.last_message_time ? new Date(inq.last_message_time).toLocaleDateString() : '';
        const unreadBadge = inq.status === 'Unread' ? '<span style="display:inline-block; width:8px; height:8px; background:#D31225; border-radius:50%; margin-left:5px;"></span>' : '';
        
        return `
            <div class="inquiry-list-item" id="inq-item-${inq.id}" onclick="openAdminInquiry(${inq.id})">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                    <p class="guest-name">${inq.guest_name} ${unreadBadge}</p>
                    <span style="font-size: 0.75rem; color: #94A3B8;">${time}</span>
                </div>
                <p class="guest-pkg">${inq.package_type}</p>
                <p class="last-msg">${inq.last_message || 'No messages'}</p>
            </div>
        `;
    }).join('');
}

async function openAdminInquiry(id) {
    document.querySelectorAll('.inquiry-list-item').forEach(el => el.classList.remove('active'));
    document.getElementById('inq-item-' + id)?.classList.add('active');

    const inq = _adminInquiriesCache.find(i => i.id === id);
    if (!inq) return;

    document.getElementById('admin-chat-empty').classList.add('d-none');
    document.getElementById('admin-chat-active').classList.remove('d-none');
    
    document.getElementById('admin-chat-name').innerText = inq.guest_name;
    document.getElementById('admin-chat-package').innerText = `${inq.package_type} | ${inq.contact_info}`;
    document.getElementById('admin-active-inquiry-id').value = id;

    const res = await API.getGuestInquiry(inq.tracking_code);
    if (res && res.success) {
        renderAdminChatMessages(res.data.messages);
        
        if (inq.status === 'Unread') {
            loadAdminInquiries(); // refresh list to update badge since it's now open
        }
    }
}

function renderAdminChatMessages(messages) {
    const container = document.getElementById('admin-chat-messages');
    container.innerHTML = messages.map(msg => {
        const role = msg.sender === 'admin' ? 'admin' : 'guest';
        const dateObj = new Date(msg.created_at);
        const time = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        return `
            <div class="chat-bubble ${role}">
                ${String(msg.message_text).replace(/[&<>'"]/g, tag => ({'&': '&amp;','<': '&lt;','>': '&gt;',"'": '&#39;','"': '&quot;'}[tag])).replace(/\n/g, '<br>')}
                <span class="chat-time">${time}</span>
            </div>
        `;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
}

async function sendAdminReply() {
    const id = document.getElementById('admin-active-inquiry-id').value;
    const input = document.getElementById('admin-chat-input');
    const msg = input.value.trim();
    
    if (!id || !msg) return;

    input.disabled = true;
    document.getElementById('admin-chat-send-btn').disabled = true;

    const res = await API.replyInquiryAdmin(id, msg);
    if (res && res.success) {
        input.value = '';
        await openAdminInquiry(parseInt(id)); // refresh chat
        loadAdminInquiries(); // refresh list (status changed to Replied)
    } else {
        alert(res?.message || 'Failed to send reply.');
    }
    
    input.disabled = false;
    document.getElementById('admin-chat-send-btn').disabled = false;
    input.focus();
}

// ==========================================
// AUTO REPLY MANAGEMENT
// ==========================================
let _autoRepliesCache = [];
let _currentEditAutoReplyId = null;

function openAutoReplyModal() {
    document.getElementById('auto-reply-modal').classList.remove('d-none');
    fetchAutoReplies();
}

function closeAutoReplyModal() {
    document.getElementById('auto-reply-modal').classList.add('d-none');
}

async function fetchAutoReplies() {
    const res = await API.getAutoReplies();
    if (res && res.success) {
        _autoRepliesCache = res.data;
        renderAutoReplies(res.data);
    }
}

function renderAutoReplies(replies) {
    const container = document.getElementById('auto-reply-list-container');
    if (!replies || replies.length === 0) {
        container.innerHTML = '<p style="color: #64748B; font-size: 0.9rem;">No auto replies configured yet.</p>';
        return;
    }

    container.innerHTML = replies.map(ar => `
        <div style="border: 1px solid #E2E8F0; border-radius: 8px; padding: 15px; position: relative;">
            <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 5px;">
                <button onclick="startEditAutoReply(${ar.id})" style="background: #F0FDF4; color: #16A34A; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
                <button onclick="deleteAutoReply(${ar.id})" style="background: #FEF2F2; color: #DC2626; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            </div>
            <div style="margin-bottom: 5px;">
                <span style="font-weight: bold; color: #1E293B; font-size: 0.85rem; text-transform: uppercase;">Guest Question:</span><br>
                <span style="color: #475569;">${String(ar.question_text).replace(/[&<>'"]/g, tag => ({'&': '&amp;','<': '&lt;','>': '&gt;',"'": '&#39;','"': '&quot;'}[tag]))}</span>
            </div>
            <div>
                <span style="font-weight: bold; color: #1E293B; font-size: 0.85rem; text-transform: uppercase;">Auto Reply:</span><br>
                <span style="color: #10B981;">${String(ar.answer_text).replace(/[&<>'"]/g, tag => ({'&': '&amp;','<': '&lt;','>': '&gt;',"'": '&#39;','"': '&quot;'}[tag])).replace(/\n/g, '<br>')}</span>
            </div>
        </div>
    `).join('');
}

function startEditAutoReply(id) {
    const ar = _autoRepliesCache.find(r => r.id === id);
    if (!ar) return;
    
    _currentEditAutoReplyId = id;
    document.getElementById('new-ar-question').value = ar.question_text;
    document.getElementById('new-ar-answer').value = ar.answer_text;
    
    document.getElementById('btn-add-ar').innerHTML = '<i class="fa-solid fa-save"></i> Save Changes';
    document.getElementById('btn-cancel-edit-ar').classList.remove('d-none');
}

function cancelEditAutoReply() {
    _currentEditAutoReplyId = null;
    document.getElementById('new-ar-question').value = '';
    document.getElementById('new-ar-answer').value = '';
    
    document.getElementById('btn-add-ar').innerHTML = '<i class="fa-solid fa-plus"></i> Add Quick Reply';
    document.getElementById('btn-cancel-edit-ar').classList.add('d-none');
}

async function addAutoReply() {
    const questionInput = document.getElementById('new-ar-question');
    const answerInput = document.getElementById('new-ar-answer');
    const question = questionInput.value.trim();
    const answer = answerInput.value.trim();

    if (!question || !answer) {
        alert("Please enter both the question and the auto reply.");
        return;
    }

    if (_currentEditAutoReplyId) {
        const res = await API.editAutoReply(_currentEditAutoReplyId, question, answer);
        if (res && res.success) {
            cancelEditAutoReply();
            fetchAutoReplies();
        } else {
            alert(res?.message || 'Failed to update auto reply.');
        }
    } else {
        const res = await API.addAutoReply(question, answer);
        if (res && res.success) {
            questionInput.value = '';
            answerInput.value = '';
            fetchAutoReplies();
        } else {
            alert(res?.message || 'Failed to add auto reply.');
        }
    }
}

async function deleteAutoReply(id) {
    if (!confirm('Are you sure you want to delete this auto reply?')) return;
    const res = await API.deleteAutoReply(id);
    if (res && res.success) {
        fetchAutoReplies();
    } else {
        alert(res?.message || 'Failed to delete auto reply.');
    }
}
