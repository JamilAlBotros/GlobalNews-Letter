#!/bin/bash
cd /home/jamil/projects/GlobalNews-Letter

# Check if already running
if pgrep -f "python3 run_nllb_local.py" > /dev/null; then
    echo "NLLB service is already running"
    exit 0
fi

# Start NLLB service in background
source llm_env/bin/activate
nohup python3 run_nllb_local.py > /tmp/nllb.log 2>&1 &
echo $! > /tmp/nllb.pid

echo "NLLB service started with PID: $(cat /tmp/nllb.pid)"