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
