import { db } from '../../firebase-app.js';
import { 
    collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const notifOverlay = document.getElementById('notif-overlay');
const notifList = document.getElementById('notif-list');
const notifBadge = document.getElementById('notif-badge');
const btnMarkRead = document.getElementById('btn-mark-read');

let currentNotifications = [];

export function initNotifications() {
    const u = window.user;
    if (!u) return;

    // Bildirimleri Dinle
    const q = query(
        collection(db, 'notifications'),
        where('recipientId', '==', u.uid),
        limit(20)
    );

    onSnapshot(q, (snapshot) => {
        const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // JS Tarafında sırala (Index hatasını önlemek için)
        notifs.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
        
        currentNotifications = notifs;
        renderNotifications();
    }, (error) => {
        console.warn("Notifications listener error:", error);
    });

    // Event Listeners
    document.getElementById('btn-notif').onclick = (e) => {
        e.stopPropagation();
        notifOverlay.classList.toggle('hidden');
    };

    document.onclick = () => notifOverlay.classList.add('hidden');
    notifOverlay.onclick = (e) => e.stopPropagation();

    if (btnMarkRead) {
        btnMarkRead.onclick = markAllAsRead;
    }
}

function renderNotifications() {
    const unreadCount = currentNotifications.filter(n => !n.read).length;
    
    // Badge güncelle
    if (unreadCount > 0) {
        notifBadge.textContent = unreadCount;
        notifBadge.classList.remove('hidden');
    } else {
        notifBadge.classList.add('hidden');
    }

    if (currentNotifications.length === 0) {
        notifList.innerHTML = '<p style="padding: 20px; font-size: 12px; color: var(--text-muted); text-align: center;">Bildirim yok.</p>';
        return;
    }

    notifList.innerHTML = currentNotifications.map(n => `
        <div class="notif-item ${n.read ? '' : 'unread'}" style="padding: 12px; border-bottom: 1px solid var(--border); font-size: 13px; background: ${n.read ? 'transparent' : 'rgba(245, 158, 11, 0.05)'}; cursor: pointer;" onclick="handleNotifClick('${n.id}', '${n.taskId}')">
            <div style="font-weight: 700; margin-bottom: 2px;">${n.title}</div>
            <div style="font-size: 11px; color: var(--text-muted); line-height: 1.3;">${n.message}</div>
            <div style="font-size: 9px; color: var(--primary); margin-top: 5px;">${n.timestamp ? new Date(n.timestamp.toDate()).toLocaleTimeString('tr-TR') : '...'}</div>
        </div>
    `).join('');
}

window.handleNotifClick = async (notifId, taskId) => {
    // Okundu olarak işaretle
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
    
    // Eğer görev id varsa onu aç
    if (taskId && window.openTaskDetail) {
        window.openTaskDetail(taskId);
        notifOverlay.classList.add('hidden');
    }
};

async function markAllAsRead() {
    const unread = currentNotifications.filter(n => !n.read);
    const batch = writeBatch(db);
    
    unread.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
    });

    await batch.commit();
}
