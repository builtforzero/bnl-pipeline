// Require packages
const d3 = require("d3");

// Import components
import { headers, pops } from "./dict.js";
import { Validator } from "./js/validate.js";
import { Calculator } from "./js/calculate.js";
import { FormHandler } from "./js/form.js";
import { Utils } from "./js/utils.js";

// Initialize components
let test = new Validator();
let calc = new Calculator();
let form = new FormHandler();
let util = new Utils();

/* APPLICATION STATE */
let state = {
  _dev: {
    version: "v4.1.0 | 06/2021",
    debug: false,
    scriptUrl: "https://script.google.com/macros/s/AKfycbwvTt15bDYq7eSvjyikYZ4t7yaUnwXQk8w_-0XWZIcGqpB3ag8yq_e5szwZkAoUP2ND/exec",
    height: 1578,
  },
  _import: {
    comm_data: null,
    comm_list: null,
    dr_data: null
  },

  dr: {
    "All": null, 
    "All Singles": null, 
    "Veteran": null, 
    "Chronic": null, 
    "Chronic Veteran": null, 
    "Youth": null, 
    "Families": null
  },

  form: {
    community_clean: null,
    month: null,
    current_months: null,
    year: null,
    name: null,
    email: null,
    org: null,
    file_upload: null,
    fileList: null,
    fileFormat: null,
  },

  meta: {
    timestamp: null,
    community: null,
    reportingDate: null,
    selectedPop: "All",
  },

  data: {
    raw: null,
    clean: null,
    headers: null,
    csv: null,
  },

  // Output
  output: {},

  rows: {
    active: {},
    all: {},
    filtered: {}
  },

  backend: {
    output: []
  },

  test: {
    _names: ["required", "pii", "ssn", "datatype"],
    _pass: {
      required: false,
      pii: false,
      ssn: false,
      datatype: false,
    },
    remainingSections: null,
    required: {
      sectionOpen: false,
      pass: [],
      fail: [],
    },
    pii: {
      sectionOpen: false,
      pass: [],
      fail: [],
    },
    ssn: {
      sectionOpen: false,
      passHeaders: [],
      failHeaders: [],
      pass: {},
      fail: {}
    },
    datatype: {
      sectionOpen: false,
      passHeaders: [],
      failHeaders: [],
      pass: {},
      fail: {}
    },
  }
};

init(state, form);

function init(state, form) {
  d3.select(".loading-screen")
    .style("height", state._dev.height + "px");

  form.checkStatus(state);
  form.getCommunityList(state, form);
  setupButtons();
  setUpSectionToggle(state);

  d3.select(".version-text").text(state._dev.version);

  d3.select(".required-header-list")
    .selectAll("li")
    .data(headers.required)
    .enter()
    .append("li")
    .attr("value", (d) => d)
    .text((d) => d);

  d3.select('.required-header-count')
    .text(headers.required.length)

  /* d3.select(".recommended-header-list")
    .selectAll("li")
    .data(headers.recommended)
    .enter()
    .append("li")
    .attr("value", (d) => d)
    .text((d) => d);

  d3.select('.recommended-header-count')
    .text(headers.recommended.length) */
}

