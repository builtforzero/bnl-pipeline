require('dotenv').config();
const d3 = require('d3')
const Papa = require('papaparse');
const stringSimilarity = require('string-similarity');



let state = {
    // Validation checks pass/fail
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
    data_headers: null,
    data_length: null,
    data_diceCoefficient: 0.6, // How sensitive should fuzzy matching be?

    // Open/close HTML sections
    section_headers_open: false,
    section_pii_open: false,
    section_ssn_open: false,

    // Dictionary of all headers
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

// Store output variables
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

/* GLOBAL HELPER SCRIPTS */
let script = {
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
            .html(`<br><b class='${className}'>${message}</b> <b style='color:gray;'> | ${script.formatTime(Date.now())} </b>` + "<br>")
    },

    overwriteStatus: function overwriteStatus(location, className, message) {
        d3.select(location)
            .html(`<br><b class='${className}'>${message}</b> <b style='color:gray;'> | ${script.formatTime(Date.now())} </b>` + "<br>")
    },

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
}

checkFormStatus();

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
            state.meta_timestamp = script.formatTimestamp(Date.now());
            state.meta_fileName_title = state.meta_community + state.meta_fileName_date + ".csv";
        }),

    // Reporting date input
    dateInput: d3
        .select("#date-input")
        .on("change", function () {
            state.form_reporting_date = this.value;
            state.meta_reportingDate = script.formatReportingDate(script.parseDate(state.form_reporting_date));
            state.meta_fileName_date = script.formatFileDate(script.parseDate(state.form_reporting_date));
            // Name of file upload
            state.meta_timestamp = script.formatTimestamp(Date.now());
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
                    parseData(results.data, results.meta);
                },
            });
        }),

    // Reupload button
    reupload: d3.select(".submitBtn-msg")
        .on("click", function () {
            location.reload();
        }),


    // Validate button: start 
    validateButton: d3
        .select("#validateButton")
        .on("click", function () {
            testRequiredHeaders(state.data_headers, state);
            resetValues();
        }),

    submitButton: d3
        .select("#submitButton"),


    /* Toggle additional information for validation steps */

    // Step 1: Required Headers
    toggleHeaderInfo: d3.select("#headers-name")
        .on('click', function () {
            state.section_headers_open = !state.section_headers_open;
            toggleStepInfo("#headers-info", "#headers-name-toggle", state.section_headers_open);
        }),

    // Step 2: PII Headers
    togglePiiInfo: d3.select("#pii-name")
        .on('click', function () {
            state.section_pii_open = !state.section_pii_open;
            toggleStepInfo("#pii-info", "#pii-toggle", state.section_pii_open);
        }),

    // Step 3: SSNs
    toggleSsnInfo: d3.select("#ssn-name")
        .on('click', function () {
            state.section_ssn_open = !state.section_ssn_open;
            toggleStepInfo("#ssn-info", "#ssn-name-toggle", state.section_ssn_open);
        }),

}


/* VALIDATION STEP INFO OPEN / CLOSE FUNCTIONS */
function openStepInfo(infoLocation, toggleLocation) {

    d3.select(infoLocation)
        .style("opacity", "0")
        .transition()
        .duration(200)
        .style("opacity", "1")

    d3.select(infoLocation).classed("hide", false)

    d3.select(toggleLocation)
        .text("HIDE DETAILS ▲")
}

function closeStepInfo(infoLocation, toggleLocation) {

    d3.select(infoLocation)
        .style("opacity", "1")
        .transition()
        .duration(200)
        .style("opacity", "0")

    d3.select(infoLocation).classed("hide", true)

    d3.select(toggleLocation)
        .text("SHOW DETAILS ▼")
}

function toggleStepInfo(infoLocation, toggleLocation, stateField) {
    if (stateField === true) {
        openStepInfo(infoLocation, toggleLocation)
    } else closeStepInfo(infoLocation, toggleLocation)
}

function parseData(data, meta) {
    state.data_raw = data;
    state.data_headers = meta.fields;
    state.data_length = data.length;
}


/* VALIDATION STEP #1: TEST FOR REQUIRED HEADERS */
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
        const a = stringSimilarity.findBestMatch(header, output.dictHeadersNoMatches);
        // If the Dice's coefficient falls below threshold, return null
        if (a.bestMatch.rating < 0.4) {
            output.srcHeaderNoMatches.push(header)
        } else {
            output.srcHeaderMatches.push(header)
            output.dictHeaderMatches.push(a.bestMatch.target)
            output.dictHeadersNoMatches = script.arrayRemove(output.dictHeadersNoMatches, a.bestMatch.target)
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

    testPiiHeaders(state.data_headers, state);
}


/* VALIDATION STEP #2: TEST FOR PII HEADERS */
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

    testSsn(state.data_headers, state.data_raw, state);
}


/* VALIDATION STEP #3: CHECK FOR SOCIAL SECURITY NUMBERS */
function testSsn(headerList, data, state) {
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
    for (let col = 0; col < headerList.length; col++) {
        const header = headerList[col]
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
            <b>${ssnFail.length} / ${headerList.length} columns</b> in your file contain values that could be Social Security Numbers. <b style='color:grey; font-weight:400;'> &nbsp (Potential SSNs include values with 9 digits, 4 digits, or in the format ###-##-####)</b>. <br>
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

    checkValidationStatus(state);

}

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


/* FORM VALIDATION */

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
        d3.select(".submitBtn-msg").html("");
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
        d3.select(".submitBtn-msg").text("");
    }
}

function checkValidationStatus() {
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
        d3.select("#submitButton").classed("inactive", true);
        d3.select("#submitButton").classed("active", false);
        d3.select("#submitButton").attr("disabled", true);
        d3.select("#submitButton").classed("hide", true);
        // Reset values
        resetValues();
        // Add a reupload button instead
        d3.select(".submitBtn-msg").html(`
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
        d3.select("#submitButton").classed("inactive", false);
        d3.select("#submitButton").classed("active", true);
        d3.select("#submitButton").attr("disabled", null);
        d3.select("#submitButton").classed("hide", false);
        // Replace the error helptext
        d3.select(".submitBtn-msg").html(`
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