// Require packages
const d3 = require("d3");
const Papa = require("papaparse");
const XLSX = require("xlsx");

// Import components
import { headers, pops, values } from "./dict.js";
import { Validator } from "./js/validate.js";
import { FormHandler } from "./js/form.js";
import { Utils } from "./js/utils.js";

// Initialize components
let test = new Validator();
let form = new FormHandler();
let util = new Utils();

/* APPLICATION STATE */
let state = {
  version: "v3.4.4 | 04/2021",
  debug: true, // Toggle to remove form field requirement
  scriptUrl: "https://script.google.com/macros/s/AKfycbw9aaR-wsxXoctwOTNxjRtm0GeolA2zwaHWSgIyfD-U-tUt59xWzjBR/exec",

  // Community Name Import
  comm_import: null,
  comm_list: null,

  // Data Reliability Import
  dr_import: null,
  dr: {
    "All": null, 
    "All Singles": null, 
    "Veteran": null, 
    "Chronic": null, 
    "Chronic Veteran": null, 
    "Youth": null, 
    "Families": null
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

  headerTestOutput: {},

  test: {
    required: {
      pass: [],
      fail: []
    },
    pii: {
      pass: [],
      fail: [],
    },
    ssn: {},
    datatype: {}
  },

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

  rows: {
    active: null,
    all: null,
  },

  // Backend
  backend_raw: null,
  backend_output: [],
};

/* SECTION TOGGLING STATE */
let section = {
  // State of each section
  validationSteps: ["headers", "pii", "ssn", "datatype"],
  remainingSections: null,
  headers: {
    isOpen: false,
    selectLocation: "#headers-name",
    infoLocation: "#headers-info",
    toggleLocation: "#headers-name-toggle"
  },
  pii: {
    isOpen: false,
    selectLocation: "#pii-name",
    infoLocation: "#pii-info",
    toggleLocation: "#pii-toggle"
  },
  ssn: {
    isOpen: false,
    selectLocation: "#ssn-name",
    infoLocation: "#ssn-info",
    toggleLocation: "#ssn-name-toggle"
  },
  datatype: {
    isOpen: false,
    selectLocation: "#datatype-name",
    infoLocation: "#datatype-info",
    toggleLocation: "#datatype-name-toggle"
  },
};

init(state, section, form);

function init(state, section, form) {
  d3.select(".version-number").text(state.version);

  d3.select(".required-header-list")
    .selectAll("li")
    .data(headers.required)
    .enter()
    .append("li")
    .attr("value", (d) => d)
    .text((d) => d);

  d3.select('.required-header-count')
    .text(headers.required.length)

  d3.select(".recommended-header-list")
    .selectAll("li")
    .data(headers.recommended)
    .enter()
    .append("li")
    .attr("value", (d) => d)
    .text((d) => d);

  d3.select('.recommended-header-count')
    .text(headers.recommended.length)

  form.checkStatus(state);
  form.getCommunityList(state, form);
  setupButtons();
  setUpSectionToggle(section);

  if (state.debug) {
    console.log("✨ APP INITIALIZED ✨");
    // Flag that required fields are off for testing
    console.log(
      "  %cRequired fields are currently OFF.",
      "background: white; color: red"
    );
    console.log("  Version:", state.version);
    console.log("  Debug On?", state.debug);
    console.log("  Overall State:", state);
    console.log(" ");
  }
}

/* EVENT LISTENERS */
function setupButtons() {
  // Validate button
  d3.select("#validateButton").on("click", function () {
    console.log("✨ CLICKED VALIDATE BUTTON ✨");
    console.log("  File List:", state.fileList);
    console.log("  Headers Detected:", state.data_headers.length, "fields");
    console.log("  Raw Data:", state.data_raw.length, "rows");
    console.log("  Overall State:", state);
    console.log(" ");

    if (state.fileList === null || state.data_headers === null) {
      util.clearFileInput("filePicker");
      d3.select(".validateBtn-msg").text("Please upload a valid by-name list file. The file picker is empty.")
    } else {
      d3.select(".validateBtn-msg").text("")
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
    }

  });

  // Reupload and new upload buttons
  d3.selectAll(".reupload-aggregate,.reupload-submit,.new-upload-submit").on("click", function () {
    util.resetData(state);
    util.clearFileInput("filePicker");
  });

  d3.select(".download-btn").on("click", function () {
    downloadData(state.backend_output);
  })

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
    d3.select(".download-btn").classed("hide", false);
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
    d3.select(".download-btn").classed("hide", true);
    util.deactivate(d3.select("#aggregateButton"), false);
    util.deactivate(d3.select("#submitButton"), false);
    d3.select(".progress-msg").html(`Submitting...`).style("opacity", "0").transition().duration(200).style("opacity", "1");
    d3.select(".progress-bar").html(`<progress id="file" value="${0}" max="6">${0}</progress>`).style("opacity", "0").transition().duration(200).style("opacity", "1");
    d3.select(".submit-instructions").classed("hide", true);
    d3.select(".review-msg").classed("hide", true);

    if (state.debug === true) { 
      console.log("✨ CLICKED SUBMIT BUTTON ✨");
      console.log("  Data To Submit:", state.backend_output);
      console.log("  Overall State:", state);
      console.log(" ");
    }
  });
}

