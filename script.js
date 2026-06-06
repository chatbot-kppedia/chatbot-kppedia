/**
 * KPedia Landing Page Scripts
 */

document.addEventListener('DOMContentLoaded', () => {

    // 1. Navbar Scroll Effect
    const navbar = document.getElementById('navbar');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 2. FAQ Accordion Functionality
    const accordionHeaders = document.querySelectorAll('.accordion-header');

    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const body = item.querySelector('.accordion-body');

            // Close other open items
            const currentActive = document.querySelector('.accordion-item.active');
            if (currentActive && currentActive !== item) {
                currentActive.classList.remove('active');
                currentActive.querySelector('.accordion-body').style.maxHeight = null;
            }

            // Toggle current item
            item.classList.toggle('active');

            if (item.classList.contains('active')) {
                body.style.maxHeight = body.scrollHeight + "px";
            } else {
                body.style.maxHeight = null;
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

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        });
    });

    // 4. Update Active Nav Link on Scroll
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-links .nav-link');

    window.addEventListener('scroll', () => {
        let current = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (pageYOffset >= (sectionTop - 200)) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });

    // 5. Theme Toggle (Light/Dark Mode)
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = themeToggleBtn.querySelector('i');

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    }

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        let targetTheme = 'light';

        if (currentTheme === 'dark') {
            document.documentElement.removeAttribute('data-theme');
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
            targetTheme = 'dark';
        }

        localStorage.setItem('theme', targetTheme);
    });

    // 6. Chat Widget
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    const chatCloseBtn = document.getElementById('chat-close-btn');
    const chatWindow = document.getElementById('chat-window');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatMessages = document.getElementById('chat-messages');

    const API_URL = '/chat';

    // Toggle buka/tutup chat
    chatToggleBtn.addEventListener('click', () => {
        const isOpen = chatWindow.classList.toggle('open');
        const icon = document.getElementById('chat-toggle-icon');
        if (isOpen) {
            icon.classList.remove('fa-comment-dots');
            icon.classList.add('fa-xmark');
            chatInput.focus();
        } else {
            icon.classList.remove('fa-xmark');
            icon.classList.add('fa-comment-dots');
        }
    });

    chatCloseBtn.addEventListener('click', () => {
        chatWindow.classList.remove('open');
        const icon = document.getElementById('chat-toggle-icon');
        icon.classList.remove('fa-xmark');
        icon.classList.add('fa-comment-dots');
    });

    // Tambah pesan ke chat
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

    // Tampilkan typing indicator
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
            </div>
        `;
        chatMessages.appendChild(typing);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function hideTyping() {
        const typing = document.getElementById('typing-indicator');
        if (typing) typing.remove();
    }

    // Kirim pesan ke backend
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message
                })
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