require('dotenv').config();
const d3 = require('d3')
const Papa = require('papaparse');
const stringSimilarity = require('string-similarity');



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

// Store output variables
let output = {
    srcHeaderMatches: [], // Source file headers that match required fields
    srcHeaderNoMatches: [], // Source file headers that DO NOT match required fields
    dictHeaderMatches: [], // Dictionary headers that match the source file
    dictHeaderNoMatches: [], // Dictionary headers that DO NOT match the source file
}


/* INITIALIZE APP */
/* function init() {
    val = new ValidatorEngine(state);
    agg = new AggregatorEngine(state);
}

init();
 */

/* GLOBAL HELPER FUNCTIONS */
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


/* EVENT LISTENERS */
let eventListeners = {

    // Community dropdown field
    communityInput: d3
        .select("#community-dropdown")
        .on("change", function () {
            state.meta_timestamp = script.formatTimestamp(Date.now());
            state.meta_community = this.value.replace(/[^A-Z0-9]/ig, "");
            state.meta_fileName_title = state.meta_community + state.meta_fileName_date + ".csv";
        }),

    // Reporting date input
    dateInput: d3
        .select("#date-input")
        .on("change", function () {
            state.meta_timestamp = script.formatTimestamp(Date.now());
            state.meta_reportingDate = script.formatReportingDate(script.parseDate(this.value));
            state.meta_fileName_date = script.formatFileDate(script.parseDate(this.value));
            state.meta_fileName_title = state.meta_community + state.meta_fileName_date + ".csv";
        }),

    // File Picker: call getFile() function
    filePicker: d3.select("#filePicker")
        .on("change", getFile, false),


    // Validate button: start 
    validateButton: d3
        .select("#fileSubmit")
        .on("click", function () {
            testHeaders(state.data_headers);
        }),


    /* Toggle additional information for validation steps */

    // Step 1: Headers
    toggleHeaderInfo: d3.select("#headers-name")
        .on('click', function () {
            state.section_headers_open = !state.section_headers_open;
            toggleStepInfo("#headers-info", "#headers-name-toggle", state.section_headers_open);
        }),

    // Required columns
    toggleRequiredInfo: d3.select("#required-name")
        .on('click', function () {
            state.section_required_open = !state.section_required_open;
            toggleStepInfo("#required-info", "#required-name-toggle", state.section_required_open);
        }),

    // Data type
    toggleDataTypeInfo: d3.select("#dataType-name")
        .on('click', function () {
            state.section_dataType_open = !state.section_dataType_open;
            toggleStepInfo("#dataType-info", "#dataType-name-toggle", state.section_dataType_open);
        }),

    // Social security numbers
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

let inputElement = document.getElementById("filePicker");
inputElement.addEventListener("change", getFile, false);



/* GET AND PARSE DATA */

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
}


/* VALIDATION STEP #1: TEST HEADERS */

