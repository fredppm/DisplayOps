# Arquitetura de Segurança - Sistema Multi-Site

## Visão Geral
Este documento detalha a implementação de segurança para o sistema DisplayOps multi-site, incluindo autenticação, autorização, comunicação segura e auditoria.

## 1. Autenticação e Autorização

### 1.1 Web-Admin Authentication
```typescript
// Estrutura de usuário
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'site-manager' | 'viewer';
  sites: string[]; // Sites que o usuário pode gerenciar
  permissions: Permission[];
  createdAt: Date;
  lastLogin: Date;
}

// Permissões granulares
interface Permission {
  resource: 'sites' | 'controllers' | 'dashboards' | 'users';
  action: 'create' | 'read' | 'update' | 'delete';
  scope: 'all' | 'site' | 'controller';
  target?: string; // ID específico se scope não for 'all'
}
```

### 1.2 Implementação com NextAuth.js
```typescript
// pages/api/auth/[...nextauth].ts
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifyPassword, generateJWT } from '@/lib/auth';

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Verificar credenciais contra banco de dados
        const user = await verifyCredentials(credentials);
        if (user) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            sites: user.sites,
            permissions: user.permissions
          };
        }
        return null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.sites = user.sites;
        token.permissions = user.permissions;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role;
      session.user.sites = token.sites;
      session.user.permissions = token.permissions;
      return session;
    }
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 horas
  },
  jwt: {
    secret: process.env.JWT_SECRET,
  }
});
```

### 1.3 Middleware de Proteção
```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const { token } = req.nextauth;
    
    // Verificar permissões baseadas na rota
    if (pathname.startsWith('/admin') && token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
    
    if (pathname.startsWith('/sites') && !hasPermission(token, 'sites', 'read')) {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    },
  }
);

export const config = {
  matcher: ['/admin/:path*', '/sites/:path*', '/controllers/:path*']
};
```

## 2. Comunicação Segura entre Componentes

### 2.1 Autenticação Mutual TLS (mTLS)

#### Certificados Auto-Gerados
```typescript
// lib/certificates.ts
import { generateKeyPairSync, createCertificate } from 'crypto';
import { writeFileSync, readFileSync } from 'fs';

export class CertificateManager {
  private static instance: CertificateManager;
  private caKey: Buffer;
  private caCert: Buffer;
  
  private constructor() {
    this.generateCA();
  }
  
  static getInstance(): CertificateManager {
    if (!CertificateManager.instance) {
      CertificateManager.instance = new CertificateManager();
    }
    return CertificateManager.instance;
  }
  
  private generateCA() {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    
    this.caKey = Buffer.from(privateKey);
    this.caCert = Buffer.from(publicKey);
  }
  
  generateControllerCert(controllerId: string) {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    
    const cert = createCertificate();
    cert.setPublicKey(publicKey);
    cert.setPrivateKey(this.caKey);
    cert.setSubject([
      { shortName: 'CN', value: controllerId },
      { shortName: 'O', value: 'DisplayOps' },
      { shortName: 'OU', value: 'Controller' }
    ]);
    cert.setIssuer([
      { shortName: 'CN', value: 'DisplayOps CA' },
      { shortName: 'O', value: 'DisplayOps' },
      { shortName: 'OU', value: 'Certificate Authority' }
    ]);
    cert.sign(this.caKey, 'sha256');
    
    return {
      cert: cert.getPEM(),
      key: privateKey,
      ca: this.caCert.toString()
    };
  }
}
```

#### Implementação no Controller
```typescript
// controller-component/src/services/secure-communication.ts
import * as https from 'https';
import * as fs from 'fs';
import { CertificateManager } from './certificate-manager';

export class SecureCommunicationService {
  private certManager: CertificateManager;
  private client: https.Agent;
  
  constructor(private controllerId: string, private webAdminUrl: string) {
    this.certManager = CertificateManager.getInstance();
    this.setupSecureClient();
  }
  
  private setupSecureClient() {
    const certs = this.certManager.generateControllerCert(this.controllerId);
    
    this.client = new https.Agent({
      key: certs.key,
      cert: certs.cert,
      ca: certs.ca,
      rejectUnauthorized: true
    });
  }
  
  async sendToWebAdmin(endpoint: string, data: any): Promise<any> {
    const url = `${this.webAdminUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Controller-ID': this.controllerId
      },
      body: JSON.stringify(data),
      agent: this.client
    });
    
    if (!response.ok) {
      throw new Error(`Web-Admin communication failed: ${response.status}`);
    }
    
    return response.json();
  }
}
```

### 2.2 Heartbeat Seguro com Assinatura Digital

```typescript
// controller-component/src/services/heartbeat-service.ts
import { createHmac, randomBytes } from 'crypto';

