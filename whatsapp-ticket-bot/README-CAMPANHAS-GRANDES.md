# 🚀 GUIA PARA CAMPANHAS GRANDES (16k+ números)

## 🎯 **PROBLEMA RESOLVIDO**

Para campanhas com mais de 5.000 números, use o sistema de **processamento em lotes** que criamos.

## 📋 **INSTRUÇÕES PASSO A PASSO**

### **1. 🔍 Validar o Arquivo Primeiro**
```bash
node validate-campaign-file.js ./seu-arquivo.txt
```

### **2. 🚀 Processar em Lotes**
```bash
node process-large-campaign.js ./seu-arquivo.txt 500
```

### **3. ⚙️ Configuração Personalizada**

Edite o arquivo `process-large-campaign.js` na seção `CAMPAIGN_CONFIG`:

```javascript
const CAMPAIGN_CONFIG = {
    filePath: './contatos_whatsapp_sales_1755045498907.txt', // Seu arquivo
    message: `🎵 ROYAL – A NOITE É SUA, O REINADO É NOSSO 🎵

🎭 Prepare-se para uma noite LENDÁRIA!
MC DANIEL – O FALCÃO vai comandar o palco com os hits que tão explodindo em todo o Brasil.

Se é luxo e exclusividade que você procura... Aqui é o seu lugar!`,
    sessionName: 'sales',
    batchSize: 500 // Números por lote
};
```

## 📊 **RECOMENDAÇÕES POR TAMANHO**

| Quantidade | Tamanho do Lote | Tempo Estimado |
|------------|----------------|----------------|
| 1k - 5k    | 500           | 10-25 min     |
| 5k - 10k   | 300           | 30-50 min     |
| 10k - 20k  | 200           | 1-2 horas      |
| 20k+       | 100           | 2+ horas       |

## 🔧 **VANTAGENS DO SISTEMA DE LOTES**

✅ **Estabilidade:** Não sobrecarrega o servidor
✅ **Rastreamento:** Acompanha progresso em tempo real  
✅ **Recuperação:** Continua se um lote falhar
✅ **Duplicatas:** Verifica duplicatas automaticamente
✅ **Logs:** Relatório completo de envios

## 📈 **EXEMPLO DE EXECUÇÃO**

```bash
🔄 Iniciando processamento em lotes...
📊 Total de números: 16290
📦 Tamanho do lote: 500
🔢 Total de lotes: 33

🔄 Processando lote 1/33 (500 números)...
✅ Lote 1 enviado com sucesso
⏳ Aguardando 5 segundos antes do próximo lote...

🔄 Processando lote 2/33 (500 números)...
✅ Lote 2 enviado com sucesso
⏳ Aguardando 5 segundos antes do próximo lote...

...

📊 RELATÓRIO FINAL:
✅ Números processados com sucesso: 16228
❌ Números com erro: 62
📈 Taxa de sucesso: 99.62%
```

## 🎯 **SOLUÇÃO PARA SEU CASO ESPECÍFICO**

Para seus **16.290 números**, execute:

```bash
# 1. Validar arquivo
node validate-campaign-file.js ./contatos_whatsapp_sales_1755045498907.txt

# 2. Processar em lotes de 300 (recomendado para esse volume)
node process-large-campaign.js ./contatos_whatsapp_sales_1755045498907.txt 300
```

## ⚡ **EXECUÇÃO AGORA**

Quer que eu execute para você agora? Basta confirmar e rodarei o script automaticamente!
