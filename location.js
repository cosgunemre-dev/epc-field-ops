import { db } from './firebase-app.js';
import { 
    doc, updateDoc, collection, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

let trackingInterval = null;

export function initLocation() {
    console.log("SahaBOSS Akıllı Takip Sistemi Başlatıldı.");
    
    // Uygulama açılır açılmaz ilk konumu gönder
    sendLocation(true);

    // Her 10 dakikada bir (600.000 ms) sessizce güncelle
    if (trackingInterval) clearInterval(trackingInterval);
    trackingInterval = setInterval(() => {
        sendLocation(false);
    }, 600000); 

    // Kullanıcıya bir durum mesajı (Opsiyonel)
    const gpsStatus = document.getElementById('gps-status');
    if (gpsStatus) {
        gpsStatus.textContent = 'OTOMATİK TAKİP AKTİF';
        gpsStatus.style.color = '#10b981';
    }
}

async function sendLocation(isInitial = false) {
    if (!navigator.geolocation) {
        console.warn('GPS Desteklenmiyor.');
        return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude, accuracy, speed } = pos.coords;
        const uid = window.user?.uid;
        if (!uid) return;

        try {
            // 1. ANLIK KONUM (Yöneticinin canlı görmesi için)
            await updateDoc(doc(db, 'users', uid), {
                lastLocation: { lat: latitude, lng: longitude },
                lastSeen: serverTimestamp(),
                isOnline: true
            });

            // 2. ROTA GEÇMİŞİ (Breadcrumbs - 1 haftalık hafıza için)
            // Sadece ana güncellemelerde veya ilk açılışta rotaya ekle
            await addDoc(collection(db, 'users', uid, 'locationHistory'), {
                lat: latitude,
                lng: longitude,
                acc: accuracy || 0,
                spd: speed || 0,
                timestamp: serverTimestamp()
            });

            console.log(`Konum güncellendi: ${latitude}, ${longitude} (${isInitial ? 'İlk' : 'Periyodik'})`);
        } catch (err) {
            console.error('Konum yazma hatası:', err);
        }
    }, (err) => {
        console.warn('GPS Alınamadı:', err.message);
    }, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
    });
}
