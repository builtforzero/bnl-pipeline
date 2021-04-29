const d3 = require("d3");
import { Utils } from "./utils.js";
import { headers } from "../dict.js";
let util = new Utils();

class Validator {
  
  testHeaderAndValues(headerValue, data, state) {
      // Match the header value against the required list
      // Test for alternate spellings
      // If the header is found, and doesn't match the required spelling, rename and standardize
      let headerLookup = headerValue;
      let requiredTestResult = false;
      headers.required.map((reqHeader) => {
        const altNames = headers.meta[reqHeader].altNames;
        if (altNames.includes(util.clean(headerLookup))) {
          state.test.required.pass.push(reqHeader)
          if (headerValue !== reqHeader) {
            util.renameCol(data, headerValue, reqHeader);
            headerLookup = reqHeader;
          } else {
            headerLookup = headerValue;
          }
          requiredTestResult = true;
        } else {
          null
        }
      })

      // PII header test
      const piiTestResult = headers.banned.includes(headerLookup);
      if (piiTestResult === true) {
        state.test.pii.fail.push(headerLookup);
      } else {
        state.test.pii.pass.push(headerLookup);
      }

      const ssnObject = {
        testResultByValue: [],
        failIndices: [],
        failValues: [],
        passIndices: [],
        passValues: []
      }

      const datatypeObject = {
        testResultByValue: [],
        failIndices: [],
        failValues: [],
        passIndices: [],
        passValues: []
      }

      // Value-level data tests
      // Apply the SSN value test on all headers
      // Apply the datatype matching test on required headers only
      const headerData = util.getColByName(data, headerLookup);

      headerData.map((value, index) => {
        if (value === "" || value === undefined || value === null || util.clean(value) === null) { 
          ssnObject.testResultByValue.push(null);
          datatypeObject.testResultByValue.push(null);
        } else {
          // SSN value test
          const regex = new RegExp("^\\d{9}$");
          const ssnTestResult = regex.test(value.toString());
          ssnObject.testResultByValue.push(ssnTestResult);
          if (ssnTestResult === false) { 
            ssnObject.passIndices.push(index)
            ssnObject.passValues.push(value)
          } else {
            ssnObject.failIndices.push(index)
            ssnObject.failValues.push(value)
          }
          // Data type matching test
          if (requiredTestResult === true) {
            const datatype = headers.meta[headerLookup].datatype
            const datatypeTestResult = util.validate(value, datatype);
            datatypeObject.testResultByValue.push(datatypeTestResult);
            if (datatypeTestResult === true) {
              datatypeObject.passIndices.push(index)
              datatypeObject.passValues.push(value)
            } else {
              datatypeObject.failIndices.push(index)
              datatypeObject.failValues.push(value)
            }
          } else null;
        }
      })

      if (ssnObject.failIndices.length === 0) {
        state.test.ssn.pass[headerLookup] = ssnObject;
      } else if (ssnObject.failIndices.length > 0) {
        state.test.ssn.fail[headerLookup] = ssnObject;
      }

      if (datatypeObject.failIndices.length === 0) {
        state.test.datatype.pass[headerLookup] = ssnObject;
      } else if (ssnObject.failIndices.length > 0) {
        state.test.datatype.fail[headerLookup] = ssnObject;
      }
  }

  evaluateAndPrintTestResults(state) {
    const testObj = state.test;
    headers.required.map((header) => {
      if (!testObj.required.pass.includes(header)) {
        testObj.required.fail.push(header)
      } else null
    })
    testObj.ssn.passHeaders = Object.keys(testObj.ssn.pass);
    testObj.ssn.failHeaders = Object.keys(testObj.ssn.fail);
    testObj.datatype.passHeaders = Object.keys(testObj.datatype.pass);
    testObj.datatype.failHeaders = Object.keys(testObj.datatype.fail);

    const resultObj = {
      required: testObj.required.fail.length,
      pii: testObj.pii.fail.length,
      ssn: testObj.ssn.failHeaders.length,
      datatype: testObj.datatype.failHeaders.length
    }

    testObj._names.map((test) => {
      if (resultObj[test] === 0) {
        testObj._pass[test] = true;
      } else if (resultObj[test] > 0) {
        testObj._pass[test] = false;
      }
      const params = {
        testResult: state.test._pass[test], 
        stepLocation: d3.selectAll(`.${test}-header`),
        resultLocation: d3.select(`.${test}-val-symbol`),
        errorLocation: d3.select(`.${test}-error`), 
        errorMessage: this.getErrorMessage(test, state), 
        successMessage: this.getSuccessMessage(test)
      }
      this.displayResult(params);
    })
  }

