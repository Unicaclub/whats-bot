// SISTEMA WHATSAPP MULTI-SESSÃO LIMPO - SEM SOCKET.IO COMPLEXO
require('dotenv').config();
const { OpenAI } = require('openai');
const express = require('express');
const { create } = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const xlsx = require('xlsx');

// Configurar OpenAI
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✅ OpenAI configurada');
  } else {
    console.log('⚠️ OPENAI_API_KEY não encontrada no .env');
  }
} catch (error) {
  console.error('❌ Erro ao configurar OpenAI:', error.message);
}

// Estados dos usuários para controle de fluxo
const userStates = {};

// Sessões multi-sessão (simplificado)
const sessions = {
  sales: {
    client: null,
    status: 'disconnected',
    lastActivity: null
  },
  support: {
    client: null,
    status: 'disconnected', 
    lastActivity: null
  }
};

// Função auxiliar para delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Classe para humanização do bot (simplificada)
class BotHumanizer {
  constructor() {
    this.typingStates = new Map();
  }

  generateSmartDelay(messageLength) {
    const baseDelay = Math.random() * (20000 - 10000) + 10000; // 10-20 segundos
    const lengthMultiplier = Math.min(messageLength / 100, 2);
    const finalDelay = baseDelay + (lengthMultiplier * 3000);
    return Math.min(finalDelay, 30000); // Máximo 30 segundos
  }

  async simulateHumanResponse(client, phoneNumber, response, originalMessage) {
    try {
      const delay = this.generateSmartDelay(response.length);
      const typingDuration = Math.min(delay * 0.8, 15000);
      
      console.log(`🤖 Humanizando resposta para ${phoneNumber}: delay ${(delay/1000).toFixed(1)}s`);
      
      await client.sendSeen(phoneNumber);
      await this.sleep(Math.random() * 3000 + 1000);
      
      await client.startTyping(phoneNumber);
      this.typingStates.set(phoneNumber, true);
      
      const typingPauses = Math.floor(typingDuration / 5000);
      for (let i = 0; i < typingPauses; i++) {
        await this.sleep(4000 + Math.random() * 2000);
        await client.stopTyping(phoneNumber);
        await this.sleep(500 + Math.random() * 1000);
        
        if (i < typingPauses - 1) {
          await client.startTyping(phoneNumber);
        }
      }
      
      await client.startTyping(phoneNumber);
      await this.sleep(Math.random() * 3000 + 2000);
      await client.stopTyping(phoneNumber);
      this.typingStates.set(phoneNumber, false);
      
      client
        .sendText(phoneNumber, response)
        .then((result) => {
          console.log(`✅ Resposta humanizada enviada para ${phoneNumber}:`, result.id);
          this.addHumanVariations(client, phoneNumber, response);
        })
        .catch((error) => {
          console.error(`❌ Erro ao enviar resposta humanizada:`, error);
          this.typingStates.set(phoneNumber, false);
        });
        
    } catch (error) {
      console.error('❌ Erro na humanização:', error);
      await client.stopTyping(phoneNumber);
      this.typingStates.set(phoneNumber, false);
    }
  }

