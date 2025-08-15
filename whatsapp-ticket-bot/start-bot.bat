@echo off
echo ========================================
echo    WHATSAPP TICKET BOT - START
echo ========================================
echo.

echo Verificando PM2...
pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: PM2 nao encontrado!
    echo Execute setup-pm2.bat primeiro.
    pause
    exit /b 1
)

echo.
echo Parando instancia anterior (se existir)...
pm2 stop whatsapp-ticket-bot >nul 2>&1

echo.
echo Iniciando WhatsApp Ticket Bot...
pm2 start ecosystem.config.js

echo.
echo Salvando configuracao PM2...
pm2 save

echo.
echo ========================================
echo           BOT INICIADO!
echo ========================================
echo.
echo Status: pm2 status
echo Logs:   pm2 logs whatsapp-ticket-bot
echo Monitoramento: pm2 monit
echo.
echo Acesse: http://localhost:3005
echo.

echo Abrindo monitor PM2 em 3 segundos...
timeout /t 3 >nul
pm2 monit

pause
