# InfoFlow Plugin for Obsidian

This plugin integrates [InfoFlow](https://www.infoflow.app) with Obsidian, allowing you to sync your saved articles, web pages, notes, and highlights directly into your Obsidian vault.

[中文版](./README_zh.md)

## Features

- Sync InfoFlow items to your Obsidian vault
- Convert HTML content to Markdown automatically
- Customizable file naming templates
- Customizable note templates with frontmatter
- Support for highlights and annotations
- Filter sync by date, tags, and folders
- Manual and automatic sync options

## Installation

1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click Browse and search for "InfoFlow"
4. Install the plugin and enable it

## Configuration

1. Get your InfoFlow API token (can be created at <https://www.infoflow.app/user_portal/external_token>)
   - In the future, InfoFlow subscription would be required to use this API token
2. Open plugin settings in Obsidian
3. Enter your API token 
4. Configure sync settings:
   - Target folder for synced notes
   - File name template
   - Note template
   - Sync frequency

### Available Template Variables

#### File Name Template
- `{{title}}` - Item title
- `{{id}}` - Item ID
- `{{itemType}}` - Type of item (web_page, pdf, etc.)

#### Note Template
- `{{title}}` - Item title
- `{{url}}` - Source URL
- `{{itemType}}` - Type of item
- `{{author}}` - Author metadata
- `{{tags}}` - Item tags
- `{{createdAt}}` - Creation date
- `{{updatedAt}}` - Last update date
- `{{content}}` - Main content
- `{{notes}}` - Highlights/annotations section

## Usage

### Manual Sync
1. Click the InfoFlow sync icon in the left ribbon
2. Or use the command palette and search for "Sync InfoFlow Items"

### Automatic Sync
The plugin will automatically sync based on your configured sync frequency.

### Filtering
You can filter items to sync by:
- Date range
- Tags
- Folders
- Last update time

## Requirements

- An active InfoFlow Cloud account. Local versions with Google Drive or OneDrive is NOT supported due to the nature of the Obsidian plugin (a centrialized server is required to sync the files).
- InfoFlow API token
- Obsidian v0.15.0 or higher

## Support

- Visit [InfoFlow Support](https://www.infoflow.app/support)
- Report issues on GitHub

## License

MIT License. See LICENSE for details.
