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
        // GÜVENLİ İNDİRME YÖNTEMİ (CORS Hatasını engeller)
        const storageRef = ref(storage, url);
        const buffer = await getBytes(storageRef);
        let leafletLayer;

        if (type === 'kmz') {
            const zip = await JSZip.loadAsync(buffer);
            const kmlFile = Object.keys(zip.files).find(f => f.endsWith('.kml'));
            const kmlText = await zip.file(kmlFile).async("string");
            
            const parser = new DOMParser();
            const kmlDom = parser.parseFromString(kmlText, "text/xml");
            const geoJsonData = toGeoJSON.kml(kmlDom);
            
            leafletLayer = L.geoJSON(geoJsonData, {
                style: { color: '#f59e0b', weight: 3, opacity: 0.8 },
                onEachFeature: (f, l) => { if(f.properties.name) l.bindPopup(f.properties.name); }
            }).addTo(map);

        } else {
            // KML için text dönüşümü
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
        
        // Katmana odaklan
        if (leafletLayer.getBounds().isValid()) {
            map.fitBounds(leafletLayer.getBounds());
        }

    } catch (err) {
        console.error("Katman yükleme hatası:", err);
        alert("❌ Katman açılamadı: " + err.message);
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
            L.circle([p.center.lat, p.center.lng], { color: '#38bdf8', radius: 500, label: p.name }).addTo(map).bindPopup(`Proje: ${p.name}`);
        }
    });
}