  async addHumanVariations(client, phoneNumber, originalResponse) {
    if (Math.random() < 0.2) {
      const variations = ['😊', 'Espero ter ajudado!', 'Qualquer dúvida, é só chamar 👍', 'Fico à disposição!', '🎵'];
      const variation = variations[Math.floor(Math.random() * variations.length)];
      
      setTimeout(() => {
        client
          .sendText(phoneNumber, variation)
          .then(() => console.log(`✨ Variação humana enviada: ${variation}`))
          .catch((error) => console.error('❌ Erro variação:', error));
      }, Math.random() * 5000 + 2000);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isUserBeingServed(phoneNumber) {
    return this.typingStates.get(phoneNumber) || false;
  }
}

// Classe para processamento de arquivos
class FileProcessor {
  constructor() {
    this.supportedFormats = ['.csv', '.txt', '.xlsx', '.xls'];
  }

  async processFile(filePath, originalName) {
    const fileExt = path.extname(originalName).toLowerCase();
    console.log(`📁 Processando arquivo: ${originalName} (${fileExt})`);
    
    try {
      switch (fileExt) {
        case '.csv':
          return await this.processCSV(filePath);
        case '.txt':
          return await this.processTXT(filePath);
        case '.xlsx':
        case '.xls':
          return await this.processExcel(filePath);
        default:
          throw new Error(`Formato ${fileExt} não suportado`);
      }
    } catch (error) {
      console.error(`❌ Erro ao processar ${originalName}:`, error);
      throw error;
    }
  }

  async processCSV(filePath) {
    return new Promise((resolve, reject) => {
      const numbers = [];
      const errors = [];
      let lineNumber = 0;

      fs.createReadStream(filePath)
        .pipe(csv({
          separator: [',', ';', '\t'],
          skipEmptyLines: true,
          skipLinesWithError: true
        }))
        .on('data', (row) => {
          lineNumber++;
          
          const possibleNumber = this.extractPhoneNumber(row);
          
          if (possibleNumber) {
            const formatted = this.formatAndValidateNumber(possibleNumber);
            if (formatted.isValid) {
              numbers.push({
                original: possibleNumber,
                formatted: formatted.number,
                name: row.nome || row.name || `Contato ${lineNumber}`,
                line: lineNumber,
                displayNumber: formatted.displayNumber
              });
            } else {
              errors.push({
                line: lineNumber,
                original: possibleNumber,
                error: formatted.error
              });
            }
          } else {
            errors.push({
              line: lineNumber,
              original: JSON.stringify(row),
              error: 'Nenhum número de telefone encontrado'
            });
          }
        })
        .on('end', () => {
          console.log(`✅ CSV processado: ${numbers.length} números válidos, ${errors.length} erros`);
          resolve({ numbers, errors, type: 'csv' });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  async processTXT(filePath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
          return;
        }

        const lines = data.split('\n').filter(line => line.trim());
        const numbers = [];
        const errors = [];

        lines.forEach((line, index) => {
          const lineNumber = index + 1;
          const trimmedLine = line.trim();
          
          if (trimmedLine) {
            const formatted = this.formatAndValidateNumber(trimmedLine);
            if (formatted.isValid) {
              numbers.push({
                original: trimmedLine,
                formatted: formatted.number,
                name: `Contato ${lineNumber}`,
                line: lineNumber,
                displayNumber: formatted.displayNumber
              });
            } else {
              errors.push({
                line: lineNumber,
                original: trimmedLine,
                error: formatted.error
              });
            }
          }
        });

        console.log(`✅ TXT processado: ${numbers.length} números válidos, ${errors.length} erros`);
        resolve({ numbers, errors, type: 'txt' });
      });
    });
  }

  async processExcel(filePath) {
    return new Promise((resolve, reject) => {
      try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        const numbers = [];
        const errors = [];

        jsonData.forEach((row, index) => {
          const lineNumber = index + 1;
          
          if (row.length > 0) {
            const possibleNumber = this.extractPhoneFromRow(row);
            
            if (possibleNumber) {
              const formatted = this.formatAndValidateNumber(possibleNumber);
              if (formatted.isValid) {
                numbers.push({
                  original: possibleNumber,
                  formatted: formatted.number,
                  name: row[1] || `Contato ${lineNumber}`,
                  line: lineNumber,
                  displayNumber: formatted.displayNumber
                });
              } else {
                errors.push({
                  line: lineNumber,
                  original: possibleNumber,
                  error: formatted.error
                });
              }
            }
          }
        });

        console.log(`✅ Excel processado: ${numbers.length} números válidos, ${errors.length} erros`);
        resolve({ numbers, errors, type: 'excel' });
      } catch (error) {
        reject(error);
      }
    });
  }

  extractPhoneNumber(row) {
    const possibleFields = ['telefone', 'phone', 'numero', 'number', 'whatsapp', 'celular', 'mobile'];
    
    for (const field of possibleFields) {
      if (row[field]) {
        return String(row[field]).trim();
      }
    }
    
    const values = Object.values(row);
    for (const value of values) {
      const strValue = String(value).trim();
      if (this.looksLikePhoneNumber(strValue)) {
        return strValue;
      }
    }
    
    return null;
  }

  extractPhoneFromRow(row) {
    for (const cell of row) {
      if (cell && this.looksLikePhoneNumber(String(cell))) {
        return String(cell).trim();
      }
    }
    return null;
  }

  looksLikePhoneNumber(str) {
    const numbersOnly = str.replace(/\D/g, '');
    return numbersOnly.length >= 10 && numbersOnly.length <= 15;
  }

  formatAndValidateNumber(number) {
    let cleaned = String(number).replace(/\D/g, '');
    
    if (cleaned.length < 10) {
      return { isValid: false, error: 'Número muito curto' };
    }
    
    if (cleaned.length > 15) {
      return { isValid: false, error: 'Número muito longo' };
    }
    
    if (cleaned.length === 11 && cleaned.startsWith('11')) {
      cleaned = '55' + cleaned;
    } else if (cleaned.length === 11) {
      cleaned = '55' + cleaned;
    } else if (cleaned.length === 10) {
      cleaned = '5511' + cleaned;
    } else if (cleaned.length === 13 && cleaned.startsWith('55')) {
      // Já tem código do país
    } else if (cleaned.length === 12 && !cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }
    
    const whatsappNumber = cleaned + '@c.us';
    
    return {
      isValid: true,
      number: whatsappNumber,
      displayNumber: this.formatDisplayNumber(cleaned),
      error: null
    };
  }

  formatDisplayNumber(number) {
    if (number.length === 13 && number.startsWith('55')) {
      const ddd = number.substring(2, 4);
      const prefix = number.substring(4, 9);
      const suffix = number.substring(9);
      return `+55 (${ddd}) ${prefix}-${suffix}`;
    }
    return number;
  }
}

// Instanciar classes globalmente
const botHumanizer = new BotHumanizer();
const fileProcessor = new FileProcessor();

// Função para criar sessão de vendas
async function createSalesSession() {
  console.log('🛒 Iniciando sessão de VENDAS...');
  
  try {
    // Caminho explícito para o Chrome instalado pelo Puppeteer
    const chromePath = path.join(__dirname, 'chrome', 'win64-141.0.7351.0', 'chrome-win64', 'chrome.exe');
    
    const client = await create({
      session: 'sales',
      catchQR: (base64Qr, asciiQR) => {
        console.log('📱 QR Code VENDAS gerado');
        sessions.sales.status = 'qr_ready';
        
        const qrPath = path.join(__dirname, 'public', 'qr-sales.png');
        const base64Data = base64Qr.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(qrPath, base64Data, 'base64');
        console.log('✅ QR Code VENDAS salvo: qr-sales.png');
      },
      statusFind: (statusSession, session) => {
        console.log(`🛒 VENDAS - Estado: ${statusSession}`);
        sessions.sales.status = statusSession.toLowerCase();
        
        if (statusSession === 'CONNECTED') {
          console.log('✅ Bot VENDAS conectado com sucesso!');
          sessions.sales.status = 'connected';
        }
      },
      headless: true,
      devtools: false,
      debug: false,
      logQR: false,
      autoClose: 60000,
      disableSpins: true,
      puppeteerOptions: {
        headless: true,
        executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      }
    });

    // Manipulador de mensagens para vendas
    client.onMessage(async (message) => {
      try {
        if (message.isGroupMsg || message.from === 'status@broadcast') return;
        sessions.sales.lastActivity = new Date();
        console.log(`💰 VENDAS - ${message.from}: ${message.body}`);
        
        if (message.body === 'Hello') {
          await client.sendText(message.from, '🏆 Olá! Bem-vindo à ROYAL – A NOITE É SUA, O REINADO É NOSSO!');
          setTimeout(async () => {
            await client.sendText(message.from, '🔥 MC DANIEL – O FALCÃO vai comandar o palco! \n\nSe é luxo e exclusividade que você procura… Aqui é o seu lugar!\n\nDigite *EVENTOS* para ver todas as opções de ingressos e camarotes! 🎫✨');
          }, 1000);
        } else {
          await handleSalesMessage(client, message);
        }
      } catch (error) {
        console.error('❌ VENDAS - Erro no handler:', error);
      }
    });

    sessions.sales.client = client;
    return client;

  } catch (error) {
    console.error('❌ Erro ao criar sessão de vendas:', error);
    throw error;
  }
}

// Função para criar sessão de suporte
async function createSupportSession() {
  console.log('🛟 Iniciando sessão de SUPORTE...');
  
  try {
    // Caminho explícito para o Chrome instalado pelo Puppeteer
    const chromePath = path.join(__dirname, 'chrome', 'win64-141.0.7351.0', 'chrome-win64', 'chrome.exe');
    
    const client = await create({
      session: 'support',
      catchQR: (base64Qr, asciiQR) => {
        console.log('📱 QR Code SUPORTE gerado');
        sessions.support.status = 'qr_ready';
        
        const qrPath = path.join(__dirname, 'public', 'qr-support.png');
        const base64Data = base64Qr.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(qrPath, base64Data, 'base64');
        console.log('✅ QR Code SUPORTE salvo: qr-support.png');
      },
      statusFind: (statusSession, session) => {
        console.log(`🛟 SUPORTE - Estado: ${statusSession}`);
        sessions.support.status = statusSession.toLowerCase();
        
        if (statusSession === 'CONNECTED') {
          console.log('✅ Bot SUPORTE conectado com sucesso!');
          sessions.support.status = 'connected';
        }
      },
      headless: true,
      devtools: false,
      debug: false,
      logQR: false,
      autoClose: 60000,
      disableSpins: true,
      puppeteerOptions: {
        headless: true,
        executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      }
    });

    // Manipulador de mensagens para suporte
    client.onMessage(async (message) => {
      try {
        if (message.isGroupMsg || message.from === 'status@broadcast') return;
        sessions.support.lastActivity = new Date();
        console.log(`🛟 SUPORTE - ${message.from}: ${message.body}`);
        
        if (message.body === 'Hello') {
          client.sendText(message.from, '🛟 Olá! Este é o suporte da Casa de Show. Como posso ajudar?')
            .then((result) => console.log('✅ SUPORTE - Resposta enviada:', result.id))
            .catch((erro) => console.error('❌ SUPORTE - Erro ao enviar:', erro));
        } else {
          await handleSupportMessage(client, message);
        }
      } catch (error) {
        console.error('❌ SUPORTE - Erro no handler:', error);
      }
    });

    sessions.support.client = client;
    return client;

  } catch (error) {
    console.error('❌ Erro ao criar sessão de suporte:', error);
    throw error;
  }
}

// Funções de mensagem humanizadas
async function handleSalesMessage(client, message) {
  const userId = message.from;
  const userMessage = (message.body || '').toLowerCase();
  
  if (botHumanizer.isUserBeingServed(userId)) {
    console.log(`⏳ ${userId} já está sendo atendido, ignorando mensagem`);
    return;
  }
  
  // Verificar se a pergunta é sobre localização ANTES de qualquer processamento
  console.log(`🔍 Verificando localização para: "${userMessage}"`);
  if (userMessage.includes('localização') || userMessage.includes('localizacao') || 
      userMessage.includes('endereço') || userMessage.includes('endereco') || 
      userMessage.includes('onde fica') || userMessage.includes('onde é') || 
      userMessage.includes('local') || userMessage.includes('lugar') || 
      userMessage.includes('como chegar') || userMessage.includes('mapa') || 
      userMessage.includes('google maps') || userMessage.includes('maps') ||
      userMessage.includes('rua') || userMessage.includes('avenida') || 
      userMessage.includes('bairro') || userMessage.includes('cidade')) {
    
    console.log(`📍 LOCALIZAÇÃO DETECTADA! Enviando resposta...`);
    const response = `📍 *LOCALIZAÇÃO DA ROYAL*

🏢 **Endereço:**
Av. Arquiteto Rubens Gil de Camillo, 20
Chácara Cachoeira
Campo Grande - MS
CEP: 79040-090

🗺️ **Localização no Mapa:**
👉 https://maps.app.goo.gl/kS7oyF2kXVQZtp9C7

🚗 *Fácil acesso!*
🎯 *Localização privilegiada em Campo Grande!*

Para mais informações sobre o evento, digite *EVENTOS*!`;
    
    await botHumanizer.simulateHumanResponse(client, userId, response, userMessage);
    console.log(`✅ Resposta de localização enviada para ${userId}`);
    return;
  }

  // Verificar se a pergunta é sobre camarote ou bistro
  if (userMessage.includes('camarote') || userMessage.includes('camarotes') || 
      userMessage.includes('bistro') || userMessage.includes('bistros') || 
      userMessage.includes('bistrô') || userMessage.includes('bistrôs')) {
    
    const response = `👤 *ATENDIMENTO PERSONALIZADO*

Para um atendimento completo e personalizado, fale diretamente com nossa equipe:

📲 *WhatsApp Atendimento:*
👉 https://wa.me/556792941631

Nossa equipe está disponível para:
✅ Informações sobre eventos
✅ Dúvidas sobre ingressos
✅ Suporte especializado
✅ Atendimento VIP

⏰ *Horário de atendimento:* 
Segunda a Domingo - 10h às 22h`;
    
    await botHumanizer.simulateHumanResponse(client, userId, response, userMessage);
    return;
  }

  if (!userStates[userId]) {
    userStates[userId] = {
      step: 'inicio',
      cart: [],
      total: 0,
      session: 'sales'
    };
  }
  
  const userState = userStates[userId];
  
  try {
    let response;
    let shouldHumanize = true;
    
    switch (userState.step) {
      case 'inicio':
        if (userMessage.includes('oi') || userMessage.includes('ola') || userMessage.includes('hello')) {
          response = `🏆 *Bem-vindo à ROYAL – A NOITE É SUA, O REINADO É NOSSO!*

🔥 Prepare-se para uma noite LENDÁRIA!
🎤 MC DANIEL – O FALCÃO vai comandar o palco com os hits que tão explodindo em todo o Brasil!

🛒 *MENU DE OPÇÕES:*
1️⃣ Ver *EVENTOS* completos
2️⃣ *RESERVAR* bistrôs e camarotes
3️⃣ Falar com *ATENDIMENTO*

💰 *Formas de pagamento:* PIX, Cartão
🚚 *Entrega:* Digital (WhatsApp) ou Retirada

Digite o *número* da opção desejada!`;
          userState.step = 'menu';
        } else {
          // Qualquer outra mensagem também mostra o menu
          response = `🏆 *Bem-vindo à ROYAL – A NOITE É SUA, O REINADO É NOSSO!*

🔥 Prepare-se para uma noite LENDÁRIA!
🎤 MC DANIEL – O FALCÃO vai comandar o palco com os hits que tão explodindo em todo o Brasil!

🛒 *MENU DE OPÇÕES:*
1️⃣ Ver *EVENTOS* completos
2️⃣ *RESERVAR* bistrôs e camarotes
3️⃣ Falar com *ATENDIMENTO*

💰 *Formas de pagamento:* PIX, Cartão
🚚 *Entrega:* Digital (WhatsApp) ou Retirada

Digite o *número* da opção desejada!`;
          userState.step = 'menu';
        }
        break;
        
      case 'menu':
        if (userMessage.includes('1') || userMessage.includes('eventos') || userMessage.includes('evento') || userMessage.includes('cardapio') || userMessage.includes('cardápio')) {
          response = await generateCatalogResponse();
          userState.step = 'catalogo';
        } else if (userMessage.includes('2') || userMessage.includes('reservar') || userMessage.includes('reserva') || userMessage.includes('bistro') || userMessage.includes('camarote')) {
          response = `🍾 *RESERVAS BISTRÔS E CAMAROTES*

Para fazer sua reserva e garantir o melhor lugar na casa, entre em contato diretamente com nossa equipe especializada:

📲 *WhatsApp para Reservas:*
👉 https://wa.me/556792941631

Nossa equipe está pronta para:
✅ Tirar todas suas dúvidas
✅ Fazer sua reserva personalizada  
✅ Oferecer as melhores condições
✅ Garantir sua mesa/camarote

💰 *Condições especiais disponíveis!*
🏆 *Atendimento VIP exclusivo!*`;
          shouldHumanize = false;
        } else if (userMessage.includes('3') || userMessage.includes('atendimento')) {
          response = `👤 *ATENDIMENTO PERSONALIZADO*

Para um atendimento completo e personalizado, fale diretamente com nossa equipe:

📲 *WhatsApp Atendimento:*
👉 https://wa.me/556792941631

Nossa equipe está disponível para:
✅ Informações sobre eventos
✅ Dúvidas sobre ingressos
✅ Suporte especializado
✅ Atendimento VIP

⏰ *Horário de atendimento:* 
Segunda a Domingo - 10h às 22h`;
          shouldHumanize = false;
        } else {
          // Opção inválida - mostra o menu novamente
          response = `❌ *Opção inválida!*

🛒 *MENU DE OPÇÕES:*
1️⃣ Ver *EVENTOS* completos
2️⃣ *RESERVAR* bistrôs e camarotes
3️⃣ Falar com *ATENDIMENTO*

Digite o *número* da opção desejada (1, 2 ou 3)!`;
          // Mantém no step 'menu' para continuar aguardando opção válida
        }
        break;
        
      case 'catalogo':
        response = await handleCatalogSelection(userMessage);
        break;
        
      default:
        response = await generateCatalogResponse();
        userState.step = 'catalogo';
        break;
    }
    
    userStates[userId] = userState;
    
    if (shouldHumanize) {
      await botHumanizer.simulateHumanResponse(client, userId, response, userMessage);
    } else {
      await client.sendSeen(userId);
      await client.startTyping(userId);
      await sleep(1000 + Math.random() * 2000);
      await client.stopTyping(userId);
      
      client
        .sendText(userId, response)
        .then((result) => console.log('✅ Resposta rápida enviada:', result.id))
        .catch((error) => console.error('❌ Erro resposta rápida:', error));
    }
    
  } catch (error) {
    console.error('❌ Erro no handleSalesMessage:', error);
    await client.stopTyping(userId);
    await client.sendText(userId, '❌ Ops! Ocorreu um erro. Digite *menu* para voltar ao início.');
  }
}

async function handleSupportMessage(client, message) {
  const userId = message.from;
  const userMessage = (message.body || '').toLowerCase();
  
  if (botHumanizer.isUserBeingServed(userId)) {
    console.log(`⏳ ${userId} já está sendo atendido, ignorando mensagem`);
    return;
  }
  
  try {
    let response;
    
    // Verificar se a pergunta é sobre localização
    if (userMessage.includes('localização') || userMessage.includes('localizacao') || 
        userMessage.includes('endereço') || userMessage.includes('endereco') || 
        userMessage.includes('onde fica') || userMessage.includes('onde é') || 
        userMessage.includes('local') || userMessage.includes('lugar') || 
        userMessage.includes('como chegar') || userMessage.includes('mapa') || 
        userMessage.includes('google maps') || userMessage.includes('maps') ||
        userMessage.includes('rua') || userMessage.includes('avenida') || 
        userMessage.includes('bairro') || userMessage.includes('cidade')) {
      
      response = `📍 *LOCALIZAÇÃO DA ROYAL*

🏢 **Endereço:**
Av. Arquiteto Rubens Gil de Camillo, 20
Chácara Cachoeira
Campo Grande - MS
CEP: 79040-090

🗺️ **Localização no Mapa:**
👉 https://maps.app.goo.gl/kS7oyF2kXVQZtp9C7

🚗 *Fácil acesso!*
🎯 *Localização privilegiada em Campo Grande!*

🛟 Para mais informações, acesse:
👉 https://links.totalingressos.com/mc-daniel-na-royal.html`;
      
      await botHumanizer.simulateHumanResponse(client, userId, response, userMessage);
      return;
    }

    // Verificar se a pergunta é sobre camarote ou bistro
    if (userMessage.includes('camarote') || userMessage.includes('camarotes') || 
        userMessage.includes('bistro') || userMessage.includes('bistros') || 
        userMessage.includes('bistrô') || userMessage.includes('bistrôs')) {
      
      response = `👤 *ATENDIMENTO PERSONALIZADO*

Para um atendimento completo e personalizado, fale diretamente com nossa equipe:

📲 *WhatsApp Atendimento:*
👉 https://wa.me/556792941631

Nossa equipe está disponível para:
✅ Informações sobre eventos
✅ Dúvidas sobre ingressos
✅ Suporte especializado
✅ Atendimento VIP

⏰ *Horário de atendimento:* 
Segunda a Domingo - 10h às 22h`;
      
      await botHumanizer.simulateHumanResponse(client, userId, response, userMessage);
      return;
    }
    
    if (!openai) {
      response = '🛟 Olá! Sou o suporte da Royal. Como posso ajudar?\n\nPara informações sobre ingressos, acesse:\n👉 https://links.totalingressos.com/mc-daniel-na-royal.html';
      await botHumanizer.simulateHumanResponse(client, userId, response, userMessage);
      return;
    }
    
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Você é um assistente de suporte da casa de shows ROYAL. O evento é com MC DANIEL. Seja prestativo e direto. Sempre indique o link oficial: https://links.totalingressos.com/mc-daniel-na-royal.html"
        },
        {
          role: "user", 
          content: userMessage
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    });
    
