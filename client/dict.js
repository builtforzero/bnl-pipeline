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
    "Client ID": {
      altNames: ["clientid", "idnumber"],
      rename: "Client ID",
      datatype: "num",
      error: `must only contain <b style='color:black'>whole numbers</b>. e.g. "3"`,
    },
    "Date of Identification": {
      altNames: ["dateofidentification", "identificationdate"],
      rename: "Date of Identification",
      datatype: "date",
      error: `must be a single date in a valid format <b style='color:black'>e.g. "3/1/2021" or "March 1, 2021</b> and cannot be in the <b style='color:black'>future</b>.`,
    }, 
    "Housing Move-In Date": {
      altNames: ["housingmoveindate", "dateofhousingmovein", "housingdateofmovein"],
      rename: "Housing Move-In Date",
      datatype: "date",
      error: `must be a single date in a valid format <b style='color:black'>e.g. "3/1/2021" or "March 1, 2021</b> and cannot be in the <b style='color:black'>future</b>.`,
    },  
    "Inactive Date": {
      altNames: ["inactivedate"],
      rename: "Inactive Date",
      datatype: "date",
      error: `must be a single date in a valid format <b style='color:black'>e.g. "3/1/2021" or "March 1, 2021</b> and cannot be in the <b style='color:black'>future</b>.`,
    }, 
    "Returned to Active Date": {
      altNames: ["returnedtoactivedate", "returntoactivedate"],
      rename: "Returned to Active Date",
      datatype: "date",
      error: `must be a single date in a valid format <b style='color:black'>e.g. "3/1/2021" or "March 1, 2021</b> and cannot be in the <b style='color:black'>future</b>.`,
    },
    "Household Type": {
      altNames: ["householdtype"],
      rename: "Household Type",
      datatype: "any",
      error: `can accept any data type.`,
    },   
    "Chronic Status": {
      altNames: ["chronicstatus"],
      rename: "Chronic Status",
      datatype: "any",
      error: `can accept any data type.`,
    },  
    "Veteran Status": {
      altNames: ["veteranstatus"],
      rename: "Veteran Status",
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
};

const metrics = {
  all: [
    "ACTIVELY HOMELESS NUMBER", 
    "HOUSING PLACEMENTS", 
    "MOVED TO INACTIVE NUMBER", 
    "NEWLY IDENTIFIED NUMBER", 
    "RETURNED TO ACTIVE LIST FROM HOUSING NUMBER", 
    "RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER", 
    "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT",
    "POTENTIAL 3-MONTH DATA RELIABILITY"
  ],
  info: {
    "ACTIVELY HOMELESS NUMBER": {
      clean: "Actively Homeless Number",
      category: "Active",
      suffix_singular: "",
      suffix_plural: "",
      help_text: `As of the last day of the reporting month, the number of actively homeless individuals on your By-Name List who have not yet moved into permanent housing.`
    }, 
    "HOUSING PLACEMENTS": {
      clean: "Housing Placements",
      category: "All",
      suffix_singular: "",
      suffix_plural: "",
      help_text: `The total number of individuals experiencing homelessness who moved into permanent housing over the course of the reporting month.`
    }, 
    "MOVED TO INACTIVE NUMBER": {
      clean: "Moved to Inactive Number",
      category: "All",
      suffix_singular: "",
      suffix_plural: "",
      help_text: `The total number of individuals experiencing homelessness who have been designated as "inactive" on your By-Name List over the course of the reporting month`
    },  
    "NEWLY IDENTIFIED NUMBER": {
      clean: "Newly Identified Number",
      category: "Active",
      suffix_singular: "",
      suffix_plural: "",
      help_text: `The total number of individuals experiencing homelessness who have <i>newly</i> entered your coordinated entry system over the course of the reporting month.`
    }, 
    "RETURNED TO ACTIVE LIST FROM HOUSING NUMBER": {
      clean: "Returned to Active from Housing",
      category: "All",
      suffix_singular: "",
      suffix_plural: "",
      help_text: `The total number of individuals who were previously housed and have become unhoused or have otherwise returned to homelessness over the course of the reporting month.`
    },  
    "RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER": {
      clean: "Returned to Active from Inactive",
      category: "All",
      suffix_singular: "",
      suffix_plural: "",
      help_text: `The total number of individuals who were previously designated as inactive but have since reappeared or otherwise returned to homelessness over the course of the reporting month.`
    },   
    "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT": {
      clean: "Average Length of Time from ID to Housing Placement",
      category: "All",
      suffix_singular: " day",
      suffix_plural: " days",
      help_text: `The average length of time (LOT) from date of identification to placement in permanent housing for individuals in your community, for the reporting month.`
    },
    "POTENTIAL 3-MONTH DATA RELIABILITY": {
      clean: "Potential 3 Month Data Reliability",
      category: "All",
      suffix_singular: "",
      suffix_plural: "",
      help_text: `A measure of data quality that signals a robust data management practice. Represents the percentage difference between the actual and expected number of actively homeless individuals over the past 3 months.`
    },
  }
}

const pops = {
  all: ["All", "All Singles", "Veteran", "Chronic", "Chronic Veteran", "Youth", "Families"],
  categories: {
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
  chronic: ["yes", "chronicallyhomeless", "chronic"],
  singleAdult: ["singleadult", "singleadults"],
  youth: ["youth"],
  family: ["family", "families"],
};

export { headers, metrics, pops, values };
