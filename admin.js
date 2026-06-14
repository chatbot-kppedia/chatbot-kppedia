document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("kppedia_token");
    const user = JSON.parse(localStorage.getItem("kppedia_user") || "null");
  
    // Protect route: Only admin
    if (!token || !user || user.role !== 'admin') {
      window.location.href = "auth.html";
      return;
    }
  
    // Display user info
    const userProfileDisplay = document.getElementById("user-profile-display");
    if (userProfileDisplay) {
      userProfileDisplay.innerHTML = `<i class="fa-solid fa-user-shield"></i> <span>${user.username} (Admin)</span>`;
    }
  
    // Logout Logic
    document.getElementById("admin-logout-btn").addEventListener("click", () => {
      if (confirm("Apakah Anda yakin ingin keluar?")) {
        localStorage.removeItem("kppedia_token");
        localStorage.removeItem("kppedia_user");
        window.location.href = "index.html";
      }
    });
  
    // Theme toggle
    const themeToggleBtn = document.getElementById("theme-toggle");
    const themeIcon = themeToggleBtn.querySelector("i");
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      themeIcon.classList.replace("fa-moon", "fa-sun");
    }
  
    themeToggleBtn.addEventListener("click", () => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
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
  
    // Navigation
    const navDocs = document.getElementById("nav-documents");
    const navChecklists = document.getElementById("nav-checklists");
    const navEligibility = document.getElementById("nav-eligibility");
    const pageTitle = document.getElementById("page-title");
    const mainContent = document.getElementById("main-content");
  
    navDocs.addEventListener("click", (e) => {
        e.preventDefault();
        setActiveNav(navDocs);
        pageTitle.innerText = "Manajemen Dokumen Chatbot";
        renderDocuments();
    });

    navChecklists.addEventListener("click", (e) => {
        e.preventDefault();
        setActiveNav(navChecklists);
        pageTitle.innerText = "Manajemen Smart Checklist";
        renderChecklists();
    });

    navEligibility.addEventListener("click", (e) => {
        e.preventDefault();
        setActiveNav(navEligibility);
        pageTitle.innerText = "Manajemen Cek Kelayakan";
        renderEligibility();
    });

    function setActiveNav(navEl) {
        [navDocs, navChecklists, navEligibility].forEach(el => el.classList.remove('active'));
        navEl.classList.add('active');
    }

    // --- DOCUMENTS LOGIC ---
    async function renderDocuments() {
        mainContent.innerHTML = '<p>Memuat data...</p>';
        try {
            const res = await fetch("/api/admin/documents", { headers: { Authorization: `Bearer ${token}` } });
            const docs = await res.json();

            let html = `
                <button class="btn btn-primary mb-4" onclick="showDocumentForm()"><i class="fa-solid fa-plus"></i> Tambah Dokumen</button>
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nama Dokumen</th>
                            <th>Tipe</th>
                            <th>URL</th>
                            <th>Keywords</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            docs.forEach(doc => {
                html += `
                    <tr>
                        <td>${doc.id}</td>
                        <td>${doc.name}</td>
                        <td>${doc.type}</td>
                        <td>${doc.url}</td>
                        <td>${doc.keywords.join(", ")}</td>
                        <td>
                            <button class="admin-action-btn btn-edit" onclick='editDocument(${JSON.stringify(doc).replace(/'/g, "&apos;")})'><i class="fa-solid fa-edit"></i></button>
                            <button class="admin-action-btn btn-delete" onclick="deleteDocument('${doc.id}')"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            });
            html += `</tbody></table>`;
            mainContent.innerHTML = html;
        } catch (e) {
            mainContent.innerHTML = '<p>Error memuat data.</p>';
        }
    }

    window.showDocumentForm = (doc = null) => {
        const isEdit = !!doc;
        const keywordsStr = isEdit ? doc.keywords.join(", ") : "";
        mainContent.innerHTML = `
            <div class="glass-panel" style="padding: 2rem; max-width: 600px;">
                <h3>${isEdit ? 'Edit Dokumen' : 'Tambah Dokumen'}</h3>
                <form id="doc-form" style="margin-top: 1rem;">
                    <div class="admin-form-group">
                        <label>ID Dokumen (tanpa spasi)</label>
                        <input type="text" id="doc-id" value="${isEdit ? doc.id : ''}" required>
                    </div>
                    <div class="admin-form-group">
                        <label>Nama Dokumen</label>
                        <input type="text" id="doc-name" value="${isEdit ? doc.name : ''}" required>
                    </div>
                    <div class="admin-form-group">
                        <label>Tipe</label>
                        <select id="doc-type">
                            <option value="link" ${isEdit && doc.type === 'link' ? 'selected' : ''}>Link</option>
                            <option value="pdf_upload" ${isEdit && doc.type === 'pdf' ? 'selected' : ''}>PDF (Upload File Baru)</option>
                        </select>
                    </div>
                    <div class="admin-form-group" id="url-group">
                        <label>URL / Path</label>
                        <input type="text" id="doc-url" value="${isEdit ? doc.url : ''}" ${isEdit ? 'required' : ''}>
                    </div>
                    <div class="admin-form-group" id="file-group" style="display: none;">
                        <label>Upload File PDF</label>
                        <input type="file" id="doc-file" accept="application/pdf">
                        ${isEdit && doc.type === 'pdf' ? '<small style="color:var(--text-light); display:block; margin-top:0.5rem;">Biarkan kosong jika tidak ingin mengubah file PDF saat ini.</small>' : ''}
                    </div>
                    <div class="admin-form-group">
                        <label>Keywords (pisahkan dengan koma)</label>
                        <input type="text" id="doc-keywords" value="${keywordsStr}" required>
                    </div>
                    <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Simpan'}</button>
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('nav-documents').click()">Batal</button>
                </form>
            </div>
        `;

        const typeSelect = document.getElementById("doc-type");
        const urlGroup = document.getElementById("url-group");
        const fileGroup = document.getElementById("file-group");
        const docUrl = document.getElementById("doc-url");
        const docFile = document.getElementById("doc-file");

        function toggleInputs() {
            if (typeSelect.value === 'pdf_upload') {
                urlGroup.style.display = 'none';
                fileGroup.style.display = 'block';
                docUrl.removeAttribute('required');
                if (!isEdit || (isEdit && doc.type !== 'pdf')) {
                    docFile.setAttribute('required', 'true');
                } else {
                    docFile.removeAttribute('required');
                }
            } else {
                urlGroup.style.display = 'block';
                fileGroup.style.display = 'none';
                docUrl.setAttribute('required', 'true');
                docFile.removeAttribute('required');
            }
        }
        typeSelect.addEventListener('change', toggleInputs);
        toggleInputs();

        document.getElementById("doc-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const formData = new FormData();
            formData.append("id", document.getElementById("doc-id").value);
            formData.append("name", document.getElementById("doc-name").value);
            formData.append("type", document.getElementById("doc-type").value);
            formData.append("keywords", document.getElementById("doc-keywords").value.split(",").map(k => k.trim()).join(","));

            if (document.getElementById("doc-type").value === 'pdf_upload') {
                const fileInput = document.getElementById("doc-file");
                if (fileInput.files.length > 0) {
                    formData.append("file", fileInput.files[0]);
                }
            } else {
                formData.append("url", document.getElementById("doc-url").value);
            }

            const url = isEdit ? `/api/admin/documents/${doc.id}` : `/api/admin/documents`;
            const method = isEdit ? `PUT` : `POST`;

            try {
                const res = await fetch(url, {
                    method,
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData
                });
                if (res.ok) {
                    Swal.fire('Berhasil', isEdit ? 'Dokumen diupdate' : 'Dokumen ditambahkan', 'success');
                    renderDocuments();
                } else {
                    const data = await res.json();
                    Swal.fire('Gagal', data.error, 'error');
                }
            } catch (err) {
                Swal.fire('Error', 'Terjadi kesalahan jaringan', 'error');
            }
        });
    };

    window.editDocument = (doc) => showDocumentForm(doc);
    
    window.deleteDocument = async (id) => {
        if (!confirm(`Hapus dokumen ${id}?`)) return;
        try {
            const res = await fetch(`/api/admin/documents/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                Swal.fire('Terhapus', 'Dokumen dihapus', 'success');
                renderDocuments();
            } else {
                Swal.fire('Gagal', 'Tidak dapat menghapus dokumen', 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'Terjadi kesalahan jaringan', 'error');
        }
    };


    // --- CHECKLISTS LOGIC ---
    async function renderChecklists() {
        mainContent.innerHTML = '<p>Memuat data...</p>';
        try {
            const res = await fetch("/api/admin/checklists", { headers: { Authorization: `Bearer ${token}` } });
            const checklists = await res.json();

            let html = `
                <button class="btn btn-primary mb-4" onclick="showChecklistForm()"><i class="fa-solid fa-plus"></i> Tambah Tahap</button>
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Judul Tahap</th>
                            <th>Deskripsi</th>
                            <th>Subtask</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            checklists.forEach(cl => {
                const subs = cl.subTasks.map(s => s.title).join("<br>- ");
                html += `
                    <tr>
                        <td>${cl.id}</td>
                        <td>${cl.title}</td>
                        <td>${cl.description || '-'}</td>
                        <td>${subs ? "- " + subs : "<em>Tidak ada</em>"}</td>
                        <td>
                            <button class="admin-action-btn btn-edit" onclick='editChecklist(${JSON.stringify(cl).replace(/'/g, "&apos;")})'><i class="fa-solid fa-edit"></i></button>
                            <button class="admin-action-btn btn-delete" onclick="deleteChecklist(${cl.id})"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            });
            html += `</tbody></table>`;
            mainContent.innerHTML = html;
        } catch (e) {
            mainContent.innerHTML = '<p>Error memuat data.</p>';
        }
    }

    window.showChecklistForm = (cl = null) => {
        const isEdit = !!cl;
        const subTasksStr = isEdit ? cl.subTasks.map(s => s.title).join("\n") : "";
        mainContent.innerHTML = `
            <div class="glass-panel" style="padding: 2rem; max-width: 600px;">
                <h3>${isEdit ? 'Edit Tahap Checklist' : 'Tambah Tahap Checklist'}</h3>
                <form id="cl-form" style="margin-top: 1rem;">
                    <div class="admin-form-group">
                        <label>Judul Tahap</label>
                        <input type="text" id="cl-title" value="${isEdit ? cl.title : ''}" required>
                    </div>
                    <div class="admin-form-group">
                        <label>Deskripsi Singkat</label>
                        <input type="text" id="cl-desc" value="${isEdit ? (cl.description || '') : ''}">
                    </div>
                    <div class="admin-form-group">
                        <label>Subtasks (Satu baris untuk satu subtask)</label>
                        <textarea id="cl-subtasks" rows="5">${subTasksStr}</textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Simpan'}</button>
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('nav-checklists').click()">Batal</button>
                </form>
            </div>
        `;

        document.getElementById("cl-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const subStr = document.getElementById("cl-subtasks").value.trim();
            const payload = {
                title: document.getElementById("cl-title").value,
                description: document.getElementById("cl-desc").value,
                subTasks: subStr ? subStr.split("\n").map(s => s.trim()).filter(s => s) : []
            };

            const url = isEdit ? `/api/admin/checklists/${cl.id}` : `/api/admin/checklists`;
            const method = isEdit ? `PUT` : `POST`;

            try {
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    Swal.fire('Berhasil', isEdit ? 'Checklist diupdate' : 'Checklist ditambahkan', 'success');
                    renderChecklists();
                } else {
                    const data = await res.json();
                    Swal.fire('Gagal', data.error, 'error');
                }
            } catch (err) {
                Swal.fire('Error', 'Terjadi kesalahan jaringan', 'error');
            }
        });
    };

    window.editChecklist = (cl) => showChecklistForm(cl);
    
    window.deleteChecklist = async (id) => {
        if (!confirm(`Hapus tahap checklist ini?`)) return;
        try {
            const res = await fetch(`/api/admin/checklists/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                Swal.fire('Terhapus', 'Checklist dihapus', 'success');
                renderChecklists();
            } else {
                Swal.fire('Gagal', 'Tidak dapat menghapus checklist', 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'Terjadi kesalahan jaringan', 'error');
        }
    };


    // --- ELIGIBILITY LOGIC ---
    async function renderEligibility() {
        mainContent.innerHTML = '<p>Memuat data...</p>';
        try {
            const res = await fetch("/api/admin/eligibility", { headers: { Authorization: `Bearer ${token}` } });
            const criteria = await res.json();

            mainContent.innerHTML = `
                <div class="glass-panel" style="padding: 2rem; max-width: 600px;">
                    <h3>Kriteria Minimum Kelayakan KP</h3>
                    <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Atur kualifikasi minimum untuk mahasiswa agar bisa mendaftar Kerja Praktik.</p>
                    <form id="eligibility-form">
                        <div class="admin-form-group">
                            <label>SKS Minimum</label>
                            <input type="number" id="min-sks" value="${criteria.min_sks}" required>
                        </div>
                        <div class="admin-form-group">
                            <label>IPK Minimum</label>
                            <input type="number" step="0.01" id="min-ipk" value="${criteria.min_ipk}" required>
                        </div>
                        <div class="admin-form-group">
                            <label>Status Akademik yang Diizinkan</label>
                            <select id="status-required" required>
                                <option value="aktif" ${criteria.status_required === 'aktif' ? 'selected' : ''}>Aktif</option>
                                <option value="cuti" ${criteria.status_required === 'cuti' ? 'selected' : ''}>Cuti</option>
                                <option value="tidak_aktif" ${criteria.status_required === 'tidak_aktif' ? 'selected' : ''}>Tidak Aktif</option>
                            </select>
                        </div>
                        <div class="admin-form-group">
                            <label>Syarat Kelulusan Matkul Prasyarat</label>
                            <select id="prasyarat-required" required>
                                <option value="sudah" ${criteria.prasyarat_required === 'sudah' ? 'selected' : ''}>Sudah (Lulus)</option>
                                <option value="belum" ${criteria.prasyarat_required === 'belum' ? 'selected' : ''}>Belum (Tidak Wajib)</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary">Update Kriteria</button>
                    </form>
                </div>
            `;

            document.getElementById("eligibility-form").addEventListener("submit", async (e) => {
                e.preventDefault();
                const payload = {
                    min_sks: parseInt(document.getElementById("min-sks").value),
                    min_ipk: parseFloat(document.getElementById("min-ipk").value),
                    status_required: document.getElementById("status-required").value,
                    prasyarat_required: document.getElementById("prasyarat-required").value
                };

                try {
                    const updateRes = await fetch(`/api/admin/eligibility`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify(payload)
                    });
                    if (updateRes.ok) {
                        Swal.fire('Berhasil', 'Kriteria kelayakan diupdate', 'success');
                    } else {
                        Swal.fire('Gagal', 'Gagal update kriteria', 'error');
                    }
                } catch (err) {
                    Swal.fire('Error', 'Terjadi kesalahan jaringan', 'error');
                }
            });

        } catch (e) {
            mainContent.innerHTML = '<p>Error memuat data.</p>';
        }
    }

    // Default open
    navDocs.click();
});
