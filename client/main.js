// Require packages
const d3 = require("d3");
const Papa = require("papaparse");
const XLSX = require("xlsx");

// Import components
import { headers, pops, values } from "./dict.js";
import { Validator } from "./js/validate.js";
import { FormHandler } from "./js/form.js";
import { Aggregator } from "./js/aggregator.js";
import { Utils } from "./js/utils.js";

// Initialize components
let test = new Validator();
let form = new FormHandler();
let agg = new Aggregator();
let util = new Utils();

/* APPLICATION STATE */
let state = {
  debug: false, // Toggle to remove required fields
  testSubmit: false, // Toggle to switch to test script URL

  finalScriptUrl: "https://script.google.com/macros/s/AKfycbxkuRKFFR192ubCwQ8TWY1NxqcR9SzjmwWnFP3lDqxyuNbq_0M/exec",
  testScriptUrl: "https://script.google.com/macros/s/AKfycbxkuRKFFR192ubCwQ8TWY1NxqcR9SzjmwWnFP3lDqxyuNbq_0M/exec",

  // Form Fields
  form_community_clean: null,
  form_reporting_date: null,
  form_name: null,
  form_email: null,
  form_org: null,
  form_file_upload: null,

  // Metadata
  meta_timestamp: null,
  meta_community: null,
  meta_reportingDate: null,

  // Data
  fileList: null,
  fileFormat: null,
  data_raw: null,
  data_clean: null,
  data_headers: null,
  data_length: null,
  data_csv: null,
  data_form: null,

  // Backend
  backend_raw: null,
  backend_output: [],
};

init(state, form);

function init(state, form) {
  form.checkStatus(state);
  form.setupFields(state, form);
  setupButtons();
}

