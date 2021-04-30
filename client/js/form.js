const d3 = require("d3");
const Papa = require("papaparse");
const XLSX = require("xlsx");
import {Utils} from './utils.js';
import { headers, pops } from "../dict.js";
let util = new Utils();

class FormHandler {

  getCommunityList(state, form) {
    const spreadsheetId = process.env.SPREADSHEET_ID
    const range = 'Community List'
    const apiKey = process.env.API_KEY
    const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId + '/values/' + range + '?key=' + apiKey;

    fetch(url)
      .then(function(response) {
        return response.json();
      })
      .then((data) => {
        const labels = data.values[0]
        const output = data.values.slice(1).map(item => item.reduce((obj, val, index) => {
          obj[labels[index]] = val
          return obj
        }, {}))
        state._import.comm_data = output;
        const nameList = util.getColByName(output, "Name").sort();
        nameList.unshift("Select a Community");
        if (output.length <= 0) {
          console.log('Pulling in hardcoded community list');
          state._import.comm_list = headers.communities;
        } else {
          state._import.comm_list = nameList;
        }
        this.getCommunityData(state, form)
      })
      .catch(error => {
        console.log('Pulling in hardcoded community list');
        console.error('Error in getting community list!', error.message)
        state._import.comm_list = headers.communities;
        this.getCommunityData(state, form);
    });
  }s

  getCommunityData(state, form) {
    const spreadsheetId = process.env.SPREADSHEET_ID
    const range = 'DataFiltered'
    const apiKey = process.env.API_KEY
    const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId + '/values/' + range + '?key=' + apiKey;

    fetch(url)
      .then(function(response) {
        return response.json();
      })
      .then((data) => {
        const labels = data.values[0]
        const output = data.values.slice(1).map(item => item.reduce((obj, val, index) => {
          obj[labels[index]] = val
          return obj
        }, {}))
        state._import.dr_data = output;
        if (state._dev.debug) {
          console.log("✨ COMMUNITY DATA IMPORTED ✨");
          console.log("  Community List:", state._import.comm_list.length-1, "communities");
          console.log("  Community Data:", state._import.dr_data.length, "rows");
          console.log("  Overall State:", state);
          console.log(" ");
        }
        this.setupFields(state, state._import.comm_list, form)
      })
      .catch(error => {
        this.setupFields(state, state._import.comm_list, form)
        console.error('Error in getting community data!', error.message)
    });

  }


  checkStatus(state) {
    let formValues = [
        state.form.community_clean,
        state.form.month,
        state.form.year,
        state.form.name,
        state.form.email,
        state.form.org,
        state.form.file_upload
    ]

    let valButton = d3.select("#validateButton")
    let valMessage = d3.select(".validateBtn-msg")

    // First check whether required fields are on or off
    if (state._dev.debug === false) {
      // If any form values are null or "", deactivate the Validate button
      if (formValues.some(util.valueIsNull)) {
        util.deactivate(valButton, false);
        valMessage.html("Please fill in all required fields to continue.");
      } else if (formValues.every(util.valueIsNotNull)) {
        util.activate(valButton, false);
        valMessage.text("");
      }
    } else if (state._dev.debug === true) {
      // Activate the Validate button
      util.activate(valButton, false);
      valMessage.text("");
    }
  }
  
