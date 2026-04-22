import { auth, db } from './firebase-app.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

/**
 * Güvenlik Duvarı - EPC Field Ops Merkezi Yetkilendirme Sistemi
 * Herkesin e-posta onayı yapmasını mecburi kılan STANDART sürüm.
 */

export async function protectPage() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            const loader = document.getElementById('loader') || document.getElementById('auth-guard-loader');
            
            // 1. Giriş Kontrolü
            if (!user) {
                console.log("Yetkisiz erişim: Giriş yapılmamış.");
                window.location.href = "login.html";
                return;
            }

            // 2. E-posta Onay Kontrolü (HERKES İÇİN MECBURİ)
            if (!user.emailVerified) {
                console.log("Yetkisiz erişim: E-posta onaylanmamış.");
                if (loader) loader.style.display = 'none';
                // Eğer zaten login sayfasında değilsek oraya at
                if (!window.location.pathname.includes('login.html')) {
                    alert("Hesabınızı kullanabilmek için e-postanıza gelen onay linkine tıklayın.");
                    auth.signOut().then(() => { window.location.href = "login.html"; });
                }
                resolve({ authorized: false, data: {} });
                return;
            }

            try {
                // 3. Kullanıcı Verilerini Çek
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);
                
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    
                    // İşçi/Saha Personeli ise ve ana dashboard'a girmeye çalışıyorsa yönlendir
                    if ((data.isFieldStaff || data.role === 'isci' || data.role === 'forman') && window.location.pathname.includes('dashboard.html')) {
                        window.location.href = "worker-sahaboss.html";
                        return;
                    }

                    // Yönetici ise ve abonelik bitmişse dashboard dışındaki yerleri engelle
                    // (SahaBOSS sayfası bir istisnadır, yönetici ekibini her zaman yönetebilmeli)
                    const isSahaPage = window.location.pathname.includes('admin-sahaboss.html') || window.location.pathname.includes('app-sahaboss.html');
                    
                    if (!data.isPremium && !isSahaPage) {
                        const trialEndsAt = data.trialEndsAt?.toDate ? data.trialEndsAt.toDate() : new Date(data.trialEndsAt || 0);
                        if (new Date() > trialEndsAt) {
                            if (!window.location.pathname.includes('dashboard.html')) {
                                alert("Abonelik süreniz dolmuştur.");
                                window.location.href = "dashboard.html";
                            }
                            resolve({ authorized: false, data });
                            return;
                        }
                    }

                    if (loader) loader.style.display = 'none';
                    resolve({ authorized: true, data });
                } else {
                    console.error("Kullanıcı kaydı bulunamadı.");
                    if (loader) loader.style.display = 'none';
                    resolve({ authorized: false, data: {} });
                }
            } catch (error) {
                console.error("KRİTİK GÜVENLİK HATASI:", error);
                if (loader) loader.style.display = 'none';
                resolve({ authorized: true, data: { role: 'admin' } }); // Acil durumda engelleme
            }
        });
    });
}
