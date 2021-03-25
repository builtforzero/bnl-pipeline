const d3 = require("d3");
const Papa = require("papaparse");
const XLSX = require("xlsx");

class Utils {

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
    if (value === "" || value === null || value === undefined) {
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
    if (value === "" || value === null || parseInt(value) === NaN || value === undefined) {
      return 0;
    } else {
      const cleanedValue = parseInt(value)
      return cleanedValue;
    }
  }

  resetData(state) {
    if (state.debug) {
      console.log("DATA RESET")
      // Flag that required fields are off for testing
      console.log(
        "%cRequired fields are currently OFF.",
        "background: white; color: red"
      );
    }

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
    d3.select(".download-btn").classed("hide", true);
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
      d3.timeParse("%m/%d/%Y"), // mm/dd/yyyy
      d3.timeParse("%m/%d/%y"), // mm/dd/yy
      d3.timeParse("%A, %B %D, %Y"), // Friday, May 01, 2021
      d3.timeParse("%A, %B %d, %Y"), // Friday, May 01, 2021
      d3.timeParse("%A %B %d, %Y"), // Friday May 01, 2021
      d3.timeParse("%-m/%-d/%Y"), // Without leading zeros
      d3.timeParse("%B %d, %Y"), // Month Day, Year
      d3.timeParse("%B %d %Y"), // Month Day Year
      d3.timeParse("%B %Y"), // Month Year
      d3.timeParse("%Y-%m"), // Year short month
      d3.timeParse("%Y-%m-%d"), // Year-day-month
      d3.timeParse("%Y-%m-%d %X"), // Timestamp with dashes
      d3.timeParse("%-m/%-d/%Y %X"), // Timestamp no leading zeros
      d3.timeParse("%Q"), // Milliseconds
    ]
    
    if (dateValue === undefined || dateValue === null || dateValue === "" || dateValue.toString().length < 6) {
      return null;
    } else {
      // Run the date value through each of the tests
      // Filter out the nulls and obviously wrong dates (too old or in the future)
      const result = dateTests.map(test => { return test(dateValue) }).filter((d) => {
        return d != null &&
        d.getFullYear() > "1970" &&
        d.getFullYear() <= new Date().getFullYear()
      })
      if (result.length === 0) {
        return null;
      } else {
        // Get the first valid test result
        const dateParsed = result[0]
        // If the date is in a Month Year format, return the last day of the month
        const monthYearTest = d3.timeParse("%B %Y");
        if (monthYearTest(dateValue) != null) {
          const lastDayOfMonth = new Date(dateParsed.getFullYear(), dateParsed.getMonth()+1, 0);
          return lastDayOfMonth;
        } else {
          return dateParsed;
        }
      }
    }
  }

  getMonthYear(dateValue) {
    const parsed = this.parseDate(dateValue)
    const formatValue = d3.timeFormat("%B %Y")
    if (dateValue === null || dateValue === undefined || dateValue === "") {
      return null;
    } else {
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
      let result;
      if(this.parseDate(value) === null) {
        result = false;
      } else {
        result = true;
      }
      return result;
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
