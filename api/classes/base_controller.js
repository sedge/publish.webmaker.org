var Boom = require('boom');
var Promise = require('bluebird'); // jshint ignore:line
var Tar = require('tar-stream');
var errors = require('./errors');

// This method is used to format the response data for
// HTTP methods that modify data (e.g. POST, PUT, etc.)
// so that we only send back data that is relevant and do
// not unnecessarily serialize all the data from the database.
function defaultFormatResponse(record) {
  return record;
}

function BaseController(model)  {
  this.Model = model;
}

BaseController.prototype.formatRequestData = function(req) {
  // Abstract base method,
  // formats data for database entry
};

BaseController.prototype.formatResponseData = function(model) {
  // Base method to format data that will be sent in the response
  // By default, it returns the model as is
  return model;
};

BaseController.prototype.getOne = function(req, reply) {
  var record = this.formatResponseData(req.pre.records.models[0].toJSON());
  reply(req.generateResponse(record)
    .code(200));
};

BaseController.prototype.getAll = function(req, reply) {
  var records = req.pre.records.toJSON().map(this.formatResponseData);
  reply(req.generateResponse(records));
};

// `formatResponse` is an optional processing function that can be passed
// in to modify what is sent in the response body. If no function is
// provided, the full model for the current method is used in the response.
BaseController.prototype.update = function(req, reply, formatResponse) {
  var reqData = this.formatRequestData(req);
  formatResponse = typeof formatResponse === 'function' ? formatResponse : defaultFormatResponse;

  var result = Promise.resolve().then(function() {
    var record = req.pre.records.models[0];

    record.set(reqData);
    if (!record.hasChanged()) {
      return record;
    }

    return record
      .save(record.changed, { patch: true, method: 'update' });
  })
  .then(function (updatedState) {
    return req.generateResponse(formatResponse(updatedState).toJSON()).code(200);
  })
  .catch(errors.generateErrorResponse);

  reply(result);
};

// `formatResponse` is an optional processing function that can be passed
// in to modify what is sent in the response body. If no function is
// provided, the full model for the current method is used in the response.
BaseController.prototype.create = function(req, reply, formatResponse) {
  formatResponse = typeof formatResponse === 'function' ? formatResponse : defaultFormatResponse;

  var result = this.Model
    .forge(this.formatRequestData(req))
    .save()
    .then(function(record) {
      if (!record) {
        throw Boom.notFound(null, {
          error: 'Bookshelf error creating a resource'
        });
      }
      return req.generateResponse(formatResponse(record).toJSON())
        .code(201);
    })
    .catch(errors.generateErrorResponse);
  reply(result);
};

BaseController.prototype.delete = function(req, reply) {
  var record = req.pre.records.models[0];

  var result = Promise.resolve().then(function() {
    return record.destroy();
  })
  .then(function() {
    return req.generateResponse().code(204);
  })
  .catch(errors.generateErrorResponse);

  reply(result);
};

BaseController.prototype.getAllAsMeta = function(req, reply) {
  reply(req.generateResponse(req.pre.records.toJSON()));
};

// NOTE: creating the tarball for a project can be a lengthy process, so
// we do it in multiple turns of the event loop, so that other requests
// don't get blocked.
BaseController.prototype.getAllAsTar = function(req, reply) {
  var files = req.pre.records.models;
  var tarStream = Tar.pack();
  var model = this.Model;

  function processFile(file) {
    return model.query({
      where: {
        id: file.get('id')
      },
      columns: ['buffer']
    }).fetch().then(function(model) {
      return new Promise(function(resolve) {
        setImmediate(function() {
          tarStream.entry({ name: file.get('path') }, model.get('buffer'));
          resolve();
        });
      });
    });
  }

  setImmediate(function() {
    Promise.map(files, processFile, { concurrency: 2 })
      .then(function() { tarStream.finalize(); })
      .catch(errors.generateErrorResponse);
  });

  // Normally this type would be application/x-tar, but IE refuses to
  // decompress a gzipped stream when this is the type.
  return reply(tarStream)
    .header('Content-Type', 'application/octet-stream');
};


module.exports = BaseController;
