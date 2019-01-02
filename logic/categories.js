const amazon = require('amazon-product-api');
const get = require('lodash.get');
const promisify = require('util').promisify;
const fs = require('fs');
const sleep = promisify(setTimeout);
const writeFile = promisify(fs.writeFile);
const retry = require('async-retry');
const config = require('../config');
const Json2csvParser = require('json2csv').Parser;

const client = amazon.createClient({
  awsId: config.awsId,
  awsSecret: config.awsSecret,
  awsTag: config.awsTag
});

async function getChildren(browseNodeId, browseNodeName) {
  try {
    console.log(`getting child categories from ${browseNodeId}-${browseNodeName} - START`);
    let response = await client.browseNodeLookup({ browseNodeId });
    let childrenRaw = get(response, '[0].Children[0].BrowseNode', []);
    let children = childrenRaw.map(row => {
      return {
        BrowseNodeId: get(row, 'BrowseNodeId.[0]'),
        Name: get(row, 'Name.[0]'),
      }
    })

    let results = children.slice(0);
    for (let child of children) {
      if (child.BrowseNodeId) {
        await sleep(config.amzApiInterval);
        let childResults = await getChildren(child.BrowseNodeId, child.Name);
        results = results.concat(childResults);
      }
    }

    console.log(`getting child categories from ${browseNodeId}-${browseNodeName} - END`);
    return results
  } catch(e) {
    console.log(`getting child categories from ${browseNodeId}-${browseNodeName} - END WITH ERROR`);
    console.log(JSON.stringify(e));
    return [];
  }
}

async function main() {
  let results = await getChildren(549726);
  let firstRow = get(results, '[0]', []);
  let fields = Object.keys(firstRow);
  const json2csvParser = new Json2csvParser({ fields });
  const csv = json2csvParser.parse(results);
  await writeFile('output-categories.csv', csv);
  console.log(results);
}

main();