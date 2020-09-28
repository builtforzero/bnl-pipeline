require("dotenv").config();
const d3 = require("d3");
const Papa = require("papaparse");
const partition = require("lodash.partition");

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
  data_csv: null,

  // All headers
  dict_headers_all: [
    "Date of Identification",
    "Homeless Start Date",
    "Housing Move-In Date",
    "Inactive Date",
    "Returned to Active Date",
    "Age",
    "Client ID",
    "Household ID",
    "BNL Status",
    "Literal Homeless Status",
    "Household Type",
    "Chronic Status",
    "Veteran Status",
    "Ethnicity",
    "Race",
    "Gender",
    "Current Living Situation",
    "Disabling Condition - General",
    "Disabling Condition - HIV/AIDS Diagnosis",
    "Disabling Condition - Mental Health Condition",
    "Disabling Condition - Physical Disability",
    "Disabling Condition - DA Abuse",
  ],

  // Required headers
  dict_headers_required: [
    "Date of Identification",
    "Homeless Start Date",
    "Housing Move-In Date",
    "Inactive Date",
    "Returned to Active Date",
    "Age",
    "Client ID",
    "BNL Status",
    "Household Type",
    "Household Size",
    "Chronic Status",
    "Veteran Status",
    "Ethnicity",
    "Race",
    "Gender",
  ],

  // Datatype options: date, num, alphanum, any
  dict_headers_datatype: [
    "date",
    "date",
    "date",
    "date",
    "date",
    "num",
    "num",
    "any",
    "any",
    "num",
    "any",
    "any",
    "any",
    "any",
    "any",
  ],

  datatype_errors: {
    date: `must be in the format <b style='color:black'>MM/DD/YYYY</b>, e.g. "12/31/2020".`,
    num: `must only contain <b style='color:black'>whole numbers</b>. e.g. "3"`,
    alphanum: `must only be <b style='color:black'>letters or numbers; no special characters</b>. e.g. "Yes (Confirmed)"`,
    any: `can accept any data type.`,
  },

  // Banned headers
  dict_headers_remove: [
    "Social Security Number",
    "SSN",
    "Last 4",
    "First Name",
    "Last Name",
    "Name",
    "Birthday",
    "Date of Birth",
    "DOB",
  ],

  // Fields in the final file
  dict_fields: [
    "Timestamp",
    "Community",
    "Month",
    "Name",
    "Email Address",
    "Organization",
    "Population",
    "Subpopulation",
    "Demographic",
    "Actively Homeless",
    "Length of Time from ID to Housing",
    "Housing Placements",
    "Moved to Inactive",
    "Newly Identified Inflow",
    "Returned to Active from Housing",
    "Returned to Active from Inactive",
  ],
};

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
    const columnName = state.data_headers[columnIndex];
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

  // Validate a value based on its data types
  validate: function validate(value, dataType) {
    if (value === null) {
      return null;
    } else if (dataType === "date") {
      const dateRegex = /(0?[1-9]|1[012])\/(0?[1-9]|[12][0-9]|3[01])\/\d{4}/;
      return dateRegex.test(value.toString());
    } else if (dataType === "num") {
      return Number.isInteger(value);
    } else if (dataType === "alphanum") {
      const alphanumRegex = /([^A-Z0-9])/gi;
      return !alphanumRegex.test(value.toString());
    } else if (dataType === "any") {
      return true;
    } else return null;
  },
};