  // Params = state object for specific test
  getErrorMessage(testName, state) {
    const params = state.test[testName];
    const errorMessages = {
      required: (params) => {
        return `<h3>Result</h3><br>
            <b class='fail'>${params.fail.length} / ${headers.required.length} required headers are not present (or named differently) in your file. <br></b>
            <ul class='list'> ${params.fail.map((i) => `<li><b>${i}</b></li>`).join("")} </ul> <br> 
            <b class='success'>${params.pass.length} / ${headers.required.length} required headers are present in your file.</b><br>
            <ul class='list'> ${params.pass.map((i) => `<li><b class='success'>${i}</b></li>`).join("")}</ul><br>
            Please check that all ${headers.required.length} required column headers are <b>present</b> in your file and <b>named correctly</b>, and try again.`;
      },
      pii: (params) => {
        return `<h3>Result</h3><br>
        <b class='fail'>${params.fail.length} column header(s) are flagged as potentially containing PII:</b>
        <ul> ${params.fail.map((i) => `<li><b>${i}`).join("")}</ul> <br>
        Please remove the PII column(s) from your data file and try again.`
      },
      ssn: (params) => {
        return `<h3>Result</h3><br>
        <b>${params.failHeaders.length} / ${state.data.headers.length} columns</b> in your file contain values that could be Social Security Numbers. <b style='color:grey; font-weight:400;'> &nbsp (Potential SSNs include values with 9 digits or in the format ###-##-####)</b>. <br>
        <ul>
          ${params.failHeaders.map((header) => `<li> <b class='fail'>${header}</b> has <b>${params.fail[header].failIndices.length} potential SSN(s)</b> at the following location(s): &nbsp ${params.fail[header].failIndices.map((v) => `<br> &nbsp &nbsp <b style='color:lightgrey;'>></b> Row <b>${v + 2}</b> &nbsp `).join("")}</li><br>`).join("")}
        </ul>
        Please remove the Social Security Numbers from your data file and try again.`
      },
      datatype: (params) => {
        const message = []
        params.failHeaders.map((header) => {
          const helpText = headers.meta[header].error;
          const headline = `<ul><li><b class='fail'>${header}</b><b class='neutral'> contains <b style='color:black;'>${params.fail[header].failValues.length} value(s)</b> to fix. These values ${helpText}</b></li></ul>`
          message.push(headline);
          params.fail[header].failValues.map((v, index) => {
            const detailRow = `<b style='padding: 0px 0px 0px 50px; font-weight:400;'><b style='color:lightgrey;'>></b> &nbsp <b>Row ${v[index] + 2}</b> contains the value <b>'${v}'</b>.<br></b>`
            message.push(detailRow);
          })
        })
        return message;
      }
    }
    return errorMessages[testName](params);
  }

  // Params = state object for specific test
  getSuccessMessage(testName) {
    //const params = state.test[testName];
    const successMessages = {
      required: () => {
        return `<h3>Result</h3><br><b class='success'>Passed: All required headers are included in your file.</b>`
        },
      pii: () => {
        return `<h3>Result</h3><br><b class='success'>Passed: No headers in your file are PII.</b>`
        },
      ssn: () => {
        return `<h3>Result</h3><br><b class='success'>Passed: No values in your file are Social Security Numbers.</b>`
        },
      datatype: () => {
        return `<h3>Result</h3><br><b class='success'>Passed: Your fields contain the right data types.</b>`
        }
    }
    return successMessages[testName];
  }

  displayResult(params) {
    if (params.testResult === false) {
      params.resultLocation.text("NO PASS").classed("neutral", false);
      params.resultLocation.classed("fail", true);
      params.stepLocation
        .style("background-color", "#FFB9B9")
        .on("mouseover", function (d) {
          params.stepLocation.style("background-color", "#ffa5a5");
        })
        .on("mouseout", function (d) {
          params.stepLocation.style("background-color", "#FFB9B9");
        });
        params.errorLocation.html(params.errorMessage);
    } else {
      params.resultLocation.text("PASS").classed("neutral", false);
      params.resultLocation.text("PASS").classed("fail", false);
      params.resultLocation.classed("success", true);
      params.stepLocation
        .style("background-color", "lightblue")
        .on("mouseover", function (d) {
          params.stepLocation.style("background-color", "#9ed1e1");
        })
        .on("mouseout", function (d) {
          params.stepLocation.style("background-color", "lightblue");
        });
      params.errorLocation.html(params.successMessage);
    }
  }

}

export { Validator };
