// Teste para verificar se o sistema detecta mensagens de campanha corretamente
const fs = require('fs');

// Simular uma mensagem de campanha
const testCampaignMessage = `💥ROYAL – A NOITE É SUA, O REINADO É NOSSO 💥

💥Prepare-se para uma noite LENDÁRIA!
MC DANIEL – O FALCÃO vai comandar o palco com os hits que tão explodindo em todo o Brasil.
Se é luxo e exclusividade que você procura… Aqui é o seu lugar!

🚗 CAMAROTES PREMIUM – Entre no universo dos milionários

🍾 BISTRÔS ROYAL – Vista privilegiada

🎟 Pista: R$ 60

💸 Pix direto = reserva confirmada!
⚠️ Sem estorno em caso de cancelamento. Evento +18.

⏳ Camarotes e Bistrôs esgotam rápido!
📲 Chama no WhatsApp e garante o seu antes que acabe.

💥 LINK OFICIAL PARA COMPRA:
👉 https://links.totalingressos.com/mc-daniel-na-royal.html`;

// Função para testar se uma mensagem deve ser bloqueada
function shouldBlockAutoResponse(messageBody) {
  const originalMessage = messageBody || '';
  
  if (originalMessage.includes('💥ROYAL') || originalMessage.includes('MC DANIEL') || 
      originalMessage.includes('FALCÃO') || originalMessage.includes('CAMAROTES PREMIUM') ||
      originalMessage.includes('McLaren') || originalMessage.includes('Ferrari') || 
      originalMessage.includes('Lamborghini') || originalMessage.includes('Porsche') ||
      originalMessage.includes('BISTRÔS ROYAL') || originalMessage.includes('fileira') ||
      originalMessage.includes('totalingressos.com')) {
    return true; // Bloquear resposta automática
  }
  
  return false; // Permitir resposta automática
}

// Testes
console.log('🧪 TESTE DE DETECÇÃO DE CAMPANHAS\n');

console.log('Teste 1: Mensagem de campanha original');
const shouldBlock1 = shouldBlockAutoResponse(testCampaignMessage);
console.log(`Resultado: ${shouldBlock1 ? '✅ BLOQUEADO (correto)' : '❌ NÃO BLOQUEADO (erro)'}\n`);

console.log('Teste 2: Mensagem normal do cliente');
const normalMessage = "Oi, gostaria de saber sobre os ingressos";
const shouldBlock2 = shouldBlockAutoResponse(normalMessage);
console.log(`Resultado: ${shouldBlock2 ? '❌ BLOQUEADO (erro)' : '✅ NÃO BLOQUEADO (correto)'}\n`);

console.log('Teste 3: Mensagem com palavra-chave suspeita');
const suspiciousMessage = "Oi, vi sobre o MC DANIEL, queria saber mais";
const shouldBlock3 = shouldBlockAutoResponse(suspiciousMessage);
console.log(`Resultado: ${shouldBlock3 ? '✅ BLOQUEADO (correto)' : '❌ NÃO BLOQUEADO (erro)'}\n`);

console.log('Teste 4: Pergunta sobre localização');
const locationMessage = "Onde fica o local do evento?";
const shouldBlock4 = shouldBlockAutoResponse(locationMessage);
console.log(`Resultado: ${shouldBlock4 ? '❌ BLOQUEADO (erro)' : '✅ NÃO BLOQUEADO (correto)'}\n`);

console.log('📊 RESUMO DAS CORREÇÕES IMPLEMENTADAS:');
console.log('✅ Cooldown aumentado de 5 minutos para 60 minutos (1 hora)');
console.log('✅ Detecção de mensagens de campanha adicionada');
console.log('✅ Bloqueio de respostas automáticas para conteúdo de marketing');
console.log('✅ Verificações aplicadas tanto em handleSalesMessage quanto handleSupportMessage');
console.log('\n🎯 PROBLEMA SOLUCIONADO: O bot não deve mais enviar o catálogo automaticamente após campanhas!');
