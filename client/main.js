require('dotenv').config();
const d3 = require('d3')
const Papa = require('papaparse');
const Validator = require('validatorjs');
const stringSimilarity = require('string-similarity');

// Import engines
import {
    ValidatorEngine
} from "./validator.js"

import {
    AggregatorEngine
} from "./aggregator.js";

let val, agg;


// Global state
let state = {
    // Environment variables
    bucket: process.env.BUCKET_NAME,
    bucketRegion: process.env.BUCKET_REGION,
    identityPoolId: process.env.IDENTITY_POOL_ID,

    // Form fields
    community: "na",
    email: "na",
    name: "na",
    reportingDate: "na",
    timestamp: "na",

    // File processing
    fileList: "na",
    fileTitle: "na",
    fileDate: "na",

    // Data
    raw: null,
    clean: null,
    output: null,
}


// Dictionary of fuzzy-matching fields
let dictionary = {
    headers: ["date of identification date added to list", "homeless start date", "housing move in date", "inactive date", "returned to active date", "age", "client id", "household id", "bnl status", "literal homeless status", "household type", "chronic status", "veteran status", "ethnicity", "race", "gender", "current living situation", "disabling condition general", "disabling condition hiv aids diagnosis", "disabling condition mental health condition", "disabling condition physical disability", "disabling condition da abuse"],
    bnlStatus: ["active", "inactive", "housed"],
    literalStatus: ["literally homeless", "not literally homeless"],
    householdType: ["single adult / individual", "family", "youth"],
    chronicStatus: ["chronic", "not chronic", "na"],
    veteranStatus: ["yes", "yes validated", "no", "unconfirmed", "na"],
    ethnicity: ["hispanic", "nonhispanic", "client doesnt know", "data not collected", "na", "unknown"],
    race: ["american indian or alaska native", "asian", "black or african american", "native hawaiian or other pacific islander", "white", "multi racial", "client doesnt know", "data not collected", "na", "unknown"],
    gender: ["female", "male", "trans female", "trans male", "client doesnt know", "data not collected", "na", "unknown"],
    currentSituation: ["not literally homeless", "outdoors", "safe haven", "shelters", "transitional housing", "client doesnt know", "data not collected", "na", "unknown"],
    disGeneral: ["yes", "no", "client doesnt know", "data not collected", "na", "unknown"],
    disHiv: ["yes", "no", "client doesnt know", "data not collected", "na", "unknown"],
    disMental: ["yes", "no", "client doesnt know", "data not collected", "na", "unknown"],
    disPhysical: ["yes", "no", "client doesnt know", "data not collected", "na", "unknown"],
    disDaAbuse: ["yes", "no", "client doesnt know", "data not collected", "na", "unknown"],
}


// Rules for Validator.js
let rules = {
    'Date of Identification / Date Added to List': 'date|required',
    'Homeless Start Date': 'date|required',
    dateMoveIn: 'date|required',
    dateInactive: 'date|required',
    dateReturned: 'date|required',
    age: 'required|integer',
    clientId: 'required',
    householdId: 'present',
    bnlStatus: 'required',
    literalStatus: 'present',
    householdType: 'required',
    chronicStatus: 'required',
    veteranStatus: 'required',
    ethnicity: 'required',
    race: 'required',
    gender: 'required',
    currentSituation: 'present',
    disGeneral: 'present',
    disHiv: 'present',
    disMental: 'present',
    disPhysical: 'present',
    disDaAbuse: 'present',
}

// Custom error messages for Validator.jss
let customErrorMessages = {
    "headers.not_in": "The file cannot contain personally-identifiable information (PII) like name, birthday, and SSN.",
    "headers.required": "The file requires a header row.",
}

let metadata = {
    headers: [],
    length: null,
}

// Parsed data file in column format
let input = {
    // Backend
    community: [],
    email: [],
    name: [],
    reportingDate: [],
    timestamp: [],
    subpop: [], // Calculated in validation step

    // Date & numeric fields
    dateAdded: [],
    dateHomeless: [],
    dateMoveIn: [],
    dateInactive: [],
    dateReturned: [],
    age: [],
    clientId: [],
    householdId: [],

    // Picklists
    bnlStatus: [],
    literalStatus: [],
    householdType: [],
    chronicStatus: [],
    veteranStatus: [],
    ethnicity: [],
    race: [],
    gender: [],
    currentSituation: [],
    disGeneral: [],
    disHiv: [],
    disMental: [],
    disPhysical: [],
    disDaAbuse: [],

    // Fuzzy-matched fields
    bnlStatus_matched: [],
    literalStatus_matched: [],
    householdType_matched: [],
    chronicStatus_matched: [],
    veteranStatus_matched: [],
    ethnicity_matched: [],
    race_matched: [],
    gender_matched: [],
    currentSituation_matched: [],
    disGeneral_matched: [],
    disHiv_matched: [],
    disMental_matched: [],
    disPhysical_matched: [],
    disDaAbuse_matched: [],
    test_matched: [],
}

