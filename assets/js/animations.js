// ============================================
// SAMIAH COSMETICS - ANIMATIONS.JS
// Gestionnaire d'animations modernes
// ============================================

/**
 * 🎨 INTERSECTION OBSERVER
 * Déclenche les animations quand les éléments deviennent visibles
 */
class AnimationController {
  constructor() {
    this.observers = new Map();
    this.init();
  }

  init() {
    // 1. Observer pour animations au scroll
    this.setupScrollAnimations();
    
    // 2. Observer pour lazy loading amélioré
    this.setupLazyLoading();
    
    // 3. Parallax subtil sur hero
    this.setupParallax();
    
    // 4. Animations au hover (performance)
    this.setupHoverEffects();
  }

  /**
   * 📜 ANIMATIONS AU SCROLL
   * Anime les cartes quand elles entrent dans le viewport
   */
  setupScrollAnimations() {
    const options = {
      root: null,
      rootMargin: '0px 0px -100px 0px', // Déclenche 100px avant
      threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          // Délai progressif pour effet cascade
          setTimeout(() => {
            entry.target.classList.add('animate-in');
          }, index * 50); // 50ms de délai entre chaque carte
          
          observer.unobserve(entry.target);
        }
      });
    }, options);

    // Observer toutes les cartes
    const observeCards = () => {
      document.querySelectorAll('.card:not(.animate-in)').forEach(card => {
        observer.observe(card);
      });
    };

    // Observer maintenant et après chaque changement de grille
    observeCards();
    
    // Re-observer quand de nouveaux produits sont chargés
    const gridObserver = new MutationObserver(() => {
      observeCards();
    });
    
    const grid = document.getElementById('products-grid');
    if (grid) {
      gridObserver.observe(grid, { childList: true });
    }

    this.observers.set('scroll', observer);
  }

  /**
   * 🖼️ LAZY LOADING AMÉLIORÉ
   * Précharge les images avant qu'elles soient visibles
   */
  setupLazyLoading() {
    const options = {
      root: null,
      rootMargin: '200px', // Précharge 200px avant
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          
          // Ajoute un effet de fondu
          img.style.opacity = '0';
          img.style.transition = 'opacity 0.4s ease';
          
          const loadImage = () => {
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            }
            
            img.onload = () => {
              img.style.opacity = '1';
              img.classList.add('loaded');
            };
          };

          // Utilise requestIdleCallback si disponible
          if ('requestIdleCallback' in window) {
            requestIdleCallback(loadImage);
          } else {
            setTimeout(loadImage, 0);
          }

          observer.unobserve(img);
        }
      });
    }, options);

    // Observer les images avec data-src
    document.querySelectorAll('img[data-src]').forEach(img => {
      observer.observe(img);
    });

    this.observers.set('lazyload', observer);
  }

  /**
   * 🌊 PARALLAX SUBTIL
   * Effet de profondeur sur le hero
   */
  setupParallax() {
    const hero = document.querySelector('.hero img');
    if (!hero) return;

    let ticking = false;

    const updateParallax = () => {
      const scrolled = window.pageYOffset;
      const rate = scrolled * 0.3;
      
      hero.style.transform = `translateY(${rate}px)`;
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });
  }

  /**
   * 🎯 HOVER EFFECTS OPTIMISÉS
   * Utilise la délégation d'événements pour meilleures performances
   */
  setupHoverEffects() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    // Précharge l'image secondaire au hover
    grid.addEventListener('mouseenter', (e) => {
      // 🔧 FIX : Vérifie que e.target existe et a la méthode closest
      if (!e.target || typeof e.target.closest !== 'function') return;

      const card = e.target.closest('.card');
      if (!card) return;

      const secondaryImg = card.querySelector('.card-img-secondary');
      if (secondaryImg && secondaryImg.dataset.src) {
        const img = new Image();
        img.src = secondaryImg.dataset.src;
        secondaryImg.src = secondaryImg.dataset.src;
        secondaryImg.removeAttribute('data-src');
      }
    }, true); // useCapture pour meilleure performance
  }

  /**
   * 🧹 NETTOYAGE
   * Libère les observers
   */
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }
}

/**
 * 💫 ANIMATIONS DE TRANSITION DE PAGE
 * Smooth transitions entre les états
 */
class PageTransitions {
  constructor() {
    this.setupModalTransitions();
    this.setupSkeletonLoading();
  }

  setupModalTransitions() {
    // Désactive le scroll du body quand modale ouverte
    const modal = document.getElementById('productModal');
    const overlay = document.getElementById('overlay');
    
    if (!modal || !overlay) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isOpen = modal.classList.contains('show');
          
          if (isOpen) {
            // Sauvegarde la position de scroll
            const scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
          } else {
            // Restaure la position
            const scrollY = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            window.scrollTo(0, parseInt(scrollY || '0') * -1);
          }
        }
      });
    });

    observer.observe(modal, { attributes: true });
  }

  setupSkeletonLoading() {
    // Remplace les skeletons par les vraies cartes avec animation
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    const observer = new MutationObserver(() => {
      // Supprime les skeletons avec fade-out
      const skeletons = grid.querySelectorAll('.skeleton');
      skeletons.forEach((skeleton, index) => {
        setTimeout(() => {
          skeleton.style.transition = 'opacity 0.3s ease';
          skeleton.style.opacity = '0';
          setTimeout(() => skeleton.remove(), 300);
        }, index * 50);
      });
    });

    observer.observe(grid, { childList: true });
  }
}

