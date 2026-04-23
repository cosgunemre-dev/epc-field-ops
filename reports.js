import { db, auth } from './firebase-app.js';
import { collection, query, where, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export function initReports() {
    console.log("SahaBOSS Raporlama Modülü Aktif.");
    
    const btnGen = document.getElementById('btn-gen-pdf');
    if (btnGen) {
        btnGen.onclick = async () => {
            const startDate = document.getElementById('report-start-date').value;
            const endDate = document.getElementById('report-end-date').value;

            if (!startDate || !endDate) return alert("Lütfen tarih aralığını seçin!");

            btnGen.disabled = true;
            btnGen.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Hazırlanıyor...";

            try {
                // Tarihleri Firebase formatına çevir (Günün başı ve sonu)
                const startTS = Timestamp.fromDate(new Date(startDate + "T00:00:00"));
                const endTS = Timestamp.fromDate(new Date(endDate + "T23:59:59"));

                const q = query(
                    collection(db, 'tasks'), 
                    where('assignedBy', '==', auth.currentUser.uid),
                    where('createdAt', '>=', startTS),
                    where('createdAt', '<=', endTS)
                );

                const snap = await getDocs(q);
                if (snap.empty) {
                    alert("Seçili tarih aralığında bir görev kaydı bulunamadı!");
                    return;
                }

                generatePDF(snap.docs, startDate, endDate);

            } catch (err) {
                console.error("Rapor Hatası:", err);
                alert("Rapor oluşturulamadı: " + err.message);
            } finally {
                btnGen.disabled = false;
                btnGen.innerHTML = "PDF RAPORU OLUŞTUR";
            }
        };
    }
}

async function generatePDF(docs, start, end) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // LOGO VE BAŞLIK
    doc.setFontSize(22);
    doc.setTextColor(245, 158, 11); // SahaBOSS Turuncusu
    doc.text("SahaBOSS SAHA OPERASYON RAPORU", 105, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Rapor Aralığı: ${start} - ${end}`, 105, 30, { align: "center" });
    doc.text(`Düzenleyen: ${auth.currentUser.email}`, 105, 38, { align: "center" });

    doc.setDrawColor(200);
    doc.line(20, 45, 190, 45);

    // TABLO VERİSİ HAZIRLA
    const tableData = [];
    docs.forEach((d, index) => {
        const t = d.data();
        const startStr = t.createdAt ? new Date(t.createdAt.seconds * 1000).toLocaleDateString('tr-TR') : '-';
        const endStr = t.completedAt ? new Date(t.completedAt.seconds * 1000).toLocaleDateString('tr-TR') : 'Devam Ediyor';
        const stText = t.status === 'done' ? 'TAMAMLANDI' : (t.status === 'submitted' ? 'ONAY BEKLİYOR' : 'BEKLEMEDE');

        tableData.push([
            index + 1,
            t.title,
            startStr,
            endStr,
            stText
        ]);
    });

    // TABLE OLUŞTUR
    doc.autoTable({
        startY: 50,
        head: [['#', 'GÖREV ADI', 'AÇILIŞ', 'KAPANIŞ', 'DURUM']],
        body: tableData,
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 9, font: "helvetica" }
    });

    doc.save(`SahaBOSS_Rapor_${start}_${end}.pdf`);
}
