// CONFIGURAR OpenAI
require('dotenv').config();
const { OpenAI } = require('openai');
const express = require('express');
const { create } = require('@wppconnect-team/wppconnect');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const http = require('http');
const socketIo = require('socket.io');

// Importar sistema de processamento em lotes
const CampaignBatchProcessor = require('./modules/CampaignBatchProcessor');
// Importar gerador de variações de mensagens
const MessageVariationGenerator = require('./modules/MessageVariationGenerator');
// Sistema de recuperação simplificado sem dependências problemáticas

// Sistema de recuperação automática de campanhas
const recoveryManager = {
  async checkForInterruptedCampaigns(sessionName, client) {
    try {
      console.log(`🔍 Verificando campanhas interrompidas para sessão: ${sessionName}...`);
      
      // Usar o sistema de tracking já existente para verificar campanhas interrompidas
      const { getCampaignTracker } = require('./modules/campaignTracker');
      const tracker = getCampaignTracker();
      
      if (!tracker) {
        console.log('⚠️ Sistema de tracking não disponível para verificar campanhas');
        return;
      }
      
      // Buscar campanhas (simplificado - sem filtro de status para evitar problemas)
      const db = tracker.db;
      
      // Primeiro verificar quais colunas existem na tabela campaigns
      try {
        const tableInfo = await db.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'campaigns'
          ORDER BY ordinal_position
        `);
        console.log('📋 Colunas da tabela campaigns:', tableInfo.map(row => row.column_name).join(', '));
        
        // Verificar valores válidos do enum campaign_status se existir
        try {
          const enumValues = await db.query(`
            SELECT unnest(enum_range(NULL::campaign_status)) as valid_status
          `);
          console.log('📋 Valores válidos para campaign_status:', enumValues.map(row => row.valid_status).join(', '));
        } catch (enumError) {
          console.log('ℹ️ Enum campaign_status não encontrado ou não disponível');
        }
        
      } catch (error) {
        console.log('⚠️ Erro ao verificar estrutura da tabela:', error.message);
      }
      
      // Buscar todas as campanhas (sem filtro de status para evitar problemas)
      const campaigns = await db.query(`
        SELECT DISTINCT c.id, c.campaign_name, c.message_template, c.status, c.session_name, c.created_at, c.metadata
        FROM campaigns c 
        ORDER BY c.created_at DESC
        LIMIT 20
      `);
      
      if (campaigns.length === 0) {
        console.log(`✅ Nenhuma campanha encontrada para ${sessionName}`);
        return;
      }
      
      // Filtrar campanhas para a sessão específica
      const sessionCampaigns = campaigns.filter(campaign => 
        !campaign.session_name || campaign.session_name === sessionName
      );
      
      console.log(`🔄 Encontradas ${campaigns.length} campanhas no total, ${sessionCampaigns.length} para ${sessionName}`);
      
      // Buscar campanhas que podem ser retomadas
      const resumableCampaigns = sessionCampaigns.filter(campaign => 
        campaign.status === 'pausada' || campaign.status === 'ativa'
      );
      
      // Log das campanhas encontradas
      sessionCampaigns.forEach(campaign => {
        console.log(`📋 Campanha ${campaign.id}: "${campaign.campaign_name}" - Status: ${campaign.status}`);
      });
      
      if (resumableCampaigns.length > 0) {
        console.log(`\n🔄 Encontradas ${resumableCampaigns.length} campanhas que podem ser retomadas:`);
        
        for (const campaign of resumableCampaigns) {
          console.log(`\n🎯 Verificando campanha ${campaign.id}: "${campaign.campaign_name}"`);
          
          try {
            // Verificar se tem números para processar
            await this.checkAndResumeCampaign(campaign, sessionName, client, tracker);
          } catch (error) {
            console.error(`❌ Erro ao verificar campanha ${campaign.id}:`, error.message);
          }
        }
      } else {
        console.log('ℹ️ Nenhuma campanha pausada ou ativa encontrada para recovery');
      }
      
    } catch (error) {
      console.error(`❌ Erro ao verificar campanhas interrompidas para ${sessionName}:`, error.message);
    }
  },

  async checkAndResumeCampaign(campaign, sessionName, client, tracker) {
    try {
      const campaignId = campaign.id;
      const db = tracker.db;
      
      // Verificar se é uma campanha de teste
      const isTestCampaign = campaign.metadata?.created_for_test === true || 
                           campaign.metadata?.persistence_type === 'batch_campaign' ||
                           campaign.campaign_name.includes('Teste');
      
      if (isTestCampaign) {
        console.log(`🧪 Campanha ${campaignId} identificada como TESTE - pulando recovery automático`);
        console.log(`   📝 Nome: ${campaign.campaign_name}`);
        console.log(`   📦 Tipo: ${campaign.metadata?.persistence_type || 'teste'}`);
        console.log(`   ℹ️ Campanhas de teste não são recuperadas automaticamente`);
        return;
      }
      
      // Verificar se há números pendentes para esta campanha
      console.log(`🔍 Verificando números pendentes para campanha ${campaignId}...`);
      
      // Primeiro verificar se há números reais enviados
      const realSentNumbers = await db.query(`
        SELECT COUNT(*) as count FROM sent_numbers WHERE campaign_id = $1
      `, [campaignId]);
      
      const hasRealSentNumbers = realSentNumbers[0]?.count > 0;
      
      // Buscar números da campanha original
      let campaignNumbers = [];
      try {
        if (campaign.metadata && typeof campaign.metadata === 'object' && campaign.metadata.numbers) {
          campaignNumbers = campaign.metadata.numbers;
          console.log(`📱 Encontrados ${campaignNumbers.length} números nos metadados da campanha`);
        } else {
          // Tentar buscar de campaign_numbers se existir
          try {
            const numbersResult = await db.query(`
              SELECT phone_number, status 
              FROM campaign_numbers 
              WHERE campaign_id = $1
            `, [campaignId]);
            
            if (numbersResult.length > 0) {
              campaignNumbers = numbersResult.map(row => row.phone_number);
              console.log(`📱 Encontrados ${campaignNumbers.length} números na tabela campaign_numbers`);
            }
          } catch (tableError) {
            console.log('ℹ️ Tabela campaign_numbers não encontrada, buscando alternativas...');
          }
        }
      } catch (metadataError) {
        console.error('⚠️ Erro ao acessar metadados:', metadataError.message);
      }
      
      if (campaignNumbers.length === 0) {
        if (!hasRealSentNumbers && campaign.total_sent > 0) {
          console.log(`⚠️ INCONSISTÊNCIA DETECTADA na campanha ${campaignId}:`);
          console.log(`   📊 Banco relata ${campaign.total_sent} enviados`);
          console.log(`   📊 Mas não há registros reais em sent_numbers`);
          console.log(`   🔍 Possível campanha de teste ou dados inconsistentes`);
          console.log(`   ⏸️ Pausando campanha e marcando como rascunho...`);
          
          // Marcar como rascunho para evitar confusão
          await db.query(`
            UPDATE campaigns 
            SET status = 'rascunho', updated_at = NOW() 
            WHERE id = $1
          `, [campaignId]);
          
          return;
        }
        
        console.log(`⚠️ Nenhum número encontrado para campanha ${campaignId}, pulando...`);
        return;
      }
      
      // Verificar quantos já foram enviados
      const sentNumbers = await db.query(`
        SELECT DISTINCT phone_number 
        FROM sent_numbers 
        WHERE campaign_id = $1
      `, [campaignId]);
      
      const sentNumbersSet = new Set(sentNumbers.map(row => row.phone_number));
      const pendingNumbers = campaignNumbers.filter(num => !sentNumbersSet.has(num));
      
      console.log(`📊 Campanha ${campaignId} - Total: ${campaignNumbers.length}, Enviados: ${sentNumbers.length}, Pendentes: ${pendingNumbers.length}`);
      
      if (pendingNumbers.length > 0) {
        console.log(`🚀 Iniciando recovery automático da campanha ${campaignId}...`);
        console.log(`📝 Mensagem: ${campaign.message_template?.substring(0, 100)}...`);
        
        // Confirmar se o usuário quer fazer recovery automático
        if (await this.shouldAutoResume(campaign)) {
          await this.resumeCampaignAutomatically(campaign, pendingNumbers, sessionName, client, tracker);
        } else {
          console.log(`⏸️ Recovery automático desabilitado para campanha ${campaignId}`);
        }
      } else {
        console.log(`✅ Campanha ${campaignId} já foi totalmente enviada`);
        
        // Atualizar status para finalizada se todos foram enviados
        if (campaign.status === 'ativa' || campaign.status === 'pausada') {
          await db.query(`
            UPDATE campaigns 
            SET status = 'finalizada', completed_at = NOW() 
            WHERE id = $1
          `, [campaignId]);
          console.log(`✅ Campanha ${campaignId} marcada como finalizada`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Erro ao verificar campanha ${campaign.id}:`, error.message);
    }
  },

  async shouldAutoResume(campaign) {
    // Por ora, fazer recovery automático apenas para campanhas pausadas
    // Em produção, poderia verificar configurações ou pedir confirmação
    if (campaign.status === 'pausada') {
      console.log(`✅ Recovery automático habilitado para campanha pausada ${campaign.id}`);
      return true;
    }
    
    if (campaign.status === 'ativa') {
      // Para campanhas ativas, verificar se não foi atualizada recentemente
      const lastUpdate = new Date(campaign.updated_at || campaign.created_at);
      const now = new Date();
      const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
      
      if (hoursSinceUpdate > 1) { // Mais de 1 hora sem atividade
        console.log(`✅ Recovery automático habilitado para campanha ativa ${campaign.id} (${hoursSinceUpdate.toFixed(1)}h sem atividade)`);
        return true;
      }
    }
    
    console.log(`⏸️ Recovery automático não habilitado para campanha ${campaign.id} (status: ${campaign.status})`);
    return false;
  },

  async resumeCampaignAutomatically(campaign, pendingNumbers, sessionName, client, tracker) {
    try {
      console.log(`\n🚀 INICIANDO RECOVERY AUTOMÁTICO`);
      console.log(`📋 Campanha: ${campaign.id} - "${campaign.campaign_name}"`);
      console.log(`📱 Números pendentes: ${pendingNumbers.length}`);
      console.log(`💬 Mensagem: ${campaign.message_template?.substring(0, 150)}...`);
      
      // Atualizar status da campanha para ativa se estava pausada
      if (campaign.status === 'pausada') {
        await tracker.db.query(`
          UPDATE campaigns 
          SET status = 'ativa', updated_at = NOW() 
          WHERE id = $1
        `, [campaign.id]);
        console.log(`✅ Campanha ${campaign.id} reativada automaticamente`);
      }
      
      // Usar o CampaignBatchProcessor para fazer o envio
      const processor = new CampaignBatchProcessor({
        batchSize: 50, // Lotes menores para recovery
        minInterval: parseInt(process.env.MIN_DELAY) || 7000,   // 7s entre mensagens
        maxInterval: parseInt(process.env.MAX_DELAY) || 15000,  // 15s entre mensagens  
        batchDelayMin: 20000, // 20s entre lotes
        batchDelayMax: 40000, // 40s entre lotes
        campaignControl: campaignControl,
        tracker: tracker
      });
      
      console.log(`⚙️ Processador configurado com lotes de 50 números`);
      console.log(`⏰ Delay entre mensagens: 7-15s | Entre lotes: 20-40s`);
      
      // Executar recovery
      const results = await processor.processLargeCampaignArray(
        pendingNumbers,
        campaign.message_template,
        sessionName,
        client
      );
      
      console.log(`\n🎉 RECOVERY CONCLUÍDO!`);
      console.log(`✅ Enviadas: ${results.successCount}`);
      console.log(`❌ Falhas: ${results.failedCount}`);
      console.log(`🔄 Duplicatas: ${results.duplicateCount}`);
      console.log(`⏱️ Tempo total: ${Math.round(results.duration / 1000)}s`);
      
      // Atualizar estatísticas da campanha
      await this.updateCampaignStats(campaign.id, results, tracker);
      
      // Marcar como finalizada se todos foram processados
      if (results.successCount + results.duplicateCount >= pendingNumbers.length) {
        await tracker.db.query(`
          UPDATE campaigns 
          SET status = 'finalizada', completed_at = NOW() 
          WHERE id = $1
        `, [campaign.id]);
        console.log(`🏁 Campanha ${campaign.id} finalizada automaticamente`);
      }
      
    } catch (error) {
      console.error(`❌ Erro no recovery automático da campanha ${campaign.id}:`, error.message);
      
      // Marcar campanha como pausada em caso de erro
      try {
        await tracker.db.query(`
          UPDATE campaigns 
          SET status = 'pausada', updated_at = NOW() 
          WHERE id = $1
        `, [campaign.id]);
        console.log(`⏸️ Campanha ${campaign.id} pausada devido ao erro`);
      } catch (updateError) {
        console.error(`❌ Erro ao pausar campanha:`, updateError.message);
      }
    }
  },

  async updateCampaignStats(campaignId, results, tracker) {
    try {
      await tracker.db.query(`
        UPDATE campaigns 
        SET 
          total_sent = COALESCE(total_sent, 0) + $1,
          total_failed = COALESCE(total_failed, 0) + $2,
          updated_at = NOW()
        WHERE id = $3
      `, [results.successCount, results.failedCount, campaignId]);
      
      console.log(`📊 Estatísticas atualizadas para campanha ${campaignId}`);
    } catch (error) {
      console.error(`❌ Erro ao atualizar estatísticas:`, error.message);
    }
  }
};