/* EVENT LISTENERS */
function setupButtons() {

  /* 
  * Validate Button
  */
  d3.select("#validateButton").on("click", function () {
    if (state.fileList === null || state.data.headers === null) {
      util.clearFileInput("filePicker");
      d3.select(".validateBtn-msg").text("Please upload a valid by-name list file. The file picker is empty.")
    } else {
      d3.select(".validateBtn-msg").text("")
      // Run the validation tests
      runTests(state.data.headers, state.data.raw, state);

      // Remove any lingering values from a previous aggregation
      state.backend.raw = null;
      state.backend.output = [];
      d3.selectAll(".agg-header").remove();
      d3.selectAll(".agg-value").remove();
      d3.selectAll(".filter-btn").remove();

      // Deactivate the submit button
      // Activate the aggregate button
      // Show the reupload button
      util.deactivate(d3.select("#submitButton"), false);
      util.activate(d3.select("#aggregateButton"), false);
      d3.select(".reupload-aggregate").classed("hide", false);
    }
  });


  /* 
  * Reupload and New Upload Buttons
  */
  d3.selectAll(".reupload-aggregate,.reupload-submit,.new-upload-submit").on("click", function () {
    util.resetData(state);
    util.clearFileInput("filePicker");
  });

  d3.select(".download-btn").on("click", function () {
    downloadData(state.backend.output);
  })


  /* 
  * Aggregate Button
  */
  d3.select("#aggregateButton").on("click", function () {
    // Remove any lingering values
    state.backend.raw = null;
    state.backend.output = [];
    d3.selectAll(".agg-header").remove();
    d3.selectAll(".agg-value").remove();
    d3.selectAll(".filter-btn").remove();

    // Aggregate the data
    aggregate(state.data.raw, state);
    

    // Deactivate and hide the aggregate button
    // Activate the submit button
    util.deactivate(d3.select("#aggregateButton"), false);
    util.activate(d3.select("#submitButton"), false);
    d3.select(".reupload-aggregate").classed("hide", true);
    d3.select(".reupload-submit").classed("hide", false);
    d3.select(".download-btn").classed("hide", false);
    d3.select(".submit-instructions").classed("hide", false);
    d3.select(".review-msg").classed("hide", false);
    d3.select(".button-group-title").classed("hide", false);
    d3.select(".button-group-subtitle").classed("hide", false);
    d3.select(".button-group-instructions").classed("hide", false);

  });

  
  /* 
  * Submit Button
  */
  d3.select("#submitButton").on("click", function () {
    // Submit the data
    submitData(state.backend.output);
    // Deactivate and hide the submit button
    // Hide the reupload button
    d3.select(".reupload-aggregate").classed("hide", true);
    d3.select(".reupload-submit").classed("hide", true);
    d3.select(".download-btn").classed("hide", true);
    util.deactivate(d3.select("#aggregateButton"), false);
    util.deactivate(d3.select("#submitButton"), false);
    d3.select(".submit-progress-msg").html(`Submitting...`).style("opacity", "0").transition().duration(200).style("opacity", "1");
    d3.select(".submit-progress-bar").html(`<progress id="file" value="${0}" max="6">${0}</progress>`).style("opacity", "0").transition().duration(200).style("opacity", "1");
    d3.select(".submit-instructions").classed("hide", true);
    d3.select(".review-msg").classed("hide", true);

    if (state._dev.debug === true) { 
      console.log("✨ CLICKED SUBMIT BUTTON ✨");
      console.log("  Data To Submit:", state.backend.output);
      console.log("  Overall State:", state);
      console.log(" ");
    }
  });
}

function setUpSectionToggle(state) {
  state.test._names.map((testName) => {
    const loc = {
      headerName: `${testName}-header`,
      selectLocation: `${testName}-name`,
      infoLocation: `${testName}-info`,
      toggleLocation: `${testName}-name-toggle`
    }
    // Hover event
    d3.selectAll(`.${loc.headerName}`)
      .on("mouseover", (d) => {
        d3.selectAll(`.${loc.headerName}`).style("background-color", "var(--color-bg-gray)")
      })
      .on("mouseout", (d) => {
        d3.selectAll(`.${loc.headerName}`).style("background-color", "white")
      })

    // Section toggling
    d3.select(`#${loc.selectLocation}`).on("click", function () {
      state.test.remainingSections = state.test._names.filter(d => d != testName)
      state.test[testName].sectionOpen = !state.test[testName].sectionOpen
      // Close inactive steps
      state.test.remainingSections.map((remainingStep) => {
        state.test[remainingStep].sectionOpen = false;
        d3.select(`#${remainingStep}-info`).style("opacity", "1").transition().duration(200).style("opacity", "0");
        d3.select(`#${remainingStep}-info`).classed("hide", true);
        d3.select(`#${remainingStep}-name-toggle`).text("SHOW DETAILS ▼");
      })

      // Open or close the active step
      if (state.test[testName].sectionOpen === true) {
        d3.select(`#${loc.infoLocation}`).style("opacity", "0").transition().duration(200).style("opacity", "1");
        d3.select(`#${loc.infoLocation}`).classed("hide", false);
        d3.select(`#${loc.toggleLocation}`).text("HIDE DETAILS ▲");
      } else {
        d3.select(`#${loc.infoLocation}`).style("opacity", "1").transition().duration(200).style("opacity", "0");
        d3.select(`#${loc.infoLocation}`).classed("hide", true);
        d3.select(`#${loc.toggleLocation}`).text("SHOW DETAILS ▼");
      }
    })
    
  })
}