/* EVENT LISTENERS */
function setupButtons() {
  // Validate button
  d3.select("#validateButton").on("click", function () {
    // Run the validation tests
    runTests(state.data_headers, state.data_raw, state);

    // Remove any lingering values from a previous aggregation
    state.backend_raw = null;
    state.backend_output = [];
    d3.selectAll(".agg-header").remove();
    d3.selectAll(".agg-value").remove();
    d3.selectAll(".filter-btn").remove();

    // Deactivate the submit button
    // Activate the aggregate button
    // Show the reupload button
    util.deactivate(d3.select("#submitButton"), false);
    util.activate(d3.select("#aggregateButton"), false);
    d3.select(".reupload-aggregate").classed("hide", false);
  });

  // Reupload and new upload buttons
  d3.selectAll(".reupload-aggregate,.reupload-submit,.new-upload-submit").on("click", function () {
    util.resetData(state);
    util.clearFileInput("filePicker");
  });

  // Aggregate Button
  d3.select("#aggregateButton").on("click", function () {
    // Remove any lingering values
    state.backend_raw = null;
    state.backend_output = [];
    d3.selectAll(".agg-header").remove();
    d3.selectAll(".agg-value").remove();
    d3.selectAll(".filter-btn").remove();

    // Aggregate the data
    aggregate(state.data_raw);

    // Deactivate and hide the aggregate button
    // Activate the submit button
    util.deactivate(d3.select("#aggregateButton"), false);
    util.activate(d3.select("#submitButton"), false);
    d3.select(".reupload-aggregate").classed("hide", true);
    d3.select(".reupload-submit").classed("hide", false);
    d3.select(".submit-instructions").classed("hide", false);
    d3.select(".review-msg").classed("hide", false);
  });

  // Submit button
  d3.select("#submitButton").on("click", function () {
    // Submit the data
    submitData(state.backend_output);

    // Deactivate and hide the submit button
    // Hide the reupload button
    d3.select(".reupload-aggregate").classed("hide", true);
    d3.select(".reupload-submit").classed("hide", true);
    util.deactivate(d3.select("#aggregateButton"), false);
    util.deactivate(d3.select("#submitButton"), false);
    d3.select(".progress-msg").html(`Submitting...`).style("opacity", "0").transition().duration(200).style("opacity", "1");
    d3.select(".progress-bar").html(`<progress id="file" value="${0}" max="6">${0}</progress>`).style("opacity", "0").transition().duration(200).style("opacity", "1");
    d3.select(".submit-instructions").classed("hide", true);
    d3.select(".review-msg").classed("hide", true);
  });
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
      d3.select(infoLocation).style("opacity", "0").transition().duration(200).style("opacity", "1");
      d3.select(infoLocation).classed("hide", false);
      d3.select(toggleLocation).text("HIDE DETAILS ▲");
    } else {
      d3.select(infoLocation).style("opacity", "1").transition().duration(200).style("opacity", "0");
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
    section.toggle("#headers-info", "#headers-name-toggle", section.headers_open);
    section.toggle("#pii-info", "#pii-toggle", section.pii_open);
    section.toggle("#ssn-info", "#ssn-name-toggle", section.ssn_open);
    section.toggle("#datatype-info", "#datatype-name-toggle", section.datatype_open);
  }),

  togglePiiInfo: d3.select("#pii-name").on("click", function () {
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

  toggleSsnInfo: d3.select("#ssn-name").on("click", function () {
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

  toggleDatatypeInfo: d3.select("#datatype-name").on("click", function () {
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
};

/* RUN TESTS AND CHECK VALIDATION STATUS */
function runTests(headerArray, data, state) {
  const headersOutput = test.requiredHeaders(headerArray, d3.select("#headers-name"), d3.select(".headers-val-symbol"), d3.select(".header-error"), state);
  const piiOutput = test.piiHeaders(headerArray, d3.select("#pii-name"), d3.select(".pii-val-symbol"), d3.select(".pii-error"), state);
  const ssnOutput = test.ssnValues(headerArray, data, d3.select("#ssn-name"), d3.select(".ssn-val-symbol"), d3.select(".ssn-error"), state);
  const datatypeOutput = test.dataType(headerArray, data, d3.select("#datatype-name"), d3.select(".datatype-val-symbol"), d3.select(".datatype-error"), state);

  const results = [headersOutput.result, piiOutput.result, ssnOutput.result, datatypeOutput.result];

  test.checkStatus(results, state);
}

/*
 * AGGREGATE
 */

// Filter data based on population and active status
function filterData(data, category) {
  const filterMap = {
    "All All": data,
    "All Veteran": data.filter((d) => {
      return d["Household Type"] != null && d["Veteran Status"] != null && values.singleAdult.includes(util.clean(d["Household Type"])) === true && values.veteran.includes(util.clean(d["Veteran Status"])) === true;
    }),
    "All Chronic": data.filter((d) => {
      return d["Household Type"] != null && d["Chronic Status"] != null && values.singleAdult.includes(util.clean(d["Household Type"])) === true && values.chronic.includes(util.clean(d["Chronic Status"])) === true;
    }),
    "All Youth": data.filter((d) => {
      return d["Household Type"] != null && values.youth.includes(util.clean(d["Household Type"])) === true;
    }),
    "All Family": data.filter((d) => {
      return d["Household Type"] != null && values.family.includes(util.clean(d["Household Type"])) === true;
    }),
    "Active All": data.filter((d) => {
      return d["BNL Status"] != null && d["BNL Status"].toString().trim() === "Active";
    }),
    "Active Veteran": data.filter((d) => {
      return d["BNL Status"] != null && d["Household Type"] != null && d["Veteran Status"] != null && d["BNL Status"].toString().trim() === "Active" && values.singleAdult.includes(util.clean(d["Household Type"])) === true && values.veteran.includes(util.clean(d["Veteran Status"])) === true;
    }),
    "Active Chronic": data.filter((d) => {
      return d["BNL Status"] != null && d["Household Type"] != null && d["Chronic Status"] != null && d["BNL Status"].toString().trim() === "Active" && values.singleAdult.includes(util.clean(d["Household Type"])) === true && values.chronic.includes(util.clean(d["Chronic Status"])) === true;
    }),
    "Active Youth": data.filter((d) => {
      return d["BNL Status"] != null && d["Household Type"] != null && d["BNL Status"].toString().trim() === "Active" && values.youth.includes(util.clean(d["Household Type"])) === true;
    }),
    "Active Family": data.filter((d) => {
      return d["BNL Status"] != null && d["Household Type"] != null && d["BNL Status"].toString().trim() === "Active" && values.family.includes(util.clean(d["Household Type"])) === true;
    }),
  };
  return filterMap[category];
}

function calculate(state, data, calculation) {
  const reportingDate = state.meta_reportingDate;
  const activeCats = pops.all.map((pop) => {
    return "Active " + pop;
  });
  const allCats = pops.all.map((pop) => {
    return "All " + pop;
  });

  const calcMap = {
    "ACTIVELY HOMELESS NUMBER": activeCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then get the unique number of clients
      const clients = util.getColByName(categoryData, categoryData.length, headers.clientId);
      return new Set(clients).size;
    }),
    "HOUSING PLACEMENTS": allCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        return d["Housing Move-In Date"] != null && util.getDate(d["Housing Move-In Date"], "MY", state) === reportingDate;
      });
      // Then get the unique number of clients
      const clients = util.getColByName(filteredData, filteredData.length, headers.clientId);
      return new Set(clients).size;
    }),
    "MOVED TO INACTIVE NUMBER": allCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        return d["Inactive Date"] != null && util.getDate(d["Inactive Date"], "MY", state) === reportingDate;
      });
      // Then get the unique number of clients
      const clients = util.getColByName(filteredData, filteredData.length, headers.clientId);
      return new Set(clients).size;
    }),
    "NEWLY IDENTIFIED NUMBER": activeCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        return d["Date of Identification"] != null && d["Inactive Date"] === null && d["Returned to Active Date"] === null && util.getDate(d["Date of Identification"], "MY", state) === reportingDate;
      });
      // Then get the unique number of clients
      const clients = util.getColByName(filteredData, filteredData.length, headers.clientId);
      return new Set(clients).size;
    }),
    "RETURNED TO ACTIVE LIST FROM HOUSING NUMBER": activeCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        return d["Housing Move-In Date"] != null && util.getDate(d["Returned to Active Date"], "MY", state) === reportingDate && util.getDate(d["Returned to Active Date"], "MDY", state) > util.getDate(d["Housing Move-In Date"], "MDY", state);
      });
      // Then get the unique number of clients
      const clients = util.getColByName(filteredData, filteredData.length, headers.clientId);
      return new Set(clients).size;
    }),
    "RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER": allCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        return d["Inactive Date"] != null && util.getDate(d["Returned to Active Date"], "MY", state) === reportingDate && util.getDate(d["Returned to Active Date"], "MDY", state) > util.getDate(d["Inactive Date"], "MDY", state);
      });
      // Then get the unique number of clients
      const clients = util.getColByName(filteredData, filteredData.length, headers.clientId);
      return new Set(clients).size;
    }),
    "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT": allCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        return d["Housing Move-In Date"] != null && util.getDate(d["Housing Move-In Date"], "MY", state) === reportingDate;
      });
      // Get arrays of values for housing dates and ID dates
      const housingDates = util.getColByName(filteredData, filteredData.length, "Housing Move-In Date");
      const idDates = util.getColByName(filteredData, filteredData.length, "Date of Identification");
      // Map the difference between each housing and ID date, remove null values
      const difference = housingDates
        .map((houseDate, index) => {
          // Get corresponding ID date value
          const idDate = idDates[index];
          // Get difference in ms and convert to days
          if (houseDate != null && idDate != null) {
            const diff = util.getDate(houseDate, "MDY", state) - util.getDate(idDate, "MDY", state);
            const converted = Math.ceil(diff / (1000 * 60 * 60 * 24));
            if (converted < 0) {
              return null;
            } else {
              return converted;
            }
          } else {
            return null;
          }
        })
        .filter((value) => value != null);

      // Reduce the differences map to a single average value
      if (difference.length === 0) {
        return null;
      } else {
        const round = d3.format(".1f");
        const average = round(d3.mean(difference), 1);
        return average;
      }
    }),
  };

  return calcMap[calculation];
}

