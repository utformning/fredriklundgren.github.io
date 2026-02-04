#!/usr/bin/env python3
"""
Development server with live reload for fredriklundgren.github.io
Automatically refreshes browser when files change
"""

import os
import sys
from livereload import Server

def main():
    print("🚀 Starting development server with live reload...")
    print("📂 Watching directory:", os.getcwd())
    print("🌐 Server will be available at: http://localhost:3000")
    print("🔄 Browser will auto-refresh when files change")
    print("🌍 Browser will open automatically in 2 seconds...")
    print("\n✨ Press Ctrl+C to stop\n")

    server = Server()

    # Watch HTML files
    server.watch('*.html')

    # Watch CSS files
    server.watch('css/*.css')

    # Watch JavaScript files
    server.watch('js/*.js')

    # Watch all subdirectories for any changes
    server.watch('css/')
    server.watch('js/')

    # Start the server with automatic browser opening
    server.serve(
        root='.',
        port=3000,
        host='localhost',
        open_url=True,        # Automatically opens browser
        open_url_delay=2      # Wait 2 seconds before opening
    )

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Development server stopped")
        sys.exit(0)
