/**
 * Module Unifié des Filtres Daltonisme
 * Gestion centralisée de tous les filtres avec règles de compatibilité
 */

class ColorblindFiltersUnified {
    constructor() {
        // États des filtres
        this.activeFilters = new Set();
        
        // Configuration de chaque filtre
        this.filters = {
            deuteranopia: {
                intensity: 0.8,
                type: 'anopia',
                cone: 'M', // Cônes verts
                storageKey: 'deuteranopia-filter',
                shortcut: 'D'
            },
            deuteranomaly: {
                intensity: 0.6,
                type: 'anomaly',
                cone: 'M',
                storageKey: 'deuteranomaly-filter',
                shortcut: 'M'
            },
            protanopia: {
                intensity: 0.8,
                type: 'anopia',
                cone: 'L', // Cônes rouges
                storageKey: 'protanopia-filter',
                shortcut: 'P'
            },
            protanomaly: {
                intensity: 0.7,
                type: 'anomaly',
                cone: 'L',
                storageKey: 'protanomaly-filter',
                shortcut: 'R'
            },
            tritanopia: {
                intensity: 0.85,
                type: 'anopia',
                cone: 'S', // Cônes bleus
                storageKey: 'tritanopia-filter',
                shortcut: 'T'
            },
            tritanomaly: {
                intensity: 0.6,
                type: 'anomaly',
                cone: 'S',
                storageKey: 'tritanomaly-filter',
                shortcut: 'Y',
                sensitivityLevel: 'moderate' // Spécifique à tritanomaly
            },
            achromatopsia: {
                intensity: 0.5, // Confort lumineux
                contrast: 1.2,
                brightness: 0.9,
                textScale: 2.0,
                photophobiaLevel: 'moderate',
                type: 'achromatic',
                cone: 'ALL', // Tous les cônes
                storageKey: 'achromatopsia-filter',
                shortcut: 'G',
                mutationObserver: null
            }
        };
        
        this.storageKey = 'colorblind-filters-unified';
        this.init();
    }
    
    init() {
        this.loadSettings();
        this.initDOM();
        this.attachEvents();
        this.updateAllFilters();
        this.updateAllUI();
        
        // Démarrer l'observation pour achromatopsie si actif
        if (this.activeFilters.has('achromatopsia')) {
            this.startAchromatopsiaObserver();
        }
    }
    
    initDOM() {
        // Bouton principal
        this.toggleBtn = document.getElementById('colorblind-toggle');
        this.sidebar = document.getElementById('colorblind-sidebar');
        this.overlay = document.getElementById('sidebar-overlay');
        this.closeBtn = document.getElementById('close-sidebar');
        
        // Dimmer pour achromatopsie
        this.dimmer = document.getElementById('achro-dimmer');
        if (!this.dimmer) {
            this.dimmer = document.createElement('div');
            this.dimmer.id = 'achro-dimmer';
            this.dimmer.className = 'achro-dimmer';
            document.body.appendChild(this.dimmer);
        }
        
        // Éléments pour chaque filtre
        this.filterElements = {};
        Object.keys(this.filters).forEach(filterName => {
            const item = document.querySelector(`[data-filter="${filterName}"]`);
            if (item) {
                this.filterElements[filterName] = {
                    item: item,
                    header: item.querySelector('.filter-header'),
                    toggle: item.querySelector(`[data-filter-toggle="${filterName}"]`),
                    intensitySlider: item.querySelector(`[data-filter-intensity="${filterName}"]`),
                    intensityValue: item.querySelector('.intensity-value'),
                    // Éléments spécifiques
                    sensitivitySelect: item.querySelector(`[data-filter-sensitivity="${filterName}"]`),
                    photophobiaSelect: item.querySelector(`[data-filter-photophobia="${filterName}"]`),
                    contrastSlider: item.querySelector(`[data-filter-contrast="${filterName}"]`),
                    contrastValue: item.querySelector('.contrast-value'),
                    brightnessSlider: item.querySelector(`[data-filter-brightness="${filterName}"]`),
                    brightnessValue: item.querySelector('.brightness-value'),
                    textScaleSlider: item.querySelector(`[data-filter-textscale="${filterName}"]`),
                    textScaleValue: item.querySelector('.text-scale-value')
                };
            }
        });
    }
    
