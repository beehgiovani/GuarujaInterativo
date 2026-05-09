// Gestor de Detalhes (tooltip_handler.js) - Versão Orquestrador
// Este arquivo atua como uma ponte (proxy) para os módulos especializados.
// NÃO ADICIONE LÓGICA DE NEGÓCIO AQUI. Use LotTooltipHandler ou UnitTooltipHandler.

async function showLotTooltip(lote, x, y, isRefresh = false, targetTab = null, targetScroll = null) {
    if (window.LotTooltipHandler) {
        return window.LotTooltipHandler.show(lote, x, y, isRefresh, targetTab, targetScroll);
    }
    console.warn("⚠️ LotTooltipHandler não carregado.");
}

async function showUnitTooltip(unit, parentLote, x, y) {
    if (window.UnitTooltipHandler) {
        return window.UnitTooltipHandler.show(unit, parentLote, x, y);
    }
    console.warn("⚠️ UnitTooltipHandler não carregado.");
}

function closeLotTooltip() {
    if (window.currentTooltip) {
        window.tooltipScrollState = {};
        if (window.currentTooltip.backdrop) window.currentTooltip.backdrop.remove();
        window.currentTooltip.remove();
        window.currentTooltip = null;
    }
    const allBackdrops = document.querySelectorAll('.sidebar-backdrop:not(#sidebarBackdrop)');
    allBackdrops.forEach(backdrop => backdrop.remove());
    document.body.style.overflow = '';
}

window.unlockUnitInfo = async function(inscricao) {
    if (!window.Monetization) return;
    const loteInscricao = window.currentLoteForUnit?.inscricao;
    if (!loteInscricao) return;

    await window.Monetization.promptUnlockLote(loteInscricao, inscricao, 5);
    
    setTimeout(() => {
        if (window.Monetization.isUnlocked(inscricao, loteInscricao)) {
            const unit = window.currentLoteForUnit.unidades.find(u => u.inscricao === inscricao);
            if (unit) window.showUnitTooltip(unit, window.currentLoteForUnit, 0, 0);
        }
    }, 1500);
};

window.copyToClipboard = function (text) {
    navigator.clipboard.writeText(text).then(() => {
        window.Toast?.success("Copiado para a área de transferência!");
    });
};

window.showMediaGallery = function(images, title) {
    if (window.ImageViewer) {
        window.ImageViewer.show(images, 0, title);
    } else if (window.openImageModal) {
        window.openImageModal(0, images);
    }
};

// Exportações Globais para Compatibilidade Retroativa
window.showLotTooltip = showLotTooltip;
window.showUnitTooltip = showUnitTooltip;
window.closeLotTooltip = closeLotTooltip;
window.switchTooltipTab = (btn, id) => {
    const tooltip = btn?.closest?.('.lot-tooltip, .unit-tooltip, .proprietario-tooltip, .custom-modal');
    if (!tooltip) return;

    tooltip.querySelectorAll('.tooltip-tab').forEach(tab => {
        tab.classList.remove('active');
        tab.style.color = '#64748b';
        tab.style.borderBottomColor = 'transparent';
    });

    btn.classList.add('active');
    btn.style.color = '#764ba2';
    btn.style.borderBottomColor = '#764ba2';

    tooltip.querySelectorAll('.tab-content-pane').forEach(pane => {
        pane.classList.remove('active');
        pane.style.display = 'none';
    });

    const target = tooltip.querySelector(`#${CSS.escape(id)}`);
    if (target) {
        target.classList.add('active');
        target.style.display = '';
    }
};

console.log("✅ Orquestrador TooltipHandler pronto.");
