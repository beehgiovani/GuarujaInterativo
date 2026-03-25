// ==========================================
// UTILITY FUNCTIONS - UTILS.JS
// ==========================================
// Core utilities: Toast, Loading, formatDocument, UTM conversions, etc.

// --- PRODUCTION LOG SUPPRESSION ---
// Only allow console logs on localhost to keep production console clean.
window.DEBUG_MODE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

if (!window.DEBUG_MODE) {
    const noOp = () => {};
    console.log = noOp;
    console.info = noOp;
    console.debug = noOp;
    // console.warn and console.error are preserved for critical tracing
}

// ========================================
// TOAST NOTIFICATION SYSTEM
// ========================================
const Toast = window.Toast = {
    show(message, type = 'info', title = '', duration = 4000) {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<i class="fas fa-check-circle"></i>',
            error: '<i class="fas fa-exclamation-circle"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>',
            info: '<i class="fas fa-info-circle"></i>'
        };

        const titles = {
            success: title || 'Sucesso',
            error: title || 'Erro',
            warning: title || 'Atenção',
            info: title || 'Informações'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-content">
                <div class="toast-title">${titles[type]}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        toastContainer.appendChild(toast);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.add('removing');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }

        return toast;
    },

    success(message, title) {
        return this.show(message, 'success', title);
    },

    error(message, title) {
        return this.show(message, 'error', title);
    },

    warning(message, title) {
        return this.show(message, 'warning', title);
    },

    info(message, title) {
        return this.show(message, 'info', title);
    }
};

// ========================================
// LOADING OVERLAY CONTROLS
// ========================================
const Loading = window.Loading = {
    show(text = 'Carregando...', subtext = '') {
        const loadingOverlay = document.getElementById('loading-overlay');
        loadingOverlay.classList.remove('hidden');
        if (text) {
            loadingOverlay.querySelector('.loading-text').textContent = text;
        }
        if (subtext) {
            loadingOverlay.querySelector('.loading-subtext').textContent = subtext;
        }
    },

    hide() {
        const loadingOverlay = document.getElementById('loading-overlay');
        loadingOverlay.classList.add('hidden');
    },

    setProgress(percent) {
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
    }
};

// ========================================
// MOBILE SIDEBAR CONTROLS
// ========================================
const MobileSidebar = {
    isOpen: false,

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },

    open() {
        const sidebar = document.getElementById('sidebar');
        const sidebarBackdrop = document.getElementById('sidebarBackdrop');
        const sidebarToggle = document.getElementById('sidebarToggle');

        sidebar.classList.add('open');
        sidebarBackdrop.classList.add('active');
        sidebarToggle.classList.add('active');
        this.isOpen = true;

        // Prevent body scroll on mobile when sidebar is open
        document.body.style.overflow = 'hidden';
    },

    close() {
        const sidebar = document.getElementById('sidebar');
        const sidebarBackdrop = document.getElementById('sidebarBackdrop');
        const sidebarToggle = document.getElementById('sidebarToggle');

        sidebar.classList.remove('open');
        sidebarBackdrop.classList.remove('active');
        sidebarToggle.classList.remove('active');
        this.isOpen = false;

        // Restore body scroll
        document.body.style.overflow = '';
    }
};

// ========================================
// NAME MASKING FUNCTION
// ========================================
window.maskName = function(name, showsFull = false) {
    if (!name || name === 'null') return 'Nome Reservado';
    
    // Master/Admin see everything unmasked
    const role = String(window.Monetization?.userRole || 'user').toLowerCase();
    const isMaster = role === 'admin' || role === 'master';
    
    if (showsFull || isMaster) {
        return name;
    }

    const parts = name.trim().split(' ');
    if (parts.length === 1) {
        return parts[0].substring(0, 2) + '*'.repeat(Math.max(2, parts[0].length - 2));
    }
    const first = parts[0];
    const last = parts[parts.length - 1];
    return `${first.substring(0, 2)}*** ${last.charAt(0)}***`;
};

