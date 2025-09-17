import { FastifyInstance } from "fastify";
import { z } from "zod";
import { promisify } from "util";
import { exec } from "child_process";

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
      ? `http://host.docker.internal:${port}/health`
      : `http://host.docker.internal:${port}/api/tags`;

    const start = Date.now();
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000)
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

    // Execute the host script
    const { stdout, stderr } = await execAsync('bash /app/llm-control/start-nllb.sh');

    console.log('NLLB start output:', stdout);
    if (stderr) console.log('NLLB start stderr:', stderr);

    // Wait for service to be ready
    let attempts = 0;
    const maxAttempts = 15;

    while (attempts < maxAttempts) {
      try {
        const health = await checkServiceHealth('nllb');
        if (health.healthy) {
          serviceProcesses.nllb.status = 'running';
          return;
        }
      } catch (error) {
        // Service not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('NLLB service failed to start within timeout');
  } catch (error: any) {
    serviceProcesses.nllb.status = 'error';
    serviceProcesses.nllb.lastError = error.message;
    throw error;
  }
}

async function stopNLLBService(): Promise<void> {
  try {
    serviceProcesses.nllb.status = 'stopping';

    const { stdout, stderr } = await execAsync('bash /app/llm-control/stop-nllb.sh');

    console.log('NLLB stop output:', stdout);
    if (stderr) console.log('NLLB stop stderr:', stderr);

    serviceProcesses.nllb.status = 'stopped';
    serviceProcesses.nllb.lastError = undefined;
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

    const { stdout, stderr } = await execAsync('bash /app/llm-control/start-ollama.sh');

    console.log('Ollama start output:', stdout);
    if (stderr) console.log('Ollama start stderr:', stderr);

    // Wait for service to be ready
    let attempts = 0;
    const maxAttempts = 15;

    while (attempts < maxAttempts) {
      try {
        const health = await checkServiceHealth('ollama');
        if (health.healthy) {
          serviceProcesses.ollama.status = 'running';
          return;
        }
      } catch (error) {
        // Service not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('Ollama service failed to start within timeout');
  } catch (error: any) {
    serviceProcesses.ollama.status = 'error';
    serviceProcesses.ollama.lastError = error.message;
    throw error;
  }
}

async function stopOllamaService(): Promise<void> {
  try {
    serviceProcesses.ollama.status = 'stopping';

    const { stdout, stderr } = await execAsync('bash /app/llm-control/stop-ollama.sh');

    console.log('Ollama stop output:', stdout);
    if (stderr) console.log('Ollama stop stderr:', stderr);

    serviceProcesses.ollama.status = 'stopped';
    serviceProcesses.ollama.lastError = undefined;
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

export function llmServicesRoutes(fastify: FastifyInstance) {
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

      return {
        nllb: {
          status: serviceProcesses.nllb.status,
          health: nllbHealth,
          startTime: serviceProcesses.nllb.startTime,
          lastError: serviceProcesses.nllb.lastError,
          endpoint: 'http://localhost:8000'
        },
        ollama: {
          status: serviceProcesses.ollama.status,
          health: ollamaHealth,
          startTime: serviceProcesses.ollama.startTime,
          lastError: serviceProcesses.ollama.lastError,
          endpoint: 'http://localhost:8001'
        }
      };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Control services
  fastify.post('/llm-services/control', async (request, reply) => {
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

  // Test service functionality
  fastify.post('/llm-services/test/:service', async (request, reply) => {
    try {
      const { service } = request.params as { service: 'nllb' | 'ollama' };

      if (service === 'nllb') {
        const response = await fetch('http://host.docker.internal:8000/translate', {
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
        const response = await fetch('http://host.docker.internal:8001/generate', {
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