/* 
*RUN TESTS AND CHECK VALIDATION STATUS 
*/
function runTests(headerArray, data, state) {
  headerArray.map((headerName) => {
    test.testHeaderAndValues(headerName, data, state)
  })
  test.evaluateAndPrintTestResults(state);
  const results = []
  state.test._names.map((testName) => {
    results.push(state.test._pass[testName])
  })
  checkValidationStatus(results, state);
  
}

function checkValidationStatus(resultsArray, state) {
  if (resultsArray.some(util.valueIsFalse)) {
    util.deactivate(d3.select("#validateButton"), false);
    util.deactivate(d3.select("#aggregateButton"), true);
    d3.select("#reupload-button").classed("hide", false);
    // Reset values
    state.backend.raw = null;
    state.backend.output = [];
    d3.selectAll(".agg-header").remove();
    d3.selectAll(".agg-value").remove();
    d3.selectAll(".filter-btn").remove();
    // Console flag
    if (state._dev.debug === true) { 
      console.log("✨ VALIDATED DATA ✨");
      console.log("  Some tests failed:", state.test._pass);
      console.log("  Test Object:", state.test);
      console.log("  Overall State:", state);
      console.log(" ");
    }

  } else if (resultsArray.some(util.valueIsTrue)) {
    util.deactivate(d3.select("#validateButton"), false);
    util.activate(d3.select("#aggregateButton"), true);
    // Reset values
    state.backend.raw = null;
    state.backend.output = [];
    d3.selectAll(".agg-header").remove();
    d3.selectAll(".agg-value").remove();
    d3.selectAll(".filter-btn").remove();
    // Console flag
    if (state._dev.debug === true) { 
      console.log("✨ VALIDATED DATA ✨");
      console.log("  All tests passed:", state.test._pass);
      console.log("  Test Object:", state.test);
      console.log("  Overall State:", state);
      console.log(" ");
    }
    // Run the data cleaner
    calc.cleanData(state.data.raw, state);
    calc.getAndPrintMetrics(state);
    
  }
}


/* 
* AGGREGATE DATA
*/
function buttonTitle(month, population) {
  return `<b>${month} &nbsp;<b style='color: gray;'>|</b>&nbsp; ${population}</b>`
}

function aggregate(data, state) {
  calc.reset(state);
  calc.getAndPrintMetrics(state, data);
  
  // Update visible reporting month and community
  d3.select(".button-group-title").html(buttonTitle(state.meta.reportingDate, state.meta.selectedPop));

  d3.select(".button-group-subtitle").html(`${state.form.community_clean}`);
  d3.select(".button-group-instructions").html(`Select a subpopulation to review`);

  if (state._dev.debug === true) { 
    console.log("✨ CALCULATED DATA RELIABILITY ✨");
    console.log("  Data Reliability:", state.dr);
    console.log("  Overall State:", state);
    console.log(" ");
  }
  
  if (state._dev.debug === true) { 
    console.log("✨ CLICKED AGGREGATE BUTTON ✨");
    console.log("  Aggregated Output:", state.output);
    console.log("  Aggregated Rows", state.rows);
    console.log("  Overall State:", state);
    console.log(" ");
  }

  addPopButtons();

}

