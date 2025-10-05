/**
 * Escáner de códigos de barras para la aplicación móvil
 * Utiliza la API de getUserMedia y ZXing para detectar códigos
 */

class BarcodeScanner {
    constructor() {
        this.isScanning = false;
        this.stream = null;
        this.video = null;
        this.codeReader = null;
        this.currentCamera = 'environment'; // 'user' o 'environment'
        this.hasFlash = false;
        this.flashEnabled = false;
        
        // Elementos DOM
        this.elements = {};
        
        // Inicializar ZXing
        this.initializeZXing();
    }

    /**
     * Inicializa la librería ZXing
     */
    async initializeZXing() {
        try {
            // Cargar ZXing dinámicamente
            if (!window.ZXing) {
                await this.loadZXingLibrary();
            }
            
            this.codeReader = new ZXing.BrowserMultiFormatReader();
            console.log('✅ ZXing inicializado correctamente');
        } catch (error) {
            console.error('❌ Error al inicializar ZXing:', error);
        }
    }

    /**
     * Carga la librería ZXing dinámicamente
     */
    loadZXingLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@zxing/library@latest/umd/index.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Inicializa los elementos DOM
     */
    initializeElements() {
        this.elements = {
            scannerModal: document.getElementById('scannerModal'),
            closeScannerBtn: document.getElementById('closeScannerBtn'),
            scannerVideo: document.getElementById('scannerVideo'),
            scannerResult: document.getElementById('scannerResult'),
            detectedCode: document.getElementById('detectedCode'),
            searchDetectedBtn: document.getElementById('searchDetectedBtn')
        };
    }

    /**
     * Vincula los eventos
     */
    bindEvents() {
        // Cerrar modal
        this.elements.closeScannerBtn.addEventListener('click', () => this.closeScanner());
        
        // Buscar código detectado
        this.elements.searchDetectedBtn.addEventListener('click', () => this.searchDetectedCode());
        
        // Cerrar modal al hacer clic fuera
        this.elements.scannerModal.addEventListener('click', (e) => {
            if (e.target === this.elements.scannerModal) {
                this.closeScanner();
            }
        });
    }

    /**
     * Abre el escáner
     */
    async openScanner() {
        try {
            // Inicializar elementos si no están inicializados
            if (!this.elements.scannerModal) {
                this.initializeElements();
                this.bindEvents();
            }

            // Verificar soporte de cámara
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Tu navegador no soporta acceso a la cámara');
            }

            // Mostrar modal
            this.elements.scannerModal.style.display = 'flex';
            
            // Ocultar resultado anterior
            this.elements.scannerResult.style.display = 'none';
            
            // Iniciar cámara
            await this.startCamera();
            
            // Iniciar escaneo
            this.startScanning();
            
            window.ui.showToast('Escáner iniciado', 'success');

        } catch (error) {
            console.error('Error al abrir escáner:', error);
            window.ui.showToast('Error: ' + error.message, 'error');
            this.closeScanner();
        }
    }

    /**
     * Inicia la cámara
     */
    async startCamera() {
        try {
            // Detener stream anterior si existe
            if (this.stream) {
                this.stopCamera();
            }

            // Configurar constraints
            const constraints = {
                video: {
                    facingMode: this.currentCamera,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            // Obtener stream de la cámara
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Asignar stream al video
            this.elements.scannerVideo.srcObject = this.stream;
            
            console.log('✅ Cámara iniciada');

        } catch (error) {
            console.error('Error al iniciar cámara:', error);
            
            if (error.name === 'NotAllowedError') {
                throw new Error('Permiso de cámara denegado. Permite el acceso a la cámara.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No se encontró ninguna cámara en el dispositivo.');
            } else {
                throw new Error('Error al acceder a la cámara: ' + error.message);
            }
        }
    }

    /**
     * Detiene la cámara
     */
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.elements.scannerVideo) {
            this.elements.scannerVideo.srcObject = null;
        }
    }

    /**
     * Inicia el escaneo de códigos
     */
    startScanning() {
        if (!this.codeReader || this.isScanning) return;

        this.isScanning = true;
        
        // Usar ZXing para detectar códigos
        this.codeReader.decodeFromVideoDevice(
            undefined, // deviceId (undefined = usar el stream actual)
            this.elements.scannerVideo,
            (result, error) => {
                if (result) {
                    // Código detectado
                    this.onCodeDetected(result.text);
                }
                
                if (error && error.name !== 'NotFoundException') {
                    console.warn('Error de escaneo:', error);
                }
            }
        );
    }

    /**
     * Detiene el escaneo
     */
    stopScanning() {
        if (this.codeReader && this.isScanning) {
            this.codeReader.reset();
            this.isScanning = false;
        }
    }

    /**
     * Maneja la detección de un código
     */
    onCodeDetected(code) {
        console.log('🎯 Código detectado:', code);
        
        // Detener escaneo
        this.stopScanning();
        
        // Mostrar resultado
        this.elements.detectedCode.textContent = code;
        this.elements.scannerResult.style.display = 'block';
        
        // Vibración si está disponible
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
        
        // Sonido de éxito (opcional)
        this.playSuccessSound();
        
        window.ui.showToast('¡Código detectado!', 'success');
        
        // Búsqueda automática del código detectado
        setTimeout(() => {
            this.searchDetectedCode();
        }, 1000); // Esperar 1 segundo para que el usuario vea el código detectado
    }

    /**
     * Reproduce sonido de éxito
     */
    playSuccessSound() {
        try {
            // Crear un sonido simple usando Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
            // Silenciar errores de audio
        }
    }

    /**
     * Busca el código detectado y añade automáticamente si es único
     */
    async searchDetectedCode() {
        const code = this.elements.detectedCode.textContent;
        if (code) {
            // Cerrar escáner
            this.closeScanner();
            
            // Buscar productos con este código específico
            try {
                const results = await window.storageManager.searchProducts(code, '', 10);
                
                if (results.length === 1) {
                    // Si hay exactamente un producto, añadirlo automáticamente
                    const product = results[0];
                    await window.ui.addProductToList(product.codigo);
                    window.ui.showToast(`✅ ${product.descripcion} añadido automáticamente`, 'success');
                } else if (results.length > 1) {
                    // Si hay múltiples productos, mostrar resultados para que el usuario elija
                    window.ui.elements.codeInput.value = code;
                    window.ui.performSmartSearch();
                    window.ui.showToast(`🔍 ${results.length} productos encontrados. Selecciona el correcto.`, 'info');
                } else {
                    // Si no se encuentra el producto
                    window.ui.elements.codeInput.value = code;
                    window.ui.showToast(`❌ No se encontró producto con código ${code}`, 'warning');
                }
            } catch (error) {
                console.error('Error al buscar código detectado:', error);
                // Fallback: usar búsqueda normal
                if (window.ui) {
                    window.ui.elements.codeInput.value = code;
                    window.ui.performSmartSearch();
                }
            }
        }
    }

    /**
     * Cierra el escáner
     */
    closeScanner() {
        // Detener escaneo y cámara
        this.stopScanning();
        this.stopCamera();
        
        // Ocultar modal
        if (this.elements.scannerModal) {
            this.elements.scannerModal.style.display = 'none';
        }
        
        // Reset flash
        this.flashEnabled = false;
        
        console.log('📷 Escáner cerrado');
    }
}

// Instancia global del escáner
window.barcodeScanner = new BarcodeScanner();
