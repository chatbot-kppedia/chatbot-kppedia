document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('kppedia_token');
    const user = JSON.parse(localStorage.getItem('kppedia_user') || 'null');

    // Protect route
    if (!token || !user) {
        window.location.href = "auth.html";
        return;
    }

    // Display user info
    const userProfileDisplay = document.getElementById('user-profile-display');
    if (userProfileDisplay) {
        userProfileDisplay.innerHTML = `<i class="fa-regular fa-circle-user"></i> <span>${user.username}</span>`;
    }

    // Logout Logic
    document.getElementById('chat-logout-btn').addEventListener('click', () => {
        if (confirm("Apakah Anda yakin ingin keluar dari akun ini?")) {
            localStorage.removeItem('kppedia_token');
            localStorage.removeItem('kppedia_user');
            window.location.href = "index.html";
        }
    });

    // Theme toggle (reuse functionality)
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = themeToggleBtn.querySelector('i');
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
    }

    themeToggleBtn.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            themeIcon.classList.replace('fa-sun', 'fa-moon');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeIcon.classList.replace('fa-moon', 'fa-sun');
            localStorage.setItem('theme', 'dark');
        }
    });

    // Mobile Sidebar Toggle
    const mobileToggle = document.getElementById('mobile-sidebar-toggle');
    const chatSidebar = document.getElementById('chat-sidebar');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const openSidebarBtns = document.querySelectorAll('.open-sidebar-btn');

    if (mobileToggle && chatSidebar) {
        mobileToggle.addEventListener('click', () => {
            chatSidebar.classList.toggle('active');
        });
    }

    openSidebarBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (chatSidebar) chatSidebar.classList.toggle('active');
        });
    });

    if (closeSidebarBtn && chatSidebar) {
        closeSidebarBtn.addEventListener('click', () => {
            chatSidebar.classList.remove('active');
        });
    }

    // Chat Logic
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const chatMessages = document.getElementById('chat-messages');
    const historyList = document.getElementById('chat-history-list');
    
    // View containers
    const chatViewContainer = document.getElementById('chat-view-container');
    const checklistViewContainer = document.getElementById('checklist-view-container');
    const eligibilityViewContainer = document.getElementById('eligibility-view-container');
    
    const navChecklistBtn = document.getElementById('nav-checklist-btn');
    const closeChecklistBtn = document.getElementById('close-checklist-btn');
    const navEligibilityBtn = document.getElementById('nav-eligibility-btn');
    const closeEligibilityBtn = document.getElementById('close-eligibility-btn');

    let currentConversationId = null;

    // --- View Toggle Logic ---
    function hideAllViews() {
        chatViewContainer.style.display = 'none';
        checklistViewContainer.style.display = 'none';
        eligibilityViewContainer.style.display = 'none';
    }

    function showChecklistView() {
        hideAllViews();
        checklistViewContainer.style.display = 'flex';
        if (window.innerWidth <= 768 && chatSidebar) chatSidebar.classList.remove('active');
        loadChecklists();
    }

    function showEligibilityView() {
        hideAllViews();
        eligibilityViewContainer.style.display = 'flex';
        if (window.innerWidth <= 768 && chatSidebar) chatSidebar.classList.remove('active');
    }

    function showChatView() {
        hideAllViews();
        chatViewContainer.style.display = 'flex';
        if (window.innerWidth <= 768 && chatSidebar) chatSidebar.classList.remove('active');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    if(navChecklistBtn) navChecklistBtn.addEventListener('click', (e) => { e.preventDefault(); showChecklistView(); });
    if(closeChecklistBtn) closeChecklistBtn.addEventListener('click', showChatView);
    if(navEligibilityBtn) navEligibilityBtn.addEventListener('click', (e) => { e.preventDefault(); showEligibilityView(); });
    if(closeEligibilityBtn) closeEligibilityBtn.addEventListener('click', showChatView);

    // Load Conversations
    async function loadConversations() {
        try {
            const res = await fetch('/api/chat/conversations', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const conversations = await res.json();
                if (historyList) {
                    historyList.innerHTML = '';
                    conversations.forEach(conv => {
                        const div = document.createElement('div');
                        div.className = `history-item ${conv.id === currentConversationId ? 'active' : ''}`;
                        div.innerHTML = `
                            <div class="history-item-left" title="${conv.title}">
                                <i class="fa-regular fa-message"></i> <span>${conv.title}</span>
                            </div>
                            <button class="delete-chat-btn" title="Hapus Percakapan">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        `;
                        div.querySelector('.history-item-left').addEventListener('click', () => loadConversationMessages(conv.id));
                        div.querySelector('.delete-chat-btn').addEventListener('click', (e) => {
                            e.stopPropagation();
                            deleteConversation(conv.id);
                        });
                        historyList.appendChild(div);
                    });
                }
            }
        } catch (e) { console.error("Error loading history", e); }
    }

    async function deleteConversation(id) {
        if (!confirm("Apakah Anda yakin ingin menghapus percakapan ini secara permanen?")) {
            return;
        }
        try {
            const res = await fetch(`/api/chat/conversations/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                if (currentConversationId === id) {
                    document.getElementById('new-chat-btn').click();
                } else {
                    loadConversations();
                }
            } else {
                alert("Gagal menghapus percakapan.");
            }
        } catch(e) {
            console.error("Error deleting chat", e);
        }
    }

    async function loadConversationMessages(id) {
        currentConversationId = id;
        loadConversations(); // refresh active state
        showChatView(); // Pastikan tampilkan chat view saat buka history

        chatMessages.innerHTML = ''; // clear chat
        try {
            const res = await fetch(`/api/chat/conversations/${id}/messages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const messages = await res.json();
                messages.forEach(msg => appendMessage(msg.role, msg.content));
            }
        } catch (e) { console.error("Error loading messages", e); }
        
        if (window.innerWidth <= 768) {
            document.getElementById('chat-sidebar').classList.remove('active');
        }
    }

    loadConversations();

    function appendMessage(role, text) {
        const msg = document.createElement('div');
        msg.classList.add('chat-msg', role);
        
        let attachmentHtml = '';
        let optionsHtml = '';
        let processedText = text;

        // Parse special [ATTACHMENT:name|url] tag
        const attachmentRegex = /\[ATTACHMENT:([^|]+)\|([^\]]+)\]/g;
        const match = attachmentRegex.exec(text);
        if (match) {
            const fileName = match[1];
            const fileUrl = match[2];
            // Hapus tag dari teks pesan
            processedText = text.replace(match[0], '').trim();
            
            // Render HTML Card
            attachmentHtml = `
                <div class="chat-document-card">
                    <div class="doc-icon"><i class="fa-solid fa-file-pdf"></i></div>
                    <div class="doc-info">
                        <div class="doc-name">${fileName}</div>
                        <div class="doc-size">PDF Document</div>
                    </div>
                    <a href="${fileUrl}" target="_blank" class="doc-download" title="Unduh Dokumen">
                        <i class="fa-solid fa-download"></i>
                    </a>
                </div>
            `;
        }

        // Parse special [OPTIONS:name1,name2] tag
        const optionsRegex = /\[OPTIONS:([^\]]+)\]/g;
        const optMatch = optionsRegex.exec(processedText);
        if (optMatch) {
            const optionsString = optMatch[1];
            processedText = processedText.replace(optMatch[0], '').trim();
            const optionsArray = optionsString.split(',');
            
            let buttonsHtml = optionsArray.map(opt => `<button class="chat-option-btn">${opt}</button>`).join('');
            optionsHtml = `<div class="chat-options-container">${buttonsHtml}</div>`;
        }

        const renderedText = role === 'bot' ? marked.parse(processedText) : processedText;
        msg.innerHTML = `
            <div class="chat-msg-avatar">
                <i class="fa-solid ${role === 'bot' ? 'fa-robot' : 'fa-user'}"></i>
            </div>
            <div class="chat-msg-bubble">
                ${renderedText}
                ${attachmentHtml}
                ${optionsHtml}
            </div>`;
        chatMessages.appendChild(msg);
        
        // Bind events for option buttons
        if (optionsHtml) {
            const buttons = msg.querySelectorAll('.chat-option-btn');
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    chatInput.value = "Saya butuh dokumen " + btn.textContent;
                    sendMessage();
                });
            });
        }
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showTyping() {
        const typing = document.createElement('div');
        typing.classList.add('chat-msg', 'bot', 'chat-typing');
        typing.id = 'typing-indicator';
        typing.innerHTML = `
            <div class="chat-msg-avatar">
                <i class="fa-solid fa-robot"></i>
            </div>
            <div class="chat-msg-bubble">
                <div class="typing-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>`;
        chatMessages.appendChild(typing);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function hideTyping() {
        const typing = document.getElementById('typing-indicator');
        if (typing) typing.remove();
    }

    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        appendMessage('user', message);
        chatInput.value = '';
        sendBtn.disabled = true;
        showTyping();

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message, conversationId: currentConversationId })
            });
            const data = await response.json();
            hideTyping();
            
            if (response.status === 401 || response.status === 403) {
                appendMessage('bot', data.error || 'Sesi telah berakhir, silakan login kembali.');
                localStorage.removeItem('kppedia_token');
                localStorage.removeItem('kppedia_user');
                setTimeout(() => window.location.href = "auth.html", 2000);
            } else {
                appendMessage('bot', data.reply || 'Maaf, terjadi kesalahan.');
                if (data.conversationId) {
                    currentConversationId = data.conversationId;
                    loadConversations();
                }
            }
        } catch (error) {
            hideTyping();
            appendMessage('bot', 'Maaf, tidak dapat terhubung ke server.');
        } finally {
            sendBtn.disabled = false;
            chatInput.focus();
        }
    }

    sendBtn.addEventListener('click', () => {
        sendMessage();
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // New Chat Button
    document.getElementById('new-chat-btn').addEventListener('click', () => {
        currentConversationId = null;
        chatMessages.innerHTML = `
            <div class="chat-msg bot">
                <div class="chat-msg-avatar"><i class="fa-solid fa-robot"></i></div>
                <div class="chat-msg-bubble">Halo! Saya KPedia, asisten AI untuk Kerja Praktik di Telkom University Surabaya. Ada yang bisa saya bantu hari ini?</div>
            </div>`;
        loadConversations();
        showChatView(); // Pastikan tampilkan chat view
    });

    // --- Smart Checklist Logic ---
    async function loadChecklists() {
        // Fitur checklist telah dinonaktifkan
    }

    // --- Eligibility Checker Logic ---
    // Fitur cek kelayakan telah dinonaktifkan

});
