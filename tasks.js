import { db, storage } from './firebase-app.js';
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

let currentTasks = [];
let subordinates = [];

export function initTasks() {
    const u = window.userData;
    if (!u) { console.error("Kullanıcı verisi eksik!"); return; }

    let q;
    const role = (u.role || '').toLowerCase();

    // GÖREVLERİ YÜKLE
    if (['isci', 'forman'].includes(role)) {
        q = query(collection(db, 'tasks'), where('assignedTo', '==', window.user.uid));
    } else {
        q = query(collection(db, 'tasks'), where('assignedBy', '==', window.user.uid));
    }

    onSnapshot(q, (snapshot) => {
        let tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tasks.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        currentTasks = tasks;
        renderTasks();
        updateStats();
    }, (err) => {
        console.error("GÖREV YÜKLEME HATASI:", err);
    });

    // EKİBİ VE PROJELERİ YÜKLE (TEŞHİS MODU)
    loadSubordinates();
    loadProjectsForManager();
}

async function loadSubordinates() {
    console.log("Ekip aranıyor... UID:", window.user.uid);
    const q = query(collection(db, 'users'), where('managedBy', '==', window.user.uid));
    
    onSnapshot(q, (snapshot) => {
        console.log("EKİP VERİSİ GELDİ! Adet:", snapshot.size);
        subordinates = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const select = document.getElementById('nt-assignee');
        if (select) {
            select.innerHTML = '<option value="">— Personel Seçin —</option>';
            if (subordinates.length === 0) {
                select.innerHTML = '<option value="">(Ekipte Kimse Yok!)</option>';
            }
            subordinates.forEach(s => {
                const roleLabel = (s.role || 'isci').toUpperCase();
                select.innerHTML += `<option value="${s.id}">${s.name || s.displayName} [${roleLabel}]</option>`;
            });
        }
    }, (err) => {
        alert("EKİP ÇEKME HATASI: " + err.message);
        console.error("Ekip Çekme Hatası:", err);
    });
}

async function loadProjectsForManager() {
    console.log("Projeler aranıyor... OwnerUID:", window.user.uid);
    const q = query(collection(db, 'projects'), where('ownerId', '==', window.user.uid));
    onSnapshot(q, (snapshot) => {
        console.log("PROJE VERİSİ GELDİ! Adet:", snapshot.size);
        const select = document.getElementById('nt-project');
        if (select) {
            select.innerHTML = '<option value="">— Proje Seçin —</option>';
            if (snapshot.size === 0) {
                select.innerHTML = '<option value="">(Proje Bulunamadı!)</option>';
            }
            snapshot.forEach(doc => {
                const p = doc.data();
                select.innerHTML += `<option value="${doc.id}">${p.name}</option>`;
            });
        }
    }, (err) => {
        alert("PROJE ÇEKME HATASI: " + err.message);
        console.error("Proje Çekme Hatası:", err);
    });
}

function renderTasks() {
    if (currentTasks.length === 0) {
        tasksContainer.innerHTML = '<p class="text-center" style="color:var(--text-muted); padding:40px;">Henüz görev atanmamış.</p>';
        return;
    }
    tasksContainer.innerHTML = currentTasks.map(t => `
        <div class="task-item" onclick="openTaskDetail('${t.id}')">
            <div class="task-header"><span class="task-title">${t.title}</span></div>
            <div class="task-meta"><span class="task-status status-${t.status || 'pending'}">${getStatusLabel(t.status)}</span></div>
        </div>
    `).join('');
}

function getStatusLabel(s) {
    const labels = {'pending': 'Beklemede', 'ongoing': 'Devam Ediyor', 'completed': 'Onay Bekliyor', 'approved': 'Onaylandı', 'returned': 'İade Edildi'};
    return labels[s] || s;
}

function updateStats() {
    const pending = currentTasks.filter(t => t.status === 'pending').length;
    const done = currentTasks.filter(t => t.status === 'approved').length;
    const statP = document.getElementById('stat-pending');
    if(statP) statP.textContent = pending;
    const statD = document.getElementById('stat-done');
    if(statD) statD.textContent = done;
}

window.openNewTaskModal = () => document.getElementById('modal-new-task').classList.remove('hidden');
window.closeNewTaskModal = () => document.getElementById('modal-new-task').classList.add('hidden');

document.getElementById('btn-save-new-task').onclick = async () => {
    const title = document.getElementById('nt-title').value.trim();
    const desc = document.getElementById('nt-desc').value.trim();
    const priority = document.getElementById('nt-priority').value;
    const assigneeId = document.getElementById('nt-assignee').value;
    const selectedProjectId = document.getElementById('nt-project')?.value;

    if (!title || !assigneeId || !selectedProjectId) {
        alert('Lütfen PROJE, BAŞLIK ve PERSONEL alanlarını doldurun.');
        return;
    }

    const assignee = subordinates.find(s => s.id === assigneeId);
    const btn = document.getElementById('btn-save-new-task');
    btn.disabled = true;

    try {
        await addDoc(collection(db, 'tasks'), {
            title, description: desc, priority,
            assignedTo: assigneeId,
            assignedToName: assignee ? (assignee.displayName || assignee.name) : 'Personel',
            assignedBy: window.user.uid,
            assignedByName: window.userData.displayName || window.userData.name || 'Yönetici',
            projectId: selectedProjectId,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        alert('Görev başarıyla atandı!');
        window.closeNewTaskModal();
    } catch (err) { alert('Hata: ' + err.message); }
    finally { btn.disabled = false; }
};

window.openTaskDetail = (id) => {
    const t = currentTasks.find(x => x.id === id);
    if (!t) return;
    detailOverlay.classList.remove('hidden');
    detailContent.innerHTML = `<div class="card"><h2>${t.title}</h2><p>${t.description || ''}</p></div>`;
};
