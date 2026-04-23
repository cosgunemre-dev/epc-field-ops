import { auth, db, storage } from './firebase-app.js';
import { 
    collection, addDoc, query, where, onSnapshot, doc, deleteDoc, serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

// GLOBAL YÜKLEME FONKSİYONU
window.handleLayerUpload = async () => {
    const btnUpload = document.getElementById('btn-upload-layer');
    const inputFile = document.getElementById('input-layer-file');
    const user = auth.currentUser;
    
    if (!user) { alert("Oturum bulunamadı, lütfen sayfayı yenileyin."); return; }
    if (!inputFile || !btnUpload) return;

    const file = inputFile.files[0];
    if (!file) { alert("Lütfen bir KML veya KMZ dosyası seçin."); return; }

    btnUpload.disabled = true;
    btnUpload.textContent = "⌛ DOSYA BULUTA ÇIKIYOR...";

    try {
        const storageRef = ref(storage, `map_layers/${user.uid}/${Date.now()}_${file.name}`);
        const uploadSnap = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(uploadSnap.ref);

        await addDoc(collection(db, 'mapLayers'), {
            name: file.name,
            url: downloadURL,
            ownerId: user.uid,
            createdAt: serverTimestamp(),
            type: file.name.toLowerCase().endsWith('.kmz') ? 'kmz' : 'kml'
        });

        inputFile.value = '';
        alert("✅ " + file.name + " BAŞARIYLA KAYDEDİLDİ!");
        
        // Listeyi zorla güncelle
        initLayers();

    } catch (err) {
        console.error("Yükleme hatası:", err);
        alert("❌ HATA: " + err.message);
    } finally {
        btnUpload.disabled = false;
        btnUpload.textContent = "Yükle ve Ekle";
    }
};

export function initLayers() {
    const layerList = document.getElementById('layer-list');
    if (!layerList) return;

    // OTURUMUN OTURMASINI BEKLE VE DİNLE
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Katmanlar için UID doğrulandı:", user.uid);
            const q = query(collection(db, 'mapLayers'), where('ownerId', '==', user.uid));
            
            onSnapshot(q, (snapshot) => {
                const layers = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
                renderLayerList(layers, layerList);
            }, (err) => {
                console.error("Veri çekme hatası:", err);
                layerList.innerHTML = `<p style="color:red; font-size:10px;">Hata: ${err.message}</p>`;
            });
        } else {
            console.warn("Oturum kapalı, katmanlar yüklenemedi.");
        }
    });
}

function renderLayerList(layers, container) {
    if (!container) return;
    
    if (layers.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 20px 0;">
                <p style="font-size: 11px; color: #94a3b8;">Henüz katman bulunamadı.</p>
                <button onclick="location.reload()" style="background:none; border:1px solid #334155; color:#94a3b8; font-size:10px; padding:4px 8px; border-radius:4px; margin-top:10px; cursor:pointer;">
                    <i class='bx bx-refresh'></i> Sayfayı Yenile
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = layers.map(l => `
        <div class="card" style="padding: 10px; margin-bottom: 10px; background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1; overflow: hidden; margin-right: 10px;">
                    <div style="font-size: 0.8rem; font-weight: 800; color:#38bdf8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${l.name}</div>
                    <div style="font-size: 0.65rem; color: #94a3b8;">${l.type.toUpperCase()} Katmanı</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="window.toggleLayer('${l.id}', '${l.url}', '${l.type}')" class="btn btn-ghost" style="padding: 0; width: 34px; height:34px; background:rgba(255,255,255,0.05);">
                        <i class='bx bx-show' id="icon-layer-${l.id}" style="font-size: 18px; color:#f59e0b;"></i>
                    </button>
                    <button onclick="window.deleteLayer('${l.id}')" class="btn btn-ghost" style="padding: 0; width: 34px; height:34px; color: #ef4444; background:rgba(239, 68, 68, 0.05);">
                        <i class='bx bx-trash' style="font-size: 18px;"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

window.deleteLayer = async (id) => {
    if (!confirm("Bu katman buluttan tamamen silinecek?")) return;
    try {
        await deleteDoc(doc(db, 'mapLayers', id));
        if (window.removeLayerFromMap) window.removeLayerFromMap(id);
    } catch (err) { alert("Hata: " + err.message); }
};
