import { db } from './firebase-app.js';
import { 
    collection, query, getDocs, where 
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

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
        if (modal) modal.classList.add('hidden');
    };
}

async function getBase64ImageFromURL(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.setAttribute('crossOrigin', 'anonymous');
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            const dataURL = canvas.toDataURL("image/jpeg", 0.5);
            resolve(dataURL);
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

async function generateDailyPDF() {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) { alert("PDF Kütüphanesi henüz yüklenmedi, lütfen sayfayı yenileyip tekrar deneyin."); return; }
    
    const doc = new jsPDF();
    const btn = document.getElementById('btn-gen-pdf');
    btn.disabled = true;
    btn.textContent = 'Veriler Hazırlanıyor...';

    try {
        // MÜDÜRÜM: ProjeID olmasa bile yöneticinin kendi atadığı tüm işleri getiriyoruz
        const q = query(collection(db, 'tasks'), where('assignedBy', '==', window.user.uid));
        const snap = await getDocs(q);
        const tasks = snap.docs.map(d => ({id: d.id, ...d.data()}));

        if (tasks.length === 0) {
            alert("Raporlanacak görev bulunamadı.");
            return;
        }

        // Tasarım Ayarları
        doc.setFontSize(22);
        doc.setTextColor(245, 158, 11);
        doc.text("SahaBOSS Fotoğraflı Rapor", 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Firma: ${window.userData?.name || 'SahaBOSS Ekibi'} | Üretim Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 30);

        const tableBody = [];
        for (const [index, t] of tasks.entries()) {
            let imgBase64 = null;
            // tasks.js'de "photoURLs" olarak kaydediyoruz, burada ona bakmalıyız
            const photos = t.photoURLs || t.photos || [];
            if (photos.length > 0) {
                imgBase64 = await getBase64ImageFromURL(photos[0]);
            }

            tableBody.push({
                index: index + 1,
                title: t.title,
                assignee: t.assignedToName || '-',
                status: (t.status || 'BELİRSİZ').toUpperCase(),
                date: t.completedAt ? new Date(t.completedAt.seconds * 1000).toLocaleDateString('tr-TR') : '-',
                img: imgBase64
            });
        }

        doc.autoTable({
            startY: 40,
            head: [['#', 'Görev Adı', 'Sorumlu', 'Durum', 'Tarih', 'Kanıt Foto']],
            body: tableBody.map(row => [row.index, row.title, row.assignee, row.status, row.date, '']),
            columnStyles: { 5: { cellWidth: 35, minCellHeight: 28 } },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 10 },
            styles: { fontSize: 9, valign: 'middle' },
            didDrawCell: (data) => {
                if (data.column.index === 5 && data.cell.section === 'body') {
                    const rowData = tableBody[data.row.index];
                    if (rowData && rowData.img) {
                        doc.addImage(rowData.img, 'JPEG', data.cell.x + 2, data.cell.y + 2, 31, 24);
                    }
                }
            }
        });

        doc.save(`SahaBOSS_Rapor_${Date.now()}.pdf`);

    } catch (err) {
        console.error("PDF Hatası:", err);
        alert("Rapor hatası: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'PDF Oluştur';
    }
}
