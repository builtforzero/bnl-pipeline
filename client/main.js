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
import { difference } from "d3";

// Initialize components
let test = new Validator();
let form = new FormHandler();
let agg = new Aggregator();
let util = new Utils();

/* 

dr = {
  netChange: (month0.inflow + month1.inflow + month2.inflow) - (month0.outflow + month1.outflow + month2.outflow),
  newDR: (month0.activelyHomeless - month3.activelyHomeless - netChange) / month0.activelyHomeless,
  oldDR: null,
  month0: {
    month: null,
    activelyHomeless: null,
    inflow: null,
    outflow: null,
  },
  month1: {
    month: null,
    activelyHomeless: null,
    inflow: null,
    outflow: null,
  },
  month2: {
    month: null,
    activelyHomeless: null,
    inflow: null,
    outflow: null,
  },
  month3: {
    month: null,
    activelyHomeless: null,
  }
}

*/

/* APPLICATION STATE */
let state = {
  version: "v3.2 | 02/2021",
  debug: true, // Toggle to remove required fields
  testSubmit: false, // Toggle to switch to test script URL

  finalScriptUrl: "https://script.google.com/macros/s/AKfycbw9aaR-wsxXoctwOTNxjRtm0GeolA2zwaHWSgIyfD-U-tUt59xWzjBR/exec",
  testScriptUrl: "https://script.google.com/macros/s/AKfycbw9aaR-wsxXoctwOTNxjRtm0GeolA2zwaHWSgIyfD-U-tUt59xWzjBR/exec",

  // Community Name Import
  comm_import: null,
  comm_list: null,

  // Data Reliability Import
  dr_import: null,
  dr_netChange: null,
  dr: null,
  dr_month0: {
    month: null,
    ah: null,
    inflow: null,
    outflow: null,
  },
  dr_month1: {
    month: null,
    ah: null,
    inflow: null,
    outflow: null,
  },
  dr_month2: {
    month: null,
    ah: null,
    inflow: null,
    outflow: null,
  },
  dr_month3: {
    month: null,
    ah: null,
  },

  // Form Fields
  form_community_clean: null,
  form_month: null,
  form_current_months: null,
  form_year: null,
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

  // Output
  output: {
    ah: null,
    hp: null,
    inactive: null,
    newlyId: null,
    retHousing: null,
    retInactive: null,
    lot: null
  },

  // Backend
  backend_raw: null,
  backend_output: [],
};

init(state, form);