console.log('✅ Sistema de recuperação simplificado inicializado');

// ===== SISTEMA DE PROTEÇÃO TOTAL DO SERVIDOR =====

// Sistema de tratamento de erros globais
process.on('uncaughtException', (error) => {
  console.error('🚨 ERRO CRÍTICO - Uncaught Exception:', error.message);
  console.error('Stack:', error.stack);
  console.error('Timestamp:', new Date().toISOString());
  
  // Criar diretório de logs se não existir
  if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs', { recursive: true });
  }
  
  // Log para arquivo
  const errorLog = `\n[${new Date().toISOString()}] UNCAUGHT EXCEPTION:\nMessage: ${error.message}\nStack: ${error.stack}\n${'='.repeat(80)}\n`;
  fs.appendFileSync('logs/critical-errors.log', errorLog);
  
  // Tentar salvar estado antes de sair
  try {
    saveSystemState();
    console.log('💾 Estado do sistema salvo');
  } catch (e) {
    console.error('❌ Erro ao salvar backup:', e.message);
  }
  
  // Restart em 5 segundos para dar tempo de salvar
  console.log('🔄 Reiniciando processo em 5 segundos...');
  setTimeout(() => {
    process.exit(1);
  }, 5000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 PROMISE REJEITADA não tratada:', reason);
  console.error('Promise:', promise);
  console.error('Timestamp:', new Date().toISOString());
  
  // Criar diretório de logs se não existir
  if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs', { recursive: true });
  }
  
  // Log para arquivo
  const errorLog = `\n[${new Date().toISOString()}] UNHANDLED REJECTION:\nReason: ${reason}\n${'='.repeat(80)}\n`;
  fs.appendFileSync('logs/promise-errors.log', errorLog);
  
  // Não sair por promise rejeitada, apenas logar
  console.log('⚠️ Continuando execução após promise rejeitada...');
});

process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM recebido, finalizando graciosamente...');
  gracefulShutdown();
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT recebido (Ctrl+C), finalizando graciosamente...');
  gracefulShutdown();
});

process.on('SIGQUIT', () => {
  console.log('🔄 SIGQUIT recebido, finalizando graciosamente...');
  gracefulShutdown();
});

// Função para finalização graciosa
function gracefulShutdown() {
  console.log('💾 Iniciando shutdown gracioso...');
  
  try {
    // Salvar estado do sistema
    saveSystemState();
    console.log('✅ Estado do sistema salvo');
    
    // Parar todos os intervals e timers
    if (global.monitoringInterval) {
      clearInterval(global.monitoringInterval);
      console.log('✅ Monitoramento parado');
    }
    
    if (global.sessionMonitoringInterval) {
      clearInterval(global.sessionMonitoringInterval);
      console.log('✅ Monitoramento de sessões parado');
    }
    
    // Parar keep-alive de todas as sessões
    Object.keys(sessions).forEach(sessionName => {
      if (sessions[sessionName].keepAliveInterval) {
        clearInterval(sessions[sessionName].keepAliveInterval);
        console.log(`✅ Keep-alive parado para ${sessionName}`);
      }
    });
    
    console.log('✅ Shutdown gracioso completo');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro durante shutdown gracioso:', error.message);
    process.exit(1);
  }
}

// Função para salvar estado do sistema
function saveSystemState() {
  try {
    const systemState = {
      timestamp: new Date().toISOString(),
      sessions: {},
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      campaigns: global.campaigns || {},
      lastProcessedNumbers: global.lastProcessedNumbers || []
    };
    
    // Salvar estado das sessões (sem objetos complexos)
    Object.keys(sessions).forEach(sessionName => {
      systemState.sessions[sessionName] = {
        status: sessions[sessionName].status || 'disconnected',
        lastActivity: sessions[sessionName].lastActivity || null,
        hasClient: sessions[sessionName].client ? true : false
      };
    });
    
    fs.writeFileSync('system-backup.json', JSON.stringify(systemState, null, 2));
    console.log('💾 Estado do sistema salvo em system-backup.json');
    
    // Backup adicional com timestamp
    const backupName = `backup-${Date.now()}.json`;
    fs.writeFileSync(path.join('logs', backupName), JSON.stringify(systemState, null, 2));
    
  } catch (error) {
    console.error('❌ Erro ao salvar estado:', error.message);
  }
}

// Classe para humanização do bot
class BotHumanizer {
  constructor() {
    this.typingStates = new Map(); // Controlar estados de digitação
    this.responseDelays = new Map(); // Controlar delays por usuário
  }

  // Gerar delay randomico baseado no tamanho da mensagem
  generateSmartDelay(messageLength) {
    const minDelay = parseInt(process.env.MIN_DELAY) || 7000;
    const maxDelay = parseInt(process.env.MAX_DELAY) || 15000;
    const baseDelay = Math.random() * (maxDelay - minDelay) + minDelay; // 7-15 segundos base
    
    // Ajustar delay baseado no tamanho da resposta
    const lengthMultiplier = Math.min(messageLength / 100, 2); // Max 2x o delay
    const finalDelay = baseDelay + (lengthMultiplier * 3000); // +3s por 100 chars
    
    return Math.min(finalDelay, 30000); // Máximo 30 segundos
  }

