# Custom NSIS Installer Script for DisplayOps Controller
# Adiciona página customizada para configuração da porta

!include MUI2.nsh
!include WinVer.nsh
!include x64.nsh
!include FileFunc.nsh

# Variáveis customizadas
Var ServerPort
Var NetworkAccess
Var AutoStart
Var ConfigDialog
Var PortField
Var NetworkCombo
Var AutoStartCheck

# Função para validar porta
Function ValidatePort
    ${NSD_GetText} $PortField $ServerPort
    IntCmp $ServerPort 1024 PortOK PortTooLow PortOK
    PortTooLow:
        MessageBox MB_ICONEXCLAMATION "Port must be 1024 or higher!"
        Abort
    PortOK:
        IntCmp $ServerPort 65535 PortOK2 PortOK2 PortTooHigh
    PortTooHigh:
        MessageBox MB_ICONEXCLAMATION "Port must be 65535 or lower!"
        Abort
    PortOK2:
FunctionEnd

# Página customizada para configurações
Function ConfigPageCreate
    nsDialogs::Create 1018
    Pop $ConfigDialog
    
    ${If} $ConfigDialog == error
        Abort
    ${EndIf}
    
    # Título da página
    ${NSD_CreateLabel} 0 0 100% 20u "Configure DisplayOps Controller"
    Pop $0
    CreateFont $1 "$(^Font)" 12 700
    SendMessage $0 ${WM_SETFONT} $1 0
    
    # Campo da porta
    ${NSD_CreateLabel} 0 35u 80u 15u "Server Port:"
    ${NSD_CreateNumber} 85u 33u 60u 15u "3000"
    Pop $PortField
    
    ${NSD_CreateLabel} 150u 35u 200u 15u "(1024-65535, default: 3000)"
    Pop $0
    
    # Acesso à rede
    ${NSD_CreateLabel} 0 65u 80u 15u "Network Access:"
    ${NSD_CreateDropList} 85u 63u 200u 60u ""
    Pop $NetworkCombo
    ${NSD_CB_AddString} $NetworkCombo "Allow network access (recommended)"
    ${NSD_CB_AddString} $NetworkCombo "Local access only"
    ${NSD_CB_SelectString} $NetworkCombo "Allow network access (recommended)"
    
    # Auto-start
    ${NSD_CreateCheckbox} 0 95u 250u 15u "Start with Windows"
    Pop $AutoStartCheck
    ${NSD_Check} $AutoStartCheck
    
    # Descrições
    ${NSD_CreateLabel} 0 120u 100% 30u "Network access allows other devices on your network to connect to the web interface using your computer's IP address."
    Pop $0
    
    ${NSD_CreateLabel} 0 155u 100% 20u "These settings can be changed later in the application."
    Pop $0
    
    nsDialogs::Show
FunctionEnd

Function ConfigPageLeave
    # Validar porta
    Call ValidatePort
    
    # Obter valores
    ${NSD_GetText} $PortField $ServerPort
    ${NSD_GetState} $NetworkCombo $NetworkAccess
    ${NSD_GetState} $AutoStartCheck $AutoStart
    
    # Salvar no registry
    WriteRegStr HKCU "Software\DisplayOps Controller" "ServerPort" $ServerPort
    WriteRegDWORD HKCU "Software\DisplayOps Controller" "NetworkAccess" $NetworkAccess
    WriteRegDWORD HKCU "Software\DisplayOps Controller" "AutoStart" $AutoStart
    WriteRegDWORD HKCU "Software\DisplayOps Controller" "Configured" 1
FunctionEnd

# Página para mostrar informações finais
Function InfoPageCreate
    nsDialogs::Create 1018
    Pop $0
    
    ${NSD_CreateLabel} 0 0 100% 20u "Installation Complete!"
    Pop $1
    CreateFont $2 "$(^Font)" 12 700
    SendMessage $1 ${WM_SETFONT} $2 0
    
    ${NSD_CreateLabel} 0 30u 100% 60u "DisplayOps Controller has been installed successfully.$\r$\n$\r$\nServer Port: $ServerPort$\r$\nNetwork Access: ${If} $NetworkAccess == 0 Enabled ${Else} Local only ${EndIf}$\r$\nAuto-start: ${If} $AutoStart == 1 Enabled ${Else} Disabled ${EndIf}$\r$\n$\r$\nYou can access the web interface at:$\r$\nhttp://localhost:$ServerPort"
    
    nsDialogs::Show
FunctionEnd

# Adicionar páginas ao instalador
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY

# Nossa página customizada
Page custom ConfigPageCreate ConfigPageLeave

!insertmacro MUI_PAGE_INSTFILES

# Página de informações finais
Page custom InfoPageCreate

!insertmacro MUI_PAGE_FINISH

# Função após instalação
Function .onInstSuccess
    # Criar arquivo de configuração
    FileOpen $0 "$INSTDIR\config.json" w
    FileWrite $0 '{"serverPort":$ServerPort,"hostname":"${If} $NetworkAccess == 0 0.0.0.0 ${Else} 127.0.0.1 ${EndIf}","autoStart":${If} $AutoStart == 1 true ${Else} false ${EndIf},"firstRun":false}'
    FileClose $0
    
    # Configurar auto-start se selecionado
    ${If} $AutoStart == 1
        WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "DisplayOps Controller" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    ${EndIf}
FunctionEnd