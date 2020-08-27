class ValidatorEngine {

    constructor(state, dictionary, rules, input, metadata, customErrorMessages) {
        console.log("validation engine starting");
        require('dotenv').config();
        const d3 = require('d3')
        const AWS = require('aws-sdk');
        const Papa = require('papaparse');
        const Validator = require('validatorjs');
    }



    /* HELPER FUNCTIONS */

    // Return the single dictionary term that most closely resembles the search term
    fuzzyMatchTerm(searchTerm, dictionary) {
        const stringSimilarity = require('string-similarity');
        const a = stringSimilarity.findBestMatch(searchTerm, dictionary);

        // If the Dice's coefficient falls below threshold, return null
        if (a.bestMatch.rating <= 0.25) {
            return null
        } else {
            return a.bestMatch.target;
        }
    }

    // Takes a raw array and dictionary and returns a fuzzy-matched array
    fuzzyMatchArray(rawArray, dictionary) {
        const matchedArray = [];
        for (let i = 0; i < rawArray.length; i++) {
            const match = this.fuzzyMatchTerm(rawArray[i], dictionary);
            matchedArray.push(match);
        }
        return matchedArray;
    }

    // For every item in the array, change to lowercase and remove special characters. Returns newly cleaned array
    cleanArray(rawArray) {
        const cleanArr = [];
        for (let i = 0; i < rawArray.length; i++) {
            const cleanItem = rawArray[i].replace(/[^A-Z0-9]/ig, " ").toLowerCase()
            cleanArr.push(cleanItem)
        }
        return cleanArr;
    }

    // Takes arrays and returns an array with subpopulation
    getSubpop(householdType, chronicArray, veteranArray) {
        const subpopArray = [];
        for (let i = 0; i < householdType.length; i++) {
            if (householdType[i] === "single adult" && chronicArray[i] === "chronic" && veteranArray[i] === "no") {
                let s = "chronic";
                subpopArray.push(s);
            }
        }
        return subpopArray;
    }

    // Validates a data source against a set of rules, and then returns pass / fail
    validateData(state, dictionary, data, rules) {
        console.log("validateData function")
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