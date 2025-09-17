#!/bin/bash

# Stop Ollama proxy service
if [ -f /tmp/ollama.pid ]; then
    PID=$(cat /tmp/ollama.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo "Ollama proxy service stopped (PID: $PID)"
        rm -f /tmp/ollama.pid
    else
        echo "Ollama proxy service was not running"
        rm -f /tmp/ollama.pid
    fi
else
    # Try to find and kill by process name
    PIDS=$(pgrep -f "python3 run_ollama_local.py")
    if [ -n "$PIDS" ]; then
        kill $PIDS
        echo "Ollama proxy service stopped (PIDs: $PIDS)"
    else
        echo "Ollama proxy service is not running"
    fi
fi