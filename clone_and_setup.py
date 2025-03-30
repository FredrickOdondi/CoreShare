#!/usr/bin/env python3
"""
CoreShare Repository Cloner and Setup Script
This script clones the CoreShare repository, installs the necessary dependencies,
and sets up the environment for the Chat with Cori chatbot.
"""

import os
import sys
import subprocess
import shutil
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger('CoreShareSetup')

REPO_URL = "https://github.com/FredrickOdondi/CoreShare.git"
REPO_DIR = "CoreShare"

def check_git_installed():
    """Check if Git is installed on the system."""
    try:
        subprocess.run(["git", "--version"], check=True, stdout=subprocess.PIPE)
        return True
    except (subprocess.SubprocessError, FileNotFoundError):
        logger.error("Git is not installed. Please install Git and try again.")
        return False

def clone_repository():
    """Clone the CoreShare repository."""
    logger.info(f"Cloning repository from {REPO_URL}...")
    
    if os.path.exists(REPO_DIR):
        logger.warning(f"Directory {REPO_DIR} already exists.")
        response = input(f"Do you want to remove the existing {REPO_DIR} directory and clone again? (y/n): ")
        if response.lower() == 'y':
            shutil.rmtree(REPO_DIR)
        else:
            logger.info("Using existing repository directory.")
            return True
    
    try:
        result = subprocess.run(
            ["git", "clone", REPO_URL, REPO_DIR],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        logger.info("Repository cloned successfully.")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to clone repository: {e}")
        logger.error(f"Error details: {e.stderr.decode()}")
        return False

def detect_package_managers():
    """Detect what package managers are required based on project files."""
    package_managers = []
    
    # Check for Python requirements
    if os.path.exists(os.path.join(REPO_DIR, "requirements.txt")):
        package_managers.append("pip")
    
    # Check for Node.js requirements
    if os.path.exists(os.path.join(REPO_DIR, "package.json")):
        package_managers.append("npm")
    
    return package_managers

def install_dependencies(package_managers):
    """Install dependencies based on detected package managers."""
    os.chdir(REPO_DIR)
    
    for pm in package_managers:
        logger.info(f"Installing dependencies using {pm}...")
        
        try:
            if pm == "pip":
                subprocess.run(
                    [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"],
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                logger.info("Python dependencies installed successfully.")
            
            elif pm == "npm":
                subprocess.run(
                    ["npm", "install"],
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                logger.info("Node.js dependencies installed successfully.")
        
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to install dependencies with {pm}: {e}")
            logger.error(f"Error details: {e.stderr.decode()}")
            return False
    
    os.chdir("..")
    return True

def check_for_api_keys():
    """Check for required API keys in environment variables."""
    # Commonly used API key environment variables for chatbots
    api_keys = [
        "OPENAI_API_KEY",
        "HUGGINGFACE_API_KEY",
        "GOOGLE_API_KEY",
        "AZURE_OPENAI_API_KEY",
        "COHERE_API_KEY"
    ]
    
    missing_keys = []
    for key in api_keys:
        if not os.environ.get(key):
            missing_keys.append(key)
    
    if missing_keys:
        logger.warning(f"The following API keys are not set in environment variables: {', '.join(missing_keys)}")
        logger.warning("The chatbot might not function properly without required API keys.")
    else:
        logger.info("All common API keys are available in environment variables.")

def find_chatbot_files():
    """Find files related to the chatbot functionality."""
    chatbot_related_files = []
    
    patterns = [
        "cori", "chat", "bot", "dialog", "conversation", "ai", "nlp", 
        "openai", "gpt", "huggingface", "cohere", "azure"
    ]
    
    for root, dirs, files in os.walk(REPO_DIR):
        for file in files:
            # Skip binary files and hidden files
            if file.startswith(".") or any(file.endswith(ext) for ext in [
                ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", 
                ".mp3", ".wav", ".mp4", ".woff", ".ttf"
            ]):
                continue
                
            file_path = os.path.join(root, file)
            file_lower = file.lower()
            
            # Check if file name contains any of the patterns
            if any(pattern in file_lower for pattern in patterns):
                chatbot_related_files.append(file_path)
            else:
                # Check file content for chatbot-related keywords
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read().lower()
                        if any(f"chat with cori" in content or 
                               f"cori chatbot" in content or
                               (pattern in content and "bot" in content) 
                               for pattern in patterns):
                            chatbot_related_files.append(file_path)
                except Exception:
                    # Skip files that can't be read as text
                    pass
    
    if chatbot_related_files:
        logger.info(f"Found {len(chatbot_related_files)} files potentially related to the chatbot:")
        for file in chatbot_related_files[:5]:  # Show first 5 files
            logger.info(f"  - {file}")
        if len(chatbot_related_files) > 5:
            logger.info(f"  ... and {len(chatbot_related_files) - 5} more files")
    else:
        logger.warning("No files related to the 'Chat with Cori' chatbot were found.")
    
    return chatbot_related_files

def main():
    """Main function to clone and set up the CoreShare repository."""
    logger.info("Starting CoreShare repository setup...")
    
    if not check_git_installed():
        return False
    
    if not clone_repository():
        return False
    
    package_managers = detect_package_managers()
    if package_managers:
        logger.info(f"Detected package managers: {', '.join(package_managers)}")
        if not install_dependencies(package_managers):
            return False
    else:
        logger.warning("No package manager configuration files found.")
    
    check_for_api_keys()
    
    chatbot_files = find_chatbot_files()
    
    logger.info("Setup completed. You can now test the Chat with Cori chatbot using chatbot_tester.py")
    logger.info("For more detailed instructions, refer to setup_instructions.md")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
