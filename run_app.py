#!/usr/bin/env python3
"""
CoreShare Application Runner
This script attempts to find and run the main application in the CoreShare repository,
with a focus on ensuring the Chat with Cori chatbot is accessible.
"""

import os
import sys
import subprocess
import logging
import time
import signal
import json
import importlib.util
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger('CoreShareRunner')

REPO_DIR = "CoreShare"

def load_module_from_path(module_name, file_path):
    """Dynamically load a Python module from file path."""
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    if spec is None:
        return None
    
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
        return module
    except Exception as e:
        logger.error(f"Error loading module {module_name} from {file_path}: {e}")
        return None

def find_app_files():
    """Find potential application entry points in the repository."""
    app_files = []
    
    # Priority patterns for app entry points
    entry_point_patterns = [
        "app.py", "main.py", "server.py", "run.py", "wsgi.py", 
        "application.py", "index.py", "start.py"
    ]
    
    # Look for exact matches first
    for root, _, files in os.walk(REPO_DIR):
        for pattern in entry_point_patterns:
            if pattern in files:
                app_files.append(os.path.join(root, pattern))
    
    # If no exact matches, look for Flask app files
    if not app_files:
        for root, _, files in os.walk(REPO_DIR):
            for file in files:
                if not file.endswith('.py'):
                    continue
                    
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read().lower()
                        if ("from flask import" in content or "import flask" in content) and (
                                "app = flask" in content or "application = flask" in content):
                            app_files.append(file_path)
                except Exception:
                    pass
    
    return app_files

def check_for_flask_app(file_path):
    """Check if a file contains a Flask application."""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read().lower()
            return "from flask import" in content or "import flask" in content
    except Exception:
        return False

def find_run_command(file_path):
    """Find the command to run the application."""
    if check_for_flask_app(file_path):
        # For Flask apps, use a standard command to ensure proper binding
        return [
            sys.executable, 
            file_path, 
            "--host=0.0.0.0", 
            "--port=5000"
        ]
    else:
        # For non-Flask apps, simply run the file
        return [sys.executable, file_path]

def run_application(file_path):
    """Run the application with the specified file as entry point."""
    os.chdir(Path(file_path).parent)
    
    command = find_run_command(file_path)
    logger.info(f"Running application with command: {' '.join(command)}")
    
    try:
        # Start the application as a subprocess
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            bufsize=1
        )
        
        # Handle output in real-time
        logger.info("Application started. Press Ctrl+C to stop.")
        
        while True:
            output = process.stdout.readline()
            if output:
                print(output.strip())
            
            error = process.stderr.readline()
            if error:
                print(f"ERROR: {error.strip()}", file=sys.stderr)
            
            # Check if process has terminated
            if process.poll() is not None:
                break
            
            time.sleep(0.1)
        
        return_code = process.poll()
        
        if return_code == 0:
            logger.info("Application exited successfully.")
        else:
            logger.error(f"Application exited with code {return_code}")
            
        return return_code == 0
    
    except KeyboardInterrupt:
        logger.info("Stopping application...")
        process.send_signal(signal.SIGINT)
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        
        return True
    except Exception as e:
        logger.error(f"Error running application: {e}")
        return False

def try_find_chatbot_endpoints():
    """Try to find endpoints related to the chatbot."""
    endpoints = []
    
    for root, _, files in os.walk(REPO_DIR):
        for file in files:
            if not file.endswith('.py'):
                continue
                
            file_path = os.path.join(root, file)
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read().lower()
                    if ("@app.route" in content or "@blueprint.route" in content) and (
                            "chat" in content or "cori" in content or "bot" in content or "message" in content):
                        # Found a potential endpoint
                        lines = content.split('\n')
                        for i, line in enumerate(lines):
                            if "@app.route" in line or "@blueprint.route" in line:
                                route = line.split("route(")[1].split(")")[0].strip().strip("'").strip('"')
                                endpoints.append(route)
            except Exception:
                pass
    
    return endpoints

def main():
    """Main function to run the CoreShare application."""
    logger.info("Starting CoreShare application runner...")
    
    if not os.path.exists(REPO_DIR):
        logger.error(f"Repository directory {REPO_DIR} not found. Run clone_and_setup.py first.")
        return False
    
    app_files = find_app_files()
    
    if not app_files:
        logger.error("Could not find any application entry points in the repository.")
        return False
    
    logger.info(f"Found {len(app_files)} potential application entry points:")
    for i, file_path in enumerate(app_files):
        logger.info(f"  {i+1}. {file_path}")
    
    selected_index = 0
    if len(app_files) > 1:
        try:
            selected_index = int(input(f"Select an application to run (1-{len(app_files)}): ")) - 1
            if selected_index < 0 or selected_index >= len(app_files):
                logger.error(f"Invalid selection. Please choose a number between 1 and {len(app_files)}.")
                return False
        except ValueError:
            logger.error("Invalid input. Please enter a number.")
            return False
    
    selected_file = app_files[selected_index]
    logger.info(f"Selected application: {selected_file}")
    
    # Try to find chatbot endpoints
    endpoints = try_find_chatbot_endpoints()
    if endpoints:
        logger.info("Found potential chatbot endpoints that should be available when the app is running:")
        for endpoint in endpoints:
            logger.info(f"  - {endpoint}")
    
    # Run the application
    success = run_application(selected_file)
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