    response = `🛟 ${aiResponse.choices[0].message.content}`;
    await botHumanizer.simulateHumanResponse(client, userId, response, userMessage);
    
  } catch (error) {
    console.error('❌ Erro OpenAI:', error);
    const fallbackResponse = '🛟 Olá! Sou o suporte da Royal. Para informações sobre ingressos, acesse:\n👉 https://links.totalingressos.com/mc-daniel-na-royal.html';
    await botHumanizer.simulateHumanResponse(client, userId, fallbackResponse, userMessage);
  }
}

// Funções auxiliares para gerar respostas
async function generateCatalogResponse() {
  return `🏆 *ROYAL – EVENTOS DISPONÍVEIS*

🚗 *CAMAROTES PREMIUM – Entre no universo dos milionários*

🏎️ *McLaren, Ferrari, Lamborghini, Porsche*
💰 R$ 6.000 | 💳 Consumo: R$ 2.500 | 🎟 4 entradas incluídas

🚗 *Porsche*
💰 R$ 5.000 | 💳 Consumo: R$ 2.000 | 🎟 4 entradas incluídas

🚙 *Bugatti, Rolls Royce, Jaguar, Mercedes-Benz*
💰 R$ 4.000 | 💳 Consumo: R$ 1.500 | 🎟 4 entradas incluídas

🏁 *Royal, BMW, Aston Martin, Land Rover*
💰 R$ 4.000 | 💳 Consumo: R$ 1.500 | 🎟 4 entradas incluídas

⸻

🍾 *BISTRÔS ROYAL – Assista o show de pertinho*

🥇 *1ª fileira* – R$ 700 | Consumo: R$ 300 | 🎟 2 entradas incluídas
🥈 *2ª fileira* – R$ 600 | Consumo: R$ 300 | 🎟 2 entradas incluídas  
🥉 *3ª fileira* – R$ 500 | Consumo: R$ 250 | 🎟 2 entradas incluídas
4️⃣ *4ª fileira* – R$ 400 | Consumo: R$ 200 | 🎟 2 entradas incluídas

⸻

🎟 *Ingressos Individuais*
🎪 *Pista* – R$ 60

⸻

💥 *LINK OFICIAL PARA COMPRA:*
👉 https://links.totalingressos.com/mc-daniel-na-royal.html

💸 *Pix direto = reserva confirmada!*
⚠️ Sem estorno em caso de cancelamento. Evento +18.`;
}

