#!/bin/bash
cd /home/jamil/projects/GlobalNews-Letter

# Check if Ollama proxy is already running
if pgrep -f "python3 run_ollama_local.py" > /dev/null; then
    echo "Ollama proxy service is already running"
    exit 0
fi

# Start Ollama proxy service in background
export OLLAMA_NUM_GPU=0
source llm_env/bin/activate
nohup python3 run_ollama_local.py > /tmp/ollama.log 2>&1 &
echo $! > /tmp/ollama.pid

echo "Ollama proxy service started with PID: $(cat /tmp/ollama.pid)"