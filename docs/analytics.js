const url = 'https://docs.google.com/forms/d/e/1FAIpQLSe90WgD5p1Ufhn4Wzp-9OZ918WAT9JE8KGSijFIuYmeVbLntA/formResponse'
const ua = window.navigator ? window.navigator.userAgent : 'none'

const body = new FormData();
body.append('entry.445489075', window.location.pathname);
body.append('entry.242821687', ua);

fetch(url, {
  method: 'POST',
  mode: 'no-cors',
  body: body
})