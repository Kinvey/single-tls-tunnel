// Strict mode.
'use strict';

// Standard lib.
var crypto = require('crypto'),
    EventEmitter = require('events').EventEmitter,
    http = require('http'),
    net  = require('net'),
    tls  = require('tls'),
    util = require('util');

// Package modules.
var MultiplexStream = require('multiplex-stream'),
    Valve = require('pipette').Valve;

// Configure (Node.js >=0.12 uses `tls`, <0.12 `crypto`).
var createSecureContext = tls.createSecureContext || crypto.createCredentials;

// Define the client.
function Client(upstreamOptions, downstreamOptions) {
  var self = this,
      connection;

  self.connect = function(callback) {
    var options = {
      host: upstreamOptions.host,
      port: upstreamOptions.port,
      headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket'
      }
    };

    var request = http.request(options);
    request.on('error', function(error) {
      self.emit('error', error);
    });
    request.on('upgrade', function(res, socket/*, upgradeHead*/) {
      var securePair = tls.createSecurePair(
       createSecureContext({
         key: upstreamOptions.key,
         cert: upstreamOptions.cert,
         ca: upstreamOptions.ca
       }),
       false,
       true, // TODO: check what effect requireCert might have on a client connection (it's not a valid parameter for tls.connect so probably ignored here)
       upstreamOptions.rejectUnauthorized
      );
      connection = securePair.cleartext;

      connection.on('error', function(error) {
        connection = null;
        self.emit('error', error);
      });
      connection.on('end', function() {
        connection = null;
        self.emit('end');
      });

      socket.pipe(securePair.encrypted).pipe(socket);

      securePair.on('error', function(error) {
        connection = null;
        self.emit('error', error);
      });
      securePair.on('secure', function() {
        socket.setKeepAlive(true);
        var multiplexStream = new MultiplexStream(function(upstreamConnection) {
          var valve = new Valve(upstreamConnection, {paused: true});
          var downstreamConnection = net.connect(downstreamOptions, function() {
            valve.pipe(downstreamConnection).pipe(upstreamConnection);
            valve.resume();
          });
          downstreamConnection.on('error', function(/*error*/) {
            upstreamConnection.end();
          });
        });
        connection.pipe(multiplexStream).pipe(connection);
        if (callback) {
          self.once('connect', callback);
        }
        self.emit('connect');
      });
    });
    request.end();
  };

  self.end = function() {
    connection.end();
  };
}
util.inherits(Client, EventEmitter);

// Exports.
module.exports = Client;