require('dotenv').config();
const d3 = require('d3');
const Papa = require('papaparse');
const stringSimilarity = require('string-similarity');

/* APPLICATION STATE */
let state = {
    required: false, // Toggle for required fields; makes for easier testing

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

    // All headers
    dict_headers_all: [
        'Date of Identification',
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

    // Required headers
    dict_headers_required: [
        'Date of Identification',
        'Homeless Start Date',
        'Housing Move-In Date',
        'Inactive Date',
        'Returned to Active Date',
        'Age',
        'Client ID',
        'BNL Status',
        'Household Type',
        'Household Size',
        'Chronic Status',
        'Veteran Status',
        'Ethnicity',
        'Race',
        'Gender',
    ],

    // Datatype options: date, num, alphanum, any
    dict_headers_datatype: [
        'date',
        'date',
        'date',
        'date',
        'date',
        'num',
        'num',
        'any',
        'any',
        'num',
        'any',
        'any',
        'any',
        'any',
        'any',
    ],

    datatype_errors: {
        date: `must be in the format <b style='color:black'>MM/DD/YYYY</b>, e.g. "12/31/2020".`,
        num: `must only contain <b style='color:black'>whole numbers</b>. e.g. "3"`,
        alphanum: `must only be <b style='color:black'>letters or numbers; no special characters</b>. e.g. "Yes (Confirmed)"`,
        any: `can accept any data type.`,
    },

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

checkFormStatus();

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

    getColByName: function getColByName(arr, columnName) {
        const col = [];

        for (let row = 0; row < arr.length - 1; row++) {
            const value = Object.values(arr)[row][columnName];
            col.push(value);
        }
        return col;
    },

    validate: function validate(value, dataType) {
        if (value === null) {
            return null
        } else if (dataType === "date") {
            const dateRegex = /(0?[1-9]|1[012])\/(0?[1-9]|[12][0-9]|3[01])\/\d{4}/;
            return dateRegex.test(value.toString())
        } else if (dataType === "num") {
            return Number.isInteger(value);
        } else if (dataType === "alphanum") {
            const alphanumRegex = /([^A-Z0-9])/gi
            return !alphanumRegex.test(value.toString())
        } else if (dataType === "any") {
            return true;
        } else return null;
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
                    state.data_headers = results.meta.fields;
                    state.data_length = results.data.length;
                },
            });
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
    datatype_open: false,

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
            section.datatype_open = false;
            // Open/close selected section, close all others
            section.toggle("#headers-info", "#headers-name-toggle", section.headers_open);
            section.toggle("#pii-info", "#pii-toggle", section.pii_open);
            section.toggle("#ssn-info", "#ssn-name-toggle", section.ssn_open);
            section.toggle("#datatype-info", "#datatype-name-toggle", section.datatype_open);
        }),

    togglePiiInfo: d3.select("#pii-name")
        .on('click', function () {
            // Set opposite status for selected section
            section.pii_open = !section.pii_open;
            section.headers_open = false;
            section.ssn_open = false;
            section.datatype_open = false;
            // Open/close selected section, close all others
            section.toggle("#pii-info", "#pii-toggle", section.pii_open);
            section.toggle("#headers-info", "#headers-name-toggle", section.headers_open);
            section.toggle("#ssn-info", "#ssn-name-toggle", section.ssn_open);
            section.toggle("#datatype-info", "#datatype-name-toggle", section.datatype_open);
        }),

    toggleSsnInfo: d3.select("#ssn-name")
        .on('click', function () {
            // Set opposite status for selected section
            section.ssn_open = !section.ssn_open;
            section.headers_open = false;
            section.pii_open = false;
            section.datatype_open = false;
            // Open/close selected section, close all others
            section.toggle("#ssn-info", "#ssn-name-toggle", section.ssn_open);
            section.toggle("#headers-info", "#headers-name-toggle", section.headers_open);
            section.toggle("#pii-info", "#pii-toggle", section.pii_open);
            section.toggle("#datatype-info", "#datatype-name-toggle", section.datatype_open);
        }),

    toggleDatatypeInfo: d3.select("#datatype-name")
        .on('click', function () {
            // Set opposite status for selected section
            section.datatype_open = !section.datatype_open;
            section.ssn_open = false;
            section.headers_open = false;
            section.pii_open = false;
            // Open/close selected section, close all others
            section.toggle("#datatype-info", "#datatype-name-toggle", section.datatype_open);
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

    d3.select("#filePicker").value = "";
}

/* RUN TESTS AND CHECK VALIDATION STATUS */
function runTests(headerArray, data) {
    const headersOutput = requiredHeadersTest(headerArray, d3.select("#headers-name"), d3.select(".headers-val-symbol"), d3.select(".header-error"));
    const piiOutput = piiHeadersTest(headerArray, d3.select("#pii-name"), d3.select(".pii-val-symbol"), d3.select(".pii-error"));
    const ssnOutput = ssnValuesTest(headerArray, data, d3.select("#ssn-name"), d3.select(".ssn-val-symbol"), d3.select(".ssn-error"));
    const datatypeOutput = dataTypeTest(headerArray, data, d3.select("#datatype-name"), d3.select(".datatype-val-symbol"), d3.select(".datatype-error"));

    checkTestStatus(headersOutput, piiOutput, ssnOutput, datatypeOutput);
}

function showResult(testResult, stepLocation, resultLocation, errorLocation, errorMessage, successMessage) {
    if (testResult === false) {
        resultLocation.text("NO PASS").classed("neutral", false);
        resultLocation.classed("fail", true);
        stepLocation
            .style("background-color", "#FFB9B9")
            .on('mouseover', function (d) {
                d3.select(this).style("background-color", "#ffa5a5")
            })
            .on('mouseout', function (d) {
                d3.select(this).style("background-color", "#FFB9B9")
            });
        errorLocation.html(errorMessage)
    } else {
        resultLocation.text("PASS").classed("neutral", false);
        resultLocation.text("PASS").classed("fail", false);
        resultLocation.classed("success", true);
        stepLocation
            .style("background-color", "lightblue")
            .on('mouseover', function (d) {
                d3.select(this).style("background-color", "#9ed1e1")
            })
            .on('mouseout', function (d) {
                d3.select(this).style("background-color", "lightblue")
            });
        errorLocation.html(successMessage)
    }
}

// Are all required headers present?
function requiredHeadersTest(headerArray, stepLocation, resultLocation, errorLocation) {
    const input = [...headerArray]
    const required = [...state.dict_headers_required];
    const passed = [];
    const failed = [];
    let result;

    // Which input headers match a required header?
    input
        .map(header => {
            if (required.includes(header)) {
                passed.push(header)
            } else {
                failed.push(header)
            }
        })

    // Which required headers are missing?
    const missing = [...required]
        .map(header => {
            if (passed.includes(header)) {
                return null
            } else return header
        })
        .filter(header => header != null)

    // Did the test result pass?
    if (missing.length === 0) {
        result = true
    } else if (missing.length > 0) {
        result = false
    }

    // Set the error message
    const errorMessage = `<h3>Result</h3><br>
        <b class='fail'>${missing.length} / ${required.length} required headers are not present (or named differently) in your file. <br></b>
        <ul class='list'> ${missing.map(i => `<li><b>${i}</b></li>`).join('')} </ul> <br> 
        <b class='success'>${passed.length} / ${required.length} required headers are present in your file.</b><br>
        <ul class='list'> ${passed.map(i => `<li><b class='success'>${i}</b></li>`).join('')}</ul><br>
        Please check that all ${required.length} required column headers are <b>present</b> in your file and <b>named correctly</b>, and try again.`

    // Set the success message
    const successMessage = `<h3>Result</h3><br>
    <b class='success'>Passed: All required headers are included in your file.</b>`

    // Show a message on the page based on the test result
    showResult(result, stepLocation, resultLocation, errorLocation, errorMessage, successMessage);

    return {
        passed,
        failed,
        missing,
        result
    }
}

// Are there headers that are PII?
function piiHeadersTest(headerArray, stepLocation, resultLocation, errorLocation) {
    const input = [...headerArray]
    const pii = [...state.dict_headers_remove];
    const passed = []
    const failed = [];
    let result;

    // Which input headers DO NOT match PII headers?
    input
        .map(header => {
            if (!pii.includes(header)) {
                passed.push(header)
            } else {
                failed.push(header)
            }
        })

    // Did the test result pass?
    if (failed.length === 0) {
        result = true;
    } else if (failed.length > 0) {
        result = false
    }

    // Set the error message
    const errorMessage = `<h3>Result</h3><br>
    <b class='fail'>${failed.length} column header(s) are flagged as potentially containing PII:</b>
    <ul> ${failed.map(i => `<li><b>${i}`).join('')}</ul> <br>
    Please remove the PII column(s) from your data file and try again.`

    // Set the success message
    const successMessage = `<h3>Result</h3><br>
    <b class='success'>Passed: No headers in your file are PII.</b>`

    // Show a message on the page based on the test result
    showResult(result, stepLocation, resultLocation, errorLocation, errorMessage, successMessage);

    return {
        passed,
        failed,
        result,
    }

}

// Are there values that resemble social security numbers?
function ssnValuesTest(headerArray, data, stepLocation, resultLocation, errorLocation) {
    let result;
    let regex = RegExp('^\\d{9}$');
    let failedHeaders = [];
    let failedIndices = [];

    const output = headerArray.map(header => {
        // Get the values for the header
        const arr = script.getColByName(data, header);
        // Map through each value and test against the regex pattern
        // If the test passes, return the index of the value
        const fail = arr.map((value, index) => {
            if (value === null) {
                return null
            } else if (regex.test(value.toString()) === true) {
                return index
            } else return null
        }).filter(value => value != null)
        // If at least one value failed, return the header with the failed indices
        if (fail.length > 0) {
            failedHeaders.push(header);
            failedIndices.push(fail)
            return [header, fail]
        } else return null
    }).filter(header => header != null)

    // Did the test result pass?
    if (output.length === 0) {
        result = true;
    } else if (output.length > 0) {
        result = false
    }

    const errorMessage = `<h3>Result</h3><br>
            <b>${output.length} / ${headerArray.length} columns</b> in your file contain values that could be Social Security Numbers. <b style='color:grey; font-weight:400;'> &nbsp (Potential SSNs include values with 9 digits or in the format ###-##-####)</b>. <br>
            <ul>
            ${output.map(value => `<li> <b class='fail'>${value[0]}</b> has <b>${value[1].length} potential SSN(s)</b> at the following location(s): &nbsp ${value[1].map(v => `<br> &nbsp &nbsp <b style='color:lightgrey;'>></b> Row <b>${v + 1}</b> &nbsp `).join('')}</li><br>`).join('')}
            </ul>
            Please remove the Social Security Numbers from your data file and try again.`

    // Set the success message
    const successMessage = `<h3>Result</h3><br>
    <b class='success'>Passed: No values in your file are Social Security Numbers.</b>`

    // Show a message on the page based on the test result
    showResult(result, stepLocation, resultLocation, errorLocation, errorMessage, successMessage);

    return {
        failedHeaders,
        failedIndices,
        output,
        result
    }
}

// Do required headers contain the right data type?
function dataTypeTest(headerArray, data, stepLocation, resultLocation, errorLocation) {
    let result;
    let failedHeaders = [];
    const requiredHeaders = [...state.dict_headers_required];
    const dataTypes = [...state.dict_headers_datatype]
    const dataTypeLookup = requiredHeaders.map((value, index) => {
        const r = {}
        r[value] = dataTypes[index]
        return r
    })

    const output = headerArray.map((header) => {
        // If the header is in the required header list...
        if (requiredHeaders.includes(header)) {
            // Find the datatype that it needs to be
            const lookupIndex = requiredHeaders.indexOf(header)
            let dataType = Object.values(dataTypeLookup[lookupIndex]).toString();
            let errorMessage = state.datatype_errors[dataType];

            // Get the array of values for the header
            const arr = script.getColByName(data, header);
            const values = [];
            const indices = []

            // Loop through each value and check the datatype
            const fail = arr.map((value, index) => {
                if (value === null) {
                    return null
                } else if (script.validate(value, dataType) === false) {
                    values.push(value)
                    indices.push(index)
                    return value & index
                } else return null
            }).filter(value => value != null)

            // If at least one value failed, return the header with the failed indices
            if (fail.length > 0) {
                failedHeaders.push(header);
                const r = {
                    header: header,
                    failedValues: values,
                    failedIndices: indices,
                    errorMessage: errorMessage
                };
                return r
            } else return null
        } else return null
    }).filter(header => header != null)

    // Did the test result pass?
    if (output.length === 0) {
        result = true;
    } else if (output.length > 0) {
        result = false
    }

    const messages = [];

    Object.entries(output).forEach(([key, value]) => {
        messages.push(`<ul><li><b class='fail'>${value.header}</b><b class='neutral'> contains <b style='color:black;'>${value.failedIndices.length} value(s)</b> to fix. These values ${value.errorMessage}</b></li></ul>`)
        value.failedValues.map((v, index) => {
            const str = `<b style='padding: 0px 0px 0px 50px; font-weight:400;'><b style='color:lightgrey;'>></b> &nbsp <b>Row ${value.failedIndices[index] + 1}</b> contains the value <b>'${v}'</b>.<br></b>`
            messages.push(str)
        })
    })

    // Set the error message
    const errorMessage = `<h3>Result</h3><br>
    <b>Please fix the following errors:</b><br>
    ${messages.join('')}`

    // Set the success message
    const successMessage = `<h3>Result</h3><br><b class='success'>Passed: Your fields contain the right data types.</b>`

    // Show a message on the page based on the test result
    showResult(result, stepLocation, resultLocation, errorLocation, errorMessage, successMessage);


    return {
        output,
        failedHeaders,
        result
    }

}


/* STATUS CHECKING */

// Status of form fields
function checkFormStatus() {
    if (state.required === true) {
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
        }
    } else if (state.required === false) {
        console.log("%c Required fields are currently OFF.", 'background: white; color: red');
        d3.select("#validateButton").classed("inactive", false);
        d3.select("#validateButton").classed("active", true);
        d3.select("#validateButton").attr("disabled", null);
        d3.select(".validateBtn-msg").text("");
    }
}

