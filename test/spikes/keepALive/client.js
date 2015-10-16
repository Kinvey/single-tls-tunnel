// Strict mode.
'use strict';

var net = require('net');
net.connect(8080, function() {
  //client.setKeepAlive(true);
  console.log('client connected');
  setTimeout(function() {
    console.log('client timeout');
    process.exit(0);
  }, 1000);
});
