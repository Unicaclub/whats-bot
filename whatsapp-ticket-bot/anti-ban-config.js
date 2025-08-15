// CONFIGURAÇÕES ANTI-BAN PARA WHATSAPP
// Esta configuração foi criada após análise do bloqueio do número

// Carregar configurações do .env
require('dotenv').config();

const ANTI_BAN_CONFIG = {
  // DELAYS SEGUROS (em milissegundos) - Configuráveis via .env
  delays: {
    betweenMessages: {
      min: parseInt(process.env.MIN_DELAY) || 7000,    // 7 segundos mínimo
      max: parseInt(process.env.MAX_DELAY) || 15000    // 15 segundos máximo
    },
    betweenBatches: 300000,        // 5 minutos entre lotes
    afterError: 60000,             // 1 minuto após erro
    reconnectionDelay: 600000,     // 10 minutos para reconexão
    dailyLimit: 86400000          // 24 horas de pausa diária
  },

  // LIMITES SEGUROS
  limits: {
    messagesPerHour: 30,           // Máximo 30 mensagens por hora
    messagesPerDay: 200,           // Máximo 200 mensagens por dia
    batchSize: 10,                 // Máximo 10 números por lote
    maxRetries: 2,                 // Máximo 2 tentativas por número
    consecutiveErrors: 5           // Parar após 5 erros consecutivos
  },

  // HORÁRIOS SEGUROS (horário comercial)
  safeHours: {
    start: 9,                      // 9:00 AM
    end: 18,                       // 6:00 PM
    timezone: 'America/Sao_Paulo'
  },

  // DIAS DA SEMANA SEGUROS
  safeDays: [1, 2, 3, 4, 5],       // Segunda a Sexta

  // MENSAGENS VARIADAS (para evitar detecção de spam)
  messageVariations: [
    "Olá! Como você está hoje?",
    "Oi! Tudo bem por aí?",
    "Hey! Como vai?",
    "Olá! Espero que esteja bem!",
    "Oi! Como está passando?"
  ],

  // VALIDAÇÕES DE SEGURANÇA
  safety: {
    checkBlacklist: true,          // Verificar lista negra
    validateNumbers: true,         // Validar números antes de enviar
    respectDND: true,              // Respeitar "Não perturbe"
    checkUserActivity: true,       // Verificar atividade do usuário
    enableCooldown: true           // SEMPRE habilitar cooldown
  },

  // MONITORAMENTO
  monitoring: {
    logAllAttempts: true,          // Log de todas as tentativas
    trackFailures: true,           // Rastrear falhas
    alertOnPattern: true,          // Alertar sobre padrões suspeitos
    saveStats: true                // Salvar estatísticas
  }
};

// FUNÇÃO PARA VERIFICAR SE É HORÁRIO SEGURO
function isSafeTime() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Domingo, 1 = Segunda, etc.
  
  return ANTI_BAN_CONFIG.safeDays.includes(day) && 
         hour >= ANTI_BAN_CONFIG.safeHours.start && 
         hour < ANTI_BAN_CONFIG.safeHours.end;
}

// FUNÇÃO PARA CALCULAR DELAY BASEADO EM FALHAS
function calculateDelay(consecutiveFailures = 0) {
  const config = ANTI_BAN_CONFIG.delays.betweenMessages;
  const baseDelay = Math.random() * (config.max - config.min) + config.min; // Random entre 10-20s
  const multiplier = Math.min(consecutiveFailures * 2, 10); // Máximo 10x
  return Math.floor(baseDelay * (1 + multiplier));
}

// FUNÇÃO PARA VALIDAR NÚMERO
function isValidPhoneNumber(number) {
  // Remove caracteres não numéricos
  const cleaned = number.replace(/\D/g, '');
  
  // Verifica se tem entre 10 e 15 dígitos
  if (cleaned.length < 10 || cleaned.length > 15) {
    return false;
  }
  
  // Verifica se começa com código do país válido (55 para Brasil)
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    return true;
  }
  
  return false;
}

// FUNÇÃO PARA OBTER MENSAGEM VARIADA
function getRandomMessage() {
  const messages = ANTI_BAN_CONFIG.messageVariations;
  return messages[Math.floor(Math.random() * messages.length)];
}

// CLASSE PARA CONTROLE DE RATE LIMITING
class RateLimiter {
  constructor() {
    this.messageCount = 0;
    this.hourlyReset = Date.now() + (60 * 60 * 1000); // 1 hora
    this.dailyReset = Date.now() + (24 * 60 * 60 * 1000); // 24 horas
    this.dailyCount = 0;
  }

  canSendMessage() {
    const now = Date.now();
    
    // Reset contadores se necessário
    if (now > this.hourlyReset) {
      this.messageCount = 0;
      this.hourlyReset = now + (60 * 60 * 1000);
    }
    
    if (now > this.dailyReset) {
      this.dailyCount = 0;
      this.dailyReset = now + (24 * 60 * 60 * 1000);
    }
    
    // Verificar limites
    return this.messageCount < ANTI_BAN_CONFIG.limits.messagesPerHour &&
           this.dailyCount < ANTI_BAN_CONFIG.limits.messagesPerDay;
  }

  recordMessage() {
    this.messageCount++;
    this.dailyCount++;
  }
}

module.exports = {
  ANTI_BAN_CONFIG,
  isSafeTime,
  calculateDelay,
  isValidPhoneNumber,
  getRandomMessage,
  RateLimiter
};