/* EVENT LISTENERS */
let eventListeners = {
  // Community dropdown field
  communityInput: d3.select("#community-dropdown").on("change", function () {
    checkFormStatus(state);
    state.form_community_clean = this.value;
    state.meta_community = state.form_community_clean.replace(
      /[^A-Z0-9]/gi,
      ""
    );
    // Name of file upload
    state.meta_timestamp = script.format_YmdX(Date.now());
    state.meta_fileName_title =
      state.meta_community + state.meta_fileName_date + ".csv";
  }),

  // Reporting date input
  dateInput: d3.select("#date-input").on("change", function () {
    console.log(this.value);
    state.form_reporting_date = this.value;
    state.meta_reportingDate = script.format_MY(
      script.parse_Ymd(state.form_reporting_date)
    );
    state.meta_fileName_date = script.format_Ymd(
      script.parse_Ymd(state.form_reporting_date)
    );
    // Name of file upload
    state.meta_timestamp = script.format_YmdX(Date.now());
    state.meta_fileName_title =
      state.meta_community + state.meta_fileName_date + ".csv";
    checkFormStatus();
  }),

  contactName: d3.select("#name-input").on("change", function () {
    state.form_name = this.value;
    checkFormStatus();
  }),

  email: d3.select("#email-input").on("change", function () {
    state.form_email = this.value;
    checkFormStatus();
  }),

  // File Picker: call getFile() function
  filePicker: d3.select("#filePicker").on("change", function () {
    state.form_file_upload = this.value;
    checkFormStatus();
    state.fileList = this.files;
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
  validateButton: d3.select("#validateButton").on("click", function () {
    runTests(state.data_headers, state.data_raw, state);
  }),

  reupload: d3.select(".reupload-button").on("click", function () {
    location.reload();
  }),

  reuploadSubmit: d3.select(".reupload-submit").on("click", function () {
    location.reload();
  }),

  aggregateButton: d3.select("#aggregateButton").on("click", function () {
    // Aggregate the data
    aggregate(state.data_raw);
    // Inactivate and hide the aggregate button
    d3.select("#aggregateButton").classed("inactive", true);
    d3.select("#aggregateButton").classed("active", false);
    d3.select("#aggregateButton").attr("disabled", true);
    d3.select("#aggregateButton").classed("hide", true);
    d3.select("#reupload-button").classed("hide", true);
    // Activate and show the submit button
    d3.select(".reupload-submit").classed("hide", false);
    d3.select("#submitButton").classed("inactive", false);
    d3.select("#submitButton").classed("active", true);
    d3.select("#submitButton").attr("disabled", null);
    d3.select("#submitButton").classed("hide", false);
  }),

  submitButton: d3.select("#submitButton").on("click", function () {
    submitData(agg.output);
  }),
};

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
        .style("opacity", "1");
      d3.select(infoLocation).classed("hide", false);
      d3.select(toggleLocation).text("HIDE DETAILS ▲");
    } else {
      d3.select(infoLocation)
        .style("opacity", "1")
        .transition()
        .duration(200)
        .style("opacity", "0");
      d3.select(infoLocation).classed("hide", true);
      d3.select(toggleLocation).text("SHOW DETAILS ▼");
    }
  },

  // Event Listeners
  toggleHeaderInfo: d3.select("#headers-name").on("click", function () {
    // Set opposite status for selected section
    section.headers_open = !section.headers_open;
    section.pii_open = false;
    section.ssn_open = false;
    section.datatype_open = false;
    // Open/close selected section, close all others
    section.toggle(
      "#headers-info",
      "#headers-name-toggle",
      section.headers_open
    );
    section.toggle("#pii-info", "#pii-toggle", section.pii_open);
    section.toggle("#ssn-info", "#ssn-name-toggle", section.ssn_open);
    section.toggle(
      "#datatype-info",
      "#datatype-name-toggle",
      section.datatype_open
    );
  }),

  togglePiiInfo: d3.select("#pii-name").on("click", function () {
    // Set opposite status for selected section
    section.pii_open = !section.pii_open;
    section.headers_open = false;
    section.ssn_open = false;
    section.datatype_open = false;
    // Open/close selected section, close all others
    section.toggle("#pii-info", "#pii-toggle", section.pii_open);
    section.toggle(
      "#headers-info",
      "#headers-name-toggle",
      section.headers_open
    );
    section.toggle("#ssn-info", "#ssn-name-toggle", section.ssn_open);
    section.toggle(
      "#datatype-info",
      "#datatype-name-toggle",
      section.datatype_open
    );
  }),

  toggleSsnInfo: d3.select("#ssn-name").on("click", function () {
    // Set opposite status for selected section
    section.ssn_open = !section.ssn_open;
    section.headers_open = false;
    section.pii_open = false;
    section.datatype_open = false;
    // Open/close selected section, close all others
    section.toggle("#ssn-info", "#ssn-name-toggle", section.ssn_open);
    section.toggle(
      "#headers-info",
      "#headers-name-toggle",
      section.headers_open
    );
    section.toggle("#pii-info", "#pii-toggle", section.pii_open);
    section.toggle(
      "#datatype-info",
      "#datatype-name-toggle",
      section.datatype_open
    );
  }),

  toggleDatatypeInfo: d3.select("#datatype-name").on("click", function () {
    // Set opposite status for selected section
    section.datatype_open = !section.datatype_open;
    section.ssn_open = false;
    section.headers_open = false;
    section.pii_open = false;
    // Open/close selected section, close all others
    section.toggle(
      "#datatype-info",
      "#datatype-name-toggle",
      section.datatype_open
    );
    section.toggle("#ssn-info", "#ssn-name-toggle", section.ssn_open);
    section.toggle(
      "#headers-info",
      "#headers-name-toggle",
      section.headers_open
    );
    section.toggle("#pii-info", "#pii-toggle", section.pii_open);
  }),
};

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
  const headersOutput = requiredHeadersTest(
    headerArray,
    d3.select("#headers-name"),
    d3.select(".headers-val-symbol"),
    d3.select(".header-error")
  );
  const piiOutput = piiHeadersTest(
    headerArray,
    d3.select("#pii-name"),
    d3.select(".pii-val-symbol"),
    d3.select(".pii-error")
  );
  const ssnOutput = ssnValuesTest(
    headerArray,
    data,
    d3.select("#ssn-name"),
    d3.select(".ssn-val-symbol"),
    d3.select(".ssn-error")
  );
  const datatypeOutput = dataTypeTest(
    headerArray,
    data,
    d3.select("#datatype-name"),
    d3.select(".datatype-val-symbol"),
    d3.select(".datatype-error")
  );

  checkTestStatus(headersOutput, piiOutput, ssnOutput, datatypeOutput);
}

