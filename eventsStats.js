require('dotenv').config();
const fs = require('fs')
const Web3 = require('web3');
const Web3Utils = require('web3-utils')
const HOME_RPC_URL = process.env.HOME_RPC_URL;
const FOREIGN_RPC_URL = process.env.FOREIGN_RPC_URL;
const HOME_BRIDGE_ADDRESS = process.env.HOME_BRIDGE_ADDRESS;
const FOREIGN_BRIDGE_ADDRESS = process.env.FOREIGN_BRIDGE_ADDRESS;
const POA20_ADDRESS = process.env.POA20_ADDRESS;

const homeProvider = new Web3.providers.HttpProvider(HOME_RPC_URL);
const web3Home = new Web3(homeProvider);

const foreignProvider = new Web3.providers.HttpProvider(FOREIGN_RPC_URL);
const web3Foreign = new Web3(foreignProvider);

const HOME_ABI = require('./Home_bridge.abi');
const FOREIGN_ABI = require('./Foreign.abi')

const db = require('./db.json')

function compareDepositsHome(foreign){
  return function(homeDeposit){
    return foreign.filter(function(foreignDeposit){
      return foreignDeposit.returnValues.transactionHash === homeDeposit.transactionHash
           && foreignDeposit.returnValues.recipient === homeDeposit.returnValues.recipient && 
           foreignDeposit.returnValues.value === homeDeposit.returnValues.value
    }).length == 0;
  }
}
function compareDepositsForeign(home){
  return function(foreignDeposit){
    return home.filter(function(homeDeposit){
      return homeDeposit.transactionHash === foreignDeposit.returnValues.transactionHash
           && homeDeposit.returnValues.recipient === foreignDeposit.returnValues.recipient && 
           homeDeposit.returnValues.value === foreignDeposit.returnValues.value
    }).length == 0;
  }
}

async function main(){
  try {

    const homeBridge = new web3Home.eth.Contract(HOME_ABI, HOME_BRIDGE_ADDRESS);
    const foreignBridge = new web3Foreign.eth.Contract(FOREIGN_ABI, FOREIGN_BRIDGE_ADDRESS);
    let homeDeposits = await homeBridge.getPastEvents('Deposit', {fromBlock: db.home.processedBlock});
    let foreignDeposits = await foreignBridge.getPastEvents('Deposit', {fromBlock: db.foreign.processedBlock});
    let homeWithdrawals = await homeBridge.getPastEvents('Withdraw', {fromBlock: db.home.processedBlock});
    let foreignWithdrawals = await foreignBridge.getPastEvents('Withdraw', {fromBlock: db.foreign.processedBlock});
    
    const onlyInHomeDeposits = homeDeposits.filter(compareDepositsHome(foreignDeposits))
    const onlyInForeignDeposits = foreignDeposits.filter(compareDepositsForeign(homeDeposits))

    const onlyInHomeWithdrawals = homeWithdrawals.filter(compareDepositsForeign(foreignWithdrawals))
    const onlyInForeignWithdrawals = foreignWithdrawals.filter(compareDepositsHome(homeWithdrawals))
    if(foreignWithdrawals.length > 0 || foreignDeposits > 0){
      let withdrawalBlk = foreignWithdrawals[foreignWithdrawals.length - 1] ? foreignWithdrawals[foreignWithdrawals.length - 1].blockNumber : 0
      let depositBlk = foreignDeposits[foreignDeposits.length - 1] ? foreignDeposits[foreignDeposits.length - 1].blockNumber : 0
      db.foreign.processedBlock = Math.max(withdrawalBlk, depositBlk) + 1
    }
    if(homeDeposits.length > 0 || homeWithdrawals.length > 0){
      let withdrawalBlk = homeWithdrawals[homeWithdrawals.length - 1] ? homeWithdrawals[homeWithdrawals.length - 1].blockNumber : 0
      let depositBlk = homeDeposits[homeDeposits.length - 1]? homeDeposits[homeDeposits.length - 1].blockNumber : 0
      db.home.processedBlock = Math.max(withdrawalBlk, depositBlk) + 1
    }

    if(onlyInHomeDeposits.length > 0 ){
      db.home.onlyInHomeDeposits = db.home.onlyInHomeDeposits.concat(onlyInHomeDeposits)
    }
    if(onlyInHomeWithdrawals.length > 0 ){
      db.home.onlyInHomeWithdrawals = db.home.onlyInHomeWithdrawals.concat(onlyInHomeWithdrawals)
    }
    if(onlyInForeignDeposits.length > 0) {
      db.foreign.onlyInForeignDeposits = db.foreign.onlyInForeignDeposits.concat(onlyInForeignDeposits)
    }
    if(onlyInForeignWithdrawals.length > 0) {
      db.foreign.onlyInForeignWithdrawals = db.foreign.onlyInForeignWithdrawals.concat(onlyInForeignWithdrawals)
    }
    db.foreign.deposits += foreignDeposits.length;
    db.home.withdrawals += homeWithdrawals.length;
    db.home.deposits += homeDeposits.length;
    db.foreign.withdrawals += foreignWithdrawals.length;
    
    fs.writeFileSync(__dirname + '/db.json', JSON.stringify(db,null,4));
    return {
      ...db,
      depositsDiff: db.home.deposits - db.foreign.deposits,
      withdrawalDiff: db.home.withdrawals - db.foreign.withdrawals,
      totalUnrelayedDeposits: db.home.onlyInHomeDeposits.length + db.foreign.onlyInForeignDeposits.length,
      totalUnrelayedWithdrawals: db.home.onlyInHomeWithdrawals.length + db.foreign.onlyInForeignWithdrawals.length
    }
  } catch(e) {
    console.error(e);
  }

}
module.exports = main;