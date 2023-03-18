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
