const CampaignBatchProcessor = require('./modules/CampaignBatchProcessor');

// Mock do sistema de campaignControl (similar ao real)
const mockCampaignControl = {
    sentCampaigns: new Map(),
    cooldownPeriod: 24 * 60 * 60 * 1000, // 24 horas
    
    isInCooldown(phoneNumber) {
        const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
        const sentTime = this.sentCampaigns.get(cleanNumber);
        if (!sentTime) return false;
        
        const timeSince = Date.now() - sentTime;
        return timeSince < this.cooldownPeriod;
    },
    
    async markCampaignSent(phoneNumber, data) {
        const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
        this.sentCampaigns.set(cleanNumber, Date.now());
        console.log(`📊 [TRACKING] Número ${cleanNumber} marcado como enviado`);
    }
};

// Mock do tracker (similar ao real)
const mockTracker = {
    async checkIfAlreadySent(campaignId, phoneNumber, period) {
        // Simular que alguns números já foram enviados
        const testDuplicates = ['5511999999999', '5511888888888'];
        return testDuplicates.includes(phoneNumber);
    },
    
    async markCampaignSent(phoneNumber, data) {
        console.log(`💾 [DATABASE] Salvando no banco: ${phoneNumber} - Campanha: ${data.campaignId}`);
    }
};

// Mock do cliente WhatsApp
const mockClient = {
    async sendText(number, message) {
        // Simular falhas ocasionais para testar error handling
        if (Math.random() < 0.05) { // 5% de falha
            throw new Error('Erro simulado de envio');
        }
        
        console.log(`📱 [WHATSAPP] Enviando para ${number}: "${message.substring(0, 50)}..."`);
        return { success: true };
    }
};

async function testRealSending() {
    console.log('🧪 TESTE: Validando Envio Real do Batch Processor');
    console.log('=' * 60);
    
    try {
        // Criar batch processor com sistemas integrados
        const processor = new CampaignBatchProcessor(10, mockCampaignControl, mockTracker);
        
        // Números de teste (alguns duplicados intencionalmente)
        const testNumbers = [
            '5511999999999', // Será marcado como duplicata
            '5511123456789',
            '5511987654321',
            '5511888888888', // Será marcado como duplicata
            '5511111111111',
            '5511222222222',
            '5511333333333',
            '5511444444444',
            '5511555555555',
            '5511666666666'
        ];
        
        const testMessage = 'Olá! Esta é uma mensagem de teste do sistema de batch processing integrado.';
        
        console.log(`📊 Testando com ${testNumbers.length} números`);
        console.log(`📝 Mensagem: "${testMessage}"`);
        console.log('');
        
        // Executar o teste
        const result = await processor.processLargeCampaignArray(
            testNumbers,
            testMessage,
            'test',
            mockClient
        );
        
        console.log('\n🎯 RESULTADOS DO TESTE:');
        console.log('=' * 40);
        console.log(`📱 Total de números: ${result.totalNumbers}`);
        console.log(`✅ Enviados com sucesso: ${result.successCount}`);
        console.log(`❌ Falhas: ${result.failedCount}`);
        console.log(`🔄 Duplicatas ignoradas: ${result.duplicateCount}`);
        console.log(`⏱️ Tempo total: ${Math.round(result.duration / 1000)}s`);
        console.log(`📈 Taxa de sucesso: ${((result.successCount / result.totalNumbers) * 100).toFixed(1)}%`);
        
        // Validar resultados
        console.log('\n✅ VALIDAÇÃO:');
        if (result.duplicateCount >= 2) {
            console.log('✅ Sistema de duplicatas funcionando');
        } else {
            console.log('❌ Sistema de duplicatas pode ter problemas');
        }
        
        if (result.successCount > 0) {
            console.log('✅ Envios reais funcionando');
        } else {
            console.log('❌ Nenhum envio realizado - verificar sistema');
        }
        
        if (result.totalNumbers === testNumbers.length) {
            console.log('✅ Todos os números processados');
        } else {
            console.log('❌ Nem todos os números foram processados');
        }
        
    } catch (error) {
        console.error('❌ ERRO NO TESTE:', error);
    }
}

// Executar o teste
testRealSending();
