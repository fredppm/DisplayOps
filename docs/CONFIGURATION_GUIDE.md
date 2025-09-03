# Guia de Configurações e Dependências - Sistema Atual

## Visão Geral
Este documento descreve todas as configurações, dependências e requisitos do sistema DisplayOps atual.

## Requisitos do Sistema

### Requisitos Mínimos

#### Web Controller
- **Node.js**: 18.0.0 ou superior
- **NPM**: 8.0.0 ou superior
- **RAM**: 2GB mínimo, 4GB recomendado
- **Disco**: 1GB de espaço livre
- **Rede**: Conexão de rede local

#### Host Agent
- **OS**: Windows 10/11, macOS 10.15+, Ubuntu 20.04+
- **Node.js**: 18.0.0 ou superior
- **RAM**: 4GB mínimo, 8GB recomendado
- **Disco**: 2GB de espaço livre
- **Rede**: Conexão de rede local
- **Display**: 2 displays conectados (recomendado)

#### Browser Extension
- **Chrome**: 90.0.0 ou superior
- **Firefox**: 88.0.0 ou superior (suporte experimental)
- **RAM**: 100MB adicional

### Requisitos de Rede

#### Portas Necessárias
| Serviço | Porta | Protocolo | Descrição |
|---------|-------|-----------|-----------|
| Web Controller | 3000 | TCP | Interface web |
| Host Agent gRPC | 8082 | TCP | Comunicação gRPC |
| Host Agent HTTP | 8080 | TCP | API para extensão |
| mDNS Discovery | 5353 | UDP | Descoberta automática |

#### Configuração de Firewall
```bash
# Ubuntu/Debian
sudo ufw allow 3000/tcp  # Web Controller
sudo ufw allow 8082/tcp  # Host Agent gRPC
sudo ufw allow 8080/tcp  # Host Agent HTTP
sudo ufw allow 5353/udp  # mDNS Discovery

# Windows
netsh advfirewall firewall add rule name="DisplayOps Web Controller" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="DisplayOps Host Agent gRPC" dir=in action=allow protocol=TCP localport=8082
netsh advfirewall firewall add rule name="DisplayOps Host Agent HTTP" dir=in action=allow protocol=TCP localport=8080
netsh advfirewall firewall add rule name="DisplayOps mDNS" dir=in action=allow protocol=UDP localport=5353
```

## Dependências

### Web Controller Dependências

#### Dependências Principais
```json
{
  "@grpc/grpc-js": "^1.10.1",
  "@grpc/proto-loader": "^0.7.10",
  "@types/bonjour": "^3.5.13",
  "archiver": "^6.0.1",
  "axios": "^1.6.2",
  "bonjour": "^3.5.0",
  "clsx": "^2.0.0",
  "date-fns": "^2.30.0",
  "lucide-react": "^0.294.0",
  "next": "^14.0.4",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "tailwindcss": "^3.3.6"
}
```

#### Dependências de Desenvolvimento
```json
{
  "@testing-library/jest-dom": "^6.1.5",
  "@testing-library/react": "^14.1.2",
  "@testing-library/user-event": "^14.5.1",
  "@types/archiver": "^6.0.2",
  "node-mocks-http": "^1.13.0",
  "@types/jest": "^29.5.8",
  "@types/node": "^20.10.5",
  "@types/react": "^18.2.45",
  "@types/react-dom": "^18.2.18",
  "@typescript-eslint/eslint-plugin": "^6.15.0",
  "@typescript-eslint/parser": "^6.15.0",
  "autoprefixer": "^10.4.16",
  "eslint": "^8.56.0",
  "eslint-config-next": "^14.0.4",
  "jest": "^29.7.0",
  "jest-environment-jsdom": "^29.7.0",
  "postcss": "^8.4.32",
  "typescript": "^5.3.3"
}
```

### Host Agent Dependências

#### Dependências Principais
```json
{
  "@grpc/grpc-js": "^1.10.1",
  "@grpc/proto-loader": "^0.7.10",
  "@types/bonjour": "^3.5.13",
  "bonjour": "^3.5.0",
  "electron-updater": "^6.1.7"
}
```

