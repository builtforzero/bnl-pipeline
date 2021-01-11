const d3 = require("d3");
const Papa = require("papaparse");
const XLSX = require("xlsx");
import { Utils } from "./utils.js";
import { headers, pops, values } from "../dict.js";
let util = new Utils();

class Validator {
  showMe() {
    console.log("I'm working!", "Validator");
  }

  /*
   *TESTS
   */
  requiredHeaders(headerArray, stepLocation, resultLocation, errorLocation, state) {
    const input = [...headerArray];
    const required = headers.required;
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
            <b class='fail'>${missing.length} / ${required.length} required headers are not present (or named differently) in your file. <br></b>
            <ul class='list'> ${missing.map((i) => `<li><b>${i}</b></li>`).join("")} </ul> <br> 
            <b class='success'>${passed.length} / ${required.length} required headers are present in your file.</b><br>
            <ul class='list'> ${passed.map((i) => `<li><b class='success'>${i}</b></li>`).join("")}</ul><br>
            Please check that all ${required.length} required column headers are <b>present</b> in your file and <b>named correctly</b>, and try again.`;

    // Set the success message
    const successMessage = `<h3>Result</h3><br>
        <b class='success'>Passed: All required headers are included in your file.</b>`;

    // Show a message on the page based on the test result
    this.displayResult(result, stepLocation, resultLocation, errorLocation, errorMessage, successMessage);

    return {
      passed,
      failed,
      missing,
      result,
    };
  }

  piiHeaders(headerArray, stepLocation, resultLocation, errorLocation, state) {
    const input = [...headerArray];
    const pii = [...headers.banned];
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
      <b class='fail'>${failed.length} column header(s) are flagged as potentially containing PII:</b>
      <ul> ${failed.map((i) => `<li><b>${i}`).join("")}</ul> <br>
      Please remove the PII column(s) from your data file and try again.`;

    // Set the success message
    const successMessage = `<h3>Result</h3><br>
      <b class='success'>Passed: No headers in your file are PII.</b>`;

    // Show a message on the page based on the test result
    this.displayResult(result, stepLocation, resultLocation, errorLocation, errorMessage, successMessage);

    return {
      passed,
      failed,
      result,
    };
  }

  ssnValues(headerArray, data, stepLocation, resultLocation, errorLocation, state) {
    let result;
    let regex = RegExp("^\\d{9}$");
    let failedHeaders = [];
    let failedIndices = [];

    const output = headerArray
      .map((header) => {
        // Get the values for the header
        const arr = util.getColByName(data, data.length - 1, header);
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
                  <b>${output.length} / ${headerArray.length} columns</b> in your file contain values that could be Social Security Numbers. <b style='color:grey; font-weight:400;'> &nbsp (Potential SSNs include values with 9 digits or in the format ###-##-####)</b>. <br>
                  <ul>
                  ${output.map((value) => `<li> <b class='fail'>${value[0]}</b> has <b>${value[1].length} potential SSN(s)</b> at the following location(s): &nbsp ${value[1].map((v) => `<br> &nbsp &nbsp <b style='color:lightgrey;'>></b> Row <b>${v + 1}</b> &nbsp `).join("")}</li><br>`).join("")}
                  </ul>
                  Please remove the Social Security Numbers from your data file and try again.`;

    // Set the success message
    const successMessage = `<h3>Result</h3><br>
          <b class='success'>Passed: No values in your file are Social Security Numbers.</b>`;

    // Show a message on the page based on the test result
    this.displayResult(result, stepLocation, resultLocation, errorLocation, errorMessage, successMessage);

    return {
      failedHeaders,
      failedIndices,
      output,
      result,
    };
  }

  dataType(headerArray, data, stepLocation, resultLocation, errorLocation, state) {
    let result;
    let failedHeaders = [];
    const requiredHeaders = headers.required;
    const dataTypes = headers.datatype;
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
          let errorMessage = headers.errors[dataType];

          // Get the array of values for the header
          const arr = util.getColByName(data, data.length - 1, header);
          const values = [];
          const indices = [];

          // Loop through each value and check the datatype
          const fail = arr
            .map((value, index) => {
              if (value === null) {
                return null;
              } else if (util.validate(value, dataType) === false) {
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
      messages.push(`<ul><li><b class='fail'>${value.header}</b><b class='neutral'> contains <b style='color:black;'>${value.failedIndices.length} value(s)</b> to fix. These values ${value.errorMessage}</b></li></ul>`);
      value.failedValues.map((v, index) => {
        const str = `<b style='padding: 0px 0px 0px 50px; font-weight:400;'><b style='color:lightgrey;'>></b> &nbsp <b>Row ${value.failedIndices[index] + 2}</b> contains the value <b>'${v}'</b>.<br></b>`;
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
    this.displayResult(result, stepLocation, resultLocation, errorLocation, errorMessage, successMessage);

    return {
      output,
      failedHeaders,
      result,
    };
  }

  /*
   *STATUS AND DISPLAY
   */
  displayResult(testResult, stepLocation, resultLocation, errorLocation, errorMessage, successMessage) {
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

  checkStatus(resultsArray, state) {
    if (resultsArray.some(util.valueIsFalse)) {
      util.deactivate(d3.select("#validateButton"), false);
      util.deactivate(d3.select("#aggregateButton"), true);
      d3.select("#reupload-button").classed("hide", false);
      // Reset values
      state.backend_raw = null;
      state.backend_output = [];
      d3.selectAll(".agg-header").remove();
      d3.selectAll(".agg-value").remove();
      d3.selectAll(".filter-btn").remove();
    } else if (resultsArray.some(util.valueIsTrue)) {
      util.deactivate(d3.select("#validateButton"), false);
      util.activate(d3.select("#aggregateButton"), true);
      // Reset values
      state.backend_raw = null;
      state.backend_output = [];
      d3.selectAll(".agg-header").remove();
      d3.selectAll(".agg-value").remove();
      d3.selectAll(".filter-btn").remove();
    }
  }
}

export { Validator };
