#!/usr/bin/env python3
"""
Development server with live reload for fredriklundgren.github.io
Automatically refreshes browser when files change
"""

import os
import sys
import time
import json
import webbrowser
import http.server
import socketserver
import threading
from pathlib import Path
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

PORT = 3000
WATCH_EXTENSIONS = ['.html', '.css', '.js']
clients = []
file_changed = False

RELOAD_SCRIPT = """
<script>
(function() {
    var checkInterval = setInterval(function() {
        fetch('/__reload_check__')
            .then(function(response) { return response.text(); })
            .then(function(data) {
                if(data === 'reload') {
                    console.log('🔄 Changes detected, reloading...');
                    location.reload();
                }
            })
            .catch(function() {});
    }, 1000);
})();
</script>
"""

class LiveReloadHandler(FileSystemEventHandler):
    """Handles file system events and triggers reload"""

    def __init__(self):
        self.last_modified = time.time()

    def on_modified(self, event):
        global file_changed
        if event.is_directory:
            return

        # Check if file extension should trigger reload
        if any(event.src_path.endswith(ext) for ext in WATCH_EXTENSIONS):
            current_time = time.time()
            # Debounce - only reload if 0.5 seconds have passed
            if current_time - self.last_modified > 0.5:
                self.last_modified = current_time
                file_changed = True
                print(f"🔄 File changed: {os.path.basename(event.src_path)}")
                print("   ↻ Auto-reloading browser...")

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Custom HTTP handler that serves files with live reload"""

    def do_GET(self):
        global file_changed

        # Handle reload check endpoint
        if self.path == '/__reload_check__':
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            if file_changed:
                self.wfile.write(b'reload')
                file_changed = False
            else:
                self.wfile.write(b'ok')
            return

        # Serve files normally
        super().do_GET()

    def end_headers(self):
        # Disable caching for development
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def send_head(self):
        """Override to inject reload script into HTML files"""
        path = self.translate_path(self.path)

        # Only inject script for HTML files
        if path.endswith('.html') or (os.path.isdir(path) and os.path.exists(os.path.join(path, 'index.html'))):
            if os.path.isdir(path):
                path = os.path.join(path, 'index.html')

            try:
                with open(path, 'rb') as f:
                    content = f.read()

                # Inject reload script before closing body tag
                if b'</body>' in content:
                    content = content.replace(b'</body>', RELOAD_SCRIPT.encode('utf-8') + b'</body>')
                elif b'</html>' in content:
                    content = content.replace(b'</html>', RELOAD_SCRIPT.encode('utf-8') + b'</html>')

                self.send_response(200)
                self.send_header("Content-type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()

                from io import BytesIO
                return BytesIO(content)
            except:
                pass

        return super().send_head()

    def log_message(self, format, *args):
        # Simplified logging - only show actual page requests, not reload checks
        if '__reload_check__' not in self.path:
            return super().log_message(format, *args)

def start_file_watcher():
    """Start watching for file changes"""
    event_handler = LiveReloadHandler()
    observer = Observer()
    observer.schedule(event_handler, path='.', recursive=True)
    observer.start()
    return observer

def open_browser(port):
    """Open browser after a short delay"""
    time.sleep(2)
    webbrowser.open(f'http://localhost:{port}')

def update_version():
    """
    Automatically update version number using Semantic Versioning
    - PATCH increments on each server restart
    - When PATCH reaches 100, it resets to 0 and MINOR increments
    - MAJOR is only changed manually
    """
    version_file = 'version.json'

    try:
        # Read current version
        if os.path.exists(version_file):
            with open(version_file, 'r') as f:
                version_data = json.load(f)
        else:
            # Initialize version if file doesn't exist
            version_data = {
                "major": 2,
                "minor": 1,
                "patch": 0,
                "version": "2.1.0",
                "lastUpdated": datetime.now().isoformat(),
                "description": "Automatic version management system initialized"
            }

        # Increment PATCH
        version_data['patch'] += 1

        # If PATCH reaches 100, reset to 0 and increment MINOR
        if version_data['patch'] >= 100:
            version_data['patch'] = 0
            version_data['minor'] += 1

        # Update version string
        version_data['version'] = f"{version_data['major']}.{version_data['minor']}.{version_data['patch']}"
        version_data['lastUpdated'] = datetime.now().isoformat()

        # Save updated version
        with open(version_file, 'w') as f:
            json.dump(version_data, f, indent=2)

        return version_data['version']

    except Exception as e:
        print(f"⚠️  Warning: Could not update version: {e}")
        return "2.1.0"

def main():
    # Update version automatically
    version = update_version()

    print("🚀 Starting development server with live reload...")
    print(f"📦 Version: {version}")
    print(f"📂 Watching directory: {os.getcwd()}")
    print(f"🌐 Server running at: http://localhost:{PORT}")
    print("🔄 Browser will auto-refresh when HTML/CSS/JS files change")
    print("🌍 Browser will open automatically in 2 seconds...")
    print("\n✨ Press Ctrl+C to stop\n")

    # Start file watcher
    observer = start_file_watcher()

    # Open browser in background thread
    browser_thread = threading.Thread(target=open_browser, args=(PORT,))
    browser_thread.daemon = True
    browser_thread.start()

    # Start HTTP server
    Handler = CustomHTTPRequestHandler

    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"✓ Server started successfully on port {PORT}\n")
            httpd.serve_forever()
    except OSError as e:
        if e.errno == 98 or e.errno == 10048:  # Port already in use
            print(f"\n❌ ERROR: Port {PORT} is already in use!")
            print(f"   Please close any other application using port {PORT}")
            print(f"   Or change the PORT variable in dev-server.py")
        else:
            raise
    finally:
        observer.stop()
        observer.join()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Development server stopped")
        sys.exit(0)
