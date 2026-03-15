// Frontend Logic for Review Dashboard

const API_URL = '/api';
const POLLING_INTERVAL = 2000;

let pendingProperties = [];

// Load pending properties// --- Scraper Control ---

async function startScraper() {
    const btn = document.getElementById('btn-start-scraper');
    const limitInput = document.getElementById('scrape-limit');
    const neighSelect = document.getElementById('scrape-neighborhood');
    const statusSection = document.getElementById('status-section');
    const statusText = document.getElementById('scraper-status-text');
    
    const limit = parseInt(limitInput.value) || 5;
    const neighborhood = neighSelect ? neighSelect.value : '';
    
    let confirmMsg = `Iniciar scraping de ${limit} endereços`;
    if (neighborhood) confirmMsg += ` em ${neighborhood}`;
    confirmMsg += '?';

    if (confirm(confirmMsg)) {
        try {
            btn.disabled = true;
            limitInput.disabled = true;
            if(neighSelect) neighSelect.disabled = true;
            
            statusSection.style.display = 'block';
            statusText.textContent = 'Iniciando...';
            statusText.className = 'status-badge running';
            
            const res = await fetch(`${API_URL}/run_scraper`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    limit: limit, 
                    neighborhood: neighborhood 
                })
            });
            const data = await res.json();
            
            if (data.status === 'success') {
                pollScraperStatus();
            } else {
                alert('Error: ' + data.message);
                btn.disabled = false;
                limitInput.disabled = false;
            }
        } catch (error) {
            console.error('Error starting scraper:', error);
            alert('Failed to start scraper');
            btn.disabled = false;
            limitInput.disabled = false;
        }
    }
}

