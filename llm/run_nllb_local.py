#!/usr/bin/env python3
"""
Run NLLB Translation API locally using models from ~/models/
"""

import os
import sys
import uvicorn

# Add the nllb directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'nllb'))

# Set environment variables for local model cache
os.environ['HF_HOME'] = '/home/jamil/models'
os.environ['TRANSFORMERS_CACHE'] = '/home/jamil/models'
os.environ['HF_DATASETS_CACHE'] = '/home/jamil/models'

if __name__ == "__main__":
    print("🌐 Starting NLLB Translation Service locally...")
    print(f"📁 Using models from: /home/jamil/models/nllb-200")
    print(f"🔗 API will be available at: http://localhost:8000")
    print("📋 Endpoints:")
    print("   GET  /health")
    print("   GET  /readyz")
    print("   GET  /languages")
    print("   POST /translate")
    print("   POST /translate/batch")
    print("")

    try:
        from app import app
        uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
    except KeyboardInterrupt:
        print("\n👋 NLLB service stopped")
    except Exception as e:
        print(f"❌ Error starting NLLB service: {e}")