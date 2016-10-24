var cluster = require( 'cluster' );
var express = require( 'express' );
var path    = require( 'path' );

var port    = 3000;
var root    = path.dirname( __dirname );
var cCPUs   = require('os').cpus().length;

if( cluster.isMaster ) {
  // Create a worker for each CPU
  for( var i = 0; i < cCPUs; i++ ) {
    cluster.fork();
  }

  cluster.on( 'online', function( worker ) {
    console.log( 'Worker ' + worker.process.pid + ' is online.' );
  });
  cluster.on( 'exit', function( worker, code, signal ) {
    console.log( 'worker ' + worker.process.pid + ' died.' );
  });
}
else {
  var app    = express();
  var routes = require( './routes' )( app );

  app
    .use( express.bodyParser() )
    .listen( port );
}