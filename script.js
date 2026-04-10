const UI = {
    cableDbInput: document.getElementById('cable-db'),
    spoolDbInput: document.getElementById('spool-db'),
    cableTypeSelect: document.getElementById('cable-type-select'),
    cableLengthsInput: document.getElementById('cable-lengths'),
    addBtn: document.getElementById('add-btn'),
    activePiecesContainer: document.getElementById('active-pieces'),
    calculateBtn: document.getElementById('calculate-btn'),
    clearBtn: document.getElementById('clear-btn'),
    resultsSection: document.getElementById('results-section'),
    toggleConfig: document.getElementById('toggle-config'),
    configPanel: document.getElementById('config-panel'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    spoolContainer: document.getElementById('spools-container'),
    maxSpoolSelect: document.getElementById('max-spool-select'),
    cableNameInput: document.getElementById('cable-name-input'),
    printBtn: document.getElementById('print-btn'),

    toggleStock: document.getElementById('toggle-stock'),
    stockPanel: document.getElementById('stock-panel'),
    stockTypeSelect: document.getElementById('stock-type-select'),
    stockNameInput: document.getElementById('stock-name-input'),
    stockLengthInput: document.getElementById('stock-length-input'),
    addStockBtn: document.getElementById('add-stock-btn'),
    activeStocksContainer: document.getElementById('active-stocks'),
    stockSummaryText: document.getElementById('stock-summary-text'),
    stockResultsContainer: document.getElementById('stock-results-container'),
    newProductionContainer: document.getElementById('new-production-container'),
    stockPiecesContainer: document.getElementById('stock-pieces-container'),
    commitStockBtn: document.getElementById('commit-stock-btn'),
    printStockBtn: document.getElementById('print-stock-btn'),
    stockUsageMode: document.getElementById('stock-usage-mode'),
    stockDescriptionText: document.getElementById('stock-description-text'),

    // Stats
    statTotalPieces: document.getElementById('stat-total-pieces'),
    statTotalLength: document.getElementById('stat-total-length'),
    statTotalWeight: document.getElementById('stat-total-weight')
};

// State
let cableTypes = {}; // { '3x2.5': { weightPerKm: 120 } }
let spoolTypes = []; // [ { name: 'M-1000', maxMeters: 1000, maxKg: 1500 } ]
let pieces = []; // [ { id: 1, type: '3x2.5', length: 250, weight: 30 } ]
let pieceIdCounter = 0;

let stockPieces = []; // [ { id: 1, type: '3x2.5', length: 120 } ]
let stockIdCounter = 0;
let currentStockMatches = [];


// Colors
const segmentColors = [
    '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899',
    '#8b5cf6', '#14b8a6', '#f43f5e', '#84cc16'
];

function init() {
    loadDatabase();

    UI.toggleConfig.addEventListener('click', () => {
        UI.configPanel.classList.toggle('hidden');
        UI.stockPanel.classList.add('hidden');
    });

    UI.toggleStock.addEventListener('click', () => {
        UI.stockPanel.classList.toggle('hidden');
        UI.configPanel.classList.add('hidden');
    });

    UI.saveSettingsBtn.addEventListener('click', () => {
        loadDatabase();
        UI.configPanel.classList.add('hidden');
        renderPieces(); // Update weights if changed
    });

    UI.addBtn.addEventListener('click', addPiece);
    UI.cableLengthsInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addPiece();
        }
    });

    UI.calculateBtn.addEventListener('click', calculateOptimization);
    UI.clearBtn.addEventListener('click', resetAll);
    UI.cableTypeSelect.addEventListener('change', updateMaxSpoolOptions);

    if (UI.printBtn) {
        UI.printBtn.addEventListener('click', () => {
            if (UI.resultsSection.classList.contains('hidden')) {
                if (stockPieces.length > 0 && pieces.length === 0) {
                    UI.printStockBtn.click();
                } else {
                    alert("Yazdırılacak sonuç bulunamadı. Lütfen önce 'Hesapla ve Optimize Et' butonuna basın veya yukarıdaki 'Stok Yazdır' butonunu kullanın.");
                }
            } else {
                window.print();
            }
        });
    }

    // Stock Events
    UI.addStockBtn.addEventListener('click', addStockPiece);
    UI.stockLengthInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addStockPiece();
        }
    });

    if (UI.commitStockBtn) {
        UI.commitStockBtn.addEventListener('click', commitStockUsage);
    }

    if (UI.printStockBtn) {
        UI.printStockBtn.addEventListener('click', () => {
            if (stockPieces.length === 0) {
                alert("Yazdırılacak stok bulunamadı.");
                return;
            }

            // Apply the print-stock-only class so CSS hides everything else
            document.body.classList.add('print-stock-only');

            // Force the details panel to open if it's inside one
            const detailsElement = UI.stockSummaryText.closest('details');
            if (detailsElement) detailsElement.setAttribute('open', '');

            // Give the browser layout engine a tiny fraction of a second to apply the CSS
            // before generating the print snapshot. This works perfectly in Chrome/Edge web browsers.
            requestAnimationFrame(() => {
                setTimeout(() => {
                    window.print();

                    // Remove the class after the print dialog is closed or cancelled
                    setTimeout(() => {
                        document.body.classList.remove('print-stock-only');
                    }, 500);
                }, 150);
            });
        });
    }
}

