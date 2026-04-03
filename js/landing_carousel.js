/**
 * LANDING CAROUSEL (V1.0.0)
 * Gerenciador de Vitrine para a Landing Page Splash.
 * Substitui o Lottie quebrado por um carrossel de imagens premium.
 */

window.LandingCarousel = {
    images: ['assets/l1.png', 'assets/l2.png', 'assets/l3.png'],
    currentIndex: 0,
    interval: null,
    duration: 5000, // 5 segundos por imagem

    init: function() {
        console.log("🎡 [LandingCarousel] Initializing Splash Showcase...");
        this.render();
        this.startAutoCycle();
    },

    render: function() {
        const wrapper = document.querySelector('.lottie-wrapper');
        if (!wrapper) return;

        // Limpar Lottie quebrado
        wrapper.innerHTML = '';
        wrapper.className = 'landing-carousel-wrapper';

        // Criar Container do Carrossel
        const container = document.createElement('div');
        container.className = 'landing-carousel-container';
        
        // Injetar Imagens
        this.images.forEach((src, idx) => {
            const img = document.createElement('img');
            img.src = src;
            img.className = `landing-slide ${idx === 0 ? 'active' : ''}`;
            img.alt = `Vitrine Guarujá ${idx + 1}`;
            container.appendChild(img);
        });

        // Controles de Navegação (Dots)
        const dots = document.createElement('div');
        dots.className = 'carousel-dots';
        this.images.forEach((_, idx) => {
            const dot = document.createElement('span');
            dot.className = `dot ${idx === 0 ? 'active' : ''}`;
            dot.onclick = () => this.goTo(idx);
            dots.appendChild(dot);
        });

        wrapper.appendChild(container);
        wrapper.appendChild(dots);
    },

    startAutoCycle: function() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => {
            this.next();
        }, this.duration);
    },

    next: function() {
        let nextIdx = (this.currentIndex + 1) % this.images.length;
        this.goTo(nextIdx);
    },

    goTo: function(index) {
        const slides = document.querySelectorAll('.landing-slide');
        const dots = document.querySelectorAll('.dot');
        
        if (!slides.length) return;

        // Update Index
        this.currentIndex = index;

        // Update DOM
        slides.forEach((s, idx) => {
            s.classList.toggle('active', idx === index);
        });
        
        dots.forEach((d, idx) => {
            d.classList.toggle('active', idx === index);
        });
        
        // Reset Timer on manual click
        this.startAutoCycle();
    }
};

// Auto-init on load
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.lottie-wrapper')) {
        window.LandingCarousel.init();
    }
});
