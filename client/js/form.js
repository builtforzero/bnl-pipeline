const d3 = require("d3");
const Papa = require("papaparse");
const XLSX = require("xlsx");
import {Utils} from './utils.js';
import { headers, pops } from "../dict.js";
let util = new Utils();

class FormHandler {

  showMe(){
      console.log("I'm working!", "FormHandler")
  }

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
        state.comm_import = output;
        const nameList = util.getColByName(output, output.length, "Name").sort();
        nameList.unshift("Select a Community");
        if (output.length <= 0) {
          console.log('Pulling in headers object');
          state.comm_list = headers.communities;
        } else {
          state.comm_list = nameList;
        }
        this.getCommunityData(state, form)
      })
      .catch(error => {
        console.log('Pulling in hardcoded community list');
        console.error('Error in getting community list!', error.message)
        state.comm_list = headers.communities;
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
        state.dr_import = output;
        this.setupFields(state, state.comm_list, form)
      })
      .catch(error => {
        this.setupFields(state, state.comm_list, form)
        console.error('Error in getting community data!', error.message)
    });

  }

  getDataReliability(state, data, category) {
    console.log(state.form_community_clean);

    // Get range of months based on reporting month
    const currentMonth = util.parseDate(state.meta_reportingDate)
    const fourMonthsAgo = d3.timeMonth.offset(currentMonth, -3)
    const range = d3.timeMonth.range(fourMonthsAgo, currentMonth)
    range.push(currentMonth);
    const asMY = d3.timeFormat("%B %Y")
    const rangeClean = range.map(fullDate => { return asMY(fullDate) })
    console.log(range);

    let values = {}
    let netChange, newDR;
    const monthsWithNoData = []

    // Get pop, subpop, and demo
    const pop = pops.output[category].outputPop;
    const subpop = pops.output[category].outputSubpop;
    const demo = pops.output[category].outputDemo;

    rangeClean.map((month, index) => {
      // First filter data for criteria
      const filteredData = data.filter((d) => { 
        return d["Community"] === state.form_community_clean &&
        d["Population"] === pop &&
        d["Subpopulation"] === subpop &&
        d["Demographic"] === demo &&
        d["Month"] === month 
      })
      const thisMonth = `month${index}`;

      if (filteredData.length === 0) {
        monthsWithNoData.push(month);
        values[thisMonth] = {
          month: month,
          ah: 0,
          inflow: 0,
          outflow: 0
       }
      } else {
        values[thisMonth] = {
          month: month,
          ah: util.cleanNum(filteredData[0]["ACTIVELY HOMELESS NUMBER"]),
          inflow: util.cleanNum(filteredData[0]["NEWLY IDENTIFIED NUMBER"]) + 
                  util.cleanNum(filteredData[0]["RETURNED TO ACTIVE LIST FROM HOUSING NUMBER"]) + 
                  util.cleanNum(filteredData[0]["RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER"]),
          outflow: util.cleanNum(filteredData[0]["HOUSING PLACEMENTS"]) + 
                  util.cleanNum(filteredData[0]["MOVED TO INACTIVE NUMBER"])
       }
      }
    })



    const reportingThisMonth = {
      month: state.meta_reportingDate,
      ah: state.output.ah.filter((d) => { return d["subpop"] === category; }).outputValue,
      inflow: state.output.newlyId.filter((d) => { return d["subpop"] === category; }).outputValue + 
              state.output.retHousing.filter((d) => { return d["subpop"] === category; }).outputValue + 
              state.output.retInactive.filter((d) => { return d["subpop"] === category; }).outputValue,
      outflow: state.output.hp.filter((d) => { return d["subpop"] === category; }).outputValue + 
              state.output.inactive.filter((d) => { return d["subpop"] === category; }).outputValue
   }

    console.log(state.output.ah.filter((d) => { return d["subpop"] === category; }).outputValue);
    console.log(reportingThisMonth);

    if (monthsWithNoData.length > 0) {
      netChange = null;
      newDR = null;
    } else {
      netChange = (values.month0.inflow + values.month1.inflow + values.month2.inflow) - (values.month0.outflow + values.month1.outflow + values.month2.outflow);
      newDR = (values.month0.ah - values.month3.ah - netChange) / values.month0.ah
    }

    const output = {
      reportingMonth: state.meta_reportingDate,
      monthsWithNoData: monthsWithNoData,
      population: pop,
      subpopulation: subpop,
      demographic: demo,
      values: values,
      netChange: netChange,
      newDR: newDR
    }

    console.log(output);

  }
  

  checkStatus(state) {
    let formValues = [
        state.form_community_clean,
        state.form_month,
        state.form_year,
        state.form_name,
        state.form_email,
        state.form_org,
        state.form_file_upload
    ]

    let valButton = d3.select("#validateButton")
    let valMessage = d3.select(".validateBtn-msg")

    // First check whether required fields are on or off
    if (state.debug === false) {
      // If any form values are null or "", deactivate the Validate button
      if (formValues.some(util.valueIsNull)) {
        util.deactivate(valButton, false);
        valMessage.html("Please fill in all required fields to continue.");
      } else if (formValues.every(util.valueIsNotNull)) {
        util.activate(valButton, false);
        valMessage.text("");
      }
    } else if (state.debug === true) {
      // Flag that required fields are off for testing
      console.log(
        "%cRequired fields are currently OFF.",
        "background: white; color: red"
      );
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
    
    state.form_month = thisMonth;
    state.form_year = thisYear;
    state.meta_reportingDate = util.getMonthYear(`${thisYear}-${today.getMonth() + 1}`);
    
    d3.select("#community-dropdown")
      .selectAll("option")
      .data(communityList)
      .enter()
      .append("option")
      .attr("value", (d) => d)
      .text((d) => d);

    d3.select("#community-dropdown").on("change", function () {
      form.checkStatus(state);
      state.form_community_clean = this.value;
      state.meta_community = state.form_community_clean.replace(
        /[^A-Z0-9]/gi,
        ""
      );
      state.meta_timestamp = util.parseDate(Date.now());
    })

    
    // Set the visible months in the dropdown based on the year
    const currentMonthNums = Object.keys(monthMap).filter(monthNumber => {
      if (state.form_year === thisYear) {
        return monthNumber <= today.getMonth();
      } else {
        return monthNumber
      }
    })
    state.form_current_months = currentMonthNums.map(num => monthMap[num]);
  
    // Reporting date input
    d3.select("#month-dropdown")
      .selectAll("option")
      .data(state.form_current_months)
      .enter()
      .append("option")
      .attr("value", (d) => d)
      .text((d) => d)

    
      
    d3.select("#year-dropdown")
      .selectAll("option")
      .data(allYears)
      .enter()
      .append("option")
      .attr("value", (d) => d)
      .text((d) => d);
    
    // Set the current month and year as selected by default in the dropdown
    util.setDefaultOption(document.getElementById('month-dropdown'), state.form_month);
    util.setDefaultOption(document.getElementById('year-dropdown'), state.form_year.toString());

    // Event listeners
    d3.select("#month-dropdown").on("change", function () {
      state.form_month = this.value;
      const monthNum = parseInt(util.getKeyByValue(monthMap, this.value));
      state.meta_reportingDate = util.getMonthYear(`${state.form_year}-${monthNum + 1}`);
      state.meta_timestamp = util.parseDate(Date.now());
      form.checkStatus(state);
      if (state.debug === true) { console.log("NEW MONTH", state.meta_reportingDate); }
    })

    d3.select("#year-dropdown").on("change", function () {
      state.form_year = this.value;
      const monthNum = parseInt(util.getKeyByValue(monthMap, state.form_month));
      state.meta_reportingDate = util.getMonthYear(`${parseInt(this.value)}-${parseInt(monthNum) + 1}`);
      // Set the visible months in the dropdown based on the year
      state.form_current_months = null;
      const currentMonthNumsNew = Object.keys(monthMap).filter(monthNumber => {
        if (parseInt(state.form_year) === thisYear) {
          return monthNumber <= today.getMonth();
        } else {
          return monthNumber
        }
      })
      state.form_current_months = currentMonthNumsNew.map(num => monthMap[num]);
      d3.select("#month-dropdown")
        .selectAll("option")
        .remove()
      d3.select("#month-dropdown")
        .selectAll("option")
        .data(state.form_current_months)
        .enter()
        .append("option")
        .attr("value", (d) => d)
        .text((d) => d)
      state.meta_timestamp = util.parseDate(Date.now());
      form.checkStatus(state);
      if (state.debug === true) { console.log("NEW YEAR", state.meta_reportingDate); }
    })
  
    d3.select("#name-input").on("change", function () {
      state.form_name = this.value;
      form.checkStatus(state);
    }),
  
    d3.select("#org-input").on("change", function () {
      state.form_org = this.value;
      form.checkStatus(state);
    })
  
    d3.select("#email-input").on("change", function () {
      state.form_email = this.value;
      form.checkStatus(state);
    })
  
    // File Picker: call getFile() function
    d3.select("#filePicker").on("change", function() {
      state.form_file_upload = this.value;
      state.fileList = this.files;
      form.checkStatus(state);
      form.getFile(state, form);
    })
  }

  getFile(state, form) {
    const fileType = state.fileList[0].type;

    const csvFileType = "application/vnd.ms-excel";
    const xlsxFileType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    if (fileType === csvFileType) {
      state.fileFormat = "csv";
      Papa.parse(state.fileList[0], {
        dynamicTyping: true,
        header: true,
        complete: function (results) {
          if (state.debug === true) { console.log("CSV FILE PARSED", results); }
          state.data_raw = results.data;
          state.data_headers = results.meta.fields;
          state.data_length = results.data.length;
        },
      });
    } else if (fileType === xlsxFileType) {
      state.fileFormat = "xlsx";
      var reader = new FileReader();
      const e = state.form_file_upload;
      const f = state.fileList[0];
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
            state.data_raw = results.data;
            state.data_headers = results.meta.fields;
            state.data_length = results.data.length;
            console.log("Parsing XLSX", state.data_raw, state.data_headers);
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