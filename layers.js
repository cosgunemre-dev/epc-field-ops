import { db, storage } from './firebase-app.js';
import { 
    collection, addDoc, query, where, onSnapshot, doc, deleteDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

export function initLayers() {
    console.log("Katman Sistemi Başlatılıyor...");
    
    // Elementleri fonksiyon içinde yakala (DOM hazır olduktan sonra)
    const layerList = document.getElementById('layer-list');
    const btnUpload = document.getElementById('btn-upload-layer');
    const inputFile = document.getElementById('input-layer-file');

    if (!btnUpload) {
        console.error("Hata: 'btn-upload-layer' butonu bulunamadı!");
        return;
    }

    // 1. MEVCUT KATMANLARI DİNLE
    const q = query(collection(db, 'mapLayers'), where('ownerId', '==', window.user.uid));
    onSnapshot(q, (snapshot) => {
        renderLayerList(snapshot.docs.map(d => ({id: d.id, ...d.data()})), layerList);
    });

    // 2. YENİ KATMAN YÜKLE
    btnUpload.onclick = async () => {
        const file = inputFile.files[0];
        if (!file) { alert("Lütfen bir KML veya KMZ dosyası seçin."); return; }

        console.log("Dosya yükleniyor:", file.name);
        btnUpload.disabled = true;
        btnUpload.textContent = "Yükleniyor... Bekleyin";

        try {
            // Storage'a yükle (map_layers/KULLANICI_ID/DOSYA_ADI)
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
            alert("✅ Katman başarıyla eklendi ve buluta kaydedildi.");
        } catch (err) {
            console.error("Yükleme Hatası:", err);
            alert("❌ Yükleme hatası (Depolama yetkisi veya bağlantı sorunu): " + err.message);
        } finally {
            btnUpload.disabled = false;
            btnUpload.textContent = "Yükle ve Ekle";
        }
    };
}

function renderLayerList(layers, container) {
    if (!container) return;
    if (layers.length === 0) {
        container.innerHTML = '<p style="font-size: 0.7rem; color: #94a3b8; text-align: center;">Yüklü katman yok.</p>';
        return;
    }

    container.innerHTML = layers.map(l => `
        <div class="card" style="padding: 10px; margin-bottom: 8px; background: rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1; overflow: hidden;">
                <div style="font-size: 0.75rem; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${l.name}</div>
                <div style="font-size: 0.6rem; color: #94a3b8;">${l.type.toUpperCase()} Haritası</div>
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
}

window.deleteLayer = async (id) => {
    if (!confirm("Bu katmanı hem haritadan hem de buluttan silmek istediğinize emin misiniz?")) return;
    try {
        await deleteDoc(doc(db, 'mapLayers', id));
        if (window.removeLayerFromMap) window.removeLayerFromMap(id);
        alert("Katman silindi.");
    } catch (err) { alert("Hata: " + err.message); }
};
