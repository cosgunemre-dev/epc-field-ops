import { db, auth } from './firebase-app.js';
import { 
    collection, addDoc, query, where, onSnapshot, serverTimestamp, 
    updateDoc, doc, orderBy 
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export function initTasks() {
    console.log("SahaBOSS Görev Modülü Aktif.");
    
    // GÖNDER BUTONUNU DİNLE
    const btnSave = document.getElementById('btn-save-task');
    if (btnSave) {
        btnSave.onclick = async () => {
            const title = document.getElementById('task-title').value;
            const assigneeId = document.getElementById('task-assignee').value;
            const desc = document.getElementById('task-desc').value;

            if (!title || !assigneeId) {
                alert("Lütfen iş başlığını ve görevli personeli seçin!");
                return;
            }

            btnSave.disabled = true;
            btnSave.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Gönderiliyor...";

            try {
                await addDoc(collection(db, 'tasks'), {
                    title: title,
                    description: desc,
                    assignedTo: assigneeId,
                    assignedBy: auth.currentUser.uid,
                    status: 'pending',
                    createdAt: serverTimestamp(),
                    priority: 'normal'
                });

                alert("✅ Görev başarıyla personele iletildi!");
                
                // Formu temizle ve kapat
                document.getElementById('task-title').value = '';
                document.getElementById('task-desc').value = '';
                document.getElementById('modal-new-task').classList.add('hidden');
                
            } catch (err) {
                console.error("Görev gönderimi hatası:", err);
                alert("Hata: " + err.message);
            } finally {
                btnSave.disabled = false;
                btnSave.innerHTML = "GÖNDER";
            }
        };
    }

    loadAdminTasks();
    loadDashboardSummary();
}

// LİSTEYİ YÜKLE
function loadAdminTasks() {
    const container = document.getElementById('tasks-container');
    if (!container) return;

    const q = query(
        collection(db, 'tasks'), 
        where('assignedBy', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
    );

    onSnapshot(q, (snapshot) => {
        let html = '';
        snapshot.forEach(docSnap => {
            const task = docSnap.data();
            const date = task.createdAt ? new Date(task.createdAt.seconds * 1000).toLocaleDateString() : '...';
            const statusColor = task.status === 'done' ? '#10b981' : '#f59e0b';
            const statusText = task.status === 'done' ? 'TAMAMLANDI' : 'BEKLEMEDE';

            html += `
                <div class="card" style="border-left: 4px solid ${statusColor}; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <h4 style="margin:0; font-size:1rem;">${task.title}</h4>
                            <p style="font-size:0.8rem; color:#94a3b8; margin:5px 0;">${task.description || 'Açıklama yok'}</p>
                            <span style="font-size:0.7rem; color:#64748b;">📅 ${date}</span>
                        </div>
                        <div style="text-align:right;">
                            <span style="background:${statusColor}; color:#000; font-size:10px; padding:3px 8px; border-radius:50px; font-weight:bold;">${statusText}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html || '<p style="color:#94a3b8; text-align:center;">Henüz eklenmiş bir görev yok.</p>';
    });
}

// DASHBOARD ÖZET SAYILARI
function loadDashboardSummary() {
    const pendingEl = document.getElementById('count-pending');
    const doneEl = document.getElementById('count-done');
    if (!pendingEl) return;

    const q = query(collection(db, 'tasks'), where('assignedBy', '==', auth.currentUser.uid));
    onSnapshot(q, (snapshot) => {
        let p = 0, d = 0;
        snapshot.forEach(docSnap => {
            if(docSnap.data().status === 'done') d++;
            else p++;
        });
        pendingEl.textContent = p;
        doneEl.textContent = d;
    });
}

window.openNewTaskModal = () => {
    document.getElementById('modal-new-task').classList.remove('hidden');
};
