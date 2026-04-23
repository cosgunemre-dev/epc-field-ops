import { db, auth, storage } from './firebase-app.js';
import { 
    collection, addDoc, query, where, onSnapshot, serverTimestamp, 
    updateDoc, doc, getDocs 
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

export function initTasks() {
    console.log("SahaBOSS Görev & Onay Sistemi Hazır.");
    
    // GÖREV KAYDETME (BOSS)
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
                    status: 'pending', // pending -> submitted -> done
                    createdAt: serverTimestamp(),
                    workerNote: '',
                    photoURL: ''
                });
                alert("🚀 Görev personele fırlatıldı!");
                document.getElementById('modal-new-task').classList.add('hidden');
            } catch (err) { alert(err.message); }
            finally { btnSave.disabled = false; }
        };
    }

    loadAdminTasks(); // BOSS Ekranı için
    loadDashboardSummary();
}

// BOSS İÇİN GÖREV HAVUZU
function loadAdminTasks() {
    const container = document.getElementById('tasks-container');
    if (!container) return;

    // Index hatası olmaması için orderBy şimdilik kaldırıldı
    const q = query(collection(db, 'tasks'), where('assignedBy', '==', auth.currentUser.uid));

    onSnapshot(q, (snapshot) => {
        let html = '';
        snapshot.forEach(docSnap => {
            const task = docSnap.data();
            const id = docSnap.id;
            
            let statusBadge = '';
            let actionBtn = '';

            if (task.status === 'pending') {
                statusBadge = '<span style="background:#f59e0b; color:#000; padding:4px 8px; border-radius:4px; font-size:10px;">SAHADA BEKLİYOR</span>';
            } else if (task.status === 'submitted') {
                statusBadge = '<span style="background:#38bdf8; color:#000; padding:4px 8px; border-radius:4px; font-size:10px; font-weight:800;">ONAYINI BEKLİYOR!</span>';
                actionBtn = `<button onclick="window.approveTask('${id}')" class="btn" style="padding:6px 12px; font-size:10px; background:#10b981; margin-top:10px;">İŞİ ONAYLA</button>`;
            } else {
                statusBadge = '<span style="background:#10b981; color:#000; padding:4px 8px; border-radius:4px; font-size:10px;">TAMAMLANDI</span>';
            }

            html += `
                <div class="card" style="border-left: 5px solid ${task.status === 'done' ? '#10b981' : (task.status === 'submitted' ? '#38bdf8' : '#f59e0b')};">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <h4 style="margin:0;">${task.title}</h4>
                            <p style="font-size:0.8rem; color:#94a3b8; margin:5px 0;">${task.description}</p>
                            ${task.workerNote ? `<div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:6px; font-size:0.8rem; border:1px dashed #334155; margin-top:10px;"><b>Personel Notu:</b> ${task.workerNote}</div>` : ''}
                            ${task.photoURL ? `<img src="${task.photoURL}" style="width:100px; height:100px; object-fit:cover; border-radius:8px; margin-top:10px; border:2px solid #38bdf8; cursor:pointer;" onclick="window.open('${task.photoURL}')">` : ''}
                        </div>
                        <div style="text-align:right;">
                            ${statusBadge}
                            <br>${actionBtn}
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html || '<p style="text-align:center; color:#94a3b8;">Henüz iş atamadınız.</p>';
    });
}

// BOSS ONAYI
window.approveTask = async (id) => {
    if (confirm("Bu işin doğru ve tam yapıldığını onaylıyor musunuz?")) {
        await updateDoc(doc(db, 'tasks', id), { status: 'done' });
        alert("İş başarıyla kapatıldı ve tamamlandı olarak işaretlendi.");
    }
};

// DASHBOARD ÖZET
function loadDashboardSummary() {
    const pEl = document.getElementById('count-pending');
    const dEl = document.getElementById('count-done');
    if (!pEl) return;

    onSnapshot(query(collection(db, 'tasks'), where('assignedBy', '==', auth.currentUser.uid)), (snap) => {
        let p = 0, d = 0;
        snap.forEach(docSnap => {
            if(docSnap.data().status === 'done') d++;
            else p++;
        });
        pEl.textContent = p;
        dEl.textContent = d;
    });
}
