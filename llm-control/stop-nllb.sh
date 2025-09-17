#!/bin/bash

# Stop NLLB service
if [ -f /tmp/nllb.pid ]; then
    PID=$(cat /tmp/nllb.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo "NLLB service stopped (PID: $PID)"
        rm -f /tmp/nllb.pid
    else
        echo "NLLB service was not running"
        rm -f /tmp/nllb.pid
    fi
else
    # Try to find and kill by process name
    PIDS=$(pgrep -f "python3 run_nllb_local.py")
    if [ -n "$PIDS" ]; then
        kill $PIDS
        echo "NLLB service stopped (PIDs: $PIDS)"
    else
        echo "NLLB service is not running"
    fi
fi