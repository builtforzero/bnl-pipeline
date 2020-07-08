let state = {
    data: null,
    csv: null,
}

import {
    keys
} from "../env/config.js";

const bucketName = keys.BUCKET_NAME
const bucketRegion = keys.BUCKET_REGION
const identityPoolId = keys.IDENTITY_POOL_ID

AWS.config.region = bucketRegion; 
AWS.config.credentials = new AWS.CognitoIdentityCredentials({IdentityPoolId: identityPoolId});

const s3 = new AWS.S3({
    apiVersion: '2016-06-10',
    params: {
        Bucket: bucketName
    }
});

function uploadToAWS(file, docTitle, bucketName) {
    console.log("uploading to AWS")
    
    // Read content from the file
    /* const fileContent = fs.readFileSync(file); */

    // Set up S3 upload parameters
    const params = {
        Bucket: bucketName,
        Key: docTitle, // File name you want to save as in S3
        Body: file,
    };

    // Upload files to the bucket
    s3.upload(params, function(err, data) {
        if (err) {
            throw err;
        }
        console.log(`File uploaded successfully. ${data.Location}`);
    });
}


const inputElement = document.getElementById("fileUpload");
inputElement.addEventListener("change", handleFile, false);


function handleFile() {
    console.log("handling file")

    const fileList = this.files;

    Papa.parse(fileList[0], {
        dynamicTyping: true,
        header: true,
        complete: function(results) {
            state.data = results.data;
            state.csv = Papa.unparse(results.data);
            console.log(state);
        }
    });

    uploadToAWS(state.csv, "testFile.csv", bucketName);

}