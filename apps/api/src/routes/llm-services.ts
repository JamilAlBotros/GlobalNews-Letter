import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { promisify } from "util";
import { exec } from "child_process";
import process from "process";

const execAsync = promisify(exec);

// Zod schemas for validation
const ServiceControlSchema = z.object({
  action: z.enum(['start', 'stop', 'restart']),
  service: z.enum(['nllb', 'ollama', 'both'])
});

// Service process tracking
interface ServiceProcess {
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error';
  startTime?: Date;
  lastError?: string;
}

const serviceProcesses: {
  nllb: ServiceProcess;
  ollama: ServiceProcess;
} = {
  nllb: { status: 'stopped' },
  ollama: { status: 'stopped' }
};

// Helper functions
async function checkServiceHealth(service: 'nllb' | 'ollama'): Promise<{
  healthy: boolean;
  responseTime?: number;
  error?: string;
}> {
  try {
    const port = service === 'nllb' ? 8000 : 8001;
    const url = service === 'nllb'
      ? `http://172.17.0.1:${port}/health`
      : `http://172.17.0.1:${port}/api/tags`;

    const start = Date.now();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(1000)
    });

    const responseTime = Date.now() - start;

    if (response.ok) {
      return { healthy: true, responseTime };
    } else {
      return { healthy: false, error: `HTTP ${response.status}` };
    }
  } catch (error: any) {
    return { healthy: false, error: error.message };
  }
}

async function startNLLBService(): Promise<void> {
  try {
    serviceProcesses.nllb.status = 'starting';
    serviceProcesses.nllb.startTime = new Date();

    console.log('Starting NLLB service via host API...');

    // Call the host LLM management API
    const response = await fetch('http://172.17.0.1:7999/services/nllb/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(60000) // 60 second timeout
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || `Failed to start NLLB service: ${response.statusText}`);
    }

    serviceProcesses.nllb.status = 'running';
    console.log('NLLB service started successfully:', result.message);
  } catch (error: any) {
    serviceProcesses.nllb.status = 'error';
    serviceProcesses.nllb.lastError = error.message;
    throw error;
  }
}

async function stopNLLBService(): Promise<void> {
  try {
    serviceProcesses.nllb.status = 'stopping';

    console.log('Stopping NLLB service via host API...');

    // Call the host LLM management API
    const response = await fetch('http://172.17.0.1:7999/services/nllb/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || `Failed to stop NLLB service: ${response.statusText}`);
    }

    serviceProcesses.nllb.status = 'stopped';
    serviceProcesses.nllb.lastError = undefined;
    console.log('NLLB service stopped successfully:', result.message);
  } catch (error: any) {
    serviceProcesses.nllb.status = 'error';
    serviceProcesses.nllb.lastError = error.message;
    throw error;
  }
}

async function startOllamaService(): Promise<void> {
  try {
    serviceProcesses.ollama.status = 'starting';
    serviceProcesses.ollama.startTime = new Date();

    console.log('Starting Ollama service via host API...');

    // Call the host LLM management API
    const response = await fetch('http://172.17.0.1:7999/services/ollama/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(60000) // 60 second timeout
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || `Failed to start Ollama service: ${response.statusText}`);
    }

    serviceProcesses.ollama.status = 'running';
    console.log('Ollama service started successfully:', result.message);
  } catch (error: any) {
    serviceProcesses.ollama.status = 'error';
    serviceProcesses.ollama.lastError = error.message;
    throw error;
  }
}

async function stopOllamaService(): Promise<void> {
  try {
    serviceProcesses.ollama.status = 'stopping';

    console.log('Stopping Ollama service via host API...');

    // Call the host LLM management API
    const response = await fetch('http://172.17.0.1:7999/services/ollama/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || `Failed to stop Ollama service: ${response.statusText}`);
    }

    serviceProcesses.ollama.status = 'stopped';
    serviceProcesses.ollama.lastError = undefined;
    console.log('Ollama service stopped successfully:', result.message);
  } catch (error: any) {
    serviceProcesses.ollama.status = 'error';
    serviceProcesses.ollama.lastError = error.message;
    throw error;
  }
}

// Initialize service status on startup
async function initializeServiceStatus() {
  try {
    const nllbHealth = await checkServiceHealth('nllb');
    serviceProcesses.nllb.status = nllbHealth.healthy ? 'running' : 'stopped';

    const ollamaHealth = await checkServiceHealth('ollama');
    serviceProcesses.ollama.status = ollamaHealth.healthy ? 'running' : 'stopped';
  } catch (error) {
    console.log('Error initializing service status:', error);
  }
}

