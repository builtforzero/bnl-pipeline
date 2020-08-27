class ValidatorEngine {

    constructor(state, dictionary, rules, input, meta, customErrorMessages) {
        console.log("validation engine starting");
        require('dotenv').config();
        const d3 = require('d3')
        const AWS = require('aws-sdk');
        const Papa = require('papaparse');
        const Validator = require('validatorjs');
        const levenary = require('levenary');
    }



    /* HELPER FUNCTIONS */

    // Return the single dictionary term that most closely resembles the search term.
    fuzzyMatch(state, dictionary, searchTerm) {
        console.log("fuzzyMatch function")
    }

    // Takes an array of values, loops through each value to get the fuzzy-matched equivalent, and appends to the original dataset.
    fuzzyMatchColumn(state, dictionary, arr, fieldName) {
        console.log("fuzzyMatchColumn function")
    }

    // Validates a data source JSON structure against a set of rules, and then returns pass / fail
    validateData(state, dictionary, data, rules) {
        console.log("validateData function")
    }

    // For every item in the array, change to lowercase and remove special characters. Returns the newly cleaned array.
    cleanArray(state, dictionary, arr) {
        console.log("cleanArray function")
    }

    // Prints the error message at the error location
    throwError(state, dictionary, errorMessage, errorLocation) {
        console.log("throwError function")
    }

    // Prints the success message at the success location
    throwSuccess(state, dictionary, successMessage, successLocation) {
        console.log("throwSuccess function")
    }



    /* VALIDATION FUNCTIONS */

    // Checks that the data file contains the right headers
    checkHeaders(state, data, dictionary, rules) {
        console.log("Checking headers")
    }

    // Checks that required columns are 100% filled in
    checkRequired(state) {
        console.log("Checking required columns are filled in")
    }

    // Checks that each column contains the right data type
    checkDataType(state) {
        console.log("Checking data types")
    }

    // Generates a fuzzy-matched version of each picklist column
    fuzzyMatchPicklists(state) {
        console.log("Fuzzy-matching picklist columns")
    }

    // Calculates subpopulation from fuzzy-matched chronic and veteran status
    getSubpop(state) {
        console.log("Calculating subpop field")
    }




}

export {
    ValidatorEngine
};