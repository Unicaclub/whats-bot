// Script para verificar estrutura do banco e encontrar números de campanhas
const { getCampaignTracker } = require('./modules/campaignTracker');

async function investigateDatabase() {
  try {
    console.log('🔍 INVESTIGANDO ESTRUTURA DO BANCO DE DADOS');
    console.log('==========================================');
    
    const tracker = getCampaignTracker();
    if (!tracker) {
      console.error('❌ Sistema de tracking não disponível');
      return;
    }
    
    const db = tracker.db;
    
    // 1. Listar todas as tabelas
    console.log('\n1. 📋 Listando todas as tabelas...');
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 Tabelas encontradas:');
    tables.forEach(table => {
      console.log(`   📄 ${table.table_name}`);
    });
    
    // 2. Verificar estrutura da tabela campaigns
    console.log('\n2. 🏗️ Estrutura da tabela campaigns...');
    const campaignColumns = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'campaigns'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Colunas da tabela campaigns:');
    campaignColumns.forEach(col => {
      console.log(`   📄 ${col.column_name} | ${col.data_type} | NULL: ${col.is_nullable}`);
    });
    
    // 3. Verificar metadados da campanha 13
    console.log('\n3. 📦 Verificando metadados da campanha 13...');
    const campaign13 = await db.query(`
      SELECT id, campaign_name, metadata, total_sent, total_failed
      FROM campaigns WHERE id = 13
    `);
    
    if (campaign13.length > 0) {
      const campaign = campaign13[0];
      console.log(`📋 Campanha: ${campaign.campaign_name}`);
      console.log(`📊 Total enviados: ${campaign.total_sent}`);
      console.log(`📊 Total falhas: ${campaign.total_failed}`);
      console.log(`📦 Tipo dos metadados: ${typeof campaign.metadata}`);
      
      if (campaign.metadata) {
        console.log(`📦 Metadados:`, JSON.stringify(campaign.metadata, null, 2));
        
        if (campaign.metadata.numbers) {
          console.log(`📱 Números nos metadados: ${campaign.metadata.numbers.length}`);
          console.log(`📱 Primeiros 5 números:`, campaign.metadata.numbers.slice(0, 5));
        }
        
        if (campaign.metadata.batchConfig) {
          console.log(`⚙️ Configuração de lotes:`, campaign.metadata.batchConfig);
        }
      }
    }
    
    // 4. Verificar tabela sent_numbers para campanha 13
    console.log('\n4. ✅ Verificando números enviados (sent_numbers)...');
    const sentStats = await db.query(`
      SELECT 
        COUNT(*) as total_sent,
        COUNT(DISTINCT phone_number) as unique_numbers,
        MIN(sent_at) as first_sent,
        MAX(sent_at) as last_sent,
        status
      FROM sent_numbers 
      WHERE campaign_id = 13
      GROUP BY status
      ORDER BY status
    `);
    
    console.log('📊 Estatísticas de números enviados:');
    sentStats.forEach(stat => {
      console.log(`   📊 Status ${stat.status}: ${stat.total_sent} registros (${stat.unique_numbers} únicos)`);
      console.log(`      📅 Primeiro: ${stat.first_sent}`);
      console.log(`      📅 Último: ${stat.last_sent}`);
    });
    
    // 5. Verificar últimos números enviados
    console.log('\n5. 📱 Últimos 10 números enviados da campanha 13...');
    const recentSent = await db.query(`
      SELECT phone_number, status, sent_at, sent_via
      FROM sent_numbers 
      WHERE campaign_id = 13
      ORDER BY sent_at DESC
      LIMIT 10
    `);
    
    console.log('📱 Últimos números enviados:');
    recentSent.forEach(sent => {
      console.log(`   📱 ${sent.phone_number} | ${sent.status} | ${sent.sent_at} | via: ${sent.sent_via}`);
    });
    
    // 6. Buscar outras possíveis fontes de números
    console.log('\n6. 🔍 Procurando outras fontes de números...');
    
    // Verificar se existe tabela phone_numbers
    try {
      const phoneNumbers = await db.query(`
        SELECT COUNT(*) as total FROM phone_numbers LIMIT 1
      `);
      console.log(`📱 Tabela phone_numbers encontrada: ${phoneNumbers[0].total} registros`);
    } catch (error) {
      console.log('📱 Tabela phone_numbers não encontrada');
    }
    
    // Verificar se existe tabela contacts
    try {
      const contacts = await db.query(`
        SELECT COUNT(*) as total FROM contacts LIMIT 1
      `);
      console.log(`👥 Tabela contacts encontrada: ${contacts[0].total} registros`);
    } catch (error) {
      console.log('👥 Tabela contacts não encontrada');
    }
    
    // 7. Verificar se a campanha pode ser "reconstruída"
    console.log('\n7. 🔧 ANÁLISE DE POSSIBILIDADE DE RECOVERY');
    console.log('==========================================');
    
    if (campaign13.length > 0) {
      const campaign = campaign13[0];
      
      console.log(`📊 Situação da campanha 13:`);
      console.log(`   📝 Nome: ${campaign.campaign_name}`);
      console.log(`   📊 Registros de envio: ${sentStats.length > 0 ? sentStats[0].total_sent : 0}`);
      console.log(`   📊 Total relatado: ${campaign.total_sent}`);
      
      if (campaign.metadata && campaign.metadata.numbers) {
        console.log(`\n✅ RECOVERY POSSÍVEL!`);
        console.log(`   📱 Números disponíveis nos metadados: ${campaign.metadata.numbers.length}`);
        console.log(`   ✅ Números já enviados: ${sentStats.length > 0 ? sentStats[0].unique_numbers : 0}`);
        console.log(`   ⏳ Estimativa de pendentes: ${campaign.metadata.numbers.length - (sentStats.length > 0 ? sentStats[0].unique_numbers : 0)}`);
        
        console.log(`\n🚀 Para fazer recovery:`);
        console.log(`   1. Reinicie a aplicação (node app.js)`);
        console.log(`   2. Conecte uma sessão do WhatsApp`);
        console.log(`   3. O sistema detectará automaticamente a campanha pausada`);
        console.log(`   4. Ou execute: node manual-recovery-with-metadata.js 13`);
      } else {
        console.log(`\n❌ RECOVERY DIFÍCIL`);
        console.log(`   ⚠️ Números não estão disponíveis nos metadados`);
        console.log(`   ⚠️ Tabela campaign_numbers não existe`);
        console.log(`   💡 Possíveis soluções:`);
        console.log(`      - Reimportar a lista original de números`);
        console.log(`      - Recriar a campanha com os números restantes`);
        console.log(`      - Verificar se há backup dos números originais`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro na investigação:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Executar investigação
investigateDatabase();
