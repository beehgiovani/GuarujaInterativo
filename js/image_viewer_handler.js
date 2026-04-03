/**
 * Image Viewer Handler (Premium Gallery)
 * Manages full-screen image display with navigation, zoom (future), and thumbnails.
 */
const ImageViewer = {
    overlay: null,
    imageEl: null,
    counterEl: null,
    thumbnailsTrack: null,

    currentImages: [],
    currentIndex: 0,
    isOpen: false,

    init() {
        if (this.overlay) return; // Already initialized

        // Create DOM Structure
        const overlay = document.createElement('div');
        overlay.id = 'image-viewer-overlay';
        overlay.innerHTML = `
            <div class="iv-header">
                <div class="iv-counter" id="iv-counter">1 / 1</div>
                <button class="iv-close-btn" onclick="ImageViewer.close()">&times;</button>
            </div>
            
            <button class="iv-nav-btn prev" onclick="ImageViewer.prev()"><i class="fas fa-chevron-left"></i></button>
            
            <div class="iv-image-container" id="iv-container">
                <img src="" class="iv-current-image" id="iv-image" />
            </div>
            
            <button class="iv-nav-btn next" onclick="ImageViewer.next()"><i class="fas fa-chevron-right"></i></button>
            
            <div class="iv-thumbnails-track" id="iv-thumbnails">
                <!-- Thumbnails injected here -->
            </div>
        `;

        document.body.appendChild(overlay);

        // Bind Elements
        this.overlay = overlay;
        this.imageEl = overlay.querySelector('#iv-image');
        this.counterEl = overlay.querySelector('#iv-counter');
        this.thumbnailsTrack = overlay.querySelector('#iv-thumbnails');

        // Close on backdrop click (if not updating)
        overlay.onclick = (e) => {
            if (e.target === overlay || e.target.id === 'iv-container') {
                this.close();
            }
        };

        // Keyboard Events
        document.addEventListener('keydown', (e) => {
            if (!this.isOpen) return;
            if (e.key === 'Escape') this.close();
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'ArrowRight') this.next();
        });

        // Touch Helpers (Swipe)
        let touchStartX = 0;
        let touchEndX = 0;

        const container = overlay.querySelector('#iv-container');
        container.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        container.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        }, { passive: true });

        this.handleSwipe = () => {
            const threshold = 50;
            if (touchEndX < touchStartX - threshold) this.next();
            if (touchEndX > touchStartX + threshold) this.prev();
        };

        console.log('✅ Image Viewer Initialized');
    },

    open(images = [], transformFnOrIndex = 0) {
        if (!images || images.length === 0) return;

        // Ensure init
        this.init();

        // Handle arguments
        // If second arg is function, ignore (legacy support if needed), else treat as index
        let startIndex = 0;
        if (typeof transformFnOrIndex === 'number') {
            startIndex = transformFnOrIndex;
        }

        this.currentImages = images;
        this.currentIndex = Math.max(0, Math.min(startIndex, images.length - 1));
        this.isOpen = true;

        // Show Overlay
        this.overlay.style.display = 'flex';
        // Force reflow for animation
        requestAnimationFrame(() => {
            this.overlay.classList.add('active');
        });

        this.render();
    },

    close() {
        if (!this.overlay) return;
        this.overlay.classList.remove('active');
        setTimeout(() => {
            this.overlay.style.display = 'none';
            this.isOpen = false;
            this.currentImages = [];
        }, 300);
    },

    next() {
        if (this.currentIndex < this.currentImages.length - 1) {
            this.currentIndex++;
            this.render();
        } else {
            // Loop? Or bounce? Let's loop for now
            this.currentIndex = 0;
            this.render();
        }
    },

    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.render();
        } else {
            // Loop to end
            this.currentIndex = this.currentImages.length - 1;
            this.render();
        }
    },

    render() {
        if (!this.imageEl) return;

        const src = this.currentImages[this.currentIndex];

        // Image Fade Swap Effect
        this.imageEl.style.opacity = '0.5';
        this.imageEl.style.transform = 'scale(0.95)';

        setTimeout(() => {
            this.imageEl.src = src;
            this.imageEl.onload = () => {
                this.imageEl.style.opacity = '1';
                this.imageEl.style.transform = 'scale(1)';
            };
            // Handle error helper
            this.imageEl.onerror = () => {
                this.imageEl.src = 'https://via.placeholder.com/800x600?text=Imagem+Indisponivel';
                this.imageEl.style.opacity = '1';
                this.imageEl.style.transform = 'scale(1)';
            };
        }, 150);

        // Update Counter
        this.counterEl.textContent = `${this.currentIndex + 1} / ${this.currentImages.length}`;

        // Render Thumbnails
        this.renderThumbnails();

        // Preload Neighbors
        this.preload(this.currentIndex + 1);
        this.preload(this.currentIndex - 1);
    },

    renderThumbnails() {
        if (!this.thumbnailsTrack) return;

        // Simple optimization: only re-render if count changed significantly? 
        // For now, full re-render is fine for < 50 images.

        this.thumbnailsTrack.innerHTML = this.currentImages.map((img, i) => `
            <div class="iv-thumb ${i === this.currentIndex ? 'active' : ''}" onclick="ImageViewer.goTo(${i})">
                <img src="${img}" loading="lazy" />
            </div>
        `).join('');

        // Scroll active into view
        const activeThumb = this.thumbnailsTrack.querySelector('.active');
        if (activeThumb) {
            activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    },

    goTo(index) {
        if (index >= 0 && index < this.currentImages.length) {
            this.currentIndex = index;
            this.render();
        }
    },

    preload(index) {
        if (index >= 0 && index < this.currentImages.length) {
            const img = new Image();
            img.src = this.currentImages[index];
        }
    }
};

// Export global
window.ImageViewer = ImageViewer;