  // Simular comportamento humano de digitação
  async simulateHumanResponse(client, phoneNumber, response, originalMessage, skipVariations = false) {
    try {
      const delay = this.generateSmartDelay(response.length);
      const typingDuration = Math.min(delay * 0.8, 15000); // 80% do delay digitando
      
      console.log(`🤖 Humanizando resposta para ${phoneNumber}: delay ${(delay/1000).toFixed(1)}s`);
      
      // 1. Marcar como visto (comportamento humano)
      await client.sendSeen(phoneNumber);
      
      // 2. Aguardar um pouco antes de começar a digitar (pensando)
      await this.sleep(Math.random() * 3000 + 1000); // 1-4 segundos "pensando"
      
      // 3. Começar a digitar
      await client.startTyping(phoneNumber);
      this.typingStates.set(phoneNumber, true);
      
      // 4. Simular pausas na digitação (comportamento humano)
      const typingPauses = Math.floor(typingDuration / 5000); // Pausas a cada 5s
      for (let i = 0; i < typingPauses; i++) {
        await this.sleep(4000 + Math.random() * 2000); // 4-6s digitando
        
        // Pausa na digitação (como se parasse para pensar)
        await client.stopTyping(phoneNumber);
        await this.sleep(500 + Math.random() * 1000); // 0.5-1.5s pausa
        
        // Continuar digitando se ainda há tempo
        if (i < typingPauses - 1) {
          await client.startTyping(phoneNumber);
        }
      }
      
      // 5. Digitação final
      await client.startTyping(phoneNumber);
      await this.sleep(Math.random() * 3000 + 2000); // 2-5s finalizando
      
      // 6. Parar de digitar e enviar resposta
      await client.stopTyping(phoneNumber);
      this.typingStates.set(phoneNumber, false);
      
      // 7. Enviar resposta com padrão .then()/.catch()
      client
        .sendText(phoneNumber, response)
        .then((result) => {
          console.log(`✅ Resposta humanizada enviada para ${phoneNumber}:`, result.id);
          
          // Adicionar variações humanas ocasionais (apenas se não for campanha)
          if (!skipVariations) {
            this.addHumanVariations(client, phoneNumber, response);
          }
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

  // Adicionar variações humanas ocasionais
  async addHumanVariations(client, phoneNumber, originalResponse) {
    // DESABILITADO: Função que causava segunda mensagem automática
    // Sistema de variações humanas REMOVIDO para evitar ban do WhatsApp
    console.log(`🚫 Variações humanas desabilitadas para ${phoneNumber} - prevenção de ban`);
    return; // NÃO enviar mensagens extras
    
    // CÓDIGO ORIGINAL COMENTADO:
    // 20% chance de enviar uma variação humana
    // if (Math.random() < 0.2) {
    //   const variations = [
    //     '😊',
    //     'Espero ter ajudado!',
    //     'Qualquer dúvida, é só chamar 👍',
    //     'Fico à disposição!',
    //     '🎵'
    //   ];
    //   
    //   const variation = variations[Math.floor(Math.random() * variations.length)];
    //   
    //   // Aguardar um pouco e enviar variação
    //   setTimeout(() => {
    //     client
    //       .sendText(phoneNumber, variation)
    //       .then(() => console.log(`✨ Variação humana enviada: ${variation}`))
    //       .catch((error) => console.error('❌ Erro variação:', error));
    //   }, Math.random() * 5000 + 2000); // 2-7 segundos depois
    // }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Verificar se usuário está sendo atendido
  isUserBeingServed(phoneNumber) {
    return this.typingStates.get(phoneNumber) || false;
  }
}

// Classe para processar diferentes tipos de arquivo
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
          separator: [',', ';', '\t'], // Detectar separadores automaticamente
          skipEmptyLines: true,
          skipLinesWithError: true
        }))
        .on('data', (row) => {
          lineNumber++;
          
          // Tentar extrair número da primeira coluna ou procurar em todas
          const possibleNumber = this.extractPhoneNumber(row);
          
          if (possibleNumber) {
            const formatted = this.formatAndValidateNumber(possibleNumber);
            if (formatted.isValid) {
              numbers.push({
                original: possibleNumber,
                formatted: formatted.number,
                name: row.nome || row.name || `Contato ${lineNumber}`,
                line: lineNumber
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
                line: lineNumber
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
        const sheetName = workbook.SheetNames[0]; // Primeira planilha
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
                  name: row[1] || `Contato ${lineNumber}`, // Segunda coluna como nome
                  line: lineNumber
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
    // Procurar número em diferentes campos possíveis
    const possibleFields = [
      'telefone', 'phone', 'numero', 'number', 'whatsapp', 'celular', 'mobile'
    ];
    
    // Primeiro tentar campos nomeados
    for (const field of possibleFields) {
      if (row[field]) {
        return String(row[field]).trim();
      }
    }
    
    // Se não encontrar, procurar na primeira coluna ou primeira célula com número
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
    // Remover tudo que não é número
    const numbersOnly = str.replace(/\D/g, '');
    // Verificar se tem tamanho razoável para telefone brasileiro
    return numbersOnly.length >= 10 && numbersOnly.length <= 15;
  }

  formatAndValidateNumber(number) {
    // Limpar número
    let cleaned = String(number).replace(/\D/g, '');
    
    // Validar tamanho
    if (cleaned.length < 10) {
      return { isValid: false, error: 'Número muito curto' };
    }
    
    if (cleaned.length > 15) {
      return { isValid: false, error: 'Número muito longo' };
    }
    
    // Normalizar para formato brasileiro com 9º dígito
    if (cleaned.length === 11 && !cleaned.startsWith('55')) {
      // Celular brasileiro: 11987654321
      const ddd = cleaned.substring(0, 2);
      const resto = cleaned.substring(2);
      
      // Se não tem o 9º dígito, adicionar
      if (resto.length === 8) {
        cleaned = ddd + '9' + resto;
      }
      
      // Adicionar código do país
      cleaned = '55' + cleaned;
    } else if (cleaned.length === 10) {
      // Celular sem 9º dígito: 1187654321
      const ddd = cleaned.substring(0, 2);
      const resto = cleaned.substring(2);
      cleaned = '55' + ddd + '9' + resto;
    } else if (cleaned.length === 12 && !cleaned.startsWith('55')) {
      // Já tem 9º dígito, só adicionar código do país
      cleaned = '55' + cleaned;
    } else if (cleaned.length === 13 && cleaned.startsWith('55')) {
      // Já tem código do país e formato correto
      const ddd = cleaned.substring(2, 4);
      const resto = cleaned.substring(4);
      
      // Verificar se tem 9º dígito
      if (resto.length === 8) {
        cleaned = '55' + ddd + '9' + resto;
      }
    }
    
    // Formato final para WhatsApp
    const whatsappNumber = cleaned + '@c.us';
    
    return {
      isValid: true,
      number: whatsappNumber,
      displayNumber: this.formatDisplayNumber(cleaned),
      error: null
    };
  }

  formatDisplayNumber(number) {
    // Formatar para exibição: +55 (11) 99999-9999
    if (number.length === 13 && number.startsWith('55')) {
      const ddd = number.substring(2, 4);
      const nono = number.substring(4, 5);
      const prefix = number.substring(5, 9);
      const suffix = number.substring(9);
      return `+55 (${ddd}) ${nono}${prefix}-${suffix}`;
    } else if (number.length === 12 && number.startsWith('55')) {
      // Caso sem 9º dígito já processado
      const ddd = number.substring(2, 4);
      const prefix = number.substring(4, 8);
      const suffix = number.substring(8);
      return `+55 (${ddd}) ${prefix}-${suffix}`;
    }
    return number;
  }
}

// Instanciar classes globalmente
const botHumanizer = new BotHumanizer();
const fileProcessor = new FileProcessor();

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
    lastActivity: null,
    keepAliveInterval: null
  },
  support: {
    client: null,
    status: 'disconnected', 
    qrCode: null,
    lastActivity: null,
    keepAliveInterval: null
  }
};

// =====================================================
// SISTEMA DE TRACKING DE CAMPANHAS
// Configuração completa para rastreamento de envios
// =====================================================

// Importar sistema de tracking
const { getCampaignTracker } = require('./modules/campaignTracker');

// Rotas da API de campanhas (será configurado após definição do app)
const campaignRoutes = require('./routes/campaignRoutes');

// Inicializar sistema de tracking
async function initializeCampaignTracking() {
  try {
    console.log('📊 Inicializando sistema de tracking...');
    await campaignControl.init();
    console.log('✅ Sistema de tracking inicializado');
  } catch (error) {
    console.error('❌ Erro ao inicializar tracking:', error);
  }
}

// Sistema de controle de campanhas (cooldown removido - bot sempre disponível)
const campaignControl = {
  sentCampaigns: new Map(), // número -> timestamp quando campanha foi enviada
  tracker: null,
  
  async init() {
    try {
      this.tracker = getCampaignTracker();
      console.log('✅ Campaign Control inicializado com tracking');
    } catch (error) {
      console.error('❌ Erro ao inicializar tracking:', error);
    }
  },
  
  // Marcar que uma campanha foi enviada para um número (cooldown desabilitado)
  async markCampaignSent(phoneNumber, campaignData = {}) {
    const cleanNumber = phoneNumber.replace('@c.us', '');
    this.sentCampaigns.set(cleanNumber, Date.now());
    console.log(`📢 Campanha marcada para ${cleanNumber} - bot sempre disponível (cooldown desabilitado)`);
    
    // 📊 TRACKING: Registrar envio no PostgreSQL
    try {
      const campaignTracker = getCampaignTracker();
      if (campaignTracker) {
        // Usar uma campanha padrão se não especificada
        const campaignId = campaignData.campaignId || 1; // Campanha padrão
        
        // CORRIGIDO: Chamar com estrutura correta de messageData
        const result = await campaignTracker.registerSentNumber(campaignId, cleanNumber, {
          status: 'enviado',
          session: campaignData.session || 'sales',
          sent_via: 'humanized_campaign',
          messageId: campaignData.messageId || null,
          notes: `Enviado via markCampaignSent - ${new Date().toISOString()}`,
          timestamp: new Date().toISOString()
        });
        
        if (result.success) {
          console.log(`📊 Tracking: Envio registrado para ${cleanNumber} na campanha ${campaignId} - ID: ${result.sentId}`);
        } else {
          console.log(`⚠️ Tracking: Falha ao registrar ${cleanNumber} - ${result.message}`);
        }
      }
    } catch (error) {
      console.error(`❌ Erro no tracking para ${cleanNumber}:`, error.message);
      if (error.stack) {
        console.error(`   Stack:`, error.stack.split('\n').slice(0, 3).join('\n'));
      }
      // Não interromper o fluxo por erro de tracking
    }
  },
  
  // Cooldown removido - bot sempre disponível para responder
  isInCooldown(phoneNumber) {
    // Bot sempre disponível - sem cooldown
    console.log(`✅ ${phoneNumber.replace('@c.us', '')} - bot sempre disponível (cooldown desabilitado)`);
    return false;
  },
  
  // Novos métodos com tracking
  async canSendCampaign(sessionId, number, campaignId) {
    if (!this.tracker) {
      await this.init();
    }
    
    // Verificar cooldown local (desabilitado - bot sempre disponível)
    const cleanNumber = number.replace('@c.us', '');
    if (this.isInCooldown(cleanNumber)) {
      return { canSend: true, reason: 'cooldown disabled' };
    }
    
    // Verificar no sistema de tracking
    if (this.tracker && campaignId) {
      return await this.tracker.canSendToNumber(campaignId, cleanNumber);
    }
    
    return { canSend: true, reason: 'approved' };
  },
  
  async registerCampaignSent(sessionId, number, campaignId, messageData = {}) {
    const cleanNumber = number.replace('@c.us', '');
    
    // ÚNICA CHAMADA: Registrar via markCampaignSent (que já faz o tracking completo)
    await this.markCampaignSent(cleanNumber, { campaignId, session: sessionId, ...messageData });
    
    // REMOVIDO: Chamada duplicada que causava conflito
    // Agora todo o tracking é feito via markCampaignSent para evitar duplicação
    
    return { success: true, message: 'Registrado via markCampaignSent' };
  },
  
  // Limpar registros antigos (executar periodicamente)
  cleanup() {
    const now = Date.now();
    let removed = 0;
    
    // Cooldown removido - não limpar baseado em tempo
    for (const [number, sentTime] of this.sentCampaigns.entries()) {
      // Manter histórico de campanhas mas sem cooldown
      // if (now - sentTime > this.cooldownPeriod) {
      //   this.sentCampaigns.delete(number);
      //   removed++;
      // }
    }
    
    if (removed > 0) {
      console.log(`🧹 Limpeza de campanhas: ${removed} números removidos (cooldown desabilitado)`);
    }
  }
};

// Executar inicialização do tracking
initializeCampaignTracking();

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
        
        // Emitir QR via Socket.IO com base64 para exibição direta
        if (global.io) {
          global.io.emit('qrCode', {
            session: 'sales',
            qrCode: 'qr-sales.png',
            qrCodeBase64: base64Qr, // Para exibição direta no navegador
            timestamp: new Date().toISOString()
          });
        }
      },
      statusFind: (statusSession, session) => {
        console.log(`🛒 VENDAS - Estado: ${statusSession} - ${new Date().toLocaleString()}`);
        sessions.sales.status = statusSession.toLowerCase();
        
        // Log detalhado de mudanças de status
        if (statusSession === 'DISCONNECTED' || statusSession === 'TIMEOUT') {
          console.error(`🚨 VENDAS DESCONECTOU! Status: ${statusSession} às ${new Date().toLocaleString()}`);
          console.error('🔄 Tentando reconectar automaticamente em 30 segundos...');
          setTimeout(() => {
            if (sessions.sales.status !== 'connected') {
              console.log('🔄 Iniciando reconexão automática...');
              createSalesSession().catch(console.error);
            }
          }, 30000);
        }
        
        // Emitir status simples (sem dados complexos)
        if (global.io) {
          global.io.emit('session_status', {
            session: 'sales',
            status: statusSession.toLowerCase(),
            timestamp: new Date().toISOString()
          });
        }
        
        if (statusSession === 'CONNECTED') {
          console.log('✅ Bot VENDAS conectado com sucesso!');
          console.log('🛒 Sistema de VENDAS ativo');
          sessions.sales.status = 'connected';
          sessions.sales.lastActivity = new Date();
          
          // Iniciar keep-alive
          startKeepAlive(client, 'sales');
        }
      },
      headless: true,
      devtools: false,
      debug: false,
      logQR: false,
      autoClose: 0, // DESABILITAR auto-close
      disableSpins: true,
      updatesLog: false, // Reduzir logs
      disableWelcome: true
    });

    // Manipulador de mensagens para vendas com tratamento de erro robusto
    client.onMessage(async (message) => {
      try {
        // Ignorar mensagens de grupos, status e mensagens do próprio bot
        if (message.isGroupMsg || message.from === 'status@broadcast' || message.fromMe) return;
        
        // CORREÇÃO CRÍTICA: Ignorar mensagens vazias/undefined que são respostas automáticas da campanha
        if (!message.body || message.body.trim() === '' || message.body === 'undefined') {
          console.log(`🚫 IGNORANDO mensagem vazia/undefined de ${message.from} - não é interação real do usuário`);
          return;
        }
        
        sessions.sales.lastActivity = new Date();
        console.log(`💰 VENDAS - ${message.from}: ${message.body} - ${new Date().toLocaleString()}`);
        
        if (message.body === 'Hello') {
          // Cooldown removido - bot sempre disponível
          console.log(`✅ ${message.from} - respondendo "Hello" (cooldown desabilitado)`);
          
          // REMOVIDO: setTimeout que causava segunda mensagem automática
          // APENAS UMA MENSAGEM - sem timeout para evitar ban
          await client.sendText(message.from, '🏆 Olá! Bem-vindo à ROYAL – A NOITE É SUA, O REINADO É NOSSO!\n\n🔥 MC DANIEL – O FALCÃO vai comandar o palco! \n\nSe é luxo e exclusividade que você procura… Aqui é o seu lugar!\n\nDigite *EVENTOS* para ver todas as opções de ingressos e camarotes! 🎫✨');
          
        } else {
          await handleSalesMessage(client, message);
        }
      } catch (error) {
        console.error(`❌ VENDAS - Erro no handler às ${new Date().toLocaleString()}:`, error);
        // Não parar a sessão por causa de um erro de mensagem
      }
    });

