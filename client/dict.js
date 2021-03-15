const d3 = require("d3");

const headers = {
  // Backup in case community name import fails
  communities: [
    "Norman/Cleveland County CoC",
    "Arlington County CoC",
    "Bakersfield/Kern County CoC",
    "Watsonville/Santa Cruz City & County CoC",
    "Richmond/Henrico, Chesterfield, Hanover Counties CoC",
    "Jacksonville-Duval, Clay Counties CoC",
    "Rockford/Winnebago, Boone Counties CoC"
  ],
  required: [
    'Client ID',
    'Date of Identification',
    'Housing Move-In Date',
    'Inactive Date',
    'Returned to Active Date',
    'Household Type',
    'Chronic Status',
    'Veteran Status',
  ],
  recommended: [
    'BNL Status',
    'Homeless Start Date',
    'Race',
    'Ethnicity',
    'Gender',
    'Age',
  ],
  meta: {
    "Date of Identification": {
      altNames: [],
      datatype: "date",
      error: `must be a single date in a valid format <b style='color:black'>e.g. "3/1/2021" or "March 1, 2021</b> and cannot be in the <b style='color:black'>future</b>.`,
    }, 
    "Homeless Start Date": {
      altNames: [],
      datatype: "date",
      error: `must be a single date in a valid format <b style='color:black'>e.g. "3/1/2021" or "March 1, 2021</b> and cannot be in the <b style='color:black'>future</b>.`,
    },  
    "Housing Move-In Date": {
      altNames: [],
      datatype: "date",
      error: `must be a single date in a valid format <b style='color:black'>e.g. "3/1/2021" or "March 1, 2021</b> and cannot be in the <b style='color:black'>future</b>.`,
    },  
    "Inactive Date": {
      altNames: [],
      datatype: "date",
      error: `must be a single date in a valid format <b style='color:black'>e.g. "3/1/2021" or "March 1, 2021</b> and cannot be in the <b style='color:black'>future</b>.`,
    }, 
    "Returned to Active Date": {
      altNames: [],
      datatype: "date",
      error: `must be a single date in a valid format <b style='color:black'>e.g. "3/1/2021" or "March 1, 2021</b> and cannot be in the <b style='color:black'>future</b>.`,
    },  
    "Age": {
      altNames: [],
      datatype: "num",
      error: `must only contain <b style='color:black'>whole numbers</b>. e.g. "3"`,
    }, 
    "Client ID": {
      altNames: [],
      datatype: "num",
      error: `must only contain <b style='color:black'>whole numbers</b>. e.g. "3"`,
    },  
    "Household Type": {
      altNames: [],
      datatype: "any",
      error: `can accept any data type.`,
    },  
    "Household Size": {
      altNames: [],
      datatype: "num",
      error: `must only contain <b style='color:black'>whole numbers</b>. e.g. "3"`,
    },  
    "Chronic Status": {
      altNames: [],
      datatype: "any",
      error: `can accept any data type.`,
    },  
    "Veteran Status": {
      altNames: [],
      datatype: "any",
      error: `can accept any data type.`,
    },  
    "Ethnicity": {
      altNames: [],
      datatype: "any",
      error: `can accept any data type.`,
    },  
    "Race": {
      altNames: [],
      datatype: "any",
      error: `can accept any data type.`,
    },  
    "Gender": {
      altNames: [],
      datatype: "any",
      error: `can accept any data type.`,
    }, 
  },
  banned: [
    "Social Security Number", 
    "SSN", 
    "Last 4", 
    "First Name", 
    "Last Name", 
    "Name", 
    "Birthday", 
    "Date of Birth", 
    "DOB"
  ],
  backend: [
    "Timestamp",
    "Community",
    "Month",
    "Name",
    "Email Address",
    "Organization",
    // All
    "[All] Population",
    "[All] Subpopulation",
    "[All] Demographic",
    "[All] ACTIVELY HOMELESS NUMBER",
    "[All] HOUSING PLACEMENTS",
    "[All] AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT",
    "[All] MOVED TO INACTIVE NUMBER",
    "[All] NEWLY IDENTIFIED NUMBER",
    "[All] RETURNED TO ACTIVE LIST FROM HOUSING NUMBER",
    "[All] RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER",
    // All Singles
    "[All Singles] Population",
    "[All Singles] Subpopulation",
    "[All Singles] Demographic",
    "[All Singles] ACTIVELY HOMELESS NUMBER",
    "[All Singles] HOUSING PLACEMENTS",
    "[All Singles] AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT",
    "[All Singles] MOVED TO INACTIVE NUMBER",
    "[All Singles] NEWLY IDENTIFIED NUMBER",
    "[All Singles] RETURNED TO ACTIVE LIST FROM HOUSING NUMBER",
    "[All Singles] RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER",
    // Chronic
    "[Chronic] Population",
    "[Chronic] Subpopulation",
    "[Chronic] Demographic",
    "[Chronic] ACTIVELY HOMELESS NUMBER",
    "[Chronic] HOUSING PLACEMENTS",
    "[Chronic] AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT",
    "[Chronic] MOVED TO INACTIVE NUMBER",
    "[Chronic] NEWLY IDENTIFIED NUMBER",
    "[Chronic] RETURNED TO ACTIVE LIST FROM HOUSING NUMBER",
    "[Chronic] RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER",
    // Veteran
    "[Veteran] Population",
    "[Veteran] Subpopulation",
    "[Veteran] Demographic",
    "[Veteran] ACTIVELY HOMELESS NUMBER",
    "[Veteran] HOUSING PLACEMENTS",
    "[Veteran] AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT",
    "[Veteran] MOVED TO INACTIVE NUMBER",
    "[Veteran] NEWLY IDENTIFIED NUMBER",
    "[Veteran] RETURNED TO ACTIVE LIST FROM HOUSING NUMBER",
    "[Veteran] RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER",
    // Chronic Veteran
    "[Chronic Veteran] Population",
    "[Chronic Veteran] Subpopulation",
    "[Chronic Veteran] Demographic",
    "[Chronic Veteran] ACTIVELY HOMELESS NUMBER",
    "[Chronic Veteran] HOUSING PLACEMENTS",
    "[Chronic Veteran] AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT",
    "[Chronic Veteran] MOVED TO INACTIVE NUMBER",
    "[Chronic Veteran] NEWLY IDENTIFIED NUMBER",
    "[Chronic Veteran] RETURNED TO ACTIVE LIST FROM HOUSING NUMBER",
    "[Chronic Veteran] RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER",
    // Youth
    "[Youth] Population",
    "[Youth] Subpopulation",
    "[Youth] Demographic",
    "[Youth] ACTIVELY HOMELESS NUMBER",
    "[Youth] HOUSING PLACEMENTS",
    "[Youth] AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT",
    "[Youth] MOVED TO INACTIVE NUMBER",
    "[Youth] NEWLY IDENTIFIED NUMBER",
    "[Youth] RETURNED TO ACTIVE LIST FROM HOUSING NUMBER",
    "[Youth] RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER",
    // Families
    "[Families] Population",
    "[Families] Subpopulation",
    "[Families] Demographic",
    "[Families] ACTIVELY HOMELESS NUMBER",
    "[Families] HOUSING PLACEMENTS",
    "[Families] AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT",
    "[Families] MOVED TO INACTIVE NUMBER",
    "[Families] NEWLY IDENTIFIED NUMBER",
    "[Families] RETURNED TO ACTIVE LIST FROM HOUSING NUMBER",
    "[Families] RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER",
  ],
  metrics: [
    "ACTIVELY HOMELESS NUMBER", 
    "HOUSING PLACEMENTS", 
    "MOVED TO INACTIVE NUMBER", 
    "NEWLY IDENTIFIED NUMBER", 
    "RETURNED TO ACTIVE LIST FROM HOUSING NUMBER", 
    "RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER", 
    "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT",
    "POTENTIAL 3-MONTH DATA RELIABILITY"
  ],
};

