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

let test = {
    headers: {
        name: "Does your file contain no headers with PII?",
        raw: [],
        testCondition: ["ssn", "name", "age"],
        status: null,
        failText: `FAIL: Please check your column headers and try again. Headers should not contain personally-identifiable information.`,
        passText: `PASS: Your headers do not contain personally-identifiable information.`,
    },
    length: {
        name: "Does your file contain at least two rows of data?",
        raw: [],
        testCondition: 2,
        status: null,
        failText: `FAIL: failtext.`,
        passText: `PASS: passtext`,
    },
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
        .html(`<br>${newStatus} <b style='color:gray;'> | ${formatTime(Date.now())} </b>` + "<br>")
}

updateStatus(".upload-status", `'${state.title}' set as random file name`)
updateStatus(".upload-status", `'${state.title}' not yet clean`)


/* ON UPLOAD TRIGGER */
const inputElement = document.getElementById("fileUpload");
inputElement.addEventListener("change", getFile, false);


/* GET FILE FROM FILE PICKER AND PULL OUT TESTING DATA */
function getFile() {

    updateStatus(".upload-status", `File ${state.title} chosen`)
    state.fileList = this.files;

    Papa.parse(state.fileList[0], {
        dynamicTyping: true,
        header: true,
        complete: function (results) {
            state.data = results.data;
            state.csv = Papa.unparse(results.data);
            test.headers.raw = results.meta.fields;
            test.length.raw = state.data.length;
            runTests();
            updateStatus(".upload-status", `${state.title} parsed`);
        }
    });
}

function runTests() {
    testHeaders(test.headers.raw);
    testLengthOfFile(test.length.raw);
}


function checkAvailability(arr, val) {
    return arr.some(function (arrVal) {
        return val === arrVal;
    });
}


/* TEST: HEADERS */
function testHeaders(rawTestData) {

    // Define variables for use with tests
    const cleanTestData = [];
    const failState = test.headers.testCondition;
    const testName = test.headers.name;
    const passedTest = [];
    const failedTest = [];
    const passText = test.headers.passText;
    const failText = test.headers.failText;

    // Update cleaning status with test in progress
    updateStatus(".test-status", `<b style='font-size: 20px;'>${testName}</b>`);

    // Clean raw data for testing
    rawTestData.forEach(element => {
        cleanTestData.push(element.replace(/[^A-Z0-9]/ig, " ").toLowerCase())
    });

    // Apply test function to sort input data into pass and fail
    cleanTestData.forEach(header => {
        if (checkAvailability(failState, header)) {
            failedTest.push(header);
        } else {
            passedTest.push(header);
        }
    });

    // Check length of failed output data
    if (failedTest.length > 0) {
        updateStatus(".test-status", `<b style='color:red;'> ✖ ${failText}</b>`);
        test.headers.status = "fail";
        return false;
    } else {
        updateStatus(".test-status", `<b style='color:green;'> ✓ ${passText}</b>`);
        test.headers.status = "pass";
        return true;
    }
}


/* TEST: FILE LENGTH */
function testLengthOfFile(rawTestData) {

    // Define variables for use with tests
    const failState = test.length.testCondition;
    const testName = test.length.name;
    const passText = test.length.passText;
    const failText = test.length.failText;

    // Update cleaning status with test in progress
    updateStatus(".test-status", `<b style='font-size: 20px;'>${testName}</b>`);

    // Apply test function
    if (rawTestData < failState) {
        updateStatus(".test-status", `<b style='color:red;'> ✖ Your file contains ${rawTestData} row(s) of data. ${failText}</b>`);
        test.headers.status = "fail";
        return false;
    } else {
        updateStatus(".test-status", `<b style='color:green;'> ✓ Your file contains ${rawTestData} row(s) of data. ${passText}</b>`);
        test.headers.status = "pass";
        return true;
    }
}


const uploadElement = d3
    .select("#fileSubmit")
    .on("click", function () {
        updateStatus(".upload-status", `${state.title} submitting`)
        uploadToAws(state.csv, state.title);
    });