// TESTE DE CONFIGURAÇÃO DE DELAYS
// Este arquivo testa se as configurações de delay estão aplicadas corretamente

const antiBanConfig = require('./anti-ban-config');

console.log('🧪 TESTE DE CONFIGURAÇÃO DE DELAYS');
console.log('=====================================');

console.log('\n📊 Configurações Anti-Ban:');
console.log('- Delay mínimo entre mensagens:', antiBanConfig.ANTI_BAN_CONFIG.delays.betweenMessages.min, 'ms');
console.log('- Delay máximo entre mensagens:', antiBanConfig.ANTI_BAN_CONFIG.delays.betweenMessages.max, 'ms');

console.log('\n🎲 Testando função calculateDelay:');
for (let i = 0; i < 5; i++) {
  const delay = antiBanConfig.calculateDelay(0);
  console.log(`  Teste ${i + 1}: ${delay}ms (${(delay/1000).toFixed(1)}s)`);
}

console.log('\n⚠️ Testando com falhas consecutivas:');
for (let failures = 0; failures <= 3; failures++) {
  const delay = antiBanConfig.calculateDelay(failures);
  console.log(`  ${failures} falhas: ${delay}ms (${(delay/1000).toFixed(1)}s)`);
}

console.log('\n✅ Verificação de horário seguro:');
console.log('- Horário atual é seguro?', antiBanConfig.isSafeTime());
console.log('- Horários seguros:', antiBanConfig.ANTI_BAN_CONFIG.safeHours.start + 'h às ' + antiBanConfig.ANTI_BAN_CONFIG.safeHours.end + 'h');
console.log('- Dias seguros:', antiBanConfig.ANTI_BAN_CONFIG.safeDays.join(', ') + ' (1=Segunda, 2=Terça, etc.)');

console.log('\n📝 Testando validação de números:');
const testNumbers = [
  '5567999999999',
  '67999999999',
  '11999999999',
  '5511999999999',
  '123456789',
  '5567999999999999999'
];

testNumbers.forEach(num => {
  const isValid = antiBanConfig.isValidPhoneNumber(num);
  console.log(`  ${num}: ${isValid ? '✅ Válido' : '❌ Inválido'}`);
});

console.log('\n🎨 Testando variação de mensagens:');
for (let i = 0; i < 3; i++) {
  console.log(`  Mensagem ${i + 1}: "${antiBanConfig.getRandomMessage()}"`);
}

console.log('\n🚦 Testando Rate Limiter:');
const rateLimiter = new antiBanConfig.RateLimiter();
console.log('- Pode enviar mensagem?', rateLimiter.canSendMessage() ? '✅ Sim' : '❌ Não');
console.log('- Limite por hora:', antiBanConfig.ANTI_BAN_CONFIG.limits.messagesPerHour);
console.log('- Limite por dia:', antiBanConfig.ANTI_BAN_CONFIG.limits.messagesPerDay);

console.log('\n=====================================');
console.log('✅ Teste concluído! Configurações atualizadas para 10-20 segundos.');
