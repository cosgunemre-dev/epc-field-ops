const fs = require('fs');

const target = 'C:/Users/Lenovo/Desktop/KabloMakaraOptimizasyon/deploy/app-makenik.html';
let html = fs.readFileSync(target, 'utf8');

// Replace standard electron buttons with Cloud buttons
const lines = html.split('\n');
let newLines = [];
let skip = false;

for (let line of lines) {
    if (line.includes('window.electronNewProject')) {
        skip = true;
        newLines.push('        <a href="dashboard.html" style="text-decoration:none;color:#10b981;font-size:12px;font-weight:700;padding:6px 12px;border:1px solid #10b981;border-radius:4px;margin-right:15px;">← Dashboard</a>');
        newLines.push('        <button onclick="cloudNewProject()" title="Yeni Proje">✨ Yeni</button>');
        newLines.push('        <button onclick="cloudOpenProject()" title="Buluttaki Projeler">☁️ Projelerim</button>');
        newLines.push('        <button onclick="cloudSaveProject()" title="Zorla Kaydet">💾 Kaydet</button>');
        newLines.push('        <button onclick="exportAppData()" title="Verileri Yedekle (JSON)" style="margin-left: 20px; background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">📥 Yedek İndir</button>');
        newLines.push('        <button onclick="document.getElementById(\'import-file-input\').click()" title="Yedekten Geri Yükle (JSON)" style="background: rgba(168, 85, 247, 0.2); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.3);">📤 Yedek Yükle</button>');
        continue;
    }
    // Also skip original Open, Save, Efsane Yedek, exportAppData, and export backup buttons
    if (skip && line.includes('<input type="file" id="import-file-input"')) {
        skip = false;
    }
    if (!skip) {
        newLines.push(line);
    }
}

html = newLines.join('\n');

// Title Update
html = html.replace('<title>Makenik v6 - GES Saha Mekanik Takibi</title>', '<title>Makenik V6 Plancı — EPC Field Ops</title>');