#### Dependências de Desenvolvimento
```json
{
  "@types/node": "^20.10.5",
  "@typescript-eslint/eslint-plugin": "^6.15.0",
  "@typescript-eslint/parser": "^6.15.0",
  "concurrently": "^8.2.2",
  "copyfiles": "^2.4.1",
  "electron": "^28.1.0",
  "electron-builder": "^24.9.1",
  "electron-reloader": "^1.2.3",
  "eslint": "^8.56.0",
  "typescript": "^5.3.3",
  "wait-on": "^7.2.0"
}
```

## Configurações

### Web Controller Configuração

#### next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  env: {
    CUSTOM_KEY: 'my-value',
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

#### tailwind.config.js
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
        },
      },
    },
  },
  plugins: [],
}
```

#### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Host Agent Configuração

#### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### electron-builder.json
```json
{
  "appId": "com.displayops.host-agent",
  "productName": "DisplayOps Host Agent",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "node_modules/**/*"
  ],
  "win": {
    "target": "nsis",
    "icon": "assets/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

## Arquivos de Configuração

### Web Controller Data Files

#### dashboards.json
```json
{
  "dashboards": [
    {
      "id": "dashboard-001",
      "name": "Marketing Dashboard",
      "description": "Dashboard para equipe de marketing",
      "urls": [
        "https://analytics.google.com",
        "https://facebook.com/insights"
      ],
      "rotationInterval": 30000,
      "assignedHosts": ["host-001", "host-002"],
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "lastUpdated": "2024-01-01T10:00:00Z",
  "version": "1.0.0"
}
```

#### cookies.json
```json
{
  "cookies": [
    {
      "id": "cookie-001",
      "name": "session",
      "domain": ".example.com",
      "value": "abc123",
      "assignedHosts": ["host-001"],
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "lastSync": "2024-01-01T10:00:00Z"
}
```

### Host Agent Data Files

#### config.json
```json
{
  "hostId": "host-001",
  "name": "Display-001",
  "displays": 2,
  "autoStart": true,
  "logLevel": "info",
  "mdnsService": "_displayops._tcp.local",
  "mdnsPort": 5353,
  "grpcPort": 8082,
  "httpPort": 8080,
  "webAdminUrl": "http://localhost:3000",
  "updateCheckInterval": 3600000,
  "healthCheckInterval": 30000
}
```

#### display-state.json
```json
{
  "displays": [
    {
      "id": "display-1",
      "status": "active",
      "currentUrl": "https://example.com",
      "lastUpdate": "2024-01-01T10:00:00Z",
      "error": null
    },
    {
      "id": "display-2",
      "status": "idle",
      "currentUrl": null,
      "lastUpdate": "2024-01-01T10:00:00Z",
      "error": null
    }
  ],
  "lastUpdated": "2024-01-01T10:00:00Z"
}
```

## Variáveis de Ambiente

### Web Controller (.env.local)
```bash
# Configuração do servidor
PORT=3000
NODE_ENV=development

# Configuração de logs
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Configuração de mDNS
MDNS_SERVICE=_displayops._tcp.local
MDNS_PORT=5353

# Configuração de gRPC
GRPC_TIMEOUT=5000
GRPC_MAX_RETRIES=3

# Configuração de segurança
CORS_ORIGIN=*
```

### Host Agent (.env)
```bash
# Configuração do host
HOST_ID=host-001
HOST_NAME=Display-001
DISPLAYS_COUNT=2

# Configuração de rede
GRPC_PORT=8082
HTTP_PORT=8080
MDNS_SERVICE=_displayops._tcp.local
MDNS_PORT=5353

# Configuração de logs
LOG_LEVEL=info
LOG_FILE=logs/host-agent.log

# Configuração de atualizações
UPDATE_CHECK_INTERVAL=3600000
AUTO_UPDATE=true

# Configuração de web admin
WEB_ADMIN_URL=http://localhost:3000
```

## Scripts de Instalação

### Instalação Completa
```bash
#!/bin/bash
# install.sh

echo "Instalando DisplayOps Management System..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js não encontrado. Instalando..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Verificar NPM
if ! command -v npm &> /dev/null; then
    echo "NPM não encontrado. Instalando..."
    sudo apt-get install -y npm
fi

# Instalar dependências do Web Controller
echo "Instalando Web Controller..."
cd web-controller
npm install
npm run build

# Instalar dependências do Host Agent
echo "Instalando Host Agent..."
cd ../host-agent
npm install
npm run build

# Configurar firewall
echo "Configurando firewall..."
sudo ufw allow 3000/tcp
sudo ufw allow 8082/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 5353/udp

echo "Instalação concluída!"
```

### Instalação do Host Agent
```bash
#!/bin/bash
# install-host-agent.sh

echo "Instalando Host Agent..."

# Verificar se é Windows
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    echo "Sistema Windows detectado..."
    
    # Instalar Node.js se necessário
    if ! command -v node &> /dev/null; then
        echo "Baixando Node.js..."
        curl -o nodejs.msi https://nodejs.org/dist/v18.19.0/node-v18.19.0-x64.msi
        msiexec /i nodejs.msi /quiet
    fi
    
    # Instalar dependências
    npm install
    npm run build
    
    # Criar atalho no desktop
    echo "Criando atalho..."
    powershell "$s=(New-Object -COM WScript.Shell).CreateShortcut('%userprofile%\Desktop\DisplayOps Host Agent.lnk');$s.TargetPath='$(pwd)\node_modules\.bin\electron';$s.Arguments='.';$s.Save()"
    
else
    echo "Sistema Unix detectado..."
    
    # Instalar dependências
    npm install
    npm run build
    
    # Criar serviço systemd
    echo "Criando serviço systemd..."
    sudo tee /etc/systemd/system/displayops-host-agent.service > /dev/null <<EOF
[Unit]
Description=DisplayOps Host Agent
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/node_modules/.bin/electron .
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl enable displayops-host-agent
    sudo systemctl start displayops-host-agent
fi

echo "Host Agent instalado com sucesso!"
```

## Configuração de Rede

### Configuração mDNS
```bash
# Ubuntu/Debian
sudo apt-get install avahi-daemon
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon

# macOS (já vem instalado)
# Windows (instalar Bonjour)
```

### Configuração de Rede Local
```bash
# Configurar IP estático (opcional)
sudo tee /etc/netplan/01-netcfg.yaml > /dev/null <<EOF
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      dhcp4: no
      addresses:
        - 192.168.1.100/24
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
EOF

sudo netplan apply
```

## Monitoramento e Logs

### Configuração de Logs
```bash
# Criar diretórios de log
mkdir -p web-controller/logs
mkdir -p host-agent/logs

# Configurar rotação de logs
sudo tee /etc/logrotate.d/displayops > /dev/null <<EOF
/path/to/web-controller/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 root root
}

/path/to/host-agent/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF
```

### Script de Monitoramento
```bash
#!/bin/bash
# monitor.sh

while true; do
    # Verificar Web Controller
    if ! curl -s http://localhost:3000/api/health > /dev/null; then
        echo "$(date): Web Controller down, restarting..."
        cd web-controller && npm start &
    fi
    
    # Verificar Host Agent
    if ! curl -s http://localhost:8080/api/health > /dev/null; then
        echo "$(date): Host Agent down, restarting..."
        cd host-agent && npm start &
    fi
    
    sleep 30
done
```

## Troubleshooting de Instalação

### Problemas Comuns

#### Node.js não encontrado
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node@18

# Windows
# Baixar do site oficial: https://nodejs.org/
```

#### Permissões de rede
```bash
# Verificar se as portas estão abertas
sudo netstat -tlnp | grep -E "(3000|8080|8082)"

# Verificar firewall
sudo ufw status
```

#### Dependências não instaladas
```bash
# Limpar cache do npm
npm cache clean --force

# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

### Verificação de Instalação
```bash
# Verificar se tudo está funcionando
curl http://localhost:3000/api/health
curl http://localhost:8080/api/health

# Verificar logs
tail -f web-controller/logs/app.log
tail -f host-agent/logs/host-agent.log
```