async function generatePromotionsResponse() {
  return `🔥 *ROYAL – PROMOÇÕES ESPECIAIS*

💸 *PIX DIRETO = RESERVA CONFIRMADA!*
⚡ Pagamento instantâneo e lugar garantido

🏆 *CAMAROTES ESGOTANDO RÁPIDO!*
🚗 McLaren, Ferrari, Lamborghini limitados
🍾 Bistrôs com vista privilegiada

🎫 *LINK OFICIAL PARA COMPRA:*
👉 https://links.totalingressos.com/mc-daniel-na-royal.html

⚠️ *IMPORTANTE:*
• Sem estorno em caso de cancelamento
• Evento +18 anos
• Camarotes e Bistrôs esgotam primeiro

📲 *Chama no WhatsApp para garantir:*
Digite *EVENTOS* para ver todas as opções!`;
}

async function handleCatalogSelection(userMessage) {
  if (userMessage.includes('link') || userMessage.includes('comprar') || userMessage.includes('site')) {
    return `🎫 *LINK OFICIAL PARA COMPRA:*
👉 https://links.totalingressos.com/mc-daniel-na-royal.html

💸 Pix direto = reserva confirmada!
⚠️ Sem estorno em caso de cancelamento. Evento +18.

Para mais informações, digite *EVENTOS* ou entre em contato conosco!`;
  } else {
    return `Para comprar ingressos acesse:
👉 https://links.totalingressos.com/mc-daniel-na-royal.html

Ou digite *EVENTOS* para ver todas as opções novamente!`;
  }
}

