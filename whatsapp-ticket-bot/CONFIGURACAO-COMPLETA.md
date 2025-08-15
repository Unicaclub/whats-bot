# 📋 CONFIGURAÇÃO E UTILIZAÇÃO DO SISTEMA
# Bot WhatsApp - Vendas de Ingressos

## 🔧 CONFIGURAÇÃO INICIAL

### 1. CONFIGURAÇÕES BÁSICAS (.env)

```env
# ================================================================
# CONFIGURAÇÕES DO BOT WHATSAPP VENDAS DE INGRESSOS
# ================================================================

# API da OpenAI - OBRIGATÓRIA para IA avançada
OPENAI_API_KEY=

# INFORMAÇÕES DA SUA CASA DE SHOW
BOT_NAME=Casa de Show XYZ
COMPANY_WEBSITE=https://seusite.com/ingressos
COMPANY_PHONE=5511999999999
COMPANY_ADDRESS=Rua da Música, 123 - Centro, São Paulo - SP

# CONFIGURAÇÕES DE COMPORTAMENTO
DEFAULT_DELAY=3000              # Delay entre mensagens (milissegundos)
MAX_MESSAGES_PER_MINUTE=20      # Limite de mensagens por minuto
AUTO_RESPONSE_DELAY=2000        # Tempo para simular digitação

# SERVIDOR WEB
PORT=3000                       # Porta da interface web
```

### 2. PERSONALIZAÇÕES DISPONÍVEIS

#### A) Informações da Empresa
- `BOT_NAME`: Nome da sua casa de show
- `COMPANY_WEBSITE`: Site para venda de ingressos
- `COMPANY_PHONE`: Número principal para contato
- `COMPANY_ADDRESS`: Endereço completo do local

#### B) Controle de Envio
- `DEFAULT_DELAY`: Intervalo entre mensagens (recomendado: 3000ms)
- `MAX_MESSAGES_PER_MINUTE`: Limite para evitar bloqueios
- `AUTO_RESPONSE_DELAY`: Tempo de "digitação" antes de responder

## 🚀 EXECUÇÃO DO SISTEMA

### Método 1: Execução Direta
```bash
cd whatsapp-ticket-bot
node app.js
```

### Método 2: Script Automatizado (Windows)
```bash
# Clique duas vezes em:
executar.bat
```

### Método 3: NPM Scripts
```bash
npm start      # Execução normal
npm run dev    # Com nodemon (reinicia automaticamente)
```

## 📱 CONFIGURAÇÃO DO WHATSAPP

### 1. Preparação
- ✅ Use WhatsApp Business (recomendado) ou pessoal
- ✅ Certifique-se de estar logado apenas em um dispositivo
- ✅ Tenha boa conexão com internet

### 2. Conexão
1. Execute o bot (`node app.js`)
2. Aguarde o QR Code aparecer no terminal
3. Abra WhatsApp no celular
4. Vá em: **Configurações > Dispositivos Conectados**
5. Toque em **"Conectar um dispositivo"**
6. Escaneie o QR Code
7. Aguarde: **"✅ Bot conectado com sucesso!"**

### 3. Verificação
- ✅ Status deve mostrar "connected" na interface web
- ✅ Envie mensagem de teste para o número conectado
- ✅ Bot deve responder automaticamente

## 🌐 INTERFACE WEB - GUIA COMPLETO

### Acesso
- **URL**: http://localhost:3000
- **Compatível com**: Chrome, Firefox, Safari, Edge
- **Responsivo**: Desktop e mobile

### 1. Dashboard Principal
- **Status da Conexão**: Verde = conectado, Vermelho = desconectado
- **Estatísticas**: Mensagens enviadas/recebidas, campanhas, tempo online
- **Atualização**: Automática a cada 30 segundos

### 2. Upload de Listas
#### Formatos Suportados:
```csv
# Arquivo CSV (recomendado)
numero,nome
5511999999999,João Silva
5511888888888,Maria Santos
5511777777777,Pedro Costa
```

```txt
# Arquivo TXT (simples)
5511999999999
5511888888888
5511777777777
```

#### Processo:
1. Clique em **"Escolher arquivo"**
2. Selecione arquivo CSV ou TXT
3. Clique em **"Processar Lista"**
4. Aguarde confirmação com número de contatos carregados

### 3. Campanhas Promocionais
#### Templates Disponíveis:
- **🎵 Novo Evento**: Anúncio de shows confirmados
- **🔥 Promoção**: Ofertas e descontos especiais
- **⏰ Lembrete**: Avisos de eventos próximos
- **💰 Vendas**: Últimos ingressos, urgência

