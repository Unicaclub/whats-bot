// Script para exportar números processados
const fs = require('fs');
const path = require('path');

// Simular dados processados (você pode ajustar conforme necessário)
function createSampleNumbers(count = 4550) {
  const numbers = [];
  const ddds = ['11', '21', '31', '41', '51', '61', '67', '85', '81', '62'];
  
  for (let i = 1; i <= count; i++) {
    const ddd = ddds[Math.floor(Math.random() * ddds.length)];
    const numero = '9' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    const original = ddd + numero;
    const formatted = '55' + original + '@c.us';
    
    numbers.push({
      original: original,
      formatted: formatted,
      name: `Contato ${i}`,
      line: i,
      displayNumber: `+55 (${ddd}) ${numero.substring(0, 5)}-${numero.substring(5)}`
    });
  }
  
  return numbers;
}

// Função para exportar em CSV
function exportToCSV(numbers, filename) {
  let csvContent = 'numero_original,numero_formatado,numero_whatsapp,nome,linha\n';
  
  numbers.forEach(contact => {
    const whatsappNumber = contact.formatted.replace('@c.us', '');
    csvContent += `"${contact.original}","${whatsappNumber}","${contact.formatted}","${contact.name || ''}",${contact.line || ''}\n`;
  });
  
  fs.writeFileSync(filename, csvContent, 'utf8');
  console.log(`✅ Arquivo CSV criado: ${filename}`);
  console.log(`📊 Total de números: ${numbers.length}`);
}

// Função para exportar em TXT (apenas números)
function exportToTXT(numbers, filename) {
  const txtContent = numbers
    .map(contact => contact.formatted.replace('@c.us', ''))
    .join('\n');
  
  fs.writeFileSync(filename, txtContent, 'utf8');
  console.log(`✅ Arquivo TXT criado: ${filename}`);
  console.log(`📊 Total de números: ${numbers.length}`);
}

// Função para exportar em JSON
function exportToJSON(numbers, filename) {
  const jsonData = {
    exportedAt: new Date().toISOString(),
    total: numbers.length,
    numbers: numbers
  };
  
  fs.writeFileSync(filename, JSON.stringify(jsonData, null, 2), 'utf8');
  console.log(`✅ Arquivo JSON criado: ${filename}`);
  console.log(`📊 Total de números: ${numbers.length}`);
}

// Executar exportação
console.log('🚀 Iniciando exportação de números...');

// Verificar se existe dados reais ou usar dados de exemplo
let numbersToExport = [];

// Tentar carregar números reais se existirem
try {
  // Se você tem os números armazenados em algum lugar, carregue aqui
  // Por enquanto, vamos usar dados de exemplo
  console.log('⚠️ Usando dados de exemplo (4550 números)');
  numbersToExport = createSampleNumbers(4550);
} catch (error) {
  console.log('📝 Gerando dados de exemplo...');
  numbersToExport = createSampleNumbers(4550);
}

if (numbersToExport.length === 0) {
  console.log('❌ Nenhum número encontrado para exportar');
  process.exit(1);
}

// Criar diretório de exportação
const exportDir = path.join(__dirname, 'exports');
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

// Exportar em todos os formatos
const csvFile = path.join(exportDir, `numeros_${timestamp}.csv`);
const txtFile = path.join(exportDir, `numeros_${timestamp}.txt`);
const jsonFile = path.join(exportDir, `numeros_${timestamp}.json`);

exportToCSV(numbersToExport, csvFile);
exportToTXT(numbersToExport, txtFile);
exportToJSON(numbersToExport, jsonFile);

// Estatísticas
const dddStats = {};
numbersToExport.forEach(contact => {
  const ddd = contact.original.substring(0, 2);
  dddStats[ddd] = (dddStats[ddd] || 0) + 1;
});

console.log('\n📊 ESTATÍSTICAS:');
console.log(`📱 Total de números: ${numbersToExport.length}`);
console.log('📍 Top DDDs:');
Object.entries(dddStats)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 10)
  .forEach(([ddd, count]) => {
    console.log(`   ${ddd}: ${count} números`);
  });

console.log('\n📁 Arquivos exportados em:', exportDir);
console.log('✅ Exportação concluída!');
