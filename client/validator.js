class ValidatorEngine {

    constructor(state, dictionary, rules, input, metadata, customErrorMessages) {

    }



    /* HELPER FUNCTIONS */

    // Return the single dictionary term that most closely resembles the search term
    fuzzyMatchTerm(searchTerm, dictionary) {
        const stringSimilarity = require('string-similarity');
        const a = stringSimilarity.findBestMatch(searchTerm, dictionary);

        // If the Dice's coefficient falls below threshold, return null
        if (a.bestMatch.rating <= 0.25) {
            return "No Match"
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


    // Validates a data source against a set of rules, and then returns pass / fail
    validateData(data, rules, customErrorMessages) {
        const Validator = require('validatorjs');
        console.log("validateData function")
        let validation = new Validator(data, rules, customErrorMessages)
        console.log("Passed validation?", validation.passes())
        return Object.values(validation.errors.errors)
    }

    // Updates an object's keys
    updateKeys(oldArr, newArr) {
        for (let i = 0; i < oldArr.length; i++) {
            newArr[i] = oldArr[i];
            console.log(`Matched ${oldArr[i]} with ${newArr[i]}`)
        }
    }



    /* VALIDATION FUNCTIONS */

    // Checks that the data file contains the right headers
    checkHeaders(state, metadata, dictionary) {
        let matchedHeaders = this.fuzzyMatchArray(metadata.headers, dictionary.headers)
        let originalHeaders = Object.keys(state.raw[0])
        this.updateKeys(originalHeaders, matchedHeaders)
        console.log("Old keys", Object.keys(state.raw[0]))
        console.log("New keys", matchedHeaders)
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



}

export {
    ValidatorEngine
};