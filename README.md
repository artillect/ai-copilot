# Tab Grouper

Tab Grouper is a Firefox extension that helps users organize their tabs into groups within a sidebar. It uses AI-powered categorization to automatically group tabs based on their content and relationships.

## Table of Contents

- [Features](#features)
- [Installation and Setup](#installation-and-setup)
- [Usage](#usage)
- [Architecture](#architecture)
- [API Integration](#api-integration)
- [Contributing](#contributing)
- [License](#license)

## Features

- Sidebar interface for tab management
- AI-powered tab categorization
- Drag-and-drop functionality for manual tab organization
- Collapsible tab groups
- Tab previews with favicons
- Close tabs directly from the sidebar
- Support for multiple AI providers (Anthropic and Groq)

## Installation and Setup

As this extension is still in development, it's not yet available on the Firefox Add-ons store. To install and set it up for use:

1. Clone this repository
2. Install Node.js and npm if you haven't already
3. Navigate to the `tab-grouper-server` directory
4. Run `npm install` to install dependencies
5. Create a `.env` file in the `tab-grouper-server` directory with your API keys:

```
ANTHROPIC_API_KEY=your_anthropic_api_key
GROQ_API_KEY=your_groq_api_key
```

6. Start the server with `node server.js`
7. Open Firefox and navigate to `about:debugging`
8. Click "This Firefox" in the left sidebar
9. Click "Load Temporary Add-on"
10. Navigate to the cloned repository and select the `manifest.json` file

## Usage

1. Click the Tab Grouper icon in the Firefox toolbar to open the sidebar
2. Use the "Group Tabs" button to automatically categorize your open tabs
3. Drag and drop tabs between groups to manually organize them
4. Click on a tab in the sidebar to switch to it
5. Use the close button (x) on each tab to close it directly from the sidebar

## Architecture

The extension consists of three main components:

1. **Sidebar**: The user interface for displaying and interacting with tab groups
2. **Background Script**: Handles tab events and communicates with the sidebar
3. **Server**: A Node.js server that interfaces with AI APIs for tab categorization

### Sidebar

The sidebar is implemented using HTML, CSS, and JavaScript. Key files:

- `sidebar/sidebar.html`: Structure of the sidebar
- `sidebar/sidebar.js`: JavaScript for sidebar functionality

### Background Script

The background script (`background.js`) handles tab events and communicates with the sidebar.

### Server

The server (`tab-grouper-server/server.js`) handles API requests for tab categorization.

## API Integration

The extension supports two AI providers for tab categorization:

- Anthropic (Claude Sonnet 3.5 by default, very slow but sorts tabs very well)
- Groq (Llama 3.1 8b by default, faster, and adequate at sorting tabs)

To switch between providers, use the dropdown menu in the sidebar.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. Make your changes and commit them with clear, descriptive messages
4. Push your changes to your fork
5. Submit a pull request with a detailed description of your changes

## License