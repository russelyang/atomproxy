var cluster = require('cluster');
var numCPUs = require('os').cpus.length;

if (cluster.isMaster) {
	for(var i=0; i<numCPUs; i++) {
		cluster.fork();
	}
	cluster.on( 'online', function( worker ) {
    console.log( 'Worker ' + worker.process.pid + ' is online.' );
  });
  cluster.on( 'exit', function( worker, code, signal ) {
    console.log( 'worker ' + worker.process.pid + ' died.' );
  });
} else {
	var express = require('express');
	var app = express();
	var fetch = require('node-fetch');
	var https = require('https');
	var fs = require('fs');
	var privateKey  = fs.readFileSync('sslcert/key.pem', 'utf8');
	var certificate = fs.readFileSync('sslcert/cert.pem', 'utf8');
	var credentials = {key: privateKey, cert: certificate};

	var allowCrossDomain = function(req, res, next) {
	    res.header('access-control-allow-origin', '*');
	    res.header('access-control-allow-credentials', 'true');
	    res.header('access-control-allow-methods', 'GET,OPTIONS');
	    res.header('access-control-allow-headers', 'accept,authToken,X-Forwarded-For,X-Origin-Platform,locale,MultiplayerId,Origin-ClientIp,Content-Type,Origin');
	    // intercept OPTIONS method
	    if ('OPTIONS' == req.method) {
	      res.sendStatus(200);
	    }
	    else {
	      next();
	    }
	};


	app.use(allowCrossDomain);

	if (!String.prototype.format) {
	    String.prototype.format = function() {
	        var str = this.toString();
	        if (!arguments.length)
	            return str;
	        var args = typeof arguments[0],
	            args = (("string" == args || "number" == args) ? arguments : arguments[0]);
	        for (arg in args)
	            str = str.replace(RegExp("\\{" + arg + "\\}", "gi"), args[arg]);
	        return str;
	    }
	}

	function toJson(xml) {
		return new Promise(function(resolve, rejecct) {
			var parseString = require('xml2js').parseString; 
			parseString(xml, function(err, result) {
				if (!err) {
					resolve(result);
				} else {
					rejecct(err);
				}
			});
		});
	}

	function toXml(json) {
		return new Promise(function(resolve, rejecct) {
			var xml2js = require('xml2js');
			var builder = new xml2js.Builder({renderOpts: {pretty : false}});
			var xml = builder.buildObject(json);
			resolve(xml);
		});	
	}

	function buildFetchPromise(datapoint, userId, friendIds, authToken) {
		return fetch("{0}/atom/users/{1}/commonGames?friendIds={2}".format( 
			datapoint, 
			userId, 
			friendIds.join(",")), 
			{
				headers: {
					"authToken" : authToken
				}
			}).then(function(body) {
			return body.text();
		}).then( xml => toJson(xml));
	}

	var datapoint = ["https://integration.api1.origin.com",
					 "https://integration.api2.origin.com",
					 "https://integration.api3.origin.com",
					 "https://integration.api4.origin.com"];

	app.get('/atom/users/:userId/commonGames', function (req, res) {
		var userId = req.params.userId;
		var friendIds = req.query.friendIds.split(",");
		var authToken = req.get("authToken");

		res.set("content-type", "text/xml; charset=UTF-8");

		var promises = [],
			batch = 0;
			fids = [];

		for(var i=0; i< friendIds.length; i++) {
			if (fids.length < 5) {
				fids.push(friendIds[i]);
			} 
			if (fids.length == 5) {
				console.log(datapoint[batch]);
				var fp = buildFetchPromise(datapoint[batch], userId, fids, authToken);
				promises.push(fp);
				batch++;
				if (batch == 4) {
					batch = 0;
				}
				fids = [];
			}
		}

		//console.log(promises);

		Promise.all(promises).then(function(jsons) {
			var output = {
				users: {
					user : []
				}
			};

			var error = null;
			jsons.forEach(json => {
				if (json.users.user) {
					json.users.user.forEach(ele => output.users.user.push(ele));
				} else {
					error = json
				}
			});
			return error !== null ? toXml(error) : toXml(output);
		}).then(xml => res.send(xml));
		//console.log(friendIds);
		///Promise.all(promises).then(all => console.log(all));
		
	//	buildFetchPromise(datapoint[0], userId, friendIds, authToken)
	//		.then(json => toXml(json)).then(xml => res.send(xml));


	  	//res.send('Hello World!' + userId + 'friendIds: ' + friendIds + "authToken: " + authToken );
	});

	var httpsServer = https.createServer(credentials, app);

	httpsServer.listen(3000, function () {
	  console.log('atom proxy app listening on port 3000!');
	});	
}


