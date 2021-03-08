const d3 = require("d3");
const Papa = require("papaparse");
const XLSX = require("xlsx");

class Utils {
  showMe() {
    console.log("I'm working!", "HelperScripts");
  }

  // Set the selected option for a dropdown object
  setDefaultOption(selectObj, value) {
    const options = Array.from(selectObj.options);
    options.map((option) => {
      if (option.value === value) {
        option.selected = true;
        return;
      }
    })
  }

  // Clears file picker without reloading the whole page
  clearFileInput(filePickerId) {
    const ctrl = document.getElementById(filePickerId);
    // If value of file picker is null, do nothing
    try {
      ctrl.value = null;
    } catch (ex) {}
    // If there is a value, replace the file picker with a clone of itself
    if (ctrl.value) {
      ctrl.parentNode.replaceChild(ctrl.cloneNode(true), ctrl);
    }
  }

  clean(value) {
    if (value === null) {
      return null
    } else {
      const cleanedValue = value
        .toString()
        .replace(/[^A-Z0-9]/gi, "")
        .toLowerCase()
        .trim();
      return cleanedValue;
    }
  }

  cleanNum(value) {
    if (value === "" || value === null) {
      return 0;
    } else {
      const cleanedValue = parseInt(value)
      return cleanedValue;
    }
  }

  resetData(state) {
    // Reset Validation Step
    d3.select(".reupload-aggregate").classed("hide", true);
    d3.select(".new-upload-submit").classed("hide", true);
    this.deactivate(d3.select("#aggregateButton"), false);
    d3.selectAll(".validation-name")
      .style("background-color", "white")
      .on("mouseover", function () {
        d3.select(this).style("background-color", "rgb(233, 232, 232)");
      })
      .on("mouseout", function () {
        d3.select(this).style("background-color", "white");
      });
    d3.selectAll(".validation-symbol").text("N/A").classed("neutral", true);
    d3.selectAll(".header-error, .pii-error, .ssn-error, .datatype-error").html("");

    // Reset Submission Step
    d3.select(".reupload-submit").classed("hide", true);
    this.deactivate(d3.select("#submitButton"), false);
    d3.select(".button-group-title").text("");
    d3.select(".reporting-month").text("");
    d3.select(".reporting-community").text("");
    d3.select(".submit-instructions").classed("hide", true);
    d3.select(".review-msg").classed("hide", true);
    d3.select(".progress-msg").text("");
    d3.select(".progress-bar").text("");
    d3.selectAll(".agg-header").remove();
    d3.selectAll(".agg-value").remove();
    d3.selectAll(".filter-btn").remove();

    // Reset Data
    state.fileList = null;
    state.fileFormat = null;
    state.data_raw = null;
    state.data_clean = null;
    state.data_headers = null;
    state.data_length = null;
    state.data_csv = null;
    state.data_form = null;
    state.form_file_upload = "";
    state.backend_raw = null;
    state.backend_output = [];
    state.output.ah = null;
    state.output.hp = null;
    state.output.inactive = null;
    state.output.newlyId = null;
    state.output.retHousing = null;
    state.output.retInactive = null;
    state.output.lot = null;
  }

  getRangeArr(start, stop, step) {
    return Array.from({ length: (stop - start) / step + 1 }, (value, index) => start + (index * step));
  }

  getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key] === value);
  }

  // Takes any date value and returns a full timestamp.
  // If value is in a Month Year format, returns last day of month.
  // A date value may pass multiple tests; this function keeps the
  // FIRST value that passes
  parseDate(dateValue) {
    const dateTests = [
      d3.timeParse("%m/%d/%Y"), // 4/1/20
      d3.timeParse("%-m/%-d/%Y"), // Month-Day-Year without leading zeros
      d3.timeParse("%B %d, %Y"), // Month Day, Year
      d3.timeParse("%B %d %Y"), // Month Day Year
      d3.timeParse("%B %Y"), // Month Year
      d3.timeParse("%Y-%m"), // Year short month
      d3.timeParse("%Y-%m-%d"), // Year-day-month
      d3.timeParse("%Y-%m-%d %X"), // Timestamp
      d3.timeParse("%Q"), // Milliseconds
      d3.timeParse() // full time
    ]
    const monthYearTest = d3.timeParse("%B %Y");

    if (dateValue === undefined || dateValue === null || dateValue === "") {
      return null;
    } else {
      const result = dateTests.map(test => { return test(dateValue) }).filter((d) => d != null)
      if (result.length === 0) {
        //console.log(dateValue, ">>> NOT A DATE");
        return null;
      } else {
        const dateParsed = result[0] // Gets first positive test result
        if (monthYearTest(dateValue) != null) {
          const reportingMY = new Date(dateParsed.getFullYear(), dateParsed.getMonth()+1, 0);
          //console.log("REPORTING MONTH:", dateValue, ">>>", reportingMY);
          return reportingMY;
        } else {
          //console.log("PARSED:", dateValue,">>>", dateParsed);
          return dateParsed;
        }
      }
    }
  }

  getMonthYear(dateValue) {
    const parsed = this.parseDate(dateValue)
    const formatValue = d3.timeFormat("%B %Y")
    if (dateValue === null || dateValue === undefined || dateValue === "") {
      //console.log("NO VALUE", dateValue, parsed, formatValue(parsed));
      return null;
    } else {
      //console.log("FORMATTED", dateValue, parsed, formatValue(parsed));
      return formatValue(parsed);
    }
  }

  getColByName(arr, length, columnName) {
    const col = [];
    for (let row = 0; row < length; row++) {
      const value = Object.values(arr)[row][columnName];
      col.push(value);
    }
    return col;
  }

  validate(value, dataType) {
    if (value === null) {
      return null;
    } else if (dataType === "date") {
      const dateRegex = /(0?[1-9]|1[012])\/(0?[1-9]|[12][0-9]|3[01])\/\d{2,4}/;
      return dateRegex.test(value.toString());
    } else if (dataType === "num") {
      return Number.isInteger(value);
    } else if (dataType === "alphanum") {
      const alphanumRegex = /([^A-Z0-9])/gi;
      return !alphanumRegex.test(value.toString());
    } else if (dataType === "any") {
      return true;
    } else return null;
  }

  valueIsNull = (element) => {
    return element === null || element === "";
  };

  valueIsNotNull = (element) => {
    return element != null && element != "";
  };

  valueIsFalse = (element) => {
    return element === false;
  };

  valueIsTrue = (element) => {
    return element === true;
  };

  // Activate a DOM element
  // Flag for whether the element is meant to be hidden / unhidden as well
  activate(domEl, hidden) {
    if (hidden === true) {
      domEl.classed("inactive", false);
      domEl.classed("active", true);
      domEl.attr("disabled", null);
      domEl.classed("hide", false);
    } else {
      domEl.classed("inactive", false);
      domEl.classed("active", true);
      domEl.attr("disabled", null);
    }
  }

  // Deactivate a DOM element
  // Flag for whether the element is meant to be hidden / unhidden as well
  deactivate(domEl, hidden) {
    if (hidden === true) {
      domEl.classed("inactive", true);
      domEl.classed("active", false);
      domEl.attr("disabled", true);
      domEl.classed("hide", true);
    } else {
      domEl.classed("inactive", true);
      domEl.classed("active", false);
      domEl.attr("disabled", true);
    }
  }
}

export { Utils };
