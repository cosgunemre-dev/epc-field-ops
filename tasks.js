import { db, storage } from '../../firebase-app.js';
import { 
    collection, query, where, onSnapshot, doc, updateDoc, 
    addDoc, serverTimestamp, orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
    ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const tasksContainer = document.getElementById('tasks-container');
const detailOverlay = document.getElementById('task-detail-overlay');
const detailContent = document.getElementById('task-detail-content');

// Hiyerarşi Tanımları
const ROLE_RANKS = {
    'admin': 0,
    'baskan': 1,
    'koordinator': 2,
    'mudur': 3,
    'sef': 4,
    'muhendis': 5,
    'forman': 6,
    'isci': 7
};

let currentTasks = [];
let subordinates = [];

export function initTasks() {
    const u = window.userData;
    if (!u) return;

    // Isçı mi yoksa yetkili mi?
    // Isçiler sadece kendilerine atananları görür.
    // Şefler ve üstü projelerindeki her şeyi görür (veya altındakilerine atananları).
    
    let q;
    const role = (u.role || '').toLowerCase();

    if (['isci', 'forman'].includes(role)) {
        q = query(
            collection(db, 'tasks'), 
            where('assignedTo', '==', window.user.uid)
        );
    } else {
        // Şef/Müdür: Projedeki tüm görevler
        q = query(
            collection(db, 'tasks'),
            where('projectId', '==', u.projectId)
        );
    }

    onSnapshot(q, (snapshot) => {
        // Ham veriyi al
        let tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // MANUEL SIRALAMA: Firestore index hatasını önlemek için JS tarafında sıralıyoruz
        tasks.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
            return timeB - timeA; // En yeni üstte
        });

        currentTasks = tasks;
        renderTasks();
        updateStats();
    }, (error) => {
        console.error("Firestore error:", error);
        tasksContainer.innerHTML = '<p class="text-center" style="color:var(--danger); padding:40px;">Veri bağlantı hatası.</p>';
    });

    // Alt kademeyi yükle (atama yapabilmek için)
    loadSubordinates();
}

async function loadSubordinates() {
    const u = window.userData;
    const myRole = (u.role || '').toLowerCase();
    const myRank = ROLE_RANKS[myRole] || 99;
    
    // Projedeki herkesi çek (büyük projelerde limitlenmeli)
    const q = query(collection(db, 'users'), where('projectId', '==', u.projectId));
    
    onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Sadece daha düşük rütbelileri filtrele
        subordinates = users.filter(user => {
            const itsRole = (user.role || '').toLowerCase();
            const itsRank = ROLE_RANKS[itsRole] || 99;
            return itsRank > myRank;
        });

        // Dropdown'ı doldur
        const select = document.getElementById('nt-assignee');
        if (select) {
            select.innerHTML = '<option value="">— Personel Seçin —</option>';
            subordinates.forEach(s => {
                const roleLabel = (s.role || 'isci').toUpperCase();
                select.innerHTML += `<option value="${s.id}">${s.name} [${roleLabel}]</option>`;
            });
        }
    });
}

function renderTasks() {
    if (currentTasks.length === 0) {
        tasksContainer.innerHTML = '<p class="text-center" style="color:var(--text-muted); padding:40px;">Henüz görev atanmamış.</p>';
        return;
    }

    tasksContainer.innerHTML = currentTasks.map(t => `
        <div class="task-item" onclick="openTaskDetail('${t.id}')">
            <div class="task-header">
                <span class="task-title">${t.title}</span>
                <span class="task-priority priority-${t.priority || 'normal'}">${t.priority === 'urgent' ? 'ACİL' : 'NORMAL'}</span>
            </div>
            <div class="task-meta">
                <span><i class='bx bx-calendar'></i> ${t.createdAt ? new Date(t.createdAt.toDate()).toLocaleDateString('tr-TR') : '...'}</span>
                <span class="task-status status-${t.status || 'pending'}">${getStatusLabel(t.status)}</span>
            </div>
        </div>
    `).join('');
}

function getStatusLabel(s) {
    const labels = {
        'pending': 'Beklemede',
        'ongoing': 'Devam Ediyor',
        'completed': 'Onay Bekliyor',
        'approved': 'Onaylandı',
        'returned': 'İade Edildi'
    };
    return labels[s] || s;
}

function updateStats() {
    const pending = currentTasks.filter(t => t.status === 'pending').length;
    const done = currentTasks.filter(t => t.status === 'approved').length;
    const ongoing = currentTasks.find(t => t.status === 'ongoing');

    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-done').textContent = done;

    const ongoingSection = document.getElementById('ongoing-task-section');
    const ongoingCard = document.getElementById('ongoing-task-card');

    if (ongoing) {
        ongoingSection.classList.remove('hidden');
        ongoingCard.innerHTML = `
            <div class="task-item" onclick="openTaskDetail('${ongoing.id}')" style="border-left: 4px solid var(--info);">
                <div class="task-header">
                    <span class="task-title">${ongoing.title}</span>
                </div>
                <div style="font-size: 12px; color: var(--info);">Şu an bu iş üzerindesiniz.</div>
            </div>
        `;
    } else {
        ongoingSection.classList.add('hidden');
    }
}

