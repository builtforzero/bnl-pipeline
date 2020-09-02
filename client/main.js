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



let state = {

    // Metadata
    meta_timestamp: null,
    meta_community: null,
    meta_fileName_title: null,
    meta_fileName_date: null,
    meta_reportingDate: null,

    // Data
    fileList: null,
    data_raw: null,
    data_headers: null,
    data_length: null,
    data_diceCoefficient: 0.4, // How sensitive should fuzzy matching be?

    // Validation checks pass/fail
    check_headers: false,
    check_required: false,
    check_dataType: false,
    check_ssn: false,

    // Open/close HTML sections
    section_headers_open: false,
    section_required_open: false,
    section_dataType_open: false,
    section_ssn_open: false,

    // Dictionary
    dict_headers_all: [
        'Date of Identification / Date Added to List',
        'Homeless Start Date',
        'Housing Move-In Date',
        'Inactive Date',
        'Returned to Active Date',
        'Age',
        'Client ID',
        'Household ID',
        'BNL Status',
        'Literal Homeless Status',
        'Household Type',
        'Chronic Status',
        'Veteran Status',
        'Ethnicity',
        'Race',
        'Gender',
        'Current Living Situation',
        'Disabling Condition - General',
        'Disabling Condition - HIV/AIDS Diagnosis',
        'Disabling Condition - Mental Health Condition',
        'Disabling Condition - Physical Disability',
        'Disabling Condition - DA Abuse',
    ],
    dict_headers_required: [
        'Date of Identification / Date Added to List',
        'Homeless Start Date',
        'Housing Move-In Date',
        'Inactive Date',
        'Returned to Active Date',
        'Age',
        'Client ID',
        'BNL Status',
        'Household Type',
        'Chronic Status',
        'Veteran Status',
        'Ethnicity',
        'Race',
        'Gender',
    ],
}


/* INITIALIZE APP */
function init() {
    val = new ValidatorEngine(state);
    agg = new AggregatorEngine(state);
}


/* GLOBAL HELPER FUNCTIONS */
let helper = {
    // Date and time parsing
    formatTime: d3.timeFormat("%X"),
    formatReportingDate: d3.timeFormat("%Y-%m-%d"),
    formatTimestamp: d3.timeFormat("%Y-%m-%d %X"),
    formatFileDate: d3.timeFormat("%Y%m%d"),
    parseDate: d3.timeParse("%Y-%m-%d"),

    // Message printing
    printMessage: function printMessage(location, className, message) {
        d3.select(location)
            .append("div")
            .html(`<br><b class='${className}'>${message}</b> <b style='color:gray;'> | ${formatTime(Date.now())} </b>` + "<br>")
    },

    overwriteStatus: function overwriteStatus(location, className, message) {
        d3.select(location)
            .html(`<br><b class='${className}'>${message}</b> <b style='color:gray;'> | ${formatTime(Date.now())} </b>` + "<br>")
    }
}


/* EVENT LISTENERS */
let eventListeners = {

    // Community dropdown field
    communityInput: d3
        .select("#community-dropdown")
        .on("change", function () {
            state.meta_timestamp = helper.formatTimestamp(Date.now());
            state.meta_community = this.value.replace(/[^A-Z0-9]/ig, "");
            state.meta_fileName_title = state.meta_community + state.meta_fileName_date + ".csv";
        }),

    // Reporting date input
    dateInput: d3
        .select("#date-input")
        .on("change", function () {
            state.meta_timestamp = helper.formatTimestamp(Date.now());
            state.meta_reportingDate = helper.formatReportingDate(parseDate(this.value));
            state.meta_fileName_date = helper.formatFileDate(parseDate(this.value));
            state.meta_fileName_title = state.meta_community + state.meta_fileName_date + ".csv";
        }),




    /* Toggle additional information for validation steps */

    // Headers
    toggleHeaderInfo: d3.select("#headers-name")
        .on('click', function () {
            state.section_headers_open = !state.section_headers_open;
            toggleValInfo("#headers-info", "#headers-name-toggle", state.section_headers_open);
        }),

    // Required columns
    toggleRequiredInfo: d3.select("#required-name")
        .on('click', function () {
            state.section_required_open = !state.section_required_open;
            toggleValInfo("#required-info", "#required-name-toggle", state.section_required_open);
        }),

    // Data type
    toggleDataTypeInfo: d3.select("#dataType-name")
        .on('click', function () {
            state.section_dataType_open = !state.section_dataType_open;
            toggleValInfo("#dataType-info", "#dataType-name-toggle", state.section_dataType_open);
        }),

    // Social security numbers
    toggleSsnInfo: d3.select("#ssn-name")
        .on('click', function () {
            state.section_ssn_open = !state.section_ssn_open;
            toggleValInfo("#ssn-info", "#ssn-name-toggle", state.section_ssn_open);
        }),


}



/* VALIDATION INFO OPEN / CLOSE FUNCTIONS */

