// js/api.js
// ============================================================
// Shared API helper — replaces all localStorage calls.
// All fetch() calls go through apiFetch() which handles:
//   - Base URL detection (works on localhost AND live server)
//   - JSON serialization
//   - Unified error handling
//   - Session expiry redirect
// ============================================================

// Auto-detect base path so the system works both on
// localhost/fullstop/ and on a live server at the root.
const API_BASE = (() => {
    const path = window.location.pathname;
    // Find the folder containing the HTML files and build the api/ path
    const segments = path.split('/').filter(Boolean);
    // Remove last segment (the html filename)
    segments.pop();
    const base = segments.length ? '/' + segments.join('/') : '';
    return base + '/api';
})();

/**
 * Central fetch wrapper.
 * @param {string} endpoint  - e.g. '/orders.php' or '/orders.php?id=5'
 * @param {string} method    - HTTP method (GET, POST, PATCH, DELETE)
 * @param {object|null} body - JSON body for POST/PATCH requests
 * @returns {Promise<object>} Parsed JSON response
 */
async function apiFetch(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        credentials: 'include',          // Send session cookie
        headers: { 'Content-Type': 'application/json' },
    };
    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(API_BASE + endpoint, options);
        const data = await response.json();

        // Session expired → redirect to login (but NOT if we're already on the login page)
        if (response.status === 401) {
            const onLoginPage = window.location.href.includes('system-portal.html');
            if (!onLoginPage) {
                if (typeof window.showCustomAlert === 'function') {
                    window.showCustomAlert(data.message || 'Session expired. Please log in again.', 'Session Expired', 'error', () => {
                        window.location.replace('system-portal.html');
                    });
                } else {
                    alert(data.message || 'Session expired.');
                    window.location.replace('system-portal.html');
                }
                // Return a pending promise so the caller's 'await' hangs forever
                // and doesn't show its own error alert while we wait for the user to click OK.
                return new Promise(() => {});
            }
            return data;
        }

        return data;
    } catch (err) {
        console.error('[apiFetch] Network error:', err);
        return { success: false, message: 'Network error. Please check your connection.' };
    }
}

// ============================================================
// Convenience shorthand functions (used by admin-ui & branch-ui)
// ============================================================

const API = {
    // AUTH
    login:   (loginId, password) => apiFetch('/auth', 'POST', { login_id: loginId, password }),
    logout:  ()                  => apiFetch('/auth', 'DELETE'),
    session: ()                  => apiFetch('/auth', 'GET'),

    // BRANCHES (admin)
    getBranches:    ()                          => apiFetch('/branches.php'),
    createBranch:   (name, location, password)  => apiFetch('/branches.php', 'POST', { name, location, password }),
    terminateBranch: (id, password)             => apiFetch('/branches.php?id=' + id, 'DELETE', { password }),

    // ORDERS
    getOrders:       (branchId = null) => apiFetch('/orders.php' + (branchId ? '?branch_id=' + branchId : '')),
    placeOrder:      (type, items)     => apiFetch('/orders.php', 'POST', { type, items }),
    approveOrder:    (id)              => apiFetch('/orders.php?id=' + id, 'PATCH'),
    cancelOrder:     (id)              => apiFetch('/orders.php?id=' + id, 'DELETE'),

    // INVENTORY
    getInventory: ()     => apiFetch('/inventory.php'),
    restock:      ()     => apiFetch('/inventory.php?action=restock', 'POST'),

    // ANNOUNCEMENTS
    getAnnouncements: ()      => apiFetch('/announcements.php'),
    sendAnnouncement: (msg)   => apiFetch('/announcements.php', 'POST', { message: msg }),
    getUnreadCount:   ()      => apiFetch('/announcements.php?action=unread'),
    markAllRead:      ()      => apiFetch('/announcements.php?action=markread', 'POST'),

    // INQUIRIES (Franchise Communication)
    getAdminInquiries: ()                               => apiFetch('/inquiries.php'),
    getGuestInquiry:   (trackingCode)                   => apiFetch(`/inquiries.php?tracking_code=${trackingCode}`),
    createInquiry:     (pkg, name, contact, message)    => apiFetch('/inquiries.php?action=create', 'POST', { package_type: pkg, guest_name: name, contact_info: contact, message_text: message }),
    replyInquiryGuest: (trackingCode, message)          => apiFetch('/inquiries.php?action=reply', 'POST', { tracking_code: trackingCode, message_text: message }),
    replyInquiryAdmin: (inquiryId, message)             => apiFetch('/inquiries.php?action=reply', 'POST', { inquiry_id: inquiryId, message_text: message }),
    triggerAutoReplyGuest: (trackingCode, autoReplyId)  => apiFetch('/inquiries.php?action=auto_reply', 'POST', { tracking_code: trackingCode, auto_reply_id: autoReplyId }),

    // AUTO REPLIES
    getAutoReplies:    ()                               => apiFetch('/auto_replies.php'),
    addAutoReply:      (question, answer)               => apiFetch('/auto_replies.php?action=create', 'POST', { question_text: question, answer_text: answer }),
    editAutoReply:     (id, question, answer)           => apiFetch('/auto_replies.php?action=edit', 'POST', { id, question_text: question, answer_text: answer }),
    deleteAutoReply:   (id)                             => apiFetch('/auto_replies.php?action=delete', 'POST', { id }),
};
