/**
 * Gestor de almacenamiento local para la aplicación móvil
 * Maneja la persistencia de datos y configuración
 */

class StorageManager {
    constructor() {
        this.dbName = 'LabelsProductosDB';
        this.dbVersion = 1;
        this.db = null;
        
        // Configuración por defecto
        this.defaultConfig = {
            supabaseUrl: '',
            supabaseKey: '',
            lastSync: null,
            autoSync: true,
            offlineMode: false
        };
    }

    /**
     * Inicializa la base de datos IndexedDB
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Error al abrir IndexedDB');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB inicializada');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Crear almacén de productos
                if (!db.objectStoreNames.contains('productos')) {
                    const productosStore = db.createObjectStore('productos', { keyPath: 'codigo' });
                    productosStore.createIndex('descripcion', 'descripcion', { unique: false });
                    productosStore.createIndex('pvp', 'pvp', { unique: false });
                }

                // Crear almacén de códigos secundarios
                if (!db.objectStoreNames.contains('codigos_secundarios')) {
                    const codigosStore = db.createObjectStore('codigos_secundarios', { keyPath: 'codigo_secundario' });
                    codigosStore.createIndex('codigo_principal', 'codigo_principal', { unique: false });
                    codigosStore.createIndex('descripcion', 'descripcion', { unique: false });
                }

                // Crear almacén de configuración
                if (!db.objectStoreNames.contains('config')) {
                    db.createObjectStore('config', { keyPath: 'key' });
                }

                // Crear almacén de listas locales
                if (!db.objectStoreNames.contains('listas_locales')) {
                    const listasStore = db.createObjectStore('listas_locales', { keyPath: 'id', autoIncrement: true });
                    listasStore.createIndex('fecha_creacion', 'fecha_creacion', { unique: false });
                    listasStore.createIndex('nombre', 'nombre', { unique: false });
                }

                console.log('🔧 Base de datos actualizada');
            };
        });
    }

    /**
     * Guarda productos en el almacenamiento local
     */
    async saveProducts(productos) {
        try {
            const transaction = this.db.transaction(['productos'], 'readwrite');
            const store = transaction.objectStore('productos');

            // Limpiar productos existentes
            await store.clear();

            // Insertar nuevos productos
            for (const producto of productos) {
                await store.add(producto);
            }

            await this.waitForTransaction(transaction);
            console.log(`✅ Guardados ${productos.length} productos localmente`);
        } catch (error) {
            console.error('❌ Error al guardar productos:', error);
            throw error;
        }
    }

    /**
     * Guarda códigos secundarios en el almacenamiento local
     */
    async saveSecondaryCodes(codigos) {
        try {
            const transaction = this.db.transaction(['codigos_secundarios'], 'readwrite');
            const store = transaction.objectStore('codigos_secundarios');

            // Limpiar códigos existentes
            await store.clear();

            // Insertar nuevos códigos
            for (const codigo of codigos) {
                await store.add(codigo);
            }

            await this.waitForTransaction(transaction);
            console.log(`✅ Guardados ${codigos.length} códigos secundarios localmente`);
        } catch (error) {
            console.error('❌ Error al guardar códigos secundarios:', error);
            throw error;
        }
    }

    /**
     * Obtiene todos los productos del almacenamiento local
     */
    async getProducts() {
        try {
            const transaction = this.db.transaction(['productos'], 'readonly');
            const store = transaction.objectStore('productos');
            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('❌ Error al obtener productos:', error);
            return [];
        }
    }

    /**
     * Obtiene todos los códigos secundarios del almacenamiento local
     */
    async getSecondaryCodes() {
        try {
            const transaction = this.db.transaction(['codigos_secundarios'], 'readonly');
            const store = transaction.objectStore('codigos_secundarios');
            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('❌ Error al obtener códigos secundarios:', error);
            return [];
        }
    }

    /**
     * Normaliza texto para búsqueda (elimina acentos, espacios extra, etc.)
     */
    normalizeText(text) {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
            .replace(/\s+/g, ' ') // Normalizar espacios
            .trim();
    }

    /**
     * Divide una consulta en palabras clave
     */
    parseQuery(query) {
        const normalized = this.normalizeText(query);
        return normalized.split(/\s+/).filter(word => word.length > 0);
    }

