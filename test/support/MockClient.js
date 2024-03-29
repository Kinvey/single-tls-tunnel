// Strict mode.
'use strict';

// Standard lib.
var crypto = require('crypto'),
    EventEmitter = require('events').EventEmitter,
    http = require('http'),
    tls  = require('tls'),
    util = require('util');

// Package modules.
var MultiplexStream = require('multiplex-stream');

// Configure (Node.js >=0.12 uses `tls`, <0.12 `crypto`).
var createSecureContext = tls.createSecureContext || crypto.createCredentials;

function MockClient(options) {
  var self = this,
      connection,
      socket;

  self.connect = function(callback){
    var request = http.request({
      port: options.port,
      headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'TLS'
      }
    });
    request.on('upgrade', function(res, sock/*, upgradeHead*/) {
      socket = sock;
      var securePair = tls.createSecurePair(
        createSecureContext({
          key: options.key,
          cert: options.cert,
          ca: options.ca
       }),
       false,
       true,
       options.rejectUnauthorized
      );
      connection = securePair.cleartext;

      socket.pipe(securePair.encrypted).pipe(socket);

      securePair.on('secure', function() {
        self.multiplex = new MultiplexStream();
        connection.pipe(self.multiplex).pipe(connection);
        callback();
      });
    });
    request.end();
  };

  self.end = function() {
    connection.on('end', function() {
      self.emit('end');
    });
    connection.end();
  };

  self.destroy = function() {
    socket.destroy();
  };
}
util.inherits(MockClient, EventEmitter);

module.exports = MockClient;