// Auth Guard & Cloud Scripts
const authGuard = `
    <!-- Modal for Cloud Projects -->
    <div id="cloud-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:20000;align-items:center;justify-content:center;">
        <div style="background:#1e293b;padding:20px;border-radius:8px;width:400px;max-width:90%;">
            <h3 style="margin-bottom:15px;">Buluttaki Projelerim</h3>
            <div id="cloud-project-list" style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;">
                Yükleniyor...
            </div>
            <button onclick="document.getElementById('cloud-modal').style.display='none'" style="margin-top:20px;background:#ef4444;border:none;padding:8px 16px;border-radius:4px;color:white;cursor:pointer;">Kapat</button>
        </div>
    </div>

    <!-- Auth Guard -->
    <div id="auth-guard-loader" style="position:fixed;top:0;left:0;width:100%;height:100vh;background:#020617;z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div style="width:40px;height:40px;border:4px solid rgba(255,255,255,0.1);border-top-color:#4ade80;border-radius:50%;animation:spin 1s linear infinite;"></div>
        <p style="margin-top:20px;color:#94a3b8;font-family:sans-serif;">Erişim kontrol ediliyor...</p>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg);}}</style>

    <script type="module">
        import { auth, onAuthStateChanged, db, doc, getDoc, setDoc, collection, getDocs, query, where } from './firebase-app.js';
        import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

        // Makenik state reference workaround
        window.userUid = null;
        const storage = getStorage();

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                if (!user.emailVerified) { window.location.href = "login.html"; return; }
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        if (!data.isPremium && new Date() > data.trialEndsAt.toDate()) {
                            alert("Ücretsiz deneme süreniz sona ermiştir.");
                            window.location.href = "dashboard.html";
                            return;
                        }
                        window.userUid = user.uid; // Ready for cloud ops
                    }
                } catch(e) { console.error(e); }
                document.getElementById('auth-guard-loader').style.display = 'none';
            } else {
                window.location.href = "login.html";
            }
        });

        // Cloud API functions for UI buttons
        window.cloudNewProject = () => {
            if(confirm('Mevcut projeyi buluta kaydetmediyseniz silinecektir. Yeni proje açılsın mı?')) {
                localStorage.removeItem('makenik_v6_data');
                window.currentFilePath = null;
                document.getElementById('project-name-label').textContent = 'İsimsiz Proje';
                location.reload();
            }
        };

        window.cloudSaveProject = async () => {
            if(!window.userUid) return alert('Kullanıcı doğrulanmadı.');
            
            let projName = document.getElementById('project-name-label').textContent;
            if (projName === 'İsimsiz Proje') {
                projName = prompt('Projeniz için bir isim girin:', 'Yeni GES Projesi');
                if(!projName) return;
            }

            const dataStr = localStorage.getItem('makenik_v6_data');
            if(!dataStr) {
                alert('Kaydedilecek veri yok. Önce projeyi oluşturun.');
                return;
            }

            const cleanName = projName.replace(/[^a-zA-Z0-9 -_]/g, '').trim() + '_' + Date.now();
            const storageRef = ref(storage, \`users/\${window.userUid}/makenik/\${cleanName}.json\`);

            showStatus('Buluta kaydediliyor...', '#f59e0b');
            try {
                await uploadString(storageRef, dataStr);
                // Save meta to Firestore
                await setDoc(doc(db, "users", window.userUid, "makenik_projects", cleanName), {
                    name: projName,
                    fileName: \`\${cleanName}.json\`,
                    createdAt: new Date()
                });
                
                document.getElementById('project-name-label').textContent = projName;
                window.currentFilePath = cleanName;
                
                showStatus('✅ Buluta Kaydedildi', '#10b981');
            } catch (err) {
                console.error(err);
                showStatus('❌ Kayıt Hatası', '#ef4444');
            }
        };

        window.cloudOpenProject = async () => {
            if(!window.userUid) return;
            document.getElementById('cloud-modal').style.display = 'flex';
            const listEl = document.getElementById('cloud-project-list');
            listEl.innerHTML = 'Yükleniyor...';

            try {
                const q = query(collection(db, "users", window.userUid, "makenik_projects"));
                const querySnapshot = await getDocs(q);
                
                if(querySnapshot.empty) {
                    listEl.innerHTML = 'Bulutta projeniz bulunamadı.';
                    return;
                }

                let html = '';
                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    html += \`
                        <div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
                            <span>\${data.name}</span>
                            <button onclick="cloudLoadSpecific('\${data.fileName}', '\${data.name}')" style="background:#10b981;border:none;padding:5px 10px;border-radius:4px;color:white;cursor:pointer;">Aç</button>
                        </div>
                    \`;
                });
                listEl.innerHTML = html;
            } catch(e) {
                console.error(e);
                listEl.innerHTML = 'Hata oluştu.';
            }
        };

        window.cloudLoadSpecific = async (fileName, projectName) => {
            const listEl = document.getElementById('cloud-project-list');
            listEl.innerHTML = 'Buluttan indiriliyor...';
            try {
                const storageRef = ref(storage, \`users/\${window.userUid}/makenik/\${fileName}\`);
                const url = await getDownloadURL(storageRef);
                const response = await fetch(url);
                const jsonStr = await response.text();
                
                localStorage.setItem('makenik_v6_data', jsonStr);
                
                document.getElementById('project-name-label').textContent = projectName;
                window.currentFilePath = fileName;
                
                alert('Proje yüklendi!');
                location.reload();
            } catch(e) {
                console.error(e);
                listEl.innerHTML = 'İndirme hatası.';
            }
        };

        function showStatus(msg, color) {
            const el = document.getElementById('save-status');
            if(el) {
                el.innerText = msg;
                el.style.color = color;
                setTimeout(()=> el.innerText = '', 3000);
            }
        }
    </script>
</body>`;

// Sadece en sondaki body'i değiştir.
const lastBodyIdx = html.lastIndexOf('</body>');
html = html.substring(0, lastBodyIdx) + authGuard + html.substring(lastBodyIdx + 7);

fs.writeFileSync(target, html, 'utf8');
console.log('Inject OK!');