function openValInfo(infoLocation, toggleLocation) {
    console.log("Opening", infoLocation)
    d3.select(infoLocation)
        .style("opacity", "0")
        .transition()
        .duration(200)
        .style("opacity", "1")

    d3.select(infoLocation).classed("hide", false)

    d3.select(toggleLocation)
        .text("HIDE DETAILS ▲")
}

function closeValInfo(infoLocation, toggleLocation) {
    console.log("Closing", infoLocation)
    d3.select(infoLocation)
        .style("opacity", "1")
        .transition()
        .duration(200)
        .style("opacity", "0")

    d3.select(infoLocation).classed("hide", true)

    d3.select(toggleLocation)
        .text("SHOW DETAILS ▼")
}

function toggleValInfo(infoLocation, toggleLocation, stateField) {
    if (stateField === true) {
        openValInfo(infoLocation, toggleLocation)
    } else closeValInfo(infoLocation, toggleLocation)
}



/* Get file from file picker and call metadata function */
let uploadElement = d3
    .select("#fileSubmit")
    .on("click", function () {
        state.timestamp = formatTimestamp(Date.now());
        updateBackendFields(input, metadata, state);
        uploadToAws(state.output, state.fileTitle);
    });

let inputElement = document.getElementById("filePicker");
inputElement.addEventListener("change", getFile, false);


function getFile() {
    state.fileList = this.files;

    Papa.parse(state.fileList[0], {
        dynamicTyping: true,
        header: true,
        complete: function (results) {
            parseData(results.data, results.meta);
        },
    });
}

function parseData(data, meta) {

    state.data_raw = data;
    state.data_headers = meta.fields;
    state.data_length = data.length;

    console.log(state)

}

let validateButton = d3
    .select("#fileSubmit")
    .on("click", function () {
        testHeaders(state.data_headers)
        console.log(state)
    })


function testHeaders(headerArray) {
    // Frontend update locations
    const stepLocation = d3.select("#headers-name");
    const resultLocation = d3.select(".headers-val-symbol");
    const errorLocation = d3.select(".error-table");

    // Set initial status of "testing"
    resultLocation.text("TESTING...").classed("neutral", true);

    const output = {
        dataSourceMatches: [],
        dataSourceNoMatches: [],
        dictionaryMatches: [],
        dictionaryNoMatches: [],
    }

    output.dictionaryNoMatches = state.dict_headers_required;

    const matchedHeaders = headerArray.map(header => matchHeader(header, output));
    console.log(matchedHeaders)

    if (output.dataSourceNoMatches.length > 0) {
        state.check_headers = false;
        resultLocation.text("NO PASS").classed("neutral", false);
        resultLocation.classed("fail", true);
        stepLocation.style("background-color", "#FFB9B9");
        errorLocation.html(`<h3>Result</h3><br>
        
        <b class='fail'>${output.dictionaryNoMatches.length} / ${state.dict_headers_required.length} required headers DID NOT have a match in your file. <br> Please check that these column headers are included in your file and try again.</b>
        
        <ul class='list'> ${output.dictionaryNoMatches.map(i => `<li><b>${i}</b></li>`).join('')} </ul> <br> 
        
        <b class='success'>${output.dictionaryMatches.length} / ${state.dict_headers_required.length} required headers DID have a match in your file.</b> 
        
        <ul class='list'> ${output.dataSourceMatches.map(i => `<li><b class='success'>${i}</b> in your file matched with <i>${output.dictionaryMatches[output.dataSourceMatches.indexOf(i)]}</i></li>`).join('')}</ul> <br>
    
        `);

    } else {
        state.check_headers = true;
        resultLocation.text("PASS").classed("neutral", false);
        resultLocation.classed("success", true);
        stepLocation.style("background-color", "lightblue");
        errorLocation.html(`<h3>Result</h3><br>
        
        <b class='success'>${output.dictionaryMatches.length} / ${state.dict_headers_required.length} required headers DID have a match in your file.</b> 
        
        <ul class='list'> ${output.dataSourceMatches.map(i => `<li><b class='success'>${i}</b> in your file matched with <i>${output.dictionaryMatches[output.dataSourceMatches.indexOf(i)]}</i></li>`).join('')}</ul> <br>`);
    }
}

// helper function to remove an element from an array, and return the new array
function arrayRemove(arr, value) {
    return arr.filter(function (i) {
        return i != value;
    });
}


function matchHeader(searchTerm, output) {

    const a = stringSimilarity.findBestMatch(searchTerm, output.dictionaryNoMatches);

    // If the Dice's coefficient falls below threshold, return null
    if (a.bestMatch.rating < state.data_diceCoefficient) {
        output.dataSourceNoMatches.push(searchTerm)
    } else {
        output.dataSourceMatches.push(searchTerm)
        output.dictionaryMatches.push(a.bestMatch.target)
        output.dictionaryNoMatches = arrayRemove(output.dictionaryNoMatches, a.bestMatch.target)
    }

    return output;
}














/* WAIT */

/* 

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
} */