// Status of validation tests
function checkTestStatus(headersOutput, piiOutput, ssnOutput, datatypeOutput) {

    if (
        headersOutput.result === false ||
        piiOutput.result === false ||
        ssnOutput.result === false ||
        datatypeOutput.result === false
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
        d3.select("#reupload-button").classed("hide", false);
        // Reset values
        resetValues();
    } else if (
        headersOutput.result === true &&
        piiOutput.result === true &&
        ssnOutput.result === true &&
        datatypeOutput.result === true
    ) {
        // Success: All of the tests passed
        // Activate the submit button
        d3.select("#aggregateButton").classed("inactive", false);
        d3.select("#aggregateButton").classed("active", true);
        d3.select("#aggregateButton").attr("disabled", null);
        d3.select("#aggregateButton").classed("hide", false);
        d3.select("#reupload-button").classed("hide", true);

        // Inactivate the validate button
        d3.select("#validateButton").classed("inactive", true);
        d3.select("#validateButton").classed("active", false);
        d3.select("#validateButton").attr("disabled", true);
    }
}

d3.select("#reupload-button")
    .on("click", function () {
        location.reload();
    })

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
    all.AvgTime = calcLOT(state.data_raw, "All", "Housing Move-In Date", "Date of Identification");
    all.AvgTime_null = "N/A";
    all.HP = calcDate(state.data_raw, "All", "Housing Move-In Date", "Client ID")[0];
    all.HP_null = calcDate(state.data_raw, "All", "Housing Move-In Date", "Client ID")[1];
    all.Inactive = calcDate(state.data_raw, "All", "Inactive Date", "Client ID")[0];
    all.Inactive_null = calcDate(state.data_raw, "All", "Inactive Date", "Client ID")[1];
    all.NewId = calcDate(state.data_raw, "All", "Date of Identification", "Client ID")[0];
    all.NewId_null = calcDate(state.data_raw, "All", "Date of Identification", "Client ID")[1];
    all.RetHousing = calcReturn(state.data_raw, "All", "Returned to Active Date", "Housing Move-In Date", "Client ID")[0];
    all.RetHousing_null = calcReturn(state.data_raw, "All", "Returned to Active Date", "Housing Move-In Date", "Client ID")[1];
    all.RetInactive = calcReturn(state.data_raw, "All", "Returned to Active Date", "Inactive Date", "Client ID")[0];
    all.RetInactive_null = calcReturn(state.data_raw, "All", "Returned to Active Date", "Inactive Date", "Client ID")[1];

    /* CHRONIC */
    chronic.AH = calcAH(state.data_raw, "Chronic", "Client ID")[0];
    chronic.AH_null = calcAH(state.data_raw, "Chronic", "Client ID")[1];
    chronic.AvgTime = calcLOT(state.data_raw, "Chronic", "Housing Move-In Date", "Date of Identification");
    chronic.AvgTime_null = "N/A";
    chronic.HP = calcDate(state.data_raw, "Chronic", "Housing Move-In Date", "Client ID")[0];
    chronic.HP_null = calcDate(state.data_raw, "Chronic", "Housing Move-In Date", "Client ID")[1];
    chronic.Inactive = calcDate(state.data_raw, "Chronic", "Inactive Date", "Client ID")[0];
    chronic.Inactive_null = calcDate(state.data_raw, "Chronic", "Inactive Date", "Client ID")[1];
    chronic.NewId = calcDate(state.data_raw, "Chronic", "Date of Identification", "Client ID")[0];
    chronic.NewId_null = calcDate(state.data_raw, "Chronic", "Date of Identification", "Client ID")[1];
    chronic.RetHousing = calcReturn(state.data_raw, "Chronic", "Returned to Active Date", "Housing Move-In Date", "Client ID")[0];
    chronic.RetHousing_null = calcReturn(state.data_raw, "Chronic", "Returned to Active Date", "Housing Move-In Date", "Client ID")[1];
    chronic.RetInactive = calcReturn(state.data_raw, "Chronic", "Returned to Active Date", "Inactive Date", "Client ID")[0];
    chronic.RetInactive_null = calcReturn(state.data_raw, "Chronic", "Returned to Active Date", "Inactive Date", "Client ID")[1];

    /* VETERAN */
    veteran.AH = calcAH(state.data_raw, "Veteran", "Client ID")[0];
    veteran.AH_null = calcAH(state.data_raw, "Veteran", "Client ID")[1];
    veteran.AvgTime = calcLOT(state.data_raw, "Veteran", "Housing Move-In Date", "Date of Identification");
    veteran.AvgTime_null = "N/A";
    veteran.HP = calcDate(state.data_raw, "Veteran", "Housing Move-In Date", "Client ID")[0];
    veteran.HP_null = calcDate(state.data_raw, "Veteran", "Housing Move-In Date", "Client ID")[1];
    veteran.Inactive = calcDate(state.data_raw, "Veteran", "Inactive Date", "Client ID")[0];
    veteran.Inactive_null = calcDate(state.data_raw, "Veteran", "Inactive Date", "Client ID")[1];
    veteran.NewId = calcDate(state.data_raw, "Veteran", "Date of Identification", "Client ID")[0];
    veteran.NewId_null = calcDate(state.data_raw, "Veteran", "Date of Identification", "Client ID")[1];
    veteran.RetHousing = calcReturn(state.data_raw, "Veteran", "Returned to Active Date", "Housing Move-In Date", "Client ID")[0];
    veteran.RetHousing_null = calcReturn(state.data_raw, "Veteran", "Returned to Active Date", "Housing Move-In Date", "Client ID")[1];
    veteran.RetInactive = calcReturn(state.data_raw, "Veteran", "Returned to Active Date", "Inactive Date", "Client ID")[0];
    veteran.RetInactive_null = calcReturn(state.data_raw, "Veteran", "Returned to Active Date", "Inactive Date", "Client ID")[1];

    /* YOUTH */
    youth.AH = calcAH(state.data_raw, "Youth", "Client ID")[0];
    youth.AH_null = calcAH(state.data_raw, "Youth", "Client ID")[1];
    youth.AvgTime = calcLOT(state.data_raw, "Youth", "Housing Move-In Date", "Date of Identification");
    youth.AvgTime_null = "N/A";
    youth.HP = calcDate(state.data_raw, "Youth", "Housing Move-In Date", "Client ID")[0];
    youth.HP_null = calcDate(state.data_raw, "Youth", "Housing Move-In Date", "Client ID")[1];
    youth.Inactive = calcDate(state.data_raw, "Youth", "Inactive Date", "Client ID")[0];
    youth.Inactive_null = calcDate(state.data_raw, "Youth", "Inactive Date", "Client ID")[1];
    youth.NewId = calcDate(state.data_raw, "Youth", "Date of Identification", "Client ID")[0];
    youth.NewId_null = calcDate(state.data_raw, "Youth", "Date of Identification", "Client ID")[1];
    youth.RetHousing = calcReturn(state.data_raw, "Youth", "Returned to Active Date", "Housing Move-In Date", "Client ID")[0];
    youth.RetHousing_null = calcReturn(state.data_raw, "Youth", "Returned to Active Date", "Housing Move-In Date", "Client ID")[1];
    youth.RetInactive = calcReturn(state.data_raw, "Youth", "Returned to Active Date", "Inactive Date", "Client ID")[0];
    youth.RetInactive_null = calcReturn(state.data_raw, "Youth", "Returned to Active Date", "Inactive Date", "Client ID")[1];

    /* FAMILY */
    family.AH = calcAH(state.data_raw, "Family", "Client ID")[0];
    family.AH_null = calcAH(state.data_raw, "Family", "Client ID")[1];
    family.AvgTime = calcLOT(state.data_raw, "Family", "Housing Move-In Date", "Date of Identification");
    family.AvgTime_null = "N/A";
    family.HP = calcDate(state.data_raw, "Family", "Housing Move-In Date", "Client ID")[0];
    family.HP_null = calcDate(state.data_raw, "Family", "Housing Move-In Date", "Client ID")[1];
    family.Inactive = calcDate(state.data_raw, "Family", "Inactive Date", "Client ID")[0];
    family.Inactive_null = calcDate(state.data_raw, "Family", "Inactive Date", "Client ID")[1];
    family.NewId = calcDate(state.data_raw, "Family", "Date of Identification", "Client ID")[0];
    family.NewId_null = calcDate(state.data_raw, "Family", "Date of Identification", "Client ID")[1];
    family.RetHousing = calcReturn(state.data_raw, "Family", "Returned to Active Date", "Housing Move-In Date", "Client ID")[0];
    family.RetHousing_null = calcReturn(state.data_raw, "Family", "Returned to Active Date", "Housing Move-In Date", "Client ID")[1];
    family.RetInactive = calcReturn(state.data_raw, "Family", "Returned to Active Date", "Inactive Date", "Client ID")[0];
    family.RetInactive_null = calcReturn(state.data_raw, "Family", "Returned to Active Date", "Inactive Date", "Client ID")[1];


    /* PRINT */
    printHeader("All")
    printValue("All", "Actively Homeless", all.AH, all.AH_null)
    printValue("All", "Housing Placements", all.HP, all.HP_null)
    printValue("All", "Moved to Inactive", all.Inactive, all.Inactive_null)
    printValue("All", "Newly Identified Inflow", all.NewId, all.NewId_null)
    printValue("All", "Returned to Active from Housing", all.RetHousing, all.RetHousing_null)
    printValue("All", "Returned to Active from Inactive", all.RetInactive, all.RetInactive_null)
    printValue("All", "Length of Time from ID to Housing", all.AvgTime, all.AvgTime_null)

    printHeader("Chronic")
    printValue("Chronic", "Actively Homeless", chronic.AH, chronic.AH_null)
    printValue("Chronic", "Housing Placements", chronic.HP, chronic.HP_null)
    printValue("Chronic", "Moved to Inactive", chronic.Inactive, chronic.Inactive_null)
    printValue("Chronic", "Newly Identified Inflow", chronic.NewId, chronic.NewId_null)
    printValue("Chronic", "Returned to Active from Housing", chronic.RetHousing, chronic.RetHousing_null)
    printValue("Chronic", "Returned to Active from Inactive", chronic.RetInactive, chronic.RetInactive_null)
    printValue("Chronic", "Length of Time from ID to Housing", chronic.AvgTime, chronic.AvgTime_null)

    printHeader("Veteran")
    printValue("Veteran", "Actively Homeless", veteran.AH, veteran.AH_null)
    printValue("Veteran", "Housing Placements", veteran.HP, veteran.HP_null)
    printValue("Veteran", "Moved to Inactive", veteran.Inactive, veteran.Inactive_null)
    printValue("Veteran", "Newly Identified Inflow", veteran.NewId, veteran.NewId_null)
    printValue("Veteran", "Returned to Active from Housing", veteran.RetHousing, veteran.RetHousing_null)
    printValue("Veteran", "Returned to Active from Inactive", veteran.RetInactive, veteran.RetInactive_null)
    printValue("Veteran", "Length of Time from ID to Housing", veteran.AvgTime, veteran.AvgTime_null)

    printHeader("Youth")
    printValue("Youth", "Actively Homeless", youth.AH, youth.AH_null)
    printValue("Youth", "Housing Placements", youth.HP, youth.HP_null)
    printValue("Youth", "Moved to Inactive", youth.Inactive, youth.Inactive_null)
    printValue("Youth", "Newly Identified Inflow", youth.NewId, youth.NewId_null)
    printValue("Youth", "Returned to Active from Housing", youth.RetHousing, youth.RetHousing_null)
    printValue("Youth", "Returned to Active from Inactive", youth.RetInactive, youth.RetInactive_null)
    printValue("Youth", "Length of Time from ID to Housing", youth.AvgTime, youth.AvgTime_null)

    printHeader("Family")
    printValue("Family", "Actively Homeless", family.AH, family.AH_null)
    printValue("Family", "Housing Placements", family.HP, family.HP_null)
    printValue("Family", "Moved to Inactive", family.Inactive, family.Inactive_null)
    printValue("Family", "Newly Identified Inflow", family.NewId, family.NewId_null)
    printValue("Family", "Returned to Active from Housing", family.RetHousing, family.RetHousing_null)
    printValue("Family", "Returned to Active from Inactive", family.RetInactive, family.RetInactive_null)
    printValue("Family", "Length of Time from ID to Housing", family.AvgTime, family.AvgTime_null)

}

