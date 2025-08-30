import { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import fs from 'fs';
import os from 'os';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { browser = 'chrome', autoActivate = true } = req.body;

    // Get extension path
    const extensionPath = path.join(process.cwd(), '../office-display-extension');
    
    if (!fs.existsSync(extensionPath)) {
      return res.status(404).json({
        success: false,
        error: 'Extension not found'
      });
    }

    // Detect user's browser profile directory
    const profilePath = getBrowserProfilePath(browser);
    
    if (!profilePath) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported browser or browser not found',
        message: 'Navegador não suportado ou não encontrado',
        fallback: {
          action: 'manual_install',
          instructions: getManualInstallInstructions(browser)
        }
      });
    }

    // For security and Chrome policies, we'll provide instructions rather than
    // directly installing the extension (which requires admin privileges)
    const installInstructions = generateInstallInstructions(browser, extensionPath);

    res.status(200).json({
      success: true,
      method: 'guided_install',
      message: 'Instruções de instalação geradas',
      data: {
        browser,
        extensionPath: extensionPath,
        profilePath,
        instructions: installInstructions,
        autoScript: generateInstallScript(browser, extensionPath),
        nextSteps: [
          'Baixar extensão automaticamente',
          'Seguir instruções no navegador',
          'Extensão será ativada automaticamente'
        ]
      }
    });

  } catch (error) {
    console.error('Extension install error:', error);
    res.status(500).json({
      success: false,
      error: 'Installation failed',
      message: 'Falha na instalação automática',
      fallback: {
        action: 'manual_download',
        downloadUrl: '/api/extension/download'
      }
    });
  }
}

function getBrowserProfilePath(browser: string): string | null {
  const platform = os.platform();
  const homeDir = os.homedir();

  switch (browser.toLowerCase()) {
    case 'chrome':
      if (platform === 'win32') {
        return path.join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default');
      } else if (platform === 'darwin') {
        return path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'Default');
      } else {
        return path.join(homeDir, '.config', 'google-chrome', 'Default');
      }
      
    case 'edge':
      if (platform === 'win32') {
        return path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default');
      } else if (platform === 'darwin') {
        return path.join(homeDir, 'Library', 'Application Support', 'Microsoft Edge', 'Default');
      } else {
        return path.join(homeDir, '.config', 'microsoft-edge', 'Default');
      }
      
    default:
      return null;
  }
}

function generateInstallInstructions(browser: string, extensionPath: string) {
  const browserName = browser.charAt(0).toUpperCase() + browser.slice(1);
  
  return {
    title: `Instalação Automática - ${browserName}`,
    steps: [
      {
        step: 1,
        action: 'download',
        title: 'Download Automático',
        description: 'A extensão será baixada automaticamente',
        automated: true
      },
      {
        step: 2,
        action: 'navigate',
        title: 'Abrir Extensões',
        description: `Navegue para ${browser}://extensions/`,
        url: `${browser}://extensions/`,
        automated: false
      },
      {
        step: 3,
        action: 'enable_dev_mode',
        title: 'Modo Desenvolvedor',
        description: 'Ative o "Modo do desenvolvedor" no canto superior direito',
        automated: false
      },
      {
        step: 4,
        action: 'load_extension',
        title: 'Carregar Extensão',
        description: 'Clique em "Carregar sem compactação" e selecione a pasta extraída',
        automated: false
      },
      {
        step: 5,
        action: 'verify',
        title: 'Verificar Instalação',
        description: 'A extensão "Office Display Credentials Sync" deve aparecer ativa',
        automated: false
      }
    ],
    tips: [
      'O download iniciará automaticamente quando você clicar em "Instalar"',
      'Mantenha esta aba aberta para acompanhar o progresso',
      'A extensão se conectará automaticamente ao Office Display'
    ]
  };
}

function generateInstallScript(browser: string, extensionPath: string): string {
  // Generate JavaScript code that can be executed to help with installation
  return `
// Office Display Extension Auto-Install Helper
(function() {
  console.log('🔧 Office Display Extension Auto-Install');
  
  // Download extension automatically
  const downloadUrl = '/api/extension/download';
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = 'office-display-extension.zip';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  console.log('📦 Extension download started...');
  
  // Show installation guide
  setTimeout(() => {
    const shouldOpen = confirm(
      '📦 Download da extensão iniciado!\\n\\n' +
      'Deseja abrir a página de extensões do navegador agora?'
    );
    
    if (shouldOpen) {
      window.open('${browser}://extensions/', '_blank');
    }
  }, 1000);
  
  return {
    status: 'download_started',
    nextStep: 'extract_and_load',
    extensionsUrl: '${browser}://extensions/'
  };
})();
`;
}

function getManualInstallInstructions(browser: string) {
  return [
    'Baixe a extensão usando o botão de download',
    'Extraia o arquivo ZIP em uma pasta',
    `Abra ${browser}://extensions/ no navegador`,
    'Ative o "Modo do desenvolvedor"',
    'Clique em "Carregar sem compactação"',
    'Selecione a pasta extraída da extensão'
  ];
}