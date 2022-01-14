---
title: "Terminal Spotlight: Part 2"
date: 2022-01-05
---

I found that startup time with Automator and a MacOS Service keyboard shortcut leads to pretty high start up latency (1-3 seconds-ish) that's mostly outside of the terminal's control. The obvious next step was to spend several hours futzing with Alacritty's [Rust codebase](https://github.com/alacritty/alacritty) to hack in a global keyboard shortcut listener to cut out the Automator middleman.

The listening was relatively simple with the [rdev](https://github.com/Narsil/rdev) create. My [Alacritty fork](https://github.com/goatmobile/alacritty) has the [changes](https://github.com/alacritty/alacritty/compare/master...goatmobile:master) and building it is pretty straightforward.

```bash
# This assumes Rust is installed: https://www.rust-lang.org/tools/install
git clone https://github.com/goatmobile/alacritty
cd alacritty
cargo build --release

# Test it out, press CMD+SHIFT+QUOTE
./target/release/alacritty --daemon
```

Unfortunately I am not any rustier than my stainless steel refrigerator so the binary panics and exits whenever the Alacritty window opens. But this is fine with a little wrapper script to hide these kinds of glaring warts.

```bash
#!/bin/bash
BASEDIR=$(dirname "$0")
BIN="$BASEDIR"/target/release/alacritty

while true
do
    $BIN || echo ok
done
```

Finally I want this to start automatically when I log in, so it's time to rev up [launchd](https://en.wikipedia.org/wiki/Launchd) with a small plist file that runs the above script (assuming it's written to a file`go.sh`).

```bash
echo '
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
   <key>Label</key>
   <string>com.user.loginscript</string>
   <key>ProgramArguments</key>
   <array><string>/Users/home/alacritty/go.sh</string></array>
   <key>RunAtLoad</key>
   <true/>
</dict>
</plist>
' > /Users/home/Library/LaunchAgents/daemon.plist

launchctl load /Users/home/Library/LaunchAgents/daemon.plist
```

And we're in! Log out and back in and `ps -ax | grep go.sh` should show a process running in the background. This solution isn't perfect by any means, but the start up time is significantly improved. It could probably be nearly instantaneous though with a proper application of Alacritty's [multi-window support](https://github.com/alacritty/alacritty/commit/1df7dc5171abfe1eab3e95be964f61c5876198f1), where a single instance would stay running in the background and spawn new windows as needed, though as you can see in my fork there's still some missing pieces. [kitty](https://github.com/kovidgoyal/kitty) looks promising since it has this functionality already via its [`--single-instance`](https://sw.kovidgoyal.net/kitty/invocation/#cmdoption-kitty-single-instance) option, but this set up with Alacritty meets my needs well enough.
