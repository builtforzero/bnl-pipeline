const d3 = require("d3");
const Papa = require("papaparse");
const XLSX = require("xlsx");

class Utils {
  showMe() {
    console.log("I'm working!", "HelperScripts");
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

  // Choices: "as timestamp", "as month year", "from full year", "from year month", "from short year"
  formatDate(dateValue, method1, method2, method3) {
    const dateMap = {
      "as timestamp": d3.timeFormat("%Y-%m-%d %X"),
      "as MY": d3.timeFormat("%B %Y"), // September 2020
      "as long year": d3.timeFormat("%m/%d/%Y"),
      "from long year": d3.timeParse("%m/%d/%Y"),
      "from short year": d3.timeParse("%-m/%-d/%Y"), // no leading zeros
      "from year month": d3.timeParse("%Y-%m"),
      "from year day month": d3.timeParse("%Y-%m-%d"),
      "from ms": d3.timeParse("%Q"), // Q is from UNIX epoch
      "from MY": d3.timeParse("%B %Y"),
    };

    if (method2 === undefined && method3 === undefined) {
      const firstMethod = dateMap[method1];
      const firstParse = new Date(firstMethod(dateValue));
      return firstParse;
    } else if (method2 != undefined && method3 === undefined) {
      const firstMethod = dateMap[method1];
      const secondMethod = dateMap[method2];
      const firstParse = new Date(firstMethod(dateValue));
      const secondParse = secondMethod(firstParse);
      return secondParse;
    } else if (method2 != undefined && method3 != undefined) {
      const firstMethod = dateMap[method1];
      const secondMethod = dateMap[method2];
      const thirdMethod = dateMap[method3];
      const firstParse = firstMethod(dateValue);
      const secondParse = secondMethod(firstParse);
      const thirdParse = thirdMethod(secondParse);
      return thirdParse;
    }
  }

  getDate(dateValue, format, state) {
    if (dateValue === null) {
      return null;
    } else {
      if (format === "MYFromForm") {
        return this.formatDate(dateValue, "from year month", "as MY");
      } else if (format === "MY") {
        const formatted = this.monthYear(dateValue, state);
        return formatted;
      } else if (format === "MDY") {
        const formatted = this.standardDate(dateValue, state);
        return formatted;
      } else if (format === "Timestamp") {
        return this.formatDate(dateValue, "as timestamp");
      }
    }
  }

  monthYear(dateValue, state) {
    if (state.fileFormat === "xlsx") {
      const formatted = this.formatDate(dateValue, "from short year", "as MY");
      return formatted;
    } else {
      return this.formatDate(dateValue, "from long year", "as MY");
    }
  }

  standardDate(dateValue, state) {
    if (state.fileFormat === "xlsx") {
      const formatted = this.formatDate(dateValue, "from short year");
      return formatted;
    } else {
      const formatted = this.formatDate(dateValue, "from long year");
      return formatted;
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