// ========================================
// CPF/CNPJ FORMATTING
// ========================================
window.formatDocument = function(doc, visible = false) {
    if (!doc || doc === 'null') return '-';
    const clean = doc.toString().replace(/\D/g, '');
    
    const role = String(window.Monetization?.userRole || 'user').toLowerCase();
    const isMaster = role === 'admin' || role === 'master';

    // If it's the Master role or it has been explicitly unlocked (visible)
    if (isMaster || visible) {
        if (clean.length === 11) {
            return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        } else if (clean.length === 14) {
            return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }
        return doc;
    } else {
        // Masked - Partial obfuscation (e.g., 123.***.***-99)
        if (clean.length === 11) {
            return clean.substring(0, 3) + '.***.***-' + clean.substring(9);
        } else if (clean.length === 14) {
            return clean.substring(0, 2) + '.' + clean.substring(2, 5) + '.*** / ****-' + clean.substring(12);
        }
        return '***.***.***-**';
    }
};

function formatPhone(phone) {
    if (!phone) return '';
    const clean = phone.toString().replace(/\D/g, '');
    if (clean.length === 11) {
        return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (clean.length === 10) {
        return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return phone;
}

function validateCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf == '') return false;
    // Eliminate known invalid CPFs
    if (cpf.length != 11 ||
        cpf == "00000000000" ||
        cpf == "11111111111" ||
        cpf == "22222222222" ||
        cpf == "33333333333" ||
        cpf == "44444444444" ||
        cpf == "55555555555" ||
        cpf == "66666666666" ||
        cpf == "77777777777" ||
        cpf == "88888888888" ||
        cpf == "99999999999")
        return false;
    // Validate digits
    let add = 0;
    for (let i = 0; i < 9; i++) add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11);
    if (rev == 10 || rev == 11) rev = 0;
    if (rev != parseInt(cpf.charAt(9))) return false;
    add = 0;
    for (let i = 0; i < 10; i++) add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11);
    if (rev == 10 || rev == 11) rev = 0;
    if (rev != parseInt(cpf.charAt(10))) return false;
    return true;
}

function validateCNPJ(cnpj) {
    cnpj = cnpj.replace(/[^\d]+/g, '');
    if (cnpj == '') return false;
    if (cnpj.length != 14) return false;
    // Eliminate known invalid CNPJs
    if (cnpj == "00000000000000" ||
        cnpj == "11111111111111" ||
        cnpj == "22222222222222" ||
        cnpj == "33333333333333" ||
        cnpj == "44444444444444" ||
        cnpj == "55555555555555" ||
        cnpj == "66666666666666" ||
        cnpj == "77777777777777" ||
        cnpj == "88888888888888" ||
        cnpj == "99999999999999")
        return false;
    // Validate digits
    let tamanho = cnpj.length - 2
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(0)) return false;
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(1)) return false;
    return true;
}

window.toggleCpfVisibility = function (btn, docValue) {
    const valueSpan = btn.previousElementSibling;
    const isHidden = btn.classList.contains('fa-eye');
    
    // 1. Is it already unlocked or is Master?
    const isUnlocked = window.Monetization && window.Monetization.isUnlockedPerson(docValue);

    if (isHidden) {
        // Wants to SHOW
        if (isUnlocked) {
            valueSpan.textContent = window.formatDocument(docValue, true);
            btn.classList.remove('fa-eye');
            btn.classList.add('fa-eye-slash');
            btn.title = "Ocultar";
        } else {
            // Prompt Unlock
            if (window.Monetization && window.Monetization.unlockPerson) {
                window.Monetization.unlockPerson(docValue);
            } else {
                window.Toast.warning("Acesso restrito. Desbloqueie este proprietário para ver o documento.");
            }
        }
    } else {
        // Wants to HIDE
        valueSpan.textContent = window.formatDocument(docValue, false);
        btn.classList.remove('fa-eye-slash');
        btn.classList.add('fa-eye');
        btn.title = "Mostrar";
    }
};

// ========================================
// ZONE COLOR SYSTEM
// ========================================
const ZoneColors = {
    '1': '#FF6B6B',  // Red
    '2': '#4ECDC4',  // Teal
    '3': '#45B7D1',  // Blue
    '4': '#FFA07A',  // Light Salmon
    '5': '#98D8C8',  // Mint
    '6': '#F7DC6F',  // Yellow
    '7': '#BB8FCE',  // Purple
    '8': '#85C1E2',  // Sky Blue
    '9': '#F8B88B',  // Peach
    '10': '#ABEBC6', // Light Green
    'default': '#3388ff' // Default blue
};