function setUpSectionToggle(section) {
  // Apply event listeners to each validation step
  section.validationSteps.map((currentStep) => {
    d3.select(section[currentStep].selectLocation).on("click", function () {
      section.remainingSections = section.validationSteps.filter(d => d != currentStep)
      const infoLocation = section[currentStep].infoLocation
      const toggleLocation = section[currentStep].toggleLocation
      section[currentStep].isOpen = !section[currentStep].isOpen
      // Close inactive steps
      section.remainingSections.map((remainingStep) => {
        section[remainingStep].isOpen = false;
        d3.select(section[remainingStep].infoLocation).style("opacity", "1").transition().duration(200).style("opacity", "0");
        d3.select(section[remainingStep].infoLocation).classed("hide", true);
        d3.select(section[remainingStep].toggleLocation).text("SHOW DETAILS ▼");
      })
      // Open or close the active step
      if (section[currentStep].isOpen === true) {
        d3.select(infoLocation).style("opacity", "0").transition().duration(200).style("opacity", "1");
        d3.select(infoLocation).classed("hide", false);
        d3.select(toggleLocation).text("HIDE DETAILS ▲");
      } else {
        d3.select(infoLocation).style("opacity", "1").transition().duration(200).style("opacity", "0");
        d3.select(infoLocation).classed("hide", true);
        d3.select(toggleLocation).text("SHOW DETAILS ▼");
      }
      
    })
  })
}


/* 
*RUN TESTS AND CHECK VALIDATION STATUS 
*/
function runTests(headerArray, data, state) {

  headerArray.map((headerVal) => {
    if (headerVal === "" || headerVal === undefined || headerVal === null) {
      //console.log(headerVal);
      return;
    } else {
      test.validateHeader(headerVal, data, data.length, state);
    }
  });

  console.log(state.test);

  const headersOutput = test.requiredHeaders(headerArray, d3.select("#headers-name"), d3.select(".headers-val-symbol"), d3.select(".header-error"), state);
  const piiOutput = test.piiHeaders(headerArray, d3.select("#pii-name"), d3.select(".pii-val-symbol"), d3.select(".pii-error"), state);
  const ssnOutput = test.ssnValues(headerArray, data, d3.select("#ssn-name"), d3.select(".ssn-val-symbol"), d3.select(".ssn-error"), state);
  const datatypeOutput = test.dataType(headerArray, data, d3.select("#datatype-name"), d3.select(".datatype-val-symbol"), d3.select(".datatype-error"), state);

  const results = [headersOutput.result, piiOutput.result, ssnOutput.result, datatypeOutput.result];

  test.checkStatus(results, state);
}


/*
 * GET FILTERED ROWS
 */