  setupFields(state, communityList, form) {

    const monthMap = {
      0: "January",
      1: "February",
      2: "March",
      3: "April",
      4: "May",
      5: "June",
      6: "July",
      7: "August",
      8: "September",
      9: "October",
      10: "November",
      11: "December"
    }

    const today = new Date();
    const thisMonth = monthMap[today.getMonth()];
    const thisYear = parseInt(today.getFullYear());
    const allYears = util.getRangeArr(2017, thisYear, 1).reverse();
    
    state.form.month = thisMonth;
    state.form.year = thisYear;
    state.meta.reportingDate = util.getMonthYear(`${thisYear}-${today.getMonth() + 1}`);
    
    d3.select("#community-dropdown")
      .selectAll("option")
      .data(state._import.comm_list)
      .enter()
      .append("option")
      .attr("value", (d) => d)
      .text((d) => d);
      

    d3.select("#community-dropdown").on("change", function () {
      form.checkStatus(state);
      state.form.community_clean = this.value;
      state.meta.community = state.form.community_clean.replace(
        /[^A-Z0-9]/gi,
        ""
      );
      state.meta.timestamp = util.parseDate(Date.now());
      if (state._dev.debug === true) { 
        console.log("  NEW COMMUNITY ➡️", state.form.community_clean); 
      }
    })

    
    // Set the visible months in the dropdown based on the year
    const currentMonthNums = Object.keys(monthMap).filter(monthNumber => {
      if (state.form.year === thisYear) {
        return monthNumber <= today.getMonth();
      } else {
        return monthNumber
      }
    })
    state.form.current_months = currentMonthNums.map(num => monthMap[num]);
  
    // Reporting date input
    d3.select("#month-dropdown")
      .selectAll("option")
      .data(state.form.current_months)
      .enter()
      .append("option")
      .classed("dropdown-option", true)
      .attr("value", (d) => d)
      .text((d) => d)

    d3.select("#year-dropdown")
      .selectAll("option")
      .data(allYears)
      .enter()
      .append("option")
      .classed("dropdown-option", true)
      .attr("value", (d) => d)
      .text((d) => d);
    
    // Set the current month and year as selected by default in the dropdown
    util.setDefaultOption(document.getElementById('month-dropdown'), state.form.month);
    util.setDefaultOption(document.getElementById('year-dropdown'), state.form.year.toString());

    // Event listeners
    d3.select("#month-dropdown").on("change", function () {
      state.form.month = this.value;
      const monthNum = parseInt(util.getKeyByValue(monthMap, this.value));
      state.meta.reportingDate = util.getMonthYear(`${state.form.year}-${monthNum + 1}`);
      state.meta.timestamp = util.parseDate(Date.now());
      form.checkStatus(state);
      if (state._dev.debug === true) { 
        console.log("  NEW MONTH ➡️", state.meta.reportingDate);
      }
    })

    d3.select("#year-dropdown").on("change", function () {
      state.form.year = this.value;

      // Set the visible months in the dropdown based on the year
      state.form.current_months = null;
      const currentMonthNumsNew = Object.keys(monthMap).filter(monthNumber => {
        if (parseInt(state.form.year) === thisYear) {
          return monthNumber <= today.getMonth();
        } else {
          return monthNumber
        }
      })
      state.form.current_months = currentMonthNumsNew.map(num => monthMap[num]);

      // Repopulate the month dropdown with the current months
      d3.select("#month-dropdown")
        .selectAll("option")
        .remove()
      d3.select("#month-dropdown")
        .selectAll("option")
        .data(state.form.current_months)
        .enter()
        .append("option")
        .attr("value", (d) => d)
        .text((d) => d)

      // If the list of currently available months does NOT include the chosen month, then default to January
      // Set the month dropdown to the value and update the reporting date
      if (state.form.current_months.includes(state.form.month)) {
        util.setDefaultOption(document.getElementById('month-dropdown'), state.form.month);
        const monthNum = parseInt(util.getKeyByValue(monthMap, state.form.month));
        state.meta.reportingDate = util.getMonthYear(`${parseInt(this.value)}-${parseInt(monthNum) + 1}`);
      } else {
        state.form.month = "January"
        util.setDefaultOption(document.getElementById('month-dropdown'), state.form.month);
        const monthNum = parseInt(util.getKeyByValue(monthMap, state.form.month));
        state.meta.reportingDate = util.getMonthYear(`${parseInt(this.value)}-${parseInt(monthNum) + 1}`);
      }

      state.meta.timestamp = util.parseDate(Date.now());
      form.checkStatus(state);
      if (state._dev.debug === true) { 
        console.log("  NEW YEAR ➡️", state.meta.reportingDate); 
      }
    })
  
    d3.select("#name-input").on("change", function () {
      state.form.name = this.value;
      form.checkStatus(state);
      if (state._dev.debug === true) { 
        console.log("  NEW NAME ➡️", state.form.name); 
      }
    }),
  
    d3.select("#org-input").on("change", function () {
      state.form.org = this.value;
      form.checkStatus(state);
      if (state._dev.debug === true) { 
        console.log("  NEW ORGANIZATION ➡️", state.form.org); 
      }
    })
  
    d3.select("#email-input").on("change", function () {
      state.form.email = this.value;
      form.checkStatus(state);
      if (state._dev.debug === true) { 
        console.log("  NEW EMAIL ➡️", state.form.email); 
      }
    })
  
    // File Picker: call getFile() function
    d3.select("#filePicker").on("change", function() {
      state.form.file_upload = this.value;
      state.form.fileList = this.files;
      form.checkStatus(state);
      form.getFile(state, form);
      if (state._dev.debug === true) { 
        console.log("  NEW FILE ➡️", state.form.file_upload); 
      }
    })
  }

  getFile(state, form) {
    const fileType = state.form.fileList[0].type;

    const csvFileType = "application/vnd.ms-excel";
    const xlsxFileType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    if (fileType === csvFileType) {
      state.form.fileFormat = "csv";
      Papa.parse(state.form.fileList[0], {
        dynamicTyping: true,
        header: true,
        skipEmptyLines: 'greedy',
        complete: function (results) {
          if (state._dev.debug) {
            console.log(" ");
            console.log("✨ CSV FILE PARSED ✨");
            console.log("  Headers Parsed:", results.meta.fields.length);
            console.log("  Rows Parsed:", results.data.length);
            console.log("  All Results:", results);
            console.log("  Overall State:", state);
            console.log("  Raw Data:", util.removeEmptyOrNull(results.data));
            console.log(" ");
          }
          state.data.raw = util.removeEmptyOrNull(results.data);
          state.data.headers = results.meta.fields;
        },
      });
    } else if (fileType === xlsxFileType) {
      state.fileFormat = "xlsx";
      var reader = new FileReader();
      const e = state.form.file_upload;
      const f = state.form.fileList[0];
      // Use XLSX package to convert workbook to CSV file, then parse with PapaParse
      reader.onload = function (e) {
        var data = new Uint8Array(e.target.result);
        var workbook = XLSX.read(data, { type: "array" });
        var sheetNameList = workbook.SheetNames;
        var csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetNameList[0]]);
        
        Papa.parse(csv, {
          dynamicTyping: true,
          header: true,
          complete: function (results) {
            state.data.raw = results.data;
            state.data.headers = results.meta.fields;
            state.data.length = results.data.length;
            if (state._dev.debug) {
              console.log(" ");
              console.log("✨ XLSX FILE PARSED ✨");
              console.log("  Headers Parsed:", results.meta.fields.length);
              console.log("  All Results:", results);
              console.log("  Overall State:", state);
              console.log(" ");
            }
          },
        });
      };
      reader.readAsArrayBuffer(f);
    }
  }
}



export {
    FormHandler
};