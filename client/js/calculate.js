// Require packages
const d3 = require("d3");

// Import components
import { headers, metrics, pops, values } from "../dict.js";
import { Utils } from "./utils.js";
import { tidy, select, mutate } from '@tidyjs/tidy';

// Initialize components
let util = new Utils();

class Calculator {

    cleanData(rawData, state) {
        const data = rawData.filter((d) => d['Client ID'] != null)
        state.data.clean = tidy(
            data,
            select(headers.required),
            mutate({
                maxEntryDate: (d) => {
                    const dateOfId = util.parseDate(d['Date of Identification'])
                    const dateReturnedToActive = util.parseDate(d['Returned to Active Date'])
                    if (dateOfId > dateReturnedToActive) {
                        return dateOfId
                    } else if (dateOfId < dateReturnedToActive) {
                        return dateReturnedToActive
                    } else if (dateOfId === null && dateReturnedToActive === null) {
                        return null
                    } else if (dateOfId === dateReturnedToActive) {
                        return dateReturnedToActive
                    } else return dateOfId
                },
                maxEntryReason: (d) => {
                    const dateOfId = util.parseDate(d['Date of Identification'])
                    const dateReturnedToActive = util.parseDate(d['Returned to Active Date'])
                    if (dateOfId > dateReturnedToActive) {
                        return "Date of Identification"
                    } else if (dateOfId < dateReturnedToActive) {
                        return "Returned to Active"
                    } else if (dateOfId === null && dateReturnedToActive === null) {
                        return null
                    } else if (dateOfId === dateReturnedToActive) {
                        return "Returned to Active"
                    } else return "Date of Identification"
                },
                maxExitDate: (d) => {
                    const dateHousingMoveIn = util.parseDate(d['Housing Move-In Date'])
                    const dateInactive = util.parseDate(d['Inactive Date'])
                    if (dateHousingMoveIn > dateInactive) {
                        return dateHousingMoveIn
                    } else if (dateHousingMoveIn < dateInactive) {
                        return dateInactive
                    } else if (dateHousingMoveIn === null && dateInactive === null) {
                        return null
                    } else {
                        return dateHousingMoveIn
                    }
                },
                maxExitReason: (d) => {
                    const dateHousingMoveIn = util.parseDate(d['Housing Move-In Date'])
                    const dateInactive = util.parseDate(d['Inactive Date'])
                    if (dateHousingMoveIn > dateInactive) {
                        return 'Housing Move-In Date'
                    } else if (dateHousingMoveIn < dateInactive) {
                        return 'Inactive Date'
                    } else if (dateHousingMoveIn === null && dateInactive === null) {
                        return null
                    } else {
                        return 'Housing Move-In Date'
                    }
                },
                "Veteran": (d) => {
                    if (values.singleAdult.includes(util.clean(d['Household Type'])) === true && 
                        values.veteran.includes(util.clean(d['Veteran Status'])) === true) {
                        return true;
                    } else {
                        return false;
                    }
                },
                "Chronic": (d) => {
                    if (values.singleAdult.includes(util.clean(d['Household Type'])) === true && 
                        values.chronic.includes(util.clean(d['Chronic Status'])) === true) {
                        return true;
                    } else {
                        return false;
                    }
                },
                "Families": (d) => {
                    if (values.family.includes(util.clean(d['Household Type'])) === true) {
                        return true;
                    } else {
                        return false;
                    }
                },
                "Youth": (d) => {
                    if (values.youth.includes(util.clean(d['Household Type'])) === true) {
                        return true;
                    } else {
                        return false;
                    }
                },
                "Chronic Veteran": (d) => {
                    if (values.singleAdult.includes(util.clean(d['Household Type'])) === true && 
                        values.veteran.includes(util.clean(d['Veteran Status'])) === true &&
                        values.chronic.includes(util.clean(d['Chronic Status'])) === true) {
                        return true;
                    } else {
                        return false;
                    }
                },
                "All": (d) => {
                    if (d['Household Type'] != "") {
                        return true;
                    } else {
                        return false;
                    }
                },
                "All Singles": (d) => {
                    if (values.singleAdult.includes(util.clean(d['Household Type'])) === true) {
                        return true;
                    } else {
                        return false;
                    }
                },
                "Active": (d) => {
                    const reportingDate = util.parseDate(state.meta.reportingDate);
                    if (d.maxEntryDate <= reportingDate && 
                        (d.maxExitDate === null ||
                        d.maxExitDate < d.maxEntryDate ||
                        d.maxExitDate > reportingDate ) === true) {
                        return true;
                    } else {
                        return false;
                    }
                },
                lengthOfTime: (d) => {
                    if (d.maxExitDate != null && 
                        d.maxExitReason === 'Housing Move-In Date' && 
                        d.maxEntryDate != null &&
                        d.maxExitDate > d.maxEntryDate) {
                            const diff = d.maxExitDate - d.maxEntryDate;
                            const converted = Math.ceil(diff / (1000 * 60 * 60 * 24));
                            return converted;
                    } else return null
                }
            }),
            select([
                'Client ID',
                'Active',
                'maxEntryReason',
                'maxEntryDate',
                'maxExitReason',
                'maxExitDate',
                'All',
                'All Singles',
                'Chronic',
                'Chronic Veteran',
                'Families',
                'Veteran',
                'Youth',
                'lengthOfTime'
            ]),
        )
    }