function getRowsByStatus(data) {
  state.rows.active = null;
  state.rows.all = null;

  // "Active" Status = clients identified 
  // BEFORE the reporting Month Year 
  // that DO NOT have an exit date,
  // or whose exit date is AFTER the reporting MY
  const reportingDate = util.parseDate(state.meta_reportingDate);

  state.rows.active = data.filter((d) => {
    const idDate = util.parseDate(d["Date of Identification"])
    const housingDate = util.parseDate(d["Housing Move-In Date"])
    const inactiveDate = util.parseDate(d["Inactive Date"])
    return d["Household Type"] != null &&
    d["Date of Identification"] != null &&
    idDate <= reportingDate &&
    ( // any one of these conditions:
      (d["Housing Move-In Date"] === null && d["Inactive Date"] === null) ||
      (inactiveDate != null && inactiveDate < idDate) ||
      ((housingDate != null && housingDate > reportingDate) || (inactiveDate != null && inactiveDate > reportingDate))
    )
  })

  state.rows.all = data.filter((d) => {
    return d["Household Type"] != null
  })

}

// Filter data based on population status
function filterData(data, category) {
  const filterMap = {
    // ALL CLIENTS
    "All All": data,
    "All All Singles": state.rows.all.filter((d) => {
      return values.singleAdult.includes(util.clean(d["Household Type"])) === true;
    }),
    "All Veteran": state.rows.all.filter((d) => {
      return d["Veteran Status"] != null && 
      values.singleAdult.includes(util.clean(d["Household Type"])) === true && 
      values.veteran.includes(util.clean(d["Veteran Status"])) === true;
    }),
    "All Chronic": state.rows.all.filter((d) => {
      return d["Chronic Status"] != null && 
      values.singleAdult.includes(util.clean(d["Household Type"])) === true && 
      values.chronic.includes(util.clean(d["Chronic Status"])) === true;
    }),
    "All Chronic Veteran": state.rows.all.filter((d) => {
      return d["Chronic Status"] != null && 
      values.singleAdult.includes(util.clean(d["Household Type"])) === true && 
      values.chronic.includes(util.clean(d["Chronic Status"])) === true &&
      values.veteran.includes(util.clean(d["Veteran Status"])) === true;
    }),
    "All Youth": state.rows.all.filter((d) => {
      return values.youth.includes(util.clean(d["Household Type"])) === true;
    }),
    "All Families": state.rows.all.filter((d) => {
      return values.family.includes(util.clean(d["Household Type"])) === true;
    }),

    // ACTIVE CLIENTS ONLY
    "Active All": state.rows.active,
    "Active All Singles": state.rows.active.filter((d) => {
      return values.singleAdult.includes(util.clean(d["Household Type"])) === true;
    }),
    "Active Veteran": state.rows.active.filter((d) => {
      return d["Veteran Status"] != null &&
      values.singleAdult.includes(util.clean(d["Household Type"])) === true && 
      values.veteran.includes(util.clean(d["Veteran Status"])) === true;
    }),
    "Active Chronic": state.rows.active.filter((d) => {
      return  d["Chronic Status"] != null &&
      values.singleAdult.includes(util.clean(d["Household Type"])) === true && 
      values.chronic.includes(util.clean(d["Chronic Status"])) === true;
    }),
    "Active Chronic Veteran": state.rows.active.filter((d) => {
      return  d["Chronic Status"] != null && 
      d["Veteran Status"] != null &&
      values.singleAdult.includes(util.clean(d["Household Type"])) === true && 
      values.chronic.includes(util.clean(d["Chronic Status"])) === true &&
      values.veteran.includes(util.clean(d["Veteran Status"])) === true;
    }),
    "Active Youth": state.rows.active.filter((d) => {
      return values.youth.includes(util.clean(d["Household Type"])) === true;
    }),
    "Active Families": state.rows.active.filter((d) => {
      return values.family.includes(util.clean(d["Household Type"])) === true;
    }),
  };
  return filterMap[category];
}


