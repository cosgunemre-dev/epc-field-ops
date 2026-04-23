import { db, auth, storage } from './firebase-app.js';
import { 
    collection, addDoc, query, where, onSnapshot, serverTimestamp, 
    updateDoc, doc, getDocs 
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export function initTasks() {
    const btnSave = document.getElementById('btn-save-task');
    if (btnSave) {
        btnSave.onclick = async () => {
            const title = document.getElementById('task-title').value;
            const assigneeId = document.getElementById('task-assignee').value;
            const desc = document.getElementById('task-desc').value;

            if (!title || !assigneeId) return alert("Başlık ve Personel seçiniz!");

            btnSave.disabled = true;
            try {
                await addDoc(collection(db, 'tasks'), {
                    title: title,
                    description: desc,
                    assignedTo: assigneeId,
                    assignedBy: auth.currentUser.uid,
                    status: 'pending',
                    createdAt: serverTimestamp(),
                    completedAt: null, // Henüz bitmedi
                    workerNote: '',
                    photoURL: ''
                });
                alert("🚀 İş emri kayda girdi!");
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
            const endStr = task.completedAt ? new Date(task.completedAt.seconds * 1000).toLocaleString('tr-TR') : 'Devam Ediyor';
            
            let statusBadge = '';
            let actionBtn = '';

            if (task.status === 'pending') {
                statusBadge = '<span style="background:#f59e0b; color:#000; padding:4px 8px; border-radius:4px; font-size:10px;">BEKLEMEDE</span>';
            } else if (task.status === 'submitted') {
                statusBadge = '<span style="background:#38bdf8; color:#000; padding:4px 8px; border-radius:4px; font-size:10px; font-weight:800;">ONAY BEKLİYOR!</span>';
                actionBtn = `<button onclick="window.approveTask('${id}')" class="btn" style="padding:6px 12px; font-size:10px; background:#10b981; margin-top:10px;">İŞİ ONAYLA</button>`;
            } else {
                statusBadge = '<span style="background:#10b981; color:#000; padding:4px 8px; border-radius:4px; font-size:10px;">TAMAMLANDI</span>';
            }

            html += `
                <div class="card" style="border-left: 5px solid ${task.status === 'done' ? '#10b981' : (task.status === 'submitted' ? '#38bdf8' : '#f59e0b')}; position:relative;">
                    <div style="font-size: 0.65rem; color:#94a3b8; margin-bottom:10px; display:flex; justify-content:space-between;">
                        <span>📅 Açılış: ${startStr}</span>
                        <span style="${task.completedAt ? 'color:#10b981; font-weight:bold;' : ''}">🏁 Kapanış: ${endStr}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <h4 style="margin:0; font-size:1.1rem;">${task.title}</h4>
                            <p style="font-size:0.85rem; color:#cbd5e1; margin:8px 0;">${task.description}</p>
                            ${task.workerNote ? `<div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; font-size:0.8rem; border:1px dashed #475569; margin-top:10px;"><b>Saha Notu:</b> ${task.workerNote}</div>` : ''}
                            ${task.photoURL ? `<a href="${task.photoURL}" target="_blank"><img src="${task.photoURL}" style="width:120px; border-radius:10px; margin-top:10px; border:2px solid #38bdf8;"></a>` : ''}
                        </div>
                        <div style="text-align:right;">
                            ${statusBadge}
                            <br>${actionBtn}
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html || '<p style="text-align:center; color:#94a3b8;">Görev Havuzu Boş.</p>';
    });
}

window.approveTask = async (id) => {
    if (confirm("Bu iş tamamlandı olarak kapatılsın mı?")) {
        await updateDoc(doc(db, 'tasks', id), { 
            status: 'done',
            completedAt: serverTimestamp() // Kapanış tarihini şimdi olarak mühürle
        });
        alert("İş resmi olarak tamamlandı!");
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