    // Adicionar handler para detectar desconexões
    client.onStateChange((state) => {
      console.log(`🛒 VENDAS - Mudança de estado: ${state} às ${new Date().toLocaleString()}`);
      if (state === 'CONFLICT' || state === 'UNLAUNCHED') {
        console.error(`🚨 VENDAS - Estado problemático detectado: ${state}`);
      }
    });

    sessions.sales.client = client;
    
    // Verificar campanhas interrompidas quando a sessão conectar
    // Sistema de recuperação de campanhas
    setTimeout(async () => {
      try {
        if (recoveryManager) {
          console.log('🔍 Verificando campanhas interrompidas para recuperação...');
          await recoveryManager.checkForInterruptedCampaigns('sales', client);
        } else {
          console.log('⚠️ Sistema de recuperação não disponível (recoveryManager não inicializado)');
        }
      } catch (error) {
        console.error('❌ Erro ao verificar campanhas interrompidas:', error);
      }
    }, 5000); // Aguardar 5s para garantir que a sessão está estável
    
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
        
        // Emitir QR via Socket.IO com base64 para exibição direta
        if (global.io) {
          global.io.emit('qrCode', {
            session: 'support',
            qrCode: 'qr-support.png',
            qrCodeBase64: base64Qr, // Para exibição direta no navegador
            timestamp: new Date().toISOString()
          });
        }
      },
      statusFind: (statusSession, session) => {
        console.log(`🛟 SUPORTE - Estado: ${statusSession} - ${new Date().toLocaleString()}`);
        sessions.support.status = statusSession.toLowerCase();
        
        // Log detalhado de mudanças de status
        if (statusSession === 'DISCONNECTED' || statusSession === 'TIMEOUT') {
          console.error(`🚨 SUPORTE DESCONECTOU! Status: ${statusSession} às ${new Date().toLocaleString()}`);
          console.error('🔄 Tentando reconectar automaticamente em 30 segundos...');
          setTimeout(() => {
            if (sessions.support.status !== 'connected') {
              console.log('🔄 Iniciando reconexão automática...');
              createSupportSession().catch(console.error);
            }
          }, 30000);
        }
        
        // Emitir status simples (sem dados complexos)
        if (global.io) {
          global.io.emit('session_status', {
            session: 'support',
            status: statusSession.toLowerCase(),
            timestamp: new Date().toISOString()
          });
        }
        
        if (statusSession === 'CONNECTED') {
          console.log('✅ Bot SUPORTE conectado com sucesso!');
          console.log('🛟 Sistema de SUPORTE ativo');
          sessions.support.status = 'connected';
          sessions.support.lastActivity = new Date();
          
          // Iniciar keep-alive
          startKeepAlive(client, 'support');
        }
      },
      headless: true,
      devtools: false,
      debug: false,
      logQR: false,
      autoClose: 0, // DESABILITAR auto-close
      disableSpins: true,
      updatesLog: false, // Reduzir logs
      disableWelcome: true
    });

    // Manipulador de mensagens para suporte com tratamento de erro robusto
    client.onMessage(async (message) => {
      try {
        // Ignorar mensagens de grupos, status e mensagens do próprio bot
        if (message.isGroupMsg || message.from === 'status@broadcast' || message.fromMe) return;
        
        // CORREÇÃO CRÍTICA: Ignorar mensagens vazias/undefined que são respostas automáticas da campanha
        if (!message.body || message.body.trim() === '' || message.body === 'undefined') {
          console.log(`🚫 IGNORANDO mensagem vazia/undefined de ${message.from} - não é interação real do usuário`);
          return;
        }
        
        sessions.support.lastActivity = new Date();
        console.log(`🛟 SUPORTE - ${message.from}: ${message.body} - ${new Date().toLocaleString()}`);
        
        if (message.body === 'Hello') {
          // Cooldown removido - bot sempre disponível
          console.log(`✅ ${message.from} - respondendo "Hello" no suporte (cooldown desabilitado)`);
          
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
        console.error(`❌ SUPORTE - Erro no handler às ${new Date().toLocaleString()}:`, error);
        // Não parar a sessão por causa de um erro de mensagem
      }
    });

    // Adicionar handler para detectar desconexões
    client.onStateChange((state) => {
      console.log(`🛟 SUPORTE - Mudança de estado: ${state} às ${new Date().toLocaleString()}`);
      if (state === 'CONFLICT' || state === 'UNLAUNCHED') {
        console.error(`🚨 SUPORTE - Estado problemático detectado: ${state}`);
      }
    });

    sessions.support.client = client;
    
    // Verificar campanhas interrompidas quando a sessão conectar
    // Sistema de recuperação de campanhas
    setTimeout(async () => {
      try {
        if (recoveryManager) {
          console.log('🔍 Verificando campanhas interrompidas para recuperação (suporte)...');
          await recoveryManager.checkForInterruptedCampaigns('support', client);
        } else {
          console.log('⚠️ Sistema de recuperação não disponível (recoveryManager não inicializado)');
        }
      } catch (error) {
        console.error('❌ Erro ao verificar campanhas interrompidas (suporte):', error);
      }
    }, 5000); // Aguardar 5s para garantir que a sessão está estável
    
    return client;

  } catch (error) {
    console.error('❌ Erro ao criar sessão de suporte:', error);
    throw error;
  }
}

// Sistema de Keep-Alive para manter sessões ativas 24/7
function startKeepAlive(client, sessionName) {
  console.log(`💗 Iniciando keep-alive para sessão ${sessionName}`);
  
  const keepAliveInterval = setInterval(async () => {
    try {
      if (sessions[sessionName]?.status !== 'connected') {
        console.log(`⚠️ Keep-alive: Sessão ${sessionName} não está conectada, parando keep-alive`);
        clearInterval(keepAliveInterval);
        return;
      }
      
      // Verificar se ainda está conectado
      const isConnected = await client.getConnectionState();
      console.log(`💗 Keep-alive ${sessionName}: ${isConnected} - ${new Date().toLocaleString()}`);
      
      if (isConnected === 'CONNECTED') {
        sessions[sessionName].lastActivity = new Date();
        
        // A cada 30 minutos, fazer uma operação leve para manter ativo
        if (Date.now() % (30 * 60 * 1000) < 60000) { // A cada 30min
          try {
            await client.getHostDevice();
            console.log(`💗 Keep-alive: Sessão ${sessionName} mantida ativa`);
          } catch (error) {
            console.log(`⚠️ Keep-alive: Erro leve em ${sessionName}:`, error.message);
          }
        }
      } else {
        console.error(`🚨 Keep-alive: ${sessionName} desconectado! Estado: ${isConnected}`);
        // Não tentar reconectar automaticamente aqui para evitar loops
      }
      
    } catch (error) {
      console.error(`❌ Keep-alive error para ${sessionName}:`, error.message);
      // Não parar o keep-alive por causa de um erro
    }
  }, 60000); // Verificar a cada 1 minuto
  
  // Salvar referência do interval para poder parar depois
  sessions[sessionName].keepAliveInterval = keepAliveInterval;
}

// Função para parar keep-alive
function stopKeepAlive(sessionName) {
  if (sessions[sessionName]?.keepAliveInterval) {
    clearInterval(sessions[sessionName].keepAliveInterval);
    console.log(`💗 Keep-alive parado para ${sessionName}`);
  }
}

// Sistema de auto-recuperação inteligente
function startAutoRecovery() {
  console.log('🔧 Iniciando sistema de auto-recuperação...');
  
  // Verificar e reconectar sessões desconectadas
  setInterval(async () => {
    try {
      for (const sessionName of Object.keys(sessions)) {
        const session = sessions[sessionName];
        
        // Se sessão está desconectada, tentar reconectar
        if (session.status === 'disconnected' || !session.client) {
          console.warn(`🔧 Detectada sessão desconectada: ${sessionName}`);
          console.log(`🔧 Tentando reconectar sessão ${sessionName}...`);
          
          try {
            // Reinicializar sessão baseado no tipo
            if (sessionName === 'support') {
              await createSupportSession();
              console.log(`✅ Sessão ${sessionName} reconectada com sucesso!`);
            } else if (sessionName === 'sales') {
              await createSalesSession();
              console.log(`✅ Sessão ${sessionName} reconectada com sucesso!`);
            }
          } catch (error) {
            console.error(`❌ Falha ao reconectar ${sessionName}:`, error.message);
          }
        }
        
        // Verificar se sessão está "fantasma" (conectada mas sem resposta)
        if (session.status === 'connected' && session.client) {
          try {
            // Teste simples para verificar se sessão responde
            const info = await session.client.getHostDevice();
            if (!info) {
              console.warn(`🔧 Sessão ${sessionName} não responde - forçando reconexão`);
              session.status = 'disconnected';
            }
          } catch (testError) {
            console.warn(`🔧 Sessão ${sessionName} falhou no teste de saúde:`, testError.message);
            session.status = 'disconnected';
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro na auto-recuperação:', error.message);
    }
  }, 5 * 60 * 1000); // A cada 5 minutos
}

// Sistema de restart inteligente com condições
function scheduleIntelligentRestart() {
  console.log('⏰ Configurando restart inteligente...');
  
  // Restart automático diário (às 3:00 AM quando normalmente há menos atividade)
  setInterval(() => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // Se for 3:00 AM, fazer restart preventivo
    if (hour === 3 && minute === 0) {
      console.log('⏰ Restart automático diário às 3:00 AM');
      gracefulShutdown();
    }
  }, 60000); // Verificar a cada minuto
  
  // Sistema de restart por uptime (a cada 7 dias)
  setInterval(() => {
    const uptime = process.uptime();
    const days = uptime / (24 * 60 * 60);
    
    if (days >= 7) {
      console.log(`⏰ Restart automático após ${days.toFixed(1)} dias de uptime`);
      gracefulShutdown();
    }
  }, 60 * 60 * 1000); // Verificar a cada hora
}

// Sistema de backup automático de estado
function startAutomaticBackup() {
  console.log('💾 Iniciando sistema de backup automático...');
  
  // Backup a cada 30 minutos
  setInterval(() => {
    try {
      saveSystemState();
      console.log('💾 Backup automático realizado');
    } catch (error) {
      console.error('❌ Erro no backup automático:', error.message);
    }
  }, 30 * 60 * 1000);
  
  // Backup de logs diário (às 2:00 AM)
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 2 && now.getMinutes() === 0) {
      backupLogs();
    }
  }, 60000);
}

// Função para backup de logs
function backupLogs() {
  try {
    const timestamp = new Date().toISOString().split('T')[0];
    const backupDir = `logs/backup-${timestamp}`;
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Copiar logs importantes
    const logFiles = ['critical-errors.log', 'memory-critical.log', 'health-report.log'];
    
    logFiles.forEach(logFile => {
      const sourcePath = `logs/${logFile}`;
      const backupPath = `${backupDir}/${logFile}`;
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, backupPath);
        console.log(`💾 Log backup: ${logFile} -> ${backupPath}`);
      }
    });
    
    console.log(`💾 Backup de logs concluído em: ${backupDir}`);
  } catch (error) {
    console.error('❌ Erro no backup de logs:', error.message);
  }
}

// Sistema de limpeza de arquivos antigos
function startCleanupSystem() {
  console.log('🧹 Iniciando sistema de limpeza...');
  
  // Limpeza diária às 1:00 AM
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 1 && now.getMinutes() === 0) {
      cleanupOldFiles();
    }
  }, 60000);
}

