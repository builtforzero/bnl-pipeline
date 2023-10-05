import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.supabaseUrl, process.env.supabaseAnonKey);

export async function insertData(formData) {
    // Prepare data structure - one row per population
    let cleanData = [
        {'populationTag': '[All]', 'popSubpopDemo': 'All-All-All'},
        {'populationTag': '[All Singles]', 'popSubpopDemo': 'Single Adults-All-All'},
        {'populationTag': '[Veteran]', 'popSubpopDemo': 'Single Adults-Veteran-All'},
        {'populationTag': '[Chronic]', 'popSubpopDemo': 'Single Adults-Chronic-All'},
        {'populationTag': '[Chronic Veteran]', 'popSubpopDemo': 'Single Adults-Chronic Veteran-All'},
        {'populationTag': '[Youth]', 'popSubpopDemo': 'Youth-All-All'},
        {'populationTag': '[Families]', 'popSubpopDemo': 'Families-All-All'}
    ];

    // Translation from form field names to Supabase column names
    const cleanFieldNames = {
        'ACTIVELY HOMELESS NUMBER': 'actively_homeless',
        'AVERAGE LENGTH OF TIME FROM IDENTIFICATION TO HOUSING PLACEMENT': 'avg_lot_from_id_to_housing',
        'HOUSING PLACEMENTS': 'housing_placements',
        'MOVED TO INACTIVE NUMBER': 'moved_to_inactive',
        'NO LONGER MEETS POPULATION CRITERIA': 'no_longer_meets_population_criteria',
        'NEWLY IDENTIFIED NUMBER': 'newly_identified',
        'RETURNED TO ACTIVE LIST FROM HOUSING NUMBER': 'returned_from_housing',
        'RETURNED TO ACTIVE LIST FROM INACTIVE NUMBER': 'returned_from_inactive',
        // 'ACTIVELY HOMELESS INDIVIDUALS IN FAMILIES': 'actively_homeless_in_families'
    };

    // Restructure data to one row per population with corrected column names
    for(let field in formData) {
        for(let i = 0; i < cleanData.length; i++) {
            if(field.substring(field.indexOf('['), field.lastIndexOf(']') + 1) == cleanData[i].populationTag) {
                let fieldName = field.indexOf("]") >= 0 ? field.split("] ")[1] : field;
                if(cleanFieldNames[fieldName]) {
                    cleanData[i][cleanFieldNames[fieldName]] = formData[field];
                }
                break;
            }
        }
    }

    // Reformat Month field
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    let monthNum = monthNames.indexOf(formData.Month.split(' ')[0]) + 1;
    let formattedMonth = formData.Month.split(' ')[1].toString() + '-' + (monthNum > 9 ? monthNum.toString() : '0' + monthNum.toString()) + '-01';

    // Get subpopulation ids from Supabase
    let { data:subpopulationData, error:subpoplationError } = await supabase
        .from('subpopulations')
        .select('*')
        .eq('accountname', formData['Community']);
    if(subpoplationError) {
        return 'ERROR: ' + subpoplationError.message;
    } else if(subpopulationData.length <= 0) {
        return 'ERROR: No subpopulation records were found for this community.';
    } else {
        // Add subpopulation id, month, name, email, and org + remove helper fields from each row
        for(let i = 0; i < cleanData.length; i++) {
            cleanData[i].subpopulation_id = subpopulationData.find((record) => record.accountname + record.population + '-' + record.subpopulation + '-' + record.demographic == formData['Community'] + cleanData[i].popSubpopDemo).id;
            cleanData[i].date_interval_start = formattedMonth;
            cleanData[i].name = formData['Name'];
            cleanData[i].email = formData['Email Address'];
            cleanData[i].organization = formData['Organization'];
            delete cleanData[i].populationTag;
            delete cleanData[i].popSubpopDemo;
        }
        // Insert data into Supabase
        let { data, error } = await supabase
            .from('community_reported_population')
            .insert(cleanData);
        if(error) {
            return 'ERROR: ' + error.message;
        }
        return 'SUCCESS';
    }
}