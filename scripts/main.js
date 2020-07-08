const random = Math.floor(Math.random() * Math.floor(100))

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
        .html(`${newStatus} <b style='color:gray;'>${formatTime(Date.now())} </b>` + "<br><br>")
}

import {
    keys
} from "../env/config.js";

const bucketName = keys.BUCKET_NAME
const bucketRegion = keys.BUCKET_REGION
const identityPoolId = keys.IDENTITY_POOL_ID

AWS.config.region = bucketRegion;
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: identityPoolId,
});

const s3 = new AWS.S3({
    apiVersion: '2006-03-01',
    params: {
        Bucket: bucketName
    }
});

updateStatus(`'${state.title}' set as random file name`)

function uploadToAWS(file, docTitle, bucketName) {
    updateStatus(`uploading ${state.title} to AWS`)

    // Set up S3 upload parameters
    const params = {
        Bucket: bucketName,
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
        uploadToAWS(state.csv, state.title, bucketName);
    });