async function syncQueue() {
    const neighSelect = document.getElementById('scrape-neighborhood');
    const neighborhood = neighSelect ? neighSelect.value : '';
    
    if (!neighborhood) {
        alert('Por favor, selecione um bairro para sincronizar.');
        return;
    }
    
    const btn = document.getElementById('btn-sync-queue');
    const originalText = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="icon"><i class="fas fa-spinner fa-spin"></i></span> Sincronizando...';
        
        const res = await fetch(`${API_URL}/sync_queue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ neighborhood: neighborhood })
        });
        
        const data = await res.json();
        
        if (data.status === 'success') {
            alert(`✅ Sincronização concluída!\n\n${data.message}`);
            loadQueue(); // Refresh queue display
        } else {
            alert('❌ Erro na sincronização: ' + data.message);
        }
        
    } catch (e) {
        console.error('Error syncing queue:', e);
        alert('Erro ao conectar com o servidor.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function pollScraperStatus() {
    const btn = document.getElementById('btn-start-scraper');
    const limitInput = document.getElementById('scrape-limit');
    const statusText = document.getElementById('scraper-status-text');
    const consoleDiv = document.getElementById('datalog-console');
    
    let lastLogCount = 0;
    
    const interval = setInterval(async () => {
        try {
            const res = await fetch(`${API_URL}/scraper_status`);
            const status = await res.json();
            
            statusText.textContent = status.message;
            
            // Update logs
            if (status.logs && status.logs.length > lastLogCount) {
                // Determine start index effectively, assuming logs are appended
                // For simplicity, just wipe and rewrite or append new ones.
                // Better: Just re-render all for now to avoid complexity with potential resets
                consoleDiv.innerHTML = status.logs.map(log => 
                    `<div class="log-entry ${log.type}">
                        <span class="log-time">[${log.time}]</span> ${log.message}
                    </div>`
                ).join('');
                
                lastLogCount = status.logs.length;
                consoleDiv.scrollTop = consoleDiv.scrollHeight;
            }
            
            if (!status.is_running) {
                clearInterval(interval);
                btn.disabled = false;
                limitInput.disabled = false;
                statusText.className = 'status-badge done';
                
                // Refresh list if completed
                if (status.message.includes('Completed')) {
                    setTimeout(() => {
                        loadPending();
                        loadStats();
                    }, 1000);
                }
            } else {
                statusText.className = 'status-badge running';
            }
        } catch (e) {
            console.error(e);
            clearInterval(interval);
            btn.disabled = false;
            limitInput.disabled = false;
        }
    }, 1000); // Faster polling for logs
}

// Queue Visualization
async function loadQueue() {
    const queueList = document.getElementById('queue-list');
    const neighSelect = document.getElementById('scrape-neighborhood');
    const neighborhood = neighSelect ? neighSelect.value : '';
    
    try {
        let url = `${API_URL}/queue?limit=10`;
        if (neighborhood) url += `&neighborhood=${encodeURIComponent(neighborhood)}`;
        
        const res = await fetch(url);
        const queue = await res.json();
        
        if (queue.length === 0) {
            queueList.innerHTML = '<div class="queue-empty">Fila vazia. Selecione um bairro e clique em Iniciar para buscar.</div>';
            return;
        }
        
        queueList.innerHTML = queue.map(item => `
            <div class="queue-item">
                <span class="q-addr">${item.logradouro}, ${item.numero}</span>
                <div class="q-meta">
                    <span class="badge badge-secondary">${item.bairro}</span>
                    <small>#${item.inscricao}</small>
                </div>
            </div>
        `).join('');
        
    } catch (e) {
        console.error('Error loading queue:', e);
        queueList.innerHTML = '<div class="queue-empty">Erro ao carregar fila</div>';
    }
}

async function loadNeighborhoods() {
    const select = document.getElementById('scrape-neighborhood');
    if (!select) return;
    
    try {
        select.innerHTML = '<option value="">Carregando...</option>';
        const res = await fetch(`${API_URL}/neighborhoods`);
        const bairros = await res.json();
        
        if (bairros.error) throw new Error(bairros.error);
        
        let html = '<option value="">Todos os Bairros</option>';
        bairros.forEach(b => {
             html += `<option value="${b}">${b}</option>`;
        });
        select.innerHTML = html;
        
        // Load queue after bairros loaded
        loadQueue();
        
    } catch (e) {
        console.error("Error loading neighborhoods:", e);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadPending();
    loadNeighborhoods(); // This triggers loadQueue eventually
    
    // Refresh queue when neighborhood changes
    const neighSelect = document.getElementById('scrape-neighborhood');
    if (neighSelect) {
        neighSelect.addEventListener('change', loadQueue);
    }
});

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('stat-pending').textContent = data.stats.pending;
            document.getElementById('stat-approved').textContent = data.stats.approved;
            document.getElementById('stat-synced').textContent = data.stats.synced;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

let currentPage = 1;

async function loadPending(page = 1) {
    const container = document.getElementById('properties-container');
    const controls = document.getElementById('pagination-controls');
    
    if (page === 1) {
        container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Carregando propriedades...</div>';
    }
    
    const filterSelect = document.getElementById('min-match-filter');
    const minMatch = filterSelect ? filterSelect.value : 0;
    
    try {
        const response = await fetch(`/api/pending?page=${page}&per_page=20&min_match=${minMatch}`);
        const data = await response.json();
        
        if (data.success) {
            pendingProperties = data.properties;
            currentPage = data.pagination.page;
            
            renderProperties(pendingProperties);
            updatePaginationControls(data.pagination);
            controls.style.display = 'block';
        } else {
            container.innerHTML = `<div class="empty-state"><p>❌ Erro: ${data.error}</p></div>`;
            controls.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading properties:', error);
        container.innerHTML = '<div class="empty-state"><p>❌ Erro ao carregar propriedades</p></div>';
        controls.style.display = 'none';
    }
}

function updatePaginationControls(pagination) {
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');
    const info = document.getElementById('page-info');
    
    info.textContent = `Página ${pagination.page} de ${pagination.total_pages}`;
    
    prevBtn.disabled = pagination.page <= 1;
    nextBtn.disabled = pagination.page >= pagination.total_pages;
}

function changePage(delta) {
    loadPending(currentPage + delta);
    // Scroll to top of list
    document.querySelector('.content-area').scrollIntoView({ behavior: 'smooth' });
}

function renderProperties(units) {
    const container = document.getElementById('properties-container');
    
    if (units.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>Nenhuma propriedade pendente</h3>
                <p>Execute o scraper para buscar novos anúncios</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = units.map(unit => createUnitCard(unit)).join('');
}

function createUnitCard(unit) {
    const current = unit.current_data || {};
    
    return `
        <div class="unit-card" data-inscricao="${unit.inscricao}">
            <div class="unit-header-section">
                <div class="unit-title">
                    <span class="badge badge-primary">INSCRIÇÃO: ${unit.inscricao}</span>
                    <h3>${current.logradouro || unit.unit_logradouro}, ${current.numero || unit.unit_numero} - ${current.bairro_unidade || unit.unit_bairro}</h3>
                </div>
                
                <!-- Current Database State -->
                <div class="current-state">
                    <div class="mini-stat">
                        <label>Área Atual</label>
                        <span>${current.area_util || current.metragem || 'N/A'} m²</span>
                    </div>
                    <div class="mini-stat">
                        <label>Valor Atual</label>
                        <span>${current.valor_vendavel ? `R$ ${parseFloat(current.valor_vendavel).toLocaleString('pt-BR')}` : 'N/A'}</span>
                    </div>
                    <div class="mini-stat">
                        <label>Fotos</label>
                        <span>${current.imagens ? current.imagens.length : 0}</span>
                    </div>
                </div>
            </div>
            
            <div class="candidates-list">
                <h4>🎯 Encontrados (${unit.candidate_count}) - Selecione o melhor para sincronizar:</h4>
                ${unit.candidates.map(candidate => createCandidateRow(candidate)).join('')}
            </div>
        </div>
    `;
}

function createCandidateRow(prop) {
    const scoreClass = prop.match_score >= 95 ? 'score-high' : 'score-medium';
    
    return `
        <div class="candidate-row" data-id="${prop.id}">
            <div class="candidate-info">
                <div class="candidate-main">
                    <span class="source-badge">${prop.source.toUpperCase()}</span>
                    <span class="score-badge ${scoreClass}">${prop.match_score}% Match</span>
                    <a href="${prop.url}" target="_blank" class="link-external"><i class="fas fa-external-link-alt"></i> Ver Anúncio</a>
                </div>
                <div class="candidate-details">
                    <span><strong>${prop.title}</strong></span>
                    <span>${prop.scraped_address}</span>
                    <div class="specs-grid">
                        <span><i class="fas fa-ruler-combined"></i> ${prop.area ? prop.area + 'm²' : 'N/A'}</span>
                        <span><i class="fas fa-bed"></i> ${prop.bedrooms || '-'} quartos</span>
                        <span><i class="fas fa-tag"></i> ${prop.price ? 'R$ ' + parseFloat(prop.price).toLocaleString('pt-BR') : 'N/A'}</span>
                    </div>
                </div>
                ${prop.images && prop.images.length > 0 ? `
                    <div class="candidate-images">
                        ${prop.images.slice(0, 4).map(img => `<img src="${img}" onclick="window.open('${img}')">`).join('')}
                        ${prop.images.length > 4 ? `<span class="more-imgs">+${prop.images.length - 4}</span>` : ''}
                    </div>
                ` : ''}
            </div>
            <div class="candidate-actions">
                <button class="btn btn-approve" onclick="approveProperty(${prop.id}, '${prop.inscricao}')">
                    <i class="fas fa-check"></i> Escolher
                </button>
                <button class="btn btn-reject text-danger" onclick="rejectProperty(${prop.id}, '${prop.inscricao}')">
                    <i class="fas fa-times"></i> Rejeitar
                </button>
            </div>
        </div>
    `;
}

async function approveProperty(propId, inscricao) {
    const row = document.querySelector(`.candidate-row[data-id="${propId}"]`);
    const btn = row.querySelector('.btn-approve');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    try {
        const response = await fetch(`/api/approve/${propId}`, { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            // Success! Remove the whole Unit Card because we synced this unit.
            const unitCard = document.querySelector(`.unit-card[data-inscricao="${inscricao}"]`);
            if (unitCard) {
                unitCard.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => {
                    unitCard.remove();
                    checkEmpty();
                }, 300);
            }
            // window.Toast.success('Propriedade sincronizada com sucesso!'); 
        } else {
            alert('Erro: ' + data.error);
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Escolher';
        }
    } catch (e) {
        console.error(e);
        btn.disabled = false;
    }
}

async function rejectProperty(propId, inscricao) {
    const row = document.querySelector(`.candidate-row[data-id="${propId}"]`);
    if (!confirm('Rejeitar este resultado?')) return;
    
    try {
        const response = await fetch(`/api/reject/${propId}`, { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            row.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                row.remove();
                
                // Check if any candidates left in this unit
                const unitCard = document.querySelector(`.unit-card[data-inscricao="${inscricao}"]`);
                const remaining = unitCard.querySelectorAll('.candidate-row').length;
                
                if (remaining === 0) {
                    unitCard.remove(); // No more candidates for this unit
                    checkEmpty();
                }
            }, 300);
        }
    } catch (e) {
        console.error(e);
    }
}

function checkEmpty() {
    loadStats();
    if (document.querySelectorAll('.unit-card').length === 0) {
        renderProperties([]);
    }
}

// Animation for removal
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        to { opacity: 0; transform: translateX(100%); }
    }
    .unit-card {
        background: white; border-radius: 12px; padding: 20px; margin-bottom: 24px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #eef2f7;
    }
    .unit-header-section {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee;
    }
    .current-state { display: flex; gap: 20px; }
    .mini-stat { display: flex; flex-direction: column; align-items: flex-end; }
    .mini-stat label { font-size: 0.75rem; color: #888; text-transform: uppercase; }
    .mini-stat span { font-weight: 600; font-size: 0.95rem; color: #2c3e50; }
    
    .candidate-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 15px; background: #f8f9fa; border-radius: 8px; margin-bottom: 10px;
        border: 1px solid #eee; transition: all 0.2s;
    }
    .candidate-row:hover { border-color: #b3d7ff; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    
    .candidate-info { display: flex; gap: 20px; flex: 1; align-items: center; }
    .candidate-main { display: flex; flex-direction: column; gap: 5px; min-width: 120px; }
    .candidate-details { flex: 1; display: flex; flex-direction: column; gap: 4px; font-size: 0.9rem; }
    .candidate-images { display: flex; gap: 5px; }
    .candidate-images img { width: 40px; height: 40px; object-fit: cover; border-radius: 4px; cursor: pointer; }
    .more-imgs { font-size: 0.8rem; color: #666; align-self: center; }
    
    .specs-grid { display: flex; gap: 15px; color: #666; font-size: 0.85rem; margin-top: 4px; }
    .specs-grid i { margin-right: 4px; color: #3498db; }
    
    .link-external { font-size: 0.8rem; color: #3498db; text-decoration: none; }
    .link-external:hover { text-decoration: underline; }
`;
document.head.appendChild(style);
