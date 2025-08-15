// Sistema Multi-Sessão WhatsApp com Interface Web de Controle
const fs = require('fs');
const path = require('path');
const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const dotenv = require('dotenv');
dotenv.config();

// Config upload
const upload = multer({ dest: 'uploads/' });

// Integração OpenAI
let openai = null;
try {
  const { OpenAI } = require('openai');
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sua_chave_openai_aqui') {
    openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
    console.log('✅ OpenAI configurada');
  } else {
    console.log('⚠️ OpenAI não configurada - usando respostas automáticas');
  }
} catch (error) {
  console.log('⚠️ OpenAI não disponível - instale: npm install openai');
}

// Estados do usuário para conversas
const userStates = {};

// SESSÕES GLOBAIS
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

// Função para criar sessão de vendas
async function createSalesSession() {
  console.log('🛒 Iniciando sessão de VENDAS...');
  try {
    const client = await wppconnect.create({
      session: 'sales',
      catchQR: (base64Qr, asciiQR) => {
        console.log('📱 QR Code VENDAS:');
        console.log(asciiQR);
        var matches = base64Qr.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const response = {
            type: matches[1],
            data: Buffer.from(matches[2], 'base64')
          };
          fs.writeFileSync('qr-sales.png', response.data, 'binary');
          sessions.sales.qrCode = base64Qr;
          sessions.sales.status = 'qr_ready';
          if (global.io) {
            global.io.emit('qr_code', {
              session: 'sales',
              qrCode: base64Qr,
              status: 'qr_ready'
            });
          }
          console.log('✅ QR Code VENDAS salvo e disponível na web');
        }
      },
      logQR: false,
      browserArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
      puppeteerOptions: { headless: true },
      disableWelcome: true,
      updatesLog: false
    });
    console.log('✅ Bot VENDAS conectado com sucesso!');
    sessions.sales.client = client;
    sessions.sales.status = 'connected';
    sessions.sales.qrCode = null;
    sessions.sales.lastActivity = new Date();
    if (global.io) {
      global.io.emit('session_status', {
        session: 'sales',
        status: 'connected',
        connectedAt: new Date()
      });
    }
    startClient(client);
  } catch (error) {
    console.error('❌ Erro ao conectar bot VENDAS:', error);
    sessions.sales.status = 'error';
    sessions.sales.client = null;
    if (global.io) {
      global.io.emit('session_status', {
        session: 'sales',
        status: 'error',
        error: error.message
      });
    }
  }
}

// Função para criar sessão de suporte
async function createSupportSession() {
  console.log('🛟 Iniciando sessão de SUPORTE...');
  try {
    const client = await wppconnect.create({
      session: 'support',
      catchQR: (base64Qr, asciiQR) => {
        console.log('📱 QR Code SUPORTE:');
        console.log(asciiQR);
        var matches = base64Qr.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const response = {
            type: matches[1],
            data: Buffer.from(matches[2], 'base64')
          };
          fs.writeFileSync('qr-support.png', response.data, 'binary');
          sessions.support.qrCode = base64Qr;
          sessions.support.status = 'qr_ready';
          if (global.io) {
            global.io.emit('qr_code', {
              session: 'support',
              qrCode: base64Qr,
              status: 'qr_ready'
            });
          }
          console.log('✅ QR Code SUPORTE salvo e disponível na web');
        }
      },
      logQR: false,
      browserArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
      puppeteerOptions: { headless: true },
      disableWelcome: true,
      updatesLog: false
    });
    console.log('✅ Bot SUPORTE conectado com sucesso!');
    sessions.support.client = client;
    sessions.support.status = 'connected';
    sessions.support.qrCode = null;
    sessions.support.lastActivity = new Date();
    if (global.io) {
      global.io.emit('session_status', {
        session: 'support',
        status: 'connected',
        connectedAt: new Date()
      });
    }
    startSupport(client);
  } catch (error) {
    console.error('❌ Erro ao conectar bot SUPORTE:', error);
    sessions.support.status = 'error';
    sessions.support.client = null;
    if (global.io) {
      global.io.emit('session_status', {
        session: 'support',
        status: 'error',
        error: error.message
      });
    }
  }
}

