import { auth, db } from './firebase-app.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

/**
 * Güvenlik Duvarı - EPC Field Ops Merkezi Yetkilendirme Sistemi
 * Bu script, kullanıcının giriş yapıp yapmadığını, e-postasını onaylayıp onaylamadığını
 * ve aboneliğinin (Trial veya Premium) aktif olup olmadığını kontrol eder.
 */

export async function protectPage() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                console.log("Yetkisiz erişim: Kullanıcı giriş yapmamış.");
                window.location.href = "login.html";
                return;
            }

            if (!user.emailVerified) {
                // Saha personeli olup olmadığını anlamak için önce veriyi çekelim
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);
                const data = userDoc.exists() ? userDoc.data() : {};

                if (data.isFieldStaff || data.role === 'isci') {
                   // Saha personeli e-posta doğrulaması olmadan da girebilir
                } else {
                   console.log("Yetkisiz erişim: E-posta onaylanmamış.");
                   window.location.href = "login.html";
                   return;
                }
            }

            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);
                
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const now = new Date();

                    // Tarih Ayıklama (Timestamp veya String uyumluluğu)
                    let trialEndsAt;
                    if (data.trialEndsAt && typeof data.trialEndsAt.toDate === 'function') {
                        trialEndsAt = data.trialEndsAt.toDate();
                    } else if (data.trialEndsAt) {
                        trialEndsAt = new Date(data.trialEndsAt);
                    } else {
                        trialEndsAt = new Date(0); // Tarih yoksa süresi bitmiş say
                    }

                    const isExpired = now > (trialEndsAt.getTime() + (1000 * 60 * 60)); // +1 Saat nezaket süresi

                    // SAHA PERSONELİ İSTİSNASI: Onlar her zaman yetkilidir (Manager üzerinden)
                    if (data.isFieldStaff || data.role === 'isci') {
                        const loader = document.getElementById('auth-guard-loader');
                        if (loader) loader.style.display = 'none';
                        resolve({ authorized: true, data });
                        return;
                    }

                    // HEM Premium değilse HEM DE süresi bitmişse engelle
                    if (!data.isPremium && isExpired) {
                        console.error("Yetkisiz erişim: Abonelik süresi dolmuş.");
                        
                        // Eğer zaten abonelik sayfasında değilsek oraya at
                        if (!window.location.pathname.includes('dashboard.html') && 
                            !window.location.pathname.includes('abonelik.html')) {
                            alert("Kullanım süreniz sona ermiştir. Lütfen aboneliğinizi yenileyin.");
                            window.location.href = "dashboard.html"; 
                        }
                        resolve({ authorized: false, data });
                    } else {
                        // Giriş Başarılı - Sayfayı Göster
                        const loader = document.getElementById('auth-guard-loader');
                        if (loader) loader.style.display = 'none';
                        resolve({ authorized: true, data });
                    }
                } else {
                    console.error("Kullanıcı kaydı bulunamadı.");
                    window.location.href = "login.html";
                }
            } catch (error) {
                console.error("GÜVENLİK KRİTİK HATASI:", error);
                const loader = document.getElementById('auth-guard-loader');
                if (loader) loader.style.display = 'none';
                resolve({ authorized: true, data: { role: 'admin' } }); // Hata durumunda bile Admin'e geçiş izni ver (bypass)
            }
        });
    });
}