/**
 * 🎬 MICRO-INTERACTIONS
 * Feedbacks visuels pour améliorer l'UX
 */
class MicroInteractions {
  constructor() {
    this.setupButtonRipple();
    this.setupToastNotifications();
    this.setupCopyFeedback();
  }

  setupButtonRipple() {
    document.addEventListener('click', (e) => {
      // ✅ Protection complète
      if (!e || !e.target || typeof e.target.closest !== 'function') return;
      
      const btn = e.target.closest('.btn');
      if (!btn) return;

      const ripple = document.createElement('span');
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: rgba(255,255,255,0.3);
        left: ${x}px;
        top: ${y}px;
        pointer-events: none;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
      `;

      if (!document.getElementById('ripple-style')) {
        const style = document.createElement('style');
        style.id = 'ripple-style';
        style.textContent = `
          @keyframes ripple {
            to { transform: scale(4); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      btn.style.position = 'relative';
      btn.style.overflow = 'hidden';
      btn.appendChild(ripple);

      setTimeout(() => ripple.remove(), 600);
    });
  }

  setupToastNotifications() {
    window.showToast = (message, type = 'success') => {
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        animation: slideInRight 0.3s ease-out;
        font-weight: 600;
      `;

      if (!document.getElementById('toast-style')) {
        const style = document.createElement('style');
        style.id = 'toast-style';
        style.textContent = `
          @keyframes slideInRight {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
      }

      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    };
  }

  setupCopyFeedback() {
    document.addEventListener('click', (e) => {
      // ✅ TRIPLE PROTECTION
      if (!e || !e.target || typeof e.target.closest !== 'function') {
        console.warn('[animations.js] Event target invalid');
        return;
      }
      
      const shareBtn = e.target.closest('#mShare');
      if (!shareBtn) return;

      const originalText = shareBtn.textContent;
      shareBtn.textContent = '✓ Copié !';
      shareBtn.style.background = '#10b981';
      shareBtn.style.color = 'white';

      setTimeout(() => {
        shareBtn.textContent = originalText;
        shareBtn.style.background = '';
        shareBtn.style.color = '';
      }, 2000);
    });
  }
}

/**
 * 🚀 PERFORMANCE OPTIMIZATIONS
 */
class PerformanceBooster {
  constructor() {
    this.setupImagePreload();
    this.setupFontPreload();
    this.setupPrefetch();
  }

  /**
   * 🖼️ PRELOAD des images critiques
   */
  setupImagePreload() {
    // Précharge le logo et hero
    const criticalImages = [
      '/assets/images/samiah-C-final-transparent.svg',
      '/assets/images/consultation-hero.jpg'
    ];

    criticalImages.forEach(src => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      document.head.appendChild(link);
    });
  }

  /**
   * 🔤 PRELOAD des fonts
   */
  setupFontPreload() {
    // Précharge la font système (déjà chargée, mais optimise)
    const fontLink = document.createElement('link');
    fontLink.rel = 'preconnect';
    fontLink.href = 'https://fonts.gstatic.com';
    fontLink.crossOrigin = 'anonymous';
    document.head.appendChild(fontLink);
  }

  /**
   * 🔮 PREFETCH des ressources
   */
  setupPrefetch() {
    // Précharge Supabase au hover des cartes
    let prefetched = false;
    
    document.addEventListener('mouseenter', (e) => {
      if (prefetched) return;
      const card = e.target.closest('.card');
      if (!card) return;

      // Précharge la connexion Supabase
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = 'https://dzzblqlteirtzyegplgu.supabase.co';
      document.head.appendChild(link);
      
      prefetched = true;
    }, true);
  }
}

// ============================================
// 🎯 INITIALISATION
// ============================================

let animationController;
let pageTransitions;
let microInteractions;
let performanceBooster;

function initAnimations() {
  // Attend que le DOM soit prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnimations);
    return;
  }

  console.log('🎨 Initialisation des animations...');

  try {
    animationController = new AnimationController();
    pageTransitions = new PageTransitions();
    microInteractions = new MicroInteractions();
    performanceBooster = new PerformanceBooster();

    console.log('✅ Animations chargées avec succès');
  } catch (error) {
    console.error('❌ Erreur initialisation animations:', error);
  }
}

// Auto-init
initAnimations();

// Export pour usage externe si besoin
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AnimationController,
    PageTransitions,
    MicroInteractions,
    PerformanceBooster
  };
}