function showResult(
  testResult,
  stepLocation,
  resultLocation,
  errorLocation,
  errorMessage,
  successMessage
) {
  if (testResult === false) {
    resultLocation.text("NO PASS").classed("neutral", false);
    resultLocation.classed("fail", true);
    stepLocation
      .style("background-color", "#FFB9B9")
      .on("mouseover", function (d) {
        d3.select(this).style("background-color", "#ffa5a5");
      })
      .on("mouseout", function (d) {
        d3.select(this).style("background-color", "#FFB9B9");
      });
    errorLocation.html(errorMessage);
  } else {
    resultLocation.text("PASS").classed("neutral", false);
    resultLocation.text("PASS").classed("fail", false);
    resultLocation.classed("success", true);
    stepLocation
      .style("background-color", "lightblue")
      .on("mouseover", function (d) {
        d3.select(this).style("background-color", "#9ed1e1");
      })
      .on("mouseout", function (d) {
        d3.select(this).style("background-color", "lightblue");
      });
    errorLocation.html(successMessage);
  }
}

// Are all required headers present?
function requiredHeadersTest(
  headerArray,
  stepLocation,
  resultLocation,
  errorLocation
) {
  const input = [...headerArray];
  const required = [...state.dict_headers_required];
  const passed = [];
  const failed = [];
  let result;

  // Which input headers match a required header?
  input.map((header) => {
    if (required.includes(header)) {
      passed.push(header);
    } else {
      failed.push(header);
    }
  });

  // Which required headers are missing?
  const missing = [...required]
    .map((header) => {
      if (passed.includes(header)) {
        return null;
      } else return header;
    })
    .filter((header) => header != null);

  // Did the test result pass?
  if (missing.length === 0) {
    result = true;
  } else if (missing.length > 0) {
    result = false;
  }

  // Set the error message
  const errorMessage = `<h3>Result</h3><br>
        <b class='fail'>${missing.length} / ${
    required.length
  } required headers are not present (or named differently) in your file. <br></b>
        <ul class='list'> ${missing
          .map((i) => `<li><b>${i}</b></li>`)
          .join("")} </ul> <br> 
        <b class='success'>${passed.length} / ${
    required.length
  } required headers are present in your file.</b><br>
        <ul class='list'> ${passed
          .map((i) => `<li><b class='success'>${i}</b></li>`)
          .join("")}</ul><br>
        Please check that all ${
          required.length
        } required column headers are <b>present</b> in your file and <b>named correctly</b>, and try again.`;

  // Set the success message
  const successMessage = `<h3>Result</h3><br>
    <b class='success'>Passed: All required headers are included in your file.</b>`;

  // Show a message on the page based on the test result
  showResult(
    result,
    stepLocation,
    resultLocation,
    errorLocation,
    errorMessage,
    successMessage
  );

  return {
    passed,
    failed,
    missing,
    result,
  };
}

