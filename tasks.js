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
    if (!u) return;

    let q;
    const role = (u.role || '').toLowerCase();

    // 1. GÖREVLERİ YÜKLE (Benimle ilgili olanlar)
    if (['isci', 'formman'].includes(role)) {
        q = query(collection(db, 'tasks'), where('assignedTo', '==', window.user.uid));
    } else {
        q = query(collection(db, 'tasks'), where('assignedBy', '==', window.user.uid));
    }

    onSnapshot(q, (snapshot) => {
        let tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tasks.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        currentTasks = tasks;
        renderTasks();
    });

    // 2. EKİBİ YÜKLE (Benim yönettiğim kişiler)
    loadSubordinates();
    // 3. PROJELERİ YÜKLE (Benim oluşturduğum sahalar)
    loadProjectsForManager();
}

async function loadSubordinates() {
    const q = query(collection(db, 'users'), where('managedBy', '==', window.user.uid));
    onSnapshot(q, (snapshot) => {
        subordinates = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const select = document.getElementById('nt-assignee');
        if (select) {
            select.innerHTML = '<option value="">— Personel Seçin —</option>';
            subordinates.forEach(s => {
                const roleLabel = (s.role || 'isci').toUpperCase();
                select.innerHTML += `<option value="${s.id}">${s.name || s.displayName} [${roleLabel}]</option>`;
            });
        }
    });
}

async function loadProjectsForManager() {
    const q = query(collection(db, 'projects'), where('ownerId', '==', window.user.uid));
    onSnapshot(q, (snapshot) => {
        const select = document.getElementById('nt-project');
        if (select) {
            select.innerHTML = '<option value="">— Proje Seçin —</option>';
            snapshot.forEach(doc => {
                select.innerHTML += `<option value="${doc.id}">${doc.data().name}</option>`;
            });
        }
    });
}

function renderTasks() {
    if (currentTasks.length === 0) {
        tasksContainer.innerHTML = '<p class="text-center" style="color:var(--text-muted); padding:40px;">Henüz aktif bir görev bulunmuyor.</p>';
        return;
    }
    tasksContainer.innerHTML = currentTasks.map(t => `
        <div class="task-item" onclick="openTaskDetail('${t.id}')">
            <div class="task-header">
                <div>
                    <span class="task-title">${t.title}</span>
                    <div style="font-size:0.7rem; color:var(--text-dim); margin-top:4px;">Atanan: ${t.assignedToName}</div>
                </div>
                <span class="task-status status-${t.status || 'pending'}">${getStatusLabel(t.status)}</span>
            </div>
        </div>
    `).join('');
}

function getStatusLabel(s) {
    const labels = {'pending': 'Beklemede', 'ongoing': 'Devam Ediyor', 'completed': 'Onay Bekliyor', 'approved': 'Bitti', 'returned': 'Revize'};
    return labels[s] || s;
}

window.openNewTaskModal = () => document.getElementById('modal-new-task').classList.remove('hidden');
window.closeNewTaskModal = () => document.getElementById('modal-new-task').classList.add('hidden');

// GÖREV KAYDETME
document.getElementById('btn-save-new-task').onclick = async () => {
    const title = document.getElementById('nt-title').value.trim();
    const desc = document.getElementById('nt-desc').value.trim();
    const priority = document.getElementById('nt-priority').value;
    const assigneeId = document.getElementById('nt-assignee').value;
    const projId = document.getElementById('nt-project').value;

    if (!title || !assigneeId || !projId) {
        alert('Lütfen temel alanları (Proje, Personel, Başlık) doldurun.');
        return;
    }

    const assignee = subordinates.find(s => s.id === assigneeId);
    const btn = document.getElementById('btn-save-new-task');
    btn.disabled = true;

    try {
        await addDoc(collection(db, 'tasks'), {
            title, description: desc, priority,
            assignedTo: assigneeId,
            assignedToName: assignee ? (assignee.displayName || assignee.name) : 'Saha Elemanı',
            assignedBy: window.user.uid,
            assignedByName: window.userData.displayName || window.userData.name,
            projectId: projId,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        alert('Görev başarıyla atandı.');
        window.closeNewTaskModal();
    } catch (err) { alert('Görev atanamadı: ' + err.message); }
    finally { btn.disabled = false; }
};

window.openTaskDetail = (id) => {
    const t = currentTasks.find(x => x.id === id);
    if (!t) return;
    detailOverlay.classList.remove('hidden');
    detailContent.innerHTML = `
        <div style="margin-bottom:20px;">
            <h2 style="color:var(--accent);">${t.title}</h2>
            <div style="font-size:0.8rem; color:var(--text-dim); margin-top:5px;">Açıklama: ${t.description || 'Yok'}</div>
        </div>
        <div style="border-top:1px solid var(--border); padding-top:20px;">
            <div style="font-size:0.9rem; margin-bottom:10px;">Durum: <span class="badge status-${t.status}">${getStatusLabel(t.status)}</span></div>
            <button class="btn btn-ghost" style="width:100%;" onclick="document.getElementById('task-detail-overlay').classList.add('hidden')">Kapat</button>
        </div>
    `;
};
