import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { EventEmitter } from 'events';
import { createContextLogger } from '@/utils/logger';

const grpcClientLogger = createContextLogger('grpc-host-client');

// Load protobuf definition
const PROTO_PATH = join(process.cwd(), '..', 'shared', 'proto', 'host-agent.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const displayops = protoDescriptor.displayops;

export interface GrpcHostClientConfig {
  host: string;
  port: number;
  timeout?: number;
}

export class GrpcHostClient extends EventEmitter {
  private client: any;
  private config: GrpcHostClientConfig;
  private isConnected: boolean = false;

  constructor(config: GrpcHostClientConfig) {
    super();
    this.config = config;
    this.setupClient();
  }

  private setupClient(): void {
    const address = `${this.config.host}:${this.config.port}`;
    this.client = new displayops.HostAgent(
      address,
      grpc.credentials.createInsecure()
    );
  }

  public async executeCommand(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = this.config.timeout || 10000;
      
      this.client.ExecuteCommand(request, { 
        deadline: Date.now() + timeout 
      }, (error: any, response: any) => {
        if (error) {
          reject(new Error(`gRPC command failed: ${error.message}`));
          return;
        }
        resolve(response);
      });
    });
  }

  public async healthCheck(): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = this.config.timeout || 5000;
      
      this.client.HealthCheck({}, { 
        deadline: Date.now() + timeout 
      }, (error: any, response: any) => {
        if (error) {
          reject(new Error(`gRPC health check failed: ${error.message}`));
          return;
        }
        resolve(response);
      });
    });
  }

  public async streamEvents(): Promise<any> {
    return new Promise((resolve, reject) => {
      const stream = this.client.StreamEvents({});
      
      stream.on('data', (event: any) => {
        this.emit('event', event);
      });
      
      stream.on('error', (error: any) => {
        this.emit('error', error);
        reject(error);
      });
      
      stream.on('end', () => {
        this.emit('end');
        resolve(stream);
      });
    });
  }

  public destroy(): void {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }
}


