<?php
$file = 'd:/Download/Xampp/htdocs/fullstop/js/admin-ui.js';
$content = file_get_contents($file);

// Add _currentEditAutoReplyId and _autoRepliesCache
$content = str_replace(
    "// AUTO REPLY MANAGEMENT\n// ==========================================\nfunction openAutoReplyModal() {",
    "// AUTO REPLY MANAGEMENT\n// ==========================================\nlet _autoRepliesCache = [];\nlet _currentEditAutoReplyId = null;\n\nfunction openAutoReplyModal() {",
    $content
);

// Update fetchAutoReplies
$content = str_replace(
    "async function fetchAutoReplies() {\n    const res = await API.getAutoReplies();\n    if (res && res.success) {\n        renderAutoReplies(res.data);\n    }",
    "async function fetchAutoReplies() {\n    const res = await API.getAutoReplies();\n    if (res && res.success) {\n        _autoRepliesCache = res.data;\n        renderAutoReplies(res.data);\n    }",
    $content
);

// Update renderAutoReplies
$oldRender = "<button onclick=\"deleteAutoReply(\${ar.id})\" style=\"position: absolute; top: 10px; right: 10px; background: #FEF2F2; color: #DC2626; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;\">
                <i class=\"fa-solid fa-trash\"></i> Delete
            </button>";

$newRender = "<div style=\"position: absolute; top: 10px; right: 10px; display: flex; gap: 5px;\">
                <button onclick=\"startEditAutoReply(\${ar.id})\" style=\"background: #F0FDF4; color: #16A34A; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;\">
                    <i class=\"fa-solid fa-pen\"></i> Edit
                </button>
                <button onclick=\"deleteAutoReply(\${ar.id})\" style=\"background: #FEF2F2; color: #DC2626; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;\">
                    <i class=\"fa-solid fa-trash\"></i> Delete
                </button>
            </div>";
$content = str_replace($oldRender, $newRender, $content);

// Update addAutoReply
$oldAdd = "async function addAutoReply() {
    const questionInput = document.getElementById('new-ar-question');
    const answerInput = document.getElementById('new-ar-answer');
    const question = questionInput.value.trim();
    const answer = answerInput.value.trim();

    if (!question || !answer) {
        alert(\"Please enter both the question and the auto reply.\");
        return;
    }

    const res = await API.addAutoReply(question, answer);
    if (res && res.success) {
        questionInput.value = '';
        answerInput.value = '';
        fetchAutoReplies();
    } else {
        alert(res?.message || 'Failed to add auto reply.');
    }
}";

$newAdd = "function startEditAutoReply(id) {
    const ar = _autoRepliesCache.find(r => r.id === id);
    if (!ar) return;
    
    _currentEditAutoReplyId = id;
    document.getElementById('new-ar-question').value = ar.question_text;
    document.getElementById('new-ar-answer').value = ar.answer_text;
    
    document.getElementById('btn-add-ar').innerHTML = '<i class=\"fa-solid fa-save\"></i> Save Changes';
    document.getElementById('btn-cancel-edit-ar').classList.remove('d-none');
}

function cancelEditAutoReply() {
    _currentEditAutoReplyId = null;
    document.getElementById('new-ar-question').value = '';
    document.getElementById('new-ar-answer').value = '';
    
    document.getElementById('btn-add-ar').innerHTML = '<i class=\"fa-solid fa-plus\"></i> Add Quick Reply';
    document.getElementById('btn-cancel-edit-ar').classList.add('d-none');
}

async function addAutoReply() {
    const questionInput = document.getElementById('new-ar-question');
    const answerInput = document.getElementById('new-ar-answer');
    const question = questionInput.value.trim();
    const answer = answerInput.value.trim();

    if (!question || !answer) {
        alert(\"Please enter both the question and the auto reply.\");
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
}";

$content = str_replace($oldAdd, $newAdd, $content);

file_put_contents($file, $content);
echo "Patched admin-ui.js for Auto Reply edit";