/* 
*CALCULATE
*/
function calculate(state, data, calculation) {
  const reportingDate = state.meta_reportingDate;
  const subpop = pops.all.map((pop) => { return pop; });
  const activeCats = pops.all.map((pop) => { return "Active " + pop; });
  const allCats = pops.all.map((pop) => { return "All " + pop; });

  const calcMap = {
    "ACTIVELY HOMELESS NUMBER": activeCats.map((category, index) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then get the unique number of clients
      const clients = util.getColByName(categoryData, categoryData.length, pops.clientId);
      return {
        calc: "ACTIVELY HOMELESS NUMBER",
        subpop: pops.all[index],
        category: category,
        categoryData: categoryData,
        clients: clients,
        outputValue: new Set(clients).size
      };
    }),
    "HOUSING PLACEMENTS": allCats.map((category, index) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        const a = util.getMonthYear(d["Housing Move-In Date"]);
        return d["Housing Move-In Date"] != null && 
        util.getMonthYear(d["Housing Move-In Date"]) === reportingDate;
      });
      // Then get the unique number of clients
      const clients = util.getColByName(filteredData, filteredData.length, pops.clientId);
      return {
        calc: "HOUSING PLACEMENTS",
        subpop: pops.all[index],
        category: category,
        categoryData: categoryData,
        filteredData: filteredData,
        clients: clients,
        outputValue: new Set(clients).size
      };
    }),
    "MOVED TO INACTIVE NUMBER": allCats.map((category, index) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        return d["Inactive Date"] != null && 
        util.getMonthYear(d["Inactive Date"]) === reportingDate;
      });
      // Then get the unique number of clients
      const clients = util.getColByName(filteredData, filteredData.length, pops.clientId);
      return {
        calc: "MOVED TO INACTIVE NUMBER",
        subpop: pops.all[index],
        category: category,
        categoryData: categoryData,
        filteredData: filteredData,
        clients: clients,
        outputValue: new Set(clients).size
      };
    }),
    "NEWLY IDENTIFIED NUMBER": activeCats.map((category, index) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        return d["Date of Identification"] != null && 
        d["Inactive Date"] === null && 
        d["Returned to Active Date"] === null && 
        util.getMonthYear(d["Date of Identification"]) === reportingDate;
      });
      // Then get the unique number of clients
      const clients = util.getColByName(filteredData, filteredData.length, pops.clientId);
      return {
        calc: "NEWLY IDENTIFIED NUMBER",
        subpop: pops.all[index],
        category: category,
        categoryData: categoryData,
        filteredData: filteredData,
        clients: clients,
        outputValue: new Set(clients).size
      };
    }),
    "RETURNED TO ACTIVE LIST FROM HOUSING NUMBER": allCats.map((category, index) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        return d["Housing Move-In Date"] != null && 
        util.getMonthYear(d["Returned to Active Date"]) === reportingDate && 
        util.parseDate(d["Returned to Active Date"]) > util.parseDate(d["Housing Move-In Date"]);
      });
      // Then get the unique number of clients
      const clients = util.getColByName(filteredData, filteredData.length, pops.clientId);
      return {
        calc: "RETURNED TO ACTIVE LIST FROM HOUSING NUMBER",
        subpop: pops.all[index],
        category: category,
        categoryData: categoryData,
        filteredData: filteredData,
        clients: clients,
        outputValue: new Set(clients).size
      };
    }),
    "RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER": allCats.map((category, index) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        return d["Inactive Date"] != null && 
        util.getMonthYear(d["Returned to Active Date"]) === reportingDate && 
        util.parseDate(d["Returned to Active Date"]) > util.parseDate(d["Inactive Date"]);
      });
      // Then get the unique number of clients
      const clients = util.getColByName(filteredData, filteredData.length, pops.clientId);
      return {
        calc: "RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER",
        subpop: pops.all[index],
        category: category,
        categoryData: categoryData,
        filteredData: filteredData,
        clients: clients,
        outputValue: new Set(clients).size
      };
    }),
    "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT": allCats.map((category, index) => {
      // First filter data for the selected category
      const categoryData = filterData(data, category);
      // Then filter for additional criteria
      const filteredData = categoryData.filter((d) => {
        return d["Housing Move-In Date"] != null && 
        util.getMonthYear(d["Housing Move-In Date"]) === reportingDate;
      });
      // Get arrays of values for housing dates and ID dates
      const housingDates = util.getColByName(filteredData, filteredData.length, "Housing Move-In Date");
      const idDates = util.getColByName(filteredData, filteredData.length, "Date of Identification");
      // Map the difference between each housing and ID date, remove null values
      const difference = housingDates.map((houseDate, index) => {
          // Get corresponding ID date value
          const idDate = idDates[index];
          // Get difference in ms and convert to days
          if (houseDate != null && idDate != null) {
            const diff = util.parseDate(houseDate) - util.parseDate(idDate);
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
          subpop: pops.all[index],
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
          subpop: pops.all[index],
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



/* 
*DATA RELIABILITY CALCULATION
*for a single population category
*/
function getDataReliability(state, data, category) {
  // Get range of months based on reporting month
  const currentMonth = util.parseDate(state.meta_reportingDate)
  const oneMonthPrior = d3.timeMonth.offset(currentMonth, -1)
  const fourMonthsAgo = d3.timeMonth.offset(currentMonth, -4)
  const range = d3.timeMonth.range(fourMonthsAgo, oneMonthPrior)

  let values = {}
  let netChange, newDR, prevMonthError, sentence;
  const monthsWithNoData = []

  // Get pop, subpop, and demo
  const pop = pops.output[category].outputPop;
  const subpop = pops.output[category].outputSubpop;
  const demo = pops.output[category].outputDemo;

  range.map((month, index) => {
    const formatMY = d3.timeFormat("%B %Y")
    // First filter data for criteria
    const filteredData = data.filter((d) => { 
      return d["Community"] === state.form_community_clean &&
      d["Population"] === pop &&
      d["Subpopulation"] === subpop &&
      d["Demographic"] === demo &&
      d["Month"] === formatMY(month)
    })
    const monthNum = `month${index}`;

    if (filteredData.length === 0) {
      monthsWithNoData.push(month);
      values[monthNum] = {
        month: formatMY(month),
        ah: null,
        inflow: null,
        outflow: null
     }
    } else {
      values[monthNum] = {
        month: formatMY(month),
        ah: util.cleanNum(filteredData[0]["ACTIVELY HOMELESS NUMBER"]),
        inflow: util.cleanNum(filteredData[0]["NEWLY IDENTIFIED NUMBER"]) + 
                util.cleanNum(filteredData[0]["RETURNED TO ACTIVE LIST FROM HOUSING NUMBER"]) + 
                util.cleanNum(filteredData[0]["RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER"]),
        outflow: util.cleanNum(filteredData[0]["HOUSING PLACEMENTS"]) + 
                util.cleanNum(filteredData[0]["MOVED TO INACTIVE NUMBER"])
     }
    }
  })

  const thisMonthValues = {
    ah: state.output.ah.filter((d) => { return d["subpop"] === category; })[0].outputValue,
    hp: state.output.hp.filter((d) => { return d["subpop"] === category; })[0].outputValue,
    inactive: state.output.inactive.filter((d) => { return d["subpop"] === category; })[0].outputValue,
    newlyId:  state.output.newlyId.filter((d) => { return d["subpop"] === category; })[0].outputValue,
    retHousing: state.output.retHousing.filter((d) => { return d["subpop"] === category; })[0].outputValue,
    retInactive:  state.output.retInactive.filter((d) => { return d["subpop"] === category; })[0].outputValue,
  }

  values["month3"] = {
    month: state.meta_reportingDate,
    ah: thisMonthValues.ah,
    inflow: thisMonthValues.newlyId + thisMonthValues.retHousing + thisMonthValues.retInactive,
    outflow: thisMonthValues.hp + thisMonthValues.inactive
  }

  const formatPercent = d3.format(".1%")

  // month0 = oldest / four months ago
  // month3 = current reporting month
  if (monthsWithNoData.length > 0 || values.month3.ah === 0) {
    netChange = null;
    newDR = "N/A";
    prevMonthError = null;
    sentence = `${category}: Not enough data to calculate data reliability`
  } else {
    netChange = (values.month1.inflow + values.month2.inflow + values.month3.inflow) - 
                (values.month1.outflow + values.month2.outflow + values.month3.outflow);
    newDR = formatPercent((values.month3.ah - values.month0.ah - netChange) / values.month3.ah);
    prevMonthError = values.month3.ah - (values.month2.ah + values.month3.inflow - values.month3.outflow)
    if (prevMonthError <= 0) {
      sentence = `${category} has ${prevMonthError} fewer people reported as Actively Homeless than expected`
    } else {
      sentence = `${category} has ${prevMonthError} more people reported as Actively Homeless than expected`
    }
  }

  const output = {
    category: category,      
    newDR: newDR,
    netChange: netChange,
    prevMonthError: prevMonthError,
    sentence: sentence,
    reportingMonth: state.meta_reportingDate,
    monthsWithNoData: monthsWithNoData,
    population: pop,
    subpopulation: subpop,
    demographic: demo,
    values: values,
  }

  return output;
}



/* 
* AGGREGATE DATA
*/
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

  getRowsByStatus(data);
  state.output.ah = calculate(state, data, "ACTIVELY HOMELESS NUMBER");
  state.output.hp = calculate(state, data, "HOUSING PLACEMENTS");
  state.output.inactive = calculate(state, data, "MOVED TO INACTIVE NUMBER");
  state.output.newlyId = calculate(state, data, "NEWLY IDENTIFIED NUMBER");
  state.output.retHousing = calculate(state, data, "RETURNED TO ACTIVE LIST FROM HOUSING NUMBER");
  state.output.retInactive = calculate(state, data, "RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER");
  state.output.lot = calculate(state, data, "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT");
  
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

  // Calculate data reliability
  pops.all.map((pop) => {
    state.dr[pop] = getDataReliability(state, state.dr_import, pop);
  })

  if (state.debug === true) { 
    console.log("✨ CALCULATED DATA RELIABILITY ✨");
    console.log("  Data Reliability:", state.dr);
    console.log("  Overall State:", state);
    console.log(" ");
  }

  // Calculate by population
  state.backend_raw = {
    "ACTIVELY HOMELESS NUMBER": state.output.ah.map((value) => { return value.outputValue }),
    "HOUSING PLACEMENTS":  state.output.hp.map((value) => { return value.outputValue }),
    "MOVED TO INACTIVE NUMBER":  state.output.inactive.map((value) => { return value.outputValue }),
    "NEWLY IDENTIFIED NUMBER":  state.output.newlyId.map((value) => { return value.outputValue }),
    "RETURNED TO ACTIVE LIST FROM HOUSING NUMBER":  state.output.retHousing.map((value) => { return value.outputValue }),
    "RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER":  state.output.retInactive.map((value) => { return value.outputValue }),
    "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT":  state.output.lot.map((value) => { return value.outputValue }),
    "POTENTIAL 3-MONTH DATA RELIABILITY": pops.all.map((pop) => { return state.dr[pop].newDR })
  };
  
  if (state.debug === true) { 
    console.log("✨ CLICKED AGGREGATE BUTTON ✨");
    console.log("  Aggregated Output:", state.output);
    console.log("  Overall State:", state);
    console.log(" ");
  }

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


/* 
* PRINT DATA
*/

function addAggValue(popLookup, value, type) {
  if (type === 'result' && (value === null || value === 0 || value === "N/A" || value === "N/A%")) {
    d3.select(".agg-table")
      .append("div")
      .classed("agg-value", true)
      .classed(`${popLookup}`, true)
      .classed("hide", true)
      .html(`<b class='neutral' style='font-weight:400;'>${value}</b>`);
  } else if (type === 'result' && value != null && value != 0 && value != "N/A" || value != "N/A%") {
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


/* 
* DOWNLOAD & SUBMIT DATA
*/
function downloadData(data) {
  const headers = [...Object.keys(data)]
  const values = [...Object.values(data)]
  console.log(headers, values);
  state.data_csv = "data:text/csv;charset=utf-8," + headers.map((header, index) => {
    const output = header + "," + values[index] + "\n"
    console.log(output);
    return output;
  })

  const dateFormat = d3.timeFormat("%m-%d-%Y_%H%M")
  const formattedTimestamp = dateFormat(state.meta_timestamp)
  const fileName =  state.form_month + state.form_year.toString() + "_" + state.meta_community + "_" + formattedTimestamp.toString() + ".csv"
  const encodedUri = encodeURI(state.data_csv);
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

    fetch(state.scriptUrl, {
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
        console.error("Error submitting data to backend", error.message);
        submitForm.remove();
      });
  });

  submitForm.className = "hide";
  document.body.appendChild(submitForm);
  s.click();
}