function getZoneColor(zona) {
    return ZoneColors[zona] || ZoneColors['default'];
}

// ========================================
// UTM COORDINATE CONVERSION
// ========================================
// These UTM conversion functions are assumed to exist in app.js
// If they don't exist, they should be added here

function utmToLatLon(x, y) {
    // UTM Zone 23K (for Guaruja region)
    const zone = 23;
    const hemisphere = 'S'; // South

    const k0 = 0.9996;
    const a = 6378137.0; // WGS84 Major axis
    const e = 0.081819191; // eccentricity
    const e2 = 0.006694380015; // e^2
    const ePrimeSq = e2 / (1 - e2);

    // Southern Hemisphere Northing Correction
    if (hemisphere === 'S') {
        y = 10000000 - y;
    }

    const M = y / k0;
    const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * Math.pow(e2, 3) / 256));

    // Calculate e1 (often called n or e1 in formulas)
    // e1 = (1 - sqrt(1-e^2)) / (1 + sqrt(1-e^2))
    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

    // Footprint Latitude
    const phi1 = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu)
        + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu)
        + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu);

    const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1));
    const T1 = Math.pow(Math.tan(phi1), 2);
    const C1 = ePrimeSq * Math.pow(Math.cos(phi1), 2);
    const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
    const D = (x - 500000) / (N1 * k0);

    let lat = phi1 - (N1 * Math.tan(phi1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ePrimeSq) * Math.pow(D, 4) / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ePrimeSq - 3 * C1 * C1) * Math.pow(D, 6) / 720);

    // Convert to degrees
    lat = lat * (180 / Math.PI);

    let lon = (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ePrimeSq + 24 * T1 * T1) * Math.pow(D, 5) / 120) / Math.cos(phi1);

    // Convert to degrees and add zone offset
    lon = lon * (180 / Math.PI) + ((zone - 1) * 6 - 180 + 3);

    if (hemisphere === 'S') {
        lat = -Math.abs(lat);
    }

    return { lat, lng: lon };
}

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function latLonToUtm(lat, lng) {
    const zone = 23;
    const k0 = 0.9996;
    const a = 6378137.0;
    const e2 = 0.006694380015;
    const ePrimeSq = e2 / (1 - e2);

    const latRad = lat * (Math.PI / 180);
    const lonRad = lng * (Math.PI / 180);
    const lonOrigin = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);

    const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
    const T = Math.tan(latRad) * Math.tan(latRad);
    const C = e2 * Math.cos(latRad) * Math.cos(latRad) / (1 - e2);
    const A = Math.cos(latRad) * (lonRad - lonOrigin);

    const M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * Math.pow(e2, 3) / 256) * latRad
        - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(2 * latRad)
        + (15 * e2 * e2 / 256 + 45 * Math.pow(e2, 3) / 1024) * Math.sin(4 * latRad)
        - (35 * Math.pow(e2, 3) / 3072) * Math.sin(6 * latRad));

    const x = k0 * N * (A + (1 - T + C) * Math.pow(A, 3) / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ePrimeSq) * Math.pow(A, 5) / 120) + 500000;
    let y = k0 * (M + N * Math.tan(latRad) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ePrimeSq) * Math.pow(A, 6) / 720));

    // Southern Hemisphere Adjustment
    if (lat < 0) {
        y = 10000000 + y;
    }

    return { x, y };
}

// ========================================
// EXPORT TO WINDOW OBJECT
// ========================================
window.ZoneColors = ZoneColors;
window.utmToLatLon = utmToLatLon;
window.latLonToUtm = latLonToUtm;
window.getDistanceFromLatLonInMeters = getDistanceFromLatLonInMeters;
window.formatPhone = formatPhone;
// Helper: Fetch Full Details on Demand
window.fetchLotDetails = async function (inscricao, force = false) {
    if (!window.allLotes) return null;
    const localLote = window.allLotes.find(l => l.inscricao === inscricao);

    if (localLote && localLote._detailsLoaded && !force) {
        console.log(`[Utils] Lote ${inscricao} já possui detalhes carregados.`);
        return localLote;
    }

    window.Loading.show('Carregando Detalhes...', `Baixando dados do lote ${inscricao}...`);

    try {
        const { data, error } = await window.supabaseApp
            .from('lotes')
            .select('*, unidades(*)')
            .eq('inscricao', inscricao)
            .single();

        if (error) throw error;

        if (localLote) {
            Object.assign(localLote, data);
            localLote._detailsLoaded = true;
        }

        window.Loading.hide();
        return localLote;
    } catch (e) {
        console.error("Erro ao baixar detalhes:", e);
        window.Loading.hide();
        window.Toast.error('Erro ao carregar detalhes do lote.');
        return null;
    }
};
// --- MODAL UTILS ---
window.openModal = function (id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('active');
        el.style.display = 'flex';
    }
};

