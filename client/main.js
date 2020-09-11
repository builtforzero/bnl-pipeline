require('dotenv').config();
const d3 = require('d3')
const Papa = require('papaparse');
const stringSimilarity = require('string-similarity');

/* APPLICATION STATE */
let state = {
    // Validation tests pass/fail
    check_headers: null,
    check_pii: null,
    check_ssn: null,

    // Form Fields
    form_community_clean: null,
    form_reporting_date: null,
    form_name: null,
    form_email: null,
    form_file_upload: null,

    // Metadata
    meta_timestamp: null,
    meta_community: null,
    meta_fileName_title: null,
    meta_fileName_date: null,
    meta_reportingDate: null,

    // Data
    fileList: null,
    data_raw: null,
    data_clean: null,
    data_headers: null,
    data_length: null,

    // All headers
    dict_headers_all: [
        'Date of Identification',
        'Homeless Start Date',
        'Housing Move-In Date',
        'Inactive Date',
        'Returned to Active Date',
        'Age',
        'Client / HMIS ID',
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

    // Required headers
    dict_headers_required: [
        'Date of Identification',
        'Homeless Start Date',
        'Housing Move-In Date',
        'Inactive Date',
        'Returned to Active Date',
        'Age',
        'Client / HMIS ID',
        'BNL Status',
        'Household Type',
        'Chronic Status',
        'Veteran Status',
        'Ethnicity',
        'Race',
        'Gender',
    ],

    // Banned headers
    dict_headers_remove: [
        'Social Security Number',
        'SSN',
        'Last 4',
        'First Name',
        'Last Name',
        'Name',
        'Birthday',
        'Date of Birth',
        'DOB',
    ]
}

// STORE OUTPUT VARIABLES FOR TESTS
let output = {
    // Required headers
    srcHeaderMatches: [], // Source file headers that match required fields
    srcHeaderNoMatches: [], // Source file headers that DO NOT match required fields
    dictHeaderMatches: [], // Dictionary headers that match the source file
    dictHeaderNoMatches: [], // Dictionary headers that DO NOT match the source file

    // PII Headers
    srcPiiMatches: [], // Source file headers that match PII fields
    srcPiiNoMatches: [], // Source file headers that DO NOT match PII fields
    dictPiiMatches: [], // PII headers that match the source file
    dictPiiNoMatches: [], // PII headers that DO NOT match the source file
}

/* HELPER SCRIPTS */
let script = {
    // Date and time formatting
    format_YmdX: d3.timeFormat("%Y-%m-%d %X"),
    format_Ymd: d3.timeFormat("%Y%m%d"),
    format_MY: d3.timeFormat("%B %Y"), // September 2020
    parse_Ymd: d3.timeParse("%Y-%m-%d"),
    parse_dmY: d3.timeParse("%m/%d/%Y"),

    // Remove a value from an array and return the updated array
    arrayRemove: function arrayRemove(arr, value) {
        return arr.filter(function (i) {
            return i != value;
        });
    },

    // Get a column of values from array
    getCol: function getCol(arr, columnIndex) {
        const columnName = state.data_headers[columnIndex]
        const col = [];

        for (let row = 0; row < arr.length - 1; row++) {
            const value = Object.values(arr)[row][columnName];
            col.push(value);
        }
        return col;
    },

    getColByName: function getCol(arr, columnName) {
        const col = [];

        for (let row = 0; row < arr.length - 1; row++) {
            const value = Object.values(arr)[row][columnName];
            col.push(value);
        }
        return col;
    },

}

/* EVENT LISTENERS */
let eventListeners = {

    // Community dropdown field
    communityInput: d3
        .select("#community-dropdown")
        .on("change", function () {
            checkFormStatus(state);
            state.form_community_clean = this.value;
            state.meta_community = state.form_community_clean.replace(/[^A-Z0-9]/ig, "");
            // Name of file upload
            state.meta_timestamp = script.format_YmdX(Date.now());
            state.meta_fileName_title = state.meta_community + state.meta_fileName_date + ".csv";
        }),

    // Reporting date input
    dateInput: d3
        .select("#date-input")
        .on("change", function () {
            state.form_reporting_date = this.value;
            state.meta_reportingDate = script.format_MY(script.parse_Ymd(state.form_reporting_date));
            state.meta_fileName_date = script.format_Ymd(script.parse_Ymd(state.form_reporting_date));
            // Name of file upload
            state.meta_timestamp = script.format_YmdX(Date.now());
            state.meta_fileName_title = state.meta_community + state.meta_fileName_date + ".csv";
            checkFormStatus();
        }),

    contactName: d3
        .select("#name-input")
        .on("change", function () {
            state.form_name = this.value;
            checkFormStatus();
        }),

    email: d3
        .select("#email-input")
        .on("change", function () {
            state.form_email = this.value;
            checkFormStatus();
        }),

    // File Picker: call getFile() function
    filePicker: d3.select("#filePicker")
        .on("change", function () {
            state.form_file_upload = this.value;
            checkFormStatus();
            state.fileList = this.files
            Papa.parse(state.fileList[0], {
                dynamicTyping: true,
                header: true,
                complete: function (results) {
                    state.data_raw = results.data;
                    state.data_clean = results.data;
                    state.data_headers = results.meta.fields;
                    state.data_length = results.data.length;
                },
            });
        }),

    // Reupload button
    reupload: d3.select(".aggregateBtn-msg")
        .on("click", function () {
            location.reload();
        }),


    // Validate button
    validateButton: d3
        .select("#validateButton")
        .on("click", function () {
            runTests(state.data_headers, state.data_raw, state);
        }),

}

/* MANAGE SECTION TOGGLING OPEN / CLOSE */
let section = {
    // State of each section
    headers_open: false,
    pii_open: false,
    ssn_open: false,

    // Toggle function
    toggle: function (infoLocation, toggleLocation, stateField) {
        if (stateField === true) {
            d3.select(infoLocation)
                .style("opacity", "0")
                .transition()
                .duration(200)
                .style("opacity", "1")
            d3.select(infoLocation).classed("hide", false)
            d3.select(toggleLocation).text("HIDE DETAILS ▲")

        } else {
            d3.select(infoLocation)
                .style("opacity", "1")
                .transition()
                .duration(200)
                .style("opacity", "0")
            d3.select(infoLocation).classed("hide", true)
            d3.select(toggleLocation).text("SHOW DETAILS ▼")
        }
    },

    // Event Listeners
    toggleHeaderInfo: d3.select("#headers-name")
        .on('click', function () {
            // Set opposite status for selected section
            section.headers_open = !section.headers_open;
            section.pii_open = false;
            section.ssn_open = false;
            // Open/close selected section, close all others
            section.toggle("#headers-info", "#headers-name-toggle", section.headers_open);
            section.toggle("#pii-info", "#pii-toggle", section.pii_open);
            section.toggle("#ssn-info", "#ssn-name-toggle", section.ssn_open);
        }),

    togglePiiInfo: d3.select("#pii-name")
        .on('click', function () {
            // Set opposite status for selected section
            section.pii_open = !section.pii_open;
            section.headers_open = false;
            section.ssn_open = false;
            // Open/close selected section, close all others
            section.toggle("#pii-info", "#pii-toggle", section.pii_open);
            section.toggle("#headers-info", "#headers-name-toggle", section.headers_open);
            section.toggle("#ssn-info", "#ssn-name-toggle", section.ssn_open);
        }),

    toggleSsnInfo: d3.select("#ssn-name")
        .on('click', function () {
            // Set opposite status for selected section
            section.ssn_open = !section.ssn_open;
            section.headers_open = false;
            section.pii_open = false;
            // Open/close selected section, close all others
            section.toggle("#ssn-info", "#ssn-name-toggle", section.ssn_open);
            section.toggle("#headers-info", "#headers-name-toggle", section.headers_open);
            section.toggle("#pii-info", "#pii-toggle", section.pii_open);
        }),
}

/* REMOVE DATA FROM STATE */
function resetValues() {

    // Data
    state.fileList = null;
    state.data_raw = null;
    state.data_headers = null;
    state.data_length = null;

    // Required headers
    output.srcHeaderMatches = [];
    output.srcHeaderNoMatches = [];
    output.dictHeaderMatches = [];
    output.dictHeaderNoMatches = [];

    // PII Headers
    output.srcPiiMatches = [];
    output.srcPiiNoMatches = [];
    output.dictPiiMatches = [];
    output.dictPiiNoMatches = [];

    d3.select("#filePicker").value = "";
}

/* RUN TESTS AND CHECK VALIDATION STATUS */
function runTests(headerArray, data, state) {
    testRequiredHeaders(headerArray, state);
    testPiiHeaders(headerArray, state);
    testSsn(headerArray, data, state);
    checkTestStatus();
}

/* TEST #1: REQUIRED HEADERS */
function testRequiredHeaders(headerArray, state) {

    // Frontend update locations
    const stepLocation = d3.select("#headers-name");
    const resultLocation = d3.select(".headers-val-symbol");
    const errorLocation = d3.select(".header-error");

    // Set initial status of "testing"
    resultLocation.text("TESTING...").classed("neutral", true);

    // Set initial dictionary to column headers
    output.dictHeadersNoMatches = state.dict_headers_required;

    // Apply matchHeader function to file header array
    headerArray.map(header => {
        const dictLength = output.dictHeadersNoMatches.length;
        if (dictLength > 0) {
            const a = stringSimilarity.findBestMatch(header, output.dictHeadersNoMatches);
            // If the Dice's coefficient falls below threshold, return null
            if (a.bestMatch.rating < 0.45) {
                output.srcHeaderNoMatches.push(header)
            } else {
                output.srcHeaderMatches.push(header)
                output.dictHeaderMatches.push(a.bestMatch.target)
                output.dictHeadersNoMatches = script.arrayRemove(output.dictHeadersNoMatches, a.bestMatch.target)
            }
        } else {
            output.srcHeaderNoMatches.push(header)
        }
    });

    // If there is at least one lack of match, throw an error
    if (output.dictHeadersNoMatches.length > 0) {
        state.check_headers = false;
        resultLocation.text("NO PASS").classed("success", false);
        resultLocation.text("NO PASS").classed("neutral", false);
        resultLocation.classed("fail", true);
        stepLocation.style("background-color", "#FFB9B9");
        errorLocation.html(`<h3>Result</h3><br>
        
        <b class='fail'>${output.dictHeadersNoMatches.length} / ${state.dict_headers_required.length} required headers are NOT PRESENT in your file. <br></b>
        
        <ul class='list'> ${output.dictHeadersNoMatches.map(i => `<li><b>${i}</b></li>`).join('')} </ul> <br> 
        
        <b class='success'>${output.dictHeaderMatches.length} / ${state.dict_headers_required.length} required headers are present in your file.</b>

        <br><br>

        &nbsp&nbsp&nbsp<b class='success'>Your Column Header</b> <b style='color: grey;'> &nbsp >> &nbsp </b> <b>Matched Required Column Header</b>

        <br>

        <ul> ${output.srcHeaderMatches.map(i => `<li><b class='success'>${i}</b> <b style='color: grey;'> &nbsp >> &nbsp </b> <b>${output.dictHeaderMatches[output.srcHeaderMatches.indexOf(i)]}</b></li>`).join('')}</ul> 
        <br>

        Please check that all ${state.dict_headers_required.length} required column headers are present in your file and try again.
    
        `);
    } else {
        state.check_headers = true;
        resultLocation.text("PASS").classed("neutral", false);
        resultLocation.text("PASS").classed("fail", false);
        resultLocation.classed("success", true);
        stepLocation.style("background-color", "lightblue");
        errorLocation.html(`<h3>Result</h3><br>
        
        <b class='success'>${output.dictHeaderMatches.length} / ${state.dict_headers_required.length} required headers are present in your file.</b>

        <br><br>

        &nbsp&nbsp&nbsp<b class='success'>Your Column Header</b> <b style='color: grey;'> &nbsp >> &nbsp </b> <b>Matched Required Column Header</b>

        <br>

        <ul> ${output.srcHeaderMatches.map(i => `<li><b class='success'>${i}</b> <b style='color: grey;'> &nbsp >> &nbsp </b> <b>${output.dictHeaderMatches[output.srcHeaderMatches.indexOf(i)]}</b></li>`).join('')}</ul> 
        <br>

        If this match doesn't look right, please edit your column headers to exactly match the required column name.
        `);
    }

}

/* TEST #2: PII HEADERS */
function testPiiHeaders(headerArray, state) {

    // Frontend update locations
    const stepLocation = d3.select("#pii-name");
    const resultLocation = d3.select(".pii-val-symbol");
    const errorLocation = d3.select(".pii-error");

    // Set initial status of "testing"
    resultLocation.text("TESTING...").classed("neutral", true);

    // Set initial dictionary to column headers
    output.dictPiiNoMatches = state.dict_headers_remove

    // Apply matchHeader function to file header array
    headerArray.map(header => {
        const a = stringSimilarity.findBestMatch(header, output.dictPiiNoMatches);
        // If the Dice's coefficient falls below threshold, return null
        if (a.bestMatch.rating < 0.6) {
            output.srcPiiNoMatches.push(header)
        } else {
            output.srcPiiMatches.push(header)
            output.dictPiiMatches.push(a.bestMatch.target)
            output.dictPiiNoMatches = script.arrayRemove(output.dictPiiNoMatches, a.bestMatch.target)
        }
    });

    // If there is at least one lack of match, throw a success
    if (output.dictPiiMatches.length > 0) {
        state.check_pii = false;
        resultLocation.text("NO PASS").classed("neutral", false);
        resultLocation.classed("fail", true);
        stepLocation.style("background-color", "#FFB9B9");
        errorLocation.html(`<h3>Result</h3><br>

        <b class='fail'>${output.dictPiiMatches.length} column header(s) are flagged as potentially containing PII:</b>
        
        <ul> ${output.srcPiiMatches.map(i => `<li><b>${i}`).join('')}</ul> <br>

        Please remove the PII column(s) from your data file and try again.
    
        `);
    } else if (output.dictPiiMatches.length === 0) {
        state.check_pii = true;
        resultLocation.text("PASS").classed("neutral", false);
        resultLocation.text("PASS").classed("fail", false);
        resultLocation.classed("success", true);
        stepLocation.style("background-color", "lightblue");
        errorLocation.html(`<h3>Result</h3><br>
        
        <b class='success'>Passed: No headers in your file contained PII.</b>`);
    }

}


/* TEST #3: CHECK FOR SOCIAL SECURITY NUMBERS */
function testSsn(headerArray, data, state) {
    // Tests each column in the data for SSN values
    // Sorts columns into pass / fail
    // Prints result to front-end

    // Set frontend update locations
    const stepLocation = d3.select("#ssn-name");
    const resultLocation = d3.select(".ssn-val-symbol");
    const errorLocation = d3.select(".ssn-error");

    // Set initial status of "testing"
    resultLocation.text("TESTING...").classed("neutral", true);

    // Set empty arrays for pass and fail headers
    let ssnFail = [];
    let ssnPassed = [];

    // Sort headers into pass and fail based on whether they contain SSNs
    for (let col = 0; col < headerArray.length; col++) {
        const header = headerArray[col]
        const output = getRowsOfSsnValues(script.getCol(data, col))

        if (output.length > 0) {
            ssnFail.push([header, output])
        } else {
            ssnPassed.push([header, output])
        }
    }

    // If there is at least one header in the data that failed, throw an error
    if (ssnFail.length > 0) {
        // Update state and front-end locations
        state.check_ssn = false;
        resultLocation.text("NO PASS").classed("neutral", false);
        resultLocation.classed("fail", true);
        stepLocation.style("background-color", "#FFB9B9");
        // Error message
        errorLocation.html(`<h3>Result</h3><br>
            <b>${ssnFail.length} / ${headerArray.length} columns</b> in your file contain values that could be Social Security Numbers. <b style='color:grey; font-weight:400;'> &nbsp (Potential SSNs include values with 9 digits, 4 digits, or in the format ###-##-####)</b>. <br>
            <ul>
            ${ssnFail.map(value => `
                <li>
                    <b class='fail'>${value[0]}</b> has <b>${value[1].length} potential SSN(s)</b> at the following location(s): &nbsp ${value[1].map(v => `<br> &nbsp &nbsp <b style='color:lightgrey;'>></b> Row <b>${v}</b> &nbsp `).join('')}
                </li><br>`
                ).join('')}
            </ul>
            Please remove the Social Security Numbers from your data file and try again.
        `);
    } else {
        // Update state and front-end locations
        state.check_ssn = true;
        resultLocation.text("PASS").classed("neutral", false);
        resultLocation.text("PASS").classed("fail", false);
        resultLocation.classed("success", true);
        stepLocation.style("background-color", "lightblue");
        // Success message
        errorLocation.html(`<h3>Result</h3><br>
        <b class='success'>Passed: No values in your file are SSNs.</b>
        `);
    }

}
// SSN helper function: get rows of SSN values
function getRowsOfSsnValues(arr) {

    /* 
    Takes in an array and returns an array with the *row
    numbers* (indices + 1) that contain SSN values in the dataset.
    E.g. let arr = [333, "testValue", 123456789, "", null, NaN, 666666, 4444]
    then getIndexOfSsnValues(arr) ==> [3, 8]
    */

    // SSN patterns to match each value against
    let regex = [
        /^\d{3}-?\d{2}-?\d{4}$/, // ###-##-####
        /^\d{3} ?\d{2} ?\d{4}$/, // ### ## ####
        /\d{9}$/, // #########
        /\d{4}$/ // ####
    ];

    // Holds the result of matching each value to each SSN pattern
    let regexTestOutput = [];

    // Holds the row numbers that contain SSN values
    let rowsWithSsnValues = [];

    // Step 1: Match each value in the array against each regex pattern, one at a time.
    // Return an array with true / false for each pattern.
    // E.g. if the value is "4444" ==> [false, false, false, true]
    arr.map((value) => {
        value = Number(value)
        const result = regex.map(i => {
            const pattern = new RegExp(i, "gim")
            const match = value.toString().match(pattern)
            if (match === null) {
                return false;
            } else {
                return value.toString() === match[0].toString(); // test for exact match
            }
        });
        regexTestOutput.push(result);
    });

    // Step 2: Loop through the regex matching for each value and grab the row numbers 
    // that failed the tests.
    // E.g. if one output from Step 1 is [false, false, false, true] aka [0, 0, 0, 1],
    // then the reduced "sum" is 1. Since this is >0, grab the index
    // of that result + 1 to get the dataset row number.
    for (let k = 0; k < arr.length; k++) {
        const sum = regexTestOutput[k].reduce((a, b) => a + b)
        if (sum > 0) {
            rowsWithSsnValues.push(k + 1)
        }
    }

    return rowsWithSsnValues;
}


/* STATUS CHECKING */

// Status of form fields
function checkFormStatus() {
    if (
        state.form_community_clean === null ||
        state.form_community_clean === "" ||
        state.form_reporting_date === null ||
        state.form_reporting_date === "" ||
        state.form_name === null ||
        state.form_name === "" ||
        state.form_email === null ||
        state.form_email === "" ||
        state.form_file_upload === null ||
        state.form_file_upload === ""
    ) {
        // Failure: any one of the form fields is not filled or empty
        d3.select("#validateButton").classed("inactive", true);
        d3.select("#validateButton").classed("active", false);
        d3.select("#validateButton").attr("disabled", true);
        d3.select(".validateBtn-msg").html("Please fill in all required fields to continue.");
        d3.select(".aggregateBtn-msg").html("");
    } else if (
        state.form_community_clean != null &&
        state.form_reporting_date != null &&
        state.form_name != null &&
        state.form_email != null &&
        state.form_file_upload != null
    ) {
        // Success: all of the form fields are filled in
        d3.select("#validateButton").classed("inactive", false);
        d3.select("#validateButton").classed("active", true);
        d3.select("#validateButton").attr("disabled", null);

        d3.select(".validateBtn-msg").text("");
        d3.select(".aggregateBtn-msg").text("");
    }
}

// Status of validation tests
function checkTestStatus() {
    if (
        state.check_headers === null ||
        state.check_headers === false ||
        state.check_pii === null ||
        state.check_pii === false ||
        state.check_ssn === null ||
        state.check_ssn === false
    ) {
        // Failure: The data did not pass any one of the tests
        // Inactivate the validate button
        d3.select("#validateButton").classed("inactive", true);
        d3.select("#validateButton").classed("active", false);
        d3.select("#validateButton").attr("disabled", true);
        // Inactivate and hide the submit button
        d3.select("#aggregateButton").classed("inactive", true);
        d3.select("#aggregateButton").classed("active", false);
        d3.select("#aggregateButton").attr("disabled", true);
        d3.select("#aggregateButton").classed("hide", true);
        // Reset values
        resetValues();
        // Add a reupload button instead
        d3.select(".aggregateBtn-msg").html(`
        <div class='center' style='margin:15px;'>
        <button class='waiting' id='reupload-button'>
            REUPLOAD CORRECTED FILE &nbsp &#8630
        </button>
        </div>`);
    } else if (
        state.check_headers === true &&
        state.check_pii === true &&
        state.check_ssn === true
    ) {
        // Success: All of the tests passed
        // Activate the submit button
        d3.select("#aggregateButton").classed("inactive", false);
        d3.select("#aggregateButton").classed("active", true);
        d3.select("#aggregateButton").attr("disabled", null);
        d3.select("#aggregateButton").classed("hide", false);
        // Replace the error helptext
        d3.select(".aggregateBtn-msg").html(`
        <div class='center'>
        <button class='waiting' id='reupload-button'>
        REUPLOAD CORRECTED FILE &nbsp &#8630
        </button>
        </div>`);
        // Inactivate the validate button
        d3.select("#validateButton").classed("inactive", true);
        d3.select("#validateButton").classed("active", false);
        d3.select("#validateButton").attr("disabled", true);
    }
}

// ["All", "Single Adult Veteran", "Single Adult Chronic", "Youth", "Family"],

let agg = {
    // Dictionary
    dict_headers: [
        'Timestamp', 'Community', 'Month', 'Your Name:', 'Your Email Address:', 'Your Organization:', 'Population', 'Subpopulation', 'Demographic', 'ACTIVELY HOMELESS NUMBER', 'AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT', 'HOUSING PLACEMENTS', 'MOVED TO INACTIVE NUMBER', 'NO LONGER MEETS POPULATION CRITERIA', 'NEWLY IDENTIFIED NUMBER', 'RETURNED TO ACTIVE LIST FROM HOUSING NUMBER', 'RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER'
    ],
    dict_calcs: [
        'ACTIVELY HOMELESS NUMBER', 'AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT', 'HOUSING PLACEMENTS', 'MOVED TO INACTIVE NUMBER', 'NO LONGER MEETS POPULATION CRITERIA', 'NEWLY IDENTIFIED NUMBER', 'RETURNED TO ACTIVE LIST FROM HOUSING NUMBER', 'RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER'
    ],
    dict_pops: ["All"],

    // Data
    timestamp: [],
    community: [],
    month: [],
    name: [],
    email: [],
    organization: [],
    population: [],
    subpopulation: [],
    demographic: [],
    calc_AHNumber: [],
    calc_AvgLengthOfTime: [],
    calc_HousingPlacements: [],
    calc_MovedToInactive: [],
    calc_NoLongerPop: [],
    calc_NewlyId: [],
    calc_ReturnedFromHousing: [],
    calc_ReturnFromInactive: []
}

let all = {
    AH: null,
    AH_null: null,
    AvgTime: null,
    AvgTime_null: null,
    HP: null,
    HP_null: null,
    Inactive: null,
    Inactive_null: null,
    NewId: null,
    NewId_null: null,
    RetHousing: null,
    RetHousing_null: null,
    RetInactive: null,
    RetInactive_null: null,
}

let chronic = {
    AH: null,
    AH_null: null,
    AvgTime: null,
    AvgTime_null: null,
    HP: null,
    HP_null: null,
    Inactive: null,
    Inactive_null: null,
    NewId: null,
    NewId_null: null,
    RetHousing: null,
    RetHousing_null: null,
    RetInactive: null,
    RetInactive_null: null,
}

let veteran = {
    AH: null,
    AH_null: null,
    AvgTime: null,
    AvgTime_null: null,
    HP: null,
    HP_null: null,
    Inactive: null,
    Inactive_null: null,
    NewId: null,
    NewId_null: null,
    RetHousing: null,
    RetHousing_null: null,
    RetInactive: null,
    RetInactive_null: null,
}

let youth = {
    AH: null,
    AH_null: null,
    AvgTime: null,
    AvgTime_null: null,
    HP: null,
    HP_null: null,
    Inactive: null,
    Inactive_null: null,
    NewId: null,
    NewId_null: null,
    RetHousing: null,
    RetHousing_null: null,
    RetInactive: null,
    RetInactive_null: null,
}

let family = {
    AH: null,
    AH_null: null,
    AvgTime: null,
    AvgTime_null: null,
    HP: null,
    HP_null: null,
    Inactive: null,
    Inactive_null: null,
    NewId: null,
    NewId_null: null,
    RetHousing: null,
    RetHousing_null: null,
    RetInactive: null,
    RetInactive_null: null,
}


let aggButton = d3
    .select("#aggregateButton")
    .on("click", function () {
        addMetadata(state, agg);
        aggregate();

    });

function pushToArr(value, length, location) {
    for (let i = 0; i < length; i++) {
        location.push(value);
    }
}

function addMetadata(state, agg) {
    let len = agg.dict_pops.length * agg.dict_calcs.length;
    agg.timestamp = [];
    agg.community = [];
    agg.month = [];
    agg.name = [];
    agg.email = [];
    agg.organization = [];
    // Timestamp
    pushToArr(state.meta_timestamp, len, agg.timestamp);
    // Community
    pushToArr(state.form_community_clean, len, agg.community);
    // Reporting Month
    pushToArr(state.meta_reportingDate, len, agg.month);
    // Name
    pushToArr(state.form_name, len, agg.name);
    // Email
    pushToArr(state.form_email, len, agg.email);
}

function resetAggregations() {
    all.AH = null;
    all.AH_null = null;
    all.AvgTime = null;
    all.AvgTime_null = null;
    all.HP = null;
    all.HP_null = null;
    all.Inactive = null;
    all.Inactive_null = null;
    all.NewId = null;
    all.NewId_null = null;
    all.RetHousing = null;
    all.RetHousing_null = null;
    all.RetInactive = null;
    all.RetInactive_null = null;

    chronic.AH = null;
    chronic.AH_null = null;
    chronic.AvgTime = null;
    chronic.AvgTime_null = null;
    chronic.HP = null;
    chronic.HP_null = null;
    chronic.Inactive = null;
    chronic.Inactive_null = null;
    chronic.NewId = null;
    chronic.NewId_null = null;
    chronic.RetHousing = null;
    chronic.RetHousing_null = null;
    chronic.RetInactive = null;
    chronic.RetInactive_null = null;

    youth.AH = null;
    youth.AH_null = null;
    youth.AvgTime = null;
    youth.AvgTime_null = null;
    youth.HP = null;
    youth.HP_null = null;
    youth.Inactive = null;
    youth.Inactive_null = null;
    youth.NewId = null;
    youth.NewId_null = null;
    youth.RetHousing = null;
    youth.RetHousing_null = null;
    youth.RetInactive = null;
    youth.RetInactive_null = null;

    family.AH = null;
    family.AH_null = null;
    family.AvgTime = null;
    family.AvgTime_null = null;
    family.HP = null;
    family.HP_null = null;
    family.Inactive = null;
    family.Inactive_null = null;
    family.NewId = null;
    family.NewId_null = null;
    family.RetHousing = null;
    family.RetHousing_null = null;
    family.RetInactive = null;
    family.RetInactive_null = null;
}

function aggregate() {
    d3.select(".reporting-month").html(`Reporting for ${state.meta_reportingDate}`)
    d3.select(".reporting-community").html(`${state.form_community_clean}`)

    printValue("", "Total Clients in File", state.data_raw.length, "")
    printValue("", "Unique Client IDs", calcAH(state.data_raw, "Unique", "Client ID"), "")

    /* ALL */
    all.AH = calcAH(state.data_raw, "All", "Client ID")[0];
    all.AH_null = calcAH(state.data_raw, "All", "Client ID")[1];
    all.AvgTime = null;
    all.AvgTime_null = null;
    all.HP = dateCalc(state.data_raw, "All", "Housing Move-In Date", "Client ID")[0];
    all.HP_null = dateCalc(state.data_raw, "All", "Housing Move-In Date", "Client ID")[1];
    all.Inactive = dateCalc(state.data_raw, "All", "Inactive Date", "Client ID")[0];
    all.Inactive_null = dateCalc(state.data_raw, "All", "Inactive Date", "Client ID")[1];
    all.NewId = dateCalc(state.data_raw, "All", "Date of Identification", "Client ID")[0];
    all.NewId_null = dateCalc(state.data_raw, "All", "Date of Identification", "Client ID")[1];
    all.RetHousing = calcRetHousing(state.data_raw, "All", "Returned to Active Date", "Housing Move-In Date", "Client ID")[0];
    all.RetHousing_null = calcRetHousing(state.data_raw, "All", "Returned to Active Date", "Housing Move-In Date", "Client ID")[1];
    all.RetInactive = null;
    all.RetInactive_null = null;

    /* CHRONIC */
    chronic.AH = calcAH(state.data_raw, "Chronic", "Client ID")[0];
    chronic.AH_null = calcAH(state.data_raw, "Chronic", "Client ID")[1];
    chronic.AvgTime = null;
    chronic.AvgTime_null = null;
    chronic.HP = dateCalc(state.data_raw, "Chronic", "Housing Move-In Date", "Client ID")[0];
    chronic.HP_null = dateCalc(state.data_raw, "Chronic", "Housing Move-In Date", "Client ID")[1];
    chronic.Inactive = dateCalc(state.data_raw, "Chronic", "Inactive Date", "Client ID")[0];
    chronic.Inactive_null = dateCalc(state.data_raw, "Chronic", "Inactive Date", "Client ID")[1];
    chronic.NewId = dateCalc(state.data_raw, "Chronic", "Date of Identification", "Client ID")[0];
    chronic.NewId_null = dateCalc(state.data_raw, "Chronic", "Date of Identification", "Client ID")[1];
    chronic.RetHousing = calcRetHousing(state.data_raw, "Chronic", "Returned to Active Date", "Housing Move-In Date", "Client ID")[0];
    chronic.RetHousing_null = calcRetHousing(state.data_raw, "Chronic", "Returned to Active Date", "Housing Move-In Date", "Client ID")[1];
    chronic.RetInactive = null;
    chronic.RetInactive_null = null;

    /* VETERAN */
    veteran.AH = calcAH(state.data_raw, "Veteran", "Client ID")[0];
    veteran.AH_null = calcAH(state.data_raw, "Veteran", "Client ID")[1];
    veteran.AvgTime = null;
    veteran.AvgTime_null = null;
    veteran.HP = dateCalc(state.data_raw, "Veteran", "Housing Move-In Date", "Client ID")[0];
    veteran.HP_null = dateCalc(state.data_raw, "Veteran", "Housing Move-In Date", "Client ID")[1];
    veteran.Inactive = dateCalc(state.data_raw, "Veteran", "Inactive Date", "Client ID")[0];
    veteran.Inactive_null = dateCalc(state.data_raw, "Veteran", "Inactive Date", "Client ID")[1];
    veteran.NewId = dateCalc(state.data_raw, "Veteran", "Date of Identification", "Client ID")[0];
    veteran.NewId_null = dateCalc(state.data_raw, "Veteran", "Date of Identification", "Client ID")[1];
    veteran.RetHousing = calcRetHousing(state.data_raw, "Veteran", "Returned to Active Date", "Housing Move-In Date", "Client ID")[0];
    veteran.RetHousing_null = calcRetHousing(state.data_raw, "Veteran", "Returned to Active Date", "Housing Move-In Date", "Client ID")[1];
    veteran.RetInactive = null;
    veteran.RetInactive_null = null;

    /* YOUTH */
    youth.AH = calcAH(state.data_raw, "Youth", "Client ID")[0];
    youth.AH_null = calcAH(state.data_raw, "Youth", "Client ID")[1];
    youth.AvgTime = null;
    youth.AvgTime_null = null;
    youth.HP = dateCalc(state.data_raw, "Youth", "Housing Move-In Date", "Client ID")[0];
    youth.HP_null = dateCalc(state.data_raw, "Youth", "Housing Move-In Date", "Client ID")[1];
    youth.Inactive = dateCalc(state.data_raw, "Youth", "Inactive Date", "Client ID")[0];
    youth.Inactive_null = dateCalc(state.data_raw, "Youth", "Inactive Date", "Client ID")[1];
    youth.NewId = dateCalc(state.data_raw, "Youth", "Date of Identification", "Client ID")[0];
    youth.NewId_null = dateCalc(state.data_raw, "Youth", "Date of Identification", "Client ID")[1];
    youth.RetHousing = calcRetHousing(state.data_raw, "Youth", "Returned to Active Date", "Housing Move-In Date", "Client ID")[0];
    youth.RetHousing_null = calcRetHousing(state.data_raw, "Youth", "Returned to Active Date", "Housing Move-In Date", "Client ID")[1];
    youth.RetInactive = null;
    youth.RetInactive_null = null;

    /* FAMILY */
    family.AH = calcAH(state.data_raw, "Family", "Client ID")[0];
    family.AH_null = calcAH(state.data_raw, "Family", "Client ID")[1];
    family.AvgTime = null;
    family.AvgTime_null = null;
    family.HP = dateCalc(state.data_raw, "Family", "Housing Move-In Date", "Client ID")[0];
    family.HP_null = dateCalc(state.data_raw, "Family", "Housing Move-In Date", "Client ID")[1];
    family.Inactive = dateCalc(state.data_raw, "Family", "Inactive Date", "Client ID")[0];
    family.Inactive_null = dateCalc(state.data_raw, "Family", "Inactive Date", "Client ID")[1];
    family.NewId = dateCalc(state.data_raw, "Family", "Date of Identification", "Client ID")[0];
    family.NewId_null = dateCalc(state.data_raw, "Family", "Date of Identification", "Client ID")[1];
    family.RetHousing = calcRetHousing(state.data_raw, "Family", "Returned to Active Date", "Housing Move-In Date", "Client ID")[0];
    family.RetHousing_null = calcRetHousing(state.data_raw, "Family", "Returned to Active Date", "Housing Move-In Date", "Client ID")[1];
    family.RetInactive = null;
    family.RetInactive_null = null;


    /* PRINT */
    printHeader("All")
    printValue("All", "Actively Homeless", all.AH, all.AH_null)
    printValue("All", "Housing Placements", all.HP, all.HP_null)
    printValue("All", "Moved to Inactive", all.Inactive, all.Inactive_null)
    printValue("All", "Newly Identified Inflow", all.NewId, all.NewId_null)
    printValue("All", "Returned to Active from Housing", all.RetHousing, all.RetHousing_null)

    printHeader("Chronic")
    printValue("Chronic", "Actively Homeless", chronic.AH, chronic.AH_null)
    printValue("Chronic", "Housing Placements", chronic.HP, chronic.HP_null)
    printValue("Chronic", "Moved to Inactive", chronic.Inactive, chronic.Inactive_null)
    printValue("Chronic", "Newly Identified Inflow", chronic.NewId, chronic.NewId_null)
    printValue("Chronic", "Returned to Active from Housing", chronic.RetHousing, chronic.RetHousing_null)

    printHeader("Veteran")
    printValue("Veteran", "Actively Homeless", veteran.AH, veteran.AH_null)
    printValue("Veteran", "Housing Placements", veteran.HP, veteran.HP_null)
    printValue("Veteran", "Moved to Inactive", veteran.Inactive, veteran.Inactive_null)
    printValue("Veteran", "Newly Identified Inflow", veteran.NewId, veteran.NewId_null)
    printValue("Veteran", "Returned to Active from Housing", veteran.RetHousing, veteran.RetHousing_null)

    printHeader("Youth")
    printValue("Youth", "Actively Homeless", youth.AH, youth.AH_null)
    printValue("Youth", "Housing Placements", youth.HP, youth.HP_null)
    printValue("Youth", "Moved to Inactive", youth.Inactive, youth.Inactive_null)
    printValue("Youth", "Newly Identified Inflow", youth.NewId, youth.NewId_null)
    printValue("Youth", "Returned to Active from Housing", youth.RetHousing, youth.RetHousing_null)

    printHeader("Family")
    printValue("Family", "Actively Homeless", family.AH, family.AH_null)
    printValue("Family", "Housing Placements", family.HP, family.HP_null)
    printValue("Family", "Moved to Inactive", family.Inactive, family.Inactive_null)
    printValue("Family", "Newly Identified Inflow", family.NewId, family.NewId_null)
    printValue("Family", "Returned to Active from Housing", family.RetHousing, family.RetHousing_null)

}

/* 
ACTIVELY HOMELESS NUMBER
*/
function calcAH(data, target, uniqueCol) {
    // All unique
    if (target === "Unique") {
        const uniqueArray = script.getColByName(data, uniqueCol);
        return new Set(uniqueArray).size;

        // All
    } else if (target === "All") {
        const filtered = data.filter(d => {
            return d['BNL Status'] === "Active"
        })

        const nulls = data.filter(d => {
            return d['BNL Status'] != "Active"
        })

        const uniqueArray = script.getColByName(filtered, uniqueCol);
        const nullArray = script.getColByName(nulls, uniqueCol);
        return [new Set(uniqueArray).size, new Set(nullArray).size];

        // Veteran
    } else if (target === "Veteran") {
        const filtered = data.filter(d => {
            return d['BNL Status'] === "Active" &&
                d['Household Type'] === "Single Adult" &&
                d['Veteran Status'] === "Yes Validated"
        })

        const nulls = data.filter(d => {
            return d['BNL Status'] != "Active" &&
                d['Household Type'] === "Single Adult" &&
                d['Veteran Status'] === "Yes Validated"
        })

        const uniqueArray = script.getColByName(filtered, uniqueCol);
        const nullArray = script.getColByName(nulls, uniqueCol);
        return [new Set(uniqueArray).size, new Set(nullArray).size];

        // Chronic
    } else if (target === "Chronic") {
        const filtered = data.filter(d => {
            return d['BNL Status'] === "Active" &&
                d['Household Type'] === "Single Adult" &&
                d['Chronic Status'] === "Chronically Homeless"
        })

        const nulls = data.filter(d => {
            return d['BNL Status'] != "Active" &&
                d['Household Type'] === "Single Adult" &&
                d['Chronic Status'] === "Chronically Homeless"
        })


        const uniqueArray = script.getColByName(filtered, uniqueCol);
        const nullArray = script.getColByName(nulls, uniqueCol);
        return [new Set(uniqueArray).size, new Set(nullArray).size];

        // Youth
    } else if (target === "Youth") {
        const filtered = data.filter(d => {
            return d['BNL Status'] === "Active" &&
                d['Household Type'] === "Youth"
        })

        const nulls = data.filter(d => {
            return d['BNL Status'] != "Active" &&
                d['Household Type'] === "Youth"
        })

        const uniqueArray = script.getColByName(filtered, uniqueCol);
        const nullArray = script.getColByName(nulls, uniqueCol);
        return [new Set(uniqueArray).size, new Set(nullArray).size];

        // Family
    } else if (target === "Family") {
        const filtered = data.filter(d => {
            return d['BNL Status'] === "Active" &&
                d['Household Type'] === "Family"
        })

        const nulls = data.filter(d => {
            return d['BNL Status'] != "Active" &&
                d['Household Type'] === "Family"
        })

        const uniqueArray = script.getColByName(filtered, uniqueCol);
        const nullArray = script.getColByName(nulls, uniqueCol);
        return [new Set(uniqueArray).size, new Set(nullArray).size];

    } else return "Incorrect target chosen"
}

/*  
COMPARE A MONTH / YEAR TO THE REPORTING MONTH / YEAR
*/
function dateCalc(data, target, comparisonDate, uniqueCol) {

    // All
    if (target === "All") {
        const filtered = data.filter(d => {
            return d[comparisonDate] != null &&
                script.format_MY(script.parse_dmY(d[comparisonDate])) ===
                script.format_MY(script.parse_Ymd(state.form_reporting_date))
        })

        const nulls = data.filter(d => {
            return d[comparisonDate] === null ||
                script.format_MY(script.parse_dmY(d[comparisonDate])) !=
                script.format_MY(script.parse_Ymd(state.form_reporting_date))
        })

        const uniqueArray = script.getColByName(filtered, uniqueCol);
        const nullArray = script.getColByName(nulls, uniqueCol);
        return [new Set(uniqueArray).size, new Set(nullArray).size];


        // Veteran
    } else if (target === "Veteran") {
        const filtered = data.filter(d => {
            return d[comparisonDate] != null &&
                script.format_MY(script.parse_dmY(d[comparisonDate])) ===
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                d['Household Type'] === "Single Adult" &&
                d['Veteran Status'] === "Yes Validated"
        })

        const nulls = data.filter(d => {
            return d[comparisonDate] === null ||
                script.format_MY(script.parse_dmY(d[comparisonDate])) !=
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                d['Household Type'] === "Single Adult" &&
                d['Veteran Status'] === "Yes Validated"
        })

        const uniqueArray = script.getColByName(filtered, uniqueCol);
        const nullArray = script.getColByName(nulls, uniqueCol);
        return [new Set(uniqueArray).size, new Set(nullArray).size];

        // Chronic
    } else if (target === "Chronic") {
        const filtered = data.filter(d => {
            return d[comparisonDate] != null &&
                script.format_MY(script.parse_dmY(d[comparisonDate])) ===
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                d['Household Type'] === "Single Adult" &&
                d['Chronic Status'] === "Chronically Homeless"
        })

        const nulls = data.filter(d => {
            return d[comparisonDate] === null ||
                script.format_MY(script.parse_dmY(d[comparisonDate])) !=
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                d['Household Type'] === "Single Adult" &&
                d['Chronic Status'] === "Chronically Homeless"
        })


        const uniqueArray = script.getColByName(filtered, uniqueCol);
        const nullArray = script.getColByName(nulls, uniqueCol);
        return [new Set(uniqueArray).size, new Set(nullArray).size];


        // Youth
    } else if (target === "Youth") {
        const filtered = data.filter(d => {
            return d[comparisonDate] != null &&
                script.format_MY(script.parse_dmY(d[comparisonDate])) ===
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                d['Household Type'] === "Youth"
        })

        const nulls = data.filter(d => {
            return d[comparisonDate] === null ||
                script.format_MY(script.parse_dmY(d[comparisonDate])) !=
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                d['Household Type'] === "Youth"
        })


        const uniqueArray = script.getColByName(filtered, uniqueCol);
        const nullArray = script.getColByName(nulls, uniqueCol);
        return [new Set(uniqueArray).size, new Set(nullArray).size];

        // Family
    } else if (target === "Family") {
        const filtered = data.filter(d => {
            return d[comparisonDate] != null &&
                script.format_MY(script.parse_dmY(d[comparisonDate])) ===
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                d['Household Type'] === "Family"
        })

        const nulls = data.filter(d => {
            return d[comparisonDate] === null ||
                script.format_MY(script.parse_dmY(d[comparisonDate])) !=
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                d['Household Type'] === "Family"
        })


        const uniqueArray = script.getColByName(filtered, uniqueCol);
        const nullArray = script.getColByName(nulls, uniqueCol);
        return [new Set(uniqueArray).size, new Set(nullArray).size];

    } else return "Incorrect target chosen"

}

/* 
RETURNED TO ACTIVE FROM HOUSING 
*/
function calcRetHousing(data, target, returnDateCol, moveInDateCol, uniqueCol) {

    // All
    if (target === "All") {
        const filtered = data.filter(d => {
            return d[returnDateCol] != null &&
                script.format_MY(script.parse_dmY(d[returnDateCol])) ===
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                script.parse_dmY(d[moveInDateCol]) != null &&
                script.parse_dmY(d[returnDateCol]) > script.parse_dmY(d[moveInDateCol])
        })

        const nulls = data.filter(d => {
            return d[returnDateCol] === null ||
                script.format_MY(script.parse_dmY(d[returnDateCol])) !=
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) ||
                script.parse_dmY(d[moveInDateCol]) === null ||
                script.parse_dmY(d[returnDateCol]) <= script.parse_dmY(d[moveInDateCol])
        })

        const uniqueArray = script.getColByName(filtered, uniqueCol);
        const nullArray = script.getColByName(nulls, uniqueCol);
        return [new Set(uniqueArray).size, new Set(nullArray).size];


        // Veteran
    } else if (target === "Veteran") {
        const filtered = data.filter(d => {
            return d[returnDateCol] != null &&
                script.format_MY(script.parse_dmY(d[returnDateCol])) ===
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                script.parse_dmY(d[moveInDateCol]) != null &&
                script.parse_dmY(d[returnDateCol]) > script.parse_dmY(d[moveInDateCol]) &&
                d['Household Type'] === "Single Adult" &&
                d['Veteran Status'] === "Yes Validated"
        })

        const nulls = data.filter(d => {
            return d[returnDateCol] === null ||
                script.format_MY(script.parse_dmY(d[returnDateCol])) !=
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) ||
                script.parse_dmY(d[moveInDateCol]) === null ||
                script.parse_dmY(d[returnDateCol]) <= script.parse_dmY(d[moveInDateCol]) &&
                d['Household Type'] === "Single Adult" &&
                d['Veteran Status'] === "Yes Validated"
        })

        const uniqueArray = script.getColByName(filtered, uniqueCol);
        const nullArray = script.getColByName(nulls, uniqueCol);
        return [new Set(uniqueArray).size, new Set(nullArray).size];

        // Chronic
    } else if (target === "Chronic") {
        const filtered = data.filter(d => {
            return d[returnDateCol] != null &&
                script.format_MY(script.parse_dmY(d[returnDateCol])) ===
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                script.parse_dmY(d[moveInDateCol]) != null &&
                script.parse_dmY(d[returnDateCol]) > script.parse_dmY(d[moveInDateCol]) &&
                d['Household Type'] === "Single Adult" &&
                d['Chronic Status'] === "Chronically Homeless"
        })

        const nulls = data.filter(d => {
            return d[returnDateCol] === null ||
                script.format_MY(script.parse_dmY(d[returnDateCol])) !=
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) ||
                script.parse_dmY(d[moveInDateCol]) === null ||
                script.parse_dmY(d[returnDateCol]) <= script.parse_dmY(d[moveInDateCol]) &&
                d['Household Type'] === "Single Adult" &&
                d['Chronic Status'] === "Chronically Homeless"
        })


        const uniqueArray = script.getColByName(filtered, uniqueCol);
        const nullArray = script.getColByName(nulls, uniqueCol);
        return [new Set(uniqueArray).size, new Set(nullArray).size];


        // Youth
    } else if (target === "Youth") {
        const filtered = data.filter(d => {
            return d[returnDateCol] != null &&
                script.format_MY(script.parse_dmY(d[returnDateCol])) ===
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                script.parse_dmY(d[moveInDateCol]) != null &&
                script.parse_dmY(d[returnDateCol]) > script.parse_dmY(d[moveInDateCol]) &&
                d['Household Type'] === "Youth"
        })

        const nulls = data.filter(d => {
            return d[returnDateCol] === null ||
                script.format_MY(script.parse_dmY(d[returnDateCol])) !=
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) ||
                script.parse_dmY(d[moveInDateCol]) === null ||
                script.parse_dmY(d[returnDateCol]) <= script.parse_dmY(d[moveInDateCol]) &&
                d['Household Type'] === "Youth"
        })


        const uniqueArray = script.getColByName(filtered, uniqueCol);
        const nullArray = script.getColByName(nulls, uniqueCol);
        return [new Set(uniqueArray).size, new Set(nullArray).size];

        // Family
    } else if (target === "Family") {
        const filtered = data.filter(d => {
            return d[returnDateCol] != null &&
                script.format_MY(script.parse_dmY(d[returnDateCol])) ===
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                script.parse_dmY(d[moveInDateCol]) != null &&
                script.parse_dmY(d[returnDateCol]) > script.parse_dmY(d[moveInDateCol]) &&
                d['Household Type'] === "Family"
        })

        const nulls = data.filter(d => {
            return d[returnDateCol] === null ||
                script.format_MY(script.parse_dmY(d[returnDateCol])) !=
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) ||
                script.parse_dmY(d[moveInDateCol]) === null ||
                script.parse_dmY(d[returnDateCol]) <= script.parse_dmY(d[moveInDateCol]) &&
                d['Household Type'] === "Family"
        })


        const uniqueArray = script.getColByName(filtered, uniqueCol);
        const nullArray = script.getColByName(nulls, uniqueCol);
        return [new Set(uniqueArray).size, new Set(nullArray).size];

    } else return "Incorrect target chosen"

}



