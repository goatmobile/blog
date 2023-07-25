---
title: "Fast Conda Initialization"
date: 2023-07-24
---

[Miniconda](https://docs.conda.io/en/latest/miniconda.html) is a great tool to manage Python installations that solves most of the common problems dealing with Python dependencies. By default its installation inserts some code into your shell initialization to set up the environment and muck with the shell prompt that looks something like this (for fish shell in `~/.confish/fish/config.fish`):

```bash
>>> conda initialize >>>
!! Contents within this block are managed by 'conda init' !!
if test -f /home/myusername/miniconda3/bin/conda
    eval /home/myusername/miniconda3/bin/conda "shell.fish" "hook" $argv | source
end
<<< conda initialize <<<
```

Conda initialization takes a second though which can get tedious. If you don't switch conda environments often it is enough to just set up the `PATH` environment variable for your base conda environment and add a macro to initialize conda fully on-demand only.

```bash
# replace the 'conda initialize' block above with this
set PATH $HOME/miniconda3/bin/python3 $PATH

function sourceconda
    eval $HOME/miniconda3/bin/conda "shell.fish" "hook" $argv | source
end
```

From my testing this reduces shell startup time from `350ms` to `15ms`.