export class SecureHeartbeatService {
  private secretKey: string;
  private heartbeatInterval: NodeJS.Timeout;
  
  constructor(private adminUrl: string, secretKey: string) {
    this.secretKey = secretKey;
  }
  
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.sendSecureHeartbeat();
    }, 30000); // 30 segundos
  }
  
  private async sendSecureHeartbeat() {
    const timestamp = Date.now();
    const nonce = randomBytes(16).toString('hex');
    const payload = {
      controllerId: this.controllerId,
      timestamp,
      nonce,
      status: 'online',
      metrics: await this.getMetrics()
    };
    
    const signature = this.generateSignature(payload);
    
    try {
      const response = await fetch(`${this.adminUrl}/api/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          'X-Timestamp': timestamp.toString(),
          'X-Nonce': nonce
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Heartbeat failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Heartbeat error:', error);
      // Implementar retry com backoff exponencial
    }
  }
  
  private generateSignature(payload: any): string {
    const data = JSON.stringify(payload);
    return createHmac('sha256', this.secretKey)
      .update(data)
      .digest('hex');
  }
}
```

### 2.3 Criptografia de Dados Sensíveis

```typescript
// lib/encryption.ts
import { createCipher, createDecipher, randomBytes } from 'crypto';

export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;
  
  constructor(secretKey: string) {
    this.key = Buffer.from(secretKey, 'hex');
  }
  
  encrypt(data: string): { encrypted: string; iv: string; tag: string } {
    const iv = randomBytes(16);
    const cipher = createCipher(this.algorithm, this.key);
    cipher.setAAD(Buffer.from('DisplayOps', 'utf8'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex')
    };
  }
  
  decrypt(encrypted: string, iv: string, tag: string): string {
    const decipher = createDecipher(this.algorithm, this.key);
    decipher.setAAD(Buffer.from('DisplayOps', 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Uso para cookies sensíveis
export class SecureCookieService {
  private encryption: EncryptionService;
  
  constructor() {
    this.encryption = new EncryptionService(process.env.COOKIE_ENCRYPTION_KEY!);
  }
  
  encryptCookies(cookies: any[]): string {
    const cookieData = JSON.stringify(cookies);
    const encrypted = this.encryption.encrypt(cookieData);
    return JSON.stringify(encrypted);
  }
  
  decryptCookies(encryptedData: string): any[] {
    const encrypted = JSON.parse(encryptedData);
    const decrypted = this.encryption.decrypt(
      encrypted.encrypted,
      encrypted.iv,
      encrypted.tag
    );
    return JSON.parse(decrypted);
  }
}
```

## 3. Validação e Sanitização

### 3.1 Validação de Schemas com Zod

```typescript
// lib/validation.ts
import { z } from 'zod';

export const SiteSchema = z.object({
  id: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  location: z.string().min(1).max(100),
  timezone: z.string().min(1),
  controllers: z.array(z.string()).min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const ControllerSchema = z.object({
  id: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  siteId: z.string().min(1),
  name: z.string().min(1).max(100),
  dns: z.string().url(),
  localNetwork: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/),
  mdnsService: z.string().min(1),
  status: z.enum(['online', 'offline', 'error']),
  lastSync: z.string().datetime(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/)
});

export const DashboardSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  url: z.string().url(),
  description: z.string().max(500),
  refreshInterval: z.number().min(30).max(3600),
  requiresAuth: z.boolean(),
  category: z.string().min(1).max(50)
});
```

### 3.2 Sanitização de Dados

```typescript
// lib/sanitization.ts
import DOMPurify from 'isomorphic-dompurify';

export class SanitizationService {
  static sanitizeString(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    }).trim();
  }
  
  static sanitizeUrl(url: string): string {
    const sanitized = this.sanitizeString(url);
    try {
      const parsed = new URL(sanitized);
      // Permitir apenas HTTPS
      if (parsed.protocol !== 'https:') {
        throw new Error('Only HTTPS URLs are allowed');
      }
      return parsed.toString();
    } catch {
      throw new Error('Invalid URL format');
    }
  }
  
  static sanitizeObject<T>(obj: T, schema: any): T {
    const sanitized = { ...obj };
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      }
    }
    return schema.parse(sanitized);
  }
}
```

## 4. Rate Limiting e Proteção

### 4.1 Rate Limiting por IP e Usuário

```typescript
// lib/rate-limiting.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { LRUCache } from 'lru-cache';

interface RateLimitConfig {
  uniqueTokenPerInterval: number;
  interval: number;
}

export class RateLimiter {
  private tokenCache: LRUCache<string, number[]>;
  
  constructor(options: RateLimitConfig) {
    this.tokenCache = new LRUCache({
      max: options.uniqueTokenPerInterval,
      ttl: options.interval
    });
  }
  
  async check(req: NextApiRequest, res: NextApiResponse, limit: number): Promise<boolean> {
    const identifier = this.getIdentifier(req);
    const tokenCount = this.tokenCache.get(identifier) || [];
    const now = Date.now();
    
    // Remover tokens antigos
    const validTokens = tokenCount.filter(timestamp => now - timestamp < this.tokenCache.ttl);
    
    if (validTokens.length >= limit) {
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', new Date(now + this.tokenCache.ttl).toISOString());
      return false;
    }
    
    validTokens.push(now);
    this.tokenCache.set(identifier, validTokens);
    
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', limit - validTokens.length);
    res.setHeader('X-RateLimit-Reset', new Date(now + this.tokenCache.ttl).toISOString());
    
    return true;
  }
  
  private getIdentifier(req: NextApiRequest): string {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userId = req.headers['x-user-id'] || 'anonymous';
    return `${ip}-${userId}`;
  }
}

// Uso no middleware
const rateLimiter = new RateLimiter({
  uniqueTokenPerInterval: 500,
  interval: 60000 // 1 minuto
});

export async function rateLimitMiddleware(req: NextApiRequest, res: NextApiResponse) {
  const allowed = await rateLimiter.check(req, res, 100); // 100 requests por minuto
  if (!allowed) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return false;
  }
  return true;
}
```

### 4.2 Proteção contra Ataques Comuns

```typescript
// lib/security-middleware.ts
import { NextApiRequest, NextApiResponse } from 'next';
import helmet from 'helmet';

export function securityMiddleware(req: NextApiRequest, res: NextApiResponse) {
  // Helmet para headers de segurança
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.vtex.com"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  })(req, res);
  
  // Headers adicionais
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Verificar Content-Type para POST/PUT
  if (['POST', 'PUT', 'PATCH'].includes(req.method!)) {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      res.status(400).json({ error: 'Invalid content type' });
      return false;
    }
  }
  
  return true;
}
```

## 5. Auditoria e Logs

### 5.1 Sistema de Auditoria

```typescript
// lib/audit.ts
interface AuditEvent {
  id: string;
  timestamp: Date;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: any;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
}

export class AuditService {
  private static instance: AuditService;
  
  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }
  
  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const auditEvent: AuditEvent = {
      ...event,
      id: this.generateId(),
      timestamp: new Date()
    };
    
    // Salvar em arquivo de log estruturado
    await this.writeToLog(auditEvent);
    
    // Enviar para sistema de monitoramento se configurado
    if (process.env.AUDIT_WEBHOOK_URL) {
      await this.sendToWebhook(auditEvent);
    }
  }
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async writeToLog(event: AuditEvent): Promise<void> {
    const logEntry = JSON.stringify({
      timestamp: event.timestamp.toISOString(),
      level: 'AUDIT',
      event: event
    });
    
    // Implementar rotação de logs
    await fs.promises.appendFile(
      `/var/log/displayops/audit-${new Date().toISOString().split('T')[0]}.log`,
      logEntry + '\n'
    );
  }
}
```

### 5.2 Logs Estruturados

```typescript
// lib/logger.ts
import winston from 'winston';

export class Logger {
  private logger: winston.Logger;
  
  constructor(component: string) {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { component },
      transports: [
        new winston.transports.File({ 
          filename: `/var/log/displayops/${component}-error.log`, 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: `/var/log/displayops/${component}-combined.log` 
        })
      ]
    });
    
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.simple()
      }));
    }
  }
  
  info(message: string, meta?: any) {
    this.logger.info(message, meta);
  }
  
  error(message: string, error?: Error, meta?: any) {
    this.logger.error(message, { error: error?.stack, ...meta });
  }
  
  warn(message: string, meta?: any) {
    this.logger.warn(message, meta);
  }
  
  debug(message: string, meta?: any) {
    this.logger.debug(message, meta);
  }
}
```

## 6. Configuração de Segurança

### 6.1 Variáveis de Ambiente

```bash
# .env.example
# Autenticação
JWT_SECRET=your-super-secret-jwt-key-here
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=https://admin.displayops.com

# Criptografia
COOKIE_ENCRYPTION_KEY=your-32-byte-encryption-key-here
CERTIFICATE_SECRET=your-certificate-secret-here

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# Auditoria
AUDIT_WEBHOOK_URL=https://audit.webhook.com
LOG_LEVEL=info

# Segurança
ALLOWED_ORIGINS=https://admin.displayops.com,https://controller.displayops.com
CORS_ORIGIN=https://admin.displayops.com
```

### 6.2 Checklist de Segurança

- [ ] **Autenticação**: NextAuth.js implementado com JWT
- [ ] **Autorização**: Sistema de roles e permissões granulares
- [ ] **mTLS**: Certificados auto-gerados para comunicação segura
- [ ] **Criptografia**: Dados sensíveis criptografados em trânsito e armazenamento
- [ ] **Rate Limiting**: Proteção contra ataques de força bruta
- [ ] **Validação**: Schemas Zod para validação de entrada
- [ ] **Sanitização**: Limpeza de dados de entrada
- [ ] **Headers**: Headers de segurança configurados
- [ ] **Auditoria**: Logs de todas as ações importantes
- [ ] **Monitoramento**: Alertas para atividades suspeitas
- [ ] **Backup**: Backup seguro de configurações
- [ ] **Updates**: Sistema de atualização automática
- [ ] **Certificados**: Renovação automática de certificados
- [ ] **Segredos**: Gerenciamento seguro de segredos
- [ ] **Testes**: Testes de segurança automatizados

## 7. Monitoramento de Segurança

### 7.1 Alertas de Segurança

```typescript
// lib/security-monitoring.ts
export class SecurityMonitoringService {
  private alertThresholds = {
    failedLogins: 5, // Alertar após 5 tentativas falhadas
    suspiciousIPs: 10, // Alertar após 10 requests de IP suspeito
    rateLimitExceeded: 3 // Alertar após 3 violações de rate limit
  };
  
  async checkFailedLogin(userId: string, ip: string): Promise<void> {
    const failedAttempts = await this.getFailedLoginAttempts(userId, ip);
    
    if (failedAttempts >= this.alertThresholds.failedLogins) {
      await this.sendSecurityAlert({
        type: 'FAILED_LOGIN_ATTEMPTS',
        userId,
        ip,
        attempts: failedAttempts,
        severity: 'HIGH'
      });
    }
  }
  
  async checkSuspiciousActivity(req: NextApiRequest): Promise<void> {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // Verificar padrões suspeitos
    if (this.isSuspiciousUserAgent(userAgent)) {
      await this.sendSecurityAlert({
        type: 'SUSPICIOUS_USER_AGENT',
        ip,
        userAgent,
        severity: 'MEDIUM'
      });
    }
  }
  
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /scraper/i,
      /curl/i,
      /wget/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }
}
```

Esta arquitetura de segurança fornece uma base sólida para proteger o sistema multi-site, garantindo autenticação robusta, comunicação segura e monitoramento contínuo.
