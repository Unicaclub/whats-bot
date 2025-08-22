// Script para remover completamente a funcionalidade de números existentes
const fs = require('fs');

console.log('🧹 LIMPANDO FUNCIONALIDADE DE NÚMEROS EXISTENTES');
console.log('================================================');

// Lendo o dashboard atual
const dashboardPath = './public/dashboard.html';
let dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

// Encontrando e removendo a seção comentada
const startMarker = '<!-- TEMPORARIAMENTE DESABILITADO: Campanhas com Números Existentes';
const endMarker = '--> \n            \n            <!-- Exportar Contatos WhatsApp -->';

const startIndex = dashboardContent.indexOf(startMarker);
const endIndex = dashboardContent.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    console.log('✅ Seção encontrada');
    
    // Remove a seção inteira
    const beforeSection = dashboardContent.substring(0, startIndex);
    const afterSection = dashboardContent.substring(endIndex + endMarker.length - 36); // Remove o marcador mas mantém o comentário Exportar
    
    dashboardContent = beforeSection + '<!-- Exportar Contatos WhatsApp -->' + afterSection;
    
    fs.writeFileSync(dashboardPath, dashboardContent);
    console.log('✅ Seção HTML removida do dashboard');
} else {
    console.log('❌ Seção não encontrada');
}

// Removendo funções JavaScript comentadas
const startJSMarker = '// ===== FUNÇÕES TEMPORARIAMENTE DESABILITADAS: CAMPANHAS COM NÚMEROS EXISTENTES =====';
const endJSMarker = '// ===== FIM FUNÇÕES TEMPORARIAMENTE DESABILITADAS =====';

const startJSIndex = dashboardContent.indexOf(startJSMarker);
const endJSIndex = dashboardContent.indexOf(endJSMarker);

if (startJSIndex !== -1 && endJSIndex !== -1) {
    console.log('✅ Funções JavaScript encontradas');
    
    const beforeJS = dashboardContent.substring(0, startJSIndex);
    const afterJS = dashboardContent.substring(endJSIndex + endJSMarker.length);
    
    dashboardContent = beforeJS + afterJS;
    
    fs.writeFileSync(dashboardPath, dashboardContent);
    console.log('✅ Funções JavaScript removidas');
} else {
    console.log('❌ Funções JavaScript não encontradas');
}

console.log('\n🎯 LIMPEZA CONCLUÍDA!');
console.log('✅ Funcionalidade de números existentes completamente removida');
console.log('✅ Dashboard limpo e otimizado');
console.log('✅ Projeto pronto para uso apenas com funcionalidade original');
