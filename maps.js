import { db } from './firebase-app.js';
import { 
    collection, query, where, onSnapshot, getDocs, orderBy, limit, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

let map;
let markers = {};
let routeLines = [];

export function initMap() {
    console.log("Harita Sistemi Yükleniyor...");
    const mapDiv = document.getElementById('map-container');
    if (!mapDiv) return;

    // Haritayı başlat (Default: Türkiye merkez)
    map = L.map('map-container').setView([39.9334, 32.8597], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    window.map = map;

    // EKİBİ GERÇEK ZAMANLI TAKİP ET
    loadTeamLocations();
    
    // PROJELERİ GÖSTER
    loadProjectsOnMap();
}

async function loadTeamLocations() {
    const q = query(collection(db, 'users'), where('managedBy', '==', window.user.uid));
    
    onSnapshot(q, (snapshot) => {
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const uid = doc.id;

            if (data.lastLocation) {
                const { lat, lng } = data.lastLocation;
                
                // Eskisini sil veya güncelle
                if (markers[uid]) {
                    markers[uid].setLatLng([lat, lng]);
                } else {
                    const icon = L.divIcon({
                        className: 'custom-div-icon',
                        html: `<div style="background:#f59e0b; color:#000; border:2px solid #fff; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:10px; box-shadow:0 2px 5px rgba(0,0,0,0.5);">${(data.name || 'P')[0]}</div>`,
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    });

                    markers[uid] = L.marker([lat, lng], {icon: icon})
                        .addTo(map)
                        .bindPopup(`
                            <div style="font-family: 'Outfit', sans-serif;">
                                <b style="color:#000;">${data.name || data.displayName}</b><br>
                                <small style="color:#666;">Son Görülme: ${data.lastSeen ? new Date(data.lastSeen.toMillis()).toLocaleTimeString() : '---'}</small><br>
                                <button onclick="window.showUserRoute('${uid}')" style="margin-top:10px; background:#1e293b; color:#fff; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; width:100%; font-size:11px;">1 Haftalık Rotayı Çiz</button>
                            </div>
                        `);
                }
            }
        });
    });
}

// BİR PERSONELİN 1 HAFTALIK ROTASINI ÇİZ
window.showUserRoute = async (uid) => {
    // Önceki rotaları temizle
    routeLines.forEach(line => map.removeLayer(line));
    routeLines = [];

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const q = query(
        collection(db, 'users', uid, 'locationHistory'),
        where('timestamp', '>=', Timestamp.fromDate(oneWeekAgo)),
        orderBy('timestamp', 'asc')
    );

    try {
        const snap = await getDocs(q);
        const path = snap.docs.map(d => [d.data().lat, d.data().lng]);

        if (path.length > 0) {
            const polyline = L.polyline(path, {color: '#f59e0b', weight: 4, opacity: 0.7, dashArray: '5, 10'}).addTo(map);
            routeLines.push(polyline);
            map.fitBounds(polyline.getBounds());
            alert(`${path.length} noktadan oluşan 1 haftalık rota çizildi.`);
        } else {
            alert("Bu personel için seçili tarihlerde rota verisi bulunamadı.");
        }
    } catch (err) {
        console.error("Rota çizme hatası:", err);
        alert("Rota verisi çekilirken bir hata oluştu (İndeks oluşturuluyor olabilir).");
    }
}

async function loadProjectsOnMap() {
    const q = query(collection(db, 'projects'), where('ownerId', '==', window.user.uid));
    const snap = await getDocs(q);
    snap.forEach(doc => {
        const p = doc.data();
        if (p.center) { // Eğer proje konumu varsa
            L.circle([p.center.lat, p.center.lng], {
                color: '#38bdf8',
                fillColor: '#38bdf8',
                fillOpacity: 0.2,
                radius: 500
            }).addTo(map).bindPopup(`Proje: ${p.name}`);
        }
    });
}