    /**
     * Calcula la relevancia de un resultado (versión optimizada)
     */
    calculateRelevance(producto, queryWords, codigoSecundario = null) {
        let score = 0;
        const codigoNormalizado = this.normalizeText(producto.codigo);
        const descripcionNormalizada = this.normalizeText(producto.descripcion);
        
        // Verificar que TODAS las palabras estén presentes
        let allWordsFound = true;
        let wordsFoundInCode = 0;
        let wordsFoundInDescription = 0;
        
        for (const word of queryWords) {
            const foundInCode = codigoNormalizado.includes(word);
            const foundInDescription = descripcionNormalizada.includes(word);
            
            if (foundInCode) wordsFoundInCode++;
            if (foundInDescription) wordsFoundInDescription++;
            
            // Si una palabra no se encuentra en ningún lado, descartar el producto
            if (!foundInCode && !foundInDescription) {
                allWordsFound = false;
                break;
            }
        }
        
        // Solo calcular score si todas las palabras están presentes
        if (!allWordsFound) {
            return 0;
        }
        
        // Calcular puntuación basada en dónde se encontraron las palabras
        const totalWords = queryWords.length;
        
        // Bonus por palabras encontradas en código (mayor peso)
        score += (wordsFoundInCode / totalWords) * 20;
        
        // Bonus por palabras encontradas en descripción
        score += (wordsFoundInDescription / totalWords) * 10;
        
        // Bonus por coincidencia exacta de código
        if (codigoNormalizado === queryWords.join('')) {
            score += 30;
        }
        
        // Bonus por coincidencia exacta de descripción
        if (descripcionNormalizada === queryWords.join(' ')) {
            score += 25;
        }
        
        // Bonus si coincide código secundario
        if (codigoSecundario) {
            const codigoSecNormalizado = this.normalizeText(codigoSecundario);
            let wordsFoundInSecCode = 0;
            
            for (const word of queryWords) {
                if (codigoSecNormalizado.includes(word)) {
                    wordsFoundInSecCode++;
                }
            }
            
            if (wordsFoundInSecCode === totalWords) {
                score += 15; // Solo si todas las palabras están en el código secundario
            }
        }
        
        return score;
    }

    /**
     * Búsqueda ultra-optimizada de dos pasos
     */
    async searchProducts(codeQuery, descriptionQuery, limit = 50) {
        try {
            console.log('🔍 Iniciando búsqueda optimizada:', { codeQuery, descriptionQuery });
            
            // Paso 1: Filtro rápido por código (SKU + EAN)
            let candidates = [];
            if (codeQuery && codeQuery.trim()) {
                candidates = await this.searchByCodeOptimized(codeQuery.trim());
                console.log(`📊 Paso 1: Encontrados ${candidates.length} candidatos por código`);
            } else {
                // Si no hay código, obtener todos los productos
                candidates = await this.getProducts();
                console.log(`📊 Paso 1: Sin filtro de código, ${candidates.length} productos totales`);
            }
            
            // Paso 2: Filtro por descripción (solo en candidatos del Paso 1)
            let results = candidates;
            if (descriptionQuery && descriptionQuery.trim() && candidates.length > 0) {
                results = this.filterByDescription(candidates, descriptionQuery.trim());
                console.log(`📊 Paso 2: Filtrados ${results.length} productos por descripción`);
            }
            
            // Ordenar por relevancia y limitar
            results = this.sortByRelevance(results, codeQuery, descriptionQuery);
            results = results.slice(0, limit);
            
            console.log(`✅ Búsqueda completada: ${results.length} resultados finales`);
            return results;
            
        } catch (error) {
            console.error('❌ Error en búsqueda optimizada:', error);
            return [];
        }
    }

    /**
     * Paso 1: Búsqueda ultra-rápida por código usando índices de IndexedDB
     */
    async searchByCodeOptimized(codeQuery) {
        try {
            const results = new Set();
            const processedCodes = new Set();
            
            // Normalizar código de búsqueda
            const normalizedCode = this.normalizeText(codeQuery);
            
            // Buscar en códigos principales (SKU)
            const productos = await this.searchInProductos(normalizedCode);
            productos.forEach(producto => {
                results.add(producto.codigo);
                processedCodes.add(producto.codigo);
            });
            
            // Buscar en códigos secundarios (EAN) solo si no hay muchos resultados
            if (results.size < 10) {
                const codigosSecundarios = await this.searchInCodigosSecundarios(normalizedCode);
                for (const codigoSec of codigosSecundarios) {
                    if (!processedCodes.has(codigoSec.codigo_principal)) {
                        results.add(codigoSec.codigo_principal);
                        processedCodes.add(codigoSec.codigo_principal);
                    }
                }
            }
            
            // Obtener productos completos
            const productosCompletos = await this.getProductsByCodes(Array.from(results));
            return productosCompletos;
            
        } catch (error) {
            console.error('❌ Error en búsqueda por código:', error);
            return [];
        }
    }

