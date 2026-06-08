document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("kppedia_token");
  const user = JSON.parse(localStorage.getItem("kppedia_user") || "null");

  // Protect route
  if (!token || !user) {
    window.location.href = "auth.html";
    return;
  }

  // Display user info
  const userProfileDisplay = document.getElementById("user-profile-display");
  if (userProfileDisplay) {
    userProfileDisplay.innerHTML = `<i class="fa-regular fa-circle-user"></i> <span>${user.username}</span>`;
  }

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
  const eligibilityViewContainer = document.getElementById(
    "eligibility-view-container",
  );

  const navChecklistBtn = document.getElementById("nav-checklist-btn");
  const closeChecklistBtn = document.getElementById("close-checklist-btn");
  const navEligibilityBtn = document.getElementById("nav-eligibility-btn");
  const closeEligibilityBtn = document.getElementById("close-eligibility-btn");

  let currentConversationId = null;

  // --- View Toggle Logic ---
  function hideAllViews() {
    chatViewContainer.style.display = "none";
    checklistViewContainer.style.display = "none";
    eligibilityViewContainer.style.display = "none";
  }

  function showChecklistView() {
    hideAllViews();
    checklistViewContainer.style.display = "flex";
    if (window.innerWidth <= 768 && chatSidebar)
      chatSidebar.classList.remove("active");
    loadChecklists();
  }

  function showEligibilityView() {
    hideAllViews();
    eligibilityViewContainer.style.display = "flex";
    if (window.innerWidth <= 768 && chatSidebar)
      chatSidebar.classList.remove("active");
  }

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
      showChecklistView();
    });
  if (closeChecklistBtn)
    closeChecklistBtn.addEventListener("click", showChatView);
  if (navEligibilityBtn)
    navEligibilityBtn.addEventListener("click", (e) => {
      e.preventDefault();
      showEligibilityView();
    });
  if (closeEligibilityBtn)
    closeEligibilityBtn.addEventListener("click", showChatView);

  // Load Conversations
  async function loadConversations() {
    try {
      const res = await fetch("/api/chat/conversations", {
        headers: { Authorization: `Bearer ${token}` },
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
        headers: { Authorization: `Bearer ${token}` },
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
        headers: { Authorization: `Bearer ${token}` },
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

  function appendMessage(role, text) {
    const msg = document.createElement("div");
    msg.classList.add("chat-msg", role);

    let attachmentHtml = "";
    let optionsHtml = "";
    let processedText = text;

    // Parse special [ATTACHMENT:name|url] tag
    const attachmentRegex = /\[ATTACHMENT:([^|]+)\|([^\]]+)\]/g;
    const match = attachmentRegex.exec(text);
    if (match) {
      const fileName = match[1];
      const fileUrl = match[2];
      // Hapus tag dari teks pesan
      processedText = text.replace(match[0], "").trim();

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
  const checklistStages = [
    {
      title: "Verifikasi Syarat Kerja Praktik",
      description:
        "Pastikan telah lulus minimal 90 SKS dan memenuhi syarat KP.",
    },
    {
      title: "Pencarian Instansi & Konsultasi Dosen Pembimbing Akademik",
      description:
        "Mencari perusahaan tujuan dan berdiskusi dengan Dosen Pembimbing Akademik.",
    },
    {
      title: "Penyusunan Proposal Kerja Praktik",
      description: "Menyusun proposal sesuai format pedoman KP.",
    },
    {
      title: "Pengajuan Permohonan Kerja Praktik",
      description: "Mengisi formulir pengajuan KP dan mengunggah proposal.",
    },
    {
      title: "Pengajuan Surat Pengantar TOSS",
      description: "Mengajukan surat pengantar KP melalui TOSS.",
    },
    {
      title: "Pengiriman Proposal ke Instansi",
      description:
        "Mengirim surat pengantar dan proposal ke perusahaan tujuan.",
    },
    {
      title: "Penerimaan dari Instansi",
      description: "Menerima surat penerimaan dari perusahaan atau instansi.",
    },
    {
      title: "Pelaksanaan Kerja Praktik",
      description: "Melaksanakan KP sesuai jadwal, minimal 6 minggu.",
      subTasks: [
        "Pelaksanaan Tugas KP sesuai Rencana dan Arahan Pembimbing Lapangan",
        "Mengumpulkan Data dan Informasi terkait Tugas KP",
        "Dokumentasi Kegiatan KP",

        "Bimbingan DPA 1",
        "Bimbingan DPA 2",
        "Bimbingan DPA 3",
        "Bimbingan DPA 4",

        "Bimbingan Lapangan 1",
        "Bimbingan Lapangan 2",
        "Bimbingan Lapangan 3",
        "Bimbingan Lapangan 4",

        "Menyelesaikan Tugas dari Pembimbing Lapangan",
        "Penyampaian Hasil KP ke Perusahaan",
        "Penilaian Perusahaan Diterima",

        "Selesai KP",
      ],
    },
    {
      title: "Penyusunan Laporan Kerja Praktik",
      description: "Menyusun laporan akhir berdasarkan hasil KP.",
    },
    {
      title: "Presentasi Hasil Kerja Praktik",
      description: "Melakukan presentasi hasil KP kepada dosen pembimbing.",
    },
    {
      title: "Pengumpulan Laporan Akhir",
      description:
        "Mengunggah laporan ke OpenLib dan mengisi formulir pengumpulan.",
    },
  ];

  function getSubtaskData() {
    return JSON.parse(localStorage.getItem("kp-subtasks")) || {};
  }

  function saveSubtaskData(data) {
    localStorage.setItem("kp-subtasks", JSON.stringify(data));
  }

  // reder checklist
  function loadChecklists() {
    const container = document.getElementById("checklist-container");

    let completed = JSON.parse(localStorage.getItem("kp-checklist")) || [];

    container.innerHTML = "";

    checklistStages.forEach((item, index) => {
      const checked = completed.includes(index);

      let subTaskHTML = "";

      if (item.subTasks) {
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

      container.innerHTML += `
<div class="checklist-item ${checked ? "completed" : ""}">

    <input
        type="checkbox"
        class="checklist-checkbox"
        ${checked ? "checked" : ""}
        ${item.subTasks ? "disabled" : ""}
        onchange="toggleChecklist(${index})">

    <div class="checklist-content">

        <label class="checklist-label">
            ${item.title}
        </label>

        <p class="checklist-desc">
            ${item.description}
        </p>

        ${subTaskHTML}

    </div>

</div>
`;
    });

    updateProgress();
    bindSubtaskEvents();
  }

  // toggle checklist
  window.toggleChecklist = function (index) {
    let completed = JSON.parse(localStorage.getItem("kp-checklist")) || [];

    if (completed.includes(index)) {
      completed = completed.filter((i) => i !== index);
    } else {
      completed.push(index);
    }

    localStorage.setItem("kp-checklist", JSON.stringify(completed));

    loadChecklists();
  };

  function bindSubtaskEvents() {
    const subTasks = document.querySelectorAll(".subtask-checkbox");

    subTasks.forEach((cb) => {
      cb.addEventListener("change", handleSubtaskChange);
    });
  }

  function handleSubtaskChange(event) {
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
  }

  function checkPelaksanaanKP() {
    const pelaksanaanIndex = 7;

    const subtaskData = getSubtaskData();

    const totalSubtasks = checklistStages[pelaksanaanIndex].subTasks.length;

    const completedSubtasks = subtaskData[pelaksanaanIndex] || [];

    let completed = JSON.parse(localStorage.getItem("kp-checklist")) || [];

    const allDone = completedSubtasks.length === totalSubtasks;

    if (allDone) {
      if (!completed.includes(pelaksanaanIndex)) {
        completed.push(pelaksanaanIndex);
      }
    } else {
      completed = completed.filter((i) => i !== pelaksanaanIndex);
    }

    localStorage.setItem("kp-checklist", JSON.stringify(completed));

    loadChecklists();
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

    document.getElementById("next-step-text").innerText = nextStage
      ? nextStage.title
      : "Semua Tahapan KP Selesai";

    const total = checklistStages.length;
    const done = completed.length;

    document.getElementById("progress-text").innerText =
      `${percentage}% Selesai (${done}/${total})`;
  }

  document.getElementById("reset-checklist").addEventListener("click", () => {
    const confirmReset = confirm(
      "Apakah Anda yakin ingin menghapus seluruh progress KP?",
    );

    if (!confirmReset) return;

    localStorage.removeItem("kp-checklist");

    localStorage.removeItem("kp-subtasks");

    loadChecklists();
  });

  // Fungsi global untuk menampilkan hasil kelayakan
  window.tampilkanHasilKelayakan = function () {
    // 1. Ambil elemen dari HTML
    const sksInput = document.getElementById("input-sks");
    const ipkInput = document.getElementById("input-ipk");
    const statusInput = document.getElementById("input-status");
    const prasyaratInput = document.getElementById("input-prasyarat");
    const tempatHasil = document.getElementById("tempat-hasil");

    // Pastikan tempat-hasil ditemukan
    if (!tempatHasil) {
      alert("Sistem Error: ID 'tempat-hasil' tidak ditemukan di HTML!");
      return;
    }

    // 2. Ambil nilai input
    const sksValue = sksInput.value;
    const ipkValue = ipkInput.value;
    const statusValue = statusInput.value;
    const prasyaratValue = prasyaratInput.value;

    // 3. Peringatan form kosong menggunakan SweetAlert2
    if (!sksValue || !ipkValue || !statusValue || !prasyaratValue) {
      Swal.fire({
        icon: "warning",
        title: "Oops...",
        text: "Halo! Mohon lengkapi data SKS, IPK, Status, dan Matkul Prasyarat ya.",
        confirmButtonColor: "#ef4444",
        confirmButtonText: "Mengerti",
      });
      return;
    }

    // 4. Logika Kelayakan
    const sks = parseInt(sksValue);
    const ipk = parseFloat(ipkValue);
    let isEligible = false;
    let pesanHasil = "";

    if (
      sks >= 90 &&
      ipk >= 2.0 &&
      statusValue === "aktif" &&
      prasyaratValue === "sudah"
    ) {
      isEligible = true;
      pesanHasil =
        "Selamat! Anda MEMENUHI SYARAT untuk mendaftar Kerja Praktik.";
    } else {
      isEligible = false;
      pesanHasil =
        "Mohon maaf, Anda BELUM MEMENUHI SYARAT untuk mendaftar Kerja Praktik saat ini.";
    }

    // 5. Berikan styling default untuk kotaknya
    tempatHasil.style.marginTop = "1.5rem";
    tempatHasil.style.padding = "1rem";
    tempatHasil.style.borderRadius = "8px";
    tempatHasil.style.fontWeight = "600";
    tempatHasil.style.textAlign = "center";

    // 6. Tampilkan Hasil menggunakan SweetAlert2
    if (isEligible) {
      Swal.fire({
        icon: "success",
        title: "Memenuhi Syarat!",
        text: pesanHasil,
        confirmButtonColor: "#10b981",
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "Belum Memenuhi Syarat",
        text: pesanHasil,
        confirmButtonColor: "#ef4444",
      });
    }

    // Tampilkan pesannya
    tempatHasil.innerText = pesanHasil;
  };
});