// Are there headers that are PII?
function piiHeadersTest(
  headerArray,
  stepLocation,
  resultLocation,
  errorLocation
) {
  const input = [...headerArray];
  const pii = [...state.dict_headers_remove];
  const passed = [];
  const failed = [];
  let result;

  // Which input headers DO NOT match PII headers?
  input.map((header) => {
    if (!pii.includes(header)) {
      passed.push(header);
    } else {
      failed.push(header);
    }
  });

  // Did the test result pass?
  if (failed.length === 0) {
    result = true;
  } else if (failed.length > 0) {
    result = false;
  }

  // Set the error message
  const errorMessage = `<h3>Result</h3><br>
    <b class='fail'>${
      failed.length
    } column header(s) are flagged as potentially containing PII:</b>
    <ul> ${failed.map((i) => `<li><b>${i}`).join("")}</ul> <br>
    Please remove the PII column(s) from your data file and try again.`;

  // Set the success message
  const successMessage = `<h3>Result</h3><br>
    <b class='success'>Passed: No headers in your file are PII.</b>`;

  // Show a message on the page based on the test result
  showResult(
    result,
    stepLocation,
    resultLocation,
    errorLocation,
    errorMessage,
    successMessage
  );

  return {
    passed,
    failed,
    result,
  };
}

// Are there values that resemble social security numbers?
function ssnValuesTest(
  headerArray,
  data,
  stepLocation,
  resultLocation,
  errorLocation
) {
  let result;
  let regex = RegExp("^\\d{9}$");
  let failedHeaders = [];
  let failedIndices = [];

  const output = headerArray
    .map((header) => {
      // Get the values for the header
      const arr = script.getColByName(data, header);
      // Map through each value and test against the regex pattern
      // If the test passes, return the index of the value
      const fail = arr
        .map((value, index) => {
          if (value === null) {
            return null;
          } else if (regex.test(value.toString()) === true) {
            return index;
          } else return null;
        })
        .filter((value) => value != null);
      // If at least one value failed, return the header with the failed indices
      if (fail.length > 0) {
        failedHeaders.push(header);
        failedIndices.push(fail);
        return [header, fail];
      } else return null;
    })
    .filter((header) => header != null);

  // Did the test result pass?
  if (output.length === 0) {
    result = true;
  } else if (output.length > 0) {
    result = false;
  }

  const errorMessage = `<h3>Result</h3><br>
            <b>${output.length} / ${
    headerArray.length
  } columns</b> in your file contain values that could be Social Security Numbers. <b style='color:grey; font-weight:400;'> &nbsp (Potential SSNs include values with 9 digits or in the format ###-##-####)</b>. <br>
            <ul>
            ${output
              .map(
                (value) =>
                  `<li> <b class='fail'>${value[0]}</b> has <b>${
                    value[1].length
                  } potential SSN(s)</b> at the following location(s): &nbsp ${value[1]
                    .map(
                      (v) =>
                        `<br> &nbsp &nbsp <b style='color:lightgrey;'>></b> Row <b>${
                          v + 1
                        }</b> &nbsp `
                    )
                    .join("")}</li><br>`
              )
              .join("")}
            </ul>
            Please remove the Social Security Numbers from your data file and try again.`;

  // Set the success message
  const successMessage = `<h3>Result</h3><br>
    <b class='success'>Passed: No values in your file are Social Security Numbers.</b>`;

  // Show a message on the page based on the test result
  showResult(
    result,
    stepLocation,
    resultLocation,
    errorLocation,
    errorMessage,
    successMessage
  );

  return {
    failedHeaders,
    failedIndices,
    output,
    result,
  };
}

