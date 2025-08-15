// Script para monitorar campanhas em tempo real
const fs = require('fs');

console.log('🔍 MONITORANDO CAMPANHAS EM TEMPO REAL...');
console.log('⏰ Timestamp:', new Date().toISOString());
console.log('');

// Interceptar logs do console
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
  const message = args.join(' ');
  if (message.includes('📊') || message.includes('Tracking') || message.includes('campanha') || message.includes('registerSentNumber')) {
    originalLog('🎯 TRACKING DETECTADO:', ...args);
  }
  originalLog(...args);
};

console.error = function(...args) {
  const message = args.join(' ');
  if (message.includes('📊') || message.includes('Tracking') || message.includes('campanha') || message.includes('registerSentNumber')) {
    originalError('🚨 ERRO TRACKING:', ...args);
  }
  originalError(...args);
};

console.log('✅ Monitor de tracking ativado');
console.log('📋 Aguardando execução de campanhas...');

// Manter o script rodando
setInterval(() => {
  process.stdout.write('.');
}, 5000);
