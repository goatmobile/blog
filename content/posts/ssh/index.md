---
title: Maintaining SSH Connections
date: 2021-12-16
---

If you don't like your computer to make sounds like beeping or fan spinning, you're probably using a remote server to do development. And nothing says "remote development" more than SSH. Connecting is easy enough:

```bash
ssh my_cool_server.com
```

This works fine until you need to open another connection or you close your laptop. Thankfully there are some easy ways to make SSH connections live longer than they would otherwise.

### ControlPersist

SSH has an option where it will persist a connection to a file (a socket) that can be used multiple times. In your SSH config (e.g. `~/.ssh/config`), set up a few parameters:

```bash
Host my_cool_server
    Hostname my_cool_server.com
    ControlMaster auto
    ControlPersist 600  # keep session alive for 600 seconds
    ControlPath ~/.ssh/sockets/my_cool_server
```

You will need to `mkdir -p ~/.ssh/sockets` or else you'll get a missing folder error on connection.

Now you can connect once, exit the session, and for 5 minutes reconnect over the same connection (so you can avoid SSH session overhead). Multiple connections open at once will also use the same session.

### Mosh

That's great but it doesn't help the roaming problem. [`mosh`](https://mosh.org/) is a UDP-based shell that only sends the last state of the current terminal window. It has a client-server architecture so you need to `sudo apt install -y mosh` on both the client and server (or `brew install mosh` on MacOS).

Since `mosh` only sends the last window, this will break terminal scrollback. You can get around this by using `tmux` on the remote to emulate scrollback by enabling mouse interaction with this `~/.tmux.conf`:

```
set -g mouse on
```

### Eternal Terminal

`mosh` is nice and quick but not as fully featured as SSH. For example, it doesn't support tunnels, and the use of UDP makes it fundamentally different from SSH. [Eternal Terminal](https://eternalterminal.dev/) (`et`, get it [here](https://eternalterminal.dev/download/)) fills this gap nicely by operating similarly to SSH. Scrollback works out-of-the-box and you can do nice things like create persistent SSH tunnels:

```bash
# Run et and:
#   - close orphaned sessions for the same user
#   - open a tunnel for port 8000 -> 8000 and 22 (remote) to 2222 (local), so local applications that expect SSH can use the persistent tunnel
#   - (optional) use a special command to start or attach to a tmux session
et --kill-other-sessions --tunnel 2222:22,8000:8000 --command 'tmux new-session -A -s main' my_cool_server
```
