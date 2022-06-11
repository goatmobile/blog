---
title: Live Reloading HTML from Scratch Again
date: 2022-06-11
---

As a follow on to the original [Live Reloading HTML from Scratch]( {{< ref "posts/live-reload" >}}) post, adding the `<script>` tag to include the websocket server to each client HTML page turned out to be a little tedious. Most frameworks don't require this either, they just insert the relevant JavaScript into the page before they ship it off to complete the request. Python's HTTP server is pretty easy to extend to do this same thing:




{{< labelled-highlight lang="python" filename="http-server.py" >}}
import http
import http.server
import tempfile
from pathlib import Path

LIVE_JS = """
<script>
const host = `${window.location.protocol}//${window.location.hostname}`;
const socketUrl = `ws://${window.location.hostname}:5678`;
const webSocket = new WebSocket(socketUrl);

webSocket.onmessage = () => {
window.location.reload();
};
</script>
"""
SCRATCH = Path(tempfile.gettempdir()) / "livereload.html"


def add_live_js(content: str) -> str:
    return content.replace("</body>", LIVE_JS + "\n</body>")


class LiveHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        ppath = Path(path.lstrip("/"))
        if ppath.exists() and ppath.name.endswith(".html"):
            with open(ppath) as f:
                content = f.read()
            with open(SCRATCH, "w") as f:
                f.write(add_live_js(content))

            return str(SCRATCH)
        return super().translate_path(path)


http.server.test(HandlerClass=LiveHandler)
{{</ labelled-highlight >}}

And to repost the other relevant files with a short change to `rfile.yml`:

{{< labelled-highlight lang="yaml" filename="rfile.yml" >}}
main: |
  # parallel
  # dep: serve
  # dep: socket-server
  # dep: file-watcher

serve: |
  # basic HTTP server
  python http-server.py

socket-server: |
  # run the websocket server
  python reload-server.py

file-watcher: |
  # watch: find . -maxdepth 1 -type f
  kill -s USR1 $(ps -ax | grep reload-server.py | grep python | awk '{print $1}')
{{</ labelled-highlight >}}

{{< labelled-highlight lang="python" filename="reload-server.py" >}}
import signal

signal.signal(signal.SIGUSR1, lambda a, b: None)

import asyncio
import os
import websockets


CONNECTIONS = set()


async def register(websocket):
    print("New connection", websocket)
    CONNECTIONS.add(websocket)
    try:
        await websocket.wait_closed()
    finally:
        CONNECTIONS.remove(websocket)


async def main():
    print("Running websocket server")
    async with websockets.serve(register, os.getenv("HOST", "0.0.0.0"), 5678):

        # This will run when triggered from an external source via the SIGUSR1
        # signal
        def signal_handler(sig, frame):
            print(f"Sending refresh to {len(CONNECTIONS)} clients")
            websockets.broadcast(CONNECTIONS, "reload")

        signal.signal(signal.SIGUSR1, signal_handler)
        while True:
            await asyncio.sleep(10000)


if __name__ == "__main__":
    asyncio.run(main())
{{</ labelled-highlight >}}
