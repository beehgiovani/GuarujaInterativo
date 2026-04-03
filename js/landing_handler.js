/* LANDING_HANDLER.JS - Gestão da Página de Entrada Premium v2 (Animated) */

window.Landing = {
    _initialized: false,
    _currentSlide: 0,
    _slideInterval: null,
    _particles: [],
    _canvas: null,
    _ctx: null,
    _animationId: null,

    init: function() {
        if (this._initialized) return;
        this._initialized = true;

        // Ocultar login original enquanto a landing está ativa
        const login = document.getElementById('loginOverlay');
        if (login) login.style.display = 'none';

        this.render();
    },

    render: function() {
        const overlay = document.createElement('div');
        overlay.id = 'landing-overlay';
        overlay.innerHTML = `
            <div class="landing-hero">
                <canvas id="landing-particles"></canvas>
                <div class="hero-bg-accent"></div>
                
                <div class="landing-logo-wrapper">
                    <img src="logo.png" alt="Guarugeo" class="landing-logo-img">
                    <div class="landing-shimmer"></div>
                </div>

                <h1 class="landing-title">INTELIGÊNCIA QUE <span>TRANSFORMA</span></h1>
                <p class="landing-tagline">
                    A plataforma definitiva de dados imobiliários e geo-analíticos do Guarujá. 
                    Decisões rápidas, seguras e lucrativas baseadas em evidências reais.
                </p>

                <div class="landing-actions">
                    <button class="btn-landing btn-primary-landing" onclick="window.Landing.showLogin()">
                        <i class="fas fa-sign-in-alt"></i> Acessar Sistema
                    </button>
                    <button class="btn-landing btn-secondary-landing" onclick="window.Landing.enterAsGuest()">
                        <i class="fas fa-eye"></i> Entrar como Visitante
                    </button>
                </div>

                </div>
            </div>

            <div class="landing-showcase-section">
                <div class="landing-carousel-wrapper">
                    <div class="landing-carousel-container">
                        <div class="landing-carousel" id="landing-carousel">
                            <div class="carousel-slide">
                                <img src="l1.png?v=2" alt="Mapa Interativo">
                                <div class="carousel-caption">
                                    <h3>Navegação 3D de Alta Precisão</h3>
                                    <p>Visualize cada lote, edifício e infraestrutura com detalhamento técnico inédito.</p>
                                </div>
                            </div>
                            <div class="carousel-slide">
                                <img src="l2.png?v=2" alt="Inteligência de Dados">
                                <div class="carousel-caption">
                                    <h3>Inteligência de Dados Imobiliários</h3>
                                    <p>Acesse fichas completas, proprietários e histórico de valorização em segundos.</p>
                                </div>
                            </div>
                            <div class="carousel-slide">
                                <img src="l3.png?v=2" alt="Planos e CRM">
                                <div class="carousel-caption">
                                    <h3>Gestão e Prospecção Avançada</h3>
                                    <p>Ferramentas de CRM e Radar de Oportunidades integrados ao mapa.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="carousel-dots" id="carousel-dots">
                        <span class="dot active"></span>
                        <span class="dot"></span>
                        <span class="dot"></span>
                    </div>
                </div>
            </div>

            <div class="landing-content-section" id="about-section">
                <h2 class="section-title">Sobre o Guarugeo</h2>
                <div class="section-grid">
                    <div class="info-card">
                        <i class="fas fa-microchip"></i>
                        <h3>Tecnologia de Ponta</h3>
                        <p>Utilizamos os motores gráficos mais avançados para renderizar o Guarujá em uma escala de detalhe sem precedentes no Brasil.</p>
                    </div>
                    <div class="info-card">
                        <i class="fas fa-database"></i>
                        <h3>Dados Unificados</h3>
                        <p>Cruzamos bases municipais, cartoriais e de mercado para entregar a "verdade do imóvel" em um único clique.</p>
                    </div>
                    <div class="info-card">
                        <i class="fas fa-users-cog"></i>
                        <h3>Para Profissionais</h3>
                        <p>Desenvolvido especificamente para corretores, incorporadores e gestores públicos que precisam de precisão absoluta.</p>
                    </div>
                </div>
            </div>

            <div class="landing-content-section glass-section" id="lgpd-section">
                <div style="max-width: 800px; margin: 0 auto; text-align: center;">
                    <h2 class="section-title"><i class="fas fa-user-shield"></i> Compromisso LGPD</h2>
                    <p style="color: #94a3b8; line-height: 1.8; margin-bottom: 30px;">
                        O Guarugeo opera em total conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). 
                        Nossa plataforma utiliza apenas dados de fontes públicas e algoritmos de anonimização para garantir que 
                        a inteligência de mercado não comprometa a privacidade individual.
                    </p>
                    <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); padding: 20px; border-radius: 12px; text-align: left;">
                        <ul style="list-style: none; padding: 0; margin: 0; color: #cbd5e1; font-size: 14px;">
                            <li style="margin-bottom: 10px;"><i class="fas fa-check-circle" style="color: #3b82f6; margin-right: 10px;"></i> Criptografia de ponta a ponta em todas as transações.</li>
                            <li style="margin-bottom: 10px;"><i class="fas fa-check-circle" style="color: #3b82f6; margin-right: 10px;"></i> Acesso restrito e auditado aos dados sensíveis.</li>
                            <li><i class="fas fa-check-circle" style="color: #3b82f6; margin-right: 10px;"></i> Transparência total sobre a origem e finalidade de cada dado.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div class="landing-content-section" id="contact-section">
                <h2 class="section-title">Contate-nos</h2>
                <div style="display: flex; flex-wrap: wrap; gap: 30px; justify-content: center;">
                    <a href="https://wa.me/5513997099494" target="_blank" class="contact-card">
                        <i class="fab fa-whatsapp"></i>
                        <span>WhatsApp Comercial</span>
                    </a>
                    <div class="contact-card">
                        <i class="fas fa-envelope"></i>
                        <span>contato@guarugeo.com.br</span>
                    </div>
                </div>
            </div>

            <footer class="landing-footer">
                <div class="footer-links">
                    <a href="#about-section" class="footer-link">Sobre</a>
                    <a href="#lgpd-section" class="footer-link">Privacidade</a>
                    <a href="#contact-section" class="footer-link">Contato</a>
                </div>
                <p style="color: #475569; font-size: 12px;">© 2024 Guarugeo - Inteligência Imobiliária. Transformando o Guarujá através dos dados.</p>
            </footer>
        `;

        document.body.appendChild(overlay);
        this.initParticles();
        this.startCarousel();
    },

    initParticles: function() {
        this._canvas = document.getElementById('landing-particles');
        if (!this._canvas) return;
        this._ctx = this._canvas.getContext('2d');
        
        const resize = () => {
            this._canvas.width = window.innerWidth;
            this._canvas.height = window.innerHeight;
        };

        window.addEventListener('resize', resize);
        resize();

        class Particle {
            constructor(canvas) {
                this.canvas = canvas;
                this.init();
            }
            init() {
                this.x = Math.random() * this.canvas.width;
                this.y = Math.random() * this.canvas.height;
                this.size = Math.random() * 2 + 0.5;
                this.speedX = Math.random() * 0.4 - 0.2;
                this.speedY = Math.random() * 0.4 - 0.2;
                this.opacity = Math.random() * 0.4;
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                if (this.x < 0 || this.x > this.canvas.width || this.y < 0 || this.y > this.canvas.height) {
                    this.init();
                }
            }
            draw(ctx) {
                ctx.fillStyle = `rgba(14, 165, 233, ${this.opacity})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        this._particles = [];
        for (let i = 0; i < 120; i++) {
            this._particles.push(new Particle(this._canvas));
        }

        const animate = () => {
            this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
            this._particles.forEach(p => {
                p.update();
                p.draw(this._ctx);
            });
            this._animationId = requestAnimationFrame(animate);
        };
        animate();
    },

    startCarousel: function() {
        const carousel = document.getElementById('landing-carousel');
        const slides = document.querySelectorAll('.carousel-slide');
        const dots = document.querySelectorAll('.carousel-dots .dot');
        if (!carousel || slides.length === 0) return;

        this._slideInterval = setInterval(() => {
            this._currentSlide = (this._currentSlide + 1) % slides.length;
            this.updateCarousel(carousel, dots);
        }, 6000);

        dots.forEach((dot, index) => {
            dot.onclick = () => {
                clearInterval(this._slideInterval);
                this._currentSlide = index;
                this.updateCarousel(carousel, dots);
                this.startCarousel();
            };
        });
    },

    updateCarousel: function(carousel, dots) {
        if (!carousel) return;
        const slides = document.querySelectorAll('.carousel-slide');
        const offset = (this._currentSlide * 100) / (slides.length || 1);
        carousel.style.transform = `translateX(-${offset}%)`;
        dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === this._currentSlide);
        });
    },

    showLogin: function() {
        const landing = document.getElementById('landing-overlay');
        if (landing) landing.classList.add('hidden');
        
        cancelAnimationFrame(this._animationId);
        
        const login = document.getElementById('loginOverlay');
        if (login) {
            login.style.display = 'flex';
            login.classList.remove('hidden');
        }
    },

    enterAsGuest: function() {
        window.isGuest = true;
        window.Toast.info("Entrando como Visitante. Algumas funcionalidades de dados estarão bloqueadas.");
        
        cancelAnimationFrame(this._animationId);
        
        const landing = document.getElementById('landing-overlay');
        if (landing) landing.remove();

        const login = document.getElementById('loginOverlay');
        if (login) login.style.display = 'none';

        if (window.init) window.init();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Só inicia a landing se NÃO estiver logado e NÃO tiver pulado (visitante)
    if (localStorage.getItem('guaruja_auth') !== 'true' && !window.isGuest) {
        window.Landing.init();
    }
});
