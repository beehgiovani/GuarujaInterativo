// ==========================================
// GRAPH HANDLER - TEIA DE INFLUÊNCIA
// ==========================================
// Platinum Level: Interactive relationship mapping

window.GraphHandler = {
    instance: null,

    /**
     * Initializes and renders the relationship graph
     * @param {string} containerId - Div ID to render the graph
     * @param {object} networkData - { nodes, edges }
     */
    render: async function(containerId, networkData) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Validation for assertive functionality
        if (!networkData || !networkData.nodes || networkData.nodes.length === 0) {
            container.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:#64748b;">Nenhuma conexão relevante para mapear graficamente.</div>';
            return;
        }

        // Load D3.js dynamically if not present (Force-Directed Graph)
        if (typeof d3 === 'undefined') {
            await this.loadLibrary();
        }

        const width = container.clientWidth;
        const height = container.clientHeight;

        const svg = d3.select(`#${containerId}`)
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", [0, 0, width, height])
            .call(d3.zoom().on("zoom", (event) => {
                g.attr("transform", event.transform);
            }));

        const g = svg.append("g");

        const simulation = d3.forceSimulation(networkData.nodes)
            .force("link", d3.forceLink(networkData.links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2));

        // Links (Lines)
        const link = g.append("g")
            .attr("stroke", "#94a3b8")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(networkData.links)
            .join("line")
            .attr("stroke-width", d => Math.sqrt(d.value || 1));

        // Nodes (Circles)
        const node = g.append("g")
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .selectAll("g")
            .data(networkData.nodes)
            .join("g")
            .call(this.drag(simulation));

        node.append("circle")
            .attr("r", d => d.main ? 15 : 8)
            .attr("fill", d => d.main ? "#7c3aed" : "#3b82f6")
            .style("filter", d => d.main ? "drop-shadow(0 0 8px rgba(124, 58, 237, 0.6))" : "none");

        // Labels
        node.append("text")
            .attr("x", 12)
            .attr("y", 4)
            .text(d => d.name)
            .style("font-size", "10px")
            .style("font-weight", "bold")
            .style("fill", "#1e293b")
            .style("stroke", "white") // Text halo for readability
            .style("stroke-width", "0.5px");

        node.on("click", (event, d) => {
            if (d.id && typeof window.ProprietarioTooltip.show === 'function') {
                window.ProprietarioTooltip.show(d.id);
            }
        });

        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("transform", d => `translate(${d.x},${d.y})`);
        });

        this.instance = { svg, simulation };
    },

    drag: function(simulation) {
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    },

    loadLibrary: function() {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://d3js.org/d3.v7.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    },

    /**
     * Shows the graph in a full-screen overlay
     */
    showOverlay: function(nodes, links) {
        let overlay = document.getElementById('graph-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'graph-overlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(255,255,255,0.95); z-index: 10000;
                display: flex; flex-direction: column;
            `;
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = `
            <div style="padding: 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: white;">
                <div>
                    <h2 style="margin: 0; font-size: 18px; color: #1e293b;">Teia de Influência (Platinum)</h2>
                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #64748b;">Mapeamento dinâmico de conexões societárias e econômicas</p>
                </div>
                <button onclick="document.getElementById('graph-overlay').style.display='none'" style="background: #f1f5f9; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer;">Fechar</button>
            </div>
            <div id="graph-container" style="flex: 1; position: relative; overflow: hidden; background: #f8fafc;"></div>
            <div style="padding: 10px; background: #0f172a; color: white; font-size: 10px; text-align: center; letter-spacing: 1px;">
                <i class="fas fa-mouse"></i> ARRASTE PARA MOVER · ZOOM COM SCROLL · CLIQUE NOS NÓS PARA DETALHAR
            </div>
        `;

        overlay.style.display = 'flex';
        this.render('graph-container', { nodes, links });
    }
};
