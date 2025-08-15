# 🚀 GUIA DE INÍCIO RÁPIDO

## ✅ PASSO A PASSO - 5 MINUTOS

### 1. 📋 CONFIGURAÇÃO INICIAL
Edite o arquivo `.env` com suas informações:
```env
OPENAI_API_KEY=sua_chave_openai_aqui  # (opcional)
BOT_NAME=Sua Casa de Show
COMPANY_WEBSITE=https://seusite.com/ingressos
```

### 2. 🚀 EXECUTAR O BOT
```bash
npm start
```
OU clique duas vezes em: `executar.bat`

### 3. 📱 CONECTAR WHATSAPP
1. Aparecerá um QR Code no terminal
2. Abra WhatsApp no celular
3. Vá em "Dispositivos Conectados"
4. Escaneie o QR Code
5. Aguarde "✅ Bot conectado com sucesso!"

### 4. 🌐 ACESSAR INTERFACE
Abra no navegador: http://localhost:3000

### 5. 📤 TESTE COM LISTA EXEMPLO
1. Na interface web, vá em "Upload de Lista"
2. Selecione o arquivo `exemplo-numeros.csv`
3. Clique em "Processar Lista"
4. Vá em "Campanhas Promocionais"
5. Clique em "Enviar Campanha"

## 🎯 RECURSOS PRONTOS

### ✅ JÁ FUNCIONA:
- ✅ Atendimento automático inteligente
- ✅ Respostas sobre preços, eventos, localização
- ✅ Interface web completa
- ✅ Upload de listas CSV/TXT
- ✅ Campanhas em massa
- ✅ Templates pré-definidos
- ✅ Logs em tempo real
- ✅ Estatísticas completas

### 📱 TESTE O ATENDIMENTO:
Envie uma mensagem para o WhatsApp conectado:
- "Quanto custa o ingresso?"
- "Quando é o próximo show?"
- "Onde fica a casa de show?"
- "Quero comprar ingresso"

### 📢 TESTE CAMPANHA EM MASSA:
Use o arquivo `exemplo-numeros.csv` incluído para testar.

## 🛠️ PERSONALIZAÇÃO RÁPIDA

### Alterar mensagens automáticas:
Edite no arquivo `app.js` as seções:
- `case 'PRECO':` - Mensagens sobre preços
- `case 'INTERESSE_COMPRA':` - Respostas de interesse
- `case 'LOCALIZACAO':` - Informações de local

### Adicionar novos templates:
Na interface web, edite os templates ou crie novos.

## 📞 SUPORTE RÁPIDO

### ❌ Problemas comuns:
1. **QR Code não aparece**: Reinicie o bot
2. **Mensagens não enviam**: Verifique conexão WhatsApp
3. **Interface não abre**: Teste http://localhost:3001
4. **Upload falha**: Use formato CSV correto

### 📋 Formato correto CSV:
```csv
numero,nome
5511999999999,Cliente 1
5511888888888,Cliente 2
```

### 📋 Formato correto TXT:
```txt
5511999999999
5511888888888
5511777777777
```

## 🎫 ESTÁ PRONTO!

Seu bot está operacional e pode:
- ✅ Atender clientes automaticamente
- ✅ Enviar campanhas para milhares de números
- ✅ Gerenciar tudo pela interface web
- ✅ Gerar relatórios e estatísticas

**Sistema completo em produção! 🚀**