function loadDatabase() {
    // Parse Cable DB
    cableTypes = {};
    const cableLines = UI.cableDbInput.value.split('\n');
    UI.cableTypeSelect.innerHTML = '';
    UI.stockTypeSelect.innerHTML = '';

    cableLines.forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
            const name = parts[0].trim();
            const kgPerKm = parseFloat(parts[1].trim());
            if (name && !isNaN(kgPerKm)) {
                cableTypes[name] = { weightPerKm: kgPerKm };
                // Populate main select
                const opt1 = document.createElement('option');
                opt1.value = name;
                opt1.textContent = `${name} (${kgPerKm} kg/km)`;
                UI.cableTypeSelect.appendChild(opt1);

                // Populate stock select
                const opt2 = document.createElement('option');
                opt2.value = name;
                opt2.textContent = `${name} (${kgPerKm} kg/km)`;
                UI.stockTypeSelect.appendChild(opt2);
            }
        }
    });

    // Parse Spool DB
    spoolTypes = [];
    const spoolLines = UI.spoolDbInput.value.split('\n');

    spoolLines.forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
            const name = parts[0].trim();
            const maxK = parseFloat(parts[1].trim());
            if (name && !isNaN(maxK)) {
                spoolTypes.push({ name, maxMeters: 500000, maxKg: maxK });
            }
        }
    });

    // Sort descending by maxKg algorithm assumes it's sorted
    spoolTypes.sort((a, b) => b.maxKg - a.maxKg);

    updateMaxSpoolOptions();
}

function updateMaxSpoolOptions() {
    if (spoolTypes.length === 0) return;

    let selectedCable = UI.cableTypeSelect.value;
    if (!selectedCable || !cableTypes[selectedCable]) {
        return;
    }

    // Field standard is usually 1000m. Find the ideal spool for 1000m of this cable.
    const targetWeight = getWeight(selectedCable, 1000);

    // spoolTypes is sorted descending by maxKg. Find the smallest spool that can hold targetWeight.
    let idealIndex = 0;
    for (let i = spoolTypes.length - 1; i >= 0; i--) {
        if (spoolTypes[i].maxKg >= targetWeight) {
            idealIndex = i;
            break;
        }
    }

    // User wants 2 sizes above and 2 sizes below this ideal spool
    const startIndex = Math.max(0, idealIndex - 2);
    const endIndex = Math.min(spoolTypes.length - 1, idealIndex + 2);

    UI.maxSpoolSelect.innerHTML = '<option value="ALL">Tümü (Sınır Yok)</option>';

    for (let i = startIndex; i <= endIndex; i++) {
        const s = spoolTypes[i];
        const opt = document.createElement('option');
        opt.value = s.name;

        let labelAddon = "";
        if (i === idealIndex) {
            labelAddon = " ⭐ (1000m için İdeal)";
        }

        opt.textContent = `${s.name} (Max: ${s.maxKg}kg)${labelAddon}`;

        // Let's auto-select the ideal one to save clicks
        if (i === idealIndex) {
            opt.selected = true;
        }
        UI.maxSpoolSelect.appendChild(opt);
    }
}

