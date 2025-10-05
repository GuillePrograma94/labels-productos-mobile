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
            
            // Configurar hints para optimizar lectura de códigos alfanuméricos
            const hints = new Map();
            const formats = [
                ZXing.BarcodeFormat.CODE_128,  // Principal para códigos alfanuméricos
                ZXing.BarcodeFormat.CODE_39,   // Alternativo alfanumérico
                ZXing.BarcodeFormat.EAN_13,    // Para códigos de barras estándar
                ZXing.BarcodeFormat.EAN_8      // Para códigos cortos
            ];
            hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
            hints.set(ZXing.DecodeHintType.TRY_HARDER, true);  // Mejor precisión
            hints.set(ZXing.DecodeHintType.ASSUME_GS1, false); // No asumir formato GS1
            
            this.codeReader = new ZXing.BrowserMultiFormatReader(hints);
            console.log('✅ ZXing inicializado con optimizaciones para Code128');
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
            searchDetectedBtn: document.getElementById('searchDetectedBtn'),
            capturePhotoBtn: document.getElementById('capturePhotoBtn')
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
        
        // Hacer foto manual
        this.elements.capturePhotoBtn.addEventListener('click', () => this.captureAndDecode());
        
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

            // Configurar constraints con alta resolución preferida
            const constraints = {
                video: {
                    facingMode: this.currentCamera,
                    width: { ideal: 1920, min: 640 },     // Full HD preferido, mín 640
                    height: { ideal: 1080, min: 480 },    // Full HD preferido, mín 480
                    focusMode: { ideal: 'continuous' },   // Autofocus continuo si disponible
                    zoom: { ideal: 1.0 }                  // Sin zoom por defecto
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
     * Busca el código detectado y añade automáticamente si es único (BÚSQUEDA EXACTA desde escáner)
     */
    async searchDetectedCode() {
        const code = this.elements.detectedCode.textContent;
        if (code) {
            // Cerrar escáner
            this.closeScanner();
            
            // Buscar productos con este código específico (BÚSQUEDA EXACTA)
            try {
                console.log('🎯 Búsqueda EXACTA desde escáner:', code);
                const results = await window.storageManager.searchProducts(code, '', 10, true);
                
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

    /**
     * Captura una foto del video actual y fuerza la decodificación
     */
    async captureAndDecode() {
        try {
            if (!this.elements.scannerVideo || !this.codeReader) {
                console.error('❌ Video o CodeReader no disponible');
                return;
            }

            console.log('📸 Capturando foto para decodificación manual...');
            
            // Cambiar texto del botón temporalmente
            const originalText = this.elements.capturePhotoBtn.textContent;
            this.elements.capturePhotoBtn.textContent = '⏳ Procesando...';
            this.elements.capturePhotoBtn.disabled = true;

            // Crear canvas para capturar el frame actual del video
            const canvas = document.createElement('canvas');
            const video = this.elements.scannerVideo;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convertir canvas a blob
            canvas.toBlob(async (blob) => {
                try {
                    // Decodificar usando ZXing
                    const result = await this.codeReader.decodeFromImageElement(canvas);
                    
                    if (result && result.text) {
                        console.log('✅ Código detectado manualmente:', result.text);
                        this.onCodeDetected(result.text);
                    } else {
                        console.log('❌ No se detectó ningún código en la imagen');
                        this.showTemporaryMessage('No se detectó código. Intenta de nuevo.');
                    }
                } catch (error) {
                    console.warn('⚠️ No se pudo decodificar:', error);
                    this.showTemporaryMessage('No se detectó código. Asegúrate de que esté dentro del marco.');
                } finally {
                    // Restaurar botón
                    this.elements.capturePhotoBtn.textContent = originalText;
                    this.elements.capturePhotoBtn.disabled = false;
                }
            }, 'image/png');

        } catch (error) {
            console.error('❌ Error al capturar foto:', error);
            this.elements.capturePhotoBtn.textContent = '📷 Hacer Foto';
            this.elements.capturePhotoBtn.disabled = false;
            this.showTemporaryMessage('Error al procesar la foto');
        }
    }

    /**
     * Muestra un mensaje temporal en las instrucciones del scanner
     */
    showTemporaryMessage(message) {
        const instructions = document.querySelector('.scanner-instructions');
        if (instructions) {
            const originalText = instructions.textContent;
            instructions.textContent = message;
            instructions.style.color = '#ff6b6b';
            
            setTimeout(() => {
                instructions.textContent = originalText;
                instructions.style.color = '';
            }, 3000);
        }
    }
}

// Instancia global del escáner
window.barcodeScanner = new BarcodeScanner();
