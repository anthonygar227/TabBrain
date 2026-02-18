TabBrain
AI-powered Chrome extension that tracks and categorizes browser tabs so you never forget why you opened them.
Overview
TabBrain is a Chrome extension that automatically tracks, categorizes, and organizes your browser tabs by context. It detects what you're doing — learning, developing, shopping, communicating — and groups your tabs accordingly, giving you a clean dashboard to manage your browsing workflow.
Features

Automatic Tab Classification — Categorizes tabs into context groups (Learning, Development, Shopping, Communication, Work, etc.)
Smart Dashboard — Visual overview of all open tabs organized by category with tab counts
Tab Search — Quickly find any open tab across all categories
One-Click Management — Close all tabs in a category or switch to any tab instantly
Activity Tracking — See when each tab was last accessed with relative timestamps
Context Descriptions — Generates brief descriptions of tab activity based on page titles and URLs
Customizable Settings — Configure categories, themes, and classification preferences

Tech Stack

JavaScript — Core extension logic
HTML/CSS — Dashboard UI, popup, and settings interfaces
Chrome Extensions API (Manifest V3) — Tab tracking, background service worker, storage

Installation

Clone this repository:

bash   git clone https://github.com/anthonygar227/TabBrain.git

Open Chrome and navigate to chrome://extensions/
Enable Developer mode (toggle in the top right)
Click Load unpacked and select the cloned TabBrain folder
The TabBrain icon will appear in your extensions toolbar

Project Structure
TabBrain/
├── manifest.json        # Extension configuration (Manifest V3)
├── background.js        # Service worker for tab tracking
├── content.js           # Content script for page analysis
├── popup.html/js/css    # Extension popup interface
├── dashboard.html/js/css # Full dashboard view
├── settings.html/js/css  # Settings and preferences
├── shared.css           # Shared styles across views
├── utils.js             # Utility functions
└── gen_icons.py         # Icon generation script
Usage

Click the TabBrain icon in your toolbar to see a quick overview of categorized tabs
Click Dashboard for a full-screen view of all tabs organized by category
Use the search bar to find specific tabs across all categories
Click Close All on any category to bulk-close related tabs
Access Settings to customize categories and preferences

Author
Anthony Garcia-Marquez

GitHub: @anthonygar227
