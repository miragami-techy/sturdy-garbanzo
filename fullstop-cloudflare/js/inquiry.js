// js/inquiry.js

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const packageName = urlParams.get('package') || 'General Inquiry';
    document.getElementById('inquiry-package-name').innerText = packageName;

    const trackingCode = localStorage.getItem('fs_inquiry_tracking_code');
    if (trackingCode) {
        loadChatHistory(trackingCode);
    } else {
        renderInquiryForm(packageName);
    }
});

function renderInquiryForm(packageName) {
    const content = document.getElementById('inquiry-content');
    content.innerHTML = `
        <div class="inquiry-form">
            <h3 style="margin-top:0; color:#1E293B; margin-bottom: 25px;">Start your application</h3>
            <div class="form-group">
                <label>Full Name</label>
                <input type="text" id="inq-name" placeholder="Juan Dela Cruz">
            </div>
            <div class="form-group">
                <label>Contact Info (Email or Phone Number)</label>
                <input type="text" id="inq-contact" placeholder="09123456789 or juan@email.com">
            </div>
            <div class="form-group">
                <label>Initial Message / Question</label>
                <textarea id="inq-message" rows="4" placeholder="I am interested in this package because..."></textarea>
            </div>
            <button class="btn btn-primary btn-full" style="padding:15px; font-size:1.1rem;" onclick="submitInquiry('${packageName}')">
                <i class="fa-solid fa-paper-plane"></i> Send Inquiry
            </button>
        </div>
    `;
}

async function submitInquiry(packageName) {
    const name = document.getElementById('inq-name').value;
    const contact = document.getElementById('inq-contact').value;
    const message = document.getElementById('inq-message').value;

    if (!name || !contact || !message) {
        alert('Please fill out all fields.');
        return;
    }

    const res = await API.createInquiry(packageName, name, contact, message);
    if (res && res.success) {
        localStorage.setItem('fs_inquiry_tracking_code', res.data.tracking_code);
        loadChatHistory(res.data.tracking_code);
    } else {
        alert(res?.message || 'Failed to submit inquiry.');
    }
}

async function loadChatHistory(trackingCode) {
    const res = await API.getGuestInquiry(trackingCode);
    if (res && res.success) {
        const inquiry = res.data;
        // Keep main header and update subtitle dynamically with guest info
        document.getElementById('inquiry-header-title').innerText = 'Franchise Inquiry';
        document.getElementById('inquiry-package-name').innerText = `Your info: ${inquiry.guest_name} / ${inquiry.contact_info}`;
        
        const content = document.getElementById('inquiry-content');
        let html = '<div class="chat-messages" id="chat-messages">';
        
        inquiry.messages.forEach(msg => {
            const role = msg.sender === 'guest' ? 'guest' : 'admin';
            const dateObj = new Date(msg.created_at);
            const time = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            html += `
                <div class="chat-bubble ${role}">
                    ${escapeHTML(msg.message_text)}
                    <span class="chat-time">${time}</span>
                </div>
            `;
        });
        
        html += '</div>';

        // Fetch auto replies
        const arRes = await API.getAutoReplies();
        let arHtml = '';
        if (arRes && arRes.success && arRes.data.length > 0) {
            arHtml = `<div style="padding: 10px 20px; display: flex; flex-wrap: wrap; gap: 8px; border-top: 1px solid #E2E8F0; background: #F8FAFC;">
                <span style="width: 100%; font-size: 0.8rem; color: #64748B; font-weight: bold; margin-bottom: 5px;">Quick Replies</span>
                ${arRes.data.map(ar => `<button onclick="sendAutoReply('${trackingCode}', ${ar.id})" style="background: white; border: 1px solid #D31225; color: #D31225; padding: 6px 12px; border-radius: 16px; font-size: 0.85rem; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#FEF2F2'" onmouseout="this.style.background='white'">${escapeHTML(ar.question_text)}</button>`).join('')}
            </div>`;
        }
        
        html += arHtml;
        html += `
            <div class="chat-input-area">
                <textarea id="chat-input" placeholder="Type your message..." onkeypress="handleEnter(event)"></textarea>
                <button id="chat-send-btn" onclick="sendReply('${trackingCode}')"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
        `;
        
        content.innerHTML = html;
        scrollToBottom();
    } else {
        // If tracking code is invalid or not found, clear it and show form
        localStorage.removeItem('fs_inquiry_tracking_code');
        renderInquiryForm('General Inquiry');
    }
}

async function sendAutoReply(trackingCode, autoReplyId) {
    const res = await API.triggerAutoReplyGuest(trackingCode, autoReplyId);
    if (res && res.success) {
        await loadChatHistory(trackingCode);
    } else {
        alert(res?.message || 'Failed to send quick reply.');
    }
}

async function sendReply(trackingCode) {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    const btn = document.getElementById('chat-send-btn');
    btn.disabled = true;
    input.disabled = true;

    const res = await API.replyInquiryGuest(trackingCode, msg);
    if (res && res.success) {
        // Reload chat
        await loadChatHistory(trackingCode);
    } else {
        alert(res?.message || 'Failed to send message.');
        btn.disabled = false;
        input.disabled = false;
    }
}

function handleEnter(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('chat-send-btn').click();
    }
}

function scrollToBottom() {
    const messagesDiv = document.getElementById('chat-messages');
    if (messagesDiv) {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag])
    ).replace(/\n/g, '<br>');
}
