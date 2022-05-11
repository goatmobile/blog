---
title: Running Self-Hosted Services Locally with HTTPS
date: 2022-05-10
---

With Docker and friends it's getting pretty easy to run complex software on your local network for private use. For example to download and run [Grafana](https://grafana.com/) all you have to do is:

```bash
sudo apt update
sudo apt install -y docker.io
sudo docker run -d -p 3000:3000 --name grafana grafana/grafana
```

This will put the service up at `localhost:3000` on the server, then to access this from somewhere else you need to set up an SSH tunnel:

```bash
ssh -L 3000:localhost:3000 myusername@<the server's IP>
```

Then finally you can visit `localhost:3000` on your client machine and start using the web app. While short and sweet, this has a couple downsides. Mainly that all the traffic is transmitted in the clear over HTTP! If you have an ISP provided router, that means they can still see everything you're doing. Plus this UX sucks! It'd be way nicer to be able to visit `grafana.myname.com` and get HTTPS.

This guide shows how to get a domain and a wildcard SSL certificate (meaning it's valid for all domains of the pattern `*.myname.com`) and register it for a local address. Then we'll set up Nginx as a reverse proxy to a bunch of services running in `docker-compose`. A little bit of set-up pays off in the long run since you get secure encrypted HTTP communications and nice logging for everything.

## Option 1 - Spend Money

### Step 1 - Get a Domain Name

HTTPS is the way to go, but to get a certificate you need a domain name, say for this post `myname.com`. Depending on your requirements this can cost upwards of $2 (which you'll have to renew every year too). You can also get [much sketchier free domains](https://en.wikipedia.org/wiki/.tk) but you'll probably still have to rotate the name each year.

### Step 2 - Register your Local IP

Since everything will be on the local network, the domain needs to resolve to the local IP of the server. That way none of the traffic should ever leave your router. Say the server is at `192.168.1.123`, you should make 2 DNS entries with your registrar:

1. Host: `@` - this will be for the main site `myname.com`
2. Host: `*` - this is the 'wildcard', any subdomain of `myname.com` will go here (e.g. `another.myname.com`)

After a while (5-30 minutes) you should be able to verify both of these and see the result

```bash
# check the @ record
nslookup myname.com

# check whidcard entries
nslookup another.myname.com
nslookup something-else.myname.com
```

## Option 2 - Don't Spend Money

### Step 1 - Get a "Domain Name"

You can also edit your `/etc/hosts` file (works on Windows, MacOS, and Linux!) to have an easy to remember domain name for your server. This will only work on that specific machine with the entry in `/etc/hosts/` though. For example:

```
echo '192.168.1.123  myname.local' >> /etc/hosts
```

## Step 2 - Get a SSL Certificate

If you don't want to buy a domain name, you can still create a certificate locally, your browser will just give you scary/annoying warnings when you try to use it.

```bash
openssl req -newkey rsa:2048 -nodes -keyout privkey.pem -x509 -days 365 -out fullchain.pem
```

Once you buy a domain, you need to get an SSL certificate. Let's Encrypt provides these for free and you don't even need to open up your server to the Internet to verify you own the domain. After installing [certbot](https://certbot.eff.org/), run it and request a wildcard certificate. This requires that you set a TXT record up for your domain using a secret Let's Encrypt gives you.

```bash
# Follow the prompts until it gives you the secret
sudo certbot --manual --preferred-challenges dns certonly
```

Most domain registrars will have a section (sometimes under an "Advanced" menu) to enter DNS records. Add a TXT record with a host of `_acme-challenge` and a value that matches the one from `certbot`. Wait a couple seconds and it should verify and issue you a certificate! Copy these down for later use.

```bash
# Be careful not to leave these anywhere insecure!
sudo /etc/letsencrypt/live/myname.com/privkey.pem .
sudo /etc/letsencrypt/live/myname.com/fullchain.pem .
sudo chown $USER privkey.pem fullchain.pem
```

## Step 3 - Start an Nginx Server

All the bookkeeping is done, now to make the server actually do something. [docker-compose](https://docs.docker.com/compose/) makes it simple to get several Docker containers up and running. To start we'll just do the server with no subdomains (so nothing actually useful yet).

First we need to create a [config for Nginx](https://www.nginx.com/resources/wiki/start/topics/examples/full/). That's way out of scope here, so copy-and-paste away into `http.conf`.

```
server {
    listen [::]:80 ipv6only=off;
    server_name /;

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    # server block for all the other requests
    # this block will be a default server block listening on port 80
    listen 443 default_server ssl;
    server_name _;
    ssl_certificate /etc/nginx/fullchain.pem;
    ssl_certificate_key /etc/nginx/privkey.pem;
    location / {
      return 200 'hello';
      add_header Content-Type text/plain;
    }
}
```

Then create a `docker-compose.yml`.

```yaml
version: "3.7"

services:
  # Run a service called 'nginx'
  nginx:
    image: nginx:1.21.0
    container_name: nginx
    # Expose ports 80 (for http) and 443 (for https) on the host
    ports:
      - "80:80"
      - "443:443"
    networks:
      - local-net
      - no-internet
    volumes:
      # Mount the config file and the 2 SSL certificate files
      - "./http.conf:/etc/nginx/conf.d/default.conf"
      - "./fullchain.pem:/etc/nginx/fullchain.pem"
      - "./privkey.pem:/etc/nginx/privkey.pem"

networks:
  # A docker internal network where services can find each other but can't
  # connect to the Internet
  no-internet:
    driver: bridge
    internal: true
  # A docker network that can be exposed to the host
  local-net:
    external: false
```

Now everything is in order to start up the server (note that `docker-compose` relies on reading a `docker-compose.yml` file from the current directory, so pass `--file` if it's somewhere else).

```bash
docker-compose up
# check the status
docker-compose ps
```

Now if we check `myname.com`, we should see Nginx up and running.

```bash
curl -v myname.com
```

## Step 4 - Run a Service

This is all basically useless so far since it doesn't actually run the services that got us here in the first place. So now we'll integrate one of those using [Gitea](https://gitea.io/en-us/) as the example. To do this we need to make an entry in `docker-compose.yml` to tell Docker to start the Gitea Docker image alongside Nginx

```yaml
version: "3.7"

services:
  ...
  gitea:
    image: gitea/gitea:1.16.5
    container_name: gitea
    environment:
      - USER_UID=1000
      - USER_GID=1000
    restart: always
    volumes:
      # Mount the Gitea data directory on the host so it's persistent across runs
      - ./gitea/:/data
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
    networks:
      # Gitea might need the Internet (e.g. for creating GitHub mirrors)
      - local-net

networks:
  ...
```

Then we can start it with

```bash
# Create the data folder
mkdir -p gitea

# Start Gitea
docker-compose up
```

But since the `gitea` definition in the `docker-compose.yml` doesn't publish any ports, there's no way to actually get to the Gitea server from outside the Docker `local-net` network. We need to tell Nginx that all traffic from `gitea.myname.com` should be routed to the Gitea server via some changes to `http.conf`

```
server {
    listen [::]:80 ipv6only=off;
    server_name /;

    location / {
        return 301 https://$host$request_uri;
    }
}

# This will catch all the wildcard domains that aren't explicitly listed below
server {
    # server block for all the other requests
    # this block will be a default server block listening on port 80
    listen 443 default_server ssl;
    server_name _;
    ssl_certificate /etc/nginx/fullchain.pem;
    ssl_certificate_key /etc/nginx/privkey.pem;
    # close the connection immediately
    return 444;
}

server {
    server_name gitea.tcl.bar;
    listen 443;

    client_max_body_size 500M;

    # Proxy to 'gitea', which is a valid DNS name inside the Docker local-net
    # network
    set $gitea_upstream_endpoint http://gitea:3000;
    location / {
        resolver 127.0.0.11 valid=30s ipv6=off;
        proxy_pass	$gitea_upstream_endpoint;

        # Everything below this is just gobbledegook to make proxying work better
        proxy_set_header    Host                $host:$server_port;
        proxy_set_header    X-Real-IP           $remote_addr;
        proxy_set_header    X-Forwarded-For     $proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Host    $host;
        proxy_set_header    X-Forwarded-Port    $server_port;
        proxy_set_header    X-Forwarded-Server  $host:$server_port;
        proxy_set_header    X-Forwarded-Proto   $scheme;
        proxy_hide_header X-Frame-Options;

        proxy_set_header        Upgrade $http_upgrade;
        proxy_set_header        Connection "upgrade";

        proxy_max_temp_file_size 0;

        client_max_body_size       100m;
        client_body_buffer_size    128k;

        proxy_connect_timeout      90;
        proxy_send_timeout         90;
        proxy_read_timeout         90;

        proxy_buffer_size          4k;
        proxy_buffers              4 32k;
        proxy_busy_buffers_size    64k;
        proxy_temp_file_write_size 64k;
    }
}
```

While it's rather long this config has only 2 real changes:
1. Adding a `server` block to catch all the wildcard domains (i.e. `anything.myname.com`)
2. Adding a `server` to send all `gitea.myname.com` data to Gitea

Then reload the Nginx config by re-running compose one last time.

```bash
docker-compose up
```

Then visit `gitea.myname.com` and, hot-dog, there it is! You can copy-paste your way to adding new services or generate the `http.conf` (or do it dynamically in Nginx via Lua if you really know what you're doing). Some final points of note:

1. Even if a service runs at a subdomain so the relative URLs of data on the webpage don't change (e.g. the services delivers an HTML page that tries to load `/style.css`, which will work fine), there are often other places that the domain shows up so you should still try to set the base/root URL in the service via its config if possible.
2. `docker-compose down --remove-orphans` will stop everything