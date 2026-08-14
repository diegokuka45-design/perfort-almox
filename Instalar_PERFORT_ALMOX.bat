@echo off
:: ====================================================
:: INSTALADOR DO PERFORT ALMOX - PERFORT ENGENHARIA
:: ====================================================
color 0A
title Instalador PERFORT ALMOX v5.1

echo.
echo ====================================================
echo   INSTALANDO PERFORT ALMOX - CONTROLE DE ESTOQUE
echo ====================================================
echo.
echo 1. Criando pasta do aplicativo em C:\PERFORT_ALMOX ...
if not exist "C:\PERFORT_ALMOX" mkdir "C:\PERFORT_ALMOX"

echo 2. Copiando arquivos do sistema ...
copy /Y "%~dp0PERFORT_ALMOX.html" "C:\PERFORT_ALMOX\PERFORT_ALMOX.html" >nul

echo 3. Criando atalho na Area de Trabalho ...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%USERPROFILE%\Desktop\PERFORT ALMOX.lnk'); $s.TargetPath = 'C:\PERFORT_ALMOX\PERFORT_ALMOX.html'; $s.Save()" >nul

echo 4. Criando atalho no Menu Iniciar ...
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs" (
    powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%APPDATA%\Microsoft\Windows\Start Menu\Programs\PERFORT ALMOX.lnk'); $s.TargetPath = 'C:\PERFORT_ALMOX\PERFORT_ALMOX.html'; $s.Save()" >nul
)

echo.
echo ====================================================
echo   INSTALACAO CONCLUIDA COM SUCESSO!
echo ====================================================
echo.
echo O aplicativo foi instalado em: C:\PERFORT_ALMOX
echo Um atalho foi adicionado a sua Area de Trabalho.
echo.
echo Abrindo o PERFORT ALMOX agora ...
start "" "C:\PERFORT_ALMOX\PERFORT_ALMOX.html"
timeout /t 3 >nul
exit
