const d3 = require("d3");
import { pops } from "../dict.js";

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
    if (state._dev.debug) {
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
    
    d3.selectAll(".validation-symbol").text("N/A").classed("neutral", true);
    state.test._names.map((testName) => {
      d3.selectAll(`.${testName}-header`)
        .style("background-color", "white")
        .on("mouseover", (d) => {
          d3.selectAll(`.${testName}-header`).style("background-color", "var(--color-bg-gray)")
        })
        .on("mouseout", (d) => {
          d3.selectAll(`.${testName}-header`).style("background-color", "white")
        })
      d3.select(`.${testName}-error`).html("");
    })

    // Reset Population Change Step
    this.deactivate(d3.select("#popCriteriaButton"), false);
    pops.all.map((pop) => {
      this.clearFileInput(`popChange-${pop.replace(" ", "").toLowerCase()}`)
    })

    // Reset Submission Step
    d3.select(".reupload-submit").classed("hide", true);
    d3.select(".download-btn").classed("hide", true);
    this.deactivate(d3.select("#submitButton"), false);
    d3.select(".button-group-title").classed("hide", true);
    d3.select(".button-group-subtitle").classed("hide", true);
    d3.select(".button-group-instructions").classed("hide", true);
    d3.select(".reporting-month").classed("hide", true);
    d3.select(".reporting-community").classed("hide", true);
    d3.select(".submit-instructions").classed("hide", true);
    d3.select(".review-msg").classed("hide", true);
    d3.select(".submit-progress-msg").classed("hide", true);
    d3.select(".submit-progress-bar").classed("hide", true);
    d3.selectAll(".agg-value").remove();
    d3.selectAll(".agg-value-calc").remove();
    d3.selectAll(".filter-btn").remove();
    

    // Reset Data, except form data
    state.form.file_upload = "";
    state.form.fileList = null;
    state.form.fileFormat = null;
    state.backend = {
      output: []
    }
    state.data = {
      raw: null,
      clean: null,
      headers: null,
      csv: null,
    }
    state.output = {};
    state.popChange = {};
    state.rows = {
      active: {},
      all: {},
      filtered: {}
    }
    // Reset Data
    state.test = {
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

  equalMY(dateValue, reportingDate) {
    if (dateValue === null || reportingDate === null) {
      return null
    } else {
      const formatValue = d3.timeFormat("%B %Y")
      const dateMY = formatValue(dateValue)
      const reportingMY = formatValue(reportingDate)
      if (dateMY === reportingMY) {
        return true;
      } else return false; 
    }
  }

  getAverageOfArray(arr) {
    const average = arr.reduce(function (sum, value) {
        return sum + value;
    }, 0) / arr.length;
    return average
  }

  getColByName(arr, columnName) {
    if (arr === undefined) {
      return []
    } else if (arr.length === 0) {
      return []
    } else {
      const len = arr.length
      const col = [];
      for (let row = 0; row < len; row++) {
        const value = Object.values(arr)[row][columnName];
        col.push(value);
      }
      return col;
    }
  }

  // Permanently renames field in data object
  renameCol(data, oldKey, newKey) {
    data.forEach(e => {
      delete Object.assign(e, {[newKey]: e[oldKey] })[oldKey];
    })
    console.log(" ");
    console.log("RENAMED HEADER", oldKey, "➡️", newKey);
    console.log(" ");
  }

  // Recursive function that walks through each key in an object and removes null values
  // Works on nested objects
  removeEmptyOrNull(obj) {
    Object.keys(obj).forEach(k =>
      (obj[k] && typeof obj[k] === 'object') && this.removeEmptyOrNull(obj[k]) ||
      (!obj[k] && obj[k] !== undefined) && delete obj[k]
    );
    return obj;
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