#### Personalização de Mensagens:
```text
🎵 NOVO SHOW CONFIRMADO! 🎵

📅 Data: 15 de Dezembro de 2025
🎤 Artista: [NOME DO ARTISTA]
📍 Local: Casa de Show XYZ
💰 Ingressos a partir de R$ 50,00

🔥 PROMOÇÃO ESPECIAL:
📱 20% OFF até meia-noite!
💳 Parcelamento em até 10x sem juros

🎫 Garanta já o seu ingresso:
👉 https://seusite.com/ingressos

Não perca essa oportunidade!
#Show #Música #Ingressos #CasaDeShow
```

#### Variáveis Dinâmicas:
- `[NOME DO ARTISTA]`: Substitua pelo artista do evento
- `[DATA DO EVENTO]`: Substitua pela data específica
- `[PREÇO]`: Substitua pelo valor dos ingressos
- `[LOCAL]`: Substitua pelo nome da casa de show

### 4. Envio de Campanhas
1. **Selecione ou escreva** sua mensagem
2. **Confirme** que há números carregados
3. **Clique** em "Enviar Campanha"
4. **Confirme** no pop-up de confirmação
5. **Acompanhe** o progresso em tempo real
6. **Visualize** relatório final com sucessos/falhas

### 5. Logs do Sistema
- **Visualização**: Tempo real com timestamp
- **Filtragem**: Por data e tipo de evento
- **Download**: Logs salvos automaticamente em `/logs/`
- **Limpeza**: Botão para limpar visualização

## 🤖 SISTEMA DE IA - CONFIGURAÇÃO AVANÇADA

### 1. Funcionamento Automático
O bot classifica mensagens em categorias:
- **PRECO**: Perguntas sobre valores e custos
- **INTERESSE_COMPRA**: Demonstração de interesse em ingressos
- **DUVIDA_EVENTO**: Questões sobre datas, horários, artistas
- **LOCALIZACAO**: Perguntas sobre endereço e como chegar
- **GERAL**: Outras perguntas (processadas pela IA)

### 2. Respostas Personalizadas

#### Exemplo de Personalização:
Para modificar respostas, edite o arquivo `app.js`:

```javascript
case 'PRECO':
  response = {
    text: `💰 SEUS PREÇOS PERSONALIZADOS AQUI!
    
🎫 Pista: R$ 50,00
🎫 Camarote: R$ 120,00
🎫 VIP: R$ 200,00

🔥 OFERTA: 20% OFF até meia-noite!
👉 ${process.env.COMPANY_WEBSITE}`,
    link: process.env.COMPANY_WEBSITE
  };
  break;
```

### 3. Configuração da IA (OpenAI)
```javascript
// No arquivo app.js, localize:
const completion = await openai.chat.completions.create({
  model: "gpt-4",  // ou "gpt-3.5-turbo" para economia
  messages: [
    {
      role: "system",
      content: `PERSONALIZE AQUI: 
      Você é assistente da ${process.env.BOT_NAME}.
      Sempre direcione para ${process.env.COMPANY_WEBSITE}.
      Tom: amigável, use emojis, máximo 2 mensagens.`
    }
  ],
  max_tokens: 150,      // Limite de tokens por resposta
  temperature: 0.7      // Criatividade (0.0 = conservador, 1.0 = criativo)
});
```

## 📊 MONITORAMENTO E RELATÓRIOS

### 1. Métricas Disponíveis
- **Mensagens Recebidas**: Total de interações com clientes
- **Mensagens Enviadas**: Respostas automáticas + campanhas
- **Campanhas Enviadas**: Número total de campanhas realizadas
- **Tempo Online**: Uptime do sistema
- **Taxa de Sucesso**: Percentual de mensagens entregues

### 2. Logs Detalhados
- **Localização**: `/logs/bot-YYYY-MM-DD.log`
- **Conteúdo**: Timestamp, ação, detalhes, status
- **Rotação**: Arquivo novo a cada dia
- **Tamanho**: Sem limite (gerenciamento manual)

### 3. Análise de Performance
```bash
# Verificar logs do dia atual
tail -f logs/bot-2025-08-11.log

# Buscar por erros
grep "ERROR" logs/bot-*.log

# Contar mensagens enviadas
grep "Resposta enviada" logs/bot-*.log | wc -l
```

## 🔧 MANUTENÇÃO E ATUALIZAÇÕES