function getWeight(cableType, meters) {
    if (!cableTypes[cableType]) return 0;
    return (cableTypes[cableType].weightPerKm / 1000) * meters;
}

function addPiece() {
    const val = UI.cableLengthsInput.value.trim();
    const type = UI.cableTypeSelect.value;
    const nameVal = UI.cableNameInput.value.trim();

    if (!val || !type) return;

    const num = parseFloat(val);
    if (num > 0 && !isNaN(num)) {
        pieces.push({
            id: pieceIdCounter++,
            type: type,
            length: num,
            weight: getWeight(type, num),
            name: nameVal || `Parça #${pieceIdCounter}` // Fallback generic name if empty
        });
        renderPieces();
        UI.cableLengthsInput.value = '';
        UI.cableNameInput.value = '';
        UI.cableLengthsInput.focus();
    }
}

function removePiece(id) {
    pieces = pieces.filter(p => p.id !== id);
    renderPieces();
    UI.resultsSection.classList.add('hidden');
}

function renderPieces() {
    UI.activePiecesContainer.innerHTML = '';

    // Re-calculate weights just in case DB changed
    pieces.forEach(p => p.weight = getWeight(p.type, p.length));

    pieces.forEach(p => {
        const typeBadge = `<span style="opacity:0.7; font-size: 0.8em; margin-right: 4px;">[${p.type}]</span>`;
        const weightBadge = `<span style="color: #fbbf24; font-size: 0.8em; margin-left: 4px;">(${p.weight.toFixed(1)}kg)</span>`;
        const nameBadge = p.name ? `<strong style="color: #fff; margin-right: 4px;">Parça Adı: ${p.name}</strong>` : '';

        UI.activePiecesContainer.innerHTML += `
            <div class="piece-chip">
                ${nameBadge} <span>(Tip: ${p.type})</span> <span>${p.length}m</span> ${weightBadge}
                <span class="remove" onclick="removePiece(${p.id})">✕</span>
            </div>
        `;
    });
}

function addStockPiece() {
    const val = UI.stockLengthInput.value.trim();
    const type = UI.stockTypeSelect.value;
    const nameVal = UI.stockNameInput.value.trim();

    if (!val || !type) return;

    // Check for duplicate names (excluding empty names which will get auto-generated names)
    if (nameVal !== '') {
        const isDuplicate = stockPieces.some(p => p.name && p.name.toLowerCase() === nameVal.toLowerCase());
        if (isDuplicate) {
            alert("Bu isimde bir stok zaten mevcut. Lütfen farklı bir isim girin.");
            return;
        }
    }

    const num = parseFloat(val);
    if (num > 0 && !isNaN(num)) {
        stockPieces.push({
            id: stockIdCounter++,
            type: type,
            length: num,
            name: nameVal || `Stok #${stockIdCounter}`
        });
        renderStockPieces();
        UI.stockLengthInput.value = '';
        UI.stockNameInput.value = '';
        UI.stockLengthInput.focus();
    }
}

function removeStockPiece(id) {
    stockPieces = stockPieces.filter(p => p.id !== id);
    renderStockPieces();
    UI.resultsSection.classList.add('hidden');
}

function renderStockPieces() {
    UI.activeStocksContainer.innerHTML = '';

    UI.stockSummaryText.innerHTML = `<span>📋</span> Stoktaki Parçalar`;

    stockPieces.forEach(p => {
        const typeBadge = `<span style="opacity:0.7; font-size: 0.8em; margin-right: 4px;">[${p.type}]</span>`;
        const nameBadge = p.name ? `<strong style="color: #fff; margin-right: 4px;">Stok Adı: ${p.name}</strong>` : '';

        UI.activeStocksContainer.innerHTML += `
            <div class="piece-chip" style="background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3);">
                ${nameBadge} <span>(Tip: ${p.type})</span> <span>${p.length}m</span>
                <span class="remove" onclick="removeStockPiece(${p.id})">✕</span>
            </div>
        `;
    });
}