// Função startClient para vendas
function startClient(client) {
  console.log('🛒 Sistema de VENDAS ativo');
  client.onMessage(async (message) => {
    try {
      if (message.isGroupMsg || message.from === 'status@broadcast') return;
      sessions.sales.lastActivity = new Date();
      console.log(`💰 VENDAS - ${message.from}: ${message.body}`);
      if (message.body === 'Hello') {
        await client.sendText(message.from, '🏆 Olá! Bem-vindo à ROYAL – A NOITE É SUA, O REINADO É NOSSO!');
        
        setTimeout(async () => {
          await client.sendText(message.from, `🔥 MC DANIEL – O FALCÃO vai comandar o palco! 
          
Se é luxo e exclusividade que você procura… Aqui é o seu lugar!

Digite *CARDAPIO* para ver todas as opções de ingressos e camarotes! 🎫✨`);
        }, 1000);
      } else {
        await handleSalesMessage(client, message);
      }
    } catch (error) {
      console.error('❌ VENDAS - Erro no handler:', error);
    }
  });
  client.onStateChange((state) => {
    console.log('🛒 VENDAS - Estado:', state);
    sessions.sales.status = state;
    if (global.io) {
      global.io.emit('session_status', {
        session: 'sales',
        status: state,
        timestamp: new Date()
      });
    }
  });
}

// Função startSupport para suporte
function startSupport(client) {
  console.log('🛟 Sistema de SUPORTE ativo');
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
  client.onStateChange((state) => {
    console.log('🛟 SUPORTE - Estado:', state);
    sessions.support.status = state;
    if (global.io) {
      global.io.emit('session_status', {
        session: 'support',
        status: state,
        timestamp: new Date()
      });
    }
  });
}

