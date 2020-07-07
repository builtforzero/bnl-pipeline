/* How to run this file
    1. Navigate to the 'scripts' folder
    2. In the terminal, run 'watchify main.js -o bundle.js -v'
    3. Click on live server in VSCode
*/


var config = require('../env/config.js')
var AWS = require("aws-sdk")

var keyId = config.config.AWS_KEY_ID
var accessKey = config.config.AWS_ACCESS_KEY

console.log("Why?")