    getFilteredData(data, state, population) {
        const reportingDate = util.parseDate(state.meta.reportingDate);
        state.rows.all[population] = data.filter((d) => d[population] === true);
        state.rows.active[population] = data.filter((d) => {
            return d[population] === true &&
            d["Active"] === true
        });

        const allData = state.rows.all[population];

        /* 
        *Note:
        Using d3.timeParse instead of util.parseDate because d3.offset requires a parsed
        Month Year date to be the 1st of the month (instead of the last, which util.parseDate forces).
        Forcing the last day of month causes a bug with the offset.
        E.g. offsetting Mar 31 by 1 month -> Mar 31 - (28 days in Feb) = Mar 03.
        */
        const parseValue = d3.timeParse("%B %Y")
        const formatValue = d3.timeFormat("%B %Y")
        const fourMonthsAgo = d3.timeMonth.offset(parseValue(state.meta.reportingDate), -3)
        const range = d3.timeMonth.range(fourMonthsAgo, parseValue(state.meta.reportingDate)).map((date) => formatValue(date))
        // Get pop, subpop, and demo
        const pop = pops.categories[population].outputPop;
        const subpop = pops.categories[population].outputSubpop;
        const demo = pops.categories[population].outputDemo;
        
        state.rows.filtered[population] = {
            "ACTIVELY HOMELESS NUMBER": allData.filter((d) => {
                return d["Active"] === true
            }),
            "HOUSING PLACEMENTS": allData.filter((d) => {
                return d.maxExitReason === "Housing Move-In Date" &&
                    util.equalMY(d.maxExitDate, reportingDate) === true
                }),
            "MOVED TO INACTIVE NUMBER": allData.filter((d) => {
                return d.maxExitReason === "Inactive Date" &&
                    util.equalMY(d.maxExitDate, reportingDate) === true
                }),
            "NEWLY IDENTIFIED NUMBER": allData.filter((d) => {
                return d.maxEntryReason === "Date of Identification" &&
                    util.equalMY(d.maxEntryDate, reportingDate) === true &&
                    (d.maxExitDate === null ||
                    util.equalMY(d.maxEntryDate, d.maxExitDate) === true)
                }),
            "RETURNED TO ACTIVE LIST FROM HOUSING NUMBER": allData.filter((d) => {
                return d["Active"] === true &&
                    d.maxExitReason === "Housing Move-In Date" &&
                    d.maxEntryDate > d.maxExitDate &&
                    util.equalMY(d.maxEntryDate, reportingDate) === true
                }),
            "RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER": allData.filter((d) => {
                return d["Active"] === true &&
                    d.maxExitReason === "Inactive Date" &&
                    d.maxEntryDate > d.maxExitDate &&
                    util.equalMY(d.maxEntryDate, reportingDate) === true
                }),
            "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT": allData.filter((d) => {
                return d.maxExitReason === "Housing Move-In Date" &&
                    util.equalMY(d.maxExitDate, reportingDate) === true &&
                    d.lengthOfTime != null
                }),
            "POTENTIAL 3-MONTH DATA RELIABILITY": {
                month0: state._import.dr_data.filter((d) => {
                    return d["Community"] === state.form.community_clean &&
                    d["Population"] === pop &&
                    d["Subpopulation"] === subpop &&
                    d["Demographic"] === demo &&
                    d["Month"] === range[0]
                }),
                month1: state._import.dr_data.filter((d) => {
                    return d["Community"] === state.form.community_clean &&
                    d["Population"] === pop &&
                    d["Subpopulation"] === subpop &&
                    d["Demographic"] === demo &&
                    d["Month"] === range[1]
                }),
                month2: state._import.dr_data.filter((d) => {
                    return d["Community"] === state.form.community_clean &&
                    d["Population"] === pop &&
                    d["Subpopulation"] === subpop &&
                    d["Demographic"] === demo &&
                    d["Month"] === range[2]
                })
            }
        }

        state.output[population] = {}

        metrics.all.map((metric) => {
            state.output[population][metric] = {}
            const data = state.rows.filtered[population][metric]
            if (metric === "AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT") {
                const result = this.getAvgLot(data)
                state.output[population][metric].clientList = result.clientList;
                state.output[population][metric].value = result.output;
            } else if (metric === "POTENTIAL 3-MONTH DATA RELIABILITY") {
                const result = this.getDataReliability(data, population, range, state)
                state.output[population][metric].data = data;
                state.output[population][metric].value = result.output;
                state.output[population][metric].sentence = result.sentence;
            } else {
                const result = this.getUniqueClients(data)
                state.output[population][metric].clientList = result.clientList;
                state.output[population][metric].value = result.output;
            }
        })
    }

