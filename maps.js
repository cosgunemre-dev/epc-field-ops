import { db, storage } from './firebase-app.js';
import { 
    collection, query, where, onSnapshot, getDocs, orderBy, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { ref, getBytes } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

let map;
let markers = {};
let routeLines = [];
let activeLayers = {}; 

export function initMap() {
    console.log("SahaBOSS Harita Modülü Hazır.");
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

// URL'den Firebase path'ini ayıklayan yardımcı fonksiyon
function getStoragePath(url) {
    try {
        if (url.includes('/o/')) {
            const path = url.split('/o/')[1].split('?')[0];
            return decodeURIComponent(path);
        }
    } catch(e) {}
    return url;
}

window.toggleLayer = async (id, url, type) => {
    const icon = document.getElementById(`icon-layer-${id}`);
    
    if (activeLayers[id]) {
        map.removeLayer(activeLayers[id]);
        delete activeLayers[id];
        if (icon) icon.className = 'bx bx-show';
        return;
    }

    if (icon) icon.className = 'bx bx-loader-alt bx-spin';

    try {
        // GÜVENLİ İNDİRME: Path üzerinden doğrudan erişim
        const path = getStoragePath(url);
        const storageRef = ref(storage, path);
        const buffer = await getBytes(storageRef);
        let leafletLayer;

        if (type === 'kmz') {
            const zip = await JSZip.loadAsync(buffer);
            const kmlFile = Object.keys(zip.files).find(f => f.endsWith('.kml'));
            if (!kmlFile) throw new Error("KMZ içinde KML bulunamadı.");
            const kmlText = await zip.file(kmlFile).async("string");
            
            const parser = new DOMParser();
            const kmlDom = parser.parseFromString(kmlText, "text/xml");
            const geoJsonData = toGeoJSON.kml(kmlDom);
            
            leafletLayer = L.geoJSON(geoJsonData, {
                style: { color: '#f59e0b', weight: 3, opacity: 0.8 },
                onEachFeature: (f, l) => { if(f.properties.name) l.bindPopup(f.properties.name); }
            }).addTo(map);

        } else {
            const kmlText = new TextDecoder().decode(buffer);
            const parser = new DOMParser();
            const kmlDom = parser.parseFromString(kmlText, "text/xml");
            const geoJsonData = toGeoJSON.kml(kmlDom);

            leafletLayer = L.geoJSON(geoJsonData, {
                style: { color: '#f59e0b', weight: 3, opacity: 0.8 },
                onEachFeature: (f, l) => { if(f.properties.name) l.bindPopup(f.properties.name); }
            }).addTo(map);
        }

        activeLayers[id] = leafletLayer;
        if (icon) icon.className = 'bx bxs-show';
        if (leafletLayer.getBounds().isValid()) map.fitBounds(leafletLayer.getBounds());

    } catch (err) {
        console.error("Hata Detayı:", err);
        alert("❌ Dosya Açılamadı: " + err.message);
        if (icon) icon.className = 'bx bx-show';
    }
}

window.removeLayerFromMap = (id) => {
    if (activeLayers[id]) {
        map.removeLayer(activeLayers[id]);
        delete activeLayers[id];
    }
}

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
                        html: `<div style="background:#f59e0b; color:#000; border:2px solid #fff; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:11px; box-shadow:0 3px 6px rgba(0,0,0,0.4);">${(data.name || 'P')[0]}</div>`,
                        iconSize: [32, 32],
                        iconAnchor: [16, 16]
                    });
                    markers[uid] = L.marker([lat, lng], {icon: icon}).addTo(map)
                        .bindPopup(`<b>${data.name || data.displayName}</b><br><button onclick="window.showUserRoute('${uid}')" style="width:100%; font-size:10px; margin-top:5px;">Rotayı Gör</button>`);
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
            const polyline = L.polyline(path, {color: '#f59e0b', weight: 5, dashArray: '10, 10'}).addTo(map);
            routeLines.push(polyline);
            map.fitBounds(polyline.getBounds());
            alert(`Personelin 1 haftalık rotası (${path.length} nokta) haritaya işlendi.`);
        } else {
            alert("Bu personel için kayıtlı rota bulunamadı.");
        }
    } catch (err) { console.error(err); }
}

async function loadProjectsOnMap() {
    const q = query(collection(db, 'projects'), where('ownerId', '==', window.user.uid));
    const snap = await getDocs(q);
    snap.forEach(doc => {
        const p = doc.data();
        if (p.center) {
            L.circle([p.center.lat, p.center.lng], { color: '#38bdf8', fillColor:'#38bdf8', opacity:0.8, radius: 500 }).addTo(map).bindPopup(`Proje: ${p.name}`);
        }
    });
}
