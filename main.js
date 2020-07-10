const d3 = require('d3');
const express = require('express');
const Papa = require('papaparse');
const AWS = require('aws-sdk')

const {
    JSDOM
} = require("jsdom");
const {
    window
} = new JSDOM("");
const $ = require("jquery")(window);

const app = express();
app.listen(3000, () => console.log('listening at 3000'))
app.use(express.static('public'));

require('dotenv').config();
console.log(process.env);

const bucketName = process.env.BUCKET_NAME;
const bucketRegion = process.env.BUCKET_REGION;
const identityPoolId = process.env.IDENTITY_POOL_ID;