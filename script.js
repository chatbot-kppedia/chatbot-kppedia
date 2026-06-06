/**
 * KPedia Landing Page Scripts
 */

document.addEventListener('DOMContentLoaded', () => {

    // 1. Navbar Scroll Effect
    const navbar = document.getElementById('navbar');

    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    });

    // 2. FAQ Accordion — smooth dengan requestAnimationFrame
    const accordionHeaders = document.querySelectorAll('.accordion-header');

    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const body = item.querySelector('.accordion-body');
            const isActive = item.classList.contains('active');

            // Tutup semua item lain
            document.querySelectorAll('.accordion-item.active').forEach(activeItem => {
                if (activeItem !== item) {
                    activeItem.classList.remove('active');
                    activeItem.querySelector('.accordion-body').style.maxHeight = '0px';
                }
            });

            if (isActive) {
                // Tutup item ini
                item.classList.remove('active');
                body.style.maxHeight = '0px';
            } else {
                // Buka item ini — ukur dulu, baru set
                item.classList.add('active');
                // Pakai scrollHeight yang sudah pasti setelah class active ditambah
                requestAnimationFrame(() => {
                    body.style.maxHeight = body.scrollHeight + 'px';
                });
            }
        });
    });

    // 3. Smooth Scrolling for Navigation Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const headerOffset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
        });
    });

    // 4. Update Active Nav Link on Scroll
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-links .nav-link');

    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            if (pageYOffset >= section.offsetTop - 200) {
                current = section.getAttribute('id');
            }
        });
        navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
        });
    });

    // 5. Theme Toggle — tanpa transisi saat halaman pertama load
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = themeToggleBtn.querySelector('i');

    // Terapkan tema tersimpan SEBELUM transisi aktif (cegah flash)
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

    // 6. Chat Widget
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    const chatCloseBtn = document.getElementById('chat-close-btn');
    const chatWindow = document.getElementById('chat-window');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatMessages = document.getElementById('chat-messages');

    const API_URL = '/chat';

    function openChat() {
        chatWindow.classList.add('open');
        document.getElementById('chat-toggle-icon').classList.replace('fa-comment-dots', 'fa-xmark');
        chatInput.focus();
    }

    function closeChat() {
        chatWindow.classList.remove('open');
        document.getElementById('chat-toggle-icon').classList.replace('fa-xmark', 'fa-comment-dots');
    }

    chatToggleBtn.addEventListener('click', () => {
        chatWindow.classList.contains('open') ? closeChat() : openChat();
    });

    chatCloseBtn.addEventListener('click', closeChat);

    function appendMessage(role, text) {
        const msg = document.createElement('div');
        msg.classList.add('chat-msg', role);
        const renderedText = role === 'bot' ? marked.parse(text) : text;
        msg.innerHTML = `
            <div class="chat-msg-avatar">
                <i class="fa-solid ${role === 'bot' ? 'fa-robot' : 'fa-user'}"></i>
            </div>
            <div class="chat-msg-bubble">${renderedText}</div>`;
        chatMessages.appendChild(msg);
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
        chatSendBtn.disabled = true;
        showTyping();

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });
            const data = await response.json();
            hideTyping();
            appendMessage('bot', data.reply || 'Maaf, terjadi kesalahan.');
        } catch (error) {
            hideTyping();
            appendMessage('bot', 'Maaf, tidak dapat terhubung ke server. Pastikan server berjalan.');
        } finally {
            chatSendBtn.disabled = false;
            chatInput.focus();
        }
    }

    chatSendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

});