window.closeModal = function (id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('active');
        setTimeout(() => el.style.display = 'none', 300);
    }
};

// --- IMAGE MODAL (LIGHTBOX) ---
window.openImageModal = function (srcOrIndex, collection) {
    if (window.ImageViewer) {
        // New Style
        if (Array.isArray(collection)) {
            window.ImageViewer.open(collection, srcOrIndex);
        } else if (typeof srcOrIndex === 'string') {
            // Single image legacy call
            window.ImageViewer.open([srcOrIndex], 0);
        } else if (Array.isArray(srcOrIndex)) {
            // Passed array directly as first arg
            window.ImageViewer.open(srcOrIndex, 0);
        }
    } else {
        // Fallback (Old Style)
        const modal = document.getElementById('image-modal');
        const modalImg = document.getElementById('modal-image');
        if (modal && modalImg) {
            modalImg.src = (typeof srcOrIndex === 'string') ? srcOrIndex : (collection ? collection[srcOrIndex] : '');
            modal.style.display = 'block';
            requestAnimationFrame(() => modal.classList.add('active'));
        }
    }
};

window.closeImageModal = function () {
    const modal = document.getElementById('image-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    }
};

// --- PERSISTENCE & CACHING (IndexedDB) ---
const DB_NAME = 'GuarujaGeoDB';
const DB_VERSION = 1;
const STORE_NAME = 'lotes_store';

window.openDB = function () {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
};

window.saveLotesToCache = async function (lotes) {
    try {
        const db = await window.openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ id: 'all_lotes', data: lotes, timestamp: Date.now() });
    } catch (e) {
        console.error('Cache Save Error:', e);
    }
};

window.loadLotesFromCache = async function () {
    try {
        const db = await window.openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get('all_lotes');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
    } catch (e) {
        console.error('Cache Load Error:', e);
        return null;
    }
};

// Export Edits removed per user review

