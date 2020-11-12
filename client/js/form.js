const d3 = require("d3");
const Papa = require("papaparse");
const XLSX = require("xlsx");
import {Utils} from './utils.js'
let util = new Utils();

class FormHandler {

  showMe(){
      console.log("I'm working!", "FormHandler")
  }

  checkStatus(state) {
      let formValues = [
          state.form_community_clean,
          state.form_reporting_date,
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

  setupFields(state, form) {
    d3.select("#community-dropdown").on("change", function () {
      form.checkStatus(state);
      state.form_community_clean = this.value;
      state.meta_community = state.form_community_clean.replace(
        /[^A-Z0-9]/gi,
        ""
      );
      state.meta_timestamp = util.getDate(Date.now(), "Timestamp", state);
    })
  
    // Reporting date input
    d3.select("#date-input").on("change", function () {
      state.form_reporting_date = this.value;
      const parsedDate = util.getDate(this.value, "MYFromForm", state)
      state.meta_reportingDate = util.getDate(this.value, "MYFromForm", state)
      state.meta_timestamp = util.getDate(Date.now(), "Timestamp", state);
      form.checkStatus(state);
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