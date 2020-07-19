const d3 = require('d3')
const AWS = require('aws-sdk');
const Papa = require('papaparse');
require('dotenv').config();


// Function to upload a file to our AWS S3 bucket
const uploadToAws = function (file, docTitle) {

    updateStatus(`uploading ${state.title} to AWS`)

    // Environment variables
    const bucket = process.env.BUCKET_NAME;
    const bucketRegion = process.env.BUCKET_REGION;
    const identityPoolId = process.env.IDENTITY_POOL_ID;

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
                updateStatus(`${state.title} was not uploaded. ${err}`)
        }
        updateStatus(`${state.title} uploaded successfully to ${data.Location}`);
    });

}



const random = Math.floor(Math.random() * Math.floor(1000))

let state = {
    data: null,
    csv: null,
    fileList: null,
    title: "test" + random.toString() + ".csv"
}

const formatTime = d3.timeFormat("%X");

function updateStatus(newStatus) {
    d3.select(".status")
        .append("div")
        .html(`${newStatus} <b style='color:gray;'> | ${formatTime(Date.now())} </b>` + "<br><br>")
}
updateStatus(`'${state.title}' set as random file name`)


const inputElement = document.getElementById("fileUpload");
inputElement.addEventListener("change", viewFile, false);


function viewFile() {

    updateStatus(`File ${state.title} chosen`)
    state.fileList = this.files;

    Papa.parse(state.fileList[0], {
        dynamicTyping: true,
        header: true,
        complete: function (results) {
            state.data = results.data;
            state.csv = Papa.unparse(results.data);
            updateStatus(`${state.title} parsed`)
        }
    });
}

const uploadElement = d3
    .select("#fileSubmit")
    .on("click", function () {
        updateStatus(`${state.title} submitting`)
        uploadToAws(state.csv, state.title);
    });