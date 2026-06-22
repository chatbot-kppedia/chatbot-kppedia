document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("kppedia_token");
  const user = JSON.parse(localStorage.getItem("kppedia_user") || "null");

  // Protect route
  if (!token || !user) {
    window.location.href = "auth.html";
    return;
  }

  // Fungsi untuk menampilkan info profil user di sidebar
  function renderUserProfileDisplay(currentUser) {
    const userProfileDisplay = document.getElementById("user-profile-display");
    if (userProfileDisplay && currentUser) {
      if (currentUser.foto_profil) {
        userProfileDisplay.innerHTML = `<img src="${currentUser.foto_profil}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; margin-right: 8px;"> <span>${currentUser.username}</span>`;
      } else {
        userProfileDisplay.innerHTML = `<i class="fa-regular fa-circle-user"></i> <span>${currentUser.username}</span>`;
      }
    }
  }

  // Display user info
  renderUserProfileDisplay(user);

  // Fungsi untuk mengupdate visual gembok / lock menu Smart Checklist
  function updateChecklistLockStatus() {
    const currentUser = JSON.parse(localStorage.getItem("kppedia_user") || "null");
    const navBtn = document.getElementById("nav-checklist-btn");
    if (!currentUser || !navBtn) return;
    
    const isEligible = currentUser.is_eligible === true || currentUser.is_eligible === 1;
    
    if (!isEligible) {
      navBtn.classList.add("locked");
      if (!navBtn.querySelector(".locked-icon")) {
        const lockIcon = document.createElement("i");
        lockIcon.className = "fa-solid fa-lock locked-icon";
        lockIcon.style.marginLeft = "auto";
        lockIcon.style.fontSize = "0.85rem";
        lockIcon.style.opacity = "0.7";
        navBtn.appendChild(lockIcon);
      }
    } else {
      navBtn.classList.remove("locked");
      const lockIcon = navBtn.querySelector(".locked-icon");
      if (lockIcon) {
        lockIcon.remove();
      }
    }
  }

  // Inisialisasi visual status gembok
  updateChecklistLockStatus();

  // Sinkronisasi data user profile dari database untuk memperbarui status terbaru
  async function syncUserProfile() {
    try {
      const res = await fetch("/api/auth/profile", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const profileData = await res.json();
        const currentUser = JSON.parse(localStorage.getItem("kppedia_user") || "null") || {};
        const updatedUser = { ...currentUser, ...profileData };
        localStorage.setItem("kppedia_user", JSON.stringify(updatedUser));
        updateChecklistLockStatus();
        renderUserProfileDisplay(updatedUser);
      }
    } catch (err) {
      console.error("Gagal sinkronisasi data profil user dari server:", err);
    }
  }

  // Sinkronisasi profil saat awal dashboard terbuka
  syncUserProfile().then(() => {
    // Check Onboarding
    const currentUser = JSON.parse(localStorage.getItem("kppedia_user") || "null");
    if (currentUser && !localStorage.getItem("has_onboarded_" + currentUser.username) && !currentUser.is_eligible) {
      document.getElementById("onboarding-modal").style.display = "flex";
      
      // Load criteria for placeholders
      fetch("/api/eligibility/criteria", { headers: { Authorization: `Bearer ${token}` }})
        .then(res => res.json())
        .then(criteria => {
          document.getElementById("ob-sks").placeholder = `Contoh: ${criteria.min_sks}`;
          document.getElementById("ob-ipk").placeholder = `Contoh: ${criteria.min_ipk.toFixed(2)}`;
        }).catch(e => console.error(e));
    }
  });

  // Logout Logic
  document.getElementById("chat-logout-btn").addEventListener("click", () => {
    if (confirm("Apakah Anda yakin ingin keluar dari akun ini?")) {
      localStorage.removeItem("kppedia_token");
      localStorage.removeItem("kppedia_user");
      window.location.href = "index.html";
    }
  });

  // Theme toggle (reuse functionality)
  const themeToggleBtn = document.getElementById("theme-toggle");
  const themeIcon = themeToggleBtn.querySelector("i");
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    themeIcon.classList.replace("fa-moon", "fa-sun");
  }

  themeToggleBtn.addEventListener("click", () => {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      document.documentElement.removeAttribute("data-theme");
      themeIcon.classList.replace("fa-sun", "fa-moon");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      themeIcon.classList.replace("fa-moon", "fa-sun");
      localStorage.setItem("theme", "dark");
    }
  });

  // Mobile Sidebar Toggle
  const mobileToggle = document.getElementById("mobile-sidebar-toggle");
  const chatSidebar = document.getElementById("chat-sidebar");
  const closeSidebarBtn = document.getElementById("close-sidebar-btn");
  const openSidebarBtns = document.querySelectorAll(".open-sidebar-btn");

  if (mobileToggle && chatSidebar) {
    mobileToggle.addEventListener("click", () => {
      chatSidebar.classList.toggle("active");
    });
  }

  openSidebarBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (chatSidebar) chatSidebar.classList.toggle("active");
    });
  });

  if (closeSidebarBtn && chatSidebar) {
    closeSidebarBtn.addEventListener("click", () => {
      chatSidebar.classList.remove("active");
    });
  }

  // Chat Logic
  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send-btn");
  const chatMessages = document.getElementById("chat-messages");
  const historyList = document.getElementById("chat-history-list");

  // View containers
  const chatViewContainer = document.getElementById("chat-view-container");
  const checklistViewContainer = document.getElementById(
    "checklist-view-container",
  );
  const profileViewContainer = document.getElementById(
    "profile-view-container",
  );

  const navChecklistBtn = document.getElementById("nav-checklist-btn");
  const closeChecklistBtn = document.getElementById("close-checklist-btn");
  const navProfileBtn = document.getElementById("nav-profile-btn");
  const closeProfileBtn = document.getElementById("close-profile-btn");

  let currentConversationId = null;

  // --- Checklist Global Variables ---
  let checklistStages = [];
  let userSubmissions = {};
  // Hard Tasks: indeks tahap yang membutuhkan upload bukti & verifikasi admin
  // Berdasarkan urutan DB: 0=Verifikasi Syarat KP, 3=Pengajuan Permohonan KP, 4=Pengajuan Surat Pengantar melalui TOSS, 5=Pengiriman Proposal ke Instansi, 6=Penerimaan dari Instansi, 9=Presentasi Hasil KP, 10=Pengumpulan Laporan Akhir
  const hardTasks = [0, 3, 4, 5, 6, 9, 10];

  // --- View Toggle Logic ---
  function hideAllViews() {
    chatViewContainer.style.display = "none";
    checklistViewContainer.style.display = "none";
    profileViewContainer.style.display = "none";
  }

  async function showChecklistView() {
    hideAllViews();
    checklistViewContainer.style.display = "flex";
    if (window.innerWidth <= 768 && chatSidebar)
      chatSidebar.classList.remove("active");
    await fetchChecklistMaster();
    await loadSubmissions();
    loadChecklists();
    syncChecklistFromBackend().then(() => {
      loadChecklists();
    });
  }

  async function showProfileView() {
    hideAllViews();
    profileViewContainer.style.display = "flex";
    if (window.innerWidth <= 768 && chatSidebar)
      chatSidebar.classList.remove("active");
      
    const currentUser = JSON.parse(localStorage.getItem("kppedia_user") || "null");
    if (currentUser) {
      // Update badge
      const badge = document.getElementById("profile-status-badge");
      const desc = document.getElementById("profile-status-desc");
      const reverifyBtn = document.getElementById("btn-reverify-profile");
      if (currentUser.is_eligible) {
        badge.textContent = "Layak";
        badge.style.background = "var(--primary)";
        desc.textContent = "Anda telah menyelesaikan Cek Kelayakan awal. Syarat SKS dan IPK terpenuhi.";
        reverifyBtn.style.display = "none";
      } else {
        badge.textContent = "Belum Layak";
        badge.style.background = "#ef4444";
        desc.textContent = "Anda belum memenuhi syarat atau belum memverifikasi Kelayakan Kerja Praktik.";
        reverifyBtn.style.display = "block";
      }

      // Populate form
      document.getElementById("profile-kelas").value = currentUser.kelas || "";
      document.getElementById("profile-alamat").value = currentUser.alamat || "";
      document.getElementById("profile-foto").value = "";

      // Preview current photo
      const preview = document.getElementById("profile-img-preview");
      const placeholder = document.getElementById("profile-img-placeholder");
      if (currentUser.foto_profil) {
        preview.src = currentUser.foto_profil;
        preview.style.display = "block";
        placeholder.style.display = "none";
      } else {
        preview.src = "";
        preview.style.display = "none";
        placeholder.style.display = "flex";
      }
    }
  }

  // Live preview for profile photo upload
  document.getElementById("profile-foto").addEventListener("change", (e) => {
    const file = e.target.files[0];
    const preview = document.getElementById("profile-img-preview");
    const placeholder = document.getElementById("profile-img-placeholder");
    
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        preview.src = event.target.result;
        preview.style.display = "block";
        placeholder.style.display = "none";
      };
      reader.readAsDataURL(file);
    }
  });

  function showChatView() {
    hideAllViews();
    chatViewContainer.style.display = "flex";
    if (window.innerWidth <= 768 && chatSidebar)
      chatSidebar.classList.remove("active");
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  if (navChecklistBtn)
    navChecklistBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (navChecklistBtn.classList.contains("locked")) {
        Swal.fire({
          icon: "warning",
          title: "Akses Terkunci",
          text: "Silakan isi dan lolos Cek Kelayakan KP terlebih dahulu untuk membuka Smart Checklist!",
          confirmButtonColor: "#ef4444",
          confirmButtonText: "Lihat Status Kelayakan",
          showCancelButton: true,
          cancelButtonText: "Batal",
          cancelButtonColor: "#6b7280"
        }).then((result) => {
          if (result.isConfirmed) {
            showProfileView();
          }
        });
        return;
      }
      showChecklistView();
    });
  if (closeChecklistBtn)
    closeChecklistBtn.addEventListener("click", showChatView);
  if (navProfileBtn)
    navProfileBtn.addEventListener("click", (e) => {
      e.preventDefault();
      showProfileView();
    });
  if (closeProfileBtn)
    closeProfileBtn.addEventListener("click", showChatView);

  // Handle Profile Update Form
  document.getElementById("profile-update-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const kelas = document.getElementById("profile-kelas").value;
    const alamat = document.getElementById("profile-alamat").value;
    const fotoFile = document.getElementById("profile-foto").files[0];
    
    const formData = new FormData();
    formData.append("kelas", kelas);
    formData.append("alamat", alamat);
    if (fotoFile) {
      formData.append("foto_profil", fotoFile);
    }
    
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        Swal.fire({ icon: "success", title: "Berhasil", text: "Profil berhasil diperbarui", confirmButtonColor: "#ef4444" });
        await syncUserProfile();
      } else {
        const data = await res.json();
        Swal.fire({ icon: "error", title: "Gagal", text: data.error || "Gagal memperbarui profil", confirmButtonColor: "#ef4444" });
      }
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: "Terjadi kesalahan sistem", confirmButtonColor: "#ef4444" });
    }
  });

  // Handle Onboarding Form
  document.getElementById("onboarding-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const sks = document.getElementById("ob-sks").value;
    const ipk = document.getElementById("ob-ipk").value;
    const status_akademik = document.getElementById("ob-status").value;
    const status_prasyarat = document.getElementById("ob-prasyarat").value;
    const errorDiv = document.getElementById("ob-error");
    
    try {
      const res = await fetch("/api/eligibility/check", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sks, ipk, status_akademik, status_prasyarat })
      });
      const result = await res.json();
      
      if (result.success) {
        document.getElementById("onboarding-modal").style.display = "none";
        const currentUser = JSON.parse(localStorage.getItem("kppedia_user") || "null") || {};
        localStorage.setItem("has_onboarded_" + currentUser.username, "true");
        
        if (result.isEligible) {
          currentUser.is_eligible = true;
          localStorage.setItem("kppedia_user", JSON.stringify(currentUser));
          updateChecklistLockStatus();
          Swal.fire({
            icon: "success",
            title: "Selamat! Anda Lolos",
            html: "Anda telah memenuhi syarat untuk mendaftar Kerja Praktik.<br>Fitur <b>Smart Checklist</b> sekarang telah terbuka!",
            confirmButtonColor: "#2ecc71"
          });
        } else {
          Swal.fire({
            icon: "info",
            title: "Belum Memenuhi Syarat",
            html: result.message,
            confirmButtonColor: "#ef4444"
          });
          // Update profile view to show not eligible immediately
          showProfileView();
        }
      } else {
        errorDiv.textContent = result.message || "Gagal memverifikasi kelayakan.";
        errorDiv.style.display = "block";
      }
    } catch (err) {
      errorDiv.textContent = "Terjadi kesalahan saat menghubungi server.";
      errorDiv.style.display = "block";
    }
  });

  // Skip and Close Onboarding Logic
  function skipOnboarding() {
    document.getElementById("onboarding-modal").style.display = "none";
    const currentUser = JSON.parse(localStorage.getItem("kppedia_user") || "null") || {};
    if (currentUser.username) {
      localStorage.setItem("has_onboarded_" + currentUser.username, "true");
    }
  }

  document.getElementById("skip-onboarding-btn").addEventListener("click", skipOnboarding);
  document.getElementById("close-onboarding-btn").addEventListener("click", skipOnboarding);

  document.getElementById("btn-reverify-profile").addEventListener("click", () => {
    document.getElementById("onboarding-modal").style.display = "flex";
  });

  // Load Conversations
  async function loadConversations() {
    try {
      const res = await fetch("/api/chat/conversations", {
        headers: {
          Authorization: `Bearer ${token}`
        },
      });
      if (res.ok) {
        const conversations = await res.json();
        if (historyList) {
          historyList.innerHTML = "";
          conversations.forEach((conv) => {
            const div = document.createElement("div");
            div.className = `history-item ${conv.id === currentConversationId ? "active" : ""}`;
            div.innerHTML = `
                            <div class="history-item-left" title="${conv.title}">
                                <i class="fa-regular fa-message"></i> <span>${conv.title}</span>
                            </div>
                            <button class="delete-chat-btn" title="Hapus Percakapan">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        `;
            div
              .querySelector(".history-item-left")
              .addEventListener("click", () =>
                loadConversationMessages(conv.id),
              );
            div
              .querySelector(".delete-chat-btn")
              .addEventListener("click", (e) => {
                e.stopPropagation();
                deleteConversation(conv.id);
              });
            historyList.appendChild(div);
          });
        }
      }
    } catch (e) {
      console.error("Error loading history", e);
    }
  }

  async function deleteConversation(id) {
    if (
      !confirm(
        "Apakah Anda yakin ingin menghapus percakapan ini secara permanen?",
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/chat/conversations/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        },
      });
      if (res.ok) {
        if (currentConversationId === id) {
          document.getElementById("new-chat-btn").click();
        } else {
          loadConversations();
        }
      } else {
        alert("Gagal menghapus percakapan.");
      }
    } catch (e) {
      console.error("Error deleting chat", e);
    }
  }

  async function loadConversationMessages(id) {
    currentConversationId = id;
    loadConversations(); // refresh active state
    showChatView(); // Pastikan tampilkan chat view saat buka history

    chatMessages.innerHTML = ""; // clear chat
    try {
      const res = await fetch(`/api/chat/conversations/${id}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
      });
      if (res.ok) {
        const messages = await res.json();
        messages.forEach((msg) => appendMessage(msg.role, msg.content));
      }
    } catch (e) {
      console.error("Error loading messages", e);
    }

    if (window.innerWidth <= 768) {
      document.getElementById("chat-sidebar").classList.remove("active");
    }
  }

  loadConversations();
  syncChecklistFromBackend();

  function appendMessage(role, text) {
    const msg = document.createElement("div");
    msg.classList.add("chat-msg", role);

    let attachmentHtml = "";
    let optionsHtml = "";
    let processedText = text;

    // Parse special [LINK:name|url] tag
    const linkRegex = /\[LINK:([^|]+)\|([^\]]+)\]/g;
    const linkMatch = linkRegex.exec(processedText);
    if (linkMatch) {
      const linkName = linkMatch[1];
      const linkUrl = linkMatch[2];
      processedText = processedText.replace(linkMatch[0], '').trim();

      attachmentHtml = `
                <div class="chat-document-card">
                    <div class="doc-icon"><i class="fa-solid fa-link"></i></div>
                    <div class="doc-info">
                        <div class="doc-name">${linkName}</div>
                        <div class="doc-size">Website Link</div>
                    </div>
                    <a href="${linkUrl}" target="_blank" class="doc-download" title="Buka Tautan">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </a>
                </div>
            `;
    }

    // Parse special [ATTACHMENT:name|url] tag
    const attachmentRegex = /\[ATTACHMENT:([^|]+)\|([^\]]+)\]/g;
    const match = attachmentRegex.exec(processedText);
    if (match) {
      const fileName = match[1];
      const fileUrl = match[2];
      // Hapus tag dari teks pesan
      processedText = processedText.replace(match[0], '').trim();

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
      processedText = processedText.replace(optMatch[0], "").trim();
      const optionsArray = optionsString.split(",");

      let buttonsHtml = optionsArray
        .map((opt) => `<button class="chat-option-btn">${opt}</button>`)
        .join("");
      optionsHtml = `<div class="chat-options-container">${buttonsHtml}</div>`;
    }

    const renderedText =
      role === "bot" ? marked.parse(processedText) : processedText;
    msg.innerHTML = `
            <div class="chat-msg-avatar">
                <i class="fa-solid ${role === "bot" ? "fa-robot" : "fa-user"}"></i>
            </div>
            <div class="chat-msg-bubble">
                ${renderedText}
                ${attachmentHtml}
                ${optionsHtml}
            </div>`;
    chatMessages.appendChild(msg);

    // Bind events for option buttons
    if (optionsHtml) {
      const buttons = msg.querySelectorAll(".chat-option-btn");
      buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
          chatInput.value = "Saya butuh dokumen " + btn.textContent;
          sendMessage();
        });
      });
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showTyping() {
    const typing = document.createElement("div");
    typing.classList.add("chat-msg", "bot", "chat-typing");
    typing.id = "typing-indicator";
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
    const typing = document.getElementById("typing-indicator");
    if (typing) typing.remove();
  }

  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    appendMessage("user", message);
    chatInput.value = "";
    sendBtn.disabled = true;
    showTyping();

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          conversationId: currentConversationId,
        }),
      });
      const data = await response.json();
      hideTyping();

      if (response.status === 401 || response.status === 403) {
        appendMessage(
          "bot",
          data.error || "Sesi telah berakhir, silakan login kembali.",
        );
        localStorage.removeItem("kppedia_token");
        localStorage.removeItem("kppedia_user");
        setTimeout(() => (window.location.href = "auth.html"), 2000);
      } else {
        appendMessage("bot", data.reply || "Maaf, terjadi kesalahan.");
        if (data.conversationId) {
          currentConversationId = data.conversationId;
          loadConversations();
        }
      }
    } catch (error) {
      hideTyping();
      appendMessage("bot", "Maaf, tidak dapat terhubung ke server.");
    } finally {
      sendBtn.disabled = false;
      chatInput.focus();
    }
  }

  sendBtn.addEventListener("click", () => {
    sendMessage();
  });

  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  // New Chat Button
  // New Chat Button
  document.getElementById("new-chat-btn").addEventListener("click", () => {
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
  // global variables for checklist already defined below

  async function fetchChecklistMaster() {
    if (checklistStages.length > 0) return;
    try {
      const res = await fetch("/api/checklists/master", { headers: { Authorization: `Bearer ${token}` }});
      if (res.ok) {
        checklistStages = await res.json();
      }
    } catch(e) {
      console.error("Gagal load checklist master", e);
    }
  }

  function getSubtaskData() {
    return JSON.parse(localStorage.getItem("kp-subtasks")) || {};
  }

  function saveSubtaskData(data) {
    localStorage.setItem("kp-subtasks", JSON.stringify(data));
  }

  /**
   * Mengambil data checklist/subtask pengguna dari database backend
   * dan menyimpannya ke dalam localStorage sebagai cache lokal.
   * 
   * @async
   * @function syncChecklistFromBackend
   * @returns {Promise<void>}
   */
  async function syncChecklistFromBackend() {
    try {
      const res = await fetch("/api/checklist", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const completed = [];
        const subtaskData = {};

        data.forEach(row => {
          if (row.is_completed) {
            if (row.task_id.startsWith("stage_")) {
              const stageIndex = parseInt(row.task_id.split("_")[1], 10);
              if (!isNaN(stageIndex)) {
                completed.push(stageIndex);
              }
            } else if (row.task_id.startsWith("subtask_")) {
              const parts = row.task_id.split("_");
              const parentIndex = parseInt(parts[1], 10);
              const subIndex = parseInt(parts[2], 10);
              if (!isNaN(parentIndex) && !isNaN(subIndex)) {
                if (!subtaskData[parentIndex]) {
                  subtaskData[parentIndex] = [];
                }
                subtaskData[parentIndex].push(subIndex);
              }
            }
          }
        });

        localStorage.setItem("kp-checklist", JSON.stringify(completed));
        localStorage.setItem("kp-subtasks", JSON.stringify(subtaskData));
      }
    } catch (err) {
      console.error("Gagal sinkronisasi checklist dengan backend:", err);
    }
  }

  async function loadSubmissions() {
    try {
      const res = await fetch("/api/checklist/submissions", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        userSubmissions = {};
        data.forEach(sub => {
          if (!userSubmissions[sub.task_id] || userSubmissions[sub.task_id].created_at < sub.created_at) {
            userSubmissions[sub.task_id] = sub; // Store latest submission
          }
        });
      }
    } catch (e) {
      console.error("Gagal load submissions:", e);
    }
  }

  // reder checklist
  function loadChecklists() {
    const container = document.getElementById("checklist-container");

    let completed = JSON.parse(localStorage.getItem("kp-checklist")) || [];

    container.innerHTML = "";

    checklistStages.forEach((item, index) => {
      const checked = completed.includes(index);
      const isHardTask = hardTasks.includes(index);
      const submission = userSubmissions[`stage_${index}`];

      let subTaskHTML = "";

      if (item.subTasks && !isHardTask) {
        const subtaskData = getSubtaskData();

        subTaskHTML = `
        <div class="subtask-wrapper">

        ${item.subTasks
          .map((sub, subIndex) => {
            const subChecked = subtaskData[index]?.includes(subIndex);

            return `
                <label class="subtask-item">

                    <input
                        type="checkbox"
                        class="subtask-checkbox"
                        data-parent="${index}"
                        data-sub="${subIndex}"
                        ${subChecked ? "checked" : ""}>

                    <span>${sub}</span>

                </label>
            `;
          })
          .join("")}

        </div>
        `;
      }

      let hardTaskHTML = "";
      if (isHardTask) {
        if (checked) {
           hardTaskHTML = `<div style="margin-top: 10px; color: #10b981; font-size: 0.9rem;"><i class="fa-solid fa-check-circle"></i> Berkas Disetujui</div>`;
        } else if (submission) {
           if (submission.status === 'pending') {
             hardTaskHTML = `
               <div style="margin-top: 10px; color: #f59e0b; font-size: 0.9rem;">
                 <i class="fa-solid fa-clock"></i> Menunggu Verifikasi Admin 
                 <a href="${submission.file_url}" target="_blank" style="margin-left:10px; color:var(--primary); text-decoration:underline;">Lihat File</a>
               </div>
               <button class="btn" style="margin-top: 10px; font-size: 0.8rem; padding: 0.4rem 0.8rem; border: 1px solid var(--border-light); background: var(--bg-card); color: var(--text-main);" onclick="openUploadModal('stage_${index}', '${item.title}')">Unggah Ulang Bukti</button>
             `;
           } else if (submission.status === 'rejected') {
             hardTaskHTML = `
               <div style="margin-top: 10px; color: #ef4444; font-size: 0.9rem;">
                 <i class="fa-solid fa-times-circle"></i> Berkas Ditolak
                 <div style="margin-top: 5px; font-size: 0.85rem; color: var(--text-muted);">Alasan: ${submission.admin_feedback}</div>
               </div>
               <button class="btn btn-primary" style="margin-top: 10px; font-size: 0.8rem; padding: 0.4rem 0.8rem;" onclick="openUploadModal('stage_${index}', '${item.title}')">Unggah Ulang Bukti</button>
             `;
           }
        } else {
           hardTaskHTML = `<button class="btn btn-primary" style="margin-top: 10px; font-size: 0.8rem; padding: 0.4rem 0.8rem;" onclick="openUploadModal('stage_${index}', '${item.title}')"><i class="fa-solid fa-upload"></i> Unggah Bukti</button>`;
        }
      }

      container.innerHTML += `
<div class="checklist-item ${checked ? "completed" : ""}">

    <input
        type="checkbox"
        class="checklist-checkbox"
        ${checked ? "checked" : ""}
        ${item.subTasks || isHardTask ? "disabled" : ""}
        onchange="toggleChecklist(${index})">

    <div class="checklist-content">

        <label class="checklist-label">
            ${item.title}
        </label>

        <p class="checklist-desc">
            ${item.description}
        </p>

        ${subTaskHTML}
        ${hardTaskHTML}

    </div>

</div>
`;
    });

    updateProgress();
    bindSubtaskEvents();
  }

  // Upload Modal Functions
  window.openUploadModal = function(taskId, taskTitle) {
    document.getElementById("upload-task-id").value = taskId;
    document.getElementById("upload-modal-title").textContent = "Unggah Bukti: " + taskTitle;
    document.getElementById("upload-error").style.display = "none";
    document.getElementById("upload-file").value = "";
    document.getElementById("upload-modal").style.display = "flex";
  }

  document.getElementById("close-upload-btn").addEventListener("click", () => {
    document.getElementById("upload-modal").style.display = "none";
  });

  document.getElementById("upload-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const taskId = document.getElementById("upload-task-id").value;
    const fileInput = document.getElementById("upload-file");
    const errorDiv = document.getElementById("upload-error");
    const submitBtn = document.getElementById("upload-submit-btn");

    if (!fileInput.files[0]) {
      errorDiv.textContent = "Silakan pilih file dokumen.";
      errorDiv.style.display = "block";
      return;
    }

    const formData = new FormData();
    formData.append("task_id", taskId);
    formData.append("file", fileInput.files[0]);

    submitBtn.disabled = true;
    submitBtn.textContent = "Mengunggah...";
    errorDiv.style.display = "none";

    try {
      const response = await fetch("/api/checklist/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        document.getElementById("upload-modal").style.display = "none";
        Swal.fire({
          icon: "success",
          title: "Berhasil",
          text: result.message,
          confirmButtonColor: "#ef4444"
        });
        await loadSubmissions();
        loadChecklists();
      } else {
        errorDiv.textContent = result.error || "Gagal mengunggah file.";
        errorDiv.style.display = "block";
      }
    } catch (err) {
      errorDiv.textContent = "Terjadi kesalahan koneksi server.";
      errorDiv.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Unggah Dokumen";
    }
  });

  /**
   * Mengubah status centang (checked/unchecked) untuk stage utama checklist
   * dan menyinkronkan perubahan tersebut ke database backend.
   * 
   * @async
   * @function toggleChecklist
   * @param {number} index - Indeks stage utama checklist yang di-toggle
   * @returns {Promise<void>}
   */
  window.toggleChecklist = async function (index) {
    let completed = JSON.parse(localStorage.getItem("kp-checklist")) || [];
    let isCompleted = false;

    if (completed.includes(index)) {
      completed = completed.filter((i) => i !== index);
    } else {
      completed.push(index);
      isCompleted = true;
    }

    localStorage.setItem("kp-checklist", JSON.stringify(completed));

    loadChecklists();

    try {
      await fetch("/api/checklist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          taskId: `stage_${index}`,
          isCompleted: isCompleted ? 1 : 0
        })
      });
    } catch (err) {
      console.error("Gagal menyimpan ke backend:", err);
    }
  };

  function bindSubtaskEvents() {
    const subTasks = document.querySelectorAll(".subtask-checkbox");

    subTasks.forEach((cb) => {
      cb.addEventListener("change", handleSubtaskChange);
    });
  }

  /**
   * Menangani perubahan (check/uncheck) pada checkbox subtask,
   * memperbarui cache lokal, memvalidasi kelayakan induk stage,
   * serta menyinkronkan data subtask tersebut ke database backend.
   * 
   * @async
   * @function handleSubtaskChange
   * @param {Event} event - Event change dari elemen checkbox subtask
   * @returns {Promise<void>}
   */
  async function handleSubtaskChange(event) {
    const parent = event.target.dataset.parent;

    const subIndex = Number(event.target.dataset.sub);

    const checked = event.target.checked;

    const subtaskData = getSubtaskData();

    if (!subtaskData[parent]) {
      subtaskData[parent] = [];
    }

    if (checked) {
      if (!subtaskData[parent].includes(subIndex)) {
        subtaskData[parent].push(subIndex);
      }
    } else {
      subtaskData[parent] = subtaskData[parent].filter((i) => i !== subIndex);
    }

    saveSubtaskData(subtaskData);

    checkPelaksanaanKP();

    try {
      await fetch("/api/checklist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          taskId: `subtask_${parent}_${subIndex}`,
          isCompleted: checked ? 1 : 0
        })
      });
    } catch (err) {
      console.error("Gagal menyimpan subtask ke backend:", err);
    }
  }

  /**
   * Memvalidasi apakah seluruh subtask dari stage "Pelaksanaan Kerja Praktik" (indeks 7)
   * sudah selesai. Jika seluruh subtask selesai, secara otomatis menandai stage utama
   * sebagai selesai dan menyinkronkan status stage tersebut ke backend.
   * 
   * @function checkPelaksanaanKP
   * @returns {void}
   */
  function checkPelaksanaanKP() {
    const subtaskData = getSubtaskData();
    let completed = JSON.parse(localStorage.getItem("kp-checklist")) || [];
    let anyChanged = false;

    checklistStages.forEach((stage, index) => {
      if (stage.subTasks && stage.subTasks.length > 0) {
        const totalSubtasks = stage.subTasks.length;
        const completedSubtasks = subtaskData[index] || [];
        const allDone = completedSubtasks.length === totalSubtasks;
        
        if (allDone) {
          if (!completed.includes(index)) {
            completed.push(index);
            anyChanged = true;
            syncStageCompletion(index, 1);
          }
        } else {
          if (completed.includes(index)) {
            completed = completed.filter((i) => i !== index);
            anyChanged = true;
            syncStageCompletion(index, 0);
          }
        }
      }
    });

    if (anyChanged) {
      localStorage.setItem("kp-checklist", JSON.stringify(completed));
      loadChecklists();
    }
  }

  function syncStageCompletion(index, isCompleted) {
    fetch("/api/checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ taskId: `stage_${index}`, isCompleted })
    }).catch(console.error);
  }

  //update progress bar
  function updateProgress() {
    const completed = JSON.parse(localStorage.getItem("kp-checklist")) || [];

    const percentage = Math.round(
      (completed.length / checklistStages.length) * 100,
    );

    document.getElementById("progress-fill").style.width = percentage + "%";

    document.getElementById("progress-text").innerText =
      percentage + "% Selesai";

    const nextStage = checklistStages.find((_, i) => !completed.includes(i));

    document.getElementById("next-step-text").innerText = nextStage ?
      nextStage.title :
      "Semua Tahapan KP Selesai";

    const total = checklistStages.length;
    const done = completed.length;

    document.getElementById("progress-text").innerText =
      `${percentage}% Selesai (${done}/${total})`;
  }

  document.getElementById("reset-checklist").addEventListener("click", async () => {
    const confirmReset = confirm(
      "Apakah Anda yakin ingin menghapus seluruh progress KP?",
    );

    if (!confirmReset) return;

    localStorage.removeItem("kp-checklist");

    localStorage.removeItem("kp-subtasks");

    loadChecklists();

    try {
      await fetch("/api/checklist", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (err) {
      console.error("Gagal menghapus data checklist di server:", err);
    }
  });


});