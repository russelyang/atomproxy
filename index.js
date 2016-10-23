var express = require('express');
var app = express();

var fetch = require('node-fetch');

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

var datapoint = ["https://integration.api4.origin.com"];

app.get('/atom/users/:userId/commonGames', function (req, res) {
	var userId = req.params.userId;
	var friendIds = req.query.friendIds.split(",");
	var authToken = req.get("authToken");

	//console.log(friendIds);

	fetch("{0}/atom/users/{1}/commonGames?friendIds={2}".format( 
		datapoint[0], 
		userId, 
		friendIds.join(",")), 
		{
			headers: {
				"authToken" : authToken
			}
		})
	.then(function(body) {
		return body.text();
	}).then(body => res.send(body));

  	//res.send('Hello World!' + userId + 'friendIds: ' + friendIds + "authToken: " + authToken );
});

app.listen(3000, function () {
  console.log('atom proxy app listening on port 3000!');
});

