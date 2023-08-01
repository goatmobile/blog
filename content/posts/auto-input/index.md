---
title: Automating `<input type="file" />`
date: 2023-08-01
---

The MDN docs [spell out pretty clearly](https://developer.mozilla.org/en-US/docs/Web/API/FileList) that the only way to access files in the browser is for the user to manually select them from a `<input type="file />` dialog box. This is well and good for sandboxing but makes development and testing a web page that relies on a user-selected file a big pain. For small files this isn't a big deal, just put them straight in the code as bytes or stuff them into `localStorage` if you're lucky enough to be within the 5 MB limit and [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) if not. These both require you to load the entirety of the file in JavaScript, which in my case with a 5 GB file was met with a friendly out-of-memory error.

The workaround relies on the non-standard (works in Chrome and Firefox though) [File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_and_Directory_Entries_API). Select the file once, store it in the JavaScript-accessible file system, and access it on later page loads automatically.

```html
<html lang="en">
  <body>
    <span>Update testing file:</span><input type="file" id="test-file-input" />
    <script src="script.js"></script>
  </body>
</html>
```

See the annotated JavaScript code below for a working example.

```javascript
// Set up an event handler for when the user selects a file
document.getElementById("test-file-input").onchange = async function() {
    const file = this.files[0];

    // Access the filesystem API
    const root = await navigator.storage.getDirectory();

    // Create a file with the same name as the selected one (note: this may
    // lead to name collisions so be careful when dealing with different
    // directories)
    let handle = await root.getFileHandle(file.name, {create: true});

    // Write the data to the filesystem API file
    console.log(`Writing to file ${file.name}`)
    const stream = await handle.createWritable();
    await stream.write(file);
    await stream.close();
    console.log("Done");
}

// This function loads a file from the filesystem or errors out
async function loadTestingFile(filename, callback) {
    const root = await navigator.storage.getDirectory();
    let handle = null;

    // Try to load the file
    try {
        handle = await root.getFileHandle(filename);
    } catch (e) {
        if (e.toString().includes("A requested file or directory could not be found")) {
            throw new Error(`File '${filename}' does not exist`);
        } else {
            throw e;
        }
    }

    // Got the file, send it to the user-provided callback
    const file = await handle.getFile();
    callback(file);
}

// Lastly, load the file for testing!
loadTestingFile('myfile.txt', (file) => {
    console.log(`"Loaded file: ${file}`);

    // read the file as usual (note: this crashes with large files for the same
    // reason as above, but that is expected here since it must reify the whole
    // thing all at once)
    const data = await file.arrayBuffer();
})
```