// Teste simples para verificar se o número 556796848934 é aceito
const fs = require('fs');

// Função de validação copiada do app.js
function isValidBrazilianPhone(phoneNumber) {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const brazilianMobileRegex = /^55[1-9][1-9][6-9]\d{7}$/;
    return brazilianMobileRegex.test(cleanNumber);
}

// Teste do número
const testNumber = '556796848934';
console.log('🧪 TESTE SIMPLES DE VALIDAÇÃO');
console.log('==============================');
console.log(`📱 Número de teste: ${testNumber}`);
console.log(`✅ Válido: ${isValidBrazilianPhone(testNumber)}`);

// Teste com mais números para comparação
const moreNumbers = [
    '556796848934', // O número problema
    '5511999999999', // Número de SP
    '5521999999999', // Número do RJ
    '556799999999'   // Outro número de MT
];

console.log('\n📋 Teste com múltiplos números:');
moreNumbers.forEach(num => {
    console.log(`${num}: ${isValidBrazilianPhone(num) ? '✅' : '❌'}`);
});

// Teste criando um arquivo de campanha
const campaignContent = testNumber;
fs.writeFileSync('test-single-number.txt', campaignContent);
console.log('\n📄 Arquivo test-single-number.txt criado com o número 556796848934');
console.log('   Agora você pode testar uma campanha com este arquivo no dashboard');
