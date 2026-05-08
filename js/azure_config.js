/**
 * AZURE_CONFIG.JS - Central segura para Azure AI
 * Não coloque secrets reais neste arquivo. Use Edge Function, backend ou localStorage em ambiente controlado.
 */
(function () {
    const baseConfig = window.CONFIG || {};
    const storagePrefix = 'guarugeo_azure_';

    const readLocal = (key) => {
        try {
            return window.localStorage?.getItem(`${storagePrefix}${key}`) || '';
        } catch (error) {
            return '';
        }
    };

    window.AzureAIConfig = {
        endpoint: baseConfig.AZURE_OPENAI_ENDPOINT || readLocal('endpoint'),
        deployment: baseConfig.AZURE_OPENAI_DEPLOYMENT || readLocal('deployment') || 'gpt-4',
        apiVersion: baseConfig.AZURE_OPENAI_API_VERSION || readLocal('api_version') || '2024-02-15-preview',

        isReady() {
            return Boolean(this.endpoint && this.deployment);
        },

        getAuditProfile() {
            return {
                protocol: 'Bruno Giovani V6.1',
                focus: ['segurança', 'performance', 'LGPD', 'arquitetura', 'GIS'],
                model: this.deployment,
                endpointConfigured: Boolean(this.endpoint)
            };
        }
    };
})();
