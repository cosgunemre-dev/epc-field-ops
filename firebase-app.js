import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// SANA ÖZEL FİREBASE ANAHTARLARIN
const firebaseConfig = {
  apiKey: "AIzaSyAWlSm4uQ1r4_5R5BJzmi2EsoB5LHD62xY",
  authDomain: "epc-field-ops.firebaseapp.com",
  projectId: "epc-field-ops",
  storageBucket: "epc-field-ops.firebasestorage.app",
  messagingSenderId: "898161873065",
  appId: "1:898161873065:web:eea40264f6faa07df6d9b8"
};

// Sistemi Başlat
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Kayıt Ol ve 15 Günlük Hak Ver İşlemi
export async function registerUser(email, password, displayName) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Güvenlik: Kullanıcıya e-posta doğrulama linki gönder
        await sendEmailVerification(user);
        
        // 15 Gün Sonrasının Tarihini Hesapla
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 15);

        // Veritabanına (Firestore) Profil Kaydı Aç
        await setDoc(doc(db, "users", user.uid), {
            email: email,
            displayName: displayName,
            createdAt: new Date(),
            trialEndsAt: trialEndDate,
            isPremium: false // Abone mi?
        });
        
        return user;
    } catch (error) {
        throw error;
    }
}

export { signInWithEmailAndPassword, onAuthStateChanged, signOut, doc, getDoc };
