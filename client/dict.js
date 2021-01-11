const headers = {
  required: ["Date of Identification", "Homeless Start Date", "Housing Move-In Date", "Inactive Date", "Returned to Active Date", "Age", "Client ID", "BNL Status", "Household Type", "Household Size", "Chronic Status", "Veteran Status", "Ethnicity", "Race", "Gender"],
  datatype: ["date", "date", "date", "date", "date", "num", "num", "any", "any", "num", "any", "any", "any", "any", "any"],
  errors: {
    date: `must be in the format <b style='color:black'>MM/DD/YYYY</b>, e.g. "12/31/2020".`,
    num: `must only contain <b style='color:black'>whole numbers</b>. e.g. "3"`,
    alphanum: `must only be <b style='color:black'>letters or numbers; no special characters</b>. e.g. "Yes (Confirmed)"`,
    any: `can accept any data type.`,
  },
  banned: ["Social Security Number", "SSN", "Last 4", "First Name", "Last Name", "Name", "Birthday", "Date of Birth", "DOB"],
  backend: [
    "Timestamp",
    "Community",
    "Month",
    "Name",
    "Email Address",
    "Organization",
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
    "[Family] Population",
    "[Family] Subpopulation",
    "[Family] Demographic",
    "[Family] ACTIVELY HOMELESS NUMBER",
    "[Family] HOUSING PLACEMENTS",
    "[Family] AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT",
    "[Family] MOVED TO INACTIVE NUMBER",
    "[Family] NEWLY IDENTIFIED NUMBER",
    "[Family] RETURNED TO ACTIVE LIST FROM HOUSING NUMBER",
    "[Family] RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER",
  ],
  metrics: ["ACTIVELY HOMELESS NUMBER", "HOUSING PLACEMENTS", "MOVED TO INACTIVE NUMBER", "NEWLY IDENTIFIED NUMBER", "RETURNED TO ACTIVE LIST FROM HOUSING NUMBER", "RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER", "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT"],
};

const pops = {
  all: ["All", "Veteran", "Chronic", "Youth", "Family"],
  clientId: "Client ID",
};

const values = {
  veteran: ["yes", "yesvalidated", "yesconfirmed"],
  chronic: ["yes", "chronicallyhomeless"],
  singleAdult: ["singleadult", "singleadults"],
  youth: ["youth"],
  family: ["family"],
};

export { headers, pops, values };