function init(state, form) {
  d3.select(".version-number").text(state.version);
  form.checkStatus(state);
  form.getCommunityList(state, form);
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
  const reportingDate = new Date(util.formatDate(state.meta_reportingDate, "from MY"));

  // "Active" Status = clients identified 
  // BEFORE the reporting Month Year 
  // that DO NOT have an exit date,
  // or whose exit date is AFTER the reporting MY
  const status = {
    "Active": data.filter((d) => {
      const idDate = new Date(util.formatDate(d["Date of Identification"], "from long year", "as MY"))
      const housingDate = new Date(util.formatDate(d["Housing Move-In Date"], "from long year", "as MY"))
      const inactiveDate = new Date(util.formatDate(d["Inactive Date"], "from long year", "as MY"))

      return d["Household Type"] != null &&
      d["Date of Identification"] != null &&
      idDate <= reportingDate &&
      ( // one of these two conditions:
        (d["Housing Move-In Date"] === null && d["Inactive Date"] === null) ||
        (housingDate > reportingDate || inactiveDate > reportingDate)
      )
    }),

    "All": data.filter((d) => {
      return d["Household Type"] != null
    })
  }

  const filterMap = {
    // ALL CLIENTS
    "All All": data,
    "All All Singles": status["All"].filter((d) => {
      return values.singleAdult.includes(util.clean(d["Household Type"])) === true;
    }),
    "All Veteran": status["All"].filter((d) => {
      return d["Veteran Status"] != null && 
      values.singleAdult.includes(util.clean(d["Household Type"])) === true && 
      values.veteran.includes(util.clean(d["Veteran Status"])) === true;
    }),
    "All Chronic": status["All"].filter((d) => {
      return d["Chronic Status"] != null && 
      values.singleAdult.includes(util.clean(d["Household Type"])) === true && 
      values.chronic.includes(util.clean(d["Chronic Status"])) === true;
    }),
    "All Chronic Veteran": status["All"].filter((d) => {
      return d["Chronic Status"] != null && 
      values.singleAdult.includes(util.clean(d["Household Type"])) === true && 
      values.chronic.includes(util.clean(d["Chronic Status"])) === true &&
      values.veteran.includes(util.clean(d["Veteran Status"])) === true;
    }),
    "All Youth": status["All"].filter((d) => {
      return values.youth.includes(util.clean(d["Household Type"])) === true;
    }),
    "All Families": status["All"].filter((d) => {
      return values.family.includes(util.clean(d["Household Type"])) === true;
    }),

    // ACTIVE CLIENTS ONLY
    "Active All": status["Active"],
    "Active All Singles": status["Active"].filter((d) => {
      return values.singleAdult.includes(util.clean(d["Household Type"])) === true;
    }),
    "Active Veteran": status["Active"].filter((d) => {
      return d["Veteran Status"] != null &&
      values.singleAdult.includes(util.clean(d["Household Type"])) === true && 
      values.veteran.includes(util.clean(d["Veteran Status"])) === true;
    }),
    "Active Chronic": status["Active"].filter((d) => {
      return  d["Chronic Status"] != null &&
      values.singleAdult.includes(util.clean(d["Household Type"])) === true && 
      values.chronic.includes(util.clean(d["Chronic Status"])) === true;
    }),
    "Active Chronic Veteran": status["Active"].filter((d) => {
      return  d["Chronic Status"] != null && 
      d["Veteran Status"] != null &&
      values.singleAdult.includes(util.clean(d["Household Type"])) === true && 
      values.chronic.includes(util.clean(d["Chronic Status"])) === true &&
      values.veteran.includes(util.clean(d["Veteran Status"])) === true;
    }),
    "Active Youth": status["Active"].filter((d) => {
      return values.youth.includes(util.clean(d["Household Type"])) === true;
    }),
    "Active Families": status["Active"].filter((d) => {
      return values.family.includes(util.clean(d["Household Type"])) === true;
    }),
  };
  return filterMap[category];
}


// Calculate data reliability
// Reporting month = September 2020
// Arr of four months prior = 
// Get AH, Sum of Inflow, and Sum of Outflow for each of the four months
/* 

dr = {
  netChange: (month0.inflow + month1.inflow + month2.inflow) - (month0.outflow + month1.outflow + month2.outflow),
  newDR: (month0.activelyHomeless - month3.activelyHomeless - netChange) / month0.activelyHomeless,
  oldDR: #,
  month0: {
    month: September 2020,
    activelyHomeless: #,
    inflow: #,
    outflow: #,
  },
  month1: {
    month: August 2020,
    activelyHomeless: #,
    inflow: #,
    outflow: #,
  },
  month2: {
    month: July 2020,
    activelyHomeless: #,
    inflow: #,
    outflow: #,
  },
  month3: {
    month: June 2020,
    activelyHomeless: #,
  }
}

*/


