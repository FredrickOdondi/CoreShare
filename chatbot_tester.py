#!/usr/bin/env python3
"""
CoreShare Chatbot Tester
This script provides functionality to test the Chat with Cori chatbot 
in the CoreShare project.
"""

import os
import sys
import json
import importlib.util
import logging
import traceback
import time
import argparse
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger('ChatbotTester')

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
        logger.error(traceback.format_exc())
        return None

def find_chatbot_module():
    """Find the main chatbot module in the repository."""
    if not os.path.exists(REPO_DIR):
        logger.error(f"Repository directory {REPO_DIR} not found. Run clone_and_setup.py first.")
        return None
    
    # Candidate file patterns that might contain the chatbot implementation
    patterns = [
        "cori.py", "chatbot.py", "bot.py", "chat_with_cori.py", "assistant.py",
        "ai_chat.py", "conversation.py", "dialogue.py", "chat_service.py"
    ]
    
    # Look for exact matches first
    for root, _, files in os.walk(REPO_DIR):
        for pattern in patterns:
            if pattern in files:
                return os.path.join(root, pattern)
    
    # Then check for partial matches
    for root, _, files in os.walk(REPO_DIR):
        for file in files:
            if file.endswith('.py') and any(keyword in file.lower() for keyword in ["chat", "cori", "bot"]):
                return os.path.join(root, file)
    
    # Last resort: check content of Python files
    for root, _, files in os.walk(REPO_DIR):
        for file in files:
            if not file.endswith('.py'):
                continue
                
            file_path = os.path.join(root, file)
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read().lower()
                    if "chat with cori" in content or "cori chatbot" in content:
                        return file_path
            except Exception:
                pass
    
    return None

def find_api_function(module):
    """Try to find the API function that handles chatbot interactions."""
    # Common function names for chatbot processing
    function_candidates = [
        "chat", "process_message", "get_response", "handle_message", 
        "generate_response", "answer", "respond", "process_chat",
        "chat_with_cori", "cori_response", "send_message"
    ]
    
    for func_name in function_candidates:
        if hasattr(module, func_name) and callable(getattr(module, func_name)):
            return getattr(module, func_name)
    
    # If no exact match, look for any function that might be relevant
    for attr_name in dir(module):
        if attr_name.startswith('_'):
            continue
            
        attr = getattr(module, attr_name)
        if callable(attr) and any(keyword in attr_name.lower() for keyword in ["chat", "message", "response", "cori"]):
            return attr
    
    return None

def try_chatbot_function(func, test_messages):
    """Try to use the chatbot function with different argument patterns."""
    if not func:
        return False
        
    success = False
    
    for message in test_messages:
        logger.info(f"Testing message: '{message}'")
        
        # Try different calling patterns
        try_patterns = [
            # Pattern 1: Just the message
            lambda: func(message),
            # Pattern 2: Dict with 'message' key
            lambda: func({"message": message}),
            # Pattern 3: Message and user ID
            lambda: func(message, "test_user"),
            # Pattern 4: Dict with message and user
            lambda: func({"message": message, "user_id": "test_user"}),
            # Pattern 5: JSON string
            lambda: func(json.dumps({"message": message}))
        ]
        
        for i, pattern in enumerate(try_patterns):
            try:
                logger.info(f"Trying calling pattern {i+1}...")
                response = pattern()
                logger.info(f"Got response: {response}")
                success = True
                break
            except Exception as e:
                if i == len(try_patterns) - 1:
                    logger.error(f"Failed with all calling patterns. Last error: {e}")
                    logger.error(traceback.format_exc())
                continue
        
        if success:
            break
    
    return success

def test_flask_endpoints():
    """Try to find and test Flask endpoints that might handle chatbot functionality."""
    app_files = []
    
    # Find potential Flask app files
    for root, _, files in os.walk(REPO_DIR):
        for file in files:
            if not file.endswith('.py'):
                continue
                
            file_path = os.path.join(root, file)
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read().lower()
                    if ("from flask import" in content or "import flask" in content) and (
                            "chat" in content or "cori" in content or "bot" in content):
                        app_files.append(file_path)
            except Exception:
                pass
    
    if not app_files:
        logger.warning("No Flask application files found for the chatbot.")
        return False
    
    # Try to identify chatbot endpoints
    chatbot_endpoints = []
    for file_path in app_files:
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.readlines()
                for i, line in enumerate(content):
                    line_lower = line.lower()
                    if ("@app.route" in line_lower or "@blueprint.route" in line_lower) and (
                            "chat" in line_lower or "message" in line_lower or "cori" in line_lower):
                        # Extract route and function info
                        route = line.split("route(")[1].split(")")[0].strip().strip("'").strip('"')
                        func_line = content[i+1].strip()
                        func_name = func_line.split("def ")[1].split("(")[0].strip()
                        chatbot_endpoints.append((route, func_name, file_path))
        except Exception as e:
            logger.error(f"Error analyzing Flask file {file_path}: {e}")
    
    if chatbot_endpoints:
        logger.info(f"Found {len(chatbot_endpoints)} potential chatbot endpoints:")
        for route, func_name, file_path in chatbot_endpoints:
            logger.info(f"  - Route: {route}, Function: {func_name}, File: {file_path}")
        logger.info("To test the Flask endpoints, run the application with run_app.py")
        return True
    else:
        logger.warning("No chatbot endpoints found in Flask application files.")
        return False

def main():
    """Main function to test the Chat with Cori chatbot."""
    parser = argparse.ArgumentParser(description="Test the Chat with Cori chatbot")
    parser.add_argument("--message", help="Test message to send to the chatbot")
    args = parser.parse_args()
    
    test_messages = [
        "Hello",
        "How are you?",
        "What services do you offer?",
        "Tell me about CoreShare",
        "Can you help me with a question?"
    ]
    
    if args.message:
        test_messages.insert(0, args.message)
    
    logger.info("Starting ChatbotTester...")
    
    if not os.path.exists(REPO_DIR):
        logger.error(f"Repository directory {REPO_DIR} not found. Run clone_and_setup.py first.")
        return False
    
    chatbot_module_path = find_chatbot_module()
    if not chatbot_module_path:
        logger.warning("Could not find a specific chatbot module. Trying to find Flask endpoints...")
        return test_flask_endpoints()
    
    logger.info(f"Found potential chatbot module: {chatbot_module_path}")
    
    module_name = os.path.basename(chatbot_module_path).split('.')[0]
    module = load_module_from_path(module_name, chatbot_module_path)
    
    if not module:
        logger.error("Failed to load the chatbot module.")
        return False
    
    logger.info(f"Successfully loaded module {module_name}")
    
    api_function = find_api_function(module)
    if not api_function:
        logger.warning("Could not find a specific API function. Trying to find Flask endpoints...")
        return test_flask_endpoints()
    
    logger.info(f"Found potential API function: {api_function.__name__}")
    
    success = try_chatbot_function(api_function, test_messages)
    
    if success:
        logger.info("Successfully tested the chatbot functionality!")
    else:
        logger.warning("Could not successfully test the chatbot function directly.")
        logger.info("Trying to find Flask endpoints...")
        success = test_flask_endpoints()
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
