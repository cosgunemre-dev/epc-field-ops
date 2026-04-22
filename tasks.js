// SAHABOSS TEŞHİS SİSTEMİ - V1.1
alert("SahaBOSS: Teşhis Sistemi Yayında!\n\nEğer bu yazıyı görüyorsanız kodlar başarıyla güncellenmiştir.");

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
    console.log("initTasks TETİKLENDİ");
    const u = window.userData;
    if (!u) { 
        alert("KRİTİK HATA: Kullanıcı verisi (userData) yüklenemedi!");
        return; 
    }

    let q;
    const role = (u.role || '').toLowerCase();
    
    console.log("Kullanıcı Rolü:", role, "UID:", window.user.uid);

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
    }, (err) => {
        alert("GÖREV ÇEKME VERİTABANI HATASI: " + err.message);
    });

    loadSubordinates();
    loadProjectsForManager();
}

async function loadSubordinates() {
    console.log("Ekip verisi sorgulanıyor...");
    const q = query(collection(db, 'users'), where('managedBy', '==', window.user.uid));
    
    onSnapshot(q, (snapshot) => {
        console.log("PERSONEL VERİSİ GELDİ:", snapshot.size);
        subordinates = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const select = document.getElementById('nt-assignee');
        if (select) {
            select.innerHTML = '<option value="">— Personel Seçin —</option>';
            if (subordinates.length === 0) {
                select.innerHTML = '<option value="">(EKİPTE KİMSE BULUNAMADI!)</option>';
            }
            subordinates.forEach(s => {
                const roleLabel = (s.role || 'isci').toUpperCase();
                select.innerHTML += `<option value="${s.id}">${s.name || s.displayName} [${roleLabel}]</option>`;
            });
        }
    }, (err) => {
        alert("EKİP VERİSİ ÇEKİLEMEDİ: " + err.message);
    });
}

async function loadProjectsForManager() {
    console.log("Projeler sorgulanıyor...");
    const q = query(collection(db, 'projects'), where('ownerId', '==', window.user.uid));
    onSnapshot(q, (snapshot) => {
        console.log("PROJE VERİSİ GELDİ:", snapshot.size);
        const select = document.getElementById('nt-project');
        if (select) {
            select.innerHTML = '<option value="">— Proje Seçin —</option>';
            if (snapshot.size === 0) {
                select.innerHTML = '<option value="">(SAHADA HİÇ PROJE YOK!)</option>';
            }
            snapshot.forEach(doc => {
                const p = doc.data();
                select.innerHTML += `<option value="${doc.id}">${p.name}</option>`;
            });
        }
    }, (err) => {
        alert("PROJE VERİSİ ÇEKİLEMEDİ: " + err.message);
    });
}

function renderTasks() {
    if (currentTasks.length === 0) {
        tasksContainer.innerHTML = '<p class="text-center" style="color:var(--text-muted); padding:40px;">Hata yok, ancak henüz görev atanmamış.</p>';
        return;
    }
    tasksContainer.innerHTML = currentTasks.map(t => `
        <div class="task-item" onclick="openTaskDetail('${t.id}')">
            <div class="task-header"><span class="task-title">${t.title}</span></div>
            <div class="task-meta"><span class="task-status">${t.status}</span></div>
        </div>
    `).join('');
}

window.openNewTaskModal = () => document.getElementById('modal-new-task').classList.remove('hidden');
window.closeNewTaskModal = () => document.getElementById('modal-new-task').classList.add('hidden');

document.getElementById('btn-save-new-task').onclick = async () => {
    const title = document.getElementById('nt-title').value.trim();
    const assigneeId = document.getElementById('nt-assignee').value;
    const projId = document.getElementById('nt-project').value;

    if (!title || !assigneeId || !projId) {
        alert('Lütfen PROJE, PERSONEL ve BAŞLIK seçin!');
        return;
    }

    const btn = document.getElementById('btn-save-new-task');
    btn.disabled = true;
    try {
        await addDoc(collection(db, 'tasks'), {
            title, 
            assignedTo: assigneeId,
            assignedBy: window.user.uid,
            projectId: projId,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        alert('GÖREV BAŞARIYLA KAYDEDİLDİ!');
        window.closeNewTaskModal();
    } catch (err) { alert('Kaydetme hatası: ' + err.message); }
    finally { btn.disabled = false; }
};