    /**
     * Busca en la tabla productos usando índices
     */
    async searchInProductos(codeQuery) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['productos'], 'readonly');
            const store = transaction.objectStore('productos');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const productos = request.result;
                const matches = productos.filter(producto => 
                    this.normalizeText(producto.codigo).includes(codeQuery)
                );
                resolve(matches);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Busca en la tabla codigos_secundarios usando índices
     */
    async searchInCodigosSecundarios(codeQuery) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['codigos_secundarios'], 'readonly');
            const store = transaction.objectStore('codigos_secundarios');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const codigos = request.result;
                const matches = codigos.filter(codigo => 
                    this.normalizeText(codigo.codigo_secundario).includes(codeQuery)
                );
                resolve(matches);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Obtiene productos específicos por sus códigos
     */
    async getProductsByCodes(codes) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['productos'], 'readonly');
            const store = transaction.objectStore('productos');
            const productos = [];
            let completed = 0;
            
            if (codes.length === 0) {
                resolve([]);
                return;
            }
            
            codes.forEach(codigo => {
                const request = store.get(codigo);
                request.onsuccess = () => {
                    if (request.result) {
                        productos.push(request.result);
                    }
                    completed++;
                    if (completed === codes.length) {
                        resolve(productos);
                    }
                };
                request.onerror = () => {
                    completed++;
                    if (completed === codes.length) {
                        resolve(productos);
                    }
                };
            });
        });
    }

    /**
     * Paso 2: Filtro por descripción en productos candidatos
     */
    filterByDescription(candidates, descriptionQuery) {
        const queryWords = this.parseQuery(descriptionQuery);
        const results = [];
        
        for (const producto of candidates) {
            const descripcionNormalizada = this.normalizeText(producto.descripcion);
            
            // Verificar que TODAS las palabras estén en la descripción
            const allWordsFound = queryWords.every(word => 
                descripcionNormalizada.includes(word)
            );
            
            if (allWordsFound) {
                results.push({
                    ...producto,
                    relevance: this.calculateDescriptionRelevance(producto, queryWords),
                    matchType: 'descripcion'
                });
            }
        }
        
        return results;
    }

    /**
     * Calcula relevancia basada en descripción
     */
    calculateDescriptionRelevance(producto, queryWords) {
        const descripcionNormalizada = this.normalizeText(producto.descripcion);
        let score = 0;
        
        // Bonus por coincidencia exacta
        if (descripcionNormalizada === queryWords.join(' ')) {
            score += 100;
        } else {
            // Bonus por palabras encontradas
            queryWords.forEach(word => {
                if (descripcionNormalizada.includes(word)) {
                    score += 10;
                }
            });
        }
        
        return score;
    }

    /**
     * Ordena resultados por relevancia
     */
    sortByRelevance(results, codeQuery, descriptionQuery) {
        return results.sort((a, b) => {
            // Priorizar coincidencias exactas de código
            if (codeQuery) {
                const aCodeMatch = this.normalizeText(a.codigo).includes(this.normalizeText(codeQuery));
                const bCodeMatch = this.normalizeText(b.codigo).includes(this.normalizeText(codeQuery));
                
                if (aCodeMatch && !bCodeMatch) return -1;
                if (!aCodeMatch && bCodeMatch) return 1;
            }
            
            // Luego por relevancia calculada
            return (b.relevance || 0) - (a.relevance || 0);
        });
    }

    /**
     * Determina si la búsqueda es un código
     */
    isCodeSearch(queryWords) {
        // Si es una sola palabra y contiene principalmente números/letras
        if (queryWords.length === 1) {
            const word = queryWords[0];
            // Si es principalmente alfanumérico y tiene más de 3 caracteres
            return /^[a-zA-Z0-9]+$/.test(word) && word.length >= 3;
        }
        
        // Si son múltiples palabras pero todas son alfanuméricas cortas
        if (queryWords.every(word => /^[a-zA-Z0-9]{1,6}$/.test(word))) {
            return true;
        }
        
        // Si la primera palabra parece un código (alfanumérico de 3+ caracteres)
        // y las demás son palabras cortas, tratar como código mixto
        if (queryWords.length >= 2) {
            const firstWord = queryWords[0];
            const restWords = queryWords.slice(1);
            
            if (/^[a-zA-Z0-9]{3,}$/.test(firstWord) && 
                restWords.every(word => word.length <= 10)) {
                return true; // Código mixto: "0138 monomando lavabo"
            }
        }
        
        return false;
    }

    /**
     * Búsqueda rápida por código (incluye códigos mixtos)
     */
    async searchByCode(codeQuery, limit) {
        const productos = await this.getProducts();
        const codigos = await this.getSecondaryCodes();
        const results = [];
        const processedCodes = new Set();

        // Para códigos mixtos como "0138 monomando lavabo", separar código y texto
        const queryWords = this.parseQuery(codeQuery);
        const codePart = queryWords[0]; // "0138"
        const textParts = queryWords.slice(1); // ["monomando", "lavabo"]

        // Búsqueda directa en códigos principales (más rápida)
        for (const producto of productos) {
            const codigoNormalizado = this.normalizeText(producto.codigo);
            const descripcionNormalizada = this.normalizeText(producto.descripcion);
            
            let relevance = 0;
            let matchType = 'producto_principal';
            
            // Verificar coincidencia en código
            if (codigoNormalizado.includes(codePart)) {
                relevance = codigoNormalizado === codePart ? 100 : 50;
                
                // Si hay texto adicional, verificar que esté en la descripción
                if (textParts.length > 0) {
                    const allTextFound = textParts.every(textPart => 
                        descripcionNormalizada.includes(textPart)
                    );
                    
                    if (allTextFound) {
                        relevance += 30; // Bonus por coincidencia de texto
                    } else {
                        relevance = 0; // Descartar si no coincide el texto
                    }
                }
            }
            
            if (relevance > 0) {
                results.push({
                    ...producto,
                    relevance: relevance,
                    matchType: matchType
                });
                processedCodes.add(producto.codigo);
            }
        }

        // Búsqueda en códigos secundarios (solo si no hay muchos resultados)
        if (results.length < 5) {
            for (const codigo of codigos) {
                const codigoSecNormalizado = this.normalizeText(codigo.codigo_secundario);
                
                if (codigoSecNormalizado.includes(codePart)) {
                    const productoPrincipal = productos.find(p => p.codigo === codigo.codigo_principal);
                    
                    if (productoPrincipal && !processedCodes.has(productoPrincipal.codigo)) {
                        let relevance = codigoSecNormalizado === codePart ? 80 : 40;
                        
                        // Si hay texto adicional, verificar que esté en la descripción
                        if (textParts.length > 0) {
                            const descripcionNormalizada = this.normalizeText(productoPrincipal.descripcion);
                            const allTextFound = textParts.every(textPart => 
                                descripcionNormalizada.includes(textPart)
                            );
                            
                            if (allTextFound) {
                                relevance += 25; // Bonus por coincidencia de texto
                            } else {
                                relevance = 0; // Descartar si no coincide el texto
                            }
                        }
                        
                        if (relevance > 0) {
                            results.push({
                                ...productoPrincipal,
                                relevance: relevance,
                                matchType: 'codigo_secundario',
                                codigoSecundario: codigo.codigo_secundario
                            });
                            processedCodes.add(productoPrincipal.codigo);
                        }
                    }
                }
            }
        }

        // Ordenar por relevancia
        results.sort((a, b) => b.relevance - a.relevance);
        return results.slice(0, limit);
    }

    /**
     * Búsqueda completa por texto
     */
    async searchByText(queryWords, limit) {
        const productos = await this.getProducts();
        const codigos = await this.getSecondaryCodes();
        const results = [];
        const processedCodes = new Set();

        // Crear índices para búsqueda más rápida
        const productosIndex = productos.map(p => ({
            ...p,
            codigoNormalizado: this.normalizeText(p.codigo),
            descripcionNormalizada: this.normalizeText(p.descripcion)
        }));

        // Buscar en productos principales (optimizado)
        for (const producto of productosIndex) {
            const relevance = this.calculateRelevance(producto, queryWords);
            
            if (relevance > 0) {
                results.push({
                    ...producto,
                    relevance: relevance,
                    matchType: 'producto_principal'
                });
                processedCodes.add(producto.codigo);
            }
        }

        // Buscar en códigos secundarios (optimizado)
        for (const codigo of codigos) {
            const productoPrincipal = productosIndex.find(p => p.codigo === codigo.codigo_principal);
            
            if (productoPrincipal && !processedCodes.has(productoPrincipal.codigo)) {
                const relevance = this.calculateRelevance(productoPrincipal, queryWords, codigo.codigo_secundario);
                
                if (relevance > 0) {
                    results.push({
                        ...productoPrincipal,
                        relevance: relevance,
                        matchType: 'codigo_secundario',
                        codigoSecundario: codigo.codigo_secundario
                    });
                    processedCodes.add(productoPrincipal.codigo);
                }
            }
        }

        // Ordenar por relevancia
        results.sort((a, b) => b.relevance - a.relevance);
        return results.slice(0, limit);
    }

    /**
     * Guarda una lista local
     */
    async saveLocalList(lista) {
        try {
            const transaction = this.db.transaction(['listas_locales'], 'readwrite');
            const store = transaction.objectStore('listas_locales');

            const listaConFecha = {
                ...lista,
                fecha_creacion: new Date().toISOString(),
                fecha_modificacion: new Date().toISOString()
            };

            const request = store.add(listaConFecha);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log('✅ Lista guardada localmente');
                    resolve(request.result);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('❌ Error al guardar lista local:', error);
            throw error;
        }
    }

    /**
     * Obtiene todas las listas locales
     */
    async getLocalLists() {
        try {
            const transaction = this.db.transaction(['listas_locales'], 'readonly');
            const store = transaction.objectStore('listas_locales');
            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('❌ Error al obtener listas locales:', error);
            return [];
        }
    }

    /**
     * Guarda configuración
     */
    async saveConfig(key, value) {
        try {
            const transaction = this.db.transaction(['config'], 'readwrite');
            const store = transaction.objectStore('config');

            const configItem = { key, value, timestamp: new Date().toISOString() };
            await store.put(configItem);

            await this.waitForTransaction(transaction);
            console.log(`✅ Configuración guardada: ${key}`);
        } catch (error) {
            console.error('❌ Error al guardar configuración:', error);
            throw error;
        }
    }

    /**
     * Obtiene configuración
     */
    async getConfig(key) {
        try {
            const transaction = this.db.transaction(['config'], 'readonly');
            const store = transaction.objectStore('config');
            const request = store.get(key);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const result = request.result;
                    resolve(result ? result.value : null);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('❌ Error al obtener configuración:', error);
            return null;
        }
    }

    /**
     * Obtiene toda la configuración
     */
    async getAllConfig() {
        try {
            const transaction = this.db.transaction(['config'], 'readonly');
            const store = transaction.objectStore('config');
            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const items = request.result;
                    const config = {};
                    items.forEach(item => {
                        config[item.key] = item.value;
                    });
                    resolve({ ...this.defaultConfig, ...config });
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('❌ Error al obtener configuración completa:', error);
            return this.defaultConfig;
        }
    }

    /**
     * Limpia todos los datos locales
     */
    async clearAllData() {
        try {
            const stores = ['productos', 'codigos_secundarios', 'listas_locales'];
            const transaction = this.db.transaction(stores, 'readwrite');

            for (const storeName of stores) {
                const store = transaction.objectStore(storeName);
                await store.clear();
            }

            await this.waitForTransaction(transaction);
            console.log('🧹 Datos locales limpiados');
        } catch (error) {
            console.error('❌ Error al limpiar datos:', error);
            throw error;
        }
    }

    /**
     * Obtiene estadísticas de almacenamiento
     */
    async getStorageStats() {
        try {
            const productos = await this.getProducts();
            const codigos = await this.getSecondaryCodes();
            const listas = await this.getLocalLists();
            const config = await this.getAllConfig();

            return {
                productos: productos.length,
                codigos_secundarios: codigos.length,
                listas_locales: listas.length,
                ultima_sincronizacion: config.lastSync,
                modo_offline: config.offlineMode
            };
        } catch (error) {
            console.error('❌ Error al obtener estadísticas:', error);
            return {
                productos: 0,
                codigos_secundarios: 0,
                listas_locales: 0,
                ultima_sincronizacion: null,
                modo_offline: false
            };
        }
    }

    /**
     * Espera a que una transacción se complete
     */
    waitForTransaction(transaction) {
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }
}

// Instancia global del gestor de almacenamiento
window.storageManager = new StorageManager();
