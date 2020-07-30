require('dotenv').config();
const d3 = require('d3')
const AWS = require('aws-sdk');
const Papa = require('papaparse');

const random = Math.floor(Math.random() * Math.floor(1000))

let state = {
    data: null,
    csv: null,
    fileList: null,
    fields: null,
    fail: {
        fields: ["ssn", "name", "age"]
    },
    check: {
        headers: false,
        text: false,
    },
    title: "test" + random.toString() + ".csv"
}


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



/* STATUS UPDATE FUNCTION */
const formatTime = d3.timeFormat("%X");

function updateStatus(location, newStatus) {
    d3.select(location)
        .append("div")
        .html(`${newStatus} <b style='color:gray;'> | ${formatTime(Date.now())} </b>` + "<br><br>")
}

updateStatus(".upload-status", `'${state.title}' set as random file name`)
updateStatus(".clean-status", `'${state.title}' not yet clean`)


/* ON UPLOAD TRIGGER */
const inputElement = document.getElementById("fileUpload");
inputElement.addEventListener("change", getFile, false);


/* GET FILE FROM FILE PICKER */
function getFile() {

    updateStatus(".upload-status", `File ${state.title} chosen`)
    state.fileList = this.files;

    Papa.parse(state.fileList[0], {
        dynamicTyping: true,
        header: true,
        complete: function (results) {
            state.data = results.data;
            state.csv = Papa.unparse(results.data);
            state.fields = results.meta.fields;
            updateStatus(".upload-status", `${state.title} parsed`);
            parseHeaders(state.data, state.csv, state.fields)
        }
    });
}


function parseHeaders(data, csv, fields) {
    updateStatus(".clean-status", `Checking headers for '${state.title}'`);

    parsedFields = [];
    failedFields = [];

    fields.forEach(element => {
        parsedFields.push(element.replace(/[^A-Z0-9]/ig, " ").toLowerCase())
    });

    updateStatus(".clean-status", `<b>File Headers:</b> '${parsedFields}'`);

    parsedFields.forEach(element => {
        if (checkHeaders(state.fail.fields, element)) {
            failedFields.push(element);
            updateStatus(".clean-status", `&nbsp&nbsp${element} : <b style='color:red;'>failed<b>`)
        } else {
            updateStatus(".clean-status", `&nbsp&nbsp${element} : <b style='color:green;'>passed</b>`)
        }
    });

    updateStatus(".clean-status", `<b>These fields did not pass:</b> '${failedFields}'`);

    if (failedFields.length > 0) {
        state.check.headers = false;
        updateStatus(".test-status", `<b>Headers do not contain the fields ${state.fail.fields}:</b> <b style='color:red;'>TEST FAIL</b>`);
    } else {
        state.check.headers = true;
        updateStatus(".test-status", `<b>Headers do not contain the fields ${state.fail.fields}:</b> <b style='color:green;'>TEST PASS</b>`);
    }
}

function checkHeaders(arr, val) {
    return arr.some(function (arrVal) {
        return val === arrVal;
    });
}



const uploadElement = d3
    .select("#fileSubmit")
    .on("click", function () {
        updateStatus(".upload-status", `${state.title} submitting`)
        uploadToAws(state.csv, state.title);
    });