// CONFIGURAR OpenAI
require('dotenv').config();
const { OpenAI } = require('openai');
const express = require('express');
const { create } = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const http = require('http');
const socketIo = require('socket.io');

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

// Sessões multi-sessão
const sessions = {
  sales: {
    client: null,
    status: 'disconnected',
    qrCode: null,
    lastActivity: null
  },
  support: {
    client: null,
    status: 'disconnected', 
    qrCode: null,
    lastActivity: null
  }
};

// Função auxiliar para delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função para criar sessão de vendas
async function createSalesSession() {
  console.log('🛒 Iniciando sessão de VENDAS...');
  
  try {
    const client = await create({
      session: 'sales',
      catchQR: (base64Qr, asciiQR) => {
        console.log('📱 QR Code VENDAS:');
        console.log(asciiQR);
        
        sessions.sales.qrCode = base64Qr;
        sessions.sales.status = 'qr_ready';
        
        // Salvar QR como imagem
        const qrPath = path.join(__dirname, 'public', 'qr-sales.png');
        const base64Data = base64Qr.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(qrPath, base64Data, 'base64');
        console.log('✅ QR Code VENDAS salvo e disponível na web');
        
        // Emitir QR via Socket.IO
        if (global.io) {
          global.io.emit('qrCode', {
            session: 'sales',
            qrCode: base64Qr
          });
        }
      },
      statusFind: (statusSession, session) => {
        console.log(`🛒 VENDAS - Estado: ${statusSession}`);
        sessions.sales.status = statusSession.toLowerCase();
        
        if (global.io) {
          global.io.emit('session_status', {
            session: 'sales',
            status: statusSession.toLowerCase()
          });
        }
        
        if (statusSession === 'CONNECTED') {
          console.log('✅ Bot VENDAS conectado com sucesso!');
          console.log('🛒 Sistema de VENDAS ativo');
          sessions.sales.status = 'connected';
        }
      },
      headless: true,
      devtools: false,
      debug: false,
      logQR: false,
      autoClose: 60000,
      disableSpins: true,
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
            await client.sendText(message.from, '🔥 MC DANIEL – O FALCÃO vai comandar o palco! \n\nSe é luxo e exclusividade que você procura… Aqui é o seu lugar!\n\nDigite *CARDAPIO* para ver todas as opções de ingressos e camarotes! 🎫✨');
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
    const client = await create({
      session: 'support',
      catchQR: (base64Qr, asciiQR) => {
        console.log('📱 QR Code SUPORTE:');
        console.log(asciiQR);
        
        sessions.support.qrCode = base64Qr;
        sessions.support.status = 'qr_ready';
        
        // Salvar QR como imagem
        const qrPath = path.join(__dirname, 'public', 'qr-support.png');
        const base64Data = base64Qr.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(qrPath, base64Data, 'base64');
        console.log('✅ QR Code SUPORTE salvo e disponível na web');
        
        // Emitir QR via Socket.IO
        if (global.io) {
          global.io.emit('qrCode', {
            session: 'support',
            qrCode: base64Qr
          });
        }
      },
      statusFind: (statusSession, session) => {
        console.log(`🛟 SUPORTE - Estado: ${statusSession}`);
        sessions.support.status = statusSession.toLowerCase();
        
        if (global.io) {
          global.io.emit('session_status', {
            session: 'support',
            status: statusSession.toLowerCase()
          });
        }
        
        if (statusSession === 'CONNECTED') {
          console.log('✅ Bot SUPORTE conectado com sucesso!');
          console.log('🛟 Sistema de SUPORTE ativo');
          sessions.support.status = 'connected';
        }
      },
      headless: true,
      devtools: false,
      debug: false,
      logQR: false,
      autoClose: 60000,
      disableSpins: true,
    });

    // Manipulador de mensagens para suporte
    client.onMessage(async (message) => {
      try {
        if (message.isGroupMsg || message.from === 'status@broadcast') return;
        sessions.support.lastActivity = new Date();
        console.log(`🛟 SUPORTE - ${message.from}: ${message.body}`);
        if (message.body === 'Hello') {
          client.sendText(message.from, '🛟 Olá! Este é o suporte da Casa de Show. Como posso ajudar?')
            .then((result) => {
              console.log('✅ SUPORTE - Resposta enviada:', result.id);
            })
            .catch((erro) => {
              console.error('❌ SUPORTE - Erro ao enviar:', erro);
            });
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

// Funções de mensagem
async function handleSalesMessage(client, message) {
  const userId = message.from;
  const userMessage = (message.body || '').toLowerCase();
  
  // Inicializar estado do usuário se não existir
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
    // Simular digitação
    await client.startTyping(userId);
    
    // Máquina de estados
    switch (userState.step) {
      case 'inicio':
        if (userMessage.includes('oi') || userMessage.includes('ola') || userMessage.includes('hello')) {
          await client.sendText(userId, `🏆 *Bem-vindo à ROYAL – A NOITE É SUA, O REINADO É NOSSO!*

🔥 Prepare-se para uma noite LENDÁRIA!
🎤 MC DANIEL – O FALCÃO vai comandar o palco com os hits que tão explodindo em todo o Brasil!

🛒 *MENU DE OPÇÕES:*
1️⃣ Ver *CARDAPIO* completo
2️⃣ Ver *PROMOCOES* especiais
3️⃣ Falar com *ATENDIMENTO*
4️⃣ Ver meu *CARRINHO*

💰 *Formas de pagamento:* PIX, Cartão
🚚 *Entrega:* Digital (WhatsApp) ou Retirada

Digite o *número* da opção desejada!`);
          userState.step = 'menu';
        } else {
          await showCatalog(client, userId);
        }
        break;
        
      case 'menu':
        if (userMessage.includes('1') || userMessage.includes('catalogo') || userMessage.includes('catálogo') || userMessage.includes('cardapio') || userMessage.includes('cardápio')) {
          await showCatalog(client, userId);
        } else if (userMessage.includes('2') || userMessage.includes('promocao') || userMessage.includes('promoção') || userMessage.includes('promocoes') || userMessage.includes('promoções')) {
          await showPromotions(client, userId);
        } else if (userMessage.includes('3') || userMessage.includes('atendimento')) {
          await client.sendText(userId, '👤 Transferindo para atendimento humano...\n\n⏰ Em breve um de nossos atendentes entrará em contato!');
        } else if (userMessage.includes('4') || userMessage.includes('carrinho')) {
          await showCart(client, userId);
        } else {
          await showCatalog(client, userId);
        }
        break;
        
      case 'catalogo':
        await handleCatalogSelection(client, userId, userMessage);
        break;
        
      case 'quantidade':
        await handleQuantitySelection(client, userId, userMessage);
        break;
        
      default:
        await showCatalog(client, userId);
        break;
    }
    
  } catch (error) {
    console.error('❌ Erro no handleSalesMessage:', error);
    await client.sendText(userId, '❌ Ops! Ocorreu um erro. Digite *menu* para voltar ao início.');
  }
}

async function showCatalog(client, userId) {
  const userState = userStates[userId];
  userState.step = 'catalogo';
  
  await client.sendText(userId, `🏆 *ROYAL – CARDÁPIO COMPLETO*

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
⚠️ Sem estorno em caso de cancelamento. Evento +18.`);
}

async function showPromotions(client, userId) {
  await client.sendText(userId, `🔥 *ROYAL – PROMOÇÕES ESPECIAIS*

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
Digite *CARDAPIO* para ver todas as opções!`);
}

async function handleCatalogSelection(client, userId, userMessage) {
  const userState = userStates[userId];
  
  if (userMessage.includes('link') || userMessage.includes('comprar') || userMessage.includes('site')) {
    await client.sendText(userId, `🎫 *LINK OFICIAL PARA COMPRA:*
👉 https://links.totalingressos.com/mc-daniel-na-royal.html

💸 Pix direto = reserva confirmada!
⚠️ Sem estorno em caso de cancelamento. Evento +18.

Para mais informações, digite *CARDAPIO* ou *PROMOCOES*!`);
  } else {
    await client.sendText(userId, `Para comprar ingressos acesse:
👉 https://links.totalingressos.com/mc-daniel-na-royal.html

Ou digite *CARDAPIO* para ver todas as opções novamente!`);
  }
}

async function handleQuantitySelection(client, userId, userMessage) {
  await client.sendText(userId, `🎫 *LINK OFICIAL PARA COMPRA:*
👉 https://links.totalingressos.com/mc-daniel-na-royal.html

💸 Pix direto = reserva confirmada!
⚠️ Sem estorno em caso de cancelamento. Evento +18.`);
}

async function showCart(client, userId) {
  await client.sendText(userId, `🎫 *LINK OFICIAL PARA COMPRA:*
👉 https://links.totalingressos.com/mc-daniel-na-royal.html

💸 Pix direto = reserva confirmada!
⚠️ Sem estorno em caso de cancelamento. Evento +18.`);
}

async function handleSupportMessage(client, message) {
  const userId = message.from;
  const userMessage = (message.body || '').toLowerCase();
  
  if (!openai) {
    await client.sendText(userId, '🛟 Olá! Sou o suporte da Royal. Como posso ajudar?\n\nPara informações sobre ingressos, acesse:\n👉 https://links.totalingressos.com/mc-daniel-na-royal.html');
    return;
  }
  
  try {
    const response = await openai.chat.completions.create({
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
    
    const aiResponse = response.choices[0].message.content;
    await client.sendText(userId, `🛟 ${aiResponse}`);
    
  } catch (error) {
    console.error('❌ Erro OpenAI:', error);
    await client.sendText(userId, '🛟 Olá! Sou o suporte da Royal. Para informações sobre ingressos, acesse:\n👉 https://links.totalingressos.com/mc-daniel-na-royal.html');
  }
}

// Interface web e campanhas
function startWebInterface() {
  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server);
  
  // Tornar io global para uso em outras funções
  global.io = io;
  
  app.use(express.static('public'));
  app.use(express.json());
  
  // Configurar multer para upload
  const upload = multer({ dest: 'uploads/' });
  
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
          qrCode: null,
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
  
  // Buscar contatos do WhatsApp
  app.get('/api/sessions/:sessionName/contacts', async (req, res) => {
    try {
      const { sessionName } = req.params;
      const client = sessions[sessionName]?.client;
      
      if (!client) {
        return res.status(400).json({ 
          success: false, 
          message: `Sessão ${sessionName} não conectada` 
        });
      }

      // Buscar todos os contatos
      const contacts = await client.getAllContacts();
      
      // Filtrar e formatar contatos
      const formattedContacts = contacts
        .filter(contact => contact.id && contact.id.user && !contact.id.user.includes('@g.us')) // Remover grupos
        .map(contact => ({
          id: contact.id.user,
          name: contact.name || contact.pushname || contact.id.user,
          number: contact.id.user,
          profilePic: contact.profilePicThumbObj?.eurl || null
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      res.json({
        success: true,
        contacts: formattedContacts,
        total: formattedContacts.length
      });

    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar contatos: ' + error.message
      });
    }
  });

  // Envio de campanhas (multi-sessão)
  app.post('/api/campaigns/send', async (req, res) => {
    try {
      const { sessionName = 'sales', message, useUploadedNumbers, customNumbers, selectedContacts } = req.body;
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
      
      if (selectedContacts && selectedContacts.length > 0) {
        // Usar contatos selecionados da lista do WhatsApp
        numbersToSend = selectedContacts;
      } else if (useUploadedNumbers && global.lastUploadedNumbers) {
        numbersToSend = global.lastUploadedNumbers;
      } else if (customNumbers) {
        numbersToSend = customNumbers.split('\n')
          .map(n => n.trim())
          .filter(n => n.length >= 10);
      }
      
      if (!numbersToSend || numbersToSend.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Nenhum número válido encontrado para envio'
        });
      }
      
      // Enviar campanha
      const results = await sendMassCampaign(client, numbersToSend, message, sessionName);
      
      res.json({
        success: true,
        message: `Campanha enviada via ${sessionName}!`,
        results: results
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao enviar campanha: ' + error.message
      });
    }
  });
  
  // Socket.IO
  io.on('connection', (socket) => {
    console.log('🌐 Cliente conectado à interface web');
    socket.emit('sessions_status', sessions);
    socket.on('disconnect', () => {
      console.log('🌐 Cliente desconectado da interface web');
    });
    socket.on('start_session', async (sessionName) => {
      try {
        if (sessionName === 'sales') {
          await createSalesSession();
        } else if (sessionName === 'support') {
          await createSupportSession();
        }
      } catch (error) {
        socket.emit('error', { message: `Erro ao iniciar ${sessionName}: ${error.message}` });
      }
    });
    socket.on('stop_session', async (sessionName) => {
      try {
        if (sessions[sessionName]?.client) {
          await sessions[sessionName].client.close();
          sessions[sessionName] = {
            client: null,
            status: 'disconnected',
            qrCode: null,
            lastActivity: null
          };
        }
        socket.emit('session_status', {
          session: sessionName,
          status: 'disconnected'
        });
      } catch (error) {
        socket.emit('error', { message: `Erro ao parar ${sessionName}: ${error.message}` });
      }
    });
  });
  
  const PORT = process.env.PORT || 3005;
  server.listen(PORT, () => {
    console.log(`🌐 Interface web multi-sessão: http://localhost:${PORT}`);
  });
}

// Função principal
async function initializeSystem() {
  console.log('🚀 Iniciando sistema multi-sessão WhatsApp...');
  
  // Criar diretórios necessários
  const dirs = ['uploads', 'logs', 'tokens'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  startWebInterface();
  setTimeout(() => {
    console.log('');
    console.log('🌐 Sistema pronto!');
    console.log('📱 Acesse: http://localhost:' + (process.env.PORT || 3005));
    console.log('🛒 Use a interface para conectar as sessões');
    console.log('');
  }, 3000);
}

// Funções auxiliares
async function processNumbersFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const numbers = [];
  
  if (filePath.endsWith('.csv')) {
    const lines = content.split('\n');
    for (let i = 1; i < lines.length; i++) { // Pula cabeçalho
      const columns = lines[i].split(',');
      if (columns[0] && columns[0].trim()) {
        numbers.push(columns[0].trim().replace(/\D/g, '')); // Remove não-numéricos
      }
    }
  } else {
    // Arquivo TXT - um número por linha
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        numbers.push(line.trim().replace(/\D/g, ''));
      }
    }
  }
  
  // Limpar arquivo temporário
  fs.unlinkSync(filePath);
  
  return numbers.filter(n => n.length >= 10 && n.length <= 15); // Filtrar números válidos
}

async function sendMassCampaign(client, numbers, message, sessionName) {
  const results = { sent: 0, failed: 0, errors: [] };
  const delay = parseInt(process.env.DEFAULT_DELAY) || 3000;
  
  console.log(`📢 Iniciando campanha ${sessionName} para ${numbers.length} números...`);
  
  for (let i = 0; i < numbers.length; i++) {
    try {
      const number = numbers[i];
      const formattedNumber = number + '@c.us';
      
      console.log(`📱 ${sessionName} - Enviando ${i + 1}/${numbers.length} para ${number}...`);
      
      await client.sendText(formattedNumber, message)
        .then((result) => {
          results.sent++;
          console.log(`✅ ${sessionName} - Enviado para ${number}`);
        })
        .catch((erro) => {
          results.failed++;
          results.errors.push({ number, error: erro.message });
          console.error(`❌ ${sessionName} - Falha para ${number}:`, erro.message);
        });
      
      // Delay entre mensagens para evitar bloqueio
      if (i < numbers.length - 1) {
        await sleep(delay);
      }
      
      // Emitir progresso via Socket.IO
      if (global.io) {
        global.io.emit('campaign_progress', {
          session: sessionName,
          current: i + 1,
          total: numbers.length,
          sent: results.sent,
          failed: results.failed
        });
      }
      
    } catch (error) {
      results.failed++;
      results.errors.push({ number: numbers[i], error: error.message });
      console.error(`❌ ${sessionName} - Erro geral para ${numbers[i]}:`, error);
    }
  }
  
  console.log(`📊 Campanha ${sessionName} finalizada: ${results.sent} enviadas, ${results.failed} falhas`);
  
  return results;
}

// Inicializar variável global para números
global.lastUploadedNumbers = [];

// EXECUTAR
initializeSystem().catch(console.error);
