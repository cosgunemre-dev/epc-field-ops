import { db } from './firebase-app.js';
import { 
    collection, query, getDocs, where 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export function initReports() {
    const btnOpen = document.getElementById('btn-open-reports');
    const modal = document.getElementById('modal-reports');
    const btnGen = document.getElementById('btn-gen-pdf');

    if (btnOpen) {
        btnOpen.onclick = () => modal.classList.remove('hidden');
    }

    if (btnGen) {
        btnGen.onclick = () => generateDailyPDF();
    }

    window.closeReportsModal = () => {
        modal.classList.add('hidden');
    };
}

// Yardımcı: Resmi Base64 formatına çevir (PDF'e eklemek için)
async function getBase64ImageFromURL(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.setAttribute('crossOrigin', 'anonymous');
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            const dataURL = canvas.toDataURL("image/jpeg", 0.5); // Kaliteyi %50 yaparak boyutu düşür
            resolve(dataURL);
        };
        img.onerror = () => resolve(null); // Resim yüklenemezse boş dön
        img.src = url;
    });
}

async function generateDailyPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const u = window.userData;

    const btn = document.getElementById('btn-gen-pdf');
    btn.disabled = true;
    btn.textContent = 'Resimler İşleniyor...';

    try {
        const q = query(collection(db, 'tasks'), where('projectId', '==', u.projectId));
        const snap = await getDocs(q);
        const tasks = snap.docs.map(d => ({id: d.id, ...d.data()}));

        // Başlıklar
        doc.setFontSize(22);
        doc.setTextColor(245, 158, 11);
        doc.text("SahaBOSS Fotoğraflı Saha Raporu", 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Proje: ${u.projectName || 'Genel Proje'} | Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);

        // Tablo Hazırlığı
        const tableBody = [];
        for (const [index, t] of tasks.entries()) {
            let imgBase64 = null;
            if (t.photos && t.photos.length > 0) {
                // Sadece ilk resmi al
                imgBase64 = await getBase64ImageFromURL(t.photos[0]);
            }

            tableBody.push({
                index: index + 1,
                title: t.title,
                assignee: t.assignedToName || '-',
                status: t.status.toUpperCase(),
                date: t.completedAt ? new Date(t.completedAt.toDate()).toLocaleDateString('tr-TR') : '-',
                img: imgBase64
            });
        }

        doc.autoTable({
            startY: 40,
            head: [['#', 'Görev', 'Sorumlu', 'Durum', 'Tarih', 'Foto Kanıt']],
            body: tableBody.map(row => [row.index, row.title, row.assignee, row.status, row.date, '']),
            columnStyles: {
                5: { cellWidth: 30, minCellHeight: 25 } // Fotoğraf sütunu ayarı
            },
            headStyles: { fillColor: [30, 41, 59] },
            didDrawCell: (data) => {
                // Eğer bu hücre Fotoğraf sütunuysa ve resim varsa çiz
                if (data.column.index === 5 && data.cell.section === 'body') {
                    const rowData = tableBody[data.row.index];
                    if (rowData.img) {
                        doc.addImage(rowData.img, 'JPEG', data.cell.x + 2, data.cell.y + 2, 26, 21);
                    }
                }
            }
        });

        const finalY = doc.lastAutoTable.finalY || 70;
        doc.setFontSize(8);
        doc.text(`Üretim Tarihi: ${new Date().toLocaleString('tr-TR')}`, 14, finalY + 10);

        doc.save(`SahaBOSS_FotoRapor_${Date.now()}.pdf`);

    } catch (err) {
        console.error(err);
        alert("Rapor hatası: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'PDF Oluştur';
    }
}