    attachEvents() {
    // Bouton principal toggle sidebar
    if (this.toggleBtn) {
        this.toggleBtn.addEventListener('click', () => this.toggleSidebar());
    }
    
    // Fermeture sidebar
    if (this.closeBtn) {
        this.closeBtn.addEventListener('click', () => this.closeSidebar());
    }
    if (this.overlay) {
        this.overlay.addEventListener('click', () => this.closeSidebar());
    }
    
    // Événements pour chaque filtre
    Object.keys(this.filters).forEach(filterName => {
        const el = this.filterElements[filterName];
        if (!el) return;
        
        // FIX FIREFOX: Clic sur le header pour expand/collapse
        if (el.header) {
            el.header.addEventListener('click', (e) => {
                // Ne pas trigger si on clique sur le toggle switch ou ses enfants
                if (e.target.closest('.toggle-switch')) {
                    return; // Sortir complètement
                }
                this.toggleExpanded(filterName);
            });
        }
        
        // FIX FIREFOX: Toggle activation avec stopPropagation renforcé
        if (el.toggle) {
            // Change event
            el.toggle.addEventListener('change', (e) => {
                e.stopPropagation();
                this.toggleFilter(filterName, e.target.checked);
            });
            
            // Click event sur l'input
            el.toggle.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            // Click event sur le label parent
            const toggleLabel = el.toggle.closest('.toggle-switch');
            if (toggleLabel) {
                toggleLabel.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
        }
        
        // Intensité
        if (el.intensitySlider) {
            el.intensitySlider.addEventListener('input', (e) => {
                this.setFilterIntensity(filterName, parseFloat(e.target.value));
            });
        }
        
        // Sensibilité (tritanomaly)
        if (el.sensitivitySelect) {
            el.sensitivitySelect.addEventListener('change', (e) => {
                this.filters[filterName].sensitivityLevel = e.target.value;
                this.updateFilter(filterName);
                this.saveSettings();
            });
        }
        
        // Photophobie (achromatopsia)
        if (el.photophobiaSelect) {
            el.photophobiaSelect.addEventListener('change', (e) => {
                this.filters[filterName].photophobiaLevel = e.target.value;
                this.updateFilter(filterName);
                this.saveSettings();
            });
        }
        
        // Contraste (achromatopsia)
        if (el.contrastSlider) {
            el.contrastSlider.addEventListener('input', (e) => {
                this.filters[filterName].contrast = parseFloat(e.target.value);
                this.updateFilter(filterName);
                this.updateContrastDisplay(filterName);
                this.saveSettings();
            });
        }
        
        // Luminosité (achromatopsia)
        if (el.brightnessSlider) {
            el.brightnessSlider.addEventListener('input', (e) => {
                this.filters[filterName].brightness = parseFloat(e.target.value);
                this.updateFilter(filterName);
                this.updateBrightnessDisplay(filterName);
                this.saveSettings();
            });
        }
        
        // Taille du texte (achromatopsia)
        if (el.textScaleSlider) {
            el.textScaleSlider.addEventListener('input', (e) => {
                this.filters[filterName].textScale = parseFloat(e.target.value);
                this.updateFilter(filterName);
                this.updateTextScaleDisplay(filterName);
                this.saveSettings();
            });
        }
    });
    
    // Raccourcis clavier
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            Object.entries(this.filters).forEach(([name, config]) => {
                if (e.key.toUpperCase() === config.shortcut) {
                    e.preventDefault();
                    const isActive = this.activeFilters.has(name);
                    this.toggleFilter(name, !isActive);
                }
            });
        }
        
        // Échapper pour fermer sidebar
        if (e.key === 'Escape') {
            this.closeSidebar();
        }
    });
}



    
    // === GESTION DE LA SIDEBAR ===
    
    toggleSidebar() {
        const isOpen = this.sidebar.classList.contains('show');
        if (isOpen) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }
    
    openSidebar() {
        this.sidebar.classList.add('show');
        this.overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    
    closeSidebar() {
        this.sidebar.classList.remove('show');
        this.overlay.classList.remove('show');
        document.body.style.overflow = '';
    }
    
    toggleExpanded(filterName) {
        const el = this.filterElements[filterName];
        if (!el || !el.item) return;
        
        el.item.classList.toggle('expanded');
    }
    
    // === GESTION DES FILTRES ===
    
    toggleFilter(filterName, activate) {
        if (activate) {
            // Vérifier la compatibilité
            if (!this.canActivateFilter(filterName)) {
                const conflicts = this.getConflicts(filterName);
                this.announce(`Impossible d'activer ${filterName}. Conflit avec: ${conflicts.join(', ')}`);
                
                // Reset le toggle
                const el = this.filterElements[filterName];
                if (el && el.toggle) {
                    el.toggle.checked = false;
                }
                return;
            }
            
            this.activeFilters.add(filterName);
            
            // Démarrer l'observer pour achromatopsie
            if (filterName === 'achromatopsia') {
                this.startAchromatopsiaObserver();
            }
        } else {
            this.activeFilters.delete(filterName);
            
            // Arrêter l'observer pour achromatopsie
            if (filterName === 'achromatopsia') {
                this.stopAchromatopsiaObserver();
                this.clearAchromatopsiaTextOverrides();
            }
        }
        
        this.updateFilter(filterName);
        this.updateFilterUI(filterName);
        this.updateDisabledFilters();
        this.saveSettings();
        
        this.announce(
            activate 
                ? `Filtre ${filterName} activé` 
                : `Filtre ${filterName} désactivé`
        );
    }
    
    canActivateFilter(filterName) {
        const filter = this.filters[filterName];
        
        // Achromatopsie n'est compatible avec rien
        if (filter.cone === 'ALL') {
            return this.activeFilters.size === 0;
        }
        
        // Si achromatopsie est actif, rien d'autre ne peut être activé
        if (this.activeFilters.has('achromatopsia')) {
            return false;
        }
        
        // Vérifier les conflits anopia/anomaly pour le même cône
        for (const active of this.activeFilters) {
            const activeFilter = this.filters[active];
            
            // Même cône : on ne peut pas avoir anopia ET anomaly
            if (activeFilter.cone === filter.cone) {
                return false;
            }
        }
        
        return true;
    }
    
    getConflicts(filterName) {
        const conflicts = [];
        const filter = this.filters[filterName];
        
        if (filter.cone === 'ALL') {
            // Achromatopsie est en conflit avec tout
            return Array.from(this.activeFilters);
        }
        
        if (this.activeFilters.has('achromatopsia')) {
            conflicts.push('achromatopsia');
        }
        
        for (const active of this.activeFilters) {
            const activeFilter = this.filters[active];
            if (activeFilter.cone === filter.cone) {
                conflicts.push(active);
            }
        }
        
        return conflicts;
    }
    
    setFilterIntensity(filterName, intensity) {
        this.filters[filterName].intensity = intensity;
        
        if (this.activeFilters.has(filterName)) {
            this.updateFilter(filterName);
        }
        
        this.updateIntensityDisplay(filterName);
        this.saveSettings();
    }
    
    updateFilter(filterName) {
        const isActive = this.activeFilters.has(filterName);
        const body = document.body;
        
        if (isActive) {
            body.classList.add(`filter-${filterName}-active`);
            this.applyFilterStyle(filterName);
        } else {
            body.classList.remove(`filter-${filterName}-active`);
            this.removeFilterStyle(filterName);
        }
    }
    
    updateAllFilters() {
        Object.keys(this.filters).forEach(filterName => {
            this.updateFilter(filterName);
        });
    }
    
    applyFilterStyle(filterName) {
        let styleId = `${filterName}-custom-style`;
        let styleEl = document.getElementById(styleId);
        
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }
        
        const filter = this.filters[filterName];
        const intensity = filter.intensity;
        
        // Styles spécifiques selon le type de filtre
        switch(filterName) {
            case 'deuteranopia':
                styleEl.textContent = this.getDeuteranopiaStyles(intensity);
                break;
            case 'deuteranomaly':
                styleEl.textContent = this.getDeuteranomalyStyles(intensity);
                break;
            case 'protanopia':
                styleEl.textContent = this.getProtanopiaStyles(intensity);
                break;
            case 'protanomaly':
                styleEl.textContent = this.getProtanomalyStyles(intensity);
                break;
            case 'tritanopia':
                styleEl.textContent = this.getTritanopiaStyles(intensity);
                break;
            case 'tritanomaly':
                styleEl.textContent = this.getTritanomalyStyles(intensity, filter.sensitivityLevel);
                break;
            case 'achromatopsia':
                styleEl.textContent = this.getAchromatopsiaStyles(filter);
                this.applyAchromatopsiaDimming(filter);
                this.scheduleAchromatopsiaContrastAudit();
                break;
        }
    }
    
    removeFilterStyle(filterName) {
        const styleId = `${filterName}-custom-style`;
        const styleEl = document.getElementById(styleId);
        if (styleEl) {
            styleEl.remove();
        }
        
        if (filterName === 'achromatopsia') {
            this.removeAchromatopsiaDimming();
        }
    }
    
    // === STYLES POUR CHAQUE FILTRE ===
    
    getDeuteranopiaStyles(intensity) {
        const hueRotate = 10 * intensity;
        const saturate = 1 + (0.2 * intensity);
        const contrast = 1 + (0.1 * intensity);
        const sepia = 0.1 * intensity;
        
        return `
            .filter-deuteranopia-active header,
            .filter-deuteranopia-active main,
            .filter-deuteranopia-active .demo-content {
                filter: hue-rotate(${hueRotate}deg) saturate(${saturate}) contrast(${contrast}) sepia(${sepia}) !important;
            }
        `;
    }
    
    getDeuteranomalyStyles(intensity) {
        const hueRotate = 8 * intensity;
        const saturate = 1 + (0.15 * intensity);
        const contrast = 1 + (0.08 * intensity);
        const sepia = 0.03 * intensity;
        
        return `
            .filter-deuteranomaly-active header,
            .filter-deuteranomaly-active main,
            .filter-deuteranomaly-active .demo-content {
                filter: hue-rotate(${hueRotate}deg) saturate(${saturate}) contrast(${contrast}) sepia(${sepia}) !important;
            }
        `;
    }
    
    getProtanopiaStyles(intensity) {
        const hueRotate = -5 * intensity;
        const saturate = 1 + (0.3 * intensity);
        const contrast = 1 + (0.15 * intensity);
        const sepia = 0.05 * intensity;
        
        return `
            .filter-protanopia-active header,
            .filter-protanopia-active main,
            .filter-protanopia-active .demo-content {
                filter: hue-rotate(${hueRotate}deg) saturate(${saturate}) contrast(${contrast}) sepia(${sepia}) !important;
            }
        `;
    }
    
    getProtanomalyStyles(intensity) {
        const hueRotate = -3 * intensity;
        const saturate = 1 + (0.2 * intensity);
        const contrast = 1 + (0.1 * intensity);
        const sepia = 0.02 * intensity;
        
        return `
            .filter-protanomaly-active header,
            .filter-protanomaly-active main,
            .filter-protanomaly-active .demo-content {
                filter: hue-rotate(${hueRotate}deg) saturate(${saturate}) contrast(${contrast}) sepia(${sepia}) !important;
            }
        `;
    }
    
    getTritanopiaStyles(intensity) {
        const hueRotate = 25 * intensity;
        const saturate = 1 + (0.25 * intensity);
        const contrast = 1 + (0.15 * intensity);
        const sepia = 0.05 * intensity;
        
        return `
            .filter-tritanopia-active header,
            .filter-tritanopia-active main,
            .filter-tritanopia-active .demo-content {
                filter: hue-rotate(${hueRotate}deg) saturate(${saturate}) contrast(${contrast}) sepia(${sepia}) !important;
            }
        `;
    }
    
    getTritanomalyStyles(intensity, sensitivityLevel) {
        const multiplier = this.getSensitivityMultiplier(sensitivityLevel);
        const hueRotate = 12 * intensity * multiplier;
        const saturate = 1 + (0.15 * intensity * multiplier);
        const contrast = 1 + (0.08 * intensity * multiplier);
        const sepia = 0.03 * intensity * multiplier;
        
        return `
            .filter-tritanomaly-active header,
            .filter-tritanomaly-active main,
            .filter-tritanomaly-active .demo-content {
                filter: hue-rotate(${hueRotate}deg) saturate(${saturate}) contrast(${contrast}) sepia(${sepia}) !important;
            }
        `;
    }
    
    getSensitivityMultiplier(level) {
        switch(level) {
            case 'mild': return 0.7;
            case 'moderate': return 1.0;
            case 'severe': return 1.4;
            default: return 1.0;
        }
    }
    
    getAchromatopsiaStyles(filter) {
        const { brightnessFactor } = this.getPhotophobiaSettings(filter.photophobiaLevel);
        const contrast = filter.contrast;
        const brightness = Math.max(0.6, Math.min(1.2, filter.brightness * brightnessFactor));
        const textScale = filter.textScale;
        
        return `
            .filter-achromatopsia-active header,
            .filter-achromatopsia-active main,
            .filter-achromatopsia-active .demo-content {
                filter: grayscale(1) contrast(${contrast}) brightness(${brightness}) !important;
            }
            
            .filter-achromatopsia-active p,
            .filter-achromatopsia-active li,
            .filter-achromatopsia-active a,
            .filter-achromatopsia-active label,
            .filter-achromatopsia-active small,
            .filter-achromatopsia-active .status,
            .filter-achromatopsia-active button,
            .filter-achromatopsia-active input,
            .filter-achromatopsia-active textarea {
                font-size: calc(1rem * ${textScale}) !important;
                line-height: 1.5;
            }
            
            .filter-achromatopsia-active h1 { font-size: calc(2.0rem * ${textScale}) !important; }
            .filter-achromatopsia-active h2 { font-size: calc(1.75rem * ${textScale}) !important; }
            .filter-achromatopsia-active h3 { font-size: calc(1.5rem * ${textScale}) !important; }
        `;
    }
    
    getPhotophobiaSettings(level) {
        switch(level) {
            case 'mild':
                return { brightnessFactor: 1.0, dimmingFactor: 0.8 };
            case 'moderate':
                return { brightnessFactor: 0.92, dimmingFactor: 1.0 };
            case 'severe':
                return { brightnessFactor: 0.85, dimmingFactor: 1.25 };
            default:
                return { brightnessFactor: 0.92, dimmingFactor: 1.0 };
        }
    }
    
    applyAchromatopsiaDimming(filter) {
        const { dimmingFactor } = this.getPhotophobiaSettings(filter.photophobiaLevel);
        const alpha = Math.max(0, Math.min(0.9, filter.intensity * 0.6 * dimmingFactor));
        if (this.dimmer) {
            this.dimmer.style.opacity = String(alpha);
        }
    }
    
    removeAchromatopsiaDimming() {
        if (this.dimmer) {
            this.dimmer.style.opacity = '0';
        }
    }
    
    // === ACHROMATOPSIA - GARDE DE CONTRASTE ===
    
    startAchromatopsiaObserver() {
        if (this.filters.achromatopsia.mutationObserver) return;
        
        this.filters.achromatopsia.mutationObserver = new MutationObserver(() => {
            this.scheduleAchromatopsiaContrastAudit();
        });
        
        this.filters.achromatopsia.mutationObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });
        
        // Également écouter resize et scroll
        window.addEventListener('resize', this.achromatopsiaResizeHandler);
        window.addEventListener('scroll', this.achromatopsiaScrollHandler, { passive: true });
    }
    
    stopAchromatopsiaObserver() {
        if (this.filters.achromatopsia.mutationObserver) {
            this.filters.achromatopsia.mutationObserver.disconnect();
            this.filters.achromatopsia.mutationObserver = null;
        }
        
        window.removeEventListener('resize', this.achromatopsiaResizeHandler);
        window.removeEventListener('scroll', this.achromatopsiaScrollHandler);
    }
    
    achromatopsiaResizeHandler = () => {
        this.scheduleAchromatopsiaContrastAudit();
    }
    
    achromatopsiaScrollHandler = () => {
        this.scheduleAchromatopsiaContrastAudit();
    }
    
    scheduleAchromatopsiaContrastAudit() {
        if (!this.activeFilters.has('achromatopsia')) return;
        if (this._contrastAuditScheduled) return;
        
        this._contrastAuditScheduled = true;
        requestAnimationFrame(() => {
            this._contrastAuditScheduled = false;
            this.auditAchromatopsiaTextContrast();
        });
    }
    
    auditAchromatopsiaTextContrast() {
        const selectors = [
            'p','span','a','li','label','small','em','strong',
            'button','h1','h2','h3','h4','h5','h6',
            '.status','.box'
        ].join(',');
        
        const nodes = document.body.querySelectorAll(selectors);
        
        nodes.forEach(el => {
            // Ignorer la sidebar et ses enfants
            if (el.closest('#colorblind-sidebar') || el.closest('#colorblind-toggle')) {
                return;
            }
            
            if (!this.isElementVisible(el)) return;
            if (!this.hasReadableText(el)) return;
            
            const cs = getComputedStyle(el);
            
            if (!el.dataset.achroTextOverride && !el.dataset.achroOrigColor) {
                el.dataset.achroOrigColor = cs.color;
            }
            
            const bgColor = this.getEffectiveBackgroundColor(el);
            if (!bgColor) return;
            
            const bgRGB = this.parseRGB(bgColor);
            if (!bgRGB) return;
            
            const fontSizePx = parseFloat(cs.fontSize) || 16;
            const fontWeight = parseInt(cs.fontWeight || '400', 10);
            const isBold = fontWeight >= 700;
            const isLarge = (fontSizePx >= 24) || (fontSizePx >= 18.66 && isBold);
            const target = isLarge ? 3.0 : 4.5;
            
            const Lbg = this.relativeLuminance(bgRGB);
            const curRGB = this.parseRGB(cs.color);
            const curRatio = curRGB ? this.contrastRatio(this.relativeLuminance(curRGB), Lbg) : 0;
            
            const black = [0,0,0];
            const white = [255,255,255];
            const blackRatio = this.contrastRatio(this.relativeLuminance(black), Lbg);
            const whiteRatio = this.contrastRatio(this.relativeLuminance(white), Lbg);
            const bestColor = blackRatio >= whiteRatio ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)';
            
            if (curRatio < target) {
                if (cs.color !== bestColor) {
                    el.style.color = bestColor;
                }
                el.dataset.achroTextOverride = '1';
            } else {
                if (el.dataset.achroTextOverride === '1') {
                    const orig = el.dataset.achroOrigColor;
                    let canRemove = false;
                    if (orig) {
                        const origRGB = this.parseRGB(orig);
                        if (origRGB) {
                            const origRatio = this.contrastRatio(this.relativeLuminance(origRGB), Lbg);
                            if (origRatio >= target) {
                                canRemove = true;
                            }
                        }
                    }
                    if (canRemove) {
                        el.style.color = '';
                        delete el.dataset.achroTextOverride;
                        delete el.dataset.achroOrigColor;
                    } else {
                        if (cs.color !== bestColor) {
                            el.style.color = bestColor;
                        }
                    }
                }
            }
        });
    }
    
    clearAchromatopsiaTextOverrides() {
        const overridden = document.querySelectorAll('[data-achro-text-override="1"]');
        overridden.forEach(el => {
            el.style.color = '';
            delete el.dataset.achroTextOverride;
            delete el.dataset.achroOrigColor;
        });
    }
    
    isElementVisible(el) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const style = getComputedStyle(el);
        return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
    }
    
    hasReadableText(el) {
        const txt = (el.textContent || '').trim();
        return txt.length > 0;
    }
    
    getEffectiveBackgroundColor(el) {
        let node = el;
        while (node && node !== document.documentElement) {
            const cs = getComputedStyle(node);
            const bg = cs.backgroundColor;
            if (bg && !this.isTransparent(bg)) {
                return bg;
            }
            node = node.parentElement;
        }
        const bodyBg = getComputedStyle(document.body).backgroundColor;
        return bodyBg && !this.isTransparent(bodyBg) ? bodyBg : 'rgb(255, 255, 255)';
    }
    
    isTransparent(color) {
        if (!color) return true;
        if (color === 'transparent') return true;
        const m = color.match(/rgba?\(([^)]+)\)/i);
        if (!m) return false;
        const parts = m[1].split(',').map(p => p.trim());
        if (parts.length === 4) {
            const a = parseFloat(parts[3]);
            return a === 0;
        }
        return false;
    }
    
    parseRGB(color) {
        const m = color.match(/rgba?\(([^)]+)\)/i);
        if (!m) return null;
        const parts = m[1].split(',').map(p => p.trim());
        const r = Math.round(parseFloat(parts[0]));
        const g = Math.round(parseFloat(parts[1]));
        const b = Math.round(parseFloat(parts[2]));
        if ([r,g,b].some(v => Number.isNaN(v))) return null;
        return [r,g,b];
    }
    
    relativeLuminance([r,g,b]) {
        const toLin = (v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        const R = toLin(r);
        const G = toLin(g);
        const B = toLin(b);
        return 0.2126 * R + 0.7152 * G + 0.0722 * B;
    }
    
    contrastRatio(L1, L2) {
        const a = Math.max(L1, L2) + 0.05;
        const b = Math.min(L1, L2) + 0.05;
        return a / b;
    }
    
    // === MISE À JOUR DE L'UI ===
    
    updateFilterUI(filterName) {
        const el = this.filterElements[filterName];
        if (!el) return;
        
        const isActive = this.activeFilters.has(filterName);
        
        if (el.item) {
            el.item.classList.toggle('active', isActive);
        }
        
        if (el.toggle) {
            el.toggle.checked = isActive;
        }
        
        this.updateIntensityDisplay(filterName);
        
        // Updates spécifiques
        if (filterName === 'achromatopsia') {
            this.updateContrastDisplay(filterName);
            this.updateBrightnessDisplay(filterName);
            this.updateTextScaleDisplay(filterName);
        }
    }
    
    updateAllUI() {
        Object.keys(this.filters).forEach(filterName => {
            this.updateFilterUI(filterName);
        });
    }
    
    updateDisabledFilters() {
        Object.keys(this.filters).forEach(filterName => {
            const el = this.filterElements[filterName];
            if (!el || !el.item) return;
            
            const canActivate = this.activeFilters.has(filterName) || this.canActivateFilter(filterName);
            el.item.classList.toggle('disabled', !canActivate);
        });
    }
    
    updateIntensityDisplay(filterName) {
        const el = this.filterElements[filterName];
        if (!el) return;
        
        const filter = this.filters[filterName];
        const percentage = Math.round(filter.intensity * 100);
        
        if (el.intensityValue) {
            el.intensityValue.textContent = `${percentage}%`;
        }
        
        if (el.intensitySlider) {
            el.intensitySlider.value = filter.intensity;
        }
    }
    
    updateContrastDisplay(filterName) {
        const el = this.filterElements[filterName];
        if (!el || !el.contrastValue) return;
        
        const filter = this.filters[filterName];
        el.contrastValue.textContent = filter.contrast.toFixed(2);
    }
    
    updateBrightnessDisplay(filterName) {
        const el = this.filterElements[filterName];
        if (!el || !el.brightnessValue) return;
        
        const filter = this.filters[filterName];
        el.brightnessValue.textContent = filter.brightness.toFixed(2);
    }
    
    updateTextScaleDisplay(filterName) {
        const el = this.filterElements[filterName];
        if (!el || !el.textScaleValue) return;
        
        const filter = this.filters[filterName];
        const percentage = Math.round(filter.textScale * 100);
        el.textScaleValue.textContent = `${percentage}%`;
    }
    
    // === SAUVEGARDE / CHARGEMENT ===
    
    saveSettings() {
        const settings = {
            activeFilters: Array.from(this.activeFilters),
            filters: this.filters,
            timestamp: Date.now()
        };
        
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(settings));
        } catch (error) {
            console.warn('Impossible de sauvegarder les paramètres:', error);
        }
    }
    
    loadSettings() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const settings = JSON.parse(saved);
                
                // Charger les filtres actifs
                if (Array.isArray(settings.activeFilters)) {
                    this.activeFilters = new Set(settings.activeFilters);
                }
                
                // Charger les configurations
                if (settings.filters) {
                    Object.keys(settings.filters).forEach(filterName => {
                        if (this.filters[filterName]) {
                            Object.assign(this.filters[filterName], settings.filters[filterName]);
                        }
                    });
                }
            }
        } catch (error) {
            console.warn('Impossible de charger les paramètres:', error);
        }
    }
    
    // === UTILITAIRES ===
    
    announce(message) {
        const el = document.createElement('div');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        el.className = 'sr-only';
        el.style.cssText = `
            position: absolute !important;
            width: 1px !important;
            height: 1px !important;
            padding: 0 !important;
            margin: -1px !important;
            overflow: hidden !important;
            clip: rect(0, 0, 0, 0) !important;
            white-space: nowrap !important;
            border: 0 !important;
        `;
        el.textContent = message;
        document.body.appendChild(el);
        setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 1000);
    }
    
    // === API PUBLIQUE ===
    
    getState() {
        return {
            activeFilters: Array.from(this.activeFilters),
            filters: JSON.parse(JSON.stringify(this.filters))
        };
    }
    
    setState(state) {
        if (state.activeFilters && Array.isArray(state.activeFilters)) {
            this.activeFilters = new Set(state.activeFilters);
        }
        
        if (state.filters) {
            Object.keys(state.filters).forEach(filterName => {
                if (this.filters[filterName]) {
                    Object.assign(this.filters[filterName], state.filters[filterName]);
                }
            });
        }
        
        this.updateAllFilters();
        this.updateAllUI();
        this.updateDisabledFilters();
        this.saveSettings();
    }
    
    destroy() {
        this.activeFilters.forEach(filterName => {
            this.toggleFilter(filterName, false);
        });
        
        this.stopAchromatopsiaObserver();
        this.clearAchromatopsiaTextOverrides();
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    window.colorblindFilters = new ColorblindFiltersUnified();
});

// Export pour modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColorblindFiltersUnified;
}