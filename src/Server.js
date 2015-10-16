// Strict mode.
'use strict';

// Standard lib.
var crypto = require('crypto'),
    EventEmitter = require('events').EventEmitter,
    http = require('http'),
    net  = require('net'),
    tls  = require('tls'),
    util = require('util');

// Packag emodules.
var Valve = require('pipette').Valve,
    MultiplexStream = require('multiplex-stream');

// Define the server.
function Server(options) {
  // Init.
  var self = this,
      multiplex,
      connections = [];

  // Create a new server.
  var server = net.createServer({
    allowHalfOpen: true
  }, function(connection) {
    connections.push(connection);
    connection.on('close', function() {
      connections.splice(connections.indexOf(connection), 1);
    });
  });

  function onConnectionAfterClientAuthenticated(connection) {
    // this is required as the server allows connections to be half open
    connection.on('end', function() {
      connection.end();
    });
    var valve = new Valve(connection, {paused: true});
    var tunnel = multiplex.connect(function() {
      valve.pipe(tunnel).pipe(connection);
      valve.resume();
    });
  }

  var httpServer = http.createServer(function(request, response) {
    response.end('Waiting for a client');
  });

  httpServer.on('upgrade', function(request, socket/*, head*/) {
    socket.setTimeout(0); // Disable socket timeout keeping it alive.

    socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
                 'Upgrade: websocket\r\n' +
                 'Connection: Upgrade\r\n' +
                 '\r\n');

    var securePair = tls.createSecurePair(
     crypto.createCredentials({
       key: options.key,
       cert: options.cert,
       ca: options.ca
     }),
     true,
     options.requireCert,
     options.rejectUnauthorized
    );

    // Add request and response event listeners.
    var originalWrite = securePair.cleartext.write; // Overload write.
    securePair.cleartext.on('data', function(data) {
      self.emit('response', data);
    });
    securePair.cleartext.write = function(data) {
      self.emit('request', data);
      return originalWrite.apply(securePair.cleartext, arguments);
    };

    // Add event listeners.
    securePair.on('secure', function() {
      multiplex = new MultiplexStream();
      multiplex.pipe(securePair.cleartext).pipe(multiplex);

      server.removeListener('connection', onConnectionWhileWaitingForClient);
      server.on('connection', onConnectionAfterClientAuthenticated);

      var disconnected = false;
      function disconnect() {
        if (!disconnected) {
          disconnected = true;
          server.removeListener('connection', onConnectionAfterClientAuthenticated);
          server.on('connection', onConnectionWhileWaitingForClient);
          self.emit('disconnected');
        }
      }
      socket.on('close', function() {
        disconnect();
      });
      socket.on('end', function() {
        disconnect();
        socket.end();
      });
      self.emit('connected');
    });
    socket.pipe(securePair.encrypted).pipe(socket);
  });

  function onConnectionWhileWaitingForClient(connection) {
    httpServer.emit('connection', connection);
  }
  server.on('connection', onConnectionWhileWaitingForClient);

  // Listen method.
  self.listen = function(port, callback) {
    if (callback) {
      self.once('listening', callback);
    }
    server.on('listening', function() {
      self.emit('listening');
    });
    server.on('error', function(error) {
      self.emit('error', error);
    });
    server.listen(port);
  };

  // Close method.
  self.close = function(callback) {
    connections.forEach(function(connection) {
      connection.end();
    });
    if (callback) {
      self.once('close', callback);
    }
    server.on('close', function() {
      self.emit('close');
    });
    server.close();
  };
}
util.inherits(Server, EventEmitter);

// Exports.
module.exports = Server;