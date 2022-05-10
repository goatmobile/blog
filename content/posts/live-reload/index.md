---
title: Live Reloading HTML from Scratch
date: 2022-05-09
---

Any frontend toolkit worth its weight in `node_modules` today will have some kind of live reloading functionality (e.g. [livereload](https://pypi.org/project/livereload/) or [live-server](https://www.npmjs.com/package/live-server) for basic examples) where it watches files on disk for changes and automatically reloads changes in the browser. [CodeKit](https://codekitapp.com/) is a cool (proprietary) example that even has hot-reloading for CSS only changes so the browser doesn't lose any actual state. Most of these tools work by injecting JavaScript magic into your input HTML and communicating over a websocket server to a process on the server that watches the actual files. Sometimes however its useful to pull back the curtain for esoteric use cases that these tools don't support. This shows a simple Python websocket server + associated JavaScript that does a basic live reload in just a few dozen lines.

First, install [`rfilerunner`](https://pypi.org/project/rfilerunner/) which will handle the file watching and [`websockets`](https://pypi.org/project/websockets/).

```bash
$ pip install rfilerunner websockets
$ r --help
```

Next, the JavaScript snippet. This will need to be manually included into every page that needs live-reload functionality. These few lines listen to a websocket server from the same origin as the webpage and does a full page reload on any message.

```javascript
const host = `${window.location.protocol}//${window.location.hostname}`;
const socketUrl = `ws://${window.location.hostname}:5678`;
const webSocket = new WebSocket(socketUrl);

webSocket.onmessage = () => {
  window.location.reload();
};
```

If you visit this page now there will just be an error since there is no websocket server listening on port 5678 yet. This Python code in `reload-server.py` will handle listening to the socket.

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

The seasoned reader will notice the use of a signal handler on `SIGUSR1` (a Linux-only feature, so no MacOS or Windows). This code runs a websocket server that sends a message whenever the process recieves a `SIGUSR1`. Now it all starts to come together, all we need is another piece to watch the relevant files and send the Python server a `SIGUSR1`. This will bubble over to the JavaScript running on the browser which will then do a reload. `r` comes in handy here with this code in `rfile.yml`.

{{< labelled-highlight lang="yaml" filename="rfile.yml" >}}
main: |
  # parallel
  # dep: serve
  # dep: socket-server
  # dep: file-watcher

serve: |
  # basic HTTP server
  python -m http.server

socket-server: |
  # run the websocket server
  python reload-server.py

file-watcher: |
  # watch: find . -maxdepth 1 -type f
  kill -s USR1 $(ps -ax | grep reload-server.py | grep python | awk '{print $1}')
{{</ labelled-highlight >}}

`serve` just runs Python's built in HTTP server, but any old HTTP server will do. `socket-server` runs the websocket server code above. The last entry, `file-watcher` is the interesting one. It uses `# watch` to monitor all files at the top level of the current directory and re-runs its body when they are changed. Finally, the `kill` command sends the `SIGUSR1` signal to the `reload-server.py` process. Most of these aren't that useful in isolation, so the default command `main` wraps them all up with `# dep <name>` to be executed simultaneously via `# parallel` (see [this post](/posts/rfile) for more details on `r`/`rfilerunner`)

All the pieces are laid out, now to activate them

```bash
$ r
```

Then visit localhost:8000 in your browser, edit a file, and watch it go! Run this to get the full example code for this post.

```bash
$ git clone --depth=1 https://github.com/goatmobile/bg goatmobile-blog
$ cd goatmobile-blog/content/posts/live-reload
$ python3 -m pip install -r requirements.txt
$ r
```