function aggregate(data) {
  // Reset values
  state.backend_raw = null;
  state.backend_output = [];
  d3.selectAll(".agg-header").remove();
  d3.selectAll(".agg-spacer").remove();
  d3.selectAll(".agg-value").remove();

  // Calculate by population
  state.backend_raw = {
    "ACTIVELY HOMELESS NUMBER": calculate(state, data, "ACTIVELY HOMELESS NUMBER"),
    "HOUSING PLACEMENTS": calculate(state, data, "HOUSING PLACEMENTS"),
    "MOVED TO INACTIVE NUMBER": calculate(state, data, "MOVED TO INACTIVE NUMBER"),
    "NEWLY IDENTIFIED NUMBER": calculate(state, data, "NEWLY IDENTIFIED NUMBER"),
    "RETURNED TO ACTIVE LIST FROM HOUSING NUMBER": calculate(state, data, "RETURNED TO ACTIVE LIST FROM HOUSING NUMBER"),
    "RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER": calculate(state, data, "RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER"),
    "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT": calculate(state, data, "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT"),
  };

  // Update visible reporting month and community
  d3.select(".reporting-month").text(`${state.meta_reportingDate}`);
  d3.select(".reporting-community").text(state.form_community_clean);

  // Add in metadata for submission
  state.backend_output["Timestamp"] = state.meta_timestamp;
  state.backend_output["Community"] = state.form_community_clean;
  state.backend_output["Month"] = state.meta_reportingDate;
  state.backend_output["Name"] = state.form_name;
  state.backend_output["Email Address"] = state.form_email;
  state.backend_output["Organization"] = state.form_org;

  // Remap the results by population and print to the page
  pops.all.map((popValue) => {
    console.log(popValue);
    getOutput(popValue, pops, state.backend_raw);
  });

  d3.select(".button-group-title").text("Select a subpopulation to review");

  // Add the population buttons
  // Toggle the visible aggregation result by population
  pops.all.map((pop, index) => {
    // Set the "remaining populations" to everything but the chosen pop
    const remainingPops = pops.all.filter((d) => {
      return d != pop;
    });
    // Add a button for the population
    d3.select(".button-group").append("button").classed(`${pop}-btn filter-btn`, true);

    // Set "All" as the default population to be visible
    if (pop === "All") {
      d3.selectAll(`.${pop}`).style("opacity", "0").transition().duration(200).style("opacity", "1");
      d3.selectAll(`.${pop}`).classed("hide", false);
      remainingPops.map((remaining) => {
        d3.selectAll(`.${remaining}`).style("opacity", "1").transition().duration(100).style("opacity", "0");
        d3.selectAll(`.${remaining}`).classed("hide", true);
      });
      // Set the button to be focused
      d3.select(`.${pop}-btn`).node().focus();
      // Add an event listener and label to the button
      d3.select(`.${pop}-btn`)
        .on("click", function () {
          d3.selectAll(`.${pop}`).style("opacity", "0").transition().duration(200).style("opacity", "1");
          d3.selectAll(`.${pop}`).classed("hide", false);
          remainingPops.map((remaining) => {
            d3.selectAll(`.${remaining}`).style("opacity", "1").transition().duration(100).style("opacity", "0");
            d3.selectAll(`.${remaining}`).classed("hide", true);
          });
        })
        .append("div")
        .attr("class", "label")
        .text(`${pop}`);
    } else {
      // Add an event listener and label to the button
      d3.select(`.${pop}-btn`)
        .on("click", function () {
          d3.selectAll(`.${pop}`).style("opacity", "0").transition().duration(200).style("opacity", "1");
          d3.selectAll(`.${pop}`).classed("hide", false);
          remainingPops.map((remaining) => {
            d3.selectAll(`.${remaining}`).style("opacity", "1").transition().duration(100).style("opacity", "0");
            d3.selectAll(`.${remaining}`).classed("hide", true);
          });
        })
        .append("div")
        .attr("class", "label")
        .text(`${pop}`);
    }
  });

  if (state.debug === true) {
    console.log("STATE", state);
  }
}

