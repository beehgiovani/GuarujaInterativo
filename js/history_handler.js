/**
 * HISTORY_HANDLER.JS
 * Manages the "Recently Viewed" lots history using localStorage.
 */

window.HistoryHandler = (function() {
    const STORAGE_KEY = 'guarugeo_history_v1';
    const MAX_ITEMS = 5;
    let history = [];

    function init() {
        loadHistory();
        renderHistoryUI();
        
        // Add style for the history panel
        const style = document.createElement('style');
        style.innerHTML = `
            #history-panel {
                position: fixed;
                bottom: 20px;
                right: 80px;
                width: 260px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                z-index: 999; /* Below tooltip (10000) but above map */
                display: flex;
                flex-direction: column;
                overflow: hidden;
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                border: 1px solid #e2e8f0;
                font-family: 'Inter', 'Roboto', sans-serif;
            }
            #history-panel.collapsed {
                transform: translateY(calc(100% - 44px));
            }
            .history-header {
                padding: 12px 16px;
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                user-select: none;
            }
            .history-title {
                font-size: 13px;
                font-weight: 700;
                color: #475569;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .history-toggle {
                color: #94a3b8;
                transition: transform 0.3s;
            }
            #history-panel.collapsed .history-toggle {
                transform: rotate(180deg);
            }
            .history-list {
                max-height: 250px;
                overflow-y: auto;
                background: white;
            }
            .history-item {
                padding: 10px 16px;
                border-bottom: 1px solid #f1f5f9;
                cursor: pointer;
                transition: background 0.2s;
                display: flex;
                gap: 10px;
                align-items: center;
            }
            .history-item:hover {
                background: #f8fafc;
            }
            .history-item:last-child {
                border-bottom: none;
            }
            .history-icon {
                width: 32px;
                height: 32px;
                background: #eff6ff;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #3b82f6;
                font-size: 14px;
                flex-shrink: 0;
            }
            .history-info {
                flex: 1;
                min-width: 0;
            }
            .history-name {
                font-size: 12px;
                font-weight: 600;
                color: #1e293b;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .history-sub {
                font-size: 10px;
                color: #64748b;
                margin-top: 2px;
            }
            .history-empty {
                padding: 24px;
                text-align: center;
                color: #94a3b8;
                font-size: 12px;
            }
        `;
        document.head.appendChild(style);
    }

    function loadHistory() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                history = JSON.parse(raw);
            }
        } catch (e) {
            console.error('Failed to load history', e);
            history = [];
        }
    }

    function saveHistory() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (e) {
            console.error('Failed to save history', e);
        }
    }

    function add(lote, unit = null) {
        if (!lote || !lote.inscricao) return;

        const isUnit = !!unit;
        const targetInscricao = isUnit ? unit.inscricao : lote.inscricao;

        // Determine Address
        let addr = lote.logradouro || lote.endereco || '';
        let num = lote.numero ? String(lote.numero).replace(/^0+/, '') : '';
        let bai = lote.bairro || '';
        let fullAddress = addr ? (addr + (num ? ', ' + num : '')) : '';
        if (bai) fullAddress += (fullAddress ? ' - ' : '') + bai;
        if (!fullAddress) fullAddress = 'Endereço não informado';

        // Determine Name
        let buildingName = lote.building_name || lote.nome_edificio || '';
        let rawOwnerName = (unit ? unit.nome_proprietario : lote.nome_proprietario) || '';
        if (rawOwnerName === 'null' || rawOwnerName.trim() === '') rawOwnerName = '';

        const isUnlocked = window.Monetization && (window.Monetization.isEliteOrAbove() || (isUnit ? window.Monetization.isUnlocked(unit.inscricao, lote.inscricao) : window.Monetization.isUnlocked(lote.inscricao)));
        let ownerName = isUnlocked ? rawOwnerName : window.maskName(rawOwnerName);

        let displayName = buildingName;
        let subName = '';

        if (isUnit) {
            const unitSuffix = unit.inscricao.slice(-3);
            if (buildingName) {
                subName = `Un. ${unitSuffix}${ownerName ? ' • ' + ownerName : ''}`;
            } else {
                displayName = ownerName || `Unidade ${unitSuffix}`;
                subName = `Lote: ${lote.inscricao}`;
            }
        } else {
            if (!displayName) {
                displayName = ownerName || 'Lote sem Nome';
            }
            subName = lote.inscricao;
        }

        // Remove existing if present (to move to top)
        history = history.filter(item => item.id !== targetInscricao);

        // Add to top
        history.unshift({
            id: targetInscricao,
            loteInscricao: lote.inscricao,
            unitInscricao: isUnit ? unit.inscricao : null,
            name: displayName,
            subName: subName,
            address: fullAddress,
            timestamp: Date.now(),
            coordinates: {
                lat: lote._lat || lote.minx,
                lng: lote._lng || lote.miny
            }
        });

        // Limit
        if (history.length > MAX_ITEMS) {
            history.length = MAX_ITEMS;
        }

        saveHistory();
        renderHistoryUI();
    }

    function renderHistoryUI() {
        let panel = document.getElementById('history-panel');
        
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'history-panel';
            // Start collapsed by default? Or open? Let's start collapsed to be unobtrusive
            panel.classList.add('collapsed'); 
            document.body.appendChild(panel);
        }

        const isEmpty = history.length === 0;

        panel.innerHTML = `
            <div class="history-header" onclick="document.getElementById('history-panel').classList.toggle('collapsed')">
                <div class="history-title">
                    <i class="fas fa-history" style="color: #64748b;"></i>
                    Vistos Recentemente <span style="background: #e2e8f0; padding: 2px 6px; border-radius: 10px; font-size: 10px;">${history.length}</span>
                </div>
                <i class="fas fa-chevron-down history-toggle"></i>
            </div>
            <div class="history-list">
                ${isEmpty ? '<div class="history-empty">Nenhum histórico recente</div>' : history.map(item => `
                    <div class="history-item" onclick="window.HistoryHandler.navigate('${item.loteInscricao}', ${item.unitInscricao ? `'${item.unitInscricao}'` : 'null'})">
                        <div class="history-icon"><i class="fas fa-${item.unitInscricao ? 'door-open' : 'building'}"></i></div>
                        <div class="history-info">
                            <div class="history-name">${item.name}</div>
                            <div class="history-sub" style="color: #3b82f6; font-weight: 700; font-size: 9px;">${item.subName}</div>
                            <div class="history-sub">${item.address}</div>
                            <div class="history-sub" style="font-size: 9px; opacity: 0.7;">${new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        </div>
                        <i class="fas fa-arrow-right" style="font-size: 10px; color: #cbd5e1;"></i>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function navigate(loteInscricao, unitInscricao = null) {
        if (window.navigateToInscricao) {
            window.navigateToInscricao(loteInscricao, unitInscricao);
        } else {
            console.error('window.navigateToInscricao not found');
        }
    }

    return {
        init,
        add,
        navigate
    };
})();

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure other scripts loaded
    setTimeout(() => window.HistoryHandler.init(), 1000);
});