function cleanupOldFiles() {
  try {
    console.log('🧹 Iniciando limpeza de arquivos antigos...');
    
    // Limpar backups antigos (manter apenas 7 dias)
    const logsDir = 'logs';
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir);
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      
      files.forEach(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > sevenDays) {
          if (file.startsWith('backup-') || file.includes('old-')) {
            fs.rmSync(filePath, { recursive: true, force: true });
            console.log(`🧹 Removido arquivo antigo: ${file}`);
          }
        }
      });
    }
    
    // Limpar cache temporário se existir
    const tempDirs = ['temp', 'cache', '.wwebjs_cache'];
    tempDirs.forEach(tempDir => {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
          const filePath = path.join(tempDir, file);
          const stats = fs.statSync(filePath);
          const threeDays = 3 * 24 * 60 * 60 * 1000;
          
          if (Date.now() - stats.mtime.getTime() > threeDays) {
            fs.rmSync(filePath, { recursive: true, force: true });
            console.log(`🧹 Cache limpo: ${filePath}`);
          }
        });
      }
    });
    
    console.log('🧹 Limpeza concluída');
  } catch (error) {
    console.error('❌ Erro na limpeza:', error.message);
  }
}

// Sistema de monitoramento de sessões 24/7
function startSessionMonitoring() {
  console.log('📊 Iniciando monitoramento de sessões...');
  
  const monitoringInterval = setInterval(() => {
    const now = new Date();
    
    Object.keys(sessions).forEach(sessionName => {
      const session = sessions[sessionName];
      
      if (session.status === 'connected' && session.lastActivity) {
        const timeSinceActivity = now - session.lastActivity;
        const hoursSinceActivity = timeSinceActivity / (1000 * 60 * 60);
        
        console.log(`📊 Monitoramento ${sessionName}: ativo há ${hoursSinceActivity.toFixed(1)}h - Status: ${session.status}`);
        
        // Alertar se não há atividade há mais de 2 horas
        if (hoursSinceActivity > 2) {
          console.warn(`⚠️ ALERTA: Sessão ${sessionName} sem atividade há ${hoursSinceActivity.toFixed(1)} horas`);
        }
        
        // Alertar se não há atividade há mais de 6 horas (possível problema)
        if (hoursSinceActivity > 6) {
          console.error(`🚨 PROBLEMA: Sessão ${sessionName} inativa há ${hoursSinceActivity.toFixed(1)} horas!`);
        }
      } else if (session.status === 'connected' && !session.lastActivity) {
        console.warn(`⚠️ Sessão ${sessionName} conectada mas sem registro de atividade`);
        session.lastActivity = now; // Definir atividade inicial
      }
    });
  }, 10 * 60 * 1000); // Verificar a cada 10 minutos
  
  // Salvar referência global para poder parar no shutdown
  global.sessionMonitoringInterval = monitoringInterval;
}

// Sistema de monitoramento de recursos do sistema
function startResourceMonitoring() {
  console.log('💾 Iniciando monitoramento de recursos...');
  
  const monitoringInterval = setInterval(() => {
    try {
      const used = process.memoryUsage();
      const uptime = process.uptime();
      
      const memMB = {
        rss: Math.round(used.rss / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100,
        heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
        external: Math.round(used.external / 1024 / 1024 * 100) / 100
      };
      
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      
      console.log(`💾 Recursos - RAM: ${memMB.heapUsed}/${memMB.heapTotal}MB | RSS: ${memMB.rss}MB | Uptime: ${hours}h ${minutes}m`);
      
      // Log detalhado a cada hora
      if (Math.floor(uptime) % 3600 === 0) {
        console.log(`📈 Relatório de 1h - Heap Total: ${memMB.heapTotal}MB | External: ${memMB.external}MB`);
        
        // Salvar backup automático a cada hora
        try {
          saveSystemState();
        } catch (error) {
          console.error('❌ Erro no backup automático:', error.message);
        }
      }
      
      // Alerta se memória alta (acima de 400MB)
      if (memMB.heapUsed > 400) {
        console.warn(`⚠️ ALERTA: Uso alto de memória: ${memMB.heapUsed}MB`);
        
        // Forçar garbage collection se disponível
        if (global.gc) {
          console.log('🧹 Executando garbage collection...');
          global.gc();
          
          // Verificar memória após GC
          const afterGC = process.memoryUsage();
          const afterMB = Math.round(afterGC.heapUsed / 1024 / 1024 * 100) / 100;
          console.log(`🧹 Memória após GC: ${afterMB}MB (liberou ${(memMB.heapUsed - afterMB).toFixed(1)}MB)`);
        } else {
          console.log('⚠️ Garbage collection manual não disponível (inicie com --expose-gc)');
        }
      }
      
      // Alerta crítico (acima de 700MB)
      if (memMB.heapUsed > 700) {
        console.error(`🚨 CRÍTICO: Memória muito alta: ${memMB.heapUsed}MB`);
        console.error('🚨 Considerando restart preventivo para evitar crash...');
        
        // Log crítico para arquivo
        const criticalLog = `[${new Date().toISOString()}] MEMORY CRITICAL: ${memMB.heapUsed}MB heap used\n`;
        fs.appendFileSync('logs/memory-critical.log', criticalLog);
        
        // Se passar de 800MB, fazer restart gracioso
        if (memMB.heapUsed > 800) {
          console.error(`🚨 RESTART PREVENTIVO: Memória atingiu ${memMB.heapUsed}MB`);
          gracefulShutdown();
        }
      }
      
      // Alertar se RSS muito alto (problema do sistema)
      if (memMB.rss > 1000) {
        console.warn(`⚠️ RSS alto: ${memMB.rss}MB - possível leak de memória`);
      }
      
    } catch (error) {
      console.error('❌ Erro no monitoramento de recursos:', error.message);
    }
  }, 60000); // A cada 1 minuto
  
  // Salvar referência global
  global.monitoringInterval = monitoringInterval;
}

// Sistema de verificação de saúde geral
function startHealthCheck() {
  console.log('🏥 Iniciando verificação de saúde do sistema...');
  
  setInterval(() => {
    try {
      const health = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        activeSessions: 0,
        connectedSessions: 0,
        systemOk: true,
        warnings: []
      };
      
      // Verificar sessões
      Object.keys(sessions).forEach(sessionName => {
        const session = sessions[sessionName];
        health.activeSessions++;
        
        if (session.status === 'connected' || session.status === 'inchat') {
          health.connectedSessions++;
        }
        
        // Verificar se há problemas
        if (session.lastActivity) {
          const timeSinceActivity = Date.now() - new Date(session.lastActivity).getTime();
          const hoursSinceActivity = timeSinceActivity / (1000 * 60 * 60);
          
          if (hoursSinceActivity > 4) {
            health.warnings.push(`Sessão ${sessionName} inativa há ${hoursSinceActivity.toFixed(1)}h`);
            health.systemOk = false;
          }
        }
      });
      
      // Verificar memória
      const heapUsedMB = Math.round(health.memory.heapUsed / 1024 / 1024);
      if (heapUsedMB > 500) {
        health.warnings.push(`Memória alta: ${heapUsedMB}MB`);
        health.systemOk = false;
      }
      
      // Log de saúde detalhado a cada 30 minutos
      if (Math.floor(health.uptime) % 1800 === 0) {
        console.log('🏥 Health Check:', JSON.stringify(health, null, 2));
        
        // Salvar relatório de saúde
        fs.appendFileSync('logs/health-report.log', JSON.stringify(health) + '\n');
      }
      
      // Se tudo ok, log simples
      if (health.systemOk) {
        console.log(`🏥 Sistema saudável - ${health.connectedSessions}/${health.activeSessions} sessões conectadas`);
      } else {
        console.warn(`⚠️ Problemas detectados: ${health.warnings.join(', ')}`);
      }
      
    } catch (error) {
      console.error('❌ Erro na verificação de saúde:', error.message);
    }
  }, 10 * 60 * 1000); // A cada 10 minutos
}

// Funções de mensagem humanizadas
async function handleSalesMessage(client, message) {
  const userId = message.from;
  const userMessage = (message.body || '').toLowerCase();
  
  // COOLDOWN REMOVIDO - Bot sempre disponível
  console.log(`✅ ${userId} - processando mensagem no sales (cooldown desabilitado)`);
  
  // VERIFICAR se a mensagem parece ser uma resposta a campanha de marketing
  const originalMessage = message.body || '';
  if (originalMessage.includes('💥ROYAL') || originalMessage.includes('MC DANIEL') || 
      originalMessage.includes('FALCÃO') || originalMessage.includes('CAMAROTES PREMIUM') ||
      originalMessage.includes('McLaren') || originalMessage.includes('Ferrari') || 
      originalMessage.includes('Lamborghini') || originalMessage.includes('Porsche') ||
      originalMessage.includes('BISTRÔS ROYAL') || originalMessage.includes('fileira') ||
      originalMessage.includes('totalingressos.com')) {
    console.log(`🚫 ${userId} enviou resposta à campanha de marketing - não responder automaticamente`);
    return; // NÃO responder se a mensagem contém conteúdo de campanha
  }
  
  // Verificar se já está sendo atendido
  if (botHumanizer.isUserBeingServed(userId)) {
    console.log(`⏳ ${userId} já está sendo atendido, ignorando mensagem`);
    return;
  }
  
  // Verificar se a pergunta é sobre localização ANTES de qualquer processamento
  if (userMessage.includes('localização') || userMessage.includes('localizacao') || 
      userMessage.includes('endereço') || userMessage.includes('endereco') || 
      userMessage.includes('onde fica') || userMessage.includes('onde é') || 
      userMessage.includes('local') || userMessage.includes('lugar') || 
      userMessage.includes('como chegar') || userMessage.includes('mapa') || 
      userMessage.includes('google maps') || userMessage.includes('maps') ||
      userMessage.includes('rua') || userMessage.includes('avenida') || 
      userMessage.includes('bairro') || userMessage.includes('cidade')) {
    
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
    
    await botHumanizer.simulateHumanResponse(client, userId, response, userMessage, true);
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
    
    await botHumanizer.simulateHumanResponse(client, userId, response, userMessage, true);
    return;
  }

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
    let response;
    let shouldHumanize = true;
    
    // Máquina de estados
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
        
      case 'quantidade':
        response = await handleQuantitySelection(userMessage);
        break;
        
      default:
        response = await generateCatalogResponse();
        userState.step = 'catalogo';
        break;
    }
    
    // Salvar estado atualizado
    userStates[userId] = userState;
    
    // USAR HUMANIZAÇÃO para resposta
    if (shouldHumanize) {
      await botHumanizer.simulateHumanResponse(client, userId, response, userMessage, true);
    } else {
      // Resposta rápida para transferências
      await client.sendSeen(userId);
      await client.startTyping(userId);
      await botHumanizer.sleep(1000 + Math.random() * 2000); // 1-3s apenas
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

// Funções auxiliares para gerar respostas
async function generateCatalogResponse() {
  return `🏆 *ROYAL – MENU COMPLETO*

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

Para mais informações, digite *EVENTOS*!`;
  } else {
    return `Para comprar ingressos acesse:
👉 https://links.totalingressos.com/mc-daniel-na-royal.html

Ou digite *EVENTOS* para ver todas as opções novamente!`;
  }
}

async function handleQuantitySelection(userMessage) {
  return `🎫 *LINK OFICIAL PARA COMPRA:*
👉 https://links.totalingressos.com/mc-daniel-na-royal.html

💸 Pix direto = reserva confirmada!
⚠️ Sem estorno em caso de cancelamento. Evento +18.`;
}

