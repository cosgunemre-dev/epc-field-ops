const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_DIR = "C:/Users/Lenovo/Desktop/SolarMech Verify";
const DEPLOY_DIR = "C:/Users/Lenovo/Desktop/KabloMakaraOptimizasyon/deploy";

// 1. Create firebase.ts
const firebaseTsContent = `
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAWlSm4uQ1r4_5R5BJzmi2EsoB5LHD62xY",
  authDomain: "epc-field-ops.firebaseapp.com",
  projectId: "epc-field-ops",
  storageBucket: "epc-field-ops.firebasestorage.app",
  messagingSenderId: "898161873065",
  appId: "1:898161873065:web:eea40264f6faa07df6d9b8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
`;
fs.writeFileSync(path.join(PROJECT_DIR, 'src/lib/firebase.ts'), firebaseTsContent.trim());

// 2. Create AuthGuard.tsx
const authGuardContent = `
"use client";
import React, { useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = '../login.html';
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (!data.isPremium && new Date() > data.trialEndsAt.toDate()) {
            alert("Ücretsiz deneme süreniz sona ermiştir.");
            window.location.href = "../dashboard.html";
            return;
          }
          (window as any).userUid = user.uid;
          setLoading(false);
        } else {
          window.location.href = '../login.html';
        }
      } catch (e) {
        console.error(e);
        window.location.href = '../login.html';
      }
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#020617', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{\`@keyframes spin { to { transform: rotate(360deg); } }\`}</style>
        <p style={{ marginTop: '20px', color: '#94a3b8', fontFamily: 'sans-serif', fontWeight: 'bold' }}>OmniSync Pro Yükleniyor...</p>
      </div>
    );
  }

  return <>{children}</>;
}
`;
fs.writeFileSync(path.join(PROJECT_DIR, 'src/components/AuthGuard.tsx'), authGuardContent.trim());

// 3. Update layout.tsx
let layoutTsx = fs.readFileSync(path.join(PROJECT_DIR, 'src/app/layout.tsx'), 'utf8');
if (!layoutTsx.includes('AuthGuard')) {
  layoutTsx = layoutTsx.replace("import { ProjectProvider }", "import { ProjectProvider } from '@/lib/project-store';\nimport { AuthGuard } from '@/components/AuthGuard';");
  layoutTsx = layoutTsx.replace(/<ProjectProvider>/g, "<AuthGuard><ProjectProvider>");
  layoutTsx = layoutTsx.replace(/<\/ProjectProvider>/g, "</ProjectProvider></AuthGuard>");
  fs.writeFileSync(path.join(PROJECT_DIR, 'src/app/layout.tsx'), layoutTsx);
}

// 4. Update page.tsx for Cloud Ops AND remove electron calls
const pageTsxPath = path.join(PROJECT_DIR, 'src/app/page.tsx');
let pageTsx = fs.readFileSync(pageTsxPath, 'utf8');

// Add Firebase Imports
if (!pageTsx.includes('firebase/storage')) {
  pageTsx = pageTsx.replace(
    `import { useProject } from '@/lib/project-store';`,
    `import { useProject } from '@/lib/project-store';\nimport { storage } from '@/lib/firebase';\nimport { ref, uploadString, getDownloadURL, listAll } from 'firebase/storage';`
  );
}

// Inject Cloud Modal and Logic
const replaceStart = "const handleOpenProject = async () => {";
const replaceEnd = "const handleNewFile = () => {";

