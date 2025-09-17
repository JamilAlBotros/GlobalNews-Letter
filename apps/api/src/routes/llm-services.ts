import { FastifyInstance } from "fastify";
import { z } from "zod";
import { spawn, exec, ChildProcess } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execAsync = promisify(exec);

// Zod schemas for validation
const ServiceControlSchema = z.object({
  action: z.enum(['start', 'stop', 'restart']),
  service: z.enum(['nllb', 'ollama', 'both'])
});

const ServiceConfigSchema = z.object({
  nllb: z.object({
    port: z.number().min(1000).max(65535).default(8000),
    modelPath: z.string().default('/home/jamil/models/nllb-200'),
    useGpu: z.boolean().default(false)
  }).optional(),
  ollama: z.object({
    port: z.number().min(1000).max(65535).default(8001),
    modelName: z.string().default('llama3.1:8b'),
    useGpu: z.boolean().default(false)
  }).optional()
});

// Service process tracking
interface ServiceProcess {
  pid?: number;
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error';
  startTime?: Date;
  lastError?: string;
  process?: ChildProcess;
}

const serviceProcesses: {
  nllb: ServiceProcess;
  ollama: ServiceProcess;
  ollamaServer: ServiceProcess;
} = {
  nllb: { status: 'stopped' },
  ollama: { status: 'stopped' },
  ollamaServer: { status: 'stopped' }
};

// Helper functions
async function checkServiceHealth(service: 'nllb' | 'ollama'): Promise<{
  healthy: boolean;
  responseTime?: number;
  error?: string;
}> {
  const ports = { nllb: 8000, ollama: 8001 };
  const endpoints = { nllb: '/health', ollama: '/health' };

  try {
    const startTime = Date.now();
    const response = await fetch(`http://localhost:${ports[service]}${endpoints[service]}`, {
      signal: AbortSignal.timeout(5000)
    });

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      return { healthy: true, responseTime };
    } else {
      return { healthy: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
  } catch (error: any) {
    return { healthy: false, error: error.message };
  }
}

async function startNLLBService(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      serviceProcesses.nllb.status = 'starting';

      const llmDir = path.resolve(process.cwd(), '../llm');
      const pythonScript = path.join(llmDir, 'run_nllb_local.py');

      // Start the NLLB service
      const child = spawn('python3', [pythonScript], {
        cwd: llmDir,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONPATH: llmDir,
          HF_HOME: '/home/jamil/models',
          TRANSFORMERS_CACHE: '/home/jamil/models'
        }
      });

      serviceProcesses.nllb.process = child;
      serviceProcesses.nllb.pid = child.pid;
      serviceProcesses.nllb.startTime = new Date();

      // Wait for service to be ready
      let healthCheckAttempts = 0;
      const maxAttempts = 30; // 30 seconds

      const checkHealth = async () => {
        try {
          const health = await checkServiceHealth('nllb');
          if (health.healthy) {
            serviceProcesses.nllb.status = 'running';
            resolve();
          } else if (healthCheckAttempts++ < maxAttempts) {
            setTimeout(checkHealth, 1000);
          } else {
            serviceProcesses.nllb.status = 'error';
            serviceProcesses.nllb.lastError = 'Service failed to start within timeout';
            reject(new Error('NLLB service failed to start within timeout'));
          }
        } catch (error: any) {
          if (healthCheckAttempts++ < maxAttempts) {
            setTimeout(checkHealth, 1000);
          } else {
            serviceProcesses.nllb.status = 'error';
            serviceProcesses.nllb.lastError = error.message;
            reject(error);
          }
        }
      };

      child.on('error', (error) => {
        serviceProcesses.nllb.status = 'error';
        serviceProcesses.nllb.lastError = error.message;
        reject(error);
      });

      child.on('exit', (code) => {
        if (code !== 0 && serviceProcesses.nllb.status !== 'stopping') {
          serviceProcesses.nllb.status = 'error';
          serviceProcesses.nllb.lastError = `Process exited with code ${code}`;
        }
      });

      // Start health checking after a brief delay
      setTimeout(checkHealth, 3000);

    } catch (error: any) {
      serviceProcesses.nllb.status = 'error';
      serviceProcesses.nllb.lastError = error.message;
      reject(error);
    }
  });
}