### 1. Backup Recomendado
```bash
# Criar backup completo
cp -r whatsapp-ticket-bot backup-$(date +%Y%m%d)

# Backup apenas configurações
cp .env .env.backup
cp -r logs logs-backup
```

### 2. Atualizações de Dependências
```bash
# Verificar versões desatualizadas
npm outdated

# Atualizar dependências
npm update

# Atualizar para versões específicas
npm install @wppconnect-team/wppconnect@latest
```

### 3. Limpeza Periódica
```bash
# Limpar logs antigos (mais de 30 dias)
find logs/ -name "*.log" -mtime +30 -delete

# Limpar uploads temporários
rm -rf uploads/*

# Limpar cache do npm
npm cache clean --force
```

## 🛡️ SEGURANÇA E BOAS PRÁTICAS

### 1. Proteção de Dados
- ✅ **Nunca** compartilhe o arquivo `.env`
- ✅ **Adicione** `.env` ao arquivo de ignorados do controle de versão
- ✅ **Use** senhas fortes para OpenAI
- ✅ **Monitore** uso da API para evitar custos

### 2. Limites de Envio
- ✅ **Respeite** o delay entre mensagens (min: 3 segundos)
- ✅ **Limite** mensagens por minuto (max: 20)
- ✅ **Evite** envios em horários de pico
- ✅ **Use** números válidos e com permissão

### 3. Conformidade Legal
- ✅ **Obtenha** consentimento antes de adicionar à lista
- ✅ **Ofereça** opção de descadastro
- ✅ **Respeite** LGPD e leis de privacidade
- ✅ **Mantenha** registros de consentimento

## 🚨 SOLUÇÃO DE PROBLEMAS

### 1. Bot Não Conecta
```bash
# Soluções:
1. Feche WhatsApp Web em outros navegadores
2. Deslogue de outros dispositivos
3. Reinicie o bot: Ctrl+C e node app.js
4. Verifique conexão com internet
5. Aguarde até 60 segundos para timeout
```

### 2. Mensagens Não Enviam
```bash
# Verificações:
1. Status de conexão na interface web
2. Formato dos números (5511999999999)
3. Delay configurado adequadamente
4. Limite de mensagens por minuto
5. Logs para erros específicos
```

### 3. IA Não Funciona
```bash
# Checklist:
1. Chave OpenAI válida e com créditos
2. Conexão com internet estável
3. Logs para erros de API
4. Fallback para respostas automáticas ativo
```

### 4. Interface Web Não Carrega
```bash
# Soluções:
1. Verificar se porta 3000 está livre
2. Alterar PORT no .env se necessário
3. Reiniciar o bot após mudanças
4. Verificar firewall/antivírus
5. Testar em navegador diferente
```

### 5. Upload de Lista Falha
```bash
# Formato correto:
CSV: numero,nome (com cabeçalho)
TXT: um número por linha
Encoding: UTF-8
Tamanho máximo: 10MB
```

## 📈 OTIMIZAÇÃO DE PERFORMANCE

### 1. Configurações Recomendadas

#### Para Volume Baixo (< 100 contatos):
```env
DEFAULT_DELAY=2000
MAX_MESSAGES_PER_MINUTE=25
AUTO_RESPONSE_DELAY=1000
```

#### Para Volume Médio (100-1000 contatos):
```env
DEFAULT_DELAY=3000
MAX_MESSAGES_PER_MINUTE=20
AUTO_RESPONSE_DELAY=2000
```

#### Para Volume Alto (> 1000 contatos):
```env
DEFAULT_DELAY=5000
MAX_MESSAGES_PER_MINUTE=15
AUTO_RESPONSE_DELAY=3000
```

### 2. Monitoramento de Recursos
```bash
# Verificar uso de memória
node --max-old-space-size=4096 app.js

# Monitor em tempo real
top -p $(pgrep node)

# Verificar logs de performance
grep "performance" logs/bot-*.log
```

## 📞 SUPORTE E CONTATO

### Documentação Adicional
- **README.md**: Visão geral do sistema
- **INICIO-RAPIDO.md**: Guia de 5 minutos
- **Este arquivo**: Configuração completa

### Arquivos de Exemplo
- **exemplo-numeros.csv**: Lista de teste
- **executar.bat**: Script de inicialização
- **instalar.bat**: Script de instalação

### Recursos Online
- **WPPConnect**: https://wppconnect.io/
- **OpenAI**: https://platform.openai.com/
- **Node.js**: https://nodejs.org/

---

**Sistema desenvolvido para vendas de ingressos com base no WPPConnect**  
**Versão: 1.0.0 | Data: Agosto 2025**