window.openTaskDetail = (id) => {
    const t = currentTasks.find(x => x.id === id);
    if (!t) return;

    detailOverlay.classList.remove('hidden');
    renderTaskDetail(t);
};

function renderTaskDetail(t) {
    const isOwner = t.assignedTo === window.user.uid;
    const isApprover = ['sef', 'mudur', 'koordinator', 'baskan'].includes(window.userData.role);

    let actionHtml = '';

    if (t.status === 'pending' && isOwner) {
        actionHtml = `<button class="btn btn-primary btn-block" onclick="updateTaskStatus('${t.id}', 'ongoing')"><i class='bx bx-play'></i> İşe Başla</button>`;
    } else if (t.status === 'ongoing' && isOwner) {
        actionHtml = `
            <div class="card">
                <div class="card-title">İşi Tamamla</div>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Lütfen çalışma fotoğraflarını ve notunuzu ekleyin.</p>
                <div class="photo-grid" id="photo-preview"></div>
                <input type="file" id="photo-input" multiple accept="image/*" class="hidden">
                <button class="btn btn-ghost btn-block" onclick="document.getElementById('photo-input').click()"><i class='bx bx-camera'></i> Fotoğraf Ekle</button>
                <textarea id="task-note" class="card" style="width: 100%; height: 80px; margin-top: 12px; background: var(--bg-card); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-family: inherit; font-size: 13px;" placeholder="Notunuzu buraya yazın..."></textarea>
                <button class="btn btn-success btn-block mt-20" id="btn-complete-task" onclick="completeTask('${t.id}')">Tamamla ve Onaya Gönder</button>
            </div>
        `;
    } else if (t.status === 'completed' && isApprover) {
        actionHtml = `
            <div class="card" style="border-color: var(--warning);">
                <div class="card-title"><i class='bx bx-check-shield'></i> Onay İşlemi</div>
                <div class="photo-grid">
                    ${(t.photos || []).map(p => `<div class="photo-item"><img src="${p}" onclick="window.open('${p}')"></div>`).join('')}
                </div>
                <div class="card" style="font-size: 13px; font-style: italic; background: rgba(0,0,0,0.2);">"${t.notes || 'Not yok'}"</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <button class="btn btn-danger" onclick="approveTask('${t.id}', 'returned')"><i class='bx bx-x'></i> İade Et</button>
                    <button class="btn btn-success" onclick="approveTask('${t.id}', 'approved')"><i class='bx bx-check'></i> Onayla</button>
                </div>
            </div>
        `;
    }

    detailContent.innerHTML = `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span class="task-priority priority-${t.priority || 'normal'}">${t.priority === 'urgent' ? 'ACİL' : 'NORMAL'}</span>
                <span class="task-status status-${t.status || 'pending'}">${getStatusLabel(t.status)}</span>
            </div>
            <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 8px;">${t.title}</h2>
            <p style="font-size: 14px; color: var(--text-muted); line-height: 1.5; margin-bottom: 16px;">${t.description || 'Açıklama belirtilmemiş.'}</p>
            <div style="font-size: 12px; color: var(--text-muted);">
                <div><i class='bx bx-user'></i> Atayan: ${t.assignedByName || 'Sistem'}</div>
                <div><i class='bx bx-time'></i> Oluşturulma: ${t.createdAt ? new Date(t.createdAt.toDate()).toLocaleString('tr-TR') : '...'}</div>
            </div>
        </div>

        ${actionHtml}

        <div class="card">
            <div class="card-title">Geçmiş / Log</div>
            <div style="font-size: 12px; color: var(--text-muted);">İşlem geçmişi burada görünecek...</div>
        </div>
    `;

    // Re-attach file listeners if input exists
    const photoInput = document.getElementById('photo-input');
    if (photoInput) {
        photoInput.onchange = (e) => handlePhotoSelect(e);
    }
}

let selectedFiles = [];
function handlePhotoSelect(e) {
    const files = Array.from(e.target.files);
    selectedFiles = [...selectedFiles, ...files];
    renderPhotoPreview();
}

function renderPhotoPreview() {
    const preview = document.getElementById('photo-preview');
    preview.innerHTML = selectedFiles.map((f, i) => `
        <div class="photo-item">
            <img src="${URL.createObjectURL(f)}">
            <button class="remove-photo" onclick="removePhoto(${i})">✕</button>
        </div>
    `).join('');
}

window.removePhoto = (i) => {
    selectedFiles.splice(i, 1);
    renderPhotoPreview();
};