    getUniqueClients(data) {
        if (data.length === 0 || data === undefined) {
            return {
                clientList: null,
                output: null
            }
        } else {
            const clientList = util.getColByName(data, "Client ID");
            const uniqueNumber = new Set(clientList).size;
            return {
                clientList: clientList,
                output: uniqueNumber
            };
        }
    }

    getAvgLot(data) {
        if (data.length === 0 || data === undefined) {
            return {
                clientList: null,
                output: null
            }
        } else {
            const formatNumber = d3.format(".1f")
            const clientList = util.getColByName(data, "Client ID");
            const lotArr = util.getColByName(data, 'lengthOfTime')
            const average = formatNumber(lotArr.reduce(function (sum, value) {
                return sum + value;
            }, 0) / lotArr.length);
            return {
                clientList: clientList,
                output: average
            };
        }
    }

    getDataReliability(data, population, range, state) {
        let values = {}
        let netChange, drValue, prevMonthError, sentence;
        const monthsWithNoData = []
        range.map((month, index) => {
            const monthNum = `month${index}`
            if (data[monthNum].length === 0) {
                monthsWithNoData.push(month)
                values[monthNum] = {
                    month: month,
                    ah: null,
                    inflow: null,
                    outflow: null
                }
            } else {
                values[monthNum] = {
                    month: month,
                    ah: util.cleanNum(data[monthNum][0]["ACTIVELY HOMELESS NUMBER"]),
                    inflow: util.cleanNum(data[monthNum][0]["NEWLY IDENTIFIED NUMBER"]) + 
                            util.cleanNum(data[monthNum][0]["RETURNED TO ACTIVE LIST FROM HOUSING NUMBER"]) + 
                            util.cleanNum(data[monthNum][0]["RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER"]),
                    outflow: util.cleanNum(data[monthNum][0]["HOUSING PLACEMENTS"]) + 
                            util.cleanNum(data[monthNum][0]["MOVED TO INACTIVE NUMBER"])
                }
            }
        })

        const thisMonthValues = {
            ah: state.output[population]["ACTIVELY HOMELESS NUMBER"].value,
            hp: state.output[population]["HOUSING PLACEMENTS"].value,
            inactive: state.output[population]["MOVED TO INACTIVE NUMBER"].value,
            newlyId:  state.output[population]["NEWLY IDENTIFIED NUMBER"].value,
            retHousing: state.output[population]["RETURNED TO ACTIVE LIST FROM HOUSING NUMBER"].value,
            retInactive:  state.output[population]["RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER"].value,
        }

        values["month3"] = {
            month: util.getMonthYear(state.meta.reportingDate),
            ah: thisMonthValues.ah,
            inflow: thisMonthValues.newlyId + thisMonthValues.retHousing + thisMonthValues.retInactive,
            outflow: thisMonthValues.hp + thisMonthValues.inactive
        }

        const formatPercent = d3.format(".1%")
        // month0 = oldest / four months ago
        // month3 = current reporting month
        
        if (monthsWithNoData.length > 0 || values.month3.ah === 0 || values.month3.ah === null) {
            netChange = null;
            drValue = "N/A";
            prevMonthError = null;
            sentence = `This population (${population}) does not have enough prior data to calculate data reliability.`
        } else {
            netChange = (values.month1.inflow + values.month2.inflow + values.month3.inflow) - 
                        (values.month1.outflow + values.month2.outflow + values.month3.outflow);
            prevMonthError = values.month3.ah - (values.month2.ah + values.month3.inflow - values.month3.outflow)
            drValue = formatPercent((values.month3.ah - values.month0.ah - netChange) / values.month3.ah);

            let peoplePlural;
            if (((prevMonthError) * -1) === 1) {
                peoplePlural = "client"
            } else peoplePlural = "clients"

            if (prevMonthError <= 0) {
                sentence = `This population (${population}) has ${prevMonthError * -1} fewer ${peoplePlural} reported as Actively Homeless than expected.`
            } else {
                sentence = `This population (${population}) has ${prevMonthError} more ${peoplePlural} reported as Actively Homeless than expected.`
            }
        }
        return {
            data: data,
            output: drValue,
            sentence: sentence,
        };
    }