function commitStockUsage() {
    if (!currentStockMatches || currentStockMatches.length === 0) return;

    // Remove used stock from global stockPieces
    const usedStockIds = new Set(currentStockMatches.map(m => m.stockUsed.id));
    stockPieces = stockPieces.filter(s => !usedStockIds.has(s.id));

    // Automatically put the leftover waste back into stock as a new piece
    currentStockMatches.forEach(m => {
        if (m.wasteMeters > 0) {
            let baseName = m.stockUsed.name || `Stok #${m.stockUsed.id}`;
            let newName = "";

            // Check if the name already has a (Kalan-X) suffix
            const kalanMatch = baseName.match(/(.*)\s\(Kalan-(\d+)\)$/);

            if (kalanMatch) {
                // If it already has (Kalan-X), strip it, increment X, and re-attach
                const originalBase = kalanMatch[1];
                const currentCount = parseInt(kalanMatch[2], 10);
                newName = `${originalBase} (Kalan-${currentCount + 1})`;
            } else {
                // First time this stock is leaving waste
                if (baseName.endsWith(" (Kalan)")) {
                    // Handle legacy "Kalan" from before this update for robustness
                    baseName = baseName.replace(" (Kalan)", "");
                }
                newName = `${baseName} (Kalan-1)`;
            }

            stockPieces.push({
                id: stockIdCounter++,
                type: m.stockUsed.type,
                length: Number(m.wasteMeters.toFixed(2)), // Keep it clean
                name: newName
            });
        }
    });

    // Remove fulfilled order pieces from global pieces
    const fulfilledPieceIds = new Set();
    currentStockMatches.forEach(m => {
        m.pieces.forEach(p => fulfilledPieceIds.add(p.id));
    });
    pieces = pieces.filter(p => !fulfilledPieceIds.has(p.id));

    currentStockMatches = []; // Clear current matches

    // Refresh UI
    renderStockPieces();
    renderPieces();

    // Rerun calculations on remainder safely
    calculateOptimization();

    alert("Onaylanan parçalar stoktan başarıyla düşüldü!");
}

function findBestStockMatch(stockLength, piecesArray) {
    let bestSubset = [];
    let bestSum = 0;
    const target = Math.round(stockLength * 1000);

    // Sort descending for faster pruning
    let items = piecesArray.map(p => ({ pRef: p, intLen: Math.round(p.length * 1000) }));
    items.sort((a, b) => b.intLen - a.intLen);

    let iterations = 0;
    const MAX_ITER = 30000;

    function backtrack(index, currentSubset, currentSum) {
        if (iterations > MAX_ITER) return;
        iterations++;

        if (currentSum > bestSum) {
            bestSum = currentSum;
            bestSubset = [...currentSubset];
        }

        if (bestSum === target) return;

        let remaining = 0;
        for (let j = index; j < items.length; j++) remaining += items[j].intLen;
        if (currentSum + remaining <= bestSum) return;

        for (let i = index; i < items.length; i++) {
            if (currentSum + items[i].intLen <= target) {
                currentSubset.push(items[i]);
                backtrack(i + 1, currentSubset, currentSum + items[i].intLen);
                currentSubset.pop();
                if (bestSum === target) return;
            }
        }
    }

    backtrack(0, [], 0);

    return {
        bestSumMeters: bestSum / 1000,
        packedPieces: bestSubset.map(item => item.pRef)
    };
}

