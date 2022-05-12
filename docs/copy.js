function copyToClipboard(string) {
  let textarea;
  let result;
  try {
    textarea = document.createElement("textarea");
    textarea.setAttribute("readonly", true);
    textarea.setAttribute("contenteditable", true);
    textarea.style.position = "fixed"; // prevent scroll from jumping to the bottom when focus is set.
    textarea.value = string;
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const range = document.createRange();
    range.selectNodeContents(textarea);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    textarea.setSelectionRange(0, textarea.value.length);
    result = document.execCommand("copy");
  } catch (err) {
    console.error(err);
    result = null;
  } finally {
    document.body.removeChild(textarea);
  }
  // manual copy fallback using prompt
  if (!result) {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const copyHotkey = isMac ? "⌘C" : "CTRL+C";
    result = prompt(`Press ${copyHotkey}`, string); // eslint-disable-line no-alert
    if (!result) {
      return false;
    }
  }
  return true;
}
const pres = document.querySelectorAll("div.highlight pre");
pres.forEach((pre) => {
  const div = document.createElement("button");
  div.classList.add("copy-button");
  div.innerText = "Copy";
  pre.appendChild(div);
  const code = pre.querySelector("code");
  div.addEventListener("click", () => {
    if (code.innerText.startsWith("$ ")) {
      let stripped = [];
      for (const line of code.innerText.split("\n")) {
        if (line.startsWith("$ ")) {
          stripped.push(line.slice(2));
        }
      }
      copyToClipboard(stripped.join("\n"));
    } else {
      copyToClipboard(code.innerText);
    }
    div.innerText = "Copied!";
    setTimeout(() => {
      div.innerText = "Copy";
    }, 1000);
  });
});