    getAndPrintMetrics(state) {
        this.reset(state)
        state.output = {}
        // Add in metadata for submission
        state.backend.output["Timestamp"] = state.meta.timestamp;
        state.backend.output["Community"] = state.form.community_clean;
        state.backend.output["Month"] = state.meta.reportingDate;
        state.backend.output["Name"] = state.form.name;
        state.backend.output["Email Address"] = state.form.email;
        state.backend.output["Organization"] = state.form.org;

        pops.all.map((pop) => {
            // Calculate all metrics
            this.getFilteredData(state.data.clean, state, pop);
            // Get associated data
            const outputPop = pops.categories[pop].outputPop
            const outputSubpop = pops.categories[pop].outputSubpop
            const outputDemo = pops.categories[pop].outputDemo  
            state.backend.output["[" + pop + "] Population"] = outputPop;
            state.backend.output["[" + pop + "] Subpopulation"] = outputSubpop;
            state.backend.output["[" + pop + "] Demographic"] = outputDemo;

            metrics.all.map((metric) => {
                const calcResult = state.output[pop][metric].value
                state.backend.output["[" + pop + "] " + metric] = calcResult;
                const cleanMetricName = metrics.info[metric].clean
                const suffixSingular = metrics.info[metric].suffix_singular
                const suffixPlural = metrics.info[metric].suffix_plural
                let helpText;
                if (metric === "POTENTIAL 3-MONTH DATA RELIABILITY") {
                    helpText = `${metrics.info["POTENTIAL 3-MONTH DATA RELIABILITY"].help_text} <br><br> ${state.output[pop][metric].sentence}`
                } else {
                    helpText = metrics.info[metric].help_text
                }
                this.printRow(pop, cleanMetricName, calcResult, suffixSingular, suffixPlural, helpText)
            })
        })
    }