// Do required headers contain the right data type?
function dataTypeTest(
  headerArray,
  data,
  stepLocation,
  resultLocation,
  errorLocation
) {
  let result;
  let failedHeaders = [];
  const requiredHeaders = [...state.dict_headers_required];
  const dataTypes = [...state.dict_headers_datatype];
  const dataTypeLookup = requiredHeaders.map((value, index) => {
    const r = {};
    r[value] = dataTypes[index];
    return r;
  });

  const output = headerArray
    .map((header) => {
      // If the header is in the required header list...
      if (requiredHeaders.includes(header)) {
        // Find the datatype that it needs to be
        const lookupIndex = requiredHeaders.indexOf(header);
        let dataType = Object.values(dataTypeLookup[lookupIndex]).toString();
        let errorMessage = state.datatype_errors[dataType];

        // Get the array of values for the header
        const arr = script.getColByName(data, header);
        const values = [];
        const indices = [];

        // Loop through each value and check the datatype
        const fail = arr
          .map((value, index) => {
            if (value === null) {
              return null;
            } else if (script.validate(value, dataType) === false) {
              values.push(value);
              indices.push(index);
              return value & index;
            } else return null;
          })
          .filter((value) => value != null);

        // If at least one value failed, return the header with the failed indices
        if (fail.length > 0) {
          failedHeaders.push(header);
          const r = {
            header: header,
            failedValues: values,
            failedIndices: indices,
            errorMessage: errorMessage,
          };
          return r;
        } else return null;
      } else return null;
    })
    .filter((header) => header != null);

  // Did the test result pass?
  if (output.length === 0) {
    result = true;
  } else if (output.length > 0) {
    result = false;
  }

  const messages = [];

  Object.entries(output).forEach(([key, value]) => {
    messages.push(
      `<ul><li><b class='fail'>${value.header}</b><b class='neutral'> contains <b style='color:black;'>${value.failedIndices.length} value(s)</b> to fix. These values ${value.errorMessage}</b></li></ul>`
    );
    value.failedValues.map((v, index) => {
      const str = `<b style='padding: 0px 0px 0px 50px; font-weight:400;'><b style='color:lightgrey;'>></b> &nbsp <b>Row ${
        value.failedIndices[index] + 2
      }</b> contains the value <b>'${v}'</b>.<br></b>`;
      messages.push(str);
    });
  });

  // Set the error message
  const errorMessage = `<h3>Result</h3><br>
    <b>Please fix the following errors:</b><br>
    ${messages.join("")}`;

  // Set the success message
  const successMessage = `<h3>Result</h3><br><b class='success'>Passed: Your fields contain the right data types.</b>`;

  // Show a message on the page based on the test result
  showResult(
    result,
    stepLocation,
    resultLocation,
    errorLocation,
    errorMessage,
    successMessage
  );

  return {
    output,
    failedHeaders,
    result,
  };
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
      d3.select(".validateBtn-msg").html(
        "Please fill in all required fields to continue."
      );
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
    console.log(
      "%c Required fields are currently OFF.",
      "background: white; color: red"
    );
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
    // Inactivate and hide the aggregate button
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
    // Activate the aggregate button
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

/*
 * AGGREGATE
 */

// Hold state values for aggregation functions
const agg = {
  isVeteran: "Yes Validated",
  isChronic: "Chronically Homeless",
  clientIDHeader: "Client ID",
  activeCats: [
    "Active All",
    "Active Veteran",
    "Active Chronic",
    "Active Youth",
    "Active Family",
  ],
  allCats: [
    "All Unduplicated",
    "All Veteran",
    "All Chronic",
    "All Youth",
    "All Family",
  ],
  populations: ["All", "Veteran", "Chronic", "Youth", "Family"],
  metrics: [
    "Actively Homeless",
    "Housing Placements",
    "Moved to Inactive",
    "Newly Identified Inflow",
    "Returned to Active from Housing",
    "Returned to Active from Inactive",
    "Length of Time from ID to Housing",
  ],
  raw: null,
  output: [],
};

function filterData(data, category) {
  function inArray(value, comparison) {
    if (comparison.includes(value)) {
      return true;
    } else {
      return false;
    }
  }

  const filterMap = {
    "All Unduplicated": data,
    "All Veteran": data.filter((d) => {
      return (
        d["Household Type"] === "Single Adult" &&
        d["Veteran Status"] === agg.isVeteran
      );
    }),
    "All Chronic": data.filter((d) => {
      return (
        d["Household Type"] === "Single Adult" &&
        d["Chronic Status"] === agg.isChronic
      );
    }),
    "All Youth": data.filter((d) => {
      return d["Household Type"] === "Youth";
    }),
    "All Family": data.filter((d) => {
      return d["Household Type"] === "Family";
    }),
    "Active All": data.filter((d) => {
      return d["BNL Status"] === "Active";
    }),
    "Active Veteran": data.filter((d) => {
      return (
        d["BNL Status"] === "Active" &&
        d["Household Type"] === "Single Adult" &&
        d["Veteran Status"] === agg.isVeteran
      );
    }),
    "Active Chronic": data.filter((d) => {
      return (
        d["BNL Status"] === "Active" &&
        d["Household Type"] === "Single Adult" &&
        d["Chronic Status"] === agg.isChronic
      );
    }),
    "Active Youth": data.filter((d) => {
      return d["BNL Status"] === "Active" && d["Household Type"] === "Youth";
    }),
    "Active Family": data.filter((d) => {
      return d["BNL Status"] === "Active" && d["Household Type"] === "Family";
    }),
  };
  return filterMap[category];
}

// Given a date and date format, return the month and year
function monthYear(dateValue, format) {
  if (format === "dmY") {
    return script.format_MY(script.parse_dmY(dateValue));
  } else if (format === "Ymd") {
    return script.format_MY(script.parse_Ymd(dateValue));
  } else return null;
}

function calculate(data, calculation) {
  const reportingDate = state.meta_reportingDate;
  const calcMap = {
    "Actively Homeless": agg.activeCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then get the unique number of clients
      const clients = script.getColByName(categoryData, agg.clientIDHeader);
      return new Set(clients).size;
    }),
    "Housing Placements": agg.activeCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const col = "Housing Move-In Date";
      const filteredData = categoryData.filter((d) => {
        return d[col] != null && monthYear(d[col], "dmY") === reportingDate;
      });
      // Then get the unique number of clients
      const clients = script.getColByName(filteredData, agg.clientIDHeader);
      return new Set(clients).size;
    }),
    "Moved to Inactive": agg.allCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const col = "Inactive Date";
      const filteredData = categoryData.filter((d) => {
        return d[col] != null && monthYear(d[col], "dmY") === reportingDate;
      });
      // Then get the unique number of clients
      const clients = script.getColByName(filteredData, agg.clientIDHeader);
      return new Set(clients).size;
    }),
    "Newly Identified Inflow": agg.activeCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const col = "Date of Identification";
      const filteredData = categoryData.filter((d) => {
        return d[col] != null && monthYear(d[col], "dmY") === reportingDate;
      });
      // Then get the unique number of clients
      const clients = script.getColByName(filteredData, agg.clientIDHeader);
      return new Set(clients).size;
    }),
    "Returned to Active from Housing": agg.activeCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const col1 = "Returned to Active Date";
      const col2 = "Housing Move-In Date";
      const filteredData = categoryData.filter((d) => {
        return (
          d[col2] != null &&
          monthYear(d[col1], "dmY") === reportingDate &&
          script.parse_dmY(d[col1]) > script.parse_dmY(d[col2])
        );
      });
      // Then get the unique number of clients
      const clients = script.getColByName(filteredData, agg.clientIDHeader);
      return new Set(clients).size;
    }),
    "Returned to Active from Inactive": agg.allCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const col1 = "Returned to Active Date";
      const col2 = "Inactive Date";
      const filteredData = categoryData.filter((d) => {
        return (
          d[col2] != null &&
          monthYear(d[col1], "dmY") === reportingDate &&
          script.parse_dmY(d[col1]) > script.parse_dmY(d[col2])
        );
      });
      // Then get the unique number of clients
      const clients = script.getColByName(filteredData, agg.clientIDHeader);
      return new Set(clients).size;
    }),
    "Length of Time from ID to Housing": agg.activeCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      const col1 = "Housing Move-In Date";
      const col2 = "Date of Identification";
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        return d[col1] != null;
      });
      // Get arrays of values for housing dates and ID dates
      const housingDates = script.getColByName(filteredData, col1);
      const idDates = script.getColByName(filteredData, col2);
      // Map the difference between housing and ID dates, remove null values
      const difference = housingDates
        .map((houseDate, index) => {
          const idDate = idDates[index];
          if (houseDate != null && idDate != null) {
            const diff = script.parse_dmY(houseDate) - script.parse_dmY(idDate);
            return Math.ceil(diff / (1000 * 60 * 60 * 24));
          } else return null;
        })
        .filter((value) => value != null);
      // Reduce the differences map to a single average value
      if (difference.length === 0) {
        return null;
      } else {
        const average = Math.ceil(
          difference.reduce((acc, value) => (acc + value) / difference.length)
        );
        return average;
      }
    }),
  };

  return calcMap[calculation];
}

