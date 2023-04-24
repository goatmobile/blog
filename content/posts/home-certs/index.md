---
title: "SSL Certificates at Home"
date: 2023-04-22
---

This is a corollary to my earlier post about setting up self hosting. For a quick recap, some stuff is hosted on a computer in my local network, accessible with a domain name (call it `mydomain.com` for this post) which is publicly registered but points to a private IP (e.g. `192.168.1.50`). The public registration part is really only necessary for getting an SSL certificate from Let's Encrypt. Since I intend to host services via subdomains, I added two DNS records via my registrar:

* An `A` record for host `@` pointing to `192.168.1.50` to host an index page
* A wildcard `A` record for host `*` pointing to `192.168.1.50` to host the individual services (Nginx takes care of the actual dispatching)

Lastly since the domain is private, `certbot` from Let' Encrypt can't do it's normal trick of hosting a web server to verify domain ownership, so I had to use a DNS challenge:

```bash
export DOMAIN=mydomain.com
# Generate 1 certificate both for the domain and any subdomains (via a wildcard cert)
sudo certbot -d "$DOMAIN" -d "*.$DOMAIN" --manual --preferred-challenges dns certonly --register-unsafely-without-email --agree-tos
```

I noticed a problem when trying to check if the DNS record had gone in yet when resolving with my local [`dnsmasq`](https://en.wikipedia.org/wiki/Dnsmasq) server:

```bash
nslookup -type=TXT _acme-challenge.mydomain.com
```

`nslookup` showed no results but online DNS tools showed that the record was available after just a few minutes. After much poking around, the culprit lied in my earlier assumption that I could remove the `/etc/hosts` entry on my router for `mydomain.com`. `dnsmasq` comes with an option to defend against [DNS rebinding attacks](https://en.wikipedia.org/wiki/DNS_rebinding), which it does by dropping any queries that have a suspicious answer. DNS rebinding attacks involve (1) a malicious site and (2) a malicious DNS resolver (in this case a malicious upstream DNS resolver that `dnsmasq` forwards queries to). Ordinarily if the malicious site makes requests to get data from somewhere that violates the [Same-origin policy](https://en.wikipedia.org/wiki/Same-origin_policy), the site would not be able to read it. However, since the DNS resolution is also under the attacker's control, they can make any IP to appear under the same domain, this passing any origin checks. Local services (i.e. those running at private IP addresses) often give higher credence to anonymous users by virtue of the fact that they can connect at all, trusting connections on the local network by default. The combination of these two opens up a security hole, which `dnsmasq` fixes by dropping any DNS answers that resolve to a private IP address.

`dnsmasq` is doing the right thing here and I want to keep it that way rather than [disable it](https://serverfault.com/questions/419828/dnsmasq-swallows-local-a-entries), so the fix is simple: just add a specific entry for the domain in the router's DNS settings and leave DNS rebinding protection turned on.
