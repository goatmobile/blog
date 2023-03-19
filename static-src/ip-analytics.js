(function () {
  function is_ipv4(ip) {
    return regex_v4.test(ip);
  }

  function is_ipv6(ip) {
    return regex_v6.test(ip);
  }

  let regex_v4 =
    /((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])/;
  let regex_v6 =
    /((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))/;

  function peer(callback) {
    // Creating the peer connection.
    var WebRTCPeerConnection =
      window.RTCPeerConnection ||
      window.mozRTCPeerConnection ||
      window.webkitRTCPeerConnection;
    // Initializing the connection.
    var createdConnection;

    // Main start function.
    function start() {
      // Creating the actual connection.
      createConnection();
      // Log the STUN request.
      createStunRequest();
    }

    // Stop function to reset the connection.
    function stop() {
      // Checking if the connection has been created or not.
      if (createdConnection) {
        // Attempt to close it, if RTCPeerConnection.close() is not supported, remove the event listeners.
        try {
          createdConnection.close();
        } finally {
          createdConnection.onicecandidate = () => {};
          createdConnection = null;
        }
      }
    }

    // Function that makes the connection request to Google's STUN server
    function createConnection() {
      let iceServers = [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ];
      // Creating the connection with the STUN server.
      createdConnection = new WebRTCPeerConnection({ iceServers });
      // Handling the ICE candidate event.
      createdConnection.onicecandidate = (data) => handleCandidates(data);
      // Creation of the fake data channel.
      createdConnection.createDataChannel("fake_data_channel");
    }

    // Function that creates the STUN request offer needed to get the IPs.
    function createStunRequest() {
      // Create the offer that exposes the IP addresses.
      return createdConnection
        .createOffer()
        .then((sdp) => createdConnection.setLocalDescription(sdp));
    }

    // Handling the onIceCandidate event.
    function handleCandidates(ice) {
      // Checking if the ICE candidate lines given are valid.
      if (ice && ice.candidate && ice.candidate.candidate) {
        // Returning the IPs to the main function.
        callback(ice && ice.candidate && ice.candidate.candidate);
      }
    }

    // Returning the main functions needed.
    return {
      start,
      stop,
      createConnection,
      createStunRequest,
      handleCandidates,
    };
  }

  function publicIPs(timer) {
    // Timing validation.
    if (timer)
      if (timer < 100)
        throw new Error("Custom timeout cannot be under 100 milliseconds.");

    // IPs is the final array of all valid IPs found.
    var IPs = [];
    // Creating the peer connection request while handling the callback event.
    var peerConn = peer(handleIceCandidates);

    function getIps() {
      // Returning a promise.
      return new Promise(function (resolve, reject) {
        // Starting the peer connection.
        peerConn.start();
        // Setting the timer.
        setTimeout(() => {
          // Checking if the IP array exists.
          if (!IPs || IPs.length == 0) {
            // Rejecting the error
            reject("No IP addresses were found.");
          } else {
            // Return the unique IP addresses in an array.
            resolve(unique(IPs.flat(Infinity)));
          }
          // reset the peer connection.
          reset();
          // Set the Timeout to the custom timer, default to 500 milliseconds.
        }, timer || 500);
      });
    }

    function handleIceCandidates(ip) {
      var array = [];
      // Looping over the two regexs for IPv6 and IPv4
      for (let regex of [regex_v6, regex_v4]) {
        let arr = [];
        // Lutting all of the strings that match either IP format in an array
        let possible_ips_array = regex.exec(ip);
        if (possible_ips_array) {
          // Looping over that array
          for (let i = 0; i < possible_ips_array.length; i++) {
            // Checking if the "IP" is valid
            if (
              is_ipv4(possible_ips_array[i]) ||
              is_ipv6(possible_ips_array[i])
            ) {
              arr.push(possible_ips_array[i]);
            }
          }
          array.push(arr);
        }
      }
      // Final function that does more checks to determine the array's validity,
      // Also flattens the array to remove extraneous sub-arrays.
      push(array.flat(Infinity));
    }

    function push(ip) {
      // Checks if the IP addresses givin are already in the array.
      if (!IPs.includes(ip)) {
        IPs.push(unique(ip.flat(Infinity)));
      }
    }

    function reset() {
      // Stops the peer connection to the STUN server.
      peerConn.stop();
    }
    // Use this to only return unique IP addresses.
    function unique(a) {
      return Array.from(new Set(a));
    }

    return getIps();
  }

  publicIPs(100)
    .then((x) => {
      log(x.join(" "));
    })
    .catch((e) => {
      log("none");
    });

  function log(ips) {
    if (window.location.host.includes("localhost")) {
      return;
    }
    const url =
      "https://docs.google.com/forms/d/e/1FAIpQLSe90WgD5p1Ufhn4Wzp-9OZ918WAT9JE8KGSijFIuYmeVbLntA/formResponse";
    const ua = window.navigator ? window.navigator.userAgent : "none";

    const body = new FormData();
    body.append("entry.445489075", window.location.pathname);
    body.append("entry.242821687", ua);
    body.append("entry.957366110", ips);

    fetch(url, {
      method: "POST",
      mode: "no-cors",
      body: body,
    });
  }
})();
(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const contact = document.querySelector("#contact");
    const noJs = contact.querySelector("span");
    noJs.innerText = "";
    const a = contact.querySelector("a");
    a.innerText = "contact me";
    const data = [
      94, 206, 299, 434, 475, 686, 753, 878, 872, 1040, 1178, 1202, 822, 1432,
      1625, 1542, 1775, 1934, 864, 1970, 2321, 2388,
    ];
    let s = "";
    for (let i = 0; i < data.length; i++) {
      s += String.fromCharCode((data[i] + 10) / (i + 1));
    }
    a.href = `mailto:${s}`;
  });
})();
