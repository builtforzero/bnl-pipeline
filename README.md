# BNL PIPELINE PROJECT

Project structure adapted from [this tutorial](https://github.com/witchard/tutorial-react-parcel-express) by `witchard` and `aronhoyer`.

## Development with auto reloading
- `npm run dev`
- Visit `http://localhost:3000`
- Change some files!

## Deploy
- `npm run predeploy`
- `npm run deploy`
- Push changes to github
- Visit https://builtforzero.github.io/bnl-pipeline/index.html

<br />

-----

<br />

## Validator Engine

- **`checkHeaders`:**  loop through all headers and check that required columns are present and PII columns are not included
- **`checkRequired`:**  check that required columns are 100% filled in
- **`checkDataType`:** check that all columns contain the right data type
- **`checkSsn`:**  loop through all data points and flag any that might be SSNs

## Aggregator Engine

 - **`getSubpop`:** calculate subpopulation based on household type and chronic / veteran status, add to validated data
 - **`aggregateData`:**  takes in validated data, runs PMT calculations, returns aggregated file
 - **`addMetadata`:** adds form fields to aggregated file, returns final upload file
 - **`uploadToAws`:** upload final aggregated file to AWS S3