    printRow(population, cleanCalcName, calcValue, suffixSingular, suffixPlural, helpText) {
        const cleanPopName = population.replace(/\s+/g, '')
        const calcNameForClass = cleanCalcName.replace(/\s+/g, '')

        if (calcValue != 1 && calcValue != "N/A") {
            this.printCalcName(cleanCalcName, calcNameForClass, cleanPopName);
            this.printCalcValue(calcValue, calcNameForClass, suffixPlural, cleanPopName);
        } else if (calcValue === 1 && calcValue != "N/A") {
            this.printCalcName(cleanCalcName, calcNameForClass, cleanPopName);
            this.printCalcValue(calcValue, calcNameForClass, suffixSingular, cleanPopName);
        } else {
            this.printCalcName(cleanCalcName, calcNameForClass, cleanPopName);
            this.printCalcValue(calcValue, calcNameForClass, "", cleanPopName);
        }
        d3.selectAll(`.agg-value-calc.${cleanPopName}.${calcNameForClass}`)
            .on("mouseover", function() {
                d3.selectAll(`.${calcNameForClass}`).style("background-color", "rgb(235, 235, 235)")
                d3.select(this)
                    .append("div")
                    .style("opacity", 0)
                    .classed("metric-tooltip", true)
                    .style("left", (d3.select(this).attr("cx"))+ "px")
                    .style("top", (d3.select(this).attr("cy")) + "px")
                    .html(`<p class='metric-help-text'>${helpText}</p>`)
                    .transition().duration(200).style("opacity", null);
            })
            .on("mousemove", function() {
                
            })
            .on("mouseout", function() {
                d3.selectAll(`.${calcNameForClass}`).style("background-color", "white")
                d3.selectAll(".metric-tooltip").remove();
            })
            
    }

    printCalcName(calcName, calcNameForClass, cleanPopName) {
        d3.select(".agg-table")
            .append("div")
            .classed("agg-value-calc", true)
            .classed(`${cleanPopName}`, true)
            .classed(`${calcNameForClass}`, true)
            .classed("hide", true)
            .html(`${calcName}`);
    }

    printCalcValue(value, calcNameForClass, suffix, cleanPopName) {
        if (value === null || value === 0 || value === "N/A" || value === "N/A%") {
            d3.select(".agg-table")
                .append("div")
                .classed("agg-value", true)
                .classed(`${cleanPopName}`, true)
                .classed(`${calcNameForClass}`, true)
                .classed("hide", true)
                .html(`<b class='neutral' style='font-weight:400;'>${value}${suffix}</b>`);
        } else {
            d3.select(".agg-table")
                .append("div")
                .classed("agg-value", true)
                .classed(`${cleanPopName}`, true)
                .classed(`${calcNameForClass}`, true)
                .classed("hide", true)
                .html(`<b>${value}${suffix}</b>`);
        }
    }


    reset(state) {
        state.output = null;
        state.backend.raw = null;
        state.backend.output = {};
        d3.selectAll(".agg-value").remove();
        d3.selectAll(".agg-value-calc").remove();
    }

    lookupClientInfo(clientId, state) {
        const reportingDate = util.parseDate(state.meta.reportingDate);
        const output = {
            clientId: clientId,
            reportingDate: reportingDate,
            raw: null,
            clean: null,
            entryExit: {
                maxEntryDate: null,
                maxEntryReason: null,
                maxExitDate: null,
                maxExitReason: null,
            },
            activeDebug: {
                active: null,
                maxEntryBeforeReporting: null,
                atLeastOne: {
                    maxExitDateNull: null,
                    maxExitBeforeMaxEntry: null,
                    maxExitAfterReporting: null,
                }
            }
        }

        output.raw = state.data.raw.filter((d) => d["Client ID"] === clientId)[0];
        
        if (output.raw === undefined) {
            console.log("🔎 CLIENT LOOKUP", clientId, " || NOT FOUND");
            console.log(" ");
        } else {
            output.clean = state.data.clean.filter((d) => d["Client ID"] === clientId)[0];
            const d = output.clean
            output.entryExit.maxEntryDate = d.maxEntryDate;
            output.entryExit.maxEntryReason = d.maxEntryReason;
            output.entryExit.maxExitDate = d.maxExitDate;
            output.entryExit.maxExitReason = d.maxExitReason;
            output.activeDebug.active = d.Active;
            output.activeDebug.maxEntryBeforeReporting = (d.maxEntryDate <= reportingDate);
            output.activeDebug.atLeastOne.maxExitInReporting = (util.equalMY(d.maxExitDate, reportingDate) === true)
            output.activeDebug.atLeastOne.maxExitDateNull = (d.maxExitDate === null);
            output.activeDebug.atLeastOne.maxExitBeforeMaxEntry = (d.maxExitDate < d.maxEntryDate);
            output.activeDebug.atLeastOne.maxExitAfterReporting = (d.maxExitDate > reportingDate);

            console.log("🔎 CLIENT LOOKUP", clientId, output);
            console.log(" ");
        }
        
    }

    
}

export { Calculator };
