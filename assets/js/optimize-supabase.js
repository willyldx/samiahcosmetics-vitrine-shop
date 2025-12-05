// ============================================
// SUPABASE IMAGE OPTIMIZER
// Transforme les URLs Supabase pour optimiser les images
// ============================================

/**
 * 🎨 CONFIGURATION
 */
const SUPABASE_CONFIG = {
  // Tailles responsive (breakpoints)
  sizes: {
    mobile: 400,
    tablet: 800,
    desktop: 1200
  },
  
  // Qualité par défaut
  quality: 80,
  
  // Format préféré
  format: 'webp',
  
  // Cache (24h)
  cacheControl: 'public, max-age=86400'
};

/**
 * 🖼️ OPTIMISE UNE URL SUPABASE
 * @param {string} url - URL originale Supabase
 * @param {object} options - Options de transformation
 * @returns {string} URL optimisée
 */
function optimizeSupabaseImage(url, options = {}) {
  if (!url) return '/assets/images/placeholder.png';
  
  // Vérifie que c'est bien une URL Supabase
  if (!url.includes('supabase.co')) return url;
  
  const {
    width = 800,
    height = null,
    quality = SUPABASE_CONFIG.quality,
    format = SUPABASE_CONFIG.format,
    fit = 'cover' // cover | contain | fill
  } = options;
  
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams();
    
    // Transformations Supabase Storage
    if (width) params.append('width', width);
    if (height) params.append('height', height);
    params.append('quality', quality);
    params.append('format', format);
    params.append('resize', fit);
    
    // Ajoute le cache control
    urlObj.search = params.toString();
    
    return urlObj.toString();
  } catch (error) {
    console.warn('Erreur optimisation image:', error);
    return url; // Retourne l'URL originale en cas d'erreur
  }
}

/**
 * 🎯 GÉNÈRE UN SRCSET RESPONSIVE
 * @param {string} baseUrl - URL originale
 * @returns {string} Attribut srcset complet
 */
function generateSrcSet(baseUrl) {
  if (!baseUrl || !baseUrl.includes('supabase.co')) return '';
  
  const { sizes } = SUPABASE_CONFIG;
  
  return [
    `${optimizeSupabaseImage(baseUrl, { width: sizes.mobile })} ${sizes.mobile}w`,
    `${optimizeSupabaseImage(baseUrl, { width: sizes.tablet })} ${sizes.tablet}w`,
    `${optimizeSupabaseImage(baseUrl, { width: sizes.desktop })} ${sizes.desktop}w`
  ].join(', ');
}

/**
 * 📦 CRÉE UN ÉLÉMENT <PICTURE> OPTIMISÉ
 * @param {string} url - URL originale
 * @param {string} alt - Texte alternatif
 * @param {object} options - Options supplémentaires
 * @returns {string} HTML du composant picture
 */
function createOptimizedPicture(url, alt = '', options = {}) {
  const {
    className = '',
    loading = 'lazy',
    aspectRatio = null
  } = options;
  
  const { sizes } = SUPABASE_CONFIG;
  
  // Style inline pour aspect-ratio si spécifié
  const style = aspectRatio ? `aspect-ratio: ${aspectRatio};` : '';
  
  return `
    <picture class="${className}">
      <source
        media="(max-width: 640px)"
        srcset="${optimizeSupabaseImage(url, { width: sizes.mobile, format: 'webp' })}"
        type="image/webp"
      />
      <source
        media="(max-width: 1024px)"
        srcset="${optimizeSupabaseImage(url, { width: sizes.tablet, format: 'webp' })}"
        type="image/webp"
      />
      <source
        srcset="${optimizeSupabaseImage(url, { width: sizes.desktop, format: 'webp' })}"
        type="image/webp"
      />
      <img
        src="${optimizeSupabaseImage(url, { width: sizes.tablet })}"
        alt="${alt}"
        loading="${loading}"
        style="${style} width: 100%; height: 100%; object-fit: cover;"
      />
    </picture>
  `.trim();
}

/**
 * 🚀 PRÉCHARGE UNE IMAGE CRITIQUE
 * @param {string} url - URL de l'image
 * @param {string} as - Type de ressource (image par défaut)
 */
function preloadImage(url, as = 'image') {
  if (!url) return;
  
  const optimizedUrl = optimizeSupabaseImage(url, { 
    width: SUPABASE_CONFIG.sizes.desktop,
    format: 'webp'
  });
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = as;
  link.href = optimizedUrl;
  link.type = 'image/webp';
  
  document.head.appendChild(link);
}

/**
 * 🎨 LAZY LOADING PROGRESSIF
 * Charge les images avec un effet de blur-up
 */
class ProgressiveImageLoader {
  constructor() {
    this.observer = null;
    this.init();
  }
  
