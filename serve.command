#!/bin/bash
# Double-click on macOS to start the local server, then open the page.
# (The webcam only works over http://localhost, not from a file:// path.)
cd "$(dirname "$0")"
PORT=8000
echo "Starting K-Pop Stage on http://localhost:$PORT  (press Ctrl+C to stop)"
# open the browser after a short delay
( sleep 1 && open "http://localhost:$PORT/" ) &
python3 -m http.server $PORT --bind 127.0.0.1
