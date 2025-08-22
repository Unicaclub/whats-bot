const promClient = require('prom-client');

// ================================================
// CONFIGURAÇÃO BÁSICA DO PROMETHEUS
// ================================================
const register = promClient.register;

// Habilitar coleta automática de métricas padrão
promClient.collectDefaultMetrics({
    timeout: 10000,
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    prefix: 'whatsapp_bot_'
});

// ================================================
// MÉTRICAS CUSTOMIZADAS
// ================================================

// Contador de requisições HTTP
const httpRequestsTotal = new promClient.Counter({
    name: 'whatsapp_bot_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
});

// Histograma de duração das requisições
const httpRequestDuration = new promClient.Histogram({
    name: 'whatsapp_bot_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

// Gauge de sessões WhatsApp ativas
const activeWhatsAppSessions = new promClient.Gauge({
    name: 'whatsapp_bot_sessions_connected',
    help: 'Number of active WhatsApp sessions'
});

// Contador de mensagens enviadas
const messagesSentTotal = new promClient.Counter({
    name: 'whatsapp_bot_messages_sent_total',
    help: 'Total number of messages sent',
    labelNames: ['session_type', 'message_type']
});

// Contador de mensagens recebidas
const messagesReceivedTotal = new promClient.Counter({
    name: 'whatsapp_bot_messages_received_total',
    help: 'Total number of messages received',
    labelNames: ['session_type', 'message_type']
});

// Gauge do tamanho da fila de mensagens
const messageQueueSize = new promClient.Gauge({
    name: 'whatsapp_bot_message_queue_size',
    help: 'Current size of message queue'
});

// Contador de campanhas processadas
const campaignsProcessedTotal = new promClient.Counter({
    name: 'whatsapp_bot_campaigns_processed_total',
    help: 'Total number of campaigns processed',
    labelNames: ['status']
});

// Gauge de campanhas ativas
const activeCampaigns = new promClient.Gauge({
    name: 'whatsapp_bot_campaigns_active',
    help: 'Number of active campaigns'
});

// Contador de erros de campanha
const campaignErrorsTotal = new promClient.Counter({
    name: 'whatsapp_bot_campaigns_errors_total',
    help: 'Total number of campaign errors',
    labelNames: ['error_type']
});

// Contador de erros de banco de dados
const dbErrorsTotal = new promClient.Counter({
    name: 'whatsapp_bot_db_errors_total',
    help: 'Total number of database errors',
    labelNames: ['operation', 'error_type']
});

// Gauge de conexões ativas do banco
const activeDbConnections = new promClient.Gauge({
    name: 'whatsapp_bot_db_connections_active',
    help: 'Number of active database connections'
});

// Histograma de duração de queries do banco
const dbQueryDuration = new promClient.Histogram({
    name: 'whatsapp_bot_db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

// Contador de tentativas de QR code
const qrCodeAttemptsTotal = new promClient.Counter({
    name: 'whatsapp_bot_qr_attempts_total',
    help: 'Total number of QR code generation attempts',
    labelNames: ['session_name']
});

// Gauge de arquivos processados
const filesProcessed = new promClient.Gauge({
    name: 'whatsapp_bot_files_processed',
    help: 'Number of files currently being processed'
});

// ================================================
// MIDDLEWARE PARA MÉTRICAS HTTP
// ================================================
const metricsMiddleware = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route ? req.route.path : req.path;
        
        httpRequestsTotal
            .labels(req.method, route, res.statusCode)
            .inc();
            
        httpRequestDuration
            .labels(req.method, route)
            .observe(duration);
    });
    
    next();
};

// ================================================
// FUNÇÕES AUXILIARES PARA ATUALIZAR MÉTRICAS
// ================================================
const metrics = {
    // HTTP Metrics
    incrementHttpRequests: (method, route, statusCode) => {
        httpRequestsTotal.labels(method, route, statusCode).inc();
    },
    
    observeHttpDuration: (method, route, duration) => {
        httpRequestDuration.labels(method, route).observe(duration);
    },

    // WhatsApp Session Metrics
    setActiveWhatsAppSessions: (count) => {
        activeWhatsAppSessions.set(count);
    },
    
    incrementMessagesSent: (sessionType, messageType) => {
        messagesSentTotal.labels(sessionType, messageType).inc();
    },
    
    incrementMessagesReceived: (sessionType, messageType) => {
        messagesReceivedTotal.labels(sessionType, messageType).inc();
    },
    
    setMessageQueueSize: (size) => {
        messageQueueSize.set(size);
    },
    
    incrementQrCodeAttempts: (sessionName) => {
        qrCodeAttemptsTotal.labels(sessionName).inc();
    },

    // Campaign Metrics
    incrementCampaignsProcessed: (status) => {
        campaignsProcessedTotal.labels(status).inc();
    },
    
    setActiveCampaigns: (count) => {
        activeCampaigns.set(count);
    },
    
    incrementCampaignErrors: (errorType) => {
        campaignErrorsTotal.labels(errorType).inc();
    },

    // Database Metrics
    incrementDbErrors: (operation, errorType) => {
        dbErrorsTotal.labels(operation, errorType).inc();
    },
    
    setActiveDbConnections: (count) => {
        activeDbConnections.set(count);
    },
    
    observeDbQueryDuration: (operation, duration) => {
        dbQueryDuration.labels(operation).observe(duration);
    },

    // File Processing Metrics
    setFilesProcessed: (count) => {
        filesProcessed.set(count);
    }
};

// ================================================
// ENDPOINT PARA EXPOSIÇÃO DAS MÉTRICAS
// ================================================
const getMetrics = async () => {
    return await register.metrics();
};

module.exports = {
    register,
    metrics,
    metricsMiddleware,
    getMetrics
};
