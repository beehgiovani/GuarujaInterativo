/**
 * SPEECH_COMMAND_HANDLER.JS - Base de comandos de voz do mapa
 * Mantém a captura local no navegador e envia apenas comandos normalizados para handlers existentes.
 */
(function () {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    const normalize = (text) => String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const dispatchCommand = (rawText) => {
        const command = normalize(rawText);
        if (!command) return false;

        if (command.includes('buscar ') || command.startsWith('procure ')) {
            const query = command.replace(/^buscar\s+|^procure\s+/, '').trim();
            if (query && window.SearchHandler?.search) {
                window.SearchHandler.search(query);
                return true;
            }
        }

        if (command.includes('minha localizacao') || command.includes('gps')) {
            window.LocationHandler?.centerOnUser?.();
            return true;
        }

        if (command.includes('camada ambiental')) {
            window.LayerEngine?.toggle?.('ambiental');
            return true;
        }

        if (command.includes('camada fiscal')) {
            window.LayerEngine?.toggle?.('fiscal');
            return true;
        }

        return false;
    };

    window.SpeechCommandHandler = {
        recognition: null,
        isSupported: Boolean(SpeechRecognition),

        init() {
            if (!SpeechRecognition || this.recognition) return this.isSupported;

            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'pt-BR';
            this.recognition.continuous = false;
            this.recognition.interimResults = false;

            this.recognition.onresult = (event) => {
                const transcript = event.results?.[0]?.[0]?.transcript || '';
                const handled = dispatchCommand(transcript);
                if (handled) {
                    window.Toast?.success?.(`Comando executado: ${transcript}`);
                } else {
                    window.Toast?.info?.(`Comando não reconhecido: ${transcript}`);
                }
            };

            this.recognition.onerror = () => {
                window.Toast?.warning?.('Não foi possível capturar o comando de voz.');
            };

            return true;
        },

        start() {
            if (!this.init()) {
                window.Toast?.info?.('Comando de voz indisponível neste navegador.');
                return false;
            }

            this.recognition.start();
            return true;
        },

        handleText: dispatchCommand
    };
})();
