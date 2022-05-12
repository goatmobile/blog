---
title: "Multiple GitHub Users on a Single Machine"
date: 2021-05-02
---

1. Generate a key.

    ```bash
    # Give your keys a special name! For this example it's 'my_cool_key'
    ssh-keygen -t ed25519 -N "" -C "my key's name" -f ~/.ssh/my_cool_key
    ```

2. [Copy it to whatever GitHub account it should be on](https://github.com/settings/keys).

    ```bash
    cat ~/.ssh/my_cool_key.pub
    ```

3. Go to your repository and do some pushes! Use `GIT_SSH_COMMAND` to tell it to use the key we just generated.

    ```bash
    GIT_SSH_COMMAND='ssh -i ~/.ssh/my_cool_key -o IdentitiesOnly=yes' \
        git push
    ```

4. Wow!

## Explanation

When you have multiple SSH keys associated with different GitHub accounts on the same machine, it can be tricky to tell which ones are being used, especially when you push to a repo to which more than one of these accounts have access. `git` will use the [`GIT_SSH_COMMAND`](https://git-scm.com/docs/git#Documentation/git.txt-codeGITSSHCOMMANDcode) environment variable in place of `ssh` when connecting to a repo via an SSH remote. So, in the SSH command we specify `-i` (`identity_file`) to offer a specific SSH key. `-o IdentitiesOnly=yes` means to *only* use the specified key instead of offering up other keys in the default search locations.

For a more permanent solution, you can [edit your `~/.ssh/config` instead](https://gist.github.com/jexchan/2351996).