const newCloudOps = `
  const [cloudModalOpen, setCloudModalOpen] = useState(false);
  const [cloudProjects, setCloudProjects] = useState<string[]>([]);

  const loadCloudProjects = async () => {
    const uid = (window as any).userUid;
    if (!uid) return;
    const listRef = ref(storage, \`users/\${uid}/verify_projects\`);
    try {
      const res = await listAll(listRef);
      setCloudProjects(res.items.map(item => item.name.replace('.json', '')));
    } catch(e) { console.error(e); }
  };

  const handleOpenProject = async () => {
    await loadCloudProjects();
    setCloudModalOpen(true);
  };

  const loadSpecificProject = async (projName: string) => {
    try {
      const uid = (window as any).userUid;
      const fileRef = ref(storage, \`users/\${uid}/verify_projects/\${projName}.json\`);
      const url = await getDownloadURL(fileRef);
      const res = await fetch(url);
      const data = await res.json();
      
      setProjectDetails(projName, "Bulut Depolama Modu");
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setSiteImage(data.siteImage || null);
      setLivePunches(data.punches || []);
      setLoadedData(data);
      setSelectedNodeId(null);
      setCloudModalOpen(false);
    } catch (e) {
      alert("Proje yüklenirken hata oluştu.");
    }
  };

  const handleSaveAs = async () => {
    const uid = (window as any).userUid;
    if (!uid) return alert('Kullanıcı doğrulanmadı.');

    const pName = prompt('Projeniz için bir isim girin:', activeProjectName || 'Yeni OmniSync Projesi');
    if (!pName) return;

    try {
      const fileRef = ref(storage, \`users/\${uid}/verify_projects/\${pName}.json\`);
      const dataStr = JSON.stringify({ nodes, edges, siteImage, punches: livePunches }, null, 2);
      await uploadString(fileRef, dataStr, 'raw');
      
      setProjectDetails(pName, "Bulut Güncel");
      const originalTitle = document.title;
      document.title = "BULUTA KAYDEDİLDİ ✔";
      alert("Proje buluta başarıyla kaydedildi!");
      setTimeout(() => document.title = originalTitle, 2000);
    } catch (e) {
      alert("Kaydetme hatası!");
    }
  };

  const handleSave = async () => {
    if (!activeProjectName) {
      handleSaveAs();
      return;
    }
    const uid = (window as any).userUid;
    try {
      const fileRef = ref(storage, \`users/\${uid}/verify_projects/\${activeProjectName}.json\`);
      const dataStr = JSON.stringify({ nodes, edges, siteImage, punches: livePunches }, null, 2);
      await uploadString(fileRef, dataStr, 'raw');
      const originalTitle = document.title;
      document.title = "KAYDEDİLDİ ✔";
      setTimeout(() => document.title = originalTitle, 1500);
    } catch (e) {
      alert("Kaydetme hatası!");
    }
  };

  const `;

// Replace the block
const regex = new RegExp(replaceStart.replace(/[.*+?^$\{key\}()|[\\]\\\\]/g, '\\\\$&') + "[\\\\s\\\\S]*?" + replaceEnd.replace(/[.*+?^$\{key\}()|[\\]\\\\]/g, '\\\\$&'));
pageTsx = pageTsx.replace(
  /const handleOpenProject = async \(\) => {[\s\S]*?const handleNewFile = \(\) => {/,
  newCloudOps + "handleNewFile = () => {"
);

// Inject Cloud Modal UI
const modalUI = `
      {cloudModalOpen && (
        <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:99999, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{background:'#0f172a', padding:'24px', borderRadius:'16px', border:'1px solid #334155', minWidth:'400px'}}>
             <h2 style={{color:'white', fontSize:'18px', fontWeight:'bold', marginBottom:'16px'}}>☁️ OmniSync Bulut Projeleri</h2>
             <div style={{maxHeight:'300px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'8px', paddingBottom:'16px'}}>
                {cloudProjects.length === 0 && <span style={{color:'#94a3b8'}}>Henüz bulutta kaydedilmiş projeniz yok.</span>}
                {cloudProjects.map(p => (
                  <button key={p} onClick={() => loadSpecificProject(p)} style={{padding:'12px', background:'#1e293b', border:'1px solid #475569', borderRadius:'8px', color:'white', textAlign:'left', fontWeight:'bold', cursor:'pointer'}} onMouseOver={e=>e.currentTarget.style.borderColor='#3b82f6'} onMouseOut={e=>e.currentTarget.style.borderColor='#475569'}>
                    📄 {p}
                  </button>
                ))}
             </div>
             <button onClick={() => setCloudModalOpen(false)} style={{width:'100%', padding:'12px', background:'#ef4444', color:'white', fontWeight:'bold', borderRadius:'8px', border:'none', cursor:'pointer'}}>Kapat</button>
          </div>
        </div>
      )}
`;

if (!pageTsx.includes('OmniSync Bulut Projeleri')) {
  pageTsx = pageTsx.replace(
    /<div className="w-full h-full flex flex-col relative" ref=\{reactFlowWrapper\}>/,
    `<div className="w-full h-full flex flex-col relative" ref={reactFlowWrapper}>\n${modalUI}`
  );
}

fs.writeFileSync(pageTsxPath, pageTsx);
console.log('page.tsx patched successfully.');

console.log('Building Next.js application...');
try {
  execSync('npm run build', { cwd: PROJECT_DIR, stdio: 'inherit' });
  console.log('Next.js build successful.');
  
  // Copy to deploy/verify
  const outDir = path.join(PROJECT_DIR, 'out');
  const destDir = path.join(DEPLOY_DIR, 'verify');

  function copyFolderSync(from, to) {
      if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
      fs.readdirSync(from).forEach(element => {
          const stats = fs.statSync(path.join(from, element));
          if (stats.isFile()) {
              fs.copyFileSync(path.join(from, element), path.join(to, element));
          } else if (stats.isDirectory()) {
              copyFolderSync(path.join(from, element), path.join(to, element));
          }
      });
  }

  copyFolderSync(outDir, destDir);
  console.log('Copied out folder to deploy/verify');
} catch (e) {
  console.error('Build failed:', e.message);
  process.exit(1);
}
