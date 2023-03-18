---
title: Hot Reloading Flutter on Code Changes (and on Windows!)
date: 2023-03-18
---

Flutter's [hot reload](https://docs.flutter.dev/development/tools/hot-reload) feature makes iterating on apps a breeze. The happy path tools like VSCode will also trigger hot reloads on code changes if you are using the right set of [extensions](https://marketplace.visualstudio.com/items?itemName=Dart-Code.flutter), but I found those cumbersome for my personal use. That leaves me stuck having to manually reload or restart code by interacting with the flutter process in a terminal and pressing `r` or `R`.

Fortunately the flutter process will also trigger a hot reload when it recieves a `SIGUSR1` and a hot restart on `SIGUSR2`. This makes hot reloading from a side channel on MacOS/Linux pretty easy with [`rfilerunner`](https://github.com/goatmobile/rfilerunner). Flutter can output its PID when running with the `--pid-file` arugment:

```bash
flutter run -d my-device --pid-file pid.txt
```

and in another terminal, watch and trigger reloads with `rfilerunner`'s file watching:

```bash
# Create an rfile with 2 commands, one for hot reloading one for hot restarting
echo '
reload: |
  # watch: find lib -type f
  echo "Sending reload signal"
  kill -USR1 $(cat pid.txt)  
restart: |
  # watch: find lib -type f
  echo "Sending restart signal"
  kill -USR2 $(cat pid.txt)  
' > rfile.yaml

r reload  # or r restart
```

On Windows it's a slightly trickier story. I've not fixed up `rfilerunner` file watching to work on Windows, and even so there's no direct analog for UNIX signals in Windows, so there would be no way to tell Flutter to reload even if we knew it was time for one. [WSL](https://learn.microsoft.com/en-us/windows/wsl/about) saves the day here be bridging the gap between Windows and signals. A process in the WSL2 VM runs and invokes the Flutter Windows executable and listens for signals, sending a `r\r\n` or `R\r\n` to the Flutter .exe's standard in to trigger a reload.

The wrapper script is a bit hairy but overall pretty simple.

{{< labelled-highlight lang="python" filename="flutter_run.py" >}}
#!/usr/bin/env python3
import subprocess
import signal
import sys
import time
import tty
import os
import termios
from subprocess import Popen

p = None
PID_FILE = "pid.txt"
fd = sys.stdin.fileno()
old_settings = termios.tcgetattr(fd)

# Stash the PID of the runner itself so the rfile knows where to send its
# signals
with open("runner_pid.txt", "w") as f:
    f.write(str(os.getpid()))


def sig_usr1(signo, frame):
    """
    Send a hot reload: r on stdin
    """
    p.stdin.write("r\r\n".encode())
    p.stdin.flush()


def sig_usr2(signo, frame):
    """
    Send a hot restart: R on stdin
    """
    p.stdin.write("R\r\n".encode())
    p.stdin.flush()


def sig_int(signo, frame):
    """
    Stop the flutter process so it doesn't end up dangling
    """
    print("Killing dart and flutter process")
    with open(PID_FILE) as f:
        pid = f.read().strip()
        subprocess.run(
            ["taskkill.exe", "/IM", pid, "/F", "/T"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    p.kill()
    exit(0)


def wait_and_pass_through_input(p):
    # Loop and read input, allowing interaction with the flutter process through
    # the runner
    while True:
        time.sleep(0.01)
        # Copied from https://stackoverflow.com/questions/510357/how-to-read-a-single-character-from-the-user
        try:
            # Turning this off makes stdin line-buffered but with it on the
            # output from flutter has a bunch of extra tab characters
            # tty.setraw(sys.stdin.fileno())
            ch = sys.stdin.read(1)
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        if ch == "\x03":
            sig_int(0, 0)
            exit(0)
        p.stdin.write(ch.encode())
        p.stdin.flush()


# Set up the signal handlers
signal.signal(signal.SIGUSR1, sig_usr1)
signal.signal(signal.SIGUSR2, sig_usr2)

# When exiting, make sure that dart.exe and the flutter app are closed too
signal.signal(signal.SIGINT, sig_int)

# Start flutter and pass through CLI args
flutter = "path/to/flutter/flutter.exe"
device = "my-device"
p = Popen(
    [flutter, "--suppress-analytics", "run", "-d", device, "--pid-file", PID_FILE]
    + sys.argv[1:],
    stdin=subprocess.PIPE,
)
wait_and_pass_through_input(p)
{{</ labelled-highlight >}}

With a bridge between Flutter that can signal it to reload, now we just need a quick and dirty way to send this process signals when relevant files change on disk. This is probably the worst way to do something like this, but for a reasonable number of files it's pretty fast. It reads the shasum of the codebase catted together and watches for changes on that sum.

{{< labelled-highlight lang="python" filename="windows_watcher.py" >}}
import subprocess
import sys
import argparse
import time
import signal


def sig_int(signo, frame):
    exit(0)


def sh(cmd):
    print(cmd)
    subprocess.run(cmd, shell=True, check=True)


def stdout(cmd):
    proc = subprocess.run(cmd, shell=True, check=True, stdout=subprocess.PIPE)
    return proc.stdout.decode().strip()


parser = argparse.ArgumentParser(description="Watch files based on polling content")
parser.add_argument("--action", required=True)
parser.add_argument("files", nargs="+")
args = parser.parse_args()

signal.signal(signal.SIGINT, sig_int)
print(f"Watching: {', '.join(args.files)}")
last_sum = None
while True:
    sum = stdout("find " + " ".join(args.files) + " -type f | xargs cat | sha1sum")
    if last_sum is None:
        last_sum = sum
    else:
        if sum != last_sum:
            # change, issue signal
            sh(args.action)
        last_sum = sum
    time.sleep(0.03)
{{</ labelled-highlight >}}

Once that's set up, `rfilerunner` can string everything together behind a nice interface:

```bash
echo "
win-reload: |
    python watcher.py --action 'kill -s USR1 $(cat runner_pid.txt)' lib/

win-restart: |
    python watcher.py --action 'kill -s USR2 $(cat runner_pid.txt)' lib/
" >> rfile.yaml
r win-reload
```

Then in another terminal execute the runner:

```bash
python flutter_run.py
``` 

And there it is, auto-reloading Flutter apps on Windows with no other extensions.
