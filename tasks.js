import { db, auth } from './firebase-app.js';
import { 
    collection, addDoc, query, where, onSnapshot, serverTimestamp, 
    updateDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

window.openNewTaskModal = () => {
    const modal = document.getElementById('modal-new-task');
    if (modal) modal.classList.remove('hidden');
};

export function initTasks() {
    console.log("SahaBOSS: Kimin ne yaptığını bilen modül devrede.");
    
    // GÖNDER / KAYDET BUTONU
    const btnSave = document.getElementById('btn-save-task');
    if (btnSave) {
        btnSave.onclick = async () => {
            const title = document.getElementById('task-title').value;
            const assigneeSelect = document.getElementById('task-assignee');
            const assigneeId = assigneeSelect.value;
            const assigneeName = assigneeSelect.options[assigneeSelect.selectedIndex].text; // İSMİ YAKALA
            const desc = document.getElementById('task-desc').value;

            if (!title || !assigneeId) return alert("Başlık ve Personel seçimi zorunludur!");

            btnSave.disabled = true;
            try {
                await addDoc(collection(db, 'tasks'), {
                    title: title,
                    description: desc || '',
                    assignedTo: assigneeId,
                    assigneeName: assigneeName, // İSMİ KAYDET
                    assignedBy: auth.currentUser.uid,
                    status: 'pending',
                    createdAt: serverTimestamp(),
                    completedAt: null,
                    workerNote: '',
                    photoURL: ''
                });
                alert(`✅ Görev ${assigneeName} personeline atandı!`);
                document.getElementById('task-title').value = '';
                document.getElementById('task-desc').value = '';
                document.getElementById('modal-new-task').classList.add('hidden');
            } catch (err) { alert(err.message); }
            finally { btnSave.disabled = false; }
        };
    }

    loadAdminTasks();
    loadDashboardSummary();
}

function loadAdminTasks() {
    const container = document.getElementById('tasks-container');
    if (!container) return;

    const q = query(collection(db, 'tasks'), where('assignedBy', '==', auth.currentUser.uid));
    onSnapshot(q, (snapshot) => {
        let html = '';
        snapshot.forEach(docSnap => {
            const task = docSnap.data();
            const id = docSnap.id;
            const startStr = task.createdAt ? new Date(task.createdAt.seconds * 1000).toLocaleString('tr-TR') : '...';
            
            let statusBadge = '';
            let actionBtn = '';
            let statusColor = '#f59e0b';

            if (task.status === 'pending') {
                statusBadge = 'BEKLEMEDE';
            } else if (task.status === 'submitted') {
                statusBadge = 'ONAY BEKLİYOR!';
                statusColor = '#38bdf8';
                actionBtn = `<button onclick="window.approveTask('${id}')" class="btn" style="padding:6px 12px; font-size:10px; background:#10b981; margin-top:10px;">ONAYLA</button>`;
            } else {
                statusBadge = 'TAMAMLANDI';
                statusColor = '#10b981';
            }

            html += `
                <div class="card" style="border-left: 5px solid ${statusColor};">
                    <div style="font-size: 0.65rem; color:#94a3b8; margin-bottom:10px; display:flex; justify-content:space-between;">
                        <span>📅 Açılış: ${startStr}</span>
                        <span style="color:#f59e0b; font-weight:bold;">👷 Sorumlu: ${task.assigneeName || 'Atanmış Personel'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <h4 style="margin:0; font-size:1.15rem;">${task.title}</h4>
                            <p style="font-size:0.85rem; color:#cbd5e1; margin:6px 0;">${task.description || ''}</p>
                            
                            ${task.workerNote ? `<div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:6px; font-size:0.8rem; border:1px dashed #334155; margin-top:10px;"><b>Saha Notu:</b> ${task.workerNote}</div>` : ''}
                            ${task.photoURL ? `<a href="${task.photoURL}" target="_blank"><img src="${task.photoURL}" style="width:100px; border-radius:8px; margin-top:10px; border:2px solid #38bdf8;"></a>` : ''}
                        </div>
                        <div style="text-align:right;">
                            <span style="background:${statusColor}; color:#000; font-size:10px; padding:3px 8px; border-radius:4px; font-weight:bold;">${statusBadge}</span>
                            <br>${actionBtn}
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html || '<p style="color:#94a3b8; text-align:center;">İş havuzu yükleniyor...</p>';
    });
}

window.approveTask = async (id) => {
    if (confirm("Bu işi onaylayarak kapatıyor musunuz?")) {
        await updateDoc(doc(db, 'tasks', id), { 
            status: 'done',
            completedAt: serverTimestamp()
        });
        alert("Görev Tamamlandı!");
    }
};

function loadDashboardSummary() {
    const pEl = document.getElementById('count-pending');
    const dEl = document.getElementById('count-done');
    if (!pEl) return;
    onSnapshot(query(collection(db, 'tasks'), where('assignedBy', '==', auth.currentUser.uid)), (snap) => {
        let p = 0, d = 0;
        snap.forEach(docSnap => {
            if(docSnap.data().status === 'done') d++; else p++;
        });
        pEl.textContent = p; dEl.textContent = d;
    });
}
