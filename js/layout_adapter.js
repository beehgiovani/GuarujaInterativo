/**
 * LAYOUT ADAPTER (V1.0.0)
 * Estabilizador Dinâmico de Escala e Acessibilidade.
 * Garante que o layout não "estoure" com fontes grandes do sistema.
 */

window.LayoutAdapter = {
    baseFontSize: 16,
    currentScale: 1,

    init: function() {
        console.log("📏 [LayoutAdapter] Initializing stabilization...");
        this.stabilize();
        
        // Watch for window resizing or orientation changes
        window.addEventListener('resize', () => this.stabilize());
        
        // Watch for font-settings changes (probabilistically)
        document.fonts.ready.then(() => this.stabilize());
    },

    stabilize: function() {
        const root = document.documentElement;
        
        // 1. Detect Real Pixels per REM
        // We create a temporary element to measure the browser's default font size
        const probe = document.createElement('div');
        probe.style.cssText = 'height: 1rem; width: 1rem; position: absolute; visibility: hidden;';
        document.body.appendChild(probe);
        const actualPx = probe.getBoundingClientRect().height;
        document.body.removeChild(probe);

        this.currentScale = actualPx / this.baseFontSize;
        
        // 2. Calculate Compensation
        // If the scale is too high (e.g. 1.5x), we want to shrink the layout base
        // but only up to a certain point to remain accessible.
        let adjustment = 1;
        if (this.currentScale > 1.05) {
            // Formula: Linear compensation that keeps layout manageable
            // If scale is 1.5 (24px), we might want UI elements to be 0.8x size.
            adjustment = Math.max(0.65, 1 / (this.currentScale * 0.98));
        }

        console.log(`📏 [LayoutAdapter] Detected Scale: ${this.currentScale.toFixed(2)}x. Applying Adjustment: ${adjustment.toFixed(2)}x`);

        // 3. Apply Global CSS Variable
        root.style.setProperty('--root-font-scale', adjustment);
        
        // 4. Inject Dynamic CSS Fixes (Non-Invasive)
        this.injectStabilizerCSS(adjustment);
    },

    injectStabilizerCSS: function(scale) {
        let styleEl = document.getElementById('layout-stabilizer-css');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'layout-stabilizer-css';
            document.head.appendChild(styleEl);
        }

        // Only apply adjustments if scale is significant
        if (scale === 1) {
            styleEl.textContent = '';
            return;
        }

        // Applying scale to elements that are prone to overflow
        // We use the calculated --root-font-scale to keep it modular
        styleEl.textContent = `
            :root {
                --ui-scale: var(--root-font-scale, 1);
            }
            
            /* High-Risk Containers: Sidebar and Modals */
            #sidebar, .sidebar-tab-content, .custom-modal, .lot-tooltip {
                font-size: calc(100% * var(--ui-scale)) !important;
            }
            
            /* Specific fix for fixed-height or fixed-width text containers */
            .stat-value, .info-value, .tooltip-action-btn, .tab-btn {
                font-size: calc(100% * var(--ui-scale)) !important;
                line-height: 1.1 !important;
            }

            /* Ensure Sidebar doesn't push map out if it grows too much */
            #sidebar {
                max-width: 95vw !important;
            }
            
            /* Fix for overlapping buttons in headers */
            .header-buttons-wrapper {
                gap: calc(6px * var(--ui-scale)) !important;
            }

            /* Login Box Protection */
            .login-form-side {
                transform: scale(calc(0.95 + (0.05 * var(--ui-scale)))) !important;
                transform-origin: center center !important;
                max-height: 90vh !important;
                overflow-y: auto !important;
            }
            
            .splash-title {
                font-size: calc(2.5rem * var(--ui-scale)) !important;
                line-height: 1.1 !important;
            }
            
            .live-stat-card {
                padding: calc(10px * var(--ui-scale)) !important;
            }
        `;
    }
};

// Auto-init early
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.LayoutAdapter.init());
} else {
    window.LayoutAdapter.init();
}