/* PRINT TO TABLE */
function printValue(population, calculation, result, nullValue) {
    d3.select('.agg-table')
        .append('div')
        .classed('agg-value', true)
        .html(`${population}`)

    d3.select('.agg-table')
        .append('div')
        .classed('agg-value', true)
        .html(`${calculation}`)

    d3.select('.agg-table')
        .append('div')
        .classed('agg-value', true)
        .html(`<b>${result}</b>`)

    d3.select('.agg-table')
        .append('div')
        .classed('agg-value', true)
        .html(`<b style='color:grey;'>${nullValue}</b>`)
}

function printHeader(value) {
    d3.select('.agg-table')
        .append('div')
        .classed('agg-spacer', true)
        .html(``)

    d3.select('.agg-table')
        .append('div')
        .classed('agg-spacer', true)
        .html(``)

    d3.select('.agg-table')
        .append('div')
        .classed('agg-spacer', true)
        .html(``)

    d3.select('.agg-table')
        .append('div')
        .classed('agg-spacer', true)
        .html(``)

    d3.select('.agg-table')
        .append('div')
        .classed('agg-header', true)
        .html(`${value}`)

    d3.select('.agg-table')
        .append('div')
        .classed('agg-header', true)
        .text(" ")

    d3.select('.agg-table')
        .append('div')
        .classed('agg-header', true)
        .text(" ")

    d3.select('.agg-table')
        .append('div')
        .classed('agg-header', true)
        .text(" ")
}