export async function llmServicesRoutes(fastify: FastifyInstance) {
  // Initialize service status in background with a delay to avoid blocking plugin startup
  setTimeout(() => {
    initializeServiceStatus().catch(console.error);
  }, 1000);

  // Get service status
  fastify.get('/llm-services/status', async (request, reply) => {
    try {
      const [nllbHealth, ollamaHealth] = await Promise.all([
        checkServiceHealth('nllb'),
        checkServiceHealth('ollama')
      ]);

      const nllbRunning = serviceProcesses.nllb.status === 'running';
      const ollamaRunning = serviceProcesses.ollama.status === 'running';

      return {
        services: {
          nllb: {
            status: serviceProcesses.nllb.status,
            healthy: nllbHealth.healthy,
            responseTime: nllbHealth.responseTime,
            startTime: serviceProcesses.nllb.startTime?.toISOString(),
            lastError: serviceProcesses.nllb.lastError,
            endpoint: 'http://localhost:8000',
            capabilities: ['translation', 'multilingual']
          },
          ollama: {
            status: serviceProcesses.ollama.status,
            healthy: ollamaHealth.healthy,
            responseTime: ollamaHealth.responseTime,
            startTime: serviceProcesses.ollama.startTime?.toISOString(),
            lastError: serviceProcesses.ollama.lastError,
            endpoint: 'http://localhost:8001',
            capabilities: ['summarization', 'text-generation']
          }
        },
        overall: {
          anyRunning: nllbRunning || ollamaRunning,
          allHealthy: nllbHealth.healthy && ollamaHealth.healthy,
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime()
        }
      };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Control services
  fastify.post('/llm-services/control', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { action, service } = ServiceControlSchema.parse(request.body);

      const operations = [];

      if (service === 'nllb' || service === 'both') {
        switch (action) {
          case 'start':
            operations.push(startNLLBService());
            break;
          case 'stop':
            operations.push(stopNLLBService());
            break;
          case 'restart':
            operations.push(stopNLLBService().then(() => startNLLBService()));
            break;
        }
      }

      if (service === 'ollama' || service === 'both') {
        switch (action) {
          case 'start':
            operations.push(startOllamaService());
            break;
          case 'stop':
            operations.push(stopOllamaService());
            break;
          case 'restart':
            operations.push(stopOllamaService().then(() => startOllamaService()));
            break;
        }
      }

      await Promise.all(operations);

      return {
        success: true,
        message: `${action} ${service} completed successfully`
      };
    } catch (error: any) {
      reply.code(500);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Get system and service metrics
  fastify.get('/llm-services/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const systemMetrics = process.memoryUsage();
      return {
        system: {
          memory: {
            used: Math.round(systemMetrics.rss / 1024 / 1024), // MB
            heap: Math.round(systemMetrics.heapUsed / 1024 / 1024), // MB
            external: Math.round(systemMetrics.external / 1024 / 1024) // MB
          },
          uptime: process.uptime(),
          cpuUsage: process.cpuUsage()
        },
        services: {
          nllb: {
            status: serviceProcesses.nllb.status,
            uptime: serviceProcesses.nllb.startTime
              ? Math.floor((Date.now() - serviceProcesses.nllb.startTime.getTime()) / 1000)
              : 0,
            endpoint: 'http://localhost:8000'
          },
          ollama: {
            status: serviceProcesses.ollama.status,
            uptime: serviceProcesses.ollama.startTime
              ? Math.floor((Date.now() - serviceProcesses.ollama.startTime.getTime()) / 1000)
              : 0,
            endpoint: 'http://localhost:8001'
          }
        }
      };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Test service functionality
  fastify.post('/llm-services/test/:service', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { service } = request.params as { service: 'nllb' | 'ollama' };

      if (service === 'nllb') {
        const response = await fetch('http://172.17.0.1:8000/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Hello world',
            target_language: 'spanish'
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
          throw new Error(`NLLB test failed: ${response.status}`);
        }

        const result = await response.json();
        return { success: true, result };
      } else {
        const response = await fetch('http://172.17.0.1:8001/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: 'Summarize: This is a test message for the summarization service.',
            max_tokens: 50
          }),
          signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
          throw new Error(`Ollama test failed: ${response.status}`);
        }

        const result = await response.json();
        return { success: true, result };
      }
    } catch (error: any) {
      reply.code(500);
      return {
        success: false,
        error: error.message
      };
    }
  });
}