import { db } from './firebase-app.js';
import { 
    collection, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let trackingInterval = null;
const gpsStatus = document.getElementById('gps-status');
const gpsToggle = document.getElementById('gps-toggle');

export function initLocation() {
    // Önceki tercihi hatırla (localStorage)
    const isTracking = localStorage.getItem('sahaBoss_gps_enabled') === 'true';
    gpsToggle.checked = isTracking;

    if (isTracking) {
        startTracking();
    }

    gpsToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            startTracking();
            localStorage.setItem('sahaBoss_gps_enabled', 'true');
        } else {
            stopTracking();
            localStorage.setItem('sahaBoss_gps_enabled', 'false');
        }
    });
}

function startTracking() {
    if (!navigator.geolocation) {
        alert('Cihazınız GPS desteklemiyor.');
        gpsToggle.checked = false;
        return;
    }

    gpsStatus.textContent = 'AKTİF';
    gpsStatus.style.color = 'var(--success)';

    // İlk konumu hemen al
    sendLocation();

    // Dakikada bir tekrarla (60000 ms)
    trackingInterval = setInterval(sendLocation, 60000);
}

function stopTracking() {
    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
    }
    gpsStatus.textContent = 'KAPALI';
    gpsStatus.style.color = 'var(--danger)';
}

async function sendLocation() {
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude, accuracy, heading, speed } = pos.coords;
        
        try {
            // Logs koleksiyonuna yaz
            await addDoc(collection(db, 'locations', window.user.uid, 'logs'), {
                lat: latitude,
                lng: longitude,
                accuracy: accuracy,
                heading: heading,
                speed: speed,
                timestamp: serverTimestamp()
            });

            // Ayrıca harita için "lastLocation" bilgisini kullanıcı dokümanına yazabiliriz
            // (Optimize etmek için sadece canlı konumu tutan ayrı bir koleksiyon da olabilir)
        } catch (err) {
            console.error('Konum gönderilemedi:', err);
        }
    }, (err) => {
        console.warn('GPS Hatası:', err.message);
    }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    });
}
