/**
 * Gestor de interfaz de usuario para la aplicación móvil
 * Maneja las interacciones y actualizaciones de la UI
 */

class UIManager {
    constructor() {
        this.currentSection = 'search';
        this.currentList = [];
        this.searchResults = [];
        this.isLoading = false;
        
        // Cargar lista guardada al inicializar
        this.loadSavedList();
        
        // Referencias a elementos DOM
        this.elements = {};
        
        // Configuración de toast
        this.toastTimeout = null;
    }

    /**
     * Inicializa la interfaz de usuario
     */
    initialize() {
        this.cacheElements();
        this.bindEvents();
        this.updateUI();
        
        console.log('✅ UI Manager inicializado');
    }

    /**
     * Cachea referencias a elementos DOM
     */
    cacheElements() {
        this.elements = {
            // Loading
            loadingScreen: document.getElementById('loadingScreen'),
            mainContent: document.getElementById('mainContent'),
            loadingText: document.getElementById('loadingText'),
            progressFill: document.getElementById('progressFill'),
            
            // Status
            syncStatus: document.getElementById('syncStatus'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            
            // Search
            codeInput: document.getElementById('codeInput'),
            descriptionInput: document.getElementById('descriptionInput'),
            searchInput: document.getElementById('searchInput'), // Campo único (compatibilidad)
            smartSearchBtn: document.getElementById('smartSearchBtn'),
            scanBtn: document.getElementById('scanBtn'),
            searchStats: document.getElementById('searchStats'),
            productsCount: document.getElementById('productsCount'),
            
            // Results
            resultsSection: document.getElementById('resultsSection'),
            resultsTitle: document.getElementById('resultsTitle'),
            resultsList: document.getElementById('resultsList'),
            clearResults: document.getElementById('clearResults'),
            
            // List
            listCount: document.getElementById('listCount'),
            listContent: document.getElementById('listContent'),
            clearListBtn: document.getElementById('clearListBtn'),
            generateCodeBtn: document.getElementById('generateCodeBtn'),
            
            // Modal
            codeModal: document.getElementById('codeModal'),
            closeModal: document.getElementById('closeModal'),
            generatedCode: document.getElementById('generatedCode'),
            modalListName: document.getElementById('modalListName'),
            modalProductCount: document.getElementById('modalProductCount'),
            modalExpiration: document.getElementById('modalExpiration'),
            copyCodeBtn: document.getElementById('copyCodeBtn'),
            shareCodeBtn: document.getElementById('shareCodeBtn'),
            clearListAfterCodeBtn: document.getElementById('clearListAfterCodeBtn'),
            
            // Navigation
            navBtns: document.querySelectorAll('.nav-btn'),
            navBadge: document.getElementById('navBadge'),
            
            // Toast
            toastContainer: document.getElementById('toastContainer')
        };
    }

    /**
     * Vincula eventos a elementos DOM
     */
    bindEvents() {
        // Search events
        this.elements.smartSearchBtn.addEventListener('click', () => this.performSmartSearch());
        this.elements.scanBtn.addEventListener('click', () => this.openScanner());
        
        // Eventos de teclado para búsqueda inteligente
        this.elements.codeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSmartSearch();
            }
        });
        
        this.elements.descriptionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSmartSearch();
            }
        });
        
        // Compatibilidad con campo único
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });
        }
        
        // Results events
        this.elements.clearResults.addEventListener('click', () => this.clearSearchResults());
        
        // List events
        this.elements.clearListBtn.addEventListener('click', () => this.clearCurrentList());
        this.elements.generateCodeBtn.addEventListener('click', () => this.generateCode());
        
        // Modal events
        this.elements.closeModal.addEventListener('click', () => this.hideModal());
        this.elements.copyCodeBtn.addEventListener('click', () => this.copyCode());
        this.elements.shareCodeBtn.addEventListener('click', () => this.shareCode());
        this.elements.clearListAfterCodeBtn.addEventListener('click', () => this.clearListAfterCode());
        
        // Navigation events
        this.elements.navBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.switchSection(section);
            });
        });
        
        // Modal backdrop click
        this.elements.codeModal.addEventListener('click', (e) => {
            if (e.target === this.elements.codeModal) {
                this.hideModal();
            }
        });
        
        // Prevent zoom on double tap
        document.addEventListener('touchend', (e) => {
            const now = new Date().getTime();
            const timeSince = now - this.lastTouchEnd;
            if (timeSince < 300 && timeSince > 0) {
                e.preventDefault();
            }
            this.lastTouchEnd = now;
        });
        
        // Control de scroll para header
        window.addEventListener('scroll', () => this.handleScroll());
        
        // Prevenir comportamientos del navegador móvil
        this.preventMobileBrowserBehaviors();
    }

    /**
     * Previene comportamientos no deseados del navegador móvil
     */
    preventMobileBrowserBehaviors() {
        // Prevenir pull-to-refresh
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });

        // Prevenir zoom con gestos
        document.addEventListener('gesturestart', (e) => {
            e.preventDefault();
        });

        // Prevenir scroll bounce en iOS
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });

        // Prevenir que aparezcan controles del navegador al hacer scroll
        let lastScrollY = window.scrollY;
        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            
            // Si el scroll es hacia arriba desde el top, prevenir
            if (currentScrollY <= 0 && lastScrollY <= 0) {
                window.scrollTo(0, 1);
            }
            
            lastScrollY = currentScrollY;
        });
    }

    /**
     * Maneja el scroll para ocultar/mostrar el header
     */
    handleScroll() {
        const currentScrollY = window.scrollY;
        const header = this.elements.mainHeader;
        
        if (!header) return;
        
        // Si estamos cerca del top (primeros 30px), mostrar header
        if (currentScrollY < 30) {
            header.classList.remove('hidden', 'compact');
        }
        // Si hemos hecho scroll hacia abajo, ocultar header completamente
        else if (currentScrollY > this.lastScrollY && currentScrollY > 20) {
            header.classList.add('hidden');
            header.classList.remove('compact');
        }
        // Si hemos hecho scroll hacia arriba significativo, mostrar header
        else if (currentScrollY < this.lastScrollY && Math.abs(currentScrollY - this.lastScrollY) > 10) {
            header.classList.remove('hidden', 'compact');
        }
        
        this.lastScrollY = currentScrollY;
    }

    /**
     * Actualiza la interfaz de usuario
     */
    updateUI() {
        this.updateListCounter();
        this.updateNavBadge();
        this.updateGenerateButton();
    }

    /**
     * Muestra la pantalla de carga
     */
    showLoading(text = 'Cargando...') {
        if (this.elements.loadingText) {
            this.elements.loadingText.textContent = text;
        }
        if (this.elements.loadingScreen) {
            this.elements.loadingScreen.style.display = 'flex';
        }
        if (this.elements.mainContent) {
            this.elements.mainContent.style.display = 'none';
        }
        this.isLoading = true;
    }

    /**
     * Oculta la pantalla de carga
     */
    hideLoading() {
        if (this.elements.loadingScreen) {
            this.elements.loadingScreen.style.display = 'none';
        }
        if (this.elements.mainContent) {
            this.elements.mainContent.style.display = 'block';
        }
        this.isLoading = false;
    }

    /**
     * Actualiza el progreso de carga
     */
    updateProgress(progress, text = null) {
        const percentage = Math.min(100, Math.max(0, progress * 100));
        if (this.elements.progressFill) {
            this.elements.progressFill.style.width = `${percentage}%`;
        }
        
        if (text && this.elements.loadingText) {
            this.elements.loadingText.textContent = text;
        }
    }

    /**
     * Actualiza el estado de sincronización
     */
    updateSyncStatus(status, text) {
        const indicators = {
            'connecting': '🔄',
            'connected': '🟢',
            'offline': '🔴',
            'syncing': '⚡',
            'error': '❌'
        };

        if (this.elements.statusIndicator) {
            this.elements.statusIndicator.textContent = indicators[status] || '⚪';
        }
        if (this.elements.statusText) {
            this.elements.statusText.textContent = text;
        }
    }

    /**
     * Actualiza el contador de productos
     */
    updateProductsCount(count) {
        if (this.elements.productsCount) {
            this.elements.productsCount.textContent = `${count.toLocaleString()} productos cargados`;
        }
    }

    /**
     * Realiza una búsqueda
     */
    /**
     * Búsqueda inteligente que detecta automáticamente el tipo de búsqueda
     */
    async performSmartSearch() {
        const codeQuery = this.elements.codeInput ? this.elements.codeInput.value.trim() : '';
        const descriptionQuery = this.elements.descriptionInput ? this.elements.descriptionInput.value.trim() : '';
        
        // Validar que al menos uno de los campos tenga contenido
        if (!codeQuery && !descriptionQuery) {
            this.showToast('Ingrese código o descripción para buscar', 'warning');
            return;
        }
        
        if (codeQuery && codeQuery.length < 2) {
            this.showToast('El código debe tener al menos 2 caracteres', 'warning');
            return;
        }
        
        if (descriptionQuery && descriptionQuery.length < 2) {
            this.showToast('La descripción debe tener al menos 2 caracteres', 'warning');
            return;
        }

        try {
            this.updateSyncStatus('syncing', 'Buscando...');
            
            // Realizar búsqueda optimizada de dos pasos
            const results = await window.storageManager.searchProducts(codeQuery, descriptionQuery, 50);
            
            this.searchResults = results;
            
            // Crear descripción de búsqueda para mostrar
            let searchDescription = '';
            if (codeQuery && descriptionQuery) {
                searchDescription = `"${codeQuery}" + "${descriptionQuery}"`;
            } else if (codeQuery) {
                searchDescription = `código "${codeQuery}"`;
            } else {
                searchDescription = `"${descriptionQuery}"`;
            }
            
            this.displaySearchResults(results, searchDescription);
            
            this.updateSyncStatus('connected', 'Conectado');
            
        } catch (error) {
            console.error('Error en búsqueda inteligente:', error);
            this.showToast('Error al buscar productos', 'error');
            this.updateSyncStatus('error', 'Error en búsqueda');
        }
    }

    /**
     * Búsqueda con campo único (compatibilidad)
     */
    async performSearch() {
        const query = this.elements.searchInput.value.trim();
        
        if (!query) {
            this.showToast('Ingrese un término de búsqueda', 'warning');
            return;
        }
        
        if (query.length < 2) {
            this.showToast('Ingrese al menos 2 caracteres', 'warning');
            return;
        }
        
        try {
            this.updateSyncStatus('syncing', 'Buscando...');
            
            // Usar búsqueda optimizada pasando el query como código
            const results = await window.storageManager.searchProducts(query, '', 50);
            
            this.searchResults = results;
            this.displaySearchResults(results, query);
            
            this.updateSyncStatus('connected', 'Conectado');
            
        } catch (error) {
            console.error('Error en búsqueda:', error);
            this.showToast('Error al buscar productos', 'error');
            this.updateSyncStatus('error', 'Error en búsqueda');
        }
    }

    /**
     * Búsqueda silenciosa (sin cambiar estado)
     */
    async performSearchSilent(query) {
        try {
            const results = await window.storageManager.searchProducts(query, 20);
            this.searchResults = results;
            this.displaySearchResults(results, query);
        } catch (error) {
            console.error('Error en búsqueda silenciosa:', error);
        }
    }

    /**
     * Muestra los resultados de búsqueda (optimizado)
     */
    displaySearchResults(results, query) {
        if (results.length === 0) {
            this.elements.resultsSection.style.display = 'none';
            this.showToast(`No se encontraron productos para "${query}"`, 'warning');
            return;
        }

        this.elements.resultsTitle.textContent = `${results.length} resultado${results.length !== 1 ? 's' : ''} para "${query}"`;
        this.elements.resultsSection.style.display = 'block';

        // Limpiar resultados anteriores
        this.elements.resultsList.innerHTML = '';

        // Mostrar resultados SIN imágenes primero (más rápido)
        results.forEach((product, index) => {
            const productCard = this.createProductCardWithoutImage(product, index);
            this.elements.resultsList.appendChild(productCard);
        });

        // Scroll a resultados
        this.elements.resultsSection.scrollIntoView({ behavior: 'smooth' });

        // Cargar imágenes después de mostrar los resultados (lazy loading)
        setTimeout(() => {
            this.loadImagesLazily();
        }, 100);
    }

    /**
     * Crea una tarjeta de producto SIN imagen (más rápido)
     */
    createProductCardWithoutImage(product, index) {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.productIndex = index;
        
        // Calcular precio con IVA (21%)
        const precioConIva = product.pvp * 1.21;
        
        // Determinar texto del match
        let matchInfo = '';
        if (product.matchType === 'codigo_secundario') {
            matchInfo = `<small style="color: var(--text-secondary);">Código secundario: ${product.codigoSecundario}</small>`;
        }

        card.innerHTML = `
            <div class="product-card-content">
                <div class="product-image-container">
                    <div class="product-image-placeholder">
                        <span class="placeholder-icon">📦</span>
                    </div>
                </div>
                <div class="product-info">
                    <div class="product-header">
                        <span class="product-code">${product.codigo}</span>
                        <span class="product-price">${precioConIva.toFixed(2)}€</span>
                    </div>
                    <div class="product-description">${product.descripcion}</div>
                    ${matchInfo}
                    <div class="product-actions">
                        <button class="add-btn" onclick="ui.addProductToList('${product.codigo}')">
                            ➕ Añadir a lista
                        </button>
                    </div>
                </div>
            </div>
        `;

        return card;
    }

    /**
     * Carga imágenes de forma diferida
     */
    loadImagesLazily() {
        const productCards = this.elements.resultsList.querySelectorAll('.product-card');
        
        productCards.forEach((card, index) => {
            const productIndex = parseInt(card.dataset.productIndex);
            const product = this.searchResults[productIndex];
            
            if (product) {
                const imageContainer = card.querySelector('.product-image-container');
                const placeholder = card.querySelector('.product-image-placeholder');
                
                // Crear imagen
                const img = document.createElement('img');
                img.src = `https://www.saneamiento-martinez.com/imagenes/articulos/${product.codigo}_1.JPG`;
                img.alt = `Imagen de ${product.descripcion}`;
                img.className = 'product-image';
                img.style.display = 'none';
                
                img.onload = () => {
                    img.style.display = 'block';
                    placeholder.style.display = 'none';
                };
                
                img.onerror = () => {
                    img.style.display = 'none';
                    placeholder.style.display = 'flex';
                };
                
                imageContainer.appendChild(img);
            }
        });
    }

    /**
     * Guarda la lista actual en localStorage
     */
    saveList() {
        try {
            localStorage.setItem('mobile_web_app_list', JSON.stringify(this.currentList));
            console.log('💾 Lista guardada en localStorage');
        } catch (error) {
            console.error('❌ Error guardando lista:', error);
        }
    }

    /**
     * Carga la lista guardada desde localStorage
     */
    loadSavedList() {
        try {
            const savedList = localStorage.getItem('mobile_web_app_list');
            if (savedList) {
                this.currentList = JSON.parse(savedList);
                console.log('📂 Lista cargada desde localStorage:', this.currentList.length, 'productos');
                
                // Actualizar UI si hay productos
                if (this.currentList.length > 0) {
                    this.updateUI();
                }
            }
        } catch (error) {
            console.error('❌ Error cargando lista guardada:', error);
            this.currentList = [];
        }
    }

    /**
     * Limpia la lista guardada
     */
    clearSavedList() {
        try {
            localStorage.removeItem('mobile_web_app_list');
            console.log('🗑️ Lista guardada eliminada');
        } catch (error) {
            console.error('❌ Error eliminando lista guardada:', error);
        }
    }

    /**
     * Añade un producto a la lista actual
     */
    async addProductToList(codigo) {
        try {
            // Buscar el producto en los resultados o en almacenamiento
            let product = this.searchResults.find(p => p.codigo === codigo);
            
            if (!product) {
                // Buscar en almacenamiento local
                const productos = await window.storageManager.getProducts();
                product = productos.find(p => p.codigo === codigo);
            }

            if (!product) {
                this.showToast('Producto no encontrado', 'error');
                return;
            }

            // Verificar si ya está en la lista
            const existingIndex = this.currentList.findIndex(item => item.codigo === codigo);

            if (existingIndex >= 0) {
                // Incrementar cantidad
                this.currentList[existingIndex].cantidad++;
                this.showToast(`Cantidad actualizada: ${this.currentList[existingIndex].cantidad}`, 'success');
            } else {
                // Añadir nuevo producto
                this.currentList.push({
                    codigo: product.codigo,
                    descripcion: product.descripcion,
                    pvp: product.pvp,
                    cantidad: 1
                });
                this.showToast('Producto añadido a la lista', 'success');
            }
            
            // Guardar lista automáticamente
            this.saveList();

            this.updateCurrentListDisplay();
            this.updateUI();

        } catch (error) {
            console.error('Error al añadir producto:', error);
            this.showToast('Error al añadir producto', 'error');
        }
    }

    /**
     * Actualiza la visualización de la lista actual
     */
    updateCurrentListDisplay() {
        if (this.currentList.length === 0) {
            this.elements.listContent.innerHTML = `
                <div class="empty-list">
                    <p>🔍 Busca productos y añádelos a tu lista</p>
                </div>
            `;
            return;
        }

        let totalProductos = 0;
        let totalPrecio = 0;

        const listHTML = this.currentList.map((item, index) => {
            const precioConIva = item.pvp * 1.21;
            const subtotal = precioConIva * item.cantidad;
            
            totalProductos += item.cantidad;
            totalPrecio += subtotal;

            // URL de la imagen del producto
            const imageUrl = `https://www.saneamiento-martinez.com/imagenes/articulos/${item.codigo}_1.JPG`;

            return `
                <div class="list-item">
                    <div class="list-item-image-container">
                        <img 
                            src="${imageUrl}" 
                            alt="Imagen de ${item.descripcion}"
                            class="list-item-image"
                            loading="lazy"
                            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                        >
                        <div class="list-item-image-placeholder" style="display: none;">
                            <span class="placeholder-icon-small">📦</span>
                        </div>
                    </div>
                    <div class="list-item-info">
                        <div class="list-item-code">${item.codigo}</div>
                        <div class="list-item-description">${item.descripcion}</div>
                        <div class="list-item-price">${precioConIva.toFixed(2)}€ × ${item.cantidad} = ${subtotal.toFixed(2)}€</div>
                    </div>
                    <div class="list-item-actions">
                        <div class="quantity-controls">
                            <button class="quantity-btn" onclick="ui.changeQuantity(${index}, -1)">−</button>
                            <span class="quantity-display">${item.cantidad}</span>
                            <button class="quantity-btn" onclick="ui.changeQuantity(${index}, 1)">+</button>
                        </div>
                        <button class="remove-btn" onclick="ui.removeFromList(${index})" title="Eliminar">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');

        const summaryHTML = `
            <div class="list-summary" style="margin-top: 1rem; padding: 1rem; background: var(--background); border-radius: 0.5rem; border: 2px solid var(--primary-color);">
                <div style="display: flex; justify-content: space-between; font-weight: 600;">
                    <span>Total productos: ${totalProductos}</span>
                    <span>Total: ${totalPrecio.toFixed(2)}€</span>
                </div>
            </div>
        `;

        this.elements.listContent.innerHTML = listHTML + summaryHTML;
    }

    /**
     * Cambia la cantidad de un producto en la lista
     */
    changeQuantity(index, delta) {
        if (index < 0 || index >= this.currentList.length) return;

        this.currentList[index].cantidad += delta;

        if (this.currentList[index].cantidad <= 0) {
            this.removeFromList(index);
        } else {
            this.updateCurrentListDisplay();
            this.updateUI();
            // Guardar lista automáticamente
            this.saveList();
        }
    }

    /**
     * Elimina un producto de la lista
     */
    removeFromList(index) {
        if (index < 0 || index >= this.currentList.length) return;

        const product = this.currentList[index];
        this.currentList.splice(index, 1);
        
        this.showToast(`${product.descripcion} eliminado`, 'success');
        this.updateCurrentListDisplay();
        this.updateUI();
        
        // Guardar lista automáticamente
        this.saveList();
    }

    /**
     * Limpia los resultados de búsqueda
     */
    clearSearchResults() {
        this.elements.resultsSection.style.display = 'none';
        this.elements.searchInput.value = '';
        this.searchResults = [];
    }

    /**
     * Limpia la lista actual
     */
    clearCurrentList() {
        if (this.currentList.length === 0) return;

        if (confirm('¿Está seguro de que desea limpiar toda la lista?')) {
            this.currentList = [];
            this.updateCurrentListDisplay();
            this.updateUI();
            this.showToast('Lista limpiada', 'success');
            
            // Limpiar lista guardada también
            this.clearSavedList();
        }
    }

    /**
     * Actualiza el contador de la lista
     */
    updateListCounter() {
        const count = this.currentList.length;
        this.elements.listCount.textContent = `(${count} producto${count !== 1 ? 's' : ''})`;
    }

    /**
     * Actualiza el badge de navegación
     */
    updateNavBadge() {
        const count = this.currentList.length;
        if (count > 0) {
            this.elements.navBadge.textContent = count;
            this.elements.navBadge.style.display = 'block';
        } else {
            this.elements.navBadge.style.display = 'none';
        }
    }

    /**
     * Actualiza el botón de generar código
     */
    updateGenerateButton() {
        const hasProducts = this.currentList.length > 0;
        this.elements.generateCodeBtn.disabled = !hasProducts;
    }

    /**
     * Genera código para la lista actual
     */
    async generateCode() {
        if (this.currentList.length === 0) {
            this.showToast('No hay productos en la lista', 'warning');
            return;
        }

        try {
            this.updateSyncStatus('syncing', 'Generando código...');
            
            // Preparar datos de la lista
            const listData = {
                nombre: `Lista ${new Date().toLocaleDateString()}`,
                usuario: 'Usuario Móvil',
                productos: this.currentList.map(item => ({
                    codigo: item.codigo,
                    cantidad: item.cantidad
                }))
            };

            // Subir a Supabase
            const result = await window.supabaseClient.uploadTemporaryList(listData);
            
            // Mostrar modal con el código
            this.showCodeModal(result, listData);
            
            // NO limpiar lista actual - mantenerla para que el usuario pueda seguir trabajando
            // this.currentList = [];
            // this.updateCurrentListDisplay();
            // this.updateUI();
            
            this.updateSyncStatus('connected', 'Conectado');
            this.showToast('Código generado exitosamente', 'success');

        } catch (error) {
            console.error('Error al generar código:', error);
            this.showToast('Error al generar código: ' + error.message, 'error');
            this.updateSyncStatus('error', 'Error al generar código');
        }
    }

    /**
     * Muestra el modal con el código generado
     */
    showCodeModal(result, listData) {
        this.elements.generatedCode.textContent = result.codigo;
        this.elements.modalListName.textContent = listData.nombre;
        this.elements.modalProductCount.textContent = `${listData.productos.length} productos`;
        this.elements.modalExpiration.textContent = result.fechaExpiracion.toLocaleString();
        
        // Generar código de barras
        this.generateBarcode(result.codigo);
        
        this.elements.codeModal.style.display = 'flex';
        
        // Guardar código para compartir
        this.currentGeneratedCode = result.codigo;
    }

    /**
     * Genera un código de barras para el código dado
     */
    generateBarcode(code) {
        try {
            // Verificar que JsBarcode esté disponible
            if (typeof JsBarcode === 'undefined') {
                console.warn('JsBarcode no está disponible');
                return;
            }
            
            const barcodeElement = document.getElementById('barcode');
            if (!barcodeElement) {
                console.warn('Elemento barcode no encontrado');
                return;
            }
            
            // Generar código de barras CODE128 (compatible con la mayoría de lectores)
            JsBarcode(barcodeElement, code, {
                format: "CODE128",
                width: 2,
                height: 60,
                displayValue: true,
                fontSize: 14,
                margin: 10,
                background: "#ffffff",
                lineColor: "#000000"
            });
            
            console.log(`✅ Código de barras generado para: ${code}`);
            
        } catch (error) {
            console.error('Error generando código de barras:', error);
            // Ocultar el contenedor si hay error
            const barcodeContainer = document.querySelector('.barcode-container');
            if (barcodeContainer) {
                barcodeContainer.style.display = 'none';
            }
        }
    }

    /**
     * Oculta el modal
     */
    hideModal() {
        this.elements.codeModal.style.display = 'none';
        this.currentGeneratedCode = null;
    }

    /**
     * Copia el código al portapapeles
     */
    async copyCode() {
        if (!this.currentGeneratedCode) return;

        try {
            await navigator.clipboard.writeText(this.currentGeneratedCode);
            this.showToast('Código copiado al portapapeles', 'success');
        } catch (error) {
            console.error('Error al copiar:', error);
            this.showToast('Error al copiar código', 'error');
        }
    }

    /**
     * Comparte el código
     */
    async shareCode() {
        if (!this.currentGeneratedCode) return;

        const shareData = {
            title: 'Código de Lista - Labels Productos',
            text: `Mi código de lista es: ${this.currentGeneratedCode}`,
            url: window.location.href
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                // Fallback: copiar al portapapeles
                await this.copyCode();
            }
        } catch (error) {
            console.error('Error al compartir:', error);
            this.showToast('Error al compartir código', 'error');
        }
    }

    /**
     * Limpia la lista después de generar el código
     */
    clearListAfterCode() {
        if (confirm('¿Desea limpiar la lista actual? Esta acción no se puede deshacer.')) {
            this.currentList = [];
            this.updateCurrentListDisplay();
            this.updateUI();
            this.hideModal();
            this.showToast('Lista limpiada', 'success');
        }
    }

    /**
     * Cambia de sección
     */
    switchSection(section) {
        // Actualizar navegación
        this.elements.navBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === section);
        });

        this.currentSection = section;
        
        // Manejar navegación entre secciones
        if (section === 'search') {
            // Scroll a la sección de búsqueda
            this.elements.searchInput.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Enfocar el campo de búsqueda
            this.elements.searchInput.focus();
        } else if (section === 'list') {
            // Scroll a la sección de lista
            this.elements.listContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Mostrar feedback si la lista está vacía
            if (this.currentList.length === 0) {
                this.showToast('La lista está vacía. Busca productos para añadir.', 'info');
            } else {
                this.showToast(`${this.currentList.length} producto${this.currentList.length !== 1 ? 's' : ''} en tu lista`, 'success');
            }
        }
    }

    /**
     * Muestra una notificación toast
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        this.elements.toastContainer.appendChild(toast);

        // Auto-remove
        setTimeout(() => {
            toast.remove();
        }, duration);
    }

    /**
     * Abre el escáner de códigos de barras
     */
    async openScanner() {
        try {
            if (window.barcodeScanner) {
                await window.barcodeScanner.openScanner();
            } else {
                this.showToast('Escáner no disponible', 'error');
            }
        } catch (error) {
            console.error('Error al abrir escáner:', error);
            this.showToast('Error al abrir escáner: ' + error.message, 'error');
        }
    }

    /**
     * Maneja errores de la aplicación
     */
    handleError(error, context = '') {
        console.error(`Error ${context}:`, error);
        
        let message = 'Ha ocurrido un error';
        if (error.message) {
            message = error.message;
        }
        
        this.showToast(message, 'error');
        this.updateSyncStatus('error', 'Error');
    }
}

// Instancia global del gestor de UI
window.ui = new UIManager();
