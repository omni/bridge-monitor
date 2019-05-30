require('dotenv').config();
const logger = require('./logger')('stuckTransfers.js');
const Web3 = require('web3');
const Web3Utils = require('web3-utils')
const FOREIGN_RPC_URL = process.env.FOREIGN_RPC_URL;
const FOREIGN_BRIDGE_ADDRESS = process.env.FOREIGN_BRIDGE_ADDRESS;
const POA20_ADDRESS = process.env.POA20_ADDRESS;
const FOREIGN_DEPLOYMENT_BLOCK = Number(process.env.FOREIGN_DEPLOYMENT_BLOCK) || 0;

const foreignProvider = new Web3.providers.HttpProvider(FOREIGN_RPC_URL);
const web3Foreign = new Web3(foreignProvider);

const ABI_TransferWithoutData = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "value",
        "type": "uint256"
      }
    ],
    "name": "Transfer",
    "type": "event"
  }
]

const ABI_withData = [{
  "anonymous": false,
  "inputs": [
    {
      "indexed": true,
      "name": "from",
      "type": "address"
    },
    {
      "indexed": true,
      "name": "to",
      "type": "address"
    },
    {
      "indexed": false,
      "name": "value",
      "type": "uint256"
    },
    {
      "indexed": false,
      "name": "data",
      "type": "bytes"
    }
  ],
  "name": "Transfer",
  "type": "event"
}]

function compareTransfers(transfersNormal){
  return function(withData){
    return transfersNormal.filter(function(normal){
      return normal.transactionHash === withData.transactionHash
    }).length == 0;
  }
}

async function main(){
  const tokenContract = new web3Foreign.eth.Contract(ABI_TransferWithoutData, POA20_ADDRESS);
  const tokenContractWithData = new web3Foreign.eth.Contract(ABI_withData, POA20_ADDRESS);
  logger.debug('calling tokenContract.getPastEvents Transfer');
  let transfersNormal = await tokenContract.getPastEvents('Transfer', {
    filter: {
      to: FOREIGN_BRIDGE_ADDRESS
    },
    fromBlock: FOREIGN_DEPLOYMENT_BLOCK,
    toBlock: 'latest'
  });
  logger.debug('calling tokenContractWithData.getPastEvents Transfer');
  let transfersWithData = await tokenContractWithData.getPastEvents('Transfer', {
    filter: {
      to: FOREIGN_BRIDGE_ADDRESS
    },
    fromBlock: FOREIGN_DEPLOYMENT_BLOCK,
    toBlock: 'latest'
  });
  const stuckTransfers = transfersNormal.filter(compareTransfers(transfersWithData))
  logger.debug('Done');
  return {
    stuckTransfers,
    total: stuckTransfers.length,
    lastChecked: Math.floor(Date.now() / 1000)
  }
}
module.exports = main;
