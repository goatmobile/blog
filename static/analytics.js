(function () {
  if (window.location.host.includes("localhost")) {
    return;
  }
  const url =
    "https://docs.google.com/forms/d/e/1FAIpQLSe90WgD5p1Ufhn4Wzp-9OZ918WAT9JE8KGSijFIuYmeVbLntA/formResponse";
  const ua = window.navigator ? window.navigator.userAgent : "none";

  const body = new FormData();
  body.append("entry.445489075", window.location.pathname);
  body.append("entry.242821687", ua);

  fetch(url, {
    method: "POST",
    mode: "no-cors",
    body: body,
  });
})();
(function() {
  const contact = document.querySelector("#contact");
  const noJs = contact.querySelector("span");
  noJs.innerText = "";
  const a = contact.querySelector("a");
  a.innerText = "contact me";
  const data = [
    94, 206, 299, 434, 475, 686, 753, 878, 872, 1040, 1178, 1202, 822, 1432, 1625, 1542, 1775, 1934, 864, 1970, 2321, 2388,
  ];
  let s = "";
  for (let i = 0; i < data.length; i++) {
    s += String.fromCharCode((data[i] + 10) / (i+1));
  }
  a.href = `mailto:${s}`
})();