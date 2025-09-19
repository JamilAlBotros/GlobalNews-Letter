#!/usr/bin/env python3
"""
LLM Management API - Runs on host to control LLM services
Listens on port 7999 and manages NLLB (8000) and Ollama (8001) services
"""

from flask import Flask, jsonify, request
import subprocess
import os
import signal
import psutil
import requests
import time
import logging
import sys
from threading import Thread

app = Flask(__name__)

# Configure logging for systemd service
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Global state for tracking services
service_processes = {
    'nllb': {'pid': None, 'status': 'stopped', 'start_time': None},
    'ollama': {'pid': None, 'status': 'stopped', 'start_time': None}
}

PROJECT_DIR = '/home/jamil/projects/GlobalNews-Letter'

def run_script(script_path):
    """Execute a bash script and return output"""
    try:
        result = subprocess.run(['bash', script_path],
                              capture_output=True, text=True,
                              cwd=PROJECT_DIR, timeout=30)
        return result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        return '', 'Script timed out', 1
    except Exception as e:
        return '', str(e), 1

def check_service_health(service):
    """Check if a service is healthy by calling its endpoint"""
    try:
        if service == 'nllb':
            url = 'http://localhost:8000/health'
        elif service == 'ollama':
            url = 'http://localhost:8001/health'
        else:
            return False

        response = requests.get(url, timeout=5)
        return response.status_code == 200
    except:
        return False

def get_process_by_port(port):
    """Find process ID listening on a specific port"""
    try:
        for proc in psutil.process_iter(['pid', 'name', 'connections']):
            try:
                for conn in proc.info['connections'] or []:
                    if conn.laddr.port == port and conn.status == 'LISTEN':
                        return proc.info['pid']
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
    except:
        pass
    return None

def update_service_status():
    """Update service status based on actual running processes"""
    for service in ['nllb', 'ollama']:
        port = 8000 if service == 'nllb' else 8001
        pid = get_process_by_port(port)

        if pid and check_service_health(service):
            service_processes[service]['pid'] = pid
            service_processes[service]['status'] = 'running'
        else:
            service_processes[service]['pid'] = None
            service_processes[service]['status'] = 'stopped'

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'services': service_processes})

@app.route('/services/status', methods=['GET'])
def get_services_status():
    """Get status of all LLM services"""
    update_service_status()

    return jsonify({
        'nllb': {
            'status': service_processes['nllb']['status'],
            'pid': service_processes['nllb']['pid'],
            'healthy': check_service_health('nllb'),
            'port': 8000,
            'endpoint': 'http://localhost:8000'
        },
        'ollama': {
            'status': service_processes['ollama']['status'],
            'pid': service_processes['ollama']['pid'],
            'healthy': check_service_health('ollama'),
            'port': 8001,
            'endpoint': 'http://localhost:8001'
        }
    })

@app.route('/services/<service>/start', methods=['POST'])
def start_service(service):
    """Start a specific LLM service"""
    if service not in ['nllb', 'ollama']:
        return jsonify({'error': 'Invalid service'}), 400

    # Check if already running
    if check_service_health(service):
        return jsonify({
            'success': True,
            'message': f'{service} service is already running',
            'status': 'running'
        })

    # Execute start script
    script_path = f'{PROJECT_DIR}/llm-control/start-{service}.sh'
    stdout, stderr, returncode = run_script(script_path)

    if returncode != 0:
        return jsonify({
            'success': False,
            'error': f'Failed to start {service}: {stderr}',
            'stdout': stdout
        }), 500

    # Wait for service to be ready
    for _ in range(15):
        time.sleep(2)
        if check_service_health(service):
            update_service_status()
            return jsonify({
                'success': True,
                'message': f'{service} service started successfully',
                'status': 'running',
                'stdout': stdout
            })

    return jsonify({
        'success': False,
        'error': f'{service} service failed to start within timeout',
        'stdout': stdout
    }), 500

@app.route('/services/<service>/stop', methods=['POST'])
def stop_service(service):
    """Stop a specific LLM service"""
    if service not in ['nllb', 'ollama']:
        return jsonify({'error': 'Invalid service'}), 400

    # Execute stop script
    script_path = f'{PROJECT_DIR}/llm-control/stop-{service}.sh'
    stdout, stderr, returncode = run_script(script_path)

    if returncode != 0:
        return jsonify({
            'success': False,
            'error': f'Failed to stop {service}: {stderr}',
            'stdout': stdout
        }), 500

    # Wait for service to stop
    time.sleep(2)
    update_service_status()

    return jsonify({
        'success': True,
        'message': f'{service} service stopped successfully',
        'status': service_processes[service]['status'],
        'stdout': stdout
    })

@app.route('/services/<service>/restart', methods=['POST'])
def restart_service(service):
    """Restart a specific LLM service"""
    if service not in ['nllb', 'ollama']:
        return jsonify({'error': 'Invalid service'}), 400

    # Stop first
    stop_result = stop_service(service)
    if not stop_result[0].get_json().get('success', False):
        return stop_result

    # Wait a moment
    time.sleep(2)

    # Start again
    return start_service(service)

if __name__ == '__main__':
    logger.info("Starting LLM Management API on port 7999...")
    logger.info("Managing services:")
    logger.info("  - NLLB Translation: port 8000")
    logger.info("  - Ollama Summarization: port 8001")

    # Initial status update
    update_service_status()

    # Run in production mode for systemd service
    app.run(host='0.0.0.0', port=7999, debug=False)