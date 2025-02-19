#!/bin/bash

# Define the target directory (using ~ for home directory)
TARGET_DIR="$HOME/Library/Application Support/obsidian/Obsidian Sandbox/.obsidian/plugins/infoflow-dev"

# Create the target directory if it doesn't exist
mkdir -p "$TARGET_DIR"

# Copy the files
cp main.js manifest.json styles.css "$TARGET_DIR/"

echo "Files copied to $TARGET_DIR" 