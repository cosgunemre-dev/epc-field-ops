import { db } from './firebase-app.js';
import { 
    collection, query, where, onSnapshot, doc, updateDoc, 
    addDoc, serverTimestamp, orderBy 
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

const tasksContainer = document.getElementById('tasks-container');
const detailOverlay = document.getElementById('task-detail-overlay');
const detailContent = document.getElementById('task-detail-content');

let currentTasks = [];
let subordinates = [];

export function initTasks() {
    const u = window.userData;
    if (!u) return;

    console.log("Tasks sistemi başlatılıyor. UID:", window.user.uid);

    let q;
    const role = (u.role || '').toLowerCase();

    // 1. GÖREVLERİ YÜKLE
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
    });

    // 2. EKİBİ YÜKLE
    loadSubordinates();
    
    // 3. PROJELERİ YÜKLE
    loadProjectsForManager();
}

async function loadSubordinates() {
    const q = query(collection(db, 'users'), where('managedBy', '==', window.user.uid));
    onSnapshot(q, (snapshot) => {
        console.log("Ekip verisi güncellendi. Adet:", snapshot.size);
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
        console.log("Projeler güncellendi. Adet:", snapshot.size);
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
    if (!tasksContainer) return;
    if (currentTasks.length === 0) {
        tasksContainer.innerHTML = '<p class="text-center" style="color:var(--text-muted); padding:40px;">Aktif görev bulunmuyor.</p>';
        return;
    }
    tasksContainer.innerHTML = currentTasks.map(t => `
        <div class="task-item" onclick="openTaskDetail('${t.id}')">
            <div class="task-header">
                <div>
                    <span class="task-title">${t.title}</span>
                    <div style="font-size:0.7rem; color:var(--text-dim); margin-top:4px;">Atanan: ${t.assignedToName}</div>
                </div>
                <span class="task-status">${getStatusLabel(t.status)}</span>
            </div>
        </div>
    `).join('');
}

function getStatusLabel(s) {
    const labels = {'pending': 'Beklemede', 'ongoing': 'Sürüyor', 'completed': 'Onayda', 'approved': 'Bitti'};
    return labels[s] || s;
}

window.openNewTaskModal = () => document.getElementById('modal-new-task').classList.remove('hidden');
window.closeNewTaskModal = () => document.getElementById('modal-new-task').classList.add('hidden');

document.getElementById('btn-save-new-task').onclick = async () => {
    const title = document.getElementById('nt-title').value.trim();
    const assigneeId = document.getElementById('nt-assignee').value;
    const projId = document.getElementById('nt-project').value;

    if (!title || !assigneeId || !projId) {
        alert('Lütfen PROJE, PERSONEL ve BAŞLIK alanlarını doldurun.');
        return;
    }

    const assignee = subordinates.find(s => s.id === assigneeId);
    const btn = document.getElementById('btn-save-new-task');
    btn.disabled = true;

    try {
        await addDoc(collection(db, 'tasks'), {
            title, 
            assignedTo: assigneeId,
            assignedToName: assignee ? (assignee.displayName || assignee.name) : 'İşçi',
            assignedBy: window.user.uid,
            assignedByName: window.userData.name || 'Yönetici',
            projectId: projId,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        alert('Görev başarıyla atandı.');
        window.closeNewTaskModal();
    } catch (err) { alert('Hata: ' + err.message); }
    finally { btn.disabled = false; }
};

window.openTaskDetail = (id) => {
    const t = currentTasks.find(x => x.id === id);
    if (!t) return;
    detailOverlay.classList.remove('hidden');
    detailContent.innerHTML = `
        <div class="card">
            <h3>${t.title}</h3>
            <p style="margin-top:10px; font-size:14px;">${t.description || ''}</p>
            <div style="margin-top:20px; border-top:1px solid var(--border); padding-top:15px;">
                <button class="btn btn-ghost btn-block" onclick="document.getElementById('task-detail-overlay').classList.add('hidden')">Kapat</button>
            </div>
        </div>
    `;
};
