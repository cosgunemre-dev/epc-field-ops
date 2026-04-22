import { db } from './firebase-app.js';
import { 
    collection, query, onSnapshot, where, orderBy, limit 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let map = null;
let userMarkers = {};
let taskMarkers = {};

// Katmanlar
let baseMaps = {};

export function initMap() {
    const mapEl = document.getElementById('map-container');
    if (!mapEl) return;

    // Normal Harita (OpenStreetMap)
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    });

    // Uydu Görüntüsü (Esri World Imagery)
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
    });

    map = L.map('map-container', {
        center: [38.4192, 27.1287],
        zoom: 13,
        layers: [osm] // Varsayılan katman
    });
    window.map = map;

    baseMaps = {
        "Normal Harita": osm,
        "Uydu Görüntüsü": satellite
    };

    // Katman Kontrolü (Sağ Üstte)
    L.control.layers(baseMaps).addTo(map);

    // Saha Ekibi Konumlarını Dinle
    if (['sef', 'mudur', 'koordinator', 'baskan', 'admin'].includes((window.userData.role || '').toLowerCase())) {
        listenToTeamLocations();
    }

    // Görev Konumlarını Dinle
    listenToTaskLocations();
    
    // Kendi konumuna odaklan
    navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 15);
        addMyMarker(latitude, longitude);
    });
}

function addMyMarker(lat, lng) {
    L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: "var(--info)",
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    }).addTo(map).bindPopup('Siz');
}

function getHelmetColor(role) {
    role = (role || '').toLowerCase();
    if (['admin', 'baskan', 'koordinator'].includes(role)) return '#ffffff'; // Beyaz (Yönetim)
    if (['mudur', 'sef', 'muhendis'].includes(role)) return '#38bdf8'; // Mavi (Teknik)
    return '#fbbf24'; // Sarı (Saha)
}

function listenToTeamLocations() {
    const q = query(collection(db, 'users'), where('projectId', '==', window.userData.projectId));
    
    onSnapshot(q, (snapshot) => {
        snapshot.docs.forEach(userDoc => {
            const userData = userDoc.data();
            const userId = userDoc.id;
            if (userId === window.user.uid) return;

            // Her kullanıcının son 20 konum logunu çek
            const posQuery = query(
                collection(db, 'locations', userId, 'logs'),
                limit(20)
            );

            onSnapshot(posQuery, (posSnapshot) => {
                if (posSnapshot.empty) return;

                // JS Tarafında sırala
                const logs = posSnapshot.docs.map(d => ({ ...d.data() }));
                logs.sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));

                const points = logs.map(l => [l.lat, l.lng]);
                const lastPos = points[points.length - 1];

                // 1. Marker'ı Güncelle (Kask)
                const hColor = getHelmetColor(userData.role);
                if (userMarkers[userId]) {
                    userMarkers[userId].setLatLng(lastPos);
                } else {
                    const helmetIcon = L.divIcon({
                        className: 'custom-div-icon',
                        html: `<div style="background:${hColor}; width:30px; height:30px; border-radius:50%; border:3px solid #1e293b; display:flex; align-items:center; justify-content:center; font-size:16px; box-shadow:0 0 10px rgba(0,0,0,0.5);">👷</div>`,
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    });
                    userMarkers[userId] = L.marker(lastPos, { icon: helmetIcon }).addTo(map)
                        .bindPopup(`<strong>${userData.name}</strong><br>${(userData.role || '').toUpperCase()}`);
                }
            }, (error) => {
                // Konum logları için dizin hatası alınırsa sadece sessizce geç
            });
        });
    });
}

function listenToTaskLocations() {
    const q = query(collection(db, 'tasks'), where('projectId', '==', window.userData.projectId));
    
    onSnapshot(q, (snapshot) => {
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.location && data.location.lat && data.location.lng) {
                if (taskMarkers[doc.id]) map.removeLayer(taskMarkers[doc.id]);
                
                const taskColor = data.priority === 'urgent' ? 'var(--danger)' : 'var(--primary)';
                const taskIcon = L.divIcon({
                    className: 'task-marker',
                    html: `<div style="background:${taskColor}; width:12px; height:12px; border-radius:2px; border:2px solid #fff; transform:rotate(45deg);"></div>`,
                    iconSize: [12, 12]
                });

                const marker = L.marker([data.location.lat, data.location.lng], { icon: taskIcon })
                    .addTo(map)
                    .bindPopup(`<strong>${data.title}</strong><br>Durum: ${data.status}`);
                
                taskMarkers[doc.id] = marker;
            }
        });
    });
}