console.log(input)


/* GLOBAL HELPER FUNCTIONS */
const formatTime = d3.timeFormat("%X");
const formatReportingDate = d3.timeFormat("%Y-%m-%d");
const formatTimestamp = d3.timeFormat("%Y-%m-%d %X");
const formatFileDate = d3.timeFormat("%Y%m%d");
const parseDate = d3.timeParse("%Y-%m-%d")

function printMessage(location, className, message) {
    d3.select(location)
        .append("div")
        .html(`<br><b class='${className}'>${message}</b> <b style='color:gray;'> | ${formatTime(Date.now())} </b>` + "<br>")
}

function overwriteStatus(location, className, message) {
    d3.select(location)
        .html(`<br><b class='${className}'>${message}</b> <b style='color:gray;'> | ${formatTime(Date.now())} </b>` + "<br>")
}



/* INITIALIZE APP */

function init() {
    val = new ValidatorEngine(state, dictionary, rules, input, metadata, customErrorMessages);
    printMessage(".success-status", "success", "Validator engine starting");
    agg = new AggregatorEngine(state, dictionary, rules, input, metadata, customErrorMessages);
    printMessage(".success-status", "success", "Aggregator engine starting");

}


/* FORM FIELD EVENT LISTENERS */

// Event listener on community name field
let communityInput = d3
    .select("#community-dropdown")
    .on("change", function () {
        state.timestamp = formatTimestamp(Date.now());
        state.community = this.value.replace(/[^A-Z0-9]/ig, "");
        state.fileTitle = state.community + state.fileDate + ".csv";
        overwriteStatus(".file-name-status", "neutral", `File name set: <b>${state.title}</b>`);
        updateBackendFields(input, metadata, state);
    })

// Event listener on reported date field
let dateInput = d3
    .select("#date-input")
    .on("change", function () {
        state.timestamp = formatTimestamp(Date.now());
        state.reportingDate = formatReportingDate(parseDate(this.value));
        state.fileDate = formatFileDate(parseDate(this.value));
        state.fileTitle = state.community + state.fileDate + ".csv";
        overwriteStatus(".file-name-status", "neutral", `File name set: <b>${state.title}</b>`);
        updateBackendFields(input, metadata, state);
    })

// Event listener on submit button
let uploadElement = d3
    .select("#fileSubmit")
    .on("click", function () {
        state.timestamp = formatTimestamp(Date.now());
        updateBackendFields(input, metadata, state);
        uploadToAws(state.output, state.fileTitle);
    });

let inputElement = document.getElementById("fileUpload");
inputElement.addEventListener("change", getFile, false);




/* Get file from file picker and call metadata function */
function getFile() {

    printMessage(".upload-status", "neutral", `File chosen`)
    state.fileList = this.files;

    Papa.parse(state.fileList[0], {
        dynamicTyping: true,
        header: true,
        complete: function (results) {
            addMetadata(results.data, results.meta);
        },
    });
}

function addMetadata(data, meta) {
    state.raw = data;
    metadata.headers = meta.fields;
    metadata.length = data.length;
    console.log("adding metadata", metadata)
    updateBackendFields(input, metadata, state);
    val.checkHeaders(state, metadata, dictionary);

    console.log("Post-match", state.raw)

    /* let validation = new Validator(state.raw, rules, customErrorMessages)
    let errorMessages = validation.errors.all()
    console.log(validation)
    console.log(errorMessages)
    console.log(validation.errors.errorCount)

    printMessage(".upload-status", "neutral", `Errors: ${validation.errors.errorCount} errors found.`)
    printMessage(".upload-status", "neutral", `Passed validation? ${validation.passes()}`) */

    /*     for (let i = 0; i < metadata.headers.length; i++) {
            printMessage(".error-status", "fail", errorMessages[i])
        } */

}

function updateBackendFields(input, metadata, state) {
    // Clear out all backend data
    input.community = [];
    input.email = [];
    input.name = [];
    input.reportingDate = [];
    input.timestamp = [];

    // Append backend fields to each row of data
    for (let row = 0; row < metadata.length; row++) {
        input.community.push(state.community);
        input.email.push(state.email);
        input.name.push(state.name);
        input.reportingDate.push(state.reportingDate);
        input.timestamp.push(state.timestamp);
    }

    // Update the final CSV file
    state.output = Papa.unparse([input])

    console.log("input", input)
    console.log("output", state.output)
}

init();