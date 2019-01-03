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
const axios = require('axios');

async function getKeywords(productNames) {
  console.log('getting key pharses...');

  let documents = productNames.map((value, index) => {
    return { 'id': index + 1, 'language': 'en', 'text': value }
  });

  try {
    let response = await axios({
      method: 'post',
      url: config.msUrl,
      data: { 'documents': documents},
      headers : {
        'Ocp-Apim-Subscription-Key' : config.msKey,
      }
    });
    let keyPhrasesArray = get(response, 'data.documents', []);
    let keyPhrases = keyPhrasesArray.reduce((accumulator, currentValue) => {
      return accumulator.concat(currentValue.keyPhrases);
    }, []);
    return keyPhrases

  } catch(e) {
    console.log(JSON.stringify(e));
    return [];
  }
}

async function main() {
  try {
    await unlink(config.keywordsFile);
  } catch(e) {
    // do nothing
  }

  let inputs = await csv2json().fromFile(config.productsFile);
  let productNames = inputs.map (row => { return row.Title})
    .filter(x => { return x });

  var productNamesArray = [], size = 1000;

  while (productNames.length > 0)
    productNamesArray.push(productNames.splice(0, size));
  
  let keyPhrases = [];

  for (let row of productNamesArray) {
    let keyPhrase = await getKeywords(row);
    keyPhrases = keyPhrases.concat(keyPhrase);
  }

  let keyPrasesSet = new Set(keyPhrases);
  let str = Array.from(keyPrasesSet).join(endOfLine);
  await appendFile(config.keywordsFile, str);
}

main();