// Funções de mensagem (mantém/expande lógica de vendas/suporte)
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
    await sleep(1500);
    
    // Fluxo de vendas baseado no estado
    switch (userState.step) {
      case 'inicio':
        if (userMessage.includes('oi') || userMessage.includes('ola') || userMessage.includes('hello')) {
          await client.sendText(userId, `� *Bem-vindo à ROYAL – A NOITE É SUA, O REINADO É NOSSO!*

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
        
      case 'pagamento':
        await handlePaymentSelection(client, userId, userMessage);
        break;
        
      default:
        await showCatalog(client, userId);
        break;
    }
    
    await client.stopTyping(userId);
    
  } catch (error) {
    console.error('❌ Erro no handleSalesMessage:', error);
    await client.sendText(userId, '❌ Ops! Ocorreu um erro. Digite *menu* para voltar ao início.');
  }
}

async function showCatalog(client, userId) {
  const userState = userStates[userId];
  userState.step = 'catalogo';
  
  await client.sendText(userId, `� *ROYAL – CARDÁPIO COMPLETO*

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

💥 *Para comprar digite:*
• *mclaren* | *ferrari* | *lamborghini* | *porsche6000*
• *porsche5000*
• *bugatti* | *rollsroyce* | *jaguar* | *mercedes*
• *royal* | *bmw* | *astonmartin* | *landrover*
• *bistro1* | *bistro2* | *bistro3* | *bistro4*
• *pista*

💸 *Pix direto = reserva confirmada!*
⚠️ Sem estorno em caso de cancelamento. Evento +18.`);

🎫 *PISTA* - R$ 50,00
   • Acesso à pista
   • Open bar 2h
   • Show completo

🍸 *CAMAROTE* - R$ 120,00
   • Área VIP elevada
   • Open bar premium 3h
   • Petiscos inclusos
   
� *VIP EXPERIENCE* - R$ 200,00
   • Meet & Greet com artista
   • Open bar premium ilimitado
   • Jantar incluso
   • Área exclusiva

🔥 *OFERTA ESPECIAL:*
💳 *PIX:* 10% de desconto
💰 *2+ ingressos:* 15% de desconto

Digite o *tipo* de ingresso desejado:
• *pista*
• *camarote* 
• *vip*`);
}

async function showPromotions(client, userId) {
  await client.sendText(userId, `🔥 *ROYAL – PROMOÇÕES ESPECIAIS*

💸 *PIX DIRETO = RESERVA CONFIRMADA!*
⚡ Pagamento instantâneo e lugar garantido

� *CAMAROTES ESGOTANDO RÁPIDO!*
� McLaren, Ferrari, Lamborghini limitados
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
  
  let selectedTicket = null;
  
  // Camarotes Premium
  if (userMessage.includes('mclaren') || userMessage.includes('ferrari') || userMessage.includes('lamborghini') || userMessage.includes('porsche6000')) {
    selectedTicket = {
      type: 'Camarote Premium - McLaren/Ferrari/Lamborghini/Porsche',
      price: 6000.00,
      description: 'R$ 2.500 consumo + 4 entradas incluídas'
    };
  } else if (userMessage.includes('porsche5000')) {
    selectedTicket = {
      type: 'Camarote Premium - Porsche',
      price: 5000.00,
      description: 'R$ 2.000 consumo + 4 entradas incluídas'
    };
  } else if (userMessage.includes('bugatti') || userMessage.includes('rollsroyce') || userMessage.includes('jaguar') || userMessage.includes('mercedes')) {
    selectedTicket = {
      type: 'Camarote Premium - Bugatti/Rolls Royce/Jaguar/Mercedes',
      price: 4000.00,
      description: 'R$ 1.500 consumo + 4 entradas incluídas'
    };
  } else if (userMessage.includes('royal') || userMessage.includes('bmw') || userMessage.includes('astonmartin') || userMessage.includes('landrover')) {
    selectedTicket = {
      type: 'Camarote Premium - Royal/BMW/Aston Martin/Land Rover',
      price: 4000.00,
      description: 'R$ 1.500 consumo + 4 entradas incluídas'
    };
  // Bistrôs Royal
  } else if (userMessage.includes('bistro1')) {
    selectedTicket = {
      type: 'Bistrô Royal - 1ª fileira',
      price: 700.00,
      description: 'R$ 300 consumo + 2 entradas incluídas'
    };
  } else if (userMessage.includes('bistro2')) {
    selectedTicket = {
      type: 'Bistrô Royal - 2ª fileira',
      price: 600.00,
      description: 'R$ 300 consumo + 2 entradas incluídas'
    };
  } else if (userMessage.includes('bistro3')) {
    selectedTicket = {
      type: 'Bistrô Royal - 3ª fileira',
      price: 500.00,
      description: 'R$ 250 consumo + 2 entradas incluídas'
    };
  } else if (userMessage.includes('bistro4')) {
    selectedTicket = {
      type: 'Bistrô Royal - 4ª fileira',
      price: 400.00,
      description: 'R$ 200 consumo + 2 entradas incluídas'
    };
  // Pista
  } else if (userMessage.includes('pista')) {
    selectedTicket = {
      type: 'Pista',
      price: 60.00,
      description: 'Ingresso individual'
    };
  }
  
  if (selectedTicket) {
    userState.selectedTicket = selectedTicket;
    userState.step = 'quantidade';
    
    await client.sendText(userId, `✅ *${selectedTicket.type}* selecionado!

💰 *Preço:* R$ ${selectedTicket.price.toFixed(2)}
📋 *Inclui:* ${selectedTicket.description}

🔢 *Quantos ingressos você deseja?*
Digite um número de 1 a 10:`);
  } else {
    await client.sendText(userId, `❌ Opção não reconhecida.

Digite exatamente:
• *pista*
• *camarote*
• *vip*

Ou *menu* para voltar ao início.`);
  }
}

async function handleQuantitySelection(client, userId, userMessage) {
  const userState = userStates[userId];
  const quantity = parseInt(userMessage);
  
  if (isNaN(quantity) || quantity < 1 || quantity > 10) {
    await client.sendText(userId, '❌ Quantidade inválida. Digite um número de 1 a 10:');
    return;
  }
  
  const ticket = userState.selectedTicket;
  const subtotal = ticket.price * quantity;
  
  // Aplicar descontos
  let discount = 0;
  let discountText = '';
  
  if (quantity >= 2) {
    discount = subtotal * 0.15; // 15% desconto para 2+
    discountText = '\n💰 *Desconto 2+ ingressos:* 15% OFF';
  }
  
  const total = subtotal - discount;
  
  // Adicionar ao carrinho
  const cartItem = {
    ...ticket,
    quantity,
    subtotal,
    discount,
    total
  };
  
  userState.cart.push(cartItem);
  userState.total = total;
  userState.step = 'pagamento';
  
  await client.sendText(userId, `🛒 *RESUMO DO PEDIDO*

🎫 *${ticket.type}* x${quantity}
💵 Subtotal: R$ ${subtotal.toFixed(2)}${discountText}
💳 *Total: R$ ${total.toFixed(2)}*

💰 *FORMAS DE PAGAMENTO:*
1️⃣ *PIX* (10% desconto extra) - R$ ${(total * 0.9).toFixed(2)}
2️⃣ *Cartão* (parcelado até 10x) - R$ ${total.toFixed(2)}

Digite *1* para PIX ou *2* para Cartão:`);
}

async function handlePaymentSelection(client, userId, userMessage) {
  const userState = userStates[userId];
  
  if (userMessage.includes('1') || userMessage.includes('pix')) {
    await processPIXPayment(client, userId);
  } else if (userMessage.includes('2') || userMessage.includes('cartao') || userMessage.includes('cartão')) {
    await processCardPayment(client, userId);
  } else {
    await client.sendText(userId, '❌ Opção inválida. Digite *1* para PIX ou *2* para Cartão:');
  }
}

async function processPIXPayment(client, userId) {
  const userState = userStates[userId];
  const finalTotal = userState.total * 0.9; // 10% desconto PIX
  
  // Gerar código PIX simulado
  const pixCode = generatePIXCode(finalTotal);
  
  await client.sendText(userId, `💸 *PAGAMENTO VIA PIX*

💰 *Valor final:* R$ ${finalTotal.toFixed(2)}
💳 *Desconto PIX:* 10% OFF aplicado!

🔑 *Chave PIX:* ${process.env.COMPANY_PHONE || '11999999999'}

📋 *Código PIX Copia e Cola:*
\`\`\`${pixCode}\`\`\`

⏰ *Prazo:* 30 minutos
📱 *Comprovante:* Envie o print após o pagamento

🎫 Seus ingressos serão enviados automaticamente após confirmação!`);
  
  userState.step = 'aguardando_pagamento';
}

async function processCardPayment(client, userId) {
  const userState = userStates[userId];
  
  await client.sendText(userId, `💳 *PAGAMENTO VIA CARTÃO*

💰 *Total:* R$ ${userState.total.toFixed(2)}
🏦 *Parcelamento:* Até 10x sem juros

🔗 *Link de pagamento seguro:*
${process.env.COMPANY_WEBSITE || 'https://seusite.com'}/checkout?id=${Date.now()}

🔒 *Ambiente seguro* - Certificado SSL
💳 *Aceito:* Visa, Master, Elo, Amex

🎫 Ingressos enviados após aprovação (até 5 min)!`);
  
  userState.step = 'aguardando_pagamento';
}

async function showCart(client, userId) {
  const userState = userStates[userId];
  
  if (!userState.cart || userState.cart.length === 0) {
    await client.sendText(userId, `🛒 *SEU CARRINHO ESTÁ VAZIO*

🎫 Digite *catalogo* para ver ingressos
💰 Digite *promocoes* para ofertas especiais
📞 Digite *menu* para opções`);
    return;
  }
  
  let cartText = '🛒 *SEU CARRINHO*\n\n';
  let total = 0;
  
  userState.cart.forEach((item, index) => {
    cartText += `${index + 1}. *${item.type}* x${item.quantity}\n`;
    cartText += `   R$ ${item.total.toFixed(2)}\n\n`;
    total += item.total;
  });
  
  cartText += `💳 *TOTAL GERAL: R$ ${total.toFixed(2)}*\n\n`;
  cartText += `💰 *Finalizar:* Digite *pagar*\n`;
  cartText += `🗑️ *Limpar:* Digite *limpar*\n`;
  cartText += `➕ *Adicionar:* Digite *catalogo*`;
  
  await client.sendText(userId, cartText);
}

function generatePIXCode(amount) {
  // Código PIX simulado (em produção, usar API do banco)
  const timestamp = Date.now();
  return `00020126580014br.gov.bcb.pix0136${process.env.COMPANY_PHONE || '11999999999'}52040000530398654${amount.toFixed(2).padStart(10, '0')}5802BR5925${process.env.BOT_NAME || 'CASA DE SHOW'}6009SAO PAULO62070503***6304${timestamp.toString().slice(-4)}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleSupportMessage(client, message) {
  const userId = message.from;
  const userMessage = message.body;
  
  try {
    // Simular digitação
    await client.startTyping(userId);
    await sleep(2000);
    
    // Usar IA se disponível
    if (openai) {
      const aiResponse = await generateAIResponse(userMessage);
      await client.sendText(userId, aiResponse);
    } else {
      // Respostas automáticas baseadas em palavras-chave
      await handleAutomaticSupport(client, userId, userMessage);
    }
    
    await client.stopTyping(userId);
    
  } catch (error) {
    console.error('❌ Erro no handleSupportMessage:', error);
    await client.sendText(userId, '🛟 Desculpe, ocorreu um erro. Um atendente humano entrará em contato em breve!');
  }
}

async function generateAIResponse(userMessage) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Você é o assistente de suporte da ${process.env.BOT_NAME || 'Casa de Show XYZ'}. 

REGRAS:
- Seja sempre prestativo e amigável
- Use emojis moderadamente
- Máximo 2 parágrafos por resposta
- Sempre ofereça transferir para atendimento humano
- Direcione vendas para o WhatsApp de vendas
- Para problemas complexos, peça para aguardar contato

INFORMAÇÕES:
- Local: ${process.env.BOT_NAME || 'Casa de Show XYZ'}
- Site: ${process.env.COMPANY_WEBSITE || 'https://seusite.com'}
- Ingressos: Pista (R$50), Camarote (R$120), VIP (R$200)
- Pagamento: PIX com desconto, Cartão parcelado
- Horário: Portões 20h, Show 22h`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      max_tokens: 200,
      temperature: 0.7
    });
    
    const response = completion.choices[0].message.content;
    return `🛟 ${response}\n\n❓ Posso ajudar com mais alguma coisa?\n📞 Digite *humano* para falar com atendente`;
    
  } catch (error) {
    console.error('❌ Erro na IA:', error);
    return '🛟 Desculpe, nossa IA está temporariamente indisponível. Um atendente humano entrará em contato!';
  }
}