async function startOllamaService(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      serviceProcesses.ollama.status = 'starting';

      // First ensure Ollama server is running
      try {
        await checkServiceHealth('ollama');
      } catch {
        // Start Ollama server if not running
        const ollamaServer = spawn('ollama', ['serve'], {
          detached: false,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env }
        });

        serviceProcesses.ollamaServer.process = ollamaServer;
        serviceProcesses.ollamaServer.pid = ollamaServer.pid;
        serviceProcesses.ollamaServer.status = 'running';

        // Wait for Ollama server to be ready
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      const llmDir = path.resolve(process.cwd(), '../llm');
      const pythonScript = path.join(llmDir, 'run_ollama_local.py');

      // Start the Ollama API service
      const child = spawn('python3', [pythonScript], {
        cwd: llmDir,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONPATH: llmDir,
          OLLAMA_NUM_GPU: '0' // Force CPU usage
        }
      });

      serviceProcesses.ollama.process = child;
      serviceProcesses.ollama.pid = child.pid;
      serviceProcesses.ollama.startTime = new Date();

      // Wait for service to be ready
      let healthCheckAttempts = 0;
      const maxAttempts = 30;

      const checkHealth = async () => {
        try {
          const health = await checkServiceHealth('ollama');
          if (health.healthy) {
            serviceProcesses.ollama.status = 'running';
            resolve();
          } else if (healthCheckAttempts++ < maxAttempts) {
            setTimeout(checkHealth, 1000);
          } else {
            serviceProcesses.ollama.status = 'error';
            serviceProcesses.ollama.lastError = 'Service failed to start within timeout';
            reject(new Error('Ollama service failed to start within timeout'));
          }
        } catch (error: any) {
          if (healthCheckAttempts++ < maxAttempts) {
            setTimeout(checkHealth, 1000);
          } else {
            serviceProcesses.ollama.status = 'error';
            serviceProcesses.ollama.lastError = error.message;
            reject(error);
          }
        }
      };

      child.on('error', (error) => {
        serviceProcesses.ollama.status = 'error';
        serviceProcesses.ollama.lastError = error.message;
        reject(error);
      });

      child.on('exit', (code) => {
        if (code !== 0 && serviceProcesses.ollama.status !== 'stopping') {
          serviceProcesses.ollama.status = 'error';
          serviceProcesses.ollama.lastError = `Process exited with code ${code}`;
        }
      });

      // Start health checking
      setTimeout(checkHealth, 5000);

    } catch (error: any) {
      serviceProcesses.ollama.status = 'error';
      serviceProcesses.ollama.lastError = error.message;
      reject(error);
    }
  });
}

async function stopService(service: 'nllb' | 'ollama'): Promise<void> {
  const serviceProcess = serviceProcesses[service];

  if (serviceProcess.process && serviceProcess.status === 'running') {
    serviceProcess.status = 'stopping';

    return new Promise((resolve) => {
      const process = serviceProcess.process!;

      process.on('exit', () => {
        serviceProcess.status = 'stopped';
        serviceProcess.process = undefined;
        serviceProcess.pid = undefined;
        resolve();
      });

      // Try graceful shutdown first
      process.kill('SIGTERM');

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (serviceProcess.status === 'stopping') {
          process.kill('SIGKILL');
        }
      }, 5000);
    });
  } else {
    serviceProcess.status = 'stopped';
  }
}

