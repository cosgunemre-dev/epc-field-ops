import { db, storage } from './firebase-app.js';
import { 
    collection, query, where, onSnapshot, doc, updateDoc, 
    addDoc, serverTimestamp, orderBy 
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

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
    const isWorker = (data) => data.isFieldStaff || data.role === 'isci' || data.role === 'forman';

    // 1. GÖREVLERİ YÜKLE
    // Not: İşçi portalında isek sadece bize atananları getir, admin isek bizim atadıklarımızı
    const isWorkerPage = window.location.pathname.includes('worker-sahaboss.html');

    if (isWorkerPage) {
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

    // 2. EKİBİ YÜKLE (Sadece yöneticide işe yarar)
    if (!isWorkerPage) loadSubordinates();
    
    // 3. PROJELERİ YÜKLE (Sadece yöneticide işe yarar)
    if (!isWorkerPage) loadProjectsForManager();
}

async function loadSubordinates() {
    const q = query(collection(db, 'users'), where('managedBy', '==', window.user.uid));
    onSnapshot(q, (snapshot) => {
        subordinates = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const select = document.getElementById('nt-assignee');
        if (select) {
            select.innerHTML = '<option value="">— Personel Seçin —</option>';
            subordinates.forEach(s => {
                select.innerHTML += `<option value="${s.id}">${s.name || s.displayName}</option>`;
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
    if (!tasksContainer) return;
    if (currentTasks.length === 0) {
        tasksContainer.innerHTML = '<p class="text-center" style="color:var(--text-muted); padding:40px;">Henüz görev atanmamış.</p>';
        return;
    }
    tasksContainer.innerHTML = currentTasks.map(t => `
        <div class="task-item" onclick="openTaskDetail('${t.id}')" style="background: #1e293b; padding: 15px; border-radius: 10px; margin-bottom: 10px; border-left: 5px solid ${t.status === 'completed' ? '#10b981' : '#f59e0b'};">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:bold; color:#fff;">${t.title}</div>
                    <div style="font-size:0.7rem; color:#94a3b8; margin-top:4px;">Durum: ${getStatusLabel(t.status)}</div>
                </div>
                <i class='bx bx-chevron-right' style="font-size: 20px; color: #94a3b8;"></i>
            </div>
        </div>
    `).join('');
}

function getStatusLabel(s) {
    const labels = {'pending': 'BEKLEMEDE', 'ongoing': 'SÜRÜYOR', 'completed': 'ONAYDA', 'approved': 'BİTTİ'};
    return labels[s] || s.toUpperCase();
}

// GÖREV DETAYI VE İŞ BİTİRME FORMU
window.openTaskDetail = (id) => {
    const t = currentTasks.find(x => x.id === id);
    if (!t) return;
    
    // Detay Overlay'i göster
    const overlay = document.getElementById('task-detail-overlay');
    const content = document.getElementById('task-detail-content');
    if (!overlay || !content) return;

    overlay.classList.remove('hidden');
    
    const isWorkerPage = window.location.pathname.includes('worker-sahaboss.html');
    const canComplete = isWorkerPage && t.status !== 'completed' && t.status !== 'approved';

    content.innerHTML = `
        <div class="card" style="padding: 20px;">
            <h2 style="color: #f59e0b; margin-bottom: 5px;">${t.title}</h2>
            <p style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 20px;">${t.description || 'Açıklama girilmemiş.'}</p>
            
            <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.05); margin-bottom: 20px;">

            ${canComplete ? `
                <div id="complete-form">
                    <label style="display:block; margin-bottom: 8px; font-weight: bold; font-size: 0.8rem;">İŞ SONU RAPORU (OPSİYONEL)</label>
                    <textarea id="task-notes" style="width:100%; height:80px; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:8px; padding:10px; margin-bottom:15px;" placeholder="Yapılan iş hakkında kısa bilgi..."></textarea>
                    
                    <label style="display:block; margin-bottom: 8px; font-weight: bold; font-size: 0.8rem;">SAHA FOTOĞRAFLARI</label>
                    <input type="file" id="task-photos" multiple accept="image/*" style="margin-bottom: 20px; font-size: 0.8rem;">
                    
                    <button class="btn btn-primary" id="btn-submit-task" style="background: #10b981; color: #fff;">
                        <i class='bx bx-check-double'></i> İşi Tamamla ve Gönder
                    </button>
                </div>
            ` : `
                <div class="card" style="background: rgba(255,255,255,0.02);">
                    <div style="font-weight:bold; font-size: 0.8rem; color: #94a3b8;">DURUM: ${getStatusLabel(t.status)}</div>
                    ${t.workerNotes ? `<p style="margin-top:10px; font-size: 0.85rem;"><b>Not:</b> ${t.workerNotes}</p>` : ''}
                </div>
            `}
            
            <button class="btn btn-ghost" style="margin-top: 15px;" onclick="document.getElementById('task-detail-overlay').classList.add('hidden')">Kapat</button>
        </div>
    `;

    if (canComplete) {
        document.getElementById('btn-submit-task').onclick = () => submitTaskCompletion(t.id);
    }
};

async function submitTaskCompletion(taskId) {
    const notes = document.getElementById('task-notes').value;
    const fileInput = document.getElementById('task-photos');
    const btn = document.getElementById('btn-submit-task');
    
    btn.disabled = true;
    btn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Gönderiliyor...";

    try {
        let photoURLs = [];
        
        // Fotoğrafları yükle (Eğer seçildiyse)
        if (fileInput.files.length > 0) {
            for (let file of fileInput.files) {
                const storageRef = ref(storage, `task_photos/${taskId}/${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(storageRef, file);
                const url = await getDownloadURL(snapshot.ref);
                photoURLs.push(url);
            }
        }

        // Firestore'u güncelle
        await updateDoc(doc(db, 'tasks', taskId), {
            status: 'completed',
            workerNotes: notes,
            photoURLs: photoURLs,
            completedAt: serverTimestamp()
        });

        alert('İş başarıyla tamamlandı ve yöneticiye gönderildi.');
        document.getElementById('task-detail-overlay').classList.add('hidden');
    } catch (err) {
        console.error(err);
        alert('Hata: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = "<i class='bx bx-check-double'></i> İşi Tamamla ve Gönder";
    }
}

// Global modal açma kapama (Admin tarafı için)
window.openNewTaskModal = () => document.getElementById('modal-new-task').classList.remove('hidden');
window.closeNewTaskModal = () => document.getElementById('modal-new-task').classList.add('hidden');

// GÖREV ATAMA (ADMIN)
const saveTaskBtn = document.getElementById('btn-save-new-task');
if (saveTaskBtn) {
    saveTaskBtn.onclick = async () => {
        const title = document.getElementById('nt-title').value.trim();
        const assigneeId = document.getElementById('nt-assignee').value;
        const projId = document.getElementById('nt-project').value;
        const desc = document.getElementById('nt-desc').value;
    
        if (!title || !assigneeId || !projId) {
            alert('Lütfen tüm alanları doldurun.');
            return;
        }
    
        const assignee = subordinates.find(s => s.id === assigneeId);
        saveTaskBtn.disabled = true;
    
        try {
            await addDoc(collection(db, 'tasks'), {
                title, 
                description: desc,
                assignedTo: assigneeId,
                assignedToName: assignee ? (assignee.displayName || assignee.name) : 'İşçi',
                assignedBy: window.user.uid,
                assignedByName: window.userData.name || 'Yönetici',
                projectId: projId,
                status: 'pending',
                createdAt: serverTimestamp()
            });
            alert('Görev atandı.');
            window.closeNewTaskModal();
        } catch (err) { alert('Hata: ' + err.message); }
        finally { saveTaskBtn.disabled = false; }
    };
}
