#!/usr/bin/env python3

import json
import os
import subprocess
import base64


subprocess.run("find . -name '*.ipynb' | xargs -d '\n' jupyter nbconvert --to markdown", shell=True)
proc = subprocess.run("find . -name '*.ipynb'", shell=True, stdout=subprocess.PIPE)

files = proc.stdout.decode().splitlines()

for nb in files:
  front = open(f"{os.path.dirname(nb)}/front.txt", "r").read()
  data = json.load(open(nb, "r"))
  attachments = []
  for cell in data["cells"]:
    if "attachments" in cell:
      attachments.append(cell["attachments"])
  for attachment in attachments:
    for image_name, img_data in attachment.items():
      for type, base64_code in img_data.items():
        if type == "image/png":
          bytes = base64.b64decode(base64_code)
          print(image_name)
          open(f"{os.path.dirname(nb)}/{image_name}", "wb").write(bytes)
          # print(bytes)

  md_file = nb.replace("ipynb", "md")
  notebook_md = open(md_file, "r").read()

  notebook_md = notebook_md.replace("attachment:", "")

  subprocess.run(f"rm '{md_file}'", shell=True)

  open(f"{os.path.dirname(md_file)}/index.md", "w").write(front + "\n\n" + notebook_md)


  
