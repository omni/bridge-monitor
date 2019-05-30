const fs = require('fs')
const logger = require('./logger')('checkWorker3');
const stuckTransfers = require('./stuckTransfers')

async function checkWorker3() {
  try {
    logger.debug('calling stuckTransfers()');
    const transfers = await stuckTransfers();
    console.log(transfers)
    if (!transfers) throw new Error('transfers is empty: ' + JSON.stringify(transfers));
    fs.writeFileSync(__dirname + '/responses/stuckTransfers.json', JSON.stringify(transfers,null,4));
    logger.debug("Done");
    return transfers;
  } catch(e) {
    logger.error(e);
  }
}
checkWorker3();