function testHeaders(headerArray) {

    // Frontend update locations
    const stepLocation = d3.select("#headers-name");
    const resultLocation = d3.select(".headers-val-symbol");
    const errorLocation = d3.select(".header-error");

    // Set initial status of "testing"
    resultLocation.text("TESTING...").classed("neutral", true);

    // Set initial dictionary to column headers
    output.dictHeaderNoMatches = state.dict_headers_required;

    // Apply matchHeader function to file header array
    headerArray.map(header => {
        const a = stringSimilarity.findBestMatch(header, output.dictHeaderNoMatches);
        // If the Dice's coefficient falls below threshold, return null
        if (a.bestMatch.rating < state.data_diceCoefficient) {
            output.srcHeaderNoMatches.push(header)
        } else {
            output.srcHeaderMatches.push(header)
            output.dictHeaderMatches.push(a.bestMatch.target)
            output.dictHeaderNoMatches = script.arrayRemove(output.dictHeaderNoMatches, a.bestMatch.target)
        }
    });

    // If there is at least one lack of match, throw an error
    if (output.dictHeaderNoMatches.length > 0) {
        state.check_headers = false;
        resultLocation.text("NO PASS").classed("neutral", false);
        resultLocation.classed("fail", true);
        stepLocation.style("background-color", "#FFB9B9");
        errorLocation.html(`<h3>Result</h3><br>
        
        <b class='fail'>${output.dictHeaderNoMatches.length} / ${state.dict_headers_required.length} required headers DID NOT have a match in your file. <br> Please check that these column headers are included in your file and try again.</b>
        
        <ul class='list'> ${output.dictHeaderNoMatches.map(i => `<li><b>${i}</b></li>`).join('')} </ul> <br> 
        
        <b class='success'>${output.dictHeaderMatches.length} / ${state.dict_headers_required.length} required headers DID have a match in your file.</b> 
        
        <ul class='list'> ${output.srcHeaderMatches.map(i => `<li><b class='success'>${i}</b> in your file matched with <i>${output.dictHeaderMatches[output.srcHeaderMatches.indexOf(i)]}</i></li>`).join('')}</ul> <br>
    
        `);

    } else {
        state.check_headers = true;
        resultLocation.text("PASS").classed("neutral", false);
        resultLocation.classed("success", true);
        stepLocation.style("background-color", "lightblue");
        errorLocation.html(`<h3>Result</h3><br>
        
        <b class='success'>${output.dictHeaderMatches.length} / ${state.dict_headers_required.length} required headers DID have a match in your file.</b> 
        
        <ul class='list'> ${output.srcHeaderMatches.map(i => `<li><b class='success'>${i}</b> in your file matched with <i>${output.dictHeaderMatches[output.srcHeaderMatches.indexOf(i)]}</i></li>`).join('')}</ul> <br>`);
    }

    testSsn(state.data_headers, state.data_raw);
}


/* VALIDATION STEP #4: CHECK FOR SOCIAL SECURITY NUMBERS */

function testSsn(headerList, data) {

    // Frontend update locations
    const stepLocation = d3.select("#ssn-name");
    const resultLocation = d3.select(".ssn-val-symbol");
    const errorLocation = d3.select(".ssn-error");

    // Set initial status of "testing"
    resultLocation.text("TESTING...").classed("neutral", true);

    let col = 0;
    let ssnFail = [];
    let ssnPassed = [];

    for (col; col < headerList.length; col++) {
        const header = headerList[col]
        const output = testSsnInArray(script.getCol(data, col))

        if (output.length > 0) {
            ssnFail.push([header, output])
        } else {
            ssnPassed.push([header, output])
        }
    }

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
        state.check_headers = true;
        resultLocation.text("PASS").classed("neutral", false);
        resultLocation.classed("success", true);
        stepLocation.style("background-color", "lightblue");
        errorLocation.html(`<h3>Result</h3><br>
        ${ssnPassed.length} / ${headerList.length} columns passed.
        `);
    }



}


function testSsnInArray(arr) {

    // Tests each value against 
    let ssnTestResult = [];
    // 
    let ssnTestReduced = [];
    let indexOfFailedValues = [];
    let ssnColTestOutput;

    arr.map((value, index) => {
        /* console.log(value, index) */

        value = Number(value)

        let regex = [/^\d{3}-?\d{2}-?\d{4}$/, /^\d{3} ?\d{2} ?\d{4}$/, /\d{9}$/, /\d{4}$/];

        if (value != null) {
            const result = regex.map(i => {
                const pattern = new RegExp(i, "gim")
                const match = value.toString().match(pattern)
                if (match === null) {
                    return false;
                } else {
                    return value.toString() === match[0].toString();
                }
            });
            ssnTestResult.push([value, result]);
        } else if (value === null) {
            ssnTestResult.push([value, false]);
        }
    });

    for (let k = 0; k < arr.length; k++) {
        const col = ssnTestResult[k][1]
        const sum = col.reduce((a, b) => a + b)

        if (sum > 0) {
            indexOfFailedValues.push(k + 1)
        }

        ssnColTestOutput = indexOfFailedValues;
    }

    return ssnColTestOutput;
}