function aggregate(data) {
  // Reset values
  agg.raw = null;
  agg.output = [];
  d3.selectAll(".agg-header").remove();
  d3.selectAll(".agg-spacer").remove();
  d3.selectAll(".agg-value").remove();

  // Calculate by population
  agg.raw = {
    "Actively Homeless": calculate(data, "Actively Homeless"),
    "Housing Placements": calculate(data, "Housing Placements"),
    "Moved to Inactive": calculate(data, "Moved to Inactive"),
    "Newly Identified Inflow": calculate(data, "Newly Identified Inflow"),
    "Returned to Active from Housing": calculate(
      data,
      "Returned to Active from Housing"
    ),
    "Returned to Active from Inactive": calculate(
      data,
      "Returned to Active from Inactive"
    ),
    "Length of Time from ID to Housing": calculate(
      data,
      "Length of Time from ID to Housing"
    ),
  };

  // Remap the results by population and print to the page
  agg.populations.map((pop) => {
    getOutput(pop, agg.raw);
  });

  console.log(agg);
}

function getOutput(population, aggRaw) {
  const pops = agg.populations;
  const index = pops.indexOf(population);
  const metrics = agg.metrics;
  printHeader();
  const popOutput = {};

  // Set the household based on the chosen population
  let household;
  if (population === "Youth") {
    household = "Youth";
  } else if (population === "Family") {
    household = "Family";
  } else household = "Single Adult";

  metrics.map((metric) => {
    popOutput["Timestamp"] = state.meta_timestamp;
    popOutput["Community"] = state.form_community_clean;
    popOutput["Month"] = state.meta_reportingDate;
    popOutput["Name"] = state.form_name;
    popOutput["Email Address"] = state.form_email;
    popOutput["Organization"] = null; // TODO: Add in organization
    popOutput["Population"] = household;
    popOutput["Subpopulation"] = population;
    popOutput["Demographic"] = "All"; // TODO: Add demographic?
    popOutput[metric] = aggRaw[metric][index];
    printValue(population, metric, aggRaw[metric][index]);
  });
  agg.output.push(popOutput);
}