  init() {
    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.01
    };
    
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadImage(entry.target);
          this.observer.unobserve(entry.target);
        }
      });
    }, options);
    
    // Observer toutes les images avec data-src
    this.observeImages();
  }
  
  observeImages() {
    document.querySelectorAll('img[data-src]').forEach(img => {
      this.observer.observe(img);
    });
  }
  
  loadImage(img) {
    const src = img.dataset.src;
    if (!src) return;
    
    // Optimise l'URL
    const optimizedSrc = optimizeSupabaseImage(src, {
      width: parseInt(img.dataset.width || '800'),
      quality: parseInt(img.dataset.quality || '80')
    });
    
    // Crée une version basse résolution pour le placeholder
    const placeholderSrc = optimizeSupabaseImage(src, {
      width: 50,
      quality: 50
    });
    
    // Charge le placeholder d'abord
    const placeholder = new Image();
    placeholder.src = placeholderSrc;
    placeholder.onload = () => {
      img.style.filter = 'blur(10px)';
      img.style.transition = 'filter 0.3s ease';
      img.src = placeholderSrc;
      
      // Charge l'image en haute résolution
      const fullImage = new Image();
      fullImage.src = optimizedSrc;
      fullImage.onload = () => {
        img.src = optimizedSrc;
        img.style.filter = 'blur(0)';
        img.classList.add('loaded');
        delete img.dataset.src;
      };
    };
  }
  
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

/**
 * 📊 DIAGNOSTIC DE PERFORMANCE
 * Analyse le poids des images sur la page
 */
async function analyzeImagePerformance() {
  const images = Array.from(document.querySelectorAll('img'));
  
  const report = {
    total: images.length,
    optimized: 0,
    unoptimized: 0,
    totalSize: 0,
    potentialSavings: 0
  };
  
  for (const img of images) {
    const src = img.src || img.dataset.src;
    if (!src) continue;
    
    const isOptimized = src.includes('width=') || src.includes('quality=');
    
    if (isOptimized) {
      report.optimized++;
    } else {
      report.unoptimized++;
    }
    
    // Estimation du poids (basé sur des moyennes)
    if (src.includes('supabase.co')) {
      const estimatedSize = isOptimized ? 50 : 200; // KB
      report.totalSize += estimatedSize;
      
      if (!isOptimized) {
        report.potentialSavings += (200 - 50); // 150KB par image non optimisée
      }
    }
  }
  
  console.group('📊 RAPPORT D\'OPTIMISATION IMAGES');
  console.log(`Total d'images: ${report.total}`);
  console.log(`Optimisées: ${report.optimized} ✅`);
  console.log(`Non optimisées: ${report.unoptimized} ⚠️`);
  console.log(`Poids estimé total: ${report.totalSize}KB`);
  console.log(`Économies potentielles: ${report.potentialSavings}KB (${Math.round(report.potentialSavings/report.totalSize*100)}%)`);
  console.groupEnd();
  
  return report;
}

/**
 * 🔄 MIGRATION AUTOMATIQUE
 * Convertit toutes les images de la page en versions optimisées
 */
function migrateImagesToOptimized() {
  console.log('🔄 Migration des images vers versions optimisées...');
  
  let migrated = 0;
  
  document.querySelectorAll('img').forEach(img => {
    const src = img.src || img.dataset.src;
    
    // Skip si déjà optimisé ou pas Supabase
    if (!src || !src.includes('supabase.co') || src.includes('width=')) return;
    
    // Détermine la largeur optimale basée sur le parent
    const parentWidth = img.parentElement?.offsetWidth || 800;
    const optimalWidth = Math.min(parentWidth * 2, 1200); // 2x pour écrans Retina
    
    // Optimise l'URL
    const optimizedSrc = optimizeSupabaseImage(src, {
      width: optimalWidth,
      quality: 80
    });
    
    // Applique la nouvelle URL
    if (img.dataset.src) {
      img.dataset.src = optimizedSrc;
    } else {
      img.src = optimizedSrc;
    }
    
    migrated++;
  });
  
  console.log(`✅ ${migrated} images migrées avec succès`);
  
  // Lance l'analyse
  setTimeout(() => analyzeImagePerformance(), 1000);
}

// ============================================
// 🎯 INITIALISATION AUTO
// ============================================

let progressiveLoader;

function initSupabaseOptimizer() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabaseOptimizer);
    return;
  }
  
  console.log('🖼️ Initialisation de l\'optimiseur Supabase...');
  
  try {
    // Active le lazy loading progressif
    progressiveLoader = new ProgressiveImageLoader();
    
    // Mode debug : analyse la performance
    if (window.location.search.includes('debug=images')) {
      setTimeout(() => analyzeImagePerformance(), 2000);
    }
    
    console.log('✅ Optimiseur Supabase chargé');
  } catch (error) {
    console.error('❌ Erreur initialisation optimiseur:', error);
  }
}

// Auto-init
initSupabaseOptimizer();

// Export pour usage dans script.js
if (typeof window !== 'undefined') {
  window.SupabaseImageOptimizer = {
    optimize: optimizeSupabaseImage,
    generateSrcSet,
    createPicture: createOptimizedPicture,
    preload: preloadImage,
    analyze: analyzeImagePerformance,
    migrate: migrateImagesToOptimized
  };
}