async function generateCartResponse() {
  return `🎫 *LINK OFICIAL PARA COMPRA:*
👉 https://links.totalingressos.com/mc-daniel-na-royal.html

💸 Pix direto = reserva confirmada!
⚠️ Sem estorno em caso de cancelamento. Evento +18.`;
}

async function handleSupportMessage(client, message) {
  const userId = message.from;
  const userMessage = (message.body || '').toLowerCase();
  
  // COOLDOWN REMOVIDO - Bot sempre disponível
  console.log(`✅ ${userId} - processando mensagem no support (cooldown desabilitado)`);
  
  // VERIFICAR se a mensagem parece ser uma resposta a campanha de marketing
  const originalMessage = message.body || '';
  if (originalMessage.includes('💥ROYAL') || originalMessage.includes('MC DANIEL') || 
      originalMessage.includes('FALCÃO') || originalMessage.includes('CAMAROTES PREMIUM') ||
      originalMessage.includes('McLaren') || originalMessage.includes('Ferrari') || 
      originalMessage.includes('Lamborghini') || originalMessage.includes('Porsche') ||
      originalMessage.includes('BISTRÔS ROYAL') || originalMessage.includes('fileira') ||
      originalMessage.includes('totalingressos.com')) {
    console.log(`🚫 ${userId} enviou resposta à campanha de marketing - não responder automaticamente`);
    return; // NÃO responder se a mensagem contém conteúdo de campanha
  }
  
  // Verificar se já está sendo atendido
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

Para mais informações sobre o evento, digite *EVENTOS*!`;
      
      await botHumanizer.simulateHumanResponse(client, userId, response, userMessage, true);
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
      
      await botHumanizer.simulateHumanResponse(client, userId, response, userMessage, true);
      return;
    }

    if (!openai) {
      response = '🛟 Olá! Sou o suporte da Royal. Como posso ajudar?\n\nPara informações sobre ingressos, acesse:\n👉 https://links.totalingressos.com/mc-daniel-na-royal.html';
      await botHumanizer.simulateHumanResponse(client, userId, response, userMessage, true);
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
    
    // Usar humanização para resposta da IA
    await botHumanizer.simulateHumanResponse(client, userId, response, userMessage, true);
    
  } catch (error) {
    console.error('❌ Erro OpenAI:', error);
    const fallbackResponse = '🛟 Olá! Sou o suporte da Royal. Para informações sobre ingressos, acesse:\n👉 https://links.totalingressos.com/mc-daniel-na-royal.html';
    await botHumanizer.simulateHumanResponse(client, userId, fallbackResponse, userMessage, true);
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
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));
  
  // Configurar rotas da API de campanhas
  app.use('/api/campaigns', campaignRoutes);
  
  // Configurar multer para upload melhorado
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
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limite
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
        // Parar keep-alive primeiro
        stopKeepAlive(sessionName);
        
        await sessions[sessionName].client.close();
        sessions[sessionName] = {
          client: null,
          status: 'disconnected',
          qrCode: null,
          lastActivity: null,
          keepAliveInterval: null
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

  // API para desconectar/logout da conta WhatsApp
  app.post('/api/sessions/:sessionName/logout', async (req, res) => {
    try {
      const { sessionName } = req.params;
      
      if (!sessions[sessionName]?.client) {
        return res.status(400).json({ 
          success: false, 
          message: `Sessão ${sessionName} não está conectada` 
        });
      }
      
      console.log(`🔐 Fazendo logout da sessão ${sessionName}...`);
      
      // Fazer logout da conta WhatsApp
      await sessions[sessionName].client.logout();
      
      // Parar keep-alive
      stopKeepAlive(sessionName);
      
      // Limpar a sessão
      sessions[sessionName] = {
        client: null,
        status: 'disconnected',
        qrCode: null,
        lastActivity: null,
        keepAliveInterval: null
      };
      
      console.log(`✅ Logout da sessão ${sessionName} concluído`);
      
      res.json({ 
        success: true, 
        message: `Logout da sessão ${sessionName} realizado com sucesso` 
      });
      
    } catch (error) {
      console.error(`❌ Erro no logout da sessão ${sessionName}:`, error);
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  });

  // API de teste para verificar cooldown de campanhas
  app.get('/api/test/campaign-cooldown/:phoneNumber', (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const cleanNumber = phoneNumber.replace('@c.us', '');
      
      const isInCooldown = campaignControl.isInCooldown(phoneNumber);
      const sentTime = campaignControl.sentCampaigns.get(cleanNumber);
      
      res.json({
        success: true,
        phoneNumber: cleanNumber,
        isInCooldown, // Sempre false agora
        sentTime: sentTime ? new Date(sentTime).toISOString() : null,
        cooldownRemaining: 0, // Sempre 0 - cooldown desabilitado
        totalCampaignsTracked: campaignControl.sentCampaigns.size,
        message: 'Cooldown desabilitado - bot sempre disponível'
      });
      
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  });

  // API para simular uma campanha (teste)
  app.post('/api/test/simulate-campaign', async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ 
          success: false, 
          message: 'phoneNumber é obrigatório' 
        });
      }
      
      // Marcar como se uma campanha tivesse sido enviada
      await campaignControl.markCampaignSent(phoneNumber, { campaignId: 1, session: 'test' });
      
      res.json({
        success: true,
        message: `Campanha simulada para ${phoneNumber} - cooldown desabilitado`,
        cooldownUntil: null // Cooldown desabilitado
      });
      
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  });

  // 🎭 API para testar variações de mensagens
  app.post('/api/test/message-variations', async (req, res) => {
    try {
      const { message } = req.body;
      
      if (!message || !message.trim()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Mensagem é obrigatória' 
        });
      }
      
      // Criar instância do gerador de variações
      const variationGenerator = new MessageVariationGenerator();
      
      // Gerar variações
      const startTime = Date.now();
      const variations = variationGenerator.generateVariations(message.trim());
      const endTime = Date.now();
      
      // Analisar a mensagem original
      const analysis = variationGenerator.analyzeMessage(message);
      
      res.json({
        success: true,
        originalMessage: message.trim(),
        variations: variations,
        analysis: {
          hasLinks: analysis.hasLinks.length > 0,
          hasNumbers: analysis.hasNumbers.length > 0,
          hasEmojis: analysis.hasEmojis.length > 0,
          tone: analysis.tone,
          structure: analysis.structure,
          linksFound: analysis.hasLinks,
          numbersFound: analysis.hasNumbers,
          emojisFound: analysis.hasEmojis
        },
        performance: {
          generationTime: `${endTime - startTime}ms`,
          variationsCount: variations.length
        },
        message: 'Variações geradas com sucesso'
      });
      
    } catch (error) {
      console.error('❌ Erro ao gerar variações:', error);
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

      // Salvar informações do arquivo para processamento posterior
      const fileInfo = {
        id: Date.now(),
        originalName: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        uploadedAt: new Date(),
        processed: false
      };

      // Armazenar temporariamente
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

      // Processar arquivo
      const result = await fileProcessor.processFile(fileInfo.path, fileInfo.originalName);
      
      // Marcar como processado
      fileInfo.processed = true;
      fileInfo.processedAt = new Date();
      fileInfo.result = result;

      // Salvar números para uso posterior (sem referências circulares)
      global.lastProcessedNumbers = result.numbers.map(contact => ({
        original: contact.original,
        formatted: contact.formatted,
        name: contact.name,
        line: contact.line,
        displayNumber: contact.displayNumber || contact.original
      }));

      // Preparar dados para resposta (sem objetos complexos)
      const responseData = {
        totalLines: result.numbers.length + result.errors.length,
        validNumbers: result.numbers.length,
        errors: result.errors.length,
        numbers: result.numbers.map(contact => ({
          original: contact.original,
          formatted: contact.formatted,
          name: contact.name,
          line: contact.line,
          displayNumber: contact.displayNumber || contact.original
        })),
        hasMore: false, // Todos os números são retornados
        errorSample: result.errors.slice(0, 10).map(error => ({
          line: error.line,
          original: String(error.original).substring(0, 100), // Limitar tamanho
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

  // API para obter status das sessões
  app.get('/api/sessions/status', async (req, res) => {
    try {
      console.log('📊 API de status chamada - verificando sessões...');
      const status = {};
      
      for (const sessionName of Object.keys(sessions)) {
        const session = sessions[sessionName];
        let realStatus = session.status || 'disconnected';
        
        // Verificar o status real da conexão se o cliente existe
        if (session.client) {
          try {
            const connectionState = await session.client.getConnectionState();
            console.log(`🔍 ${sessionName} - Estado da conexão: ${connectionState}`);
            
            if (connectionState === 'CONNECTED') {
              realStatus = 'connected';
            } else if (connectionState === 'DISCONNECTED' || connectionState === 'TIMEOUT') {
              realStatus = 'disconnected';
            } else if (connectionState === 'OPENING') {
              realStatus = 'connecting';
            } else {
              realStatus = connectionState.toLowerCase();
            }
            
            // Atualizar o status na sessão
            session.status = realStatus;
            
          } catch (error) {
            console.warn(`⚠️ ${sessionName} - Erro ao verificar conexão:`, error.message);
            realStatus = 'disconnected';
            session.status = 'disconnected';
          }
        }
        
        const sessionStatus = {
          status: realStatus,
          client: session.client ? 'active' : null,
          lastActivity: session.lastActivity || null,
          uptime: session.lastActivity ? Date.now() - new Date(session.lastActivity).getTime() : 0,
          qrCode: session.qrCode || null
        };
        status[sessionName] = sessionStatus;
        console.log(`📊 Sessão ${sessionName}: status=${sessionStatus.status}, client=${sessionStatus.client}`);
      }
      
      res.json({
        success: true,
        sessions: status,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Erro na API de status:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao obter status das sessões: ' + error.message
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
        // Usar números fornecidos diretamente
        numbersToSend = numbers;
      } else if (global.lastProcessedNumbers && global.lastProcessedNumbers.length > 0) {
        // Usar números processados do upload
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
      
      // Detectar campanhas grandes (mais de 1000 números) e usar processamento em lotes
      if (numbersToSend.length > 1000) {
        console.log(`📦 Campanha grande detectada (${numbersToSend.length} números) - usando processamento em lotes`);
        
        // Usar processamento em lotes para campanhas grandes (lotes de 300)
        const batchProcessor = new CampaignBatchProcessor({
          batchSize: 300,           // Lotes menores para evitar rate limit
          minInterval: parseInt(process.env.MIN_DELAY) || 7000,   // Mínimo 7s entre mensagens
          maxInterval: parseInt(process.env.MAX_DELAY) || 15000,  // Máximo 15s entre mensagens
          batchDelayMin: 15000,     // Mínimo 15s entre lotes
          batchDelayMax: 30000      // Máximo 30s entre lotes
        });
        
        // CORREÇÃO: Configurar campaignControl para salvamento
        batchProcessor.campaignControl = campaignControl;
        
        // Configurar gerenciador de estado
        // batchProcessor.setStateManager(stateManager);
        
        // Processar em background
        batchProcessor.processLargeCampaignArray(numbersToSend, message, sessionName, client)
          .then(results => {
            console.log(`📊 Campanha em lotes ${sessionName} finalizada: ${results.successCount} enviadas, ${results.failedCount} falhas`);
          })
          .catch(error => {
            console.error(`❌ Erro na campanha em lotes ${sessionName}:`, error);
          });
        
        // Resposta imediata
        return res.json({
          success: true,
          message: `Campanha grande iniciada via ${sessionName} com processamento em lotes!`,
          results: {
            total: numbersToSend.length,
            status: 'processamento_em_lotes',
            estimatedTime: Math.round(numbersToSend.length / 300 * 2) + ' minutos (modo seguro)'
          }
        });
      }
      
      // Para campanhas menores, usar o método tradicional
      sendHumanizedCampaign(client, numbersToSend, message, sessionName, {
        name: `Campanha ${sessionName} ${new Date().toLocaleString()}`
      })
        .then(results => {
          console.log(`📊 Campanha ${sessionName} finalizada: ${results.sent} enviadas, ${results.failed} falhas`);
        })
        .catch(error => {
          console.error(`❌ Erro na campanha ${sessionName}:`, error);
        });
      
      // Resposta imediata para evitar timeout
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

  // API para exportar números processados
  app.get('/api/export/numbers', (req, res) => {
    try {
      if (!global.lastProcessedNumbers || global.lastProcessedNumbers.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Nenhum número processado encontrado para exportar'
        });
      }

      const format = req.query.format || 'csv'; // csv, txt, json
      const filename = `numeros_exportados_${Date.now()}`;

      switch (format.toLowerCase()) {
        case 'csv':
          // Criar CSV com headers
          let csvContent = 'numero_original,numero_formatado,nome,linha\n';
          global.lastProcessedNumbers.forEach(contact => {
            csvContent += `"${contact.original}","${contact.formatted}","${contact.name || ''}",${contact.line || ''}\n`;
          });
          
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
          res.send(csvContent);
          break;

        case 'txt':
          // Apenas números formatados, um por linha
          const txtContent = global.lastProcessedNumbers
            .map(contact => contact.formatted.replace('@c.us', ''))
            .join('\n');
          
          res.setHeader('Content-Type', 'text/plain');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.txt"`);
          res.send(txtContent);
          break;

        case 'json':
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
          res.json({
            exportedAt: new Date().toISOString(),
            total: global.lastProcessedNumbers.length,
            numbers: global.lastProcessedNumbers
          });
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Formato inválido. Use: csv, txt ou json'
          });
      }

      console.log(`📊 Exportação realizada: ${global.lastProcessedNumbers.length} números em formato ${format}`);

    } catch (error) {
      console.error('❌ Erro na exportação:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao exportar números: ' + error.message
      });
    }
  });

  // API para exportar contatos do WhatsApp conectado
  app.get('/api/export/whatsapp-contacts/:sessionName', async (req, res) => {
    try {
      const { sessionName } = req.params;
      const format = req.query.format || 'csv'; // csv, txt, json
      const client = sessions[sessionName]?.client;
      
      console.log(`📱 Tentativa de exportação - Sessão: ${sessionName}, Status: ${sessions[sessionName]?.status}, Client: ${client ? 'presente' : 'ausente'}`);
      
      if (!client) {
        console.error(`❌ Sessão ${sessionName} não tem client ativo`);
        return res.status(400).json({ 
          success: false, 
          message: `Sessão ${sessionName} não conectada - client não encontrado` 
        });
      }
      
      // Aceitar vários status como válidos
      const validStatuses = ['connected', 'inchat', 'qrreadsuccess'];
      const currentStatus = sessions[sessionName]?.status?.toLowerCase();
      
      if (!validStatuses.includes(currentStatus)) {
        console.error(`❌ Sessão ${sessionName} não está em status válido - Status: ${sessions[sessionName]?.status}`);
        return res.status(400).json({ 
          success: false, 
          message: `Sessão ${sessionName} não está conectada - Status: ${sessions[sessionName]?.status}` 
        });
      }

      console.log(`📱 Exportando contatos do WhatsApp da sessão ${sessionName}...`);

      // Buscar todos os contatos do WhatsApp
      const contacts = await client.getAllContacts();
      console.log(`📱 Total de contatos encontrados: ${contacts.length}`);
      
      // Filtrar e formatar contatos
      const formattedContacts = contacts
        .filter(contact => contact.id && contact.id.user && !contact.id.user.includes('@g.us')) // Remover grupos
        .map(contact => ({
          numero_whatsapp: contact.id.user,
          numero_formatado: contact.id.user + '@c.us',
          nome: contact.name || contact.pushname || contact.id.user,
          nome_exibicao: contact.pushname || contact.name || '',
          telefone_formatado: formatPhoneNumber(contact.id.user),
          status_verificado: contact.isWAContact ? 'Sim' : 'Não',
          foto_perfil: contact.profilePicThumbObj?.eurl || '',
          exportado_em: new Date().toISOString()
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome));

      console.log(`📱 Contatos válidos filtrados: ${formattedContacts.length}`);

      if (formattedContacts.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Nenhum contato encontrado no WhatsApp'
        });
      }

      const filename = `contatos_whatsapp_${sessionName}_${Date.now()}`;

      switch (format.toLowerCase()) {
        case 'csv':
          // Criar CSV com headers completos
          let csvContent = 'numero_whatsapp,numero_formatado,nome,nome_exibicao,telefone_formatado,status_verificado,exportado_em\n';
          formattedContacts.forEach(contact => {
            csvContent += `"${contact.numero_whatsapp}","${contact.numero_formatado}","${contact.nome}","${contact.nome_exibicao}","${contact.telefone_formatado}","${contact.status_verificado}","${contact.exportado_em}"\n`;
          });
          
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
          res.send('\ufeff' + csvContent); // BOM para UTF-8 no Excel
          break;

        case 'txt':
          // Apenas números, um por linha (formato simples)
          const txtContent = formattedContacts
            .map(contact => contact.numero_whatsapp)
            .join('\n');
          
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.txt"`);
          res.send(txtContent);
          break;

        case 'json':
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
          res.json({
            sessao: sessionName,
            exportado_em: new Date().toISOString(),
            total_contatos: formattedContacts.length,
            contatos: formattedContacts
          });
          break;

        case 'vcf':
          // Formato vCard para importar em outros apps
          let vcfContent = '';
          formattedContacts.forEach(contact => {
            vcfContent += `BEGIN:VCARD\n`;
            vcfContent += `VERSION:3.0\n`;
            vcfContent += `FN:${contact.nome}\n`;
            vcfContent += `TEL;TYPE=CELL:${contact.numero_whatsapp}\n`;
            if (contact.nome_exibicao && contact.nome_exibicao !== contact.nome) {
              vcfContent += `NICKNAME:${contact.nome_exibicao}\n`;
            }
            vcfContent += `END:VCARD\n\n`;
          });
          
          res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.vcf"`);
          res.send(vcfContent);
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Formato inválido. Use: csv, txt, json ou vcf'
          });
      }

      console.log(`📊 Exportação de contatos WhatsApp realizada: ${formattedContacts.length} contatos da sessão ${sessionName} em formato ${format}`);

    } catch (error) {
      console.error('❌ Erro ao exportar contatos do WhatsApp:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao exportar contatos: ' + error.message
      });
    }
  });

  // API para obter estatísticas dos números processados
  app.get('/api/stats/numbers', (req, res) => {
    try {
      if (!global.lastProcessedNumbers || global.lastProcessedNumbers.length === 0) {
        return res.json({
          success: true,
          total: 0,
          message: 'Nenhum número processado'
        });
      }

      // Analisar DDDs
      const dddStats = {};
      global.lastProcessedNumbers.forEach(contact => {
        const cleanNumber = contact.formatted.replace('@c.us', '').replace('55', '');
        const ddd = cleanNumber.substring(0, 2);
        dddStats[ddd] = (dddStats[ddd] || 0) + 1;
      });

      // Ordenar DDDs por quantidade
      const sortedDDDs = Object.entries(dddStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10); // Top 10 DDDs

      res.json({
        success: true,
        total: global.lastProcessedNumbers.length,
        topDDDs: sortedDDDs.map(([ddd, count]) => ({ ddd, count })),
        sample: global.lastProcessedNumbers.slice(0, 10).map(contact => ({
          original: contact.original,
          formatted: contact.formatted.replace('@c.us', ''),
          name: contact.name
        }))
      });

    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao obter estatísticas: ' + error.message
      });
    }
  });

  // API para obter estatísticas dos contatos do WhatsApp
  app.get('/api/stats/whatsapp-contacts/:sessionName', async (req, res) => {
    try {
      const { sessionName } = req.params;
      const client = sessions[sessionName]?.client;
      
      if (!client) {
        return res.status(400).json({ 
          success: false, 
          message: `Sessão ${sessionName} não conectada - client não encontrado` 
        });
      }
      
      // Aceitar vários status como válidos
      const validStatuses = ['connected', 'inchat', 'qrreadsuccess'];
      const currentStatus = sessions[sessionName]?.status?.toLowerCase();
      
      if (!validStatuses.includes(currentStatus)) {
        return res.status(400).json({ 
          success: false, 
          message: `Sessão ${sessionName} não está conectada - Status: ${sessions[sessionName]?.status}` 
        });
      }

      console.log(`📊 Analisando contatos do WhatsApp da sessão ${sessionName}...`);

      // Buscar todos os contatos
      const contacts = await client.getAllContacts();
      
      // Filtrar e analisar contatos
      const validContacts = contacts.filter(contact => 
        contact.id && contact.id.user && !contact.id.user.includes('@g.us')
      );

      // Estatísticas por DDD
      const dddStats = {};
      const statusStats = { verificados: 0, nao_verificados: 0 };
      const nomeStats = { com_nome: 0, sem_nome: 0 };

      validContacts.forEach(contact => {
        // Analisar DDD
        const number = contact.id.user;
        if (number.length >= 10) {
          let cleanNumber = number.replace(/\D/g, '');
          // Se tem código do país, remover
          if (cleanNumber.startsWith('55') && cleanNumber.length > 11) {
            cleanNumber = cleanNumber.substring(2);
          }
          const ddd = cleanNumber.substring(0, 2);
          dddStats[ddd] = (dddStats[ddd] || 0) + 1;
        }

        // Analisar status de verificação
        if (contact.isWAContact) {
          statusStats.verificados++;
        } else {
          statusStats.nao_verificados++;
        }

        // Analisar nomes
        if (contact.name || contact.pushname) {
          nomeStats.com_nome++;
        } else {
          nomeStats.sem_nome++;
        }
      });

      // Ordenar DDDs por quantidade
      const topDDDs = Object.entries(dddStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([ddd, count]) => ({ ddd, count, porcentagem: ((count / validContacts.length) * 100).toFixed(1) }));

      // Amostra de contatos
      const sampleContacts = validContacts.slice(0, 10).map(contact => ({
        numero: contact.id.user,
        nome: contact.name || contact.pushname || 'Sem nome',
        verificado: contact.isWAContact ? 'Sim' : 'Não',
        telefone_formatado: formatPhoneNumber(contact.id.user)
      }));

      res.json({
        success: true,
        sessao: sessionName,
        analisado_em: new Date().toISOString(),
        estatisticas: {
          total_contatos: validContacts.length,
          total_grupos: contacts.filter(c => c.id && c.id.user && c.id.user.includes('@g.us')).length,
          status_verificacao: statusStats,
          nomes: nomeStats,
          top_ddds: topDDDs,
          amostra_contatos: sampleContacts
        }
      });

    } catch (error) {
      console.error('❌ Erro ao obter estatísticas dos contatos:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao obter estatísticas: ' + error.message
      });
    }
  });
  
  // Socket.IO
  io.on('connection', (socket) => {
    console.log('🌐 Cliente conectado à interface web');
    
    // Emitir status simples das sessões
    socket.emit('sessions_status', {
      sales: {
        status: sessions.sales.status || 'disconnected'
      },
      support: {
        status: sessions.support.status || 'disconnected'
      }
    });
    
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
          // Parar keep-alive primeiro
          stopKeepAlive(sessionName);
          
          await sessions[sessionName].client.close();
          sessions[sessionName] = {
            client: null,
            status: 'disconnected',
            qrCode: null,
            lastActivity: null,
            keepAliveInterval: null
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
  
  // Iniciar todos os sistemas de estabilidade e monitoramento
  console.log('🚀 Iniciando sistemas de estabilidade...');
  startSessionMonitoring();
  startResourceMonitoring();
  startHealthCheck();
  startAutoRecovery();
  scheduleIntelligentRestart();
  startAutomaticBackup();
  startCleanupSystem();
  
  // Iniciar limpeza periódica do sistema de campanhas
  setInterval(() => {
    campaignControl.cleanup();
  }, 10 * 60 * 1000); // A cada 10 minutos
  
  startWebInterface();
  setTimeout(() => {
    console.log('');
    console.log('🌐 Sistema pronto!');
    console.log('📱 Acesse: http://localhost:' + (process.env.PORT || 3005));
    console.log('🛒 Use a interface para conectar as sessões');
    console.log('💗 Sistema de keep-alive e monitoramento ativo');
    console.log('🕐 Configurado para funcionar 24h por dia');
    console.log('🔧 Auto-recuperação, backup e limpeza ativos');
    console.log('📊 Monitoramento de recursos e saúde ativos');
    console.log('⏰ Restart inteligente configurado');
    console.log('🛡️ Sistema preparado para NUNCA parar!');
    console.log('');
  }, 3000);
}

// Função para envio de campanha humanizada
async function sendHumanizedCampaign(client, numbers, message, sessionName, campaignData = {}) {
  const results = { sent: 0, failed: 0, errors: [] };
  
  console.log(`📢 Iniciando campanha humanizada ${sessionName} para ${numbers.length} números...`);
  
  // 🎭 NOVO: Inicializar gerador de variações de mensagens
  const variationGenerator = new MessageVariationGenerator();
  console.log('🎭 Gerando variações da mensagem para evitar detecção de spam...');
  
  // Gerar 5 variações da mensagem original
  const messageVariations = variationGenerator.generateVariations(message);
  console.log(`✅ ${messageVariations.length} variações criadas com sucesso`);
  
  // Log das variações para monitoramento
  messageVariations.forEach((variation, index) => {
    console.log(`📝 Variação ${index + 1}: ${variation.substring(0, 50)}...`);
  });
  
  // Inicializar tracking se necessário
  if (!campaignControl.tracker) {
    await campaignControl.init();
  }
  
  // Criar campanha no tracking se dados fornecidos
  let campaignId = null;
  if (campaignData.name && campaignControl.tracker) {
    try {
      campaignId = await campaignControl.tracker.createCampaign({
        name: campaignData.name || `Campanha ${sessionName} ${new Date().toLocaleString()}`,
        message: message,
        sessionName: sessionName,
        totalTargets: numbers.length
      });
      
      await campaignControl.tracker.startCampaign(campaignId);
      console.log(`📊 Campanha ${campaignId} criada no tracking`);
    } catch (error) {
      console.error('❌ Erro ao criar campanha no tracking:', error);
    }
  }
  
  for (let i = 0; i < numbers.length; i++) {
    try {
      const number = numbers[i];
      const formattedNumber = number.includes('@c.us') ? number : number + '@c.us';
      
      console.log(`📱 ${sessionName} - Enviando ${i + 1}/${numbers.length} para ${formattedNumber}...`);
      
      // 🔍 VERIFICAÇÃO PRINCIPAL: Verificar se número já está na tabela sent_numbers
      const cleanNumber = formattedNumber.replace('@c.us', '');
      let alreadySent = false;
      
      try {
        if (campaignControl.tracker) {
          // Verificar se número já foi enviado (qualquer campanha nas últimas 24h)
          alreadySent = await campaignControl.tracker.checkIfAlreadySent(null, cleanNumber, '24h');
          
          if (alreadySent) {
            console.log(`⚠️ ${sessionName} - Número ${cleanNumber} já está cadastrado na tabela sent_numbers - IGNORANDO`);
            results.failed++;
            results.errors.push({
              number: formattedNumber,
              error: 'Número já cadastrado na base de dados sent_numbers',
              reason: 'duplicate_in_database'
            });
            continue; // Pular para o próximo número
          }
        }
      } catch (verificationError) {
        console.error(`❌ Erro ao verificar duplicata para ${cleanNumber}:`, verificationError);
        // Continue mesmo com erro de verificação
      }
      
      // Verificar se pode enviar via tracking (cooldown local)
      if (campaignId) {
        const canSend = await campaignControl.canSendCampaign(sessionName, formattedNumber, campaignId);
        if (!canSend.canSend) {
          console.log(`🚫 ${sessionName} - Envio bloqueado para ${formattedNumber}: ${canSend.message}`);
          results.failed++;
          results.errors.push({
            number: formattedNumber,
            error: canSend.message,
            reason: canSend.reason
          });
          continue;
        }
      }
      
      // Verificar se o número é válido no WhatsApp antes de tentar operações de chat
      let isValidWhatsApp = false;
      try {
        // Tentar verificar se o número existe no WhatsApp
        const numberCheck = await client.checkNumberStatus(formattedNumber);
        isValidWhatsApp = numberCheck && numberCheck.canReceiveMessage;
        console.log(`🔍 ${sessionName} - Número ${formattedNumber} válido no WhatsApp: ${isValidWhatsApp}`);
      } catch (checkError) {
        console.log(`⚠️ ${sessionName} - Não foi possível verificar ${formattedNumber}, tentando envio direto...`);
        isValidWhatsApp = false;
      }

      // Se for um contato válido, fazer humanização completa
      if (isValidWhatsApp) {
        try {
          // Simular comportamento humano mais simples para campanha
          await client.sendSeen(formattedNumber);
          await sleep(Math.random() * 3000 + 2000); // 2-5 segundos
          
          await client.startTyping(formattedNumber);
          await sleep(Math.random() * 5000 + 3000); // 3-8 segundos digitando
          await client.stopTyping(formattedNumber);
        } catch (humanizeError) {
          console.log(`⚠️ ${sessionName} - Erro na humanização para ${formattedNumber}, enviando sem humanização...`);
        }
      } else {
        // Para números externos, apenas aguardar um tempo antes de enviar
        console.log(`📞 ${sessionName} - Número externo ${formattedNumber}, enviando sem humanização...`);
        await sleep(Math.random() * 2000 + 1000); // 1-3 segundos
      }
      
      // 🎭 USAR VARIAÇÃO DA MENSAGEM: Selecionar uma variação baseada no índice
      const variationIndex = i % messageVariations.length; // Ciclar pelas 5 variações
      const messageToSend = messageVariations[variationIndex];
      
      console.log(`🎭 ${sessionName} - Usando variação ${variationIndex + 1} para ${formattedNumber}`);
      
      // Enviar mensagem com variação (funciona para todos os tipos de número)
      const result = await client.sendText(formattedNumber, messageToSend);
      
      // Registrar envio no tracking - ÚNICO MÉTODO (incluindo variação usada)
      const finalCampaignId = campaignId || 1; // Usar campanha padrão se não especificada
      
      await campaignControl.markCampaignSent(formattedNumber, { 
        campaignId: finalCampaignId,
        session: sessionName,
        messageId: result.id || null,
        message_template: message, // Mensagem original
        message_sent: messageToSend, // Mensagem com variação enviada
        variation_used: variationIndex + 1, // Qual variação foi usada (1-5)
        sent_via: 'bulk_campaign_with_variations',
        status: 'enviado',
        timestamp: new Date().toISOString()
      });
      
      results.sent++;
      console.log(`✅ ${sessionName} - Enviado para ${formattedNumber}`);
      
      // Emitir progresso via Socket.IO (simplificado)
      if (global.io) {
        global.io.emit('campaign_progress', {
          session: sessionName,
          current: i + 1,
          total: numbers.length,
          sent: results.sent,
          failed: results.failed
        });
      }
      
      // Delay entre mensagens (exceto na última) - CORRIGIDO: usar delays do .env
      if (i < numbers.length - 1) {
        const minDelay = parseInt(process.env.MIN_DELAY) || 7000;   // 7s
        const maxDelay = parseInt(process.env.MAX_DELAY) || 15000;  // 15s
        const campaignDelay = Math.random() * (maxDelay - minDelay) + minDelay; // 7-15 segundos
        console.log(`⏳ Aguardando ${(campaignDelay/1000).toFixed(1)}s antes da próxima mensagem...`);
        await sleep(campaignDelay);
      }
      
    } catch (error) {
      results.failed++;
      const errorInfo = { number: numbers[i], error: error.message };
      results.errors.push(errorInfo);
      console.error(`❌ ${sessionName} - Erro para ${numbers[i]}:`, error.message);
      
      // Registrar erro no tracking se aplicável
      if (campaignId && campaignControl.tracker) {
        try {
          // CORRIGIDO: Usar markCampaignSent para consistência
          await campaignControl.markCampaignSent(numbers[i], {
            campaignId: campaignId,
            session: sessionName,
            status: 'falhou',
            error: error.message,
            timestamp: new Date().toISOString()
          });
        } catch (trackingError) {
          console.error('❌ Erro ao registrar falha no tracking:', trackingError);
        }
      }
    }
  }
  
  // Finalizar campanha no tracking
  if (campaignId && campaignControl.tracker) {
    try {
      await campaignControl.tracker.finishCampaign(campaignId);
      console.log(`✅ Campanha ${campaignId} finalizada no tracking`);
    } catch (error) {
      console.error('❌ Erro ao finalizar campanha no tracking:', error);
    }
  }
  
  console.log(`📊 Campanha humanizada ${sessionName} finalizada: ${results.sent} enviadas, ${results.failed} falhas`);
  
  return results;
}

// Funções auxiliares
function formatPhoneNumber(number) {
  // Remove caracteres especiais e deixa apenas números
  const cleaned = String(number).replace(/\D/g, '');
  
  // Formatar para exibição brasileira: +55 (11) 99999-9999
  if (cleaned.length >= 10) {
    let formatted = cleaned;
    
    // Se não tem código do país, assumir Brasil (55)
    if (!formatted.startsWith('55') && formatted.length <= 11) {
      formatted = '55' + formatted;
    }
    
    // Se tem 13 dígitos e começa com 55
    if (formatted.length === 13 && formatted.startsWith('55')) {
      const ddd = formatted.substring(2, 4);
      const nono = formatted.substring(4, 5);
      const prefix = formatted.substring(5, 9);
      const suffix = formatted.substring(9);
      return `+55 (${ddd}) ${nono}${prefix}-${suffix}`;
    }
    // Se tem 12 dígitos e começa com 55 (sem 9º dígito)
    else if (formatted.length === 12 && formatted.startsWith('55')) {
      const ddd = formatted.substring(2, 4);
      const prefix = formatted.substring(4, 8);
      const suffix = formatted.substring(8);
      return `+55 (${ddd}) ${prefix}-${suffix}`;
    }
    // Se tem 11 dígitos (celular brasileiro)
    else if (formatted.length === 11) {
      const ddd = formatted.substring(0, 2);
      const nono = formatted.substring(2, 3);
      const prefix = formatted.substring(3, 7);
      const suffix = formatted.substring(7);
      return `+55 (${ddd}) ${nono}${prefix}-${suffix}`;
    }
    // Se tem 10 dígitos (fixo brasileiro)
    else if (formatted.length === 10) {
      const ddd = formatted.substring(0, 2);
      const prefix = formatted.substring(2, 6);
      const suffix = formatted.substring(6);
      return `+55 (${ddd}) ${prefix}-${suffix}`;
    }
  }
  
  // Se não conseguiu formatar, retorna o número original
  return number;
}

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

// Inicializar variáveis globais
global.lastProcessedNumbers = [];
global.uploadedFiles = new Map();

// EXECUTAR
initializeSystem().catch(console.error);
