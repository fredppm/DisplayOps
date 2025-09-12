// Global type declarations for the DisplayOps project

declare global {
  namespace NodeJS {
    interface Process {
      resourcesPath?: string;
    }
  }
}

export {};