/**
 * Module Unifié des Filtres Daltonisme
 * Gestion centralisée de tous les filtres avec règles de compatibilité
 *
 * NOTE: accessibility (RGAA / ARIA / keyboard) additions:
 * - Each filter header is keyboard-focusable (tabindex=0) and has role="button"
 * - Enter/Space toggles expansion when header is focused
 * - aria-expanded on headers and aria-hidden on details kept in sync
 * - Toggle inputs receive an accessible aria-label
 * - Keydown on toggles stops propagation so header handlers are not triggered
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
                const details = item.querySelector('.filter-details');
                // Assigner un id aux détails si absent (nécessaire pour aria-controls)
                if (details && !details.id) {
                    details.id = `filter-details-${filterName}`;
                }
                this.filterElements[filterName] = {
                    item: item,
                    header: item.querySelector('.filter-header'),
                    details: details,
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

                // --- Accessibility: make header keyboard-focusable and add ARIA attributes ---
                const el = this.filterElements[filterName];
                if (el.header) {
                    // Only add attributes if not present to avoid touching other code
                    if (!el.header.hasAttribute('tabindex')) {
                        el.header.setAttribute('tabindex', '0');
                    }
                    if (!el.header.hasAttribute('role')) {
                        el.header.setAttribute('role', 'button');
                    }
                    if (el.details) {
                        el.header.setAttribute('aria-controls', el.details.id);
                        const expanded = el.item.classList.contains('expanded') ? 'true' : 'false';
                        el.header.setAttribute('aria-expanded', expanded);
                        el.details.setAttribute('aria-hidden', expanded === 'true' ? 'false' : 'true');
                    } else {
                        el.header.setAttribute('aria-expanded', 'false');
                    }

                    // Keyboard support: Enter or Space toggles expansion
                    // BUT ignore events that originate from interactive descendants (toggle, inputs...) — fix for "Space on toggle opens details"
                    el.header.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            // If event started inside an interactive control, do nothing here
                            const interactiveAncestor = (e.target && (e.target.closest && (e.target.closest('.toggle-switch') || e.target.closest('input,button,select,textarea,a'))));
                            if (interactiveAncestor) {
                                return;
                            }
                            e.preventDefault();
                            this.toggleExpanded(filterName);
                        }
                    });
                }

                // Ensure toggles have accessible labels (keyboard users can focus them)
                if (el.toggle) {
                    const displayNameEl = item.querySelector('.filter-name');
                    const displayName = displayNameEl ? displayNameEl.textContent.trim() : filterName;
                    if (!el.toggle.hasAttribute('aria-label')) {
                        el.toggle.setAttribute('aria-label', `Activer ${displayName}`);
                    }

                    // Important: stop propagation of keydown from the toggle so header's keydown isn't triggered.
                    el.toggle.addEventListener('keydown', (ev) => {
                        // For Space or Enter, prevent the key event from bubbling to header.
                        if (ev.key === ' ' || ev.key === 'Spacebar' || ev.key === 'Enter') {
                            ev.stopPropagation();
                            // Let Space behave natively (toggle checkbox on Space).
                            // For Enter, toggle manually for consistency across browsers:
                            if (ev.key === 'Enter') {
                                ev.preventDefault();
                                try {
                                    el.toggle.checked = !el.toggle.checked;
                                    // trigger change event so existing handlers run
                                    const changeEvent = new Event('change', { bubbles: true });
                                    el.toggle.dispatchEvent(changeEvent);
                                } catch (e) {
                                    // ignore
                                }
                            }
                        }
                    });
                }
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
            if (el.contrastSlider && filterName === 'achromatopsia') {
                el.contrastSlider.addEventListener('input', (e) => {
                    this.filters[filterName].contrast = parseFloat(e.target.value);
                    this.updateFilter(filterName);
                    this.updateContrastDisplay(filterName);
                    if (this.activeFilters.has('achromatopsia') && this.isAchroObserverActive()) {
                        this.scheduleAchromatopsiaContrastAudit();
                    }
                    this.saveSettings();
                });
            }

            // Luminosité (achromatopsia)
            if (el.brightnessSlider && filterName === 'achromatopsia') {
                el.brightnessSlider.addEventListener('input', (e) => {
                    this.filters[filterName].brightness = parseFloat(e.target.value);
                    this.updateFilter(filterName);
                    this.updateBrightnessDisplay(filterName);
                    if (this.activeFilters.has('achromatopsia') && this.isAchroObserverActive()) {
                        this.scheduleAchromatopsiaContrastAudit();
                    }
                    this.saveSettings();
                });
            }

            // Intensité (pour achromatopsia = confort lumineux)
            if (el.intensitySlider && filterName === 'achromatopsia') {
                el.intensitySlider.addEventListener('input', (e) => {
                    this.setFilterIntensity(filterName, parseFloat(e.target.value));
                    if (this.activeFilters.has('achromatopsia') && this.isAchroObserverActive()) {
                        this.scheduleAchromatopsiaContrastAudit();
                    }
                });
            }
            
            // Taille du texte (achromatopsia)
            if (el.textScaleSlider && filterName === 'achromatopsia') {
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
        // Focus first interactive element for keyboard users
        const firstToggle = this.sidebar.querySelector('input[type="checkbox"]');
        if (firstToggle) firstToggle.focus();
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

        // Sync ARIA attributes
        const expanded = el.item.classList.contains('expanded');
        if (el.header) {
            el.header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }
        if (el.details) {
            el.details.setAttribute('aria-hidden', expanded ? 'false' : 'true');
            // if expanded, move focus to first control inside details for keyboard-only users
            if (expanded) {
                const firstControl = el.details.querySelector('input, select, button, textarea, [tabindex]:not([tabindex="-1"])');
                if (firstControl) {
                    // small timeout to allow transition
                    setTimeout(() => firstControl.focus(), 150);
                }
            }
        }
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
            
            this.updateFilter(filterName);
            this.updateFilterUI(filterName);
            this.updateDisabledFilters();
            this.saveSettings();
            
            this.announce(`Filtre ${filterName} activé`);
            
        } else {
            // Arrêter l'observer AVANT de retirer du Set
            if (filterName === 'achromatopsia') {
                this.stopAchromatopsiaObserver();
                this.clearAchromatopsiaTextOverrides();
            }
            
            // ENSUITE retirer du Set
            this.activeFilters.delete(filterName);
            
            this.updateFilter(filterName);
            this.updateFilterUI(filterName);
            this.updateDisabledFilters();
            this.saveSettings();
            
            this.announce(`Filtre ${filterName} désactivé`);
        }
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
    
    // NOUVELLE LOGIQUE : Autoriser les filtres de cônes différents
    // mais pas anopia + anomaly du même cône
    for (const active of this.activeFilters) {
        const activeFilter = this.filters[active];
        
        // Même cône : on ne peut pas avoir anopia ET anomaly
        if (activeFilter.cone === filter.cone) {
            // Si même cône, vérifier si c'est le même type (interdit)
            // ou des types différents (anopia vs anomaly - à interdire aussi)
            return false;
        }
    }
    
    return true; // Différents cônes = OK
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
    
    // Modifier la méthode updateFilter pour recalculer tous les filtres actifs
updateFilter(filterName) {
    const isActive = this.activeFilters.has(filterName);
    const body = document.body;
    
    if (isActive) {
        body.classList.add(`filter-${filterName}-active`);
    } else {
        body.classList.remove(`filter-${filterName}-active`);
    }
    
    // Au lieu d'appliquer/retirer individuellement, recalculer tous les filtres actifs
    this.applyComposedFilters();
}

// Nouvelle méthode pour composer tous les filtres actifs
applyComposedFilters() {
    const styleId = 'composed-filters-style';
    let styleEl = document.getElementById(styleId);
    
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
    }
    
    if (this.activeFilters.size === 0) {
        styleEl.textContent = '';
        return;
    }
    
    // Accumuler les valeurs de filtres
    let hueRotate = 0;
    let saturate = 1;
    let contrast = 1;
    let sepia = 0;
    let grayscale = 0;
    let brightness = 1;
    
    // Parcourir tous les filtres actifs et accumuler leurs effets
    this.activeFilters.forEach(filterName => {
        const filter = this.filters[filterName];
        const intensity = filter.intensity;
        
        switch(filterName) {
            case 'deuteranopia':
                hueRotate += 10 * intensity;
                saturate *= (1 + (0.2 * intensity));
                contrast *= (1 + (0.1 * intensity));
                sepia += 0.1 * intensity;
                break;
            case 'deuteranomaly':
                hueRotate += 8 * intensity;
                saturate *= (1 + (0.15 * intensity));
                contrast *= (1 + (0.08 * intensity));
                sepia += 0.03 * intensity;
                break;
            case 'protanopia':
                hueRotate += -5 * intensity;
                saturate *= (1 + (0.3 * intensity));
                contrast *= (1 + (0.15 * intensity));
                sepia += 0.05 * intensity;
                break;
            case 'protanomaly':
                hueRotate += -3 * intensity;
                saturate *= (1 + (0.2 * intensity));
                contrast *= (1 + (0.1 * intensity));
                sepia += 0.02 * intensity;
                break;
            case 'tritanopia':
                hueRotate += 25 * intensity;
                saturate *= (1 + (0.25 * intensity));
                contrast *= (1 + (0.15 * intensity));
                sepia += 0.05 * intensity;
                break;
            case 'tritanomaly':
                const multiplier = this.getSensitivityMultiplier(filter.sensitivityLevel);
                hueRotate += 12 * intensity * multiplier;
                saturate *= (1 + (0.15 * intensity * multiplier));
                contrast *= (1 + (0.08 * intensity * multiplier));
                sepia += 0.03 * intensity * multiplier;
                break;
            case 'achromatopsia':
                const { brightnessFactor } = this.getPhotophobiaSettings(filter.photophobiaLevel);
                grayscale = 1; // Si achromatopsie actif, force grayscale
                contrast *= filter.contrast;
                brightness *= Math.max(0.6, Math.min(1.2, filter.brightness * brightnessFactor));
                break;
        }
    });
    
    // Générer le CSS avec les valeurs combinées
    const filterString = `
        hue-rotate(${hueRotate}deg) 
        saturate(${saturate}) 
        contrast(${contrast}) 
        sepia(${sepia}) 
        grayscale(${grayscale}) 
        brightness(${brightness})
    `.trim();
    
    styleEl.textContent = `
        body.has-active-filters header,
        body.has-active-filters main,
        body.has-active-filters .demo-content {
            filter: ${filterString} !important;
        }
    `;
    
    // Ajouter/retirer la classe helper
    document.body.classList.toggle('has-active-filters', this.activeFilters.size > 0);
    
    // Gérer l'achromatopsie dimming si actif
    if (this.activeFilters.has('achromatopsia')) {
        const filter = this.filters.achromatopsia;
        this.applyAchromatopsiaDimming(filter);
        if (this.isAchroObserverActive()) {
            setTimeout(() => this.scheduleAchromatopsiaContrastAudit(), 50);
        }
    } else {
        this.removeAchromatopsiaDimming();
    }
}

// Modifier applyFilterStyle et removeFilterStyle pour utiliser la nouvelle méthode
applyFilterStyle(filterName) {
    // Cette méthode peut être simplifiée ou supprimée
    // car applyComposedFilters() gère tout
    this.applyComposedFilters();
}

removeFilterStyle(filterName) {
    // Cette méthode peut être simplifiée
    this.applyComposedFilters();
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

    // Helper: vérifier si l'observer Achromatopsie est bien actif
    isAchroObserverActive() {
        const obs = this.filters.achromatopsia?.mutationObserver;
        return !!(obs && typeof obs.observe === 'function' && typeof obs.disconnect === 'function');
    }
    
    // === ACHROMATOPSIA - GARDE DE CONTRASTE ===
    
    startAchromatopsiaObserver() {
        if (this.isAchroObserverActive()) return;
        
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
        // Annuler tout audit en attente
        if (this._contrastAuditScheduled) {
            this._contrastAuditScheduled = false;
        }
        
        const obs = this.filters.achromatopsia.mutationObserver;
        if (obs && typeof obs.disconnect === 'function') {
            try { obs.disconnect(); } catch(e) {}
        }
        this.filters.achromatopsia.mutationObserver = null;
        
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
        // Vérifier si le filtre est actif et si l'observer est bien actif
        if (!this.activeFilters.has('achromatopsia')) return;
        if (!this.isAchroObserverActive()) return;
        
        if (this._contrastAuditScheduled) return;
        
        this._contrastAuditScheduled = true;
        requestAnimationFrame(() => {
            this._contrastAuditScheduled = false;
            // Double vérification avant l'exécution
            if (!this.activeFilters.has('achromatopsia') || !this.isAchroObserverActive()) return;
            this.auditAchromatopsiaTextContrast();
        });
    }
    
    auditAchromatopsiaTextContrast() {
        const selectors = [
            'p','span','a','li','label','small','em','strong','code','pre',
            'button','input[type="button"]','input[type="submit"]','textarea',
            'h1','h2','h3','h4','h5','h6',
            '.status','.nav-link','.box'
        ].join(',');

        const nodes = document.body.querySelectorAll(selectors);
        
        // Paramètres du filtre
        const filter = this.filters.achromatopsia;
        const { brightnessFactor } = this.getPhotophobiaSettings(filter.photophobiaLevel);
        const effectiveBrightness = Math.max(0.6, Math.min(1.2, filter.brightness * brightnessFactor));
        const effectiveContrast = filter.contrast;
        
        nodes.forEach(el => {
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

            // Simuler l'effet du filtre sur le fond
            const adjustedBgRGB = this.applyFilterToColor(bgRGB, effectiveContrast, effectiveBrightness);
            const Lbg = this.relativeLuminance(adjustedBgRGB);

            const fontSizePx = parseFloat(cs.fontSize) || 16;
            const fontWeight = parseInt(cs.fontWeight || '400', 10);
            const isBold = fontWeight >= 700;
            const isLarge = (fontSizePx >= 24) || (fontSizePx >= 18.66 && isBold);
            const target = isLarge ? 3.0 : 4.5;

            // Tester noir vs blanc en tenant compte du filtre
            const black = [0, 0, 0];
            const white = [255, 255, 255];
            
            const adjustedBlack = this.applyFilterToColor(black, effectiveContrast, effectiveBrightness);
            const adjustedWhite = this.applyFilterToColor(white, effectiveContrast, effectiveBrightness);
            
            const blackRatio = this.contrastRatio(this.relativeLuminance(adjustedBlack), Lbg);
            const whiteRatio = this.contrastRatio(this.relativeLuminance(adjustedWhite), Lbg);
            
            // Si aucun des deux n'atteint le seuil, choisir le meilleur disponible
            const bestColor = blackRatio >= whiteRatio ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)';
            const bestRatio = Math.max(blackRatio, whiteRatio);

            // Vérifier le contraste actuel
            const curRGB = this.parseRGB(cs.color);
            const adjustedCurRGB = curRGB ? this.applyFilterToColor(curRGB, effectiveContrast, effectiveBrightness) : null;
            const curRatio = adjustedCurRGB ? this.contrastRatio(this.relativeLuminance(adjustedCurRGB), Lbg) : 0;

            if (curRatio < target && bestRatio >= target) {
                // Appliquer la correction
                el.style.setProperty('color', bestColor, 'important');
                el.dataset.achroTextOverride = '1';
            } else if (curRatio < target && bestRatio < target) {
                // Même le meilleur choix ne suffit pas → ajouter un halo
                el.style.setProperty('color', bestColor, 'important');
                el.style.setProperty('text-shadow', '0 0 3px rgba(128,128,128,0.8)', 'important');
                el.dataset.achroTextOverride = '1';
            } else {
                // Contraste suffisant: tenter de restaurer
                if (el.dataset.achroTextOverride === '1') {
                    const orig = el.dataset.achroOrigColor;
                    if (orig) {
                        const origRGB = this.parseRGB(orig);
                        if (origRGB) {
                            const adjustedOrigRGB = this.applyFilterToColor(origRGB, effectiveContrast, effectiveBrightness);
                            const origRatio = this.contrastRatio(this.relativeLuminance(adjustedOrigRGB), Lbg);
                            if (origRatio >= target) {
                                el.style.removeProperty('color');
                                el.style.removeProperty('text-shadow');
                                delete el.dataset.achroTextOverride;
                                delete el.dataset.achroOrigColor;
                            }
                        }
                    }
                }
            }
        });
    }

    // Simuler l'effet du filtre CSS sur une couleur
    applyFilterToColor(rgb, contrast, brightness) {
        let [r, g, b] = rgb;
        
        // Convertir en niveaux de gris (grayscale(1))
        const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        
        // Appliquer le contraste autour de 0.5
        let adjusted = ((gray / 255 - 0.5) * contrast + 0.5) * 255;
        
        // Appliquer la luminosité
        adjusted = adjusted * brightness;
        
        // Clamp
        adjusted = Math.max(0, Math.min(255, adjusted));
        
        return [adjusted, adjusted, adjusted];
    }
    
    clearAchromatopsiaTextOverrides() {
        // Nettoyer toutes les corrections
        const overridden = document.querySelectorAll('[data-achro-text-override="1"]');
        overridden.forEach(el => {
            el.style.removeProperty('color');
            el.style.removeProperty('text-shadow');
            delete el.dataset.achroTextOverride;
        });
        
        // Nettoyer aussi les couleurs originales mémorisées
        const withOrigColors = document.querySelectorAll('[data-achro-orig-color]');
        withOrigColors.forEach(el => {
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

        // Ensure expanded state ARIA is synced if class changed elsewhere
        if (el.header && el.details) {
            const expanded = el.item.classList.contains('expanded') ? 'true' : 'false';
            el.header.setAttribute('aria-expanded', expanded);
            el.details.setAttribute('aria-hidden', expanded === 'true' ? 'false' : 'true');
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
        // Ne pas sauvegarder les propriétés runtime (mutationObserver)
        const sanitizedFilters = {};
        Object.keys(this.filters).forEach(name => {
            const { mutationObserver, ...rest } = this.filters[name];
            sanitizedFilters[name] = { ...rest };
        });

        const settings = {
            activeFilters: Array.from(this.activeFilters),
            filters: sanitizedFilters,
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

                // MIGRATION: retirer toute trace de mutationObserver éventuellement stockée
                if (settings.filters?.achromatopsia && 'mutationObserver' in settings.filters.achromatopsia) {
                    delete settings.filters.achromatopsia.mutationObserver;
                }
                
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

                // Assainir mutationObserver
                this.filters.achromatopsia.mutationObserver = null;
            }
        } catch (error) {
            console.warn('Impossible de charger les paramètres:', error);
            // En cas d'erreur, nettoyer le localStorage
            localStorage.removeItem(this.storageKey);
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
            filters: JSON.parse(JSON.stringify(this.filters, (key, value) => {
                // Ne jamais exposer/sérialiser l'observer
                if (key === 'mutationObserver') return null;
                return value;
            }))
        };
    }
    
    setState(state) {
        if (state.activeFilters && Array.isArray(state.activeFilters)) {
            this.activeFilters = new Set(state.activeFilters);
        }
        
        if (state.filters) {
            Object.keys(state.filters).forEach(filterName => {
                if (this.filters[filterName]) {
                    const { mutationObserver, ...rest } = state.filters[filterName];
                    Object.assign(this.filters[filterName], rest);
                }
            });
        }

        // Toujours remettre l'observer achromatopsie à null avant d'éventuellement le redémarrer
        this.filters.achromatopsia.mutationObserver = null;
        
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
