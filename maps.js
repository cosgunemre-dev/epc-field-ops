import { db } from './firebase-app.js';
import { 
    collection, query, where, onSnapshot, getDocs, orderBy, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

let map;
let markers = {};
let routeLines = [];
let activeLayers = {}; // Yüklü katmanları burada tutuyoruz { id: leafletLayer }

export function initMap() {
    console.log("Harita Sistemi Yükleniyor...");
    const mapDiv = document.getElementById('map-container');
    if (!mapDiv) return;

    if (map) map.remove();

    map = L.map('map-container').setView([39.9334, 32.8597], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    window.map = map;

    loadTeamLocations();
    loadProjectsOnMap();
}

// KATMAN GÖSTER / GİZLE (KML & KMZ)
window.toggleLayer = async (id, url, type) => {
    const icon = document.getElementById(`icon-layer-${id}`);
    
    // Eğer katman zaten açıksa: KAPAT
    if (activeLayers[id]) {
        map.removeLayer(activeLayers[id]);
        delete activeLayers[id];
        if (icon) icon.className = 'bx bx-show';
        return;
    }

    // Eğer katman kapalıysa: AÇ
    if (icon) icon.className = 'bx bx-loader-alt bx-spin';

    try {
        let leafletLayer;

        if (type === 'kmz') {
            // KMZ: ZIP'i çöz ve KML'yi al
            const response = await fetch(url);
            const data = await response.blob();
            const zip = await JSZip.loadAsync(data);
            
            // İlk bulduğun .kml dosyasını oku
            const kmlFile = Object.keys(zip.files).find(f => f.endsWith('.kml'));
            const kmlText = await zip.file(kmlFile).async("string");
            
            // KML'yi GeoJSON'a çevir ve haritaya ekle
            const parser = new DOMParser();
            const kmlDom = parser.parseFromString(kmlText, "text/xml");
            const geoJsonData = toGeoJSON.kml(kmlDom);
            
            leafletLayer = L.geoJSON(geoJsonData, {
                style: { color: '#f59e0b', weight: 2 },
                onEachFeature: (f, l) => { if(f.properties.name) l.bindPopup(f.properties.name); }
            }).addTo(map);

        } else {
            // KML: Doğrudan omnivore ile yükle
            leafletLayer = omnivore.kml(url, null, L.geoJSON(null, {
                style: { color: '#f59e0b', weight: 2 },
                onEachFeature: (f, l) => { if(f.properties.name) l.bindPopup(f.properties.name); }
            })).addTo(map);
        }

        activeLayers[id] = leafletLayer;
        if (icon) icon.className = 'bx bxs-show';
        
        // Katmana odaklan
        leafletLayer.on('ready', () => map.fitBounds(leafletLayer.getBounds()));
        if (type === 'kmz') map.fitBounds(leafletLayer.getBounds());

    } catch (err) {
        console.error("Katman yükleme hatası:", err);
        alert("Katman yüklenemedi: " + err.message);
        if (icon) icon.className = 'bx bx-show';
    }
}

window.removeLayerFromMap = (id) => {
    if (activeLayers[id]) {
        map.removeLayer(activeLayers[id]);
        delete activeLayers[id];
    }
}

// EKİP TAKİBİ
async function loadTeamLocations() {
    const q = query(collection(db, 'users'), where('managedBy', '==', window.user.uid));
    onSnapshot(q, (snapshot) => {
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const uid = doc.id;
            if (data.lastLocation) {
                const { lat, lng } = data.lastLocation;
                if (markers[uid]) {
                    markers[uid].setLatLng([lat, lng]);
                } else {
                    const icon = L.divIcon({
                        className: 'custom-div-icon',
                        html: `<div style="background:#f59e0b; color:#000; border:2px solid #fff; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:10px; box-shadow:0 2px 5px rgba(0,0,0,0.5);">${(data.name || 'P')[0]}</div>`,
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    });
                    markers[uid] = L.marker([lat, lng], {icon: icon}).addTo(map)
                        .bindPopup(`<b>${data.name || data.displayName}</b><br><button onclick="window.showUserRoute('${uid}')" style="width:100%; font-size:10px;">Rota Göster</button>`);
                }
            }
        });
    });
}

window.showUserRoute = async (uid) => {
    routeLines.forEach(line => map.removeLayer(line));
    routeLines = [];
    const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const q = query(collection(db, 'users', uid, 'locationHistory'), where('timestamp', '>=', Timestamp.fromDate(oneWeekAgo)), orderBy('timestamp', 'asc'));
    try {
        const snap = await getDocs(q);
        const path = snap.docs.map(d => [d.data().lat, d.data().lng]);
        if (path.length > 0) {
            const polyline = L.polyline(path, {color: '#f59e0b', weight: 4, dashArray: '5, 10'}).addTo(map);
            routeLines.push(polyline);
            map.fitBounds(polyline.getBounds());
        }
    } catch (err) { console.error(err); }
}

async function loadProjectsOnMap() {
    const q = query(collection(db, 'projects'), where('ownerId', '==', window.user.uid));
    const snap = await getDocs(q);
    snap.forEach(doc => {
        const p = doc.data();
        if (p.center) {
            L.circle([p.center.lat, p.center.lng], { color: '#38bdf8', radius: 500 }).addTo(map).bindPopup(`Proje: ${p.name}`);
        }
    });
}