// Função para envio de campanha humanizada (simplificada)
async function sendHumanizedCampaign(client, numbers, message, sessionName) {
  const results = { sent: 0, failed: 0, errors: [] };
  
  console.log(`📢 Iniciando campanha humanizada ${sessionName} para ${numbers.length} números...`);
  
  for (let i = 0; i < numbers.length; i++) {
    try {
      const number = numbers[i];
      const formattedNumber = number.includes('@c.us') ? number : number + '@c.us';
      
      console.log(`📱 ${sessionName} - Enviando ${i + 1}/${numbers.length} para ${number}...`);
      
      await client.sendSeen(formattedNumber);
      await sleep(Math.random() * 3000 + 2000);
      
      await client.startTyping(formattedNumber);
      await sleep(Math.random() * 5000 + 3000);
      await client.stopTyping(formattedNumber);
      
      await client.sendText(formattedNumber, message);
      
      results.sent++;
      console.log(`✅ ${sessionName} - Enviado humanizado para ${number}`);
      
      if (i < numbers.length - 1) {
        const campaignDelay = Math.random() * (5000 - 1000) + 1000; // 1-5 segundos
        console.log(`⏳ Aguardando ${(campaignDelay/1000).toFixed(1)}s antes da próxima mensagem...`);
        await sleep(campaignDelay);
      }
      
    } catch (error) {
      results.failed++;
      results.errors.push({ number: numbers[i], error: error.message });
      console.error(`❌ ${sessionName} - Erro para ${numbers[i]}:`, error.message);
    }
  }
  
  console.log(`📊 Campanha humanizada ${sessionName} finalizada: ${results.sent} enviadas, ${results.failed} falhas`);
  return results;
}