window.updateTaskStatus = async (id, status) => {
    try {
        await updateDoc(doc(db, 'tasks', id), { 
            status: status,
            [`${status}At`]: serverTimestamp()
        });
        // Detail sayfasını güncelle
        const t = currentTasks.find(x => x.id === id);
        if (t) {
            t.status = status;
            renderTaskDetail(t);
        }
    } catch (err) {
        alert('Durum güncellenirken hata oluştu: ' + err.message);
    }
};

window.completeTask = async (id) => {
    const note = document.getElementById('task-note').value.trim();
    if (selectedFiles.length === 0) {
        alert('Lütfen en az bir fotoğraf ekleyin.');
        return;
    }

    const btn = document.getElementById('btn-complete-task');
    btn.disabled = true;
    btn.textContent = 'Yükleniyor...';

    try {
        const photoUrls = [];
        for (const file of selectedFiles) {
            const path = `tasks/${id}/${Date.now()}_${file.name}`;
            const sRef = ref(storage, path);
            await uploadBytes(sRef, file);
            const url = await getDownloadURL(sRef);
            photoUrls.push(url);
        }

        await updateDoc(doc(db, 'tasks', id), {
            status: 'completed',
            completedAt: serverTimestamp(),
            notes: note,
            photos: photoUrls
        });

        // BİLDİRİM: Müdüre/Şefe haber ver
        const t = currentTasks.find(x => x.id === id);
        if (t && t.assignedBy) {
            await addNotificationRecord(t.assignedBy, 'İş Tamamlandı', `${window.userData.name} "${t.title}" görevini bitirdi ve onaya gönderdi.`);
        }

        alert('Görev onaya gönderildi.');
        detailOverlay.classList.add('hidden');
        selectedFiles = [];
    } catch (err) {
        alert('Görev tamamlanırken hata: ' + err.message);
        btn.disabled = false;
        btn.textContent = 'Tekrar Dene';
    }
};

// --- YENİ GÖREV OLUŞTURMA ---

window.openNewTaskModal = () => {
    document.getElementById('modal-new-task').classList.remove('hidden');
};

window.closeNewTaskModal = () => {
    document.getElementById('modal-new-task').classList.add('hidden');
};

document.getElementById('btn-save-new-task').onclick = async () => {
    const title = document.getElementById('nt-title').value.trim();
    const desc = document.getElementById('nt-desc').value.trim();
    const priority = document.getElementById('nt-priority').value;
    const assigneeId = document.getElementById('nt-assignee').value;

    if (!title || !assigneeId) {
        alert('Lütfen başlık ve personeli doldurun.');
        return;
    }

    const assignee = subordinates.find(s => s.id === assigneeId);
    const btn = document.getElementById('btn-save-new-task');
    btn.disabled = true;
    btn.textContent = 'Atanıyor...';

    try {
        await addDoc(collection(db, 'tasks'), {
            title,
            description: desc,
            priority,
            assignedTo: assigneeId,
            assignedToName: assignee ? assignee.name : 'Unknown',
            assignedBy: window.user.uid,
            assignedByName: window.userData.name,
            projectId: window.userData.projectId,
            status: 'pending',
            createdAt: serverTimestamp()
        });

        // BİLDİRİM: Personale haber ver
        await addNotificationRecord(assigneeId, 'Yeni Görev!', `${window.userData.name} size yeni bir görev atadı: ${title}`);

        alert('Görev başarıyla atandı.');
        window.closeNewTaskModal();
        // Formu temizle
        document.getElementById('nt-title').value = '';
        document.getElementById('nt-desc').value = '';
    } catch (err) {
        alert('Görev kaydedilemedi: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Görev Ata';
    }
};

window.approveTask = async (id, status) => {
    const action = status === 'approved' ? 'onaylandı' : 'iade edildi';
    if (!confirm(`Bu işi ${action} olarak işaretlemek istediğinize emin misiniz?`)) return;

    try {
        await updateDoc(doc(db, 'tasks', id), {
            status: status,
            approvedAt: serverTimestamp(),
            approvedBy: window.user.uid,
            approvedByName: window.userData.name
        });

        // BİLDİRİM: İşçiye haber ver
        const t = currentTasks.find(x => x.id === id);
        if (t && t.assignedTo) {
            const msg = status === 'approved' ? `"${t.title}" görevi onaylandı. Tebrikler!` : `"${t.title}" görevi iade edildi. Lütfen notlara bakın.`;
            await addNotificationRecord(t.assignedTo, status === 'approved' ? 'İş Onaylandı' : 'İş İade Edildi', msg, id);
        }

        toast(`İş ${action}.`);
        detailOverlay.classList.add('hidden');
    } catch (err) {
        alert('İşlem başarısız: ' + err.message);
    }
};

async function addNotificationRecord(recipientId, title, message, taskId = null) {
    try {
        await addDoc(collection(db, 'notifications'), {
            recipientId,
            title,
            message,
            taskId,
            read: false,
            timestamp: serverTimestamp()
        });
    } catch (err) {
        console.error("Bildirim gönderilemedi:", err);
    }
}

function toast(m) {
    // Simple alert for now, can be improved
    alert(m);
}
