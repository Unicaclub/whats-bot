/**
 * TESTE DE PRESERVAÇÃO DE LINKS NO SISTEMA DE VARIAÇÕES
 * Demonstra que os links são mantidos intactos durante as variações
 */

const MessageVariationGenerator = require('./modules/MessageVariationGenerator');

// Instanciar o gerador
const generator = new MessageVariationGenerator();

// Mensagens de teste com diferentes tipos de links
const testMessages = [
    // Teste 1: Link HTTPS simples
    "🔥 Oferta imperdível! Aproveite o desconto especial em https://exemplo.com/oferta - não perca essa oportunidade única!",
    
    // Teste 2: Link com WWW
    "Olá! Confira nossa nova coleção em www.loja.com.br e garante já o seu desconto especial! 🎉",
    
    // Teste 3: Múltiplos links
    "Visite nosso site https://principal.com ou acesse www.backup.com para mais informações. Também temos conteúdo em blog.empresa.com.br",
    
    // Teste 4: Link com parâmetros
    "Clique em https://loja.com/produto?id=123&desconto=50 para garantir 50% OFF! Aproveite agora!",
    
    // Teste 5: Domínio sem protocolo
    "Acesse exemplo.com.br e confira as novidades! Digite SIM para mais informações.",
];

console.log('🧪 TESTE DE PRESERVAÇÃO DE LINKS');
console.log('='.repeat(60));

testMessages.forEach((message, index) => {
    console.log(`\n📝 TESTE ${index + 1}:`);
    console.log('Original:', message);
    console.log('\nLinks detectados:', generator.extractLinks(message));
    console.log('\n' + '-'.repeat(50));
    
    const variations = generator.generateVariations(message);
    
    variations.forEach((variation, varIndex) => {
        console.log(`Variação ${varIndex + 1}:`, variation);
        
        // Verificar se os links originais estão presentes
        const originalLinks = generator.extractLinks(message);
        const variationLinks = generator.extractLinks(variation);
        
        const linksPreserved = originalLinks.every(link => variation.includes(link));
        
        if (linksPreserved) {
            console.log('✅ Links preservados corretamente');
        } else {
            console.log('❌ ATENÇÃO: Links podem ter sido alterados!');
            console.log('Links originais:', originalLinks);
            console.log('Links na variação:', variationLinks);
        }
        console.log('');
    });
    
    console.log('='.repeat(60));
});

console.log('\n🎯 RESUMO DO TESTE:');
console.log('- Testados diferentes tipos de links (HTTPS, WWW, domínios simples)');
console.log('- Verificado se links são mantidos em todas as variações');
console.log('- Sistema implementa placeholders temporários para proteger links');
console.log('- Links são restaurados após aplicar variações de texto');