// ========================================
// SIMPLE MARKDOWN PARSER - PREMIUM STYLE
// ========================================
window.parseMarkdown = function (text) {
    if (!text) return '';

    let html = text;
    const updateButtons = [];

    // 0. UPDATE_DATA Tags (Pre-processing & Protection)
    // Extract and replace with placeholders to prevent subsequent markdown rules (like _italics_)
    // from corrupting the HTML attributes (onclick) generated here.
    html = html.replace(/\[\s*UPDATE[_\s-]?DATA\s*:\s*([^=\]]+?)\s*=\s*([^\]]+?)\s*\]/gim, function (match, key, value) {
        const cleanKey = key.trim();
        const cleanValue = value.trim();
        const btnHtml = `<div class="farol-update-confirm" style="margin: 12px 0; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 10px; animation: fadeIn 0.5s ease;"><div style="font-size: 13px; color: #064e3b; display: flex; align-items: center; gap: 8px;"><i class="fas fa-magic" style="color: #10b981;"></i><span>Sugestão de Atualização: <b>${cleanKey}</b> &rarr; <b style="background: #fff; padding: 2px 6px; border-radius: 4px; border: 1px dashed #059669;">${cleanValue}</b></span></div><button onclick="window.confirmFarolUpdate('${cleanKey}', '${cleanValue}', this)" style="background: #059669; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.2s;"><i class="fas fa-check"></i> Aplicar</button></div>`;

        updateButtons.push(btnHtml);
        return `%%%FAROLBUTTON${updateButtons.length - 1}%%%`;
    });

    // 1. Headers (### H3, ## H2, # H1) - Colorful and Spaced
    html = html
        .replace(/^### (.*$)/gim, '<h3 style="color: #0284c7; font-size: 1.1em; margin-top: 15px; margin-bottom: 8px; border-bottom: 2px solid #e0f2fe; padding-bottom: 4px;">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 style="color: #0f172a; font-size: 1.3em; margin-top: 25px; margin-bottom: 12px; border-left: 4px solid #3b82f6; padding-left: 10px;">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 style="color: #1e293b; font-size: 1.6em; margin-top: 30px; margin-bottom: 20px; text-align: center; letter-spacing: -0.5px;">$1</h1>');

    // 2. Bold (**text** or __text__)
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong style="color: #0f172a; font-weight: 700; background: rgba(59, 130, 246, 0.1); padding: 0 4px; border-radius: 4px;">$1</strong>');
    html = html.replace(/__(.*?)__/gim, '<strong style="color: #0f172a; font-weight: 700; border-bottom: 2px solid #cbd5e1;">$1</strong>');

    // 3. Italic (*text* or _text_)
    html = html.replace(/\*(.*?)\*/gim, '<em style="color: #475569;">$1</em>');
    html = html.replace(/_(.*?)_/gim, '<em style="color: #475569;">$1</em>');

    // 4. Lists (- item or * item)
    html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; margin-left: 10px;"><span style="color: #3b82f6; font-size: 1.2em; line-height: 1;">•</span><span style="flex: 1;">$1</span></div>');

    // 5. Numbered Lists (1. item)
    html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; margin-left: 10px;"><span style="color: #0284c7; font-weight: bold; background: #e0f2fe; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 0.8em; flex-shrink: 0;">#</span><span style="flex: 1;">$1</span></div>');

    // 6. Blockquotes (> text)
    html = html.replace(/^\> (.*$)/gim, '<div style="background: #f8fafc; border-left: 4px solid #94a3b8; padding: 12px 16px; margin: 15px 0; color: #475569; font-style: italic; border-radius: 0 8px 8px 0;">$1</div>');

    // 7. Horizontal Rules (--- or ___)
    html = html.replace(/^(-{3,}|_{3,})$/gim, '<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;">');

    // 8. Code blocks (```code```)
    html = html.replace(/`(.*?)`/gim, '<code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #db2777; font-family: monospace; font-size: 0.9em;">$1</code>');

    // 9. Images (![alt](url))
    html = html.replace(/!\[(.*?)\]\((.*?)\)/gim, '<div style="margin: 10px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);"><img src="$2" alt="$1" style="width: 100%; height: auto; display: block;" onerror="this.style.display=\'none\'"><div style="background: #f8fafc; padding: 6px; font-size: 10px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0;">$1</div></div>');

    // 9b. Links ([text](url)) - if not image
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: 500;">$1 <i class="fas fa-external-link-alt" style="font-size: 0.8em;"></i></a>');

    // 10. Line Breaks 
    html = html.replace(/\n/g, '<br>');

    // 11. Restore Buttons
    updateButtons.forEach((btn, index) => {
        html = html.replace(`%%%FAROLBUTTON${index}%%%`, btn);
    });

    return `<div style="font-family: 'Inter', system-ui, sans-serif; line-height: 1.6; color: #334155;">${html}</div>`;
};


