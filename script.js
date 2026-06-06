/**
 * KPedia Landing Page Scripts
 */

document.addEventListener('DOMContentLoaded', () => {

    // 1. Navbar Scroll Effect
    const navbar = document.getElementById('navbar');

    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    });

    // Auth Check & UI Update
    const token = localStorage.getItem('kppedia_token');
    const user = JSON.parse(localStorage.getItem('kppedia_user') || 'null');
    
    // Update Navbar if user is logged in
    const authBtnContainer = document.getElementById('auth-btn-container');
    if (authBtnContainer) {
        if (token && user) {
            authBtnContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span style="font-weight: 600; color: var(--text-main);">Hi, ${user.username}</span>
                    <button id="logout-btn" class="btn btn-secondary nav-btn" style="padding: 0.5rem 1rem;">Logout</button>
                </div>
            `;
            document.getElementById('logout-btn').addEventListener('click', () => {
                if (confirm("Apakah Anda yakin ingin keluar dari akun ini?")) {
                    localStorage.removeItem('kppedia_token');
                    localStorage.removeItem('kppedia_user');
                    window.location.reload();
                }
            });
        }
    }

    // Hero Chat Button behavior
    const heroChatBtn = document.getElementById('hero-chat-btn');
    if (heroChatBtn) {
        heroChatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!token) {
                window.location.href = "auth.html";
            } else {
                window.location.href = "chatbot.html";
            }
        });
    }

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

});