async function handleAutomaticSupport(client, userId, userMessage) {
  const lowerMessage = userMessage.toLowerCase();
  
  let response = '';
  
  if (lowerMessage.includes('horario') || lowerMessage.includes('horário') || lowerMessage.includes('quando')) {
    response = `🕒 *HORÁRIOS DO EVENTO*

🚪 *Portões:* 20h00
🎵 *Show:* 22h00
🏁 *Término:* 02h00

📅 Chegue com antecedência para evitar filas!`;

  } else if (lowerMessage.includes('local') || lowerMessage.includes('onde') || lowerMessage.includes('endereço')) {
    response = `📍 *LOCALIZAÇÃO*

🏢 ${process.env.BOT_NAME || 'Casa de Show XYZ'}
📍 Rua da Música, 123 - Centro
🏙️ São Paulo - SP
📮 CEP: 01234-567

🚗 *Estacionamento:* Disponível (pago)
🚇 *Metro:* Estação Central (5 min caminhando)
🚌 *Ônibus:* Linhas 100, 200, 300`;

  } else if (lowerMessage.includes('ingresso') || lowerMessage.includes('comprar') || lowerMessage.includes('venda')) {
    response = `🎫 *Para COMPRAR INGRESSOS:*

🛒 Entre em contato com nosso bot de *VENDAS*:
📱 ${process.env.COMPANY_PHONE || '11999999999'}

💰 *Preços:*
• Pista: R$ 50,00
• Camarote: R$ 120,00  
• VIP: R$ 200,00

🔥 *Desconto PIX:* 10% OFF`;

  } else if (lowerMessage.includes('cancelar') || lowerMessage.includes('reembolso') || lowerMessage.includes('devolver')) {
    response = `💸 *CANCELAMENTOS E REEMBOLSOS*

📋 *Política:*
• Até 7 dias antes: 100% do valor
• 3-7 dias antes: 50% do valor
• Menos de 3 dias: Sem reembolso

📞 Para solicitar cancelamento, digite *humano* para falar com atendente`;

  } else if (lowerMessage.includes('problema') || lowerMessage.includes('erro') || lowerMessage.includes('ajuda')) {
    response = `🛟 *SUPORTE TÉCNICO*

📱 Descreva seu problema:
• Erro no pagamento
• Problema com ingresso
• Dúvida sobre o evento
• Questão de acessibilidade

👤 Digite *humano* para atendimento personalizado`;

  } else {
    response = `🛟 *CENTRAL DE SUPORTE*

Posso ajudar com:
🕒 *horarios* do evento
📍 *local* e como chegar
🎫 *ingressos* e vendas
💸 *cancelamentos*
🔧 *problemas* técnicos

❓ Digite sua dúvida ou *humano* para atendente!`;
  }
  
  await client.sendText(userId, response);
}

