const amazon = require('amazon-product-api');
const get = require('lodash.get');
const promisify = require('util').promisify;
const fs = require('fs');
const sleep = promisify(setTimeout);
const writeFile = promisify(fs.writeFile);
const appendFile = promisify(fs.appendFile);
const unlink = promisify(fs.unlink);
const retry = require('async-retry');
const config = require('../config');
const Json2csvParser = require('json2csv').Parser;
const csv2json = require('csvtojson');
const endOfLine = require('os').EOL;

const client = amazon.createClient({
  awsId: config.awsId,
  awsSecret: config.awsSecret,
  awsTag: config.awsTag
});

async function getProducts(browseNodeId, browseNodeName) {
  try {
    console.log(`getting products from ${browseNodeId}-${browseNodeName} - START`);
    let response = await retry(async (bail, count) => {
      await sleep(config.amzApiInterval);
      console.log(`getting products from ${browseNodeId}-${browseNodeName} - BROWSE NODE LOOKUP retry ${count}`);
      return await client.browseNodeLookup({ 
        browseNodeId,
        responseGroup: config.responseGroup,
      });
    }, {
      retries: config.retries
    })
    let topItemSet = get(response, '[0].TopItemSet', []);
    let topItemArray = topItemSet.reduce((accumulator, currentValue) => {
      return accumulator.concat(currentValue.TopItem);
    }, []).map(row => {
      return {
        ASIN: get(row, 'ASIN.[0]'),
        Title: get(row, 'Title.[0]'),
      }
    })

    // write to output file
    await appendCsvFile(topItemArray);

    console.log(`getting products from ${browseNodeId}-${browseNodeName} - END`);
  } catch(e) {
    console.log(`getting products from ${browseNodeId}-${browseNodeName} - END WITH ERROR`);
    console.log(JSON.stringify(e));
    return [];
  }
}

async function appendCsvFile(results) {
  if (results.length === 0) {
    return;
  }
  let fields = ['ASIN', 'Title'];
  const json2csvParser = new Json2csvParser({ fields, header: false });
  const csv = json2csvParser.parse(results);
  await appendFile(config.productsFile, `${endOfLine}`);
  await appendFile(config.productsFile, csv);
}

async function main() {
  try {
    await unlink(config.productsFile);
    await appendFile(config.productsFile, `"ASIN","Title"`);
  } catch(e) {
    // do nothing
  }
  let inputs = await csv2json().fromFile(config.outputCategoriesFile);
  for (let row of inputs) {
    await getProducts(row.BrowseNodeId, row.Name);
  }
}

main();