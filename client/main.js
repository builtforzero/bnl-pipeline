require('dotenv').config();
const d3 = require('d3')
const AWS = require('aws-sdk');
const Papa = require('papaparse');

const formatTime = d3.timeFormat("%X");
const formatDate = d3.timeFormat("%Y%m%d");
const parseDate = d3.timeParse("%Y-%m-%d")

let state = {
    community: "Select a Community",
    date: formatDate(Date.now()),
    data: null,
    csv: null,
    fileList: null,
    fields: null,
    title: null,
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

/* STATUS UPDATE FUNCTION */


function updateStatus(location, newStatus) {
    d3.select(location)
        .append("div")
        .html(`<br>${newStatus} <b style='color:gray;'> | ${formatTime(Date.now())} </b>` + "<br>")
}

function overwriteStatus(location, newStatus) {
    d3.select(location)
        .html(`<br>${newStatus} <b style='color:gray;'> | ${formatTime(Date.now())} </b>` + "<br>")
}


/* FORM FIELD EVENT LISTENERS */
function updateState() {

    // Event listener on community name field
    let communityInput = d3
        .select("#community-dropdown")
        .on("change", function () {
            state.community = this.value.replace(/[^A-Z0-9]/ig, "");
            state.title = state.community + state.date + ".csv";
            overwriteStatus(".file-name-status", `File name set: <b>${state.title}</b>`);
            console.log(state);
        })

    // Event listener on reported date field
    let dateInput = d3
        .select("#date-input")
        .on("change", function () {
            state.date = formatDate(parseDate(this.value));;
            state.title = state.community + state.date + ".csv";
            overwriteStatus(".file-name-status", `File name set: <b>${state.title}</b>`);
            console.log(state);
        })

}

updateState();

/* ON UPLOAD TRIGGER */
const inputElement = document.getElementById("fileUpload");
inputElement.addEventListener("change", getFile, false);

/* GET FILE FROM FILE PICKER AND PULL OUT TESTING DATA */
function getFile() {

    updateStatus(".upload-status", `File chosen`)
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
            updateStatus(".upload-status", `File parsed`);
        }
    });
}

/* RUN TESTS */
function runTests() {
    testHeaders(test.headers.raw);
    testLengthOfFile(test.length.raw);
}

/* TEST #1: HEADERS */
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

    function checkAvailability(arr, val) {
        return arr.some(function (arrVal) {
            return val === arrVal;
        });
    }

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

/* TEST #2: FILE LENGTH */
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



/* UPLOAD FILE */

/* UPLOAD FILE TO AWS S3 BUCKET */
const uploadToAws = function (file, docTitle) {

    updateStatus(".upload-status", `Uploading file to AWS`)

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
                updateStatus(".upload-status", `File was not uploaded. ${err}`)
        }
        updateStatus(".upload-status", `File uploaded successfully to ${data.Location}`);
    });

}

const uploadElement = d3
    .select("#fileSubmit")
    .on("click", function () {
        updateStatus(".upload-status", `File submitting`)
        uploadToAws(state.csv, state.title);
    });