// Servidor web + Socket.IO
function startWebInterface() {
  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server);
  global.io = io;
  app.use(express.json());
  app.use(express.static('public'));
  app.use('/uploads', express.static('uploads'));
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  });
  app.get('/api/sessions/status', (req, res) => {
    const sessionStatus = {};
    Object.keys(sessions).forEach(sessionName => {
      sessionStatus[sessionName] = {
        status: sessions[sessionName].status,
        hasClient: !!sessions[sessionName].client,
        lastActivity: sessions[sessionName].lastActivity,
        qrAvailable: !!sessions[sessionName].qrCode
      };
    });
    res.json(sessionStatus);
  });
  app.post('/api/sessions/:sessionName/start', async (req, res) => {
    const { sessionName } = req.params;
    if (!sessions[sessionName]) {
      return res.status(404).json({ success: false, message: 'Sessão não encontrada' });
    }
    if (sessions[sessionName].status === 'connected') {
      return res.json({ success: true, message: 'Sessão já conectada' });
    }
    try {
      if (sessionName === 'sales') {
        await createSalesSession();
      } else if (sessionName === 'support') {
        await createSupportSession();
      }
      res.json({ success: true, message: `Sessão ${sessionName} iniciada. Aguarde o QR Code.` });
    } catch (error) {
      res.status(500).json({ success: false, message: `Erro ao iniciar sessão: ${error.message}` });
    }
  });
  app.post('/api/sessions/:sessionName/stop', async (req, res) => {
    const { sessionName } = req.params;
    if (!sessions[sessionName]) {
      return res.status(404).json({ success: false, message: 'Sessão não encontrada' });
    }
    try {
      if (sessions[sessionName].client) {
        await sessions[sessionName].client.close();
      }
      sessions[sessionName] = {
        client: null,
        status: 'disconnected',
        qrCode: null,
        lastActivity: null
      };
      io.emit('session_status', {
        session: sessionName,
        status: 'disconnected',
        timestamp: new Date()
      });
      res.json({ success: true, message: `Sessão ${sessionName} desconectada` });
    } catch (error) {
      res.status(500).json({ success: false, message: `Erro ao parar sessão: ${error.message}` });
    }
  });
  app.get('/api/sessions/:sessionName/qr', (req, res) => {
    const { sessionName } = req.params;
    if (!sessions[sessionName] || !sessions[sessionName].qrCode) {
      return res.status(404).json({ success: false, message: 'QR Code não disponível' });
    }
    res.json({ success: true, qrCode: sessions[sessionName].qrCode, session: sessionName });
  });
  // Upload de números (mantém lógica anterior)
  app.post('/api/upload/numbers', upload.single('numbersFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Nenhum arquivo enviado'
        });
      }
      
      const numbers = await processNumbersFile(req.file.path);
      
      // Salvar números temporariamente para uso posterior
      global.lastUploadedNumbers = numbers;
      
      res.json({
        success: true,
        message: `${numbers.length} números processados com sucesso`,
        numbers: numbers.slice(0, 10), // Preview dos primeiros 10
        total: numbers.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao processar arquivo: ' + error.message
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
  const PORT = process.env.PORT || 3000;
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
    console.log('📱 Acesse: http://localhost:' + (process.env.PORT || 3000));
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