function calculateOptimization() {
    if (pieces.length === 0) {
        alert("Lütfen önce kablo parça boylarını girin.");
        return;
    }
    if (spoolTypes.length === 0) {
        alert("Geçerli makara türü bulunamadı. Ayarları kontrol edin.");
        return;
    }

    // We group pieces by cable type, because you can't spool different cables together
    const groups = {};
    currentStockMatches = [];

    // Copy stock to a temporary array so we can "consume" it during calculation without deleting the real stock yet
    // Real stock should probably only be deducted permanently on a "Save" action, but for now we'll just consume it for the calc view
    let availableStock = JSON.parse(JSON.stringify(stockPieces)); // Deep copy

    // Pre-process pieces to check against stock
    let unpackedPieces = [...pieces].sort((a, b) => b.length - a.length);
    let remainingPieces = [];

    // Sort available stock ascending by length to use smallest suitable stock first
    availableStock.sort((a, b) => a.length - b.length);

    const stockMode = UI.stockUsageMode.value; // 'priority', 'force', 'none'

    if (stockMode !== 'none') {
        availableStock.forEach(stock => {
            const typeMatchedPieces = unpackedPieces.filter(p => p.type === stock.type);

            if (typeMatchedPieces.length > 0) {
                const matchResult = findBestStockMatch(stock.length, typeMatchedPieces);

                if (matchResult.packedPieces.length > 0) {
                    const wasteM = stock.length - matchResult.bestSumMeters;
                    const wastePct = (wasteM / stock.length) * 100;

                    let isAcceptable = false;
                    if (stockMode === 'priority' && wastePct <= 5.0 && wastePct >= 0) {
                        isAcceptable = true;
                    } else if (stockMode === 'force' && wastePct >= 0) {
                        isAcceptable = true; // Any waste is fine, we just force stock usage
                    }

                    if (isAcceptable) {
                        // Match successful!
                        currentStockMatches.push({
                            pieces: matchResult.packedPieces,
                            stockUsed: stock,
                            wasteMeters: wasteM,
                            wastePct: wastePct
                        });

                        // Remove packed pieces from unpackedPieces
                        const packedIds = new Set(matchResult.packedPieces.map(p => p.id));
                        unpackedPieces = unpackedPieces.filter(p => !packedIds.has(p.id));
                    }
                }
            }
        });
    }

    remainingPieces = unpackedPieces;

    // We only bin-pack the remaining pieces that couldn't be satisfied by stock
    remainingPieces.forEach(p => {
        if (!groups[p.type]) groups[p.type] = [];
        groups[p.type].push(p);
    });

    let allBins = [];

    // Process each cable type independently
    for (const [cType, gPieces] of Object.entries(groups)) {
        // Sort descending by length
        const sortedPieces = [...gPieces].sort((a, b) => b.length - a.length);

        let typeBins = [];

        // Filter allowed spools based on user selection
        const selectedMaxSpool = UI.maxSpoolSelect.value;
        let allowedSpools = spoolTypes;

        if (selectedMaxSpool !== "ALL") {
            // Find the chosen spool
            const chosenSpool = spoolTypes.find(s => s.name === selectedMaxSpool);
            if (chosenSpool) {
                // Keep only spools that are smaller or equal to the chosen spool
                allowedSpools = spoolTypes.filter(s => s.maxMeters <= chosenSpool.maxMeters && s.maxKg <= chosenSpool.maxKg);
            }
        }

        if (allowedSpools.length === 0) {
            allowedSpools = spoolTypes; // Fallback just in case
        }

        // Find absolute largest allowed spool to start packing
        const maxSpoolM = allowedSpools[0].maxMeters;
        const maxSpoolK = allowedSpools[0].maxKg;

        for (let piece of sortedPieces) {
            // Check if piece is oversized in length or weight for the biggest allowed spool
            if (piece.length > maxSpoolM || piece.weight > maxSpoolK) {
                typeBins.push({
                    cableType: cType,
                    pieces: [piece],
                    sumM: piece.length,
                    sumK: piece.weight,
                    isOversized: true
                });
                continue;
            }

            // Try to find a bin that can hold this piece (First Fit)
            let placed = false;
            for (let bin of typeBins) {
                if (bin.isOversized) continue;

                // We check against the MAX spool globally first. 
                // Later we will shrink the spool to the smallest suitable one.
                if (bin.sumM + piece.length <= maxSpoolM && bin.sumK + piece.weight <= maxSpoolK) {
                    bin.pieces.push(piece);
                    bin.sumM += piece.length;
                    bin.sumK += piece.weight;
                    placed = true;
                    break;
                }
            }

            if (!placed) {
                typeBins.push({
                    cableType: cType,
                    pieces: [piece],
                    sumM: piece.length,
                    sumK: piece.weight,
                    isOversized: false
                });
            }
        }

        // Optimize spool selection for each bin
        for (let bin of typeBins) {
            if (bin.isOversized) {
                bin.spoolName = "ÖZEL";
                bin.spoolCapacityM = bin.sumM;
                bin.spoolCapacityK = bin.sumK;
            } else {
                // Find all allowed spools that can hold BOTH length AND weight
                const suitable = allowedSpools.filter(s => s.maxMeters >= bin.sumM && s.maxKg >= bin.sumK);
                if (suitable.length > 0) {
                    // Pick the smallest possible spool based on weight capacity
                    suitable.sort((a, b) => a.maxKg - b.maxKg);
                    const best = suitable[0];
                    bin.spoolName = best.name;
                    bin.spoolCapacityM = best.maxMeters;
                    bin.spoolCapacityK = best.maxKg;
                } else {
                    // Fallback to biggest allowed
                    bin.spoolName = allowedSpools[0].name;
                    bin.spoolCapacityM = allowedSpools[0].maxMeters;
                    bin.spoolCapacityK = allowedSpools[0].maxKg;
                }
            }
            allBins.push(bin);
        }
    }

    renderResults(allBins, currentStockMatches);
}