export async function llmServicesRoutes(app: FastifyInstance): Promise<void> {
  // Get service status
  app.get("/llm-services/status", async (request, reply) => {
    const nllbHealth = serviceProcesses.nllb.status === 'running'
      ? await checkServiceHealth('nllb')
      : { healthy: false };

    const ollamaHealth = serviceProcesses.ollama.status === 'running'
      ? await checkServiceHealth('ollama')
      : { healthy: false };

    return {
      services: {
        nllb: {
          status: serviceProcesses.nllb.status,
          healthy: nllbHealth.healthy,
          pid: serviceProcesses.nllb.pid,
          startTime: serviceProcesses.nllb.startTime,
          lastError: serviceProcesses.nllb.lastError,
          responseTime: nllbHealth.responseTime,
          endpoint: 'http://localhost:8000',
          capabilities: ['translation', 'batch-translation']
        },
        ollama: {
          status: serviceProcesses.ollama.status,
          healthy: ollamaHealth.healthy,
          pid: serviceProcesses.ollama.pid,
          startTime: serviceProcesses.ollama.startTime,
          lastError: serviceProcesses.ollama.lastError,
          responseTime: ollamaHealth.responseTime,
          endpoint: 'http://localhost:8001',
          capabilities: ['summarization', 'batch-summarization']
        }
      },
      overall: {
        anyRunning: serviceProcesses.nllb.status === 'running' || serviceProcesses.ollama.status === 'running',
        allHealthy: nllbHealth.healthy && ollamaHealth.healthy,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    };
  });

  // Control services (start/stop/restart)
  app.post("/llm-services/control", async (request, reply) => {
    try {
      const { action, service } = ServiceControlSchema.parse(request.body);

      const results: any = {};

      if (service === 'nllb' || service === 'both') {
        try {
          if (action === 'start') {
            await startNLLBService();
            results.nllb = { success: true, status: 'started' };
          } else if (action === 'stop') {
            await stopService('nllb');
            results.nllb = { success: true, status: 'stopped' };
          } else if (action === 'restart') {
            await stopService('nllb');
            await new Promise(resolve => setTimeout(resolve, 2000));
            await startNLLBService();
            results.nllb = { success: true, status: 'restarted' };
          }
        } catch (error: any) {
          results.nllb = { success: false, error: error.message };
        }
      }

      if (service === 'ollama' || service === 'both') {
        try {
          if (action === 'start') {
            await startOllamaService();
            results.ollama = { success: true, status: 'started' };
          } else if (action === 'stop') {
            await stopService('ollama');
            results.ollama = { success: true, status: 'stopped' };
          } else if (action === 'restart') {
            await stopService('ollama');
            await new Promise(resolve => setTimeout(resolve, 2000));
            await startOllamaService();
            results.ollama = { success: true, status: 'restarted' };
          }
        } catch (error: any) {
          results.ollama = { success: false, error: error.message };
        }
      }

      return {
        action,
        service,
        results,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      return reply.code(400).type("application/problem+json").send({
        type: "about:blank",
        title: "Invalid service control request",
        status: 400,
        detail: error.message,
        instance: request.url
      });
    }
  });

  // Test individual service
  app.post("/llm-services/test/:service", async (request, reply) => {
    const { service } = request.params as { service: string };

    if (service !== 'nllb' && service !== 'ollama') {
      return reply.code(400).send({
        error: "Invalid service. Must be 'nllb' or 'ollama'"
      });
    }

    try {
      if (service === 'nllb') {
        const response = await fetch('http://localhost:8000/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Hello world',
            source_language: 'english',
            target_language: 'spanish'
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          const result = await response.json();
          return {
            service: 'nllb',
            success: true,
            test: 'translation',
            input: 'Hello world',
            output: result.translated_text,
            responseTime: response.headers.get('x-response-time')
          };
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } else {
        // Test Ollama with a simple summarization
        const response = await fetch('http://localhost:8001/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Artificial intelligence is a rapidly growing field of technology.',
            max_length: 20,
            language: 'english'
          }),
          signal: AbortSignal.timeout(30000) // Longer timeout for summarization
        });

        if (response.ok) {
          const result = await response.json();
          return {
            service: 'ollama',
            success: true,
            test: 'summarization',
            input: 'Artificial intelligence is a rapidly growing field of technology.',
            output: result.summary,
            responseTime: response.headers.get('x-response-time')
          };
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }
    } catch (error: any) {
      return reply.code(500).send({
        service,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get service logs (last 50 lines)
  app.get("/llm-services/logs/:service", async (request, reply) => {
    const { service } = request.params as { service: string };

    if (service !== 'nllb' && service !== 'ollama') {
      return reply.code(400).send({
        error: "Invalid service. Must be 'nllb' or 'ollama'"
      });
    }

    // In a real implementation, you'd capture and store logs
    // For now, return mock logs based on service status
    const serviceProcess = serviceProcesses[service as 'nllb' | 'ollama'];

    const mockLogs = [
      `[${new Date().toISOString()}] Service ${service} status: ${serviceProcess.status}`,
      `[${new Date().toISOString()}] PID: ${serviceProcess.pid || 'N/A'}`,
      `[${new Date().toISOString()}] Start time: ${serviceProcess.startTime?.toISOString() || 'N/A'}`,
      serviceProcess.lastError ? `[${new Date().toISOString()}] Last error: ${serviceProcess.lastError}` : null
    ].filter(Boolean);

    return {
      service,
      logs: mockLogs,
      timestamp: new Date().toISOString()
    };
  });

  // Get service metrics
  app.get("/llm-services/metrics", async (request, reply) => {
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
      },
      timestamp: new Date().toISOString()
    };
  });
}