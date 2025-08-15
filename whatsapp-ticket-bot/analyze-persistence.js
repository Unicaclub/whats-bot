// =====================================================
// TESTE DE ANÁLISE COMPLETA DO SISTEMA DE PERSISTÊNCIA
// =====================================================

require('dotenv').config();

async function analyzeFullPersistenceSystem() {
    console.log('🔍 ANÁLISE COMPLETA DO SISTEMA DE PERSISTÊNCIA\n');
    console.log('='*60);

    const issues = [];
    const successes = [];

    try {
        // =====================================================
        // 1. TESTE DE CONEXÃO COM BANCO
        // =====================================================
        console.log('1️⃣ Testando conexão com banco de dados...');
        
        try {
            const { getDatabase } = require('./database/manager');
            const db = getDatabase();
            await new Promise(resolve => setTimeout(resolve, 2000)); // Aguarda conexão
            
            const isConnected = await db.testConnection();
            if (isConnected) {
                successes.push('✅ Conexão com PostgreSQL estabelecida');
                console.log('   ✅ Conexão funcionando');
            } else {
                issues.push('❌ Falha na conexão com PostgreSQL');
                console.log('   ❌ Conexão falhou');
            }
        } catch (error) {
            issues.push(`❌ Erro na conexão: ${error.message}`);
            console.log(`   ❌ Erro: ${error.message}`);
        }

        // =====================================================
        // 2. TESTE DE IMPORTAÇÃO DOS COMPONENTES
        // =====================================================
        console.log('\n2️⃣ Testando importação dos componentes...');
        
        try {
            const CampaignStateManager = require('./database/campaign-state-manager');
            const CampaignRecoveryManager = require('./database/campaign-recovery-manager');
            const CampaignBatchProcessor = require('./modules/CampaignBatchProcessor');
            
            successes.push('✅ Todos os componentes importados com sucesso');
            console.log('   ✅ Componentes carregados');
            
            // Testar tipos
            if (typeof CampaignStateManager !== 'function') {
                issues.push('❌ CampaignStateManager não é uma função construtora');
                console.log('   ❌ CampaignStateManager: tipo incorreto');
            } else {
                successes.push('✅ CampaignStateManager é uma classe válida');
                console.log('   ✅ CampaignStateManager: OK');
            }
            
        } catch (error) {
            issues.push(`❌ Erro na importação: ${error.message}`);
            console.log(`   ❌ Erro na importação: ${error.message}`);
        }

        // =====================================================
        // 3. VERIFICAÇÃO DA ESTRUTURA DO BANCO
        // =====================================================
        console.log('\n3️⃣ Verificando estrutura do banco...');
        
        try {
            const { getDatabase } = require('./database/manager');
            const db = getDatabase();
            
            // Verificar tabelas necessárias
            const tables = await db.query(`
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('campaigns', 'sent_numbers', 'blacklist')
            `);
            
            const tableNames = tables.map(t => t.table_name);
            
            if (tableNames.includes('campaigns')) {
                successes.push('✅ Tabela campaigns encontrada');
                console.log('   ✅ Tabela campaigns: OK');
            } else {
                issues.push('❌ Tabela campaigns não encontrada');
                console.log('   ❌ Tabela campaigns: AUSENTE');
            }
            
            if (tableNames.includes('sent_numbers')) {
                successes.push('✅ Tabela sent_numbers encontrada');
                console.log('   ✅ Tabela sent_numbers: OK');
            } else {
                issues.push('❌ Tabela sent_numbers não encontrada');
                console.log('   ❌ Tabela sent_numbers: AUSENTE');
            }
            
        } catch (error) {
            issues.push(`❌ Erro na verificação do banco: ${error.message}`);
            console.log(`   ❌ Erro no banco: ${error.message}`);
        }

        // =====================================================
        // 4. VERIFICAÇÃO DA INTEGRAÇÃO NO APP.JS
        // =====================================================
        console.log('\n4️⃣ Verificando integração no app.js...');
        
        try {
            const fs = require('fs');
            const appContent = fs.readFileSync('./app.js', 'utf8');
            
            if (appContent.includes('CampaignStateManager')) {
                successes.push('✅ CampaignStateManager integrado no app.js');
                console.log('   ✅ StateManager integrado');
            } else {
                issues.push('❌ CampaignStateManager não integrado');
                console.log('   ❌ StateManager não integrado');
            }
            
            if (appContent.includes('CampaignRecoveryManager')) {
                successes.push('✅ CampaignRecoveryManager integrado no app.js');
                console.log('   ✅ RecoveryManager integrado');
            } else {
                issues.push('❌ CampaignRecoveryManager não integrado');
                console.log('   ❌ RecoveryManager não integrado');
            }
            
            if (appContent.includes('checkForInterruptedCampaigns')) {
                successes.push('✅ Recuperação automática configurada');
                console.log('   ✅ Recuperação automática: OK');
            } else {
                issues.push('❌ Recuperação automática não configurada');
                console.log('   ❌ Recuperação automática: AUSENTE');
            }
            
        } catch (error) {
            issues.push(`❌ Erro na verificação do app.js: ${error.message}`);
            console.log(`   ❌ Erro app.js: ${error.message}`);
        }

        // =====================================================
        // 5. VERIFICAÇÃO DAS CONFIGURAÇÕES
        // =====================================================
        console.log('\n5️⃣ Verificando configurações...');
        
        try {
            if (process.env.DB_NAME === 'whatsapp_campaigns') {
                successes.push('✅ Banco configurado para whatsapp_campaigns');
                console.log('   ✅ Nome do banco: correto');
            } else {
                issues.push(`❌ Banco configurado incorretamente: ${process.env.DB_NAME}`);
                console.log(`   ❌ Nome do banco: ${process.env.DB_NAME}`);
            }
            
            if (process.env.DB_USER === 'ticket') {
                successes.push('✅ Usuário de banco configurado');
                console.log('   ✅ Usuário do banco: correto');
            } else {
                issues.push(`❌ Usuário incorreto: ${process.env.DB_USER}`);
                console.log(`   ❌ Usuário: ${process.env.DB_USER}`);
            }
            
        } catch (error) {
            issues.push(`❌ Erro nas configurações: ${error.message}`);
            console.log(`   ❌ Erro config: ${error.message}`);
        }

        // =====================================================
        // RELATÓRIO FINAL
        // =====================================================
        console.log('\n' + '='*60);
        console.log('📊 RELATÓRIO FINAL DA ANÁLISE');
        console.log('='*60);
        
        console.log('\n✅ SUCESSOS:');
        successes.forEach(success => console.log(`   ${success}`));
        
        console.log('\n❌ PROBLEMAS ENCONTRADOS:');
        if (issues.length === 0) {
            console.log('   🎉 Nenhum problema encontrado!');
        } else {
            issues.forEach(issue => console.log(`   ${issue}`));
        }
        
        console.log('\n📈 ESTATÍSTICAS:');
        console.log(`   ✅ Sucessos: ${successes.length}`);
        console.log(`   ❌ Problemas: ${issues.length}`);
        console.log(`   📊 Taxa de sucesso: ${((successes.length / (successes.length + issues.length)) * 100).toFixed(1)}%`);
        
        if (issues.length === 0) {
            console.log('\n🎉 SISTEMA DE PERSISTÊNCIA TOTALMENTE FUNCIONAL!');
        } else if (issues.length <= 2) {
            console.log('\n⚠️ SISTEMA PARCIALMENTE FUNCIONAL - PEQUENAS CORREÇÕES NECESSÁRIAS');
        } else {
            console.log('\n❌ SISTEMA COM PROBLEMAS CRÍTICOS - CORREÇÕES URGENTES NECESSÁRIAS');
        }
        
    } catch (error) {
        console.error('\n💥 ERRO CRÍTICO NA ANÁLISE:', error);
    }
    
    console.log('\n' + '='*60);
}

// Executar análise
analyzeFullPersistenceSystem();
