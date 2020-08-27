require('dotenv').config();
const d3 = require('d3')
const AWS = require('aws-sdk');
const Papa = require('papaparse');
const Validator = require('validatorjs');
const levenary = require('levenary');

// Import engines
import {
    ValidatorEngine
} from "./validator.js"

import {
    AggregatorEngine
} from "./aggregator.js";


// Global state
let state = {
    // Environment variables
    bucket: process.env.BUCKET_NAME,
    bucketRegion: process.env.BUCKET_REGION,
    identityPoolId: process.env.IDENTITY_POOL_ID,

    // Form fields
    community: null,
    email: null,
    name: null,
    reportingDate: null,
    timestamp: null,

    // File processing
    fileList: null,
    fileTitle: null,

    // Data
    raw: null,
    clean: null,
    output: null,
}


// Dictionary of fuzzy-matching fields for Levenary.js
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
    headers: [
        'required',
        {
            'not_in': ['SSN', 'Social Security Number', 'First Name', 'Last Name', 'DOB', 'Birthday', 'Date of Birth', 'Last 4']
        }
    ],
    dateAdded: 'date|required',
    dateHomeless: 'date|required',
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

// Custom error messages for Validator.js
let customErrorMessages = {
    "header.not_in": "The file cannot contain personally-identifiable information (PII) like name, birthday, and SSN.",
}

let meta = {
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

    // Upload fields
    dateAdded: [],
    dateHomeless: [],
    dateMoveIn: [],
    dateInactive: [],
    dateReturned: [],
    age: [],
    clientId: [],
    householdId: [],
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
}


/* GLOBAL HELPER FUNCTIONS */
const formatTime = d3.timeFormat("%X");
const formatDate = d3.timeFormat("%Y%m%d");
const parseDate = d3.timeParse("%Y-%m-%d")

function updateStatus(location, newStatus) {
    d3.select(location)
        .append("div")
        .html(`<br>${newStatus} <b style='color:gray;'> | ${formatTime(Date.now())} </b>` + "<br>")
}

function overwriteStatus(location, newStatus) {
    d3.select(location)
        .html(`<br>${newStatus} <b style='color:gray;'> | ${formatTime(Date.now())} </b>` + "<br>")
}



/* INITIALIZE APP */

function init() {
    val = new ValidatorEngine(state, dictionary, rules, input, meta, customErrorMessages);
    agg = new AggregatorEngine(state, dictionary, rules, input, meta, customErrorMessages);
}


/* FORM FIELD EVENT LISTENERS */

// Event listener on community name field
let communityInput = d3
    .select("#community-dropdown")
    .on("change", function () {
        state.timestamp = formatTime(Date.now());
        state.community = this.value.replace(/[^A-Z0-9]/ig, "");
        state.fileTitle = state.community + state.reportingDate + ".csv";
        overwriteStatus(".file-name-status", `File name set: <b>${state.title}</b>`);
        updateBackendFields();
        console.log(state);
    })

// Event listener on reported date field
let dateInput = d3
    .select("#date-input")
    .on("change", function () {
        state.timestamp = formatTime(Date.now());
        state.reportingDate = formatDate(parseDate(this.value));;
        state.fileTitle = state.community + state.reportingDate + ".csv";
        overwriteStatus(".file-name-status", `File name set: <b>${state.title}</b>`);
        updateBackendFields();
        console.log(state, input);
    })

// Event listener on submit button
let uploadElement = d3
    .select("#fileSubmit")
    .on("click", function () {
        state.timestamp = `${formatTime(Date.now())}`;
        updateBackendFields();
        uploadToAws(state.output, state.fileTitle);
    });

let inputElement = document.getElementById("fileUpload");
inputElement.addEventListener("change", getFile, false);




/* GET FILE FROM FILE PICKER AND PULL OUT TESTING DATA */
function getFile() {

    updateStatus(".upload-status", `File chosen`)
    state.fileList = this.files;

    Papa.parse(state.fileList[0], {
        dynamicTyping: true,
        header: true,
        complete: addMetadata(results),
    });
}

function addMetadata(data) {
    state.raw = data;
    meta.headers = data.meta.fields;
    meta.length = data.length;
}

function updateBackendFields(state, input) {
    // Clear out all backend data
    input.community = [];
    input.email = [];
    input.name = [];
    input.reportingDate = [];
    input.timestamp = [];

    // Append backend fields to each row of data
    for (let row = 0; row < input.length; row++) {
        input.community.push(state.community);
        input.email.push(state.email);
        input.name.push(state.name);
        input.reportingDate.push(state.reportingDate);
        input.timestamp.push(state.timestamp);
    }

    // Update the final CSV file
    state.output = Papa.unparse(input)
}

init();