// Map output to form values
function getOutput(population, pops, aggRaw) {
  const allPops = pops.all;
  const index = allPops.indexOf(population);
  const metrics = headers.metrics;
  printHeader(population);

  // Set the household based on the chosen population
  let household;
  if (population === "Youth") {
    household = "Youth";
  } else if (population === "Family") {
    household = "Family";
  } else household = "Single Adult";

  const demographicId = population;

  metrics.map((metric) => {
    state.backend_output["[" + demographicId + "] Population"] = household;
    state.backend_output["[" + demographicId + "] Subpopulation"] = population;
    state.backend_output["[" + demographicId + "] Demographic"] = "All";
    state.backend_output["[" + demographicId + "] " + metric] = aggRaw[metric][index];

    // Convert uppercase metric to title case for printing to screen
    const titleCaseMetric = metric
      .split(" ")
      .map((w) => w[0].toUpperCase() + w.substr(1).toLowerCase())
      .join(" ");

    printValue(population, titleCaseMetric, aggRaw[metric][index]);
  });
}

function printValue(population, calculation, result) {
  if (result > 0 && calculation === "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT") {
    d3.select(".agg-table").append("div").classed("agg-value", true).classed(`${population}`, true).classed("hide", true).html(`${population}`);
    d3.select(".agg-table").append("div").classed("agg-value", true).classed(`${population}`, true).classed("hide", true).html(`${calculation}`);
    d3.select(".agg-table").append("div").classed("agg-value", true).classed(`${population}`, true).classed("hide", true).html(`<b>${result} days</b>`);
  } else if (result === null || (result === 0 && calculation === "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT")) {
    d3.select(".agg-table").append("div").classed("agg-value", true).classed(`${population}`, true).classed("hide", true).html(`${population}`);
    d3.select(".agg-table").append("div").classed("agg-value", true).classed(`${population}`, true).classed("hide", true).html(`${calculation}`);
    d3.select(".agg-table").append("div").classed("agg-value", true).classed(`${population}`, true).classed("hide", true).html(`<b class='neutral' style='font-weight:400;'>${result}</b>`);
  } else if (result > 0 && calculation != "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT") {
    d3.select(".agg-table").append("div").classed("agg-value", true).classed(`${population}`, true).classed("hide", true).html(`${population}`);
    d3.select(".agg-table").append("div").classed("agg-value", true).classed(`${population}`, true).classed("hide", true).html(`${calculation}`);
    d3.select(".agg-table").append("div").classed("agg-value", true).classed(`${population}`, true).classed("hide", true).html(`<b>${result}</b>`);
  } else {
    d3.select(".agg-table").append("div").classed("agg-value", true).classed(`${population}`, true).classed("hide", true).html(`${population}`);
    d3.select(".agg-table").append("div").classed("agg-value", true).classed(`${population}`, true).classed("hide", true).html(`${calculation}`);
    d3.select(".agg-table").append("div").classed("agg-value", true).classed(`${population}`, true).classed("hide", true).html(`<b class='neutral' style='font-weight:400;'>${result}</b>`);
  }
}

