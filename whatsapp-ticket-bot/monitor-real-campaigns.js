// Monitor REAL de campanhas - vamos ver o que REALMENTE acontece
console.log('🕵️ MONITOR ATIVO - Interceptando TODAS as chamadas de salvamento');
console.log('⏰ Iniciado em:', new Date().toISOString());
console.log('📋 Aguardando execução de campanhas...\n');

// Interceptar TODOS os console.log
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
  const message = args.join(' ');
  
  // Detectar atividade de campanha
  if (message.includes('💾 Registrado') || 
      message.includes('📊 Tracking') || 
      message.includes('markCampaignSent') ||
      message.includes('registerSentNumber') ||
      message.includes('registerCampaignSent') ||
      message.includes('Enviado para') ||
      message.includes('sendHumanizedCampaign') ||
      message.includes('campanha')) {
    
    originalLog('🚨 ATIVIDADE DETECTADA:', ...args);
    originalLog('   Timestamp:', new Date().toISOString());
    originalLog('');
  }
  
  originalLog(...args);
};

console.error = function(...args) {
  const message = args.join(' ');
  
  if (message.includes('💾') || 
      message.includes('📊') || 
      message.includes('Tracking') ||
      message.includes('registerSent') ||
      message.includes('markCampaign')) {
    
    originalError('🚨 ERRO TRACKING:', ...args);
    originalError('   Timestamp:', new Date().toISOString());
    originalError('');
  }
  
  originalError(...args);
};

// Aguardar atividade
let counter = 0;
setInterval(() => {
  counter++;
  if (counter % 12 === 0) { // A cada 1 minuto
    process.stdout.write(`⏱️ Aguardando... ${counter/12}min\n`);
  } else {
    process.stdout.write('.');
  }
}, 5000);

// Interceptar sinais para finalizar graciosamente
process.on('SIGINT', () => {
  console.log('\n\n🛑 Monitor finalizado pelo usuário');
  process.exit(0);
});

console.log('✅ Monitor ativo! Use Ctrl+C para parar.');
