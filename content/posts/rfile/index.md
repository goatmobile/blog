---
title: "rfile Command Runner"
date: 2022-01-13
---

I recently found myself needing to run some terminal commands on my computer while working on a web project. What a conundrum! Several days later out popped [rfile](https://github.com/goatmobile/rfile#rfilerunner), a cool command runner that makes keeping track of projects a breeze.

My previous go-to for a project was to lump all the common tasks I needed to do (essentially a collection of short Bash scripts) into a Makefile and control things via environment variables. This works but:

1. It's hard to keep track of what does what after a few days/weeks of not working on something
2. Make is ubiquitous but its syntax for this kind of thing is not the most ergnomic
3. Using dependencies and `-jN` makes it easy to run two commands in parallel (e.g. watch and rebuild + serve files), but remembering to `-j` every time defeats the purpose of an easy command runner

[rfile](https://github.com/goatmobile/rfile#rfilerunner) (named rfilerunner in on [PyPi](https://pypi.org/project/rfilerunner/) since rfile was reasonably [taken](https://pypi.org/project/rfile/) and I'd already developed muscle memory for typing `r` by the time I published) aims to solve all of these. Commands are defined in a YAML as a dictionary and run via `r` which automatically reads the YAML file and presents a nice interface to the user. YAML isn't the best interface since it has way more features than are necessary here and the shell scripts don't get good syntax highlighting in most people's editors (and don't forget the inscrutable parse errors!), but it's easy to integrate so there it is.

```bash
$ pip install rfilerunner
...

$ echo '
something: |
  echo something

something-else: |
	echo wow!
' > rfile.yml

$ r
something
```

rfile picks the top command as the default and makes quick CLIs easy to define.

```bash
$ r --help
usage: r [-h, --help] [-v, --verbose] [-r, --rfile rfile] COMMAND

rfile is a simple command runner for executing Python and shell scripts

available commands:
    something          echo something (default)
    something-else     a little script
```

Commands can have CLI arguments, watch files for changes and continuously re-run, and run dependent commands (optionally in parallel). For example, you can have a single rfile command that takes you from 0 to a full development environment with a single character:

- Watch some JSX files for changes and rebuild them, but write an error message if the build fails
- Run an HTTP server to serve the resulting files
- Open VSCode

```yaml
frontend: |
  # parallel
  # dep: js
  # dep: serve
  # dep: code

code: |
  # Open VSCode if it's on the system
  if [ -n "$(command -v code)" ]; then
    code .
  fi

serve: |
  # Run HTTP server
  ./node_modules/http-server/bin/http-server

js: |
  # Run ESBuild
  # watch: echo main.jsx
  # catch: catch-js
  ./node_modules/.bin/esbuild main.jsx --jsx-factory=h --jsx-fragment=Fragment --bundle --outfile=dist.js --sourcemap

catch-js: |
  echo 'Writing ESBuild error to dist.js'
  echo "console.error(\`$ERROR\`)" > dist.js
```

Running the above content in `rfile.yml` shows everything running.

```bash
$ r
code  | VSCode not found
js    | watching main.jsx
js    | ✘ [ERROR] Invalid assignment target
js    |
js    |     main.jsx:32:0:
js    |       32 │ 2 = 3;
js    |          ╵ ^
js    |
js    | 1 error
catch-js | Writing ESBuild error to dist.js
serve | Starting up http-server, serving ./
serve |
serve | http-server version: 14.0.0
serve |
serve | http-server settings:
serve | CORS: disabled
serve | Cache: 3600 seconds
serve | Connection Timeout: 120 seconds
serve | Directory Listings: visible
serve | AutoIndex: visible
serve | Serve GZIP Files: false
serve | Serve Brotli Files: false
serve | Default File Extension: none
serve |
serve | Available on:
serve |   http://127.0.0.1:8080
serve |   http://192.168.1.190:8080
serve |   http://172.18.0.1:8080
serve | Hit CTRL-C to stop the server
```

The code and more descriptions of the language used in the YAML comments can be found the README at https://github.com/goatmobile/rfile#rfilerunner!
