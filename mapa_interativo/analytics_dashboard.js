// ==========================================
// ANALYTICS DASHBOARD - ANALYTICS_DASHBOARD.JS
// ==========================================
// Dashboard de visualização de analytics com gráficos

window.AnalyticsDashboard = {
    isOpen: false,
    charts: {},
    currentDateRange: 30, // dias

    /**
     * Abre o dashboard de analytics
     */
    async show() {
        if (this.isOpen) return;

        Loading.show('Carregando Analytics...', 'Processando dados');

        try {
            // Criar modal/overlay do dashboard
            const modal = this.createDashboardModal();
            document.body.appendChild(modal);

            // Carregar e exibir dados
            await this.loadAndRenderData();

            this.isOpen = true;
            Loading.hide();
        } catch (e) {
            console.error('Erro ao carregar analytics:', e);
            Toast.error('Falha ao carregar analytics');
            Loading.hide();
        }
    },

    /**
     * Cria estrutura HTML do dashboard
     */
    createDashboardModal() {
        const modal = document.createElement('div');
        modal.id = 'analytics-dashboard-overlay';
        modal.className = 'analytics-overlay';
        modal.innerHTML = `
            <div class="analytics-modal">
                <!-- Header -->
                <div class="analytics-header">
                    <h2>📊 Dashboard de Analytics</h2>
                    <div class="analytics-actions">
                        <select id="analytics-date-range" class="analytics-select">
                            <option value="7">Últimos 7 dias</option>
                            <option value="30" selected>Últimos 30 dias</option>
                            <option value="90">Últimos 90 dias</option>
                        </select>
                        <button onclick="window.AnalyticsDashboard.exportData('csv')" class="btn-export">
                            📥 Exportar CSV
                        </button>
                        <button onclick="window.AnalyticsDashboard.refresh()" class="btn-refresh">
                            🔄 Atualizar
                        </button>
                        <button onclick="window.AnalyticsDashboard.close()" class="btn-close-analytics">
                            ✕
                        </button>
                    </div>
                </div>

                <!-- Stats Cards -->
                <div class="analytics-stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">🔍</div>
                        <div class="stat-value" id="stat-searches">-</div>
                        <div class="stat-label">Total de Buscas</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">👁️</div>
                        <div class="stat-value" id="stat-views">-</div>
                        <div class="stat-label">Lotes Visualizados</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">👥</div>
                        <div class="stat-value" id="stat-sessions">-</div>
                        <div class="stat-label">Sessões Únicas</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">📈</div>
                        <div class="stat-value" id="stat-avg">-</div>
                        <div class="stat-label">Eventos/Sessão</div>
                    </div>
                </div>

                <!-- Charts Grid -->
                <div class="analytics-charts-grid">
                    <!-- Eventos por Dia -->
                    <div class="chart-container">
                        <h3>Atividade Diária</h3>
                        <canvas id="chart-daily"></canvas>
                    </div>

                    <!-- Tipos de Busca -->
                    <div class="chart-container">
                        <h3>Distribuição de Buscas</h3>
                        <canvas id="chart-search-types"></canvas>
                    </div>

                    <!-- Top Lotes -->
                    <div class="chart-container">
                        <h3>Top 10 Lotes Mais Visualizados</h3>
                        <div id="table-top-lots" class="analytics-table"></div>
                    </div>

                    <!-- Top Proprietários Buscados -->
                    <div class="chart-container">
                        <h3>Top 10 Proprietários Mais Buscados</h3>
                        <div id="table-top-owners" class="analytics-table"></div>
                    </div>
                </div>
            </div>
        `;

        // Event listeners
        modal.querySelector('#analytics-date-range').addEventListener('change', (e) => {
            this.currentDateRange = parseInt(e.target.value);
            this.refresh();
        });

        return modal;
    },

    /**
     * Carrega dados e renderiza gráficos
     */
    async loadAndRenderData() {
        // Carregar dados do Supabase
        const [statsData, dailyData, searchTypesData, topLotsData, topOwnersData] = await Promise.all([
            this.fetchStats(),
            this.fetchDailyActivity(),
            this.fetchSearchTypes(),
            this.fetchTopLots(),
            this.fetchTopOwners()
        ]);

        // Renderizar stats cards
        this.renderStatsCards(statsData);

        // Renderizar gráficos
        this.renderDailyChart(dailyData);
        this.renderSearchTypesChart(searchTypesData);
        this.renderTopLotsTable(topLotsData);
        this.renderTopOwnersTable(topOwnersData);
    },

    // ========================================
    // DATA FETCHING
    // ========================================

    async fetchStats() {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - this.currentDateRange);

        const { data, error } = await window.supabaseApp
            .from('analytics_events')
            .select('event_type, user_session')
            .gte('created_at', daysAgo.toISOString());

        if (error) throw error;

        return {
            totalSearches: data.filter(e => e.event_type === 'search').length,
            totalViews: data.filter(e => e.event_type === 'view_lot').length,
            uniqueSessions: new Set(data.map(e => e.user_session)).size,
            avgEventsPerSession: data.length / new Set(data.map(e => e.user_session)).size || 0
        };
    },

    async fetchDailyActivity() {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - this.currentDateRange);

        const { data, error } = await window.supabaseApp
            .rpc('get_daily_activity', {
                days_back: this.currentDateRange
            });

        if (error) {
            // Fallback: Query manual
            const { data: events } = await window.supabaseApp
                .from('analytics_events')
                .select('created_at, event_type')
                .gte('created_at', daysAgo.toISOString());

            // Agrupar por dia manualmente
            const grouped = {};
            events.forEach(e => {
                const date = e.created_at.split('T')[0];
                grouped[date] = (grouped[date] || 0) + 1;
            });

            return Object.keys(grouped).sort().map(date => ({
                date,
                count: grouped[date]
            }));
        }

        return data;
    },

    async fetchSearchTypes() {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - this.currentDateRange);

        const { data, error } = await window.supabaseApp
            .from('analytics_events')
            .select('event_data')
            .eq('event_type', 'search')
            .gte('created_at', daysAgo.toISOString());

        if (error) throw error;

        const types = { all: 0, street: 0, building: 0, owner: 0 };
        data.forEach(e => {
            const searchType = e.event_data?.searchType || 'all';
            types[searchType] = (types[searchType] || 0) + 1;
        });

        return types;
    },

    async fetchTopLots() {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - this.currentDateRange);

        const { data, error } = await window.supabaseApp
            .from('analytics_events')
            .select('event_data')
            .eq('event_type', 'view_lot')
            .gte('created_at', daysAgo.toISOString());

        if (error) throw error;

        // Contar visualizações por inscrição
        const counts = {};
        data.forEach(e => {
            const inscricao = e.event_data?.inscricao;
            if (inscricao) {
                if (!counts[inscricao]) {
                    counts[inscricao] = {
                        inscricao,
                        bairro: e.event_data?.bairro || '-',
                        zona: e.event_data?.zona || '-',
                        count: 0
                    };
                }
                counts[inscricao].count++;
            }
        });

        return Object.values(counts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    },

    async fetchTopOwners() {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - this.currentDateRange);

        const { data, error } = await window.supabaseApp
            .from('analytics_events')
            .select('event_data')
            .eq('event_type', 'search')
            .gte('created_at', daysAgo.toISOString());

        if (error) throw error;

        // Filtrar buscas de proprietário e contar
        const counts = {};
        data.forEach(e => {
            if (e.event_data?.searchType === 'owner' && e.event_data?.query) {
                const query = e.event_data.query;
                counts[query] = (counts[query] || 0) + 1;
            }
        });

        return Object.entries(counts)
            .map(([query, count]) => ({ query, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    },

    // ========================================
    // RENDERING
    // ========================================

    renderStatsCards(data) {
        document.getElementById('stat-searches').innerText = data.totalSearches.toLocaleString();
        document.getElementById('stat-views').innerText = data.totalViews.toLocaleString();
        document.getElementById('stat-sessions').innerText = data.uniqueSessions.toLocaleString();
        document.getElementById('stat-avg').innerText = data.avgEventsPerSession.toFixed(1);
    },

    renderDailyChart(data) {
        const ctx = document.getElementById('chart-daily').getContext('2d');

        if (this.charts.daily) {
            this.charts.daily.destroy();
        }

        this.charts.daily = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets: [{
                    label: 'Eventos',
                    data: data.map(d => d.count),
                    borderColor: '#4ECDC4',
                    backgroundColor: 'rgba(78, 205, 196, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    },

    renderSearchTypesChart(data) {
        const ctx = document.getElementById('chart-search-types').getContext('2d');

        if (this.charts.searchTypes) {
            this.charts.searchTypes.destroy();
        }

        this.charts.searchTypes = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Todos', 'Rua', 'Edifício', 'Proprietário'],
                datasets: [{
                    data: [data.all, data.street, data.building, data.owner],
                    backgroundColor: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    },

    renderTopLotsTable(data) {
        const container = document.getElementById('table-top-lots');

        if (data.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#666;">Sem dados</p>';
            return;
        }

        let html = '<table><thead><tr><th>#</th><th>Inscrição</th><th>Logradouro</th><th>Visualizações</th></tr></thead><tbody>';

        data.forEach((item, i) => {
            html += `<tr>
                <td>${i + 1}</td>
                <td>${item.inscricao}</td>
                <td>${item.bairro}</td>
                <td><strong>${item.count}</strong></td>
            </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    renderTopOwnersTable(data) {
        const container = document.getElementById('table-top-owners');

        if (data.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#666;">Sem dados</p>';
            return;
        }

        let html = '<table><thead><tr><th>#</th><th>Proprietário/Busca</th><th>Buscas</th></tr></thead><tbody>';

        data.forEach((item, i) => {
            html += `<tr>
                <td>${i + 1}</td>
                <td>${item.query}</td>
                <td><strong>${item.count}</strong></td>
            </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    // ========================================
    // ACTIONS
    // ========================================

    async refresh() {
        Loading.show('Atualizando...', 'Carregando novos dados');
        await this.loadAndRenderData();
        Loading.hide();
        Toast.success('Analytics atualizado!');
    },

    async exportData(format = 'csv') {
        Loading.show('Exportando...', 'Gerando arquivo');

        try {
            const daysAgo = new Date();
            daysAgo.setDate(daysAgo.getDate() - this.currentDateRange);

            const { data, error } = await window.supabaseApp
                .from('analytics_events')
                .select('*')
                .gte('created_at', daysAgo.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (format === 'csv') {
                this.downloadCSV(data);
            } else if (format === 'json') {
                this.downloadJSON(data);
            }

            Loading.hide();
            Toast.success(`Relatório exportado (${data.length} eventos)`);
        } catch (e) {
            console.error('Erro ao exportar:', e);
            Loading.hide();
            Toast.error('Falha ao exportar dados');
        }
    },

    downloadCSV(data) {
        const headers = ['ID', 'Data/Hora', 'Tipo', 'Sessão', 'Dados'];
        const rows = data.map(e => [
            e.id,
            new Date(e.created_at).toLocaleString('pt-BR'),
            e.event_type,
            e.user_session,
            JSON.stringify(e.event_data)
        ]);

        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `analytics_${Date.now()}.csv`;
        link.click();
    },

    downloadJSON(data) {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `analytics_${Date.now()}.json`;
        link.click();
    },

    close() {
        const modal = document.getElementById('analytics-dashboard-overlay');
        if (modal) {
            // Destruir gráficos
            Object.values(this.charts).forEach(chart => {
                if (chart) chart.destroy();
            });
            this.charts = {};

            modal.remove();
            this.isOpen = false;
        }
    }
};

console.log("✅ Analytics Dashboard module loaded");