function printValue(population, calculation, result) {
  d3.select(".agg-table")
    .append("div")
    .classed("agg-value", true)
    .html(`${population}`);

  d3.select(".agg-table")
    .append("div")
    .classed("agg-value", true)
    .html(`${calculation}`);

  d3.select(".agg-table")
    .append("div")
    .classed("agg-value", true)
    .html(`<b>${result}</b>`);
}

function printHeader(value) {
  d3.select(".agg-table").append("div").classed("agg-spacer", true).html(``);

  d3.select(".agg-table").append("div").classed("agg-spacer", true).html(``);

  d3.select(".agg-table").append("div").classed("agg-spacer", true).html(``);

  d3.select(".agg-table")
    .append("div")
    .classed("agg-header", true)
    .html(`Subpopulation`);

  d3.select(".agg-table")
    .append("div")
    .classed("agg-header", true)
    .text("Calculation");

  d3.select(".agg-table")
    .append("div")
    .classed("agg-header", true)
    .text("Result");
}

// Parses data as a CSV and downloads the file
function submitData(data) {
  state.data_csv = Papa.unparse(data);
  const hiddenElement = document.createElement("a");
  hiddenElement.href =
    "data:text/csv;charset=utf-8," + encodeURI(state.data_csv);
  hiddenElement.target = "_blank";
  hiddenElement.download = `${state.meta_fileName_title}`;
  hiddenElement.click();
}

// Client ID and API key from the Developer Console
/* 
let props;

function readJson(sheetId, sheetNumber) {
  const url = `https://spreadsheets.google.com/feeds/cells/${sheetId}/${sheetNumber}/public/full?alt=json`;
  const urlNew = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1/key=AIzaSyBwN3HnsgzHntDcqK8T96cZYGcN32EegWo`;

  d3.json(url).then((data) => {
    const json = data;
    const entries = data.feed.entry;
    const colCount = parseInt(Object.values(json.feed.gs$colCount)[0]) - 1;
    const rowCount = parseInt(Object.values(json.feed.gs$rowCount)[0]) - 1;

    console.log(entries);

    const colMap = [...Array(colCount).keys()];
    const rowMap = [...Array(rowCount).keys()];
    const valueMap = [...Array(entries.length).keys()];
    console.log(valueMap.length);
    const arr = [];

    props = {
      colCount: colCount,
      rowCount: rowCount,
      headers: colMap.map((value, index) => {
        return entries[index].content.$t;
      }),
      values: valueMap.map((value, index) => {
        return entries[index].content.$t;
      }),
      data: valueMap.map((value, index) => {
        return arr;
      }),
    };
    console.log(arr);
    console.log(props);
  });
} */
