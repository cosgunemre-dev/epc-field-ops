const fs = require('fs');
const path = require('path');

// 1. Update next.config.ts
const nextConfigPath = 'C:/Users/Lenovo/Desktop/SolarMech Verify/next.config.ts';
let nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');

// If not exported yet, add it
if (!nextConfigContent.includes('output: "export"')) {
    nextConfigContent = nextConfigContent.replace(
        'const nextConfig: NextConfig = {',
        'const nextConfig: NextConfig = {\n  output: "export",\n  trailingSlash: true,'
    );
    fs.writeFileSync(nextConfigPath, nextConfigContent, 'utf8');
    console.log('next.config.ts updated.');
}

// 2. Add OmniSync Pro to Dashboard
const dashboardPath = 'C:/Users/Lenovo/Desktop/KabloMakaraOptimizasyon/deploy/dashboard.html';
let dashboardHtml = fs.readFileSync(dashboardPath, 'utf8');

if (!dashboardHtml.includes('id="omnisync-card"')) {
    const newCard = `
                    <!-- OmniSync Pro -->
                    <a href="verify/index.html" class="app-card" id="omnisync-card">
                        <div class="app-icon">⚡</div>
                        <h3>OmniSync Pro <span class="status-badge" id="omnisync-badge">AKTİF</span></h3>
                        <p>Elektrik topolojisini interaktif olarak belirleyin, test sonuçlarını cihaz bazlı girin ve devreye alma raporlarınızı otomatik oluşturun.</p>
                        <span style="display: inline-block; padding: 8px 16px; background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-radius: 8px; font-weight: 600; font-size: 0.9rem;" id="omnisync-action-text">Uygulamayı Aç →</span>
                    </a>
                </div>`;
                
    dashboardHtml = dashboardHtml.replace(
        /<\/a>\s*<\/div>\s*<\/div>\s*<!-- Sağ Taraf Reklam Alanları -->/,
        `</a>${newCard}\n            </div>\n\n            <!-- Sağ Taraf Reklam Alanları -->`
    );

    const lockLogic = `
                                const makenikCard = document.getElementById('makenik-card');
                                makenikCard.classList.add('locked');
                                makenikCard.href = "#";
                                document.getElementById('makenik-badge').innerText = "KİLİTLİ";
                                document.getElementById('makenik-badge').classList.add('locked');
                                document.getElementById('makenik-action-text').innerText = "Abonelik Gereklidir";

                                const omnisyncCard = document.getElementById('omnisync-card');
                                omnisyncCard.classList.add('locked');
                                omnisyncCard.href = "#";
                                document.getElementById('omnisync-badge').innerText = "KİLİTLİ";
                                document.getElementById('omnisync-badge').classList.add('locked');
                                document.getElementById('omnisync-action-text').innerText = "Abonelik Gereklidir";`;

    dashboardHtml = dashboardHtml.replace(
        /const makenikCard = document.getElementById\('makenik-card'\);[\s\S]*?Abonelik Gereklidir";/,
        lockLogic
    );
    
    fs.writeFileSync(dashboardPath, dashboardHtml, 'utf8');
    console.log('dashboard.html updated.');
}

// 3. Update build_secure.js
const buildSecurePath = 'C:/Users/Lenovo/Desktop/KabloMakaraOptimizasyon/deploy/build_secure.js';
let buildSecureContent = fs.readFileSync(buildSecurePath, 'utf8');

if (!buildSecureContent.includes("'verify'")) {
    buildSecureContent = buildSecureContent.replace(
        "const ignores = ['node_modules', '.git', 'deploy_secure', 'package.json', 'package-lock.json', 'build_secure.js', '.vercel'];",
        "const ignores = ['node_modules', '.git', 'deploy_secure', 'package.json', 'package-lock.json', 'build_secure.js', '.vercel', 'verify'];"
    );
    fs.writeFileSync(buildSecurePath, buildSecureContent, 'utf8');
    console.log('build_secure.js updated.');
}

// Copy the firebase-app config for usage in OmniSync Pro
const firebaseAppPath = 'C:/Users/Lenovo/Desktop/KabloMakaraOptimizasyon/deploy/firebase-app.js';
const firebaseAppDest = 'C:/Users/Lenovo/Desktop/SolarMech Verify/public/firebase-app-global.js';
fs.copyFileSync(firebaseAppPath, firebaseAppDest);
console.log('Firebase config copied to public folder.');