const pops = {
  all: ["All", "All Singles", "Veteran", "Chronic", "Chronic Veteran", "Youth", "Families"],
  output: {
    "All": {
      outputPop: "All",
      outputSubpop: "All",
      outputDemo: "All"
    },
    "All Singles": {
      outputPop: "Single Adults",
      outputSubpop: "All",
      outputDemo: "All"
    },
    "Veteran": {
      outputPop: "Single Adults",
      outputSubpop: "Veteran",
      outputDemo: "All"
    },
    "Chronic": {
      outputPop: "Single Adults",
      outputSubpop: "Chronic",
      outputDemo: "All"
    },
    "Chronic Veteran": {
      outputPop: "Single Adults",
      outputSubpop: "Chronic Veteran",
      outputDemo: "All"
    },
    "Youth": {
      outputPop: "Youth",
      outputSubpop: "All",
      outputDemo: "All"
    },
    "Families": {
      outputPop: "Families",
      outputSubpop: "All",
      outputDemo: "All"
    },
  },
  clientId: "Client ID",
};

const values = {
  veteran: ["yes", "yesvalidated", "yesconfirmed"],
  chronic: ["yes", "chronicallyhomeless"],
  singleAdult: ["singleadult", "singleadults"],
  youth: ["youth"],
  family: ["family", "families"],
};

export { headers, pops, values };