/* 
 *ACTIVELY HOMELESS NUMBER
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
 *COMPARE A MONTH / YEAR TO THE REPORTING MONTH / YEAR
 */
function calcDate(data, target, comparisonDate, uniqueCol) {

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
 *RETURNED TO ACTIVE FROM HOUSING & INACTIVE
 */
function calcReturn(data, target, returnDateCol, comparisonCol, uniqueCol) {

    // All
    if (target === "All") {
        const filtered = data.filter(d => {
            return d[returnDateCol] != null &&
                script.format_MY(script.parse_dmY(d[returnDateCol])) ===
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                script.parse_dmY(d[comparisonCol]) != null &&
                script.parse_dmY(d[returnDateCol]) > script.parse_dmY(d[comparisonCol])
        })

        const nulls = data.filter(d => {
            return d[returnDateCol] === null ||
                script.format_MY(script.parse_dmY(d[returnDateCol])) !=
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) ||
                script.parse_dmY(d[comparisonCol]) === null ||
                script.parse_dmY(d[returnDateCol]) <= script.parse_dmY(d[comparisonCol])
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
                script.parse_dmY(d[comparisonCol]) != null &&
                script.parse_dmY(d[returnDateCol]) > script.parse_dmY(d[comparisonCol]) &&
                d['Household Type'] === "Single Adult" &&
                d['Veteran Status'] === "Yes Validated"
        })

        const nulls = data.filter(d => {
            return d[returnDateCol] === null ||
                script.format_MY(script.parse_dmY(d[returnDateCol])) !=
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) ||
                script.parse_dmY(d[comparisonCol]) === null ||
                script.parse_dmY(d[returnDateCol]) <= script.parse_dmY(d[comparisonCol]) &&
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
                script.parse_dmY(d[comparisonCol]) != null &&
                script.parse_dmY(d[returnDateCol]) > script.parse_dmY(d[comparisonCol]) &&
                d['Household Type'] === "Single Adult" &&
                d['Chronic Status'] === "Chronically Homeless"
        })

        const nulls = data.filter(d => {
            return d[returnDateCol] === null ||
                script.format_MY(script.parse_dmY(d[returnDateCol])) !=
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) ||
                script.parse_dmY(d[comparisonCol]) === null ||
                script.parse_dmY(d[returnDateCol]) <= script.parse_dmY(d[comparisonCol]) &&
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
                script.parse_dmY(d[comparisonCol]) != null &&
                script.parse_dmY(d[returnDateCol]) > script.parse_dmY(d[comparisonCol]) &&
                d['Household Type'] === "Youth"
        })

        const nulls = data.filter(d => {
            return d[returnDateCol] === null ||
                script.format_MY(script.parse_dmY(d[returnDateCol])) !=
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) ||
                script.parse_dmY(d[comparisonCol]) === null ||
                script.parse_dmY(d[returnDateCol]) <= script.parse_dmY(d[comparisonCol]) &&
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
                script.parse_dmY(d[comparisonCol]) != null &&
                script.parse_dmY(d[returnDateCol]) > script.parse_dmY(d[comparisonCol]) &&
                d['Household Type'] === "Family"
        })

        const nulls = data.filter(d => {
            return d[returnDateCol] === null ||
                script.format_MY(script.parse_dmY(d[returnDateCol])) !=
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) ||
                script.parse_dmY(d[comparisonCol]) === null ||
                script.parse_dmY(d[returnDateCol]) <= script.parse_dmY(d[comparisonCol]) &&
                d['Household Type'] === "Family"
        })


        const uniqueArray = script.getColByName(filtered, uniqueCol);
        const nullArray = script.getColByName(nulls, uniqueCol);
        return [new Set(uniqueArray).size, new Set(nullArray).size];

    } else return "Incorrect target chosen"

}