function addPopButtons() {
  // Add the population buttons
  // Toggle the visible aggregation result by population
  pops.all.map((pop) => {
    const popLookup = pop.replace(' ', '')
    // Set the "remaining populations" to everything but the chosen pop
    const getPops = pops.all.filter((d) => {
      return d != pop;
    });

    const remainingPops = getPops.map((value) => {
      return value.replace(' ', '')
    })
    
    // Add a button for the population
    d3.select(".button-group").append("button").classed(`${popLookup}-btn filter-btn`, true);

    // Set "All" as the default population to be visible
    if (pop === "All") {
      d3.selectAll(`.${popLookup}`).style("opacity", "0").transition().duration(200).style("opacity", "1");
      d3.selectAll(`.${popLookup}`).classed("hide", false);
      remainingPops.map((remaining) => {
        d3.selectAll(`.${remaining}`).style("opacity", "1").transition().duration(100).style("opacity", "0");
        d3.selectAll(`.${remaining}`).classed("hide", true);
      });
      // Set the button to be focused
      d3.select(`.${popLookup}-btn`).node().focus();
      // Add an event listener and label to the button
      d3.select(`.${popLookup}-btn`)
        .on("click", function () {
          state.meta.selectedPop = pop;
          d3.select(".button-group-title")
            .style("opacity", "0")
            .html(buttonTitle(state.meta.reportingDate, pop))
            .transition()
            .duration(200)
            .style("opacity", "1");

          d3.selectAll(`.${popLookup}`).style("opacity", "0").transition().duration(200).style("opacity", "1");
          d3.selectAll(`.${popLookup}`).classed("hide", false);
          remainingPops.map((remaining) => {
            d3.selectAll(`.${remaining}`).style("opacity", "1").transition().duration(100).style("opacity", "0");
            d3.selectAll(`.${remaining}`).classed("hide", true);
          });
        })
        .append("div")
        .attr("class", "label")
        .text(`${popLookup}`);
    } else {
      // Add an event listener and label to the button
      d3.select(`.${popLookup}-btn`)
        .on("click", function () {
          state.meta.selectedPop = pop;
          d3.select(".button-group-title")
            .style("opacity", "0")
            .html(buttonTitle(state.meta.reportingDate, pop))
            .transition()
            .duration(200)
            .style("opacity", "1");

          d3.selectAll(`.${popLookup}`).style("opacity", "0").transition().duration(200).style("opacity", "1");
          d3.selectAll(`.${popLookup}`).classed("hide", false);
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
}

/* 
* DOWNLOAD & SUBMIT DATA
*/
function downloadData(data) {
  const headers = [...Object.keys(data)]
  const values = [...Object.values(data)]
  console.log(headers, values);
  state.data.csv = "data:text/csv;charset=utf-8," + headers.map((header, index) => {
    const output = header + "," + values[index] + "\n"
    console.log(output);
    return output;
  })

  const dateFormat = d3.timeFormat("%m-%d-%Y_%H%M")
  const formattedTimestamp = dateFormat(state.meta.timestamp)
  const fileName =  state.form.month + state.form.year.toString() + "_" + state.meta.community + "_" + formattedTimestamp.toString() + ".csv"
  const encodedUri = encodeURI(state.data.csv);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", fileName);
  document.body.appendChild(link); // Required for FF
  link.click(); //
}

// Parses data as a CSV and downloads the file
function submitData(data) {

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

    e.preventDefault();
    const value = "form";

    fetch(state._dev.scriptUrl, {
      method: "POST",
      body: new FormData(submitForm),
    })
      .then((response) => {
        d3.select(".submit-progress-msg").html(`Submitting Data for ${state.meta.reportingDate}...`).style("opacity", "0").transition().duration(200).style("opacity", "1");

        d3.select(".submit-progress-bar").html(`<progress id="file" value="1" max="2">1</progress>`);

        setTimeout(() => {
          d3.select(".submit-progress-msg").html(`✨ All Data Submitted for ${state.meta.reportingDate}! ✨`).style("opacity", "0").transition().duration(200).style("opacity", "1");
          d3.select(".submit-progress-bar").html(`<progress id="file" value="${2}" max="2">${6}</progress>`);

          d3.select(".new-upload-submit").style("opacity", "0").transition().duration(400).style("opacity", "1");
          d3.select(".new-upload-submit").classed("hide", false);
          submitForm.remove();
        }, 1100);
      })
      .catch((error) => {
        d3.select(".submit-progress-bar").classed("hide", true);
        d3.select(".submit-progress-msg")
          .html(`<div style='text-align: center; background-color: #ffa5a5; padding: 20px; margin: 10px; border: 1px solid var(--color-alert)'><b style='font-size:var(--root-size);'>ERROR SUBMITTING DATA! <br> Please contact bfzdatasupport@community.solutions. <br> <b style='color:var(--color-alert); font-size:var(--root-size)'>${error}</b></b></div>`)
          .style("opacity", "0")
          .transition()
          .duration(200)
          .style("opacity", "1");
        console.error("Error submitting data to backend", error.message);
        submitForm.remove();
      });
  });

  submitForm.className = "hide";
  document.body.appendChild(submitForm);
  s.click();
}