console.log("✅ Utils module loaded");
// ==========================================
// EXPORTING / CSV
// ==========================================
window.downloadCSV = function (data, filename = 'export.csv') {
    if (!data || !data.length) {
        window.Toast.info('Nenhum dado para exportar.');
        return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [];

    // Header
    csvRows.push(headers.join(';')); // Using SEMICOLON for Better Excel support in South America

    // Data Rows
    for (const row of data) {
        const values = headers.map(header => {
            let val = row[header];
            if (val === null || val === undefined) val = '';
            // Sanitize: Wrap strings with quotes, handle double quotes
            val = '"' + String(val).replace(/"/g, '""') + '"';
            return val;
        });
        csvRows.push(values.join(';'));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' }); // Added BOM for Excel
    const link = document.createElement('a');

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}


// ==========================================
// FAROL UPDATE HANDLER (DATA POLICE)
// ==========================================
window.confirmFarolUpdate = async function (field, value, btn) {
    const parent = btn.closest('.farol-update-confirm');

    // Determine Context (Lote or Unit)
    // We prioritize the Unit if specifically acting on one
    let unit = window.currentUnitForUpdate || (window.currentLoteForUnit && window.currentLoteForUnit.unidades ? window.currentLoteForUnit.unidades[0] : null);
    const lote = window.currentLoteForUnit;

    // Mapear campos amigáveis (SCHEMA COMPLETO)
    const fieldMap = {
        // --- UNIDADES (Tabela: unidades) ---
        'Metragem': 'metragem',
        'Area': 'metragem',
        'Área Útil': 'area_util', // Campo NOVO (Migration 18)
        'Area Util': 'area_util',
        'Área Total': 'area_total', // Campo NOVO (Migration 18)

        // Valores
        'Valor': 'valor_vendavel',
        'Valor_Venda': 'valor_vendavel',
        'Valor_de_Venda': 'valor_vendavel',
        'Valor de Venda': 'valor_vendavel',
        'Preço de Venda': 'valor_vendavel',

        'Valor_de_Mercado': 'valor_real',
        'Valor de Mercado': 'valor_real', // Campo NOVO (Migration 16)
        'Valor Estimado': 'valor_real',

        'Valor Venal': 'valor_venal',
        'Valor_Venal': 'valor_venal',
        'Valor Venal (Inferido)': 'valor_venal', // AI Suggestion Specific
        'Valor Venal Calculado': 'valor_venal',

        // Características Unidade
        'Tipo': 'tipo',
        'Nome': 'nome_proprietario',
        'Proprietario': 'nome_proprietario',
        'Quartos': 'quartos',
        'Dormitorios': 'quartos',
        'Suites': 'suites', // Campo NOVO
        'Suítes': 'suites',
        'Banheiros': 'banheiros', // Campo NOVO
        'Vagas': 'vagas', // Campo NOVO
        'Garagem': 'vagas',

        // --- LOTES/PRÉDIO (Tabela: lotes) ---
        'Elevador': 'elevador',
        'Portaria 24h': 'portaria_24h',
        'Portaria_24h': 'portaria_24h',
        'Churrasqueira': 'churrasqueira',
        'Salao de Jogos': 'salao_jogos',
        'Salão de Jogos': 'salao_jogos',
        'Servico de Praia': 'servico_praia',
        'Serviço de Praia': 'servico_praia',
        'Zeladoria': 'zeladoria',
        'Piscina': 'piscina', // Campo NOVO (Migration 06)
        'Academia': 'academia',

        'Bicicletario': 'bicicletario',
        'Acesso_Deficientes': 'acesso_pcd',
        'Acessibilidade': 'acesso_pcd',
        'Portaria': 'portaria_24h', // Map generic to 24h
        'Salao_Festas': 'salao_festas',
        'Area_Verde': 'area_verde',

        // Ranges / Values
        'Condominio_Faixa': 'valor_condominio',
        'Valor Condominio': 'valor_condominio',

        'Lazer': 'amenities', // Texto Genérico (Legado)
        'Amenities': 'amenities'
    };

    let dbField = fieldMap[field] || fieldMap[field.replace(/ /g, '_')] || field.toLowerCase();

    // DEFINIÇÃO EXPLÍCITA DE TABELAS (Evita erros de "column not found")
    const loteFields = [
        'amenities', 'piscina', 'academia', 'elevador', 'portaria_24h',
        'churrasqueira', 'salao_jogos', 'servico_praia', 'zeladoria',
        'bicicletario', 'acesso_pcd', 'salao_festas', 'area_verde', 'valor_condominio'
    ];

    // Detect context
    const isLoteField = loteFields.includes(dbField);
    const targetTable = isLoteField ? 'lotes' : 'unidades';

    let targetId = null;
    let idColumn = null;

    if (isLoteField) {
        targetId = lote ? lote.inscricao : null;
        idColumn = 'inscricao';
    } else {
        // UNIT UPDATE
        // Try to get inscricao from unit object or active context
        if (unit) {
            targetId = unit.inscricao;
        } else if (lote.unidades && lote.unidades.length > 0) {
            targetId = lote.unidades[0].inscricao; // Fallback risky but standard for single-unit views
        }
        idColumn = 'inscricao';
    }

    if (!targetId) {
        window.Toast.error(`Erro: Não identifiquei qual ${isLoteField ? 'Prédio' : 'Unidade'} atualizar.`);
        return;
    }

    // --- TYPE CONVERSION & VALIDATION ---
    const numericFields = ['metragem', 'area_util', 'area_total', 'valor', 'valor_venal', 'valor_real', 'valor_vendavel', 'quartos', 'banheiros', 'vagas', 'suites'];
    const booleanFields = [
        'piscina', 'academia', 'elevador', 'portaria_24h', 'churrasqueira',
        'salao_jogos', 'servico_praia', 'zeladoria',
        'bicicletario', 'acesso_pcd', 'salao_festas', 'area_verde'
    ];

    // 1. Numeric Fields
    if (numericFields.includes(dbField)) {
        let cleanVal = value.toString().replace(/[R$\s]/g, '');
        // European/Brazilian format handling: 1.200,50 -> 1200.50
        if (cleanVal.includes(',') && cleanVal.includes('.')) {
            cleanVal = cleanVal.replace('.', '').replace(',', '.');
        } else if (cleanVal.includes(',')) {
            cleanVal = cleanVal.replace(',', '.');
        }
        const num = parseFloat(cleanVal);
        if (isNaN(num)) {
            window.Toast.warning(`⚠️ Bloqueado: "${value}" não é um número válido.`);
            return;
        }
        value = num;
    }
    // 2. Boolean Fields
    else if (booleanFields.includes(dbField)) {
        const lowerVal = value.toString().toLowerCase().trim();
        if (['sim', 'yes', 's', 'y', 'true', '1', 'tem', 'possui'].includes(lowerVal)) value = true;
        else if (['não', 'nao', 'no', 'n', 'false', '0'].includes(lowerVal)) value = false;
        else {
            if (dbField === 'servico_praia') value = true; // Contexto positivo comum
            else {
                window.Toast.warning(`Para ${field}, use "Sim" ou "Não".`);
                return;
            }
        }
    }

    // Special: Amenities Text Append (Legacy)
    if (dbField === 'amenities') {
        const currentAmenities = lote.amenities || '';
        if (!currentAmenities.toLowerCase().includes(value.toLowerCase())) {
            value = currentAmenities ? `${currentAmenities}, ${value}` : value;
        } else {
            window.Toast.info("Item já consta na lista.");
            if (parent) parent.innerHTML = `<div style="color: #059669; font-size: 12px;">✅ Já cadastrado!</div>`;
            return;
        }
    }

    // CONFIRM MODAL
    if (!confirm(`Confirmar atualização de ${field} para "${value}"?`)) return;

    window.Loading.show("Atualizando sistema...", `Sincronizando: ${field} -> ${value}`);

    try {
        const { error } = await window.supabaseApp
            .from(targetTable)
            .update({ [dbField]: value })
            .eq(idColumn, targetId);

        if (error) throw error;

        // --- OPTIMISTIC UPDATE (Update Local State immediately) ---
        if (isLoteField) {
            if (lote) lote[dbField] = value;
            // Also update global cache if possible
            const globalLote = window.allLotes.find(l => l.inscricao === lote.inscricao);
            if (globalLote) globalLote[dbField] = value;

        } else {
            // Unit Update
            if (unit) unit[dbField] = value;

            // Update Parent Lote reference
            if (lote && lote.unidades) {
                const u = lote.unidades.find(u => u.inscricao === targetId);
                if (u) u[dbField] = value;
            }

            // Update Global Cache
            const globalLote = window.allLotes.find(l => l.inscricao === (lote ? lote.inscricao : null));
            if (globalLote && globalLote.unidades) {
                const globalUnit = globalLote.unidades.find(u => u.inscricao === targetId);
                if (globalUnit) globalUnit[dbField] = value;
            }
        }

        window.Toast.success("Atualizado com sucesso!");
        btn.innerHTML = '<i class="fas fa-check"></i> Salvo';
        btn.style.background = '#059669';
        btn.disabled = true;

        // Force Refresh of Tooltip Unit View if open
        if (window.currentTooltipType === 'unit' && window.currentUnitForUpdate && window.currentUnitForUpdate.inscricao === targetId) {
            // Maybe refresh the header price?
            // window.showUnitTooltip(unit); // This might be too aggressive, closes modal
        }

    } catch (e) {
        console.error(e);
        window.Toast.error("Erro ao salvar: " + e.message);
        btn.innerHTML = '<i class="fas fa-times"></i> Erro';
        btn.style.background = '#ef4444';
    } finally {
        window.Loading.hide();
    }
};