function printHeader(population) {
  d3.select(".agg-table").append("div").classed("agg-header", true).classed(`${population}`, true).classed("hide", true).html(`Subpopulation`);
  d3.select(".agg-table").append("div").classed("agg-header", true).classed(`${population}`, true).classed("hide", true).text("Calculation");
  d3.select(".agg-table").append("div").classed("agg-header", true).classed(`${population}`, true).classed("hide", true).text("Result");
}

// Parses data as a CSV and downloads the file
function submitData(data) {
  state.data_csv = Papa.unparse(data);

  let submitForm = document.createElement("form");
  submitForm.setAttribute("id", "submit-form");
  submitForm.setAttribute("method", "POST");
  headers.backend.map((field, fieldIndex) => {
    const fieldName = field;
    const fieldValue = data[field];
    const i = document.createElement("input");
    i.setAttribute("type", "text");
    i.setAttribute("id", "input-" + fieldIndex);
    i.setAttribute("name", fieldName);
    i.setAttribute("value", fieldValue);
    submitForm.appendChild(i);
  });

  const s = document.createElement("button");
  s.setAttribute("type", "submit");
  s.setAttribute("value", "Submit");

  submitForm.appendChild(s);
  submitForm.addEventListener("submit", (e) => {
    let scriptUrl;

    if (state.testSubmit === true) {
      console.log("%cForm submitting to TEST URL.", "background: white; color: red");
      scriptUrl = state.testScriptUrl;
    } else {
      scriptUrl = state.finalScriptUrl;
    }

    e.preventDefault();

    const value = "form";

    fetch(scriptUrl, {
      method: "POST",
      body: new FormData(submitForm),
    })
      .then((response) => {
        d3.select(".progress-msg").html(`Submitting Data for ${state.meta_reportingDate}...`).style("opacity", "0").transition().duration(200).style("opacity", "1");

        d3.select(".progress-bar").html(`<progress id="file" value="1" max="2">1</progress>`);

        setTimeout(() => {
          d3.select(".progress-msg").html(`✨ All Data Submitted for ${state.meta_reportingDate}! ✨`).style("opacity", "0").transition().duration(200).style("opacity", "1");
          d3.select(".progress-bar").html(`<progress id="file" value="${2}" max="2">${6}</progress>`);

          d3.select(".new-upload-submit").style("opacity", "0").transition().duration(400).style("opacity", "1");
          d3.select(".new-upload-submit").classed("hide", false);
          submitForm.remove();
        }, 1100);
      })
      .catch((error) => {
        d3.select(".progress-bar").classed("hide", true);
        d3.select(".progress-msg")
          .html(`<div style='text-align: center; background-color: #ffa5a5; padding: 20px; margin: 10px; border: 1px solid var(--color-alert)'><b style='font-size:var(--root-size);'>ERROR SUBMITTING DATA! <br> Please contact bfzdatasupport@community.solutions. <br> <b style='color:var(--color-alert); font-size:var(--root-size)'>${error}</b></b></div>`)
          .style("opacity", "0")
          .transition()
          .duration(200)
          .style("opacity", "1");
        console.error("Error!", error.message);
        submitForm.remove();
      });
  });

  submitForm.className = "hide";
  document.body.appendChild(submitForm);
  s.click();
}