function calculate(state, data, calculation) {
  const reportingDate = state.meta_reportingDate;
  const activeCats = pops.all.map((pop) => {
    return "Active " + pop;
  });
  const allCats = pops.all.map((pop) => {
    return "All " + pop;
  });

  // Console log: category, categoryData, filteredData, clients
  const calcMap = {
    "ACTIVELY HOMELESS NUMBER": activeCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then get the unique number of clients
      const clients = util.getColByName(categoryData, categoryData.length, pops.clientId);
      return {
        calc: "ACTIVELY HOMELESS NUMBER",
        category: category,
        categoryData: categoryData,
        clients: clients,
        outputValue: new Set(clients).size
      };
    }),
    "HOUSING PLACEMENTS": allCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        return d["Housing Move-In Date"] != null && util.getDate(d["Housing Move-In Date"], "MY", state) === reportingDate;
      });
      // Then get the unique number of clients
      const clients = util.getColByName(filteredData, filteredData.length, pops.clientId);
      return {
        calc: "HOUSING PLACEMENTS",
        category: category,
        categoryData: categoryData,
        filteredData: filteredData,
        clients: clients,
        outputValue: new Set(clients).size
      };
    }),
    "MOVED TO INACTIVE NUMBER": allCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        return d["Inactive Date"] != null && util.getDate(d["Inactive Date"], "MY", state) === reportingDate;
      });
      // Then get the unique number of clients
      const clients = util.getColByName(filteredData, filteredData.length, pops.clientId);
      return {
        calc: "MOVED TO INACTIVE NUMBER",
        category: category,
        categoryData: categoryData,
        filteredData: filteredData,
        clients: clients,
        outputValue: new Set(clients).size
      };
    }),
    "NEWLY IDENTIFIED NUMBER": activeCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        return d["Date of Identification"] != null && d["Inactive Date"] === null && d["Returned to Active Date"] === null && util.getDate(d["Date of Identification"], "MY", state) === reportingDate;
      });
      // Then get the unique number of clients
      const clients = util.getColByName(filteredData, filteredData.length, pops.clientId);
      return {
        calc: "NEWLY IDENTIFIED NUMBER",
        category: category,
        categoryData: categoryData,
        filteredData: filteredData,
        clients: clients,
        outputValue: new Set(clients).size
      };
    }),
    "RETURNED TO ACTIVE LIST FROM HOUSING NUMBER": activeCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        return d["Housing Move-In Date"] != null && util.getDate(d["Returned to Active Date"], "MY", state) === reportingDate && util.getDate(d["Returned to Active Date"], "MDY", state) > util.getDate(d["Housing Move-In Date"], "MDY", state);
      });
      // Then get the unique number of clients
      const clients = util.getColByName(filteredData, filteredData.length, pops.clientId);
      return {
        calc: "RETURNED TO ACTIVE LIST FROM HOUSING NUMBER",
        category: category,
        categoryData: categoryData,
        filteredData: filteredData,
        clients: clients,
        outputValue: new Set(clients).size
      };
    }),
    "RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER": allCats.map((category) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        return d["Inactive Date"] != null && util.getDate(d["Returned to Active Date"], "MY", state) === reportingDate && util.getDate(d["Returned to Active Date"], "MDY", state) > util.getDate(d["Inactive Date"], "MDY", state);
      });
      // Then get the unique number of clients
      const clients = util.getColByName(filteredData, filteredData.length, pops.clientId);
      return {
        calc: "RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER",
        category: category,
        categoryData: categoryData,
        filteredData: filteredData,
        clients: clients,
        outputValue: new Set(clients).size
      };
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
              return "N/A";
            } else {
              return converted;
            }
          } else {
            return "N/A";
          }
        })
        .filter((value) => value != "N/A");

        const round = d3.format(".1f");
        const average = round(d3.mean(difference), 1);

      // Reduce the differences map to a single average value
      if (difference.length === 0) {
        return {
          calc: "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT",
          category: category,
          categoryData: categoryData,
          filteredData: filteredData, 
          outputValue: "N/A"
        };
      } else {
        const round = d3.format(".1f");
        const average = round(d3.mean(difference), 1);
        return {
          calc: "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT",
          category: category,
          categoryData: categoryData,
          filteredData: filteredData, 
          outputValue: average
      };
      }
    }),
  };

  

  return calcMap[calculation];
}