/*
 *CALCULATE LENGTH OF TIME
 */
function calcLOT(data, target, comparisonCol, idCol) {

    // All
    if (target === "All") {
        const filtered = data.filter(d => {
            return d[comparisonCol] != null &&
                d[idCol] != null &&
                script.format_MY(script.parse_dmY(d[comparisonCol])) ===
                script.format_MY(script.parse_Ymd(state.form_reporting_date))
        })

        const moveInDateValues = script.getColByName(filtered, comparisonCol);
        const idDateValues = script.getColByName(filtered, idCol);
        const diffValues = [];

        for (let row = 0; row < filtered.length; row++) {
            const diff = script.parse_dmY(moveInDateValues[row]) - script.parse_dmY(idDateValues[row])
            diffValues.push(Math.ceil(diff / (1000 * 60 * 60 * 24)));
        }

        const average = Math.floor(diffValues.reduce((a, b) => a + b, 0) / diffValues.length);
        return average;


        // Veteran
    } else if (target === "Veteran") {
        const filtered = data.filter(d => {
            return d[comparisonCol] != null &&
                d[idCol] != null &&
                script.format_MY(script.parse_dmY(d[comparisonCol])) ===
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                d['Household Type'] === "Single Adult" &&
                d['Veteran Status'] === "Yes Validated"
        })

        const moveInDateValues = script.getColByName(filtered, comparisonCol);
        const idDateValues = script.getColByName(filtered, idCol);
        const diffValues = [];

        for (let row = 0; row < filtered.length; row++) {
            const diff = script.parse_dmY(moveInDateValues[row]) - script.parse_dmY(idDateValues[row])
            diffValues.push(Math.ceil(diff / (1000 * 60 * 60 * 24)));
        }

        const average = Math.floor(diffValues.reduce((a, b) => a + b, 0) / diffValues.length);
        return average;

        // Chronic
    } else if (target === "Chronic") {
        const filtered = data.filter(d => {
            return d[comparisonCol] != null &&
                d[idCol] != null &&
                script.format_MY(script.parse_dmY(d[comparisonCol])) ===
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                d['Household Type'] === "Single Adult" &&
                d['Chronic Status'] === "Chronically Homeless"
        })

        const moveInDateValues = script.getColByName(filtered, comparisonCol);
        const idDateValues = script.getColByName(filtered, idCol);
        const diffValues = [];

        for (let row = 0; row < filtered.length; row++) {
            const diff = script.parse_dmY(moveInDateValues[row]) - script.parse_dmY(idDateValues[row])
            diffValues.push(Math.ceil(diff / (1000 * 60 * 60 * 24)));
        }

        const average = Math.floor(diffValues.reduce((a, b) => a + b, 0) / diffValues.length);
        return average;


        // Youth
    } else if (target === "Youth") {
        const filtered = data.filter(d => {
            return d[comparisonCol] != null &&
                d[idCol] != null &&
                script.format_MY(script.parse_dmY(d[comparisonCol])) ===
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                d['Household Type'] === "Youth"
        })

        const moveInDateValues = script.getColByName(filtered, comparisonCol);
        const idDateValues = script.getColByName(filtered, idCol);
        const diffValues = [];

        for (let row = 0; row < filtered.length; row++) {
            const diff = script.parse_dmY(moveInDateValues[row]) - script.parse_dmY(idDateValues[row])
            diffValues.push(Math.ceil(diff / (1000 * 60 * 60 * 24)));
        }

        const average = Math.floor(diffValues.reduce((a, b) => a + b, 0) / diffValues.length);
        return average;

        // Family
    } else if (target === "Family") {
        const filtered = data.filter(d => {
            return d[comparisonCol] != null &&
                d[idCol] != null &&
                script.format_MY(script.parse_dmY(d[comparisonCol])) ===
                script.format_MY(script.parse_Ymd(state.form_reporting_date)) &&
                d['Household Type'] === "Family"
        })

        const moveInDateValues = script.getColByName(filtered, comparisonCol);
        const idDateValues = script.getColByName(filtered, idCol);
        const diffValues = [];

        for (let row = 0; row < filtered.length; row++) {
            const diff = script.parse_dmY(moveInDateValues[row]) - script.parse_dmY(idDateValues[row])
            diffValues.push(Math.ceil(diff / (1000 * 60 * 60 * 24)));
        }

        const average = Math.floor(diffValues.reduce((a, b) => a + b, 0) / diffValues.length);
        return average;

    } else return "Incorrect target chosen"

}


/*
 * PRINT TO TABLE
 */
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
        .text("Calculation")

    d3.select('.agg-table')
        .append('div')
        .classed('agg-header', true)
        .text("Result")

    d3.select('.agg-table')
        .append('div')
        .classed('agg-header', true)
        .text("Nulls")
}


/* 
 * WRITE TO GOOGLE SHEETS
 */

// Client ID and API key from the Developer Console
const sheetID = "1vr2jahJzoSfdekaPwzNDJ06VueEF1wIqVOcABH6bCdU"

let d;


function readJson(sheetId, sheetNumber) {
    const url = `https://spreadsheets.google.com/feeds/cells/${sheetId}/${sheetNumber}/public/full?alt=json`
    d3.json(url).then(function (data) {
        processJson(data, data.feed.entry);
    })
}

function processJson(data, entries) {
    let rawJson = data;
    let rawData = entries;
}

readJson("1vr2jahJzoSfdekaPwzNDJ06VueEF1wIqVOcABH6bCdU", 1);