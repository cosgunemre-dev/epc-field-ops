import { db, storage } from './firebase-app.js';
import { 
    collection, addDoc, query, where, onSnapshot, doc, deleteDoc, serverTimestamp, orderBy 
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

// GLOBAL YÜKLEME FONKSİYONU
window.handleLayerUpload = async () => {
    const btnUpload = document.getElementById('btn-upload-layer');
    const inputFile = document.getElementById('input-layer-file');
    const uid = window.user?.uid;
    
    if (!uid) { alert("Oturum açılamadı, lütfen tekrar giriş yapın."); return; }
    if (!inputFile || !btnUpload) return;

    const file = inputFile.files[0];
    if (!file) { alert("Lütfen bir KML veya KMZ dosyası seçin."); return; }

    btnUpload.disabled = true;
    btnUpload.textContent = "⌛ YARDIMINIZLA YÜKLENİYOR...";

    try {
        const storageRef = ref(storage, `map_layers/${uid}/${Date.now()}_${file.name}`);
        const uploadSnap = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(uploadSnap.ref);

        await addDoc(collection(db, 'mapLayers'), {
            name: file.name,
            url: downloadURL,
            ownerId: uid,
            createdAt: serverTimestamp(),
            type: file.name.endsWith('.kmz') ? 'kmz' : 'kml'
        });

        inputFile.value = '';
        console.log("Firestore kaydı tamamlandı!");
        alert("✅ " + file.name + " Başarıyla Yüklendi!");
    } catch (err) {
        console.error("Yükleme hatası:", err);
        alert("❌ Hata: " + err.message);
    } finally {
        btnUpload.disabled = false;
        btnUpload.textContent = "Yükle ve Ekle";
    }
};

export function initLayers() {
    console.log("Katman Verileri Çekiliyor...");
    const layerList = document.getElementById('layer-list');
    const uid = window.user?.uid;

    if (!layerList || !uid) {
        console.error("LayerList veya UID eksik!", { layerList, uid });
        return;
    }

    // MEVCUT KATMANLARI DİNLE (Sadece bana ait olanları getir)
    const q = query(
        collection(db, 'mapLayers'), 
        where('ownerId', '==', uid)
    );

    onSnapshot(q, (snapshot) => {
        const layers = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
        console.log(`Toplam ${layers.length} katman bulundu.`);
        renderLayerList(layers, layerList);
    }, (error) => {
        console.error("Dinleme hatası:", error);
    });
}

function renderLayerList(layers, container) {
    if (!container) return;
    
    if (layers.length === 0) {
        container.innerHTML = '<p style="font-size: 0.7rem; color: #94a3b8; text-align: center; margin-top:10px;">Henüz bir katman eklemediniz.</p>';
        return;
    }

    container.innerHTML = layers.map(l => `
        <div class="card" style="padding: 10px; margin-bottom: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1; overflow: hidden; margin-right: 10px;">
                    <div style="font-size: 0.75rem; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${l.name}</div>
                    <div style="font-size: 0.6rem; color: #94a3b8;">${l.type.toUpperCase()} Haritası</div>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button onclick="window.toggleLayer('${l.id}', '${l.url}', '${l.type}')" class="btn btn-ghost" style="padding: 6px; width: 32px; height:32px;">
                        <i class='bx bx-show' id="icon-layer-${l.id}" style="font-size: 16px;"></i>
                    </button>
                    <button onclick="window.deleteLayer('${l.id}')" class="btn btn-ghost" style="padding: 6px; width: 32px; height:32px; color: #ef4444;">
                        <i class='bx bx-trash' style="font-size: 16px;"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

window.deleteLayer = async (id) => {
    if (!confirm("Bu katman tamamen silinecek, emin misiniz?")) return;
    try {
        await deleteDoc(doc(db, 'mapLayers', id));
        if (window.removeLayerFromMap) window.removeLayerFromMap(id);
    } catch (err) { alert("Hata: " + err.message); }
};