function aggregate(data) {
  // Reset values
  state.output.ah = null;
  state.output.hp = null;
  state.output.inactive = null;
  state.output.newlyId = null;
  state.output.retHousing = null;
  state.output.retInactive = null;
  state.output.lot = null;

  state.backend_raw = null;
  state.backend_output = [];
  d3.selectAll(".agg-header").remove();
  d3.selectAll(".agg-spacer").remove();
  d3.selectAll(".agg-value").remove();

  state.output.ah = calculate(state, data, "ACTIVELY HOMELESS NUMBER");
  state.output.hp = calculate(state, data, "HOUSING PLACEMENTS");
  state.output.inactive = calculate(state, data, "MOVED TO INACTIVE NUMBER");
  state.output.newlyId = calculate(state, data, "NEWLY IDENTIFIED NUMBER");
  state.output.retHousing = calculate(state, data, "RETURNED TO ACTIVE LIST FROM HOUSING NUMBER");
  state.output.retInactive = calculate(state, data, "RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER");
  state.output.lot = calculate(state, data, "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT");

  if (state.debug === true) {
    console.log(state.output);
  }
  
  // Calculate by population
  state.backend_raw = {
    "ACTIVELY HOMELESS NUMBER": state.output.ah.map((value, index) => { return value.outputValue }),
    "HOUSING PLACEMENTS":  state.output.hp.map((value, index) => { return value.outputValue }),
    "MOVED TO INACTIVE NUMBER":  state.output.inactive.map((value, index) => { return value.outputValue }),
    "NEWLY IDENTIFIED NUMBER":  state.output.newlyId.map((value, index) => { return value.outputValue }),
    "RETURNED TO ACTIVE LIST FROM HOUSING NUMBER":  state.output.retHousing.map((value, index) => { return value.outputValue }),
    "RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER":  state.output.retInactive.map((value, index) => { return value.outputValue }),
    "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT":  state.output.lot.map((value, index) => { return value.outputValue }),
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
    getOutput(popValue, pops, state.backend_raw);
  });

  d3.select(".button-group-title").text("Select a subpopulation to review");

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

  const outputPop = pops.output[population].outputPop
  const outputSubpop = pops.output[population].outputSubpop
  const outputDemo = pops.output[population].outputDemo

  metrics.map((metric) => {
    state.backend_output["[" + population + "] Population"] = outputPop;
    state.backend_output["[" + population + "] Subpopulation"] = outputSubpop;
    state.backend_output["[" + population + "] Demographic"] = outputDemo;
    state.backend_output["[" + population + "] " + metric] = aggRaw[metric][index];

    // Convert uppercase metric to title case for printing to screen
    const titleCaseMetric = metric
      .split(" ")
      .map((w) => w[0].toUpperCase() + w.substr(1).toLowerCase())
      .join(" ");

    printValue(population, titleCaseMetric, aggRaw[metric][index]);
  });
}

function addAggValue(popLookup, value, type) {
  if (type === 'result' && (value === null || value === 0 || value === "N/A")) {
    d3.select(".agg-table")
      .append("div")
      .classed("agg-value", true)
      .classed(`${popLookup}`, true)
      .classed("hide", true)
      .html(`<b class='neutral' style='font-weight:400;'>${value}</b>`);
  } else if (type === 'result' && value != null && value != 0 && value != "N/A") {
    d3.select(".agg-table")
      .append("div")
      .classed("agg-value", true)
      .classed(`${popLookup}`, true)
      .classed("hide", true)
      .html(`<b>${value}</b>`);
  } else if (type === 'calculation') {
    d3.select(".agg-table")
      .append("div")
      .classed("agg-value", true)
      .classed(`${popLookup}`, true)
      .classed("hide", true)
      .html(`${value}`);
  } else {
    d3.select(".agg-table")
      .append("div")
      .classed("agg-value", true)
      .classed(`${popLookup}`, true)
      .classed("hide", true)
      .html(`<b class='neutral' style='font-weight:400;'>${value}</b>`);
  }
  
}


function printValue(population, calculation, result) {
  const popLookup = population.replace(' ', '')
  if (calculation === "Average Length Of Time From Identification To Housing Placement" && result != 1 && result != "N/A") {
    addAggValue(popLookup, calculation, 'calculation');
    addAggValue(popLookup, `${result} days`, 'result');
  } else if (calculation === "Average Length Of Time From Identification To Housing Placement" && result === 1) { 
    addAggValue(popLookup, calculation, 'calculation');
    addAggValue(popLookup, `${result} day`, 'result');
  } else {
    addAggValue(popLookup, calculation, 'calculation');
    addAggValue(popLookup, result, 'result');
  }
}

function printHeader(population) {

  const popLookup = population.replace(' ', '')

  d3.select(".agg-table").append("div").classed("agg-header", true).classed(`${popLookup}`, true).classed("hide", true).html(`${state.meta_reportingDate} <b style='color: gray;'>results for </b> ${population}`);

  d3.select(".agg-table").append("div").classed("agg-header", true).classed(`${popLookup}`, true).classed("hide", true).html(``);
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