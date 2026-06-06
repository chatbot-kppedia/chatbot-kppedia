const API_URL = "http://localhost:3000/api/auth";

// DOM Elements
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const toggleAuthBtn = document.getElementById("toggle-auth");
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");
const toggleText = document.getElementById("toggle-text");
const loginError = document.getElementById("login-error");
const registerError = document.getElementById("register-error");

let isLoginMode = true;

// Toggle between Login and Register
toggleAuthBtn.addEventListener("click", (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    
    loginError.textContent = "";
    registerError.textContent = "";

    if (isLoginMode) {
        loginForm.style.display = "block";
        registerForm.style.display = "none";
        authTitle.textContent = "Selamat Datang";
        authSubtitle.textContent = "Masuk untuk melanjutkan ke KPedia";
        toggleText.innerHTML = 'Belum punya akun? <a href="#" id="toggle-auth-inner">Daftar sekarang</a>';
    } else {
        loginForm.style.display = "none";
        registerForm.style.display = "block";
        authTitle.textContent = "Buat Akun";
        authSubtitle.textContent = "Daftar untuk mengakses fitur KPedia";
        toggleText.innerHTML = 'Sudah punya akun? <a href="#" id="toggle-auth-inner">Masuk di sini</a>';
    }

    // Reattach event listener to the new inner link
    document.getElementById("toggle-auth-inner").addEventListener("click", (e) => {
        toggleAuthBtn.click();
    });
});

// Handle Login
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    
    const identifier = document.getElementById("login-identifier").value;
    const password = document.getElementById("login-password").value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Save token and redirect
            localStorage.setItem("kppedia_token", data.token);
            localStorage.setItem("kppedia_user", JSON.stringify(data.user));
            window.location.href = "chatbot.html";
        } else {
            loginError.textContent = data.error || "Gagal masuk.";
        }
    } catch (error) {
        loginError.textContent = "Terjadi kesalahan koneksi.";
    }
});

// Handle Register
registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    registerError.textContent = "";
    
    const username = document.getElementById("reg-username").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert("Registrasi berhasil! Silakan login.");
            toggleAuthBtn.click(); // Switch to login mode
        } else {
            registerError.textContent = data.error || "Gagal mendaftar.";
        }
    } catch (error) {
        registerError.textContent = "Terjadi kesalahan koneksi.";
    }
});

// Callback for Google Sign-In
async function handleGoogleCredentialResponse(response) {
    loginError.textContent = "";
    try {
        const res = await fetch(`${API_URL}/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: response.credential })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem("kppedia_token", data.token);
            localStorage.setItem("kppedia_user", JSON.stringify(data.user));
            window.location.href = "chatbot.html";
        } else {
            loginError.textContent = data.error || "Gagal login dengan Google.";
        }
    } catch (error) {
        loginError.textContent = "Terjadi kesalahan koneksi Google Login.";
    }
}
