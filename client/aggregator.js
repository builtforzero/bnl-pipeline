class AggregatorEngine {

    constructor(state, dictionary, rules, input, meta, customErrorMessages) {
        console.log("aggregator engine starting");
        require('dotenv').config();
        const d3 = require('d3')
        const AWS = require('aws-sdk');
        const Papa = require('papaparse');
        const Validator = require('validatorjs');
        const levenary = require('levenary');
    }


    /* HELPER FUNCTIONS */



    /* AGGREGATOR FUNCTIONS */



    /* UPLOAD FUNCTIONS */

    // Upload a file to AWS
    uploadToAws(state, dictionary, file, docTitle) {

        this.updateStatus(".upload-status", `Uploading file to AWS`)

        // Environment variables
        const bucket = state.bucket;
        const bucketRegion = state.bucketRegion;
        const identityPoolId = state.identityPoolId;

        // Config AWS
        AWS.config.region = bucketRegion;
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: identityPoolId,
        });

        // New S3 instance
        const s3 = new AWS.S3({
            apiVersion: '2006-03-01',
            params: {
                Bucket: bucket
            }
        });

        // Set up S3 upload parameters
        const params = {
            Bucket: bucket,
            Key: docTitle, // File name you want to save as in S3
            Body: file,
        };

        // Upload files to the bucket
        s3.upload(params, function (err, data) {
            if (err) {
                throw err,
                    updateStatus(".upload-status", `File was not uploaded. ${err}`)
            }
            updateStatus(".upload-status", `File uploaded successfully to ${data.Location}`);
        });

    }

};

export {
    AggregatorEngine
};