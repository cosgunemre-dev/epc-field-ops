import { db, storage } from './firebase-app.js';
import { 
    collection, addDoc, query, where, onSnapshot, doc, deleteDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

const layerList = document.getElementById('layer-list');
const btnUpload = document.getElementById('btn-upload-layer');
const inputFile = document.getElementById('input-layer-file');

export function initLayers() {
    if (!btnUpload) return;

    // 1. MEVCUT KATMANLARI DİNLE
    const q = query(collection(db, 'mapLayers'), where('ownerId', '==', window.user.uid));
    onSnapshot(q, (snapshot) => {
        renderLayerList(snapshot.docs.map(d => ({id: d.id, ...d.data()})));
    });

    // 2. YENİ KATMAN YÜKLE
    btnUpload.onclick = async () => {
        const file = inputFile.files[0];
        if (!file) { alert("Lütfen bir KML veya KMZ dosyası seçin."); return; }

        btnUpload.disabled = true;
        btnUpload.textContent = "Yükleniyor...";

        try {
            // Storage'a yükle
            const storageRef = ref(storage, `map_layers/${window.user.uid}/${Date.now()}_${file.name}`);
            const uploadSnap = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(uploadSnap.ref);

            // Firestore'a kaydet
            await addDoc(collection(db, 'mapLayers'), {
                name: file.name,
                url: downloadURL,
                ownerId: window.user.uid,
                createdAt: serverTimestamp(),
                type: file.name.endsWith('.kmz') ? 'kmz' : 'kml'
            });

            inputFile.value = '';
            alert("Katman başarıyla eklendi.");
        } catch (err) {
            console.error(err);
            alert("Yükleme hatası: " + err.message);
        } finally {
            btnUpload.disabled = false;
            btnUpload.textContent = "Yükle ve Ekle";
        }
    };
}

function renderLayerList(layers) {
    if (!layerList) return;
    if (layers.length === 0) {
        layerList.innerHTML = '<p style="font-size: 0.7rem; color: #94a3b8; text-align: center;">Yüklü katman yok.</p>';
        return;
    }

    layerList.innerHTML = layers.map(l => `
        <div class="card" style="padding: 10px; margin-bottom: 8px; background: rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1; overflow: hidden;">
                <div style="font-size: 0.75rem; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${l.name}</div>
                <div style="font-size: 0.6rem; color: #94a3b8;">${l.type.toUpperCase()} Dosyası</div>
            </div>
            <div style="display: flex; gap: 5px;">
                <button onclick="window.toggleLayer('${l.id}', '${l.url}', '${l.type}')" class="btn btn-ghost" style="padding: 5px; width: auto;" title="Göster/Gizle">
                    <i class='bx bx-show' id="icon-layer-${l.id}"></i>
                </button>
                <button onclick="window.deleteLayer('${l.id}')" class="btn btn-ghost" style="padding: 5px; width: auto; color: #ef4444;" title="Sil">
                    <i class='bx bx-trash'></i>
                </button>
            </div>
        </div>
    `).join('');

    // Katmanları haritaya da otomatik yükle (Eğer daha önce açıksa)
    // Bu kısım maps.js ile koordine çalışacak
}

window.deleteLayer = async (id) => {
    if (!confirm("Bu katmanı silmek istediğinize emin misiniz?")) return;
    try {
        await deleteDoc(doc(db, 'mapLayers', id));
        // Haritadan da kaldır (Global event veya direct call)
        if (window.removeLayerFromMap) window.removeLayerFromMap(id);
    } catch (err) { alert("Hata: " + err.message); }
};
