var fs = require('fs');

var Hapi = require('hapi');
var Hoek = require('hoek');

// Initialize the environment before anything else happens
require('./lib/environment');

Hoek.assert(process.env.API_HOST, 'Must define API_HOST');
Hoek.assert(process.env.PORT, 'Must define PORT');

var connection = {
  host: process.env.API_HOST,
  port: process.env.PORT
};

var server = new Hapi.Server();
server.connection(connection);

server.register({
  register: require('hapi-bunyan'),
  options: {
    logger: require('./lib/logger')
  }
}, function(err) {
  Hoek.assert(!err, err);
});

server.register(require('./adaptors/plugins'), function(err) {
  if (err) {
    server.log('error', {
      message: 'Error registering plugins',
      error: err
    });
    throw err;
  }

  server.auth.strategy(
    'token',
    'bearer-access-token',
    true,
    require('./lib/auth-config')(require('./lib/tokenValidator'))
  );
});

server.register({ register: require('./api') }, function(err) {
  if (err) {
    server.log('error', {
      message: 'Error registering api',
      error: err
    });
    throw err;
  }

  server.ext('onPreResponse', function(req, reply) {
    if (req.response.isBoom) {
      return reply.continue();
    }

    // Once a successful request completes, we delete any
    // temporary files we created
    req.response.once('finish', function() {
      if (req.app.tmpFile) {
        fs.unlink(req.app.tmpFile, function(err) {
          if (err) {
            throw 'Failed to destroy temporary file with ' + err;
          }
        });
      }
    });

    reply.continue();
  });

  server.start(function(err) {
    if (err) {
      server.log('error', {
        message: 'Error starting server',
        error: err
      });
      throw err;
    }

    server.log('info', { server: server.info }, 'Server started');
  });
});
