# Script para corrigir mensagens duplicadas
$filePath = "c:\Users\User\Desktop\Wppbot\whats-bot\whatsapp-ticket-bot\app.js"
$content = Get-Content $filePath

# Substituir as linhas problemáticas (índices 467-474 correspondem às linhas 468-475)
$content[467] = "        // CORREÇÃO: Removido resposta automática para evitar mensagens duplicadas"
$content[468] = "        await handleSalesMessage(client, message);"
$content[469] = "        // Removido: setTimeout e segunda mensagem automática"
$content[470] = "        // Removido: await client.sendText segunda linha"
$content[471] = "        // Removido: }, 1000);"
$content[472] = "        // } else {"
$content[473] = "        // await handleSalesMessage(client, message);"
$content[474] = "        // }"

# Também corrigir a segunda ocorrência na função de suporte
$supportLineIndex = ($content | Select-String -Pattern "if \(message\.body === 'Hello'\)" | Select-Object -Skip 1 -First 1).LineNumber - 1
if ($supportLineIndex -ge 0) {
    $content[$supportLineIndex] = "        // CORREÇÃO: Removido resposta automática para evitar mensagens duplicadas"
    $content[$supportLineIndex + 1] = "        await handleSupportMessage(client, message);"
    $content[$supportLineIndex + 2] = "        // Removido: resposta automática de suporte"
    $content[$supportLineIndex + 3] = "        // Removido: .then((result) => console.log('✅ SUPORTE - Resposta enviada:', result.id))"
    $content[$supportLineIndex + 4] = "        // Removido: .catch((erro) => console.error('❌ SUPORTE - Erro ao enviar:', erro));"
    $content[$supportLineIndex + 5] = "        // } else {"
    $content[$supportLineIndex + 6] = "        // await handleSupportMessage(client, message);"
    $content[$supportLineIndex + 7] = "        // }"
}

Set-Content $filePath $content
Write-Host "✅ Correção aplicada! Mensagens automáticas removidas para evitar duplicatas."