function renderResults(bins, stockMatches = []) {
    // We only count pieces that went to NEW spools in the main stats
    let totalPieces = 0;
    let totalLengthReq = 0;
    let totalWeightReq = 0;

    let containerHtml = '';

    bins.forEach((bin, idx) => {
        totalPieces += bin.pieces.length;
        totalLengthReq += bin.sumM;
        totalWeightReq += bin.sumK;

        // Calculate constraints
        let constrType = "";
        let fillRatioM = (bin.sumM / bin.spoolCapacityM) * 100;
        let fillRatioK = (bin.sumK / bin.spoolCapacityK) * 100;

        if (fillRatioK >= 90 && fillRatioK > fillRatioM) {
            constrType = "<span style='color: #ef4444; font-size: 0.8rem;'>Ağırlık Sınırında!</span>";
        }

        let cardHtml = `<div class="spool-card" style="animation-delay: ${idx * 0.1}s">`;

        cardHtml += `
            <div class="spool-header">
                <div class="spool-title">
                    <div class="spool-icon" style="background: ${segmentColors[idx % segmentColors.length]}40">🧵</div>
                    <div>
                        Makara #${idx + 1} <span style="font-size: 0.9rem; color: #94a3b8; font-weight: normal;">(${bin.cableType})</span>
                        ${constrType ? `<br>${constrType}` : ''}
                    </div>
                </div>
                <div class="spool-tags">
                    <span class="tag tag-size">${bin.spoolName}</span>
                    <span class="tag" style="background: rgba(139, 92, 246, 0.2); color: #c084fc;">${bin.sumK.toFixed(1)} / ${bin.spoolCapacityK.toFixed(0)} kg</span>
                    <span class="tag" style="background: rgba(14, 165, 233, 0.2); color: #38bdf8;">Sarılan: ${bin.sumM.toFixed(1)} m</span>
                </div>
            </div>
        `;

        // Length Details
        cardHtml += `<div style="font-size:0.8rem; margin-bottom: 4px; color: #cbd5e1;">Makaradaki Parçalar (Metre):</div>`;
        cardHtml += '<div class="progress-bar-container" style="height: 24px;">';
        bin.pieces.forEach((p, pIdx) => {
            let color = segmentColors[pIdx % segmentColors.length];
            let percent = (p.length / bin.sumM) * 100;
            let displayTitle = p.name ? `[${p.name}] ` : '';
            cardHtml += `<div class="progress-segment" style="width: 0%; background: ${color}" data-target-width="${percent}%" title="${displayTitle}${p.length}m, ${p.weight.toFixed(1)}kg">${displayTitle}${p.length}m</div>`;
        });
        cardHtml += '</div>';

        // Weight progress bar
        cardHtml += `<div style="font-size:0.8rem; margin-bottom: 4px; color: #cbd5e1; margin-top: 1rem;">Ağırlık (Kg) Doluluğu:</div>`;
        cardHtml += '<div class="progress-bar-container" style="height: 16px; margin-bottom: 1rem;">';
        bin.pieces.forEach((p, pIdx) => {
            let color = segmentColors[pIdx % segmentColors.length];
            let percent = (p.weight / bin.spoolCapacityK) * 100;
            let displayTitle = p.name ? `[${p.name}] ` : '';
            cardHtml += `<div class="progress-segment" style="width: 0%; background: ${color}" data-target-width="${percent}%" title="${displayTitle}${p.weight.toFixed(1)}kg"></div>`;
        });
        cardHtml += '</div>';

        cardHtml += '</div>';
        containerHtml += cardHtml;
    });

    UI.statTotalPieces.innerText = totalPieces;
    UI.statTotalLength.innerText = totalLengthReq.toFixed(1);
    UI.statTotalWeight.innerText = totalWeightReq.toFixed(1);

    UI.spoolContainer.innerHTML = containerHtml;

    // Hide or show the whole new production section
    if (bins.length === 0) {
        UI.newProductionContainer.classList.add('hidden');
    } else {
        UI.newProductionContainer.classList.remove('hidden');
    }

    // Render Stock Matches
    if (stockMatches.length > 0) {
        UI.stockResultsContainer.classList.remove('hidden');
        let stockHtml = '';
        stockMatches.forEach((match, idx) => {
            let tagsHtml = match.pieces.map(p => {
                let pName = p.name ? `[${p.name}] ` : '';
                return `<span class="tag" style="background: rgba(16, 185, 129, 0.2); color: #10b981;">Tasarruf: ${pName}${p.length}m</span>`
            }).join(' ');

            let stockUsedName = match.stockUsed.name ? `[${match.stockUsed.name}] ` : '';
            stockHtml += `
                <div class="spool-card" style="animation-delay: ${idx * 0.1}s; border-left: 4px solid #10b981;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span style="font-weight: 600; color: #10b981;">✅ Stok Parçası Kullanıldı ${stockUsedName}(${match.stockUsed.type})</span>
                        <div style="display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;">${tagsHtml}</div>
                    </div>
                    <div style="font-size: 0.85rem; color: #cbd5e1; display:flex; justify-content: space-between;">
                        <span>Kullanılan Stok Boyu: ${match.stockUsed.length}m</span>
                        <span style="color: ${match.wasteMeters === 0 ? '#10b981' : '#f59e0b'};">Fire: ${match.wasteMeters.toFixed(1)}m (${match.wastePct.toFixed(1)}%)</span>
                    </div>
                </div>
            `;
        });
        UI.stockPiecesContainer.innerHTML = stockHtml;

        // Optionally update header to be explicit since we have mixed results
        document.getElementById('optimization-header').innerHTML = '<span>🏭</span> Sipariş Geçilecek Ek Kablo (Yeni Üretim)';
    } else {
        UI.stockResultsContainer.classList.add('hidden');
        document.getElementById('optimization-header').innerHTML = '<span>🏭</span> Sipariş Geçilecek Kablo (Yeni Üretim)';
    }

    UI.resultsSection.classList.remove('hidden');
    UI.resultsSection.scrollIntoView({ behavior: 'smooth' });

    setTimeout(() => {
        document.querySelectorAll('.spool-card').forEach(card => {
            card.querySelectorAll('.progress-segment').forEach(seg => {
                seg.style.width = seg.getAttribute('data-target-width');
            });
        });
    }, 100);
}

function resetAll() {
    pieces = [];
    renderPieces();
    UI.resultsSection.classList.add('hidden');
    UI.cableLengthsInput.value = '';
    UI.cableLengthsInput.focus();
}

window.onload = init;