// Interface web simplificada
function startWebInterface() {
  const app = express();
  
  app.use(express.static('public'));
  app.use(express.json());
  
  // Configurar multer para upload
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = 'uploads/';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const originalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
      cb(null, `${timestamp}_${originalName}`);
    }
  });

  const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['.csv', '.txt', '.xlsx', '.xls'];
      const fileExt = path.extname(file.originalname).toLowerCase();
      
      if (allowedTypes.includes(fileExt)) {
        cb(null, true);
      } else {
        cb(new Error('Tipo de arquivo não suportado. Use CSV, TXT ou Excel.'));
      }
    }
  });
  
  // Rota principal
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  });
  
  // API para iniciar sessões
  app.post('/api/sessions/:sessionName/start', async (req, res) => {
    try {
      const { sessionName } = req.params;
      
      if (sessionName === 'sales') {
        await createSalesSession();
      } else if (sessionName === 'support') {
        await createSupportSession();
      } else {
        return res.status(400).json({ 
          success: false, 
          message: 'Sessão inválida' 
        });
      }
      
      res.json({ 
        success: true, 
        message: `Sessão ${sessionName} iniciada` 
      });
      
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  });
  
  // API para parar sessões
  app.post('/api/sessions/:sessionName/stop', async (req, res) => {
    try {
      const { sessionName } = req.params;
      
      if (sessions[sessionName]?.client) {
        await sessions[sessionName].client.close();
        sessions[sessionName] = {
          client: null,
          status: 'disconnected',
          lastActivity: null
        };
      }
      
      res.json({ 
        success: true, 
        message: `Sessão ${sessionName} parada` 
      });
      
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  });

  // Upload de arquivo
  app.post('/api/upload/numbers', upload.single('numbersFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Nenhum arquivo foi enviado'
        });
      }

      const fileInfo = {
        id: Date.now(),
        originalName: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        uploadedAt: new Date(),
        processed: false
      };

      global.uploadedFiles = global.uploadedFiles || new Map();
      global.uploadedFiles.set(fileInfo.id, fileInfo);

      res.json({
        success: true,
        message: 'Arquivo enviado com sucesso! Clique em "Processar" para extrair os números.',
        fileInfo: {
          id: fileInfo.id,
          name: fileInfo.originalName,
          size: `${(fileInfo.size / 1024).toFixed(1)} KB`,
          type: path.extname(fileInfo.originalName)
        }
      });

    } catch (error) {
      console.error('❌ Erro no upload:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao fazer upload: ' + error.message
      });
    }
  });

  // Processar arquivo carregado
  app.post('/api/upload/process/:fileId', async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);
      const fileInfo = global.uploadedFiles?.get(fileId);

      if (!fileInfo) {
        return res.status(404).json({
          success: false,
          message: 'Arquivo não encontrado'
        });
      }

      console.log(`🔄 Processando arquivo: ${fileInfo.originalName}`);

      const result = await fileProcessor.processFile(fileInfo.path, fileInfo.originalName);
      
      fileInfo.processed = true;
      fileInfo.processedAt = new Date();
      fileInfo.result = result;

      global.lastProcessedNumbers = result.numbers.map(contact => ({
        original: contact.original,
        formatted: contact.formatted,
        name: contact.name,
        line: contact.line,
        displayNumber: contact.displayNumber || contact.original
      }));

      const responseData = {
        totalLines: result.numbers.length + result.errors.length,
        validNumbers: result.numbers.length,
        errors: result.errors.length,
        numbers: result.numbers.slice(0, 50).map(contact => ({
          original: contact.original,
          formatted: contact.formatted,
          name: contact.name,
          line: contact.line,
          displayNumber: contact.displayNumber || contact.original
        })),
        hasMore: result.numbers.length > 50,
        errorSample: result.errors.slice(0, 10).map(error => ({
          line: error.line,
          original: String(error.original).substring(0, 100),
          error: String(error.error).substring(0, 100)
        }))
      };

      res.json({
        success: true,
        message: `Arquivo processado com sucesso!`,
        data: responseData
      });

    } catch (error) {
      console.error('❌ Erro ao processar arquivo:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao processar arquivo: ' + error.message
      });
    }
  });

  // Envio de campanhas
  app.post('/api/campaigns/send', async (req, res) => {
    try {
      const { sessionName = 'sales', message, numbers } = req.body;
      const client = sessions[sessionName]?.client;
      
      if (!client) {
        return res.status(400).json({ 
          success: false, 
          message: `Sessão ${sessionName} não conectada` 
        });
      }
      
      if (!message || !message.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Mensagem não pode estar vazia'
        });
      }
      
      let numbersToSend = [];
      
      if (numbers && numbers.length > 0) {
        numbersToSend = numbers;
      } else if (global.lastProcessedNumbers && global.lastProcessedNumbers.length > 0) {
        numbersToSend = global.lastProcessedNumbers.map(contact => contact.formatted);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Nenhum número válido encontrado para envio'
        });
      }
      
      if (!numbersToSend || numbersToSend.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Nenhum número válido encontrado para envio'
        });
      }
      
      console.log(`📢 Iniciando campanha humanizada ${sessionName} para ${numbersToSend.length} números...`);
      
      sendHumanizedCampaign(client, numbersToSend, message, sessionName)
        .then(results => {
          console.log(`📊 Campanha ${sessionName} finalizada: ${results.sent} enviadas, ${results.failed} falhas`);
        })
        .catch(error => {
          console.error(`❌ Erro na campanha ${sessionName}:`, error);
        });
      
      res.json({
        success: true,
        message: `Campanha humanizada iniciada via ${sessionName}!`,
        results: {
          total: numbersToSend.length,
          status: 'iniciada'
        }
      });
      
    } catch (error) {
      console.error('❌ Erro na API de campanha:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao enviar campanha: ' + error.message
      });
    }
  });
  
  const PORT = process.env.PORT || 3005;
  app.listen(PORT, () => {
    console.log(`🌐 Interface web multi-sessão: http://localhost:${PORT}`);
  });
}

// Função principal
async function initializeSystem() {
  console.log('🚀 Iniciando sistema multi-sessão WhatsApp LIMPO...');
  
  const dirs = ['uploads', 'logs', 'tokens'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  startWebInterface();
  
  setTimeout(() => {
    console.log('');
    console.log('🌐 Sistema LIMPO pronto!');
    console.log('📱 Acesse: http://localhost:' + (process.env.PORT || 3005));
    console.log('🛒 Use a interface para conectar as sessões');
    console.log('');
  }, 3000);
}

// Inicializar variáveis globais
global.lastProcessedNumbers = [];
global.uploadedFiles = new Map();

// EXECUTAR
initializeSystem().catch(console.error);
