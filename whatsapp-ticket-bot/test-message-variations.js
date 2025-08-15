/**
 * TESTE DO SISTEMA DE GERAÇÃO DE VARIAÇÕES DE MENSAGENS
 * Execute este arquivo para testar as variações geradas
 */

const MessageVariationGenerator = require('./modules/MessageVariationGenerator');

async function testMessageVariations() {
  console.log('🎭 TESTE DO SISTEMA DE VARIAÇÕES DE MENSAGENS');
  console.log('=' .repeat(60));
  
  const generator = new MessageVariationGenerator();
  
  // Mensagens de teste
  const testMessages = [
    // Mensagem promocional
    `🔥 Oferta imperdível! 
Aproveite nosso desconto de 50% em todos os produtos!
Válido apenas hoje! 
Digite PROMO para mais informações. 🛍️`,
    
    // Mensagem de evento
    `🎉 MC DANIEL - O FALCÃO na ROYAL!
Ingressos à venda agora!
Não perca esta noite única!
Responda INGRESSO para garantir o seu! ✨`,
    
    // Mensagem de serviço
    `Olá! 👋
Estamos com uma nova promoção especial.
Entre em contato pelo WhatsApp (11) 99999-9999
ou acesse nosso site: https://exemplo.com.br
Código promocional: SAVE2024`,
    
    // Mensagem simples
    `Oi! Tudo bem?
Temos novidades incríveis para você.
Clique aqui para saber mais! 🚀`
  ];
  
  for (let i = 0; i < testMessages.length; i++) {
    console.log(`\n📝 TESTE ${i + 1}:`);
    console.log('MENSAGEM ORIGINAL:');
    console.log(testMessages[i]);
    console.log('\n🎭 VARIAÇÕES GERADAS:');
    console.log('-'.repeat(50));
    
    const variations = generator.generateVariations(testMessages[i]);
    
    variations.forEach((variation, index) => {
      console.log(`\n${index + 1}. ${variation}`);
    });
    
    console.log('\n' + '='.repeat(60));
  }
  
  // Teste de performance
  console.log('\n⚡ TESTE DE PERFORMANCE:');
  const startTime = Date.now();
  const performanceMessage = `🚀 Teste de performance para geração de variações!`;
  
  for (let i = 0; i < 100; i++) {
    generator.generateVariations(performanceMessage);
  }
  
  const endTime = Date.now();
  console.log(`✅ 100 gerações em ${endTime - startTime}ms`);
  console.log(`📊 Média: ${((endTime - startTime) / 100).toFixed(2)}ms por geração`);
  
  // Teste de consistência
  console.log('\n🔍 TESTE DE CONSISTÊNCIA:');
  const consistencyMessage = `Olá! Aproveite nossa promoção especial. Digite OFERTA para mais info.`;
  
  console.log('ORIGINAL:', consistencyMessage);
  console.log('\nGERAÇÃO 1:');
  generator.generateVariations(consistencyMessage).forEach((v, i) => {
    console.log(`${i + 1}. ${v}`);
  });
  
  console.log('\nGERAÇÃO 2 (deve ser diferente):');
  generator.generateVariations(consistencyMessage).forEach((v, i) => {
    console.log(`${i + 1}. ${v}`);
  });
}

// Executar teste se chamado diretamente
if (require.main === module) {
  testMessageVariations().catch(console.error);
}

module.exports = { testMessageVariations };
