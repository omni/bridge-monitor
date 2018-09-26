require('dotenv').config()
const Web3 = require('web3')
const logger = require('./logger')('eventsStats')
const { BRIDGE_MODES, decodeBridgeMode, getBridgeABIs } = require('./utils/bridgeMode')

const {
  HOME_RPC_URL,
  FOREIGN_RPC_URL,
  HOME_BRIDGE_ADDRESS,
  FOREIGN_BRIDGE_ADDRESS,
  ERC20_ADDRESS
} = process.env
const HOME_DEPLOYMENT_BLOCK = Number(process.env.HOME_DEPLOYMENT_BLOCK) || 0
const FOREIGN_DEPLOYMENT_BLOCK = Number(process.env.FOREIGN_DEPLOYMENT_BLOCK) || 0

const homeProvider = new Web3.providers.HttpProvider(HOME_RPC_URL)
const web3Home = new Web3(homeProvider)

const foreignProvider = new Web3.providers.HttpProvider(FOREIGN_RPC_URL)
const web3Foreign = new Web3(foreignProvider)

const HOME_ERC_TO_ERC_ABI = require('./abis/HomeBridgeErcToErc.abi')
const ERC20_ABI = require('./abis/ERC20.abi')

function compareDepositsHome(foreign) {
  return homeDeposit => {
    return (
      foreign.filter(foreignDeposit => {
        return (
          foreignDeposit.returnValues.transactionHash === homeDeposit.transactionHash &&
          foreignDeposit.returnValues.recipient === homeDeposit.returnValues.recipient &&
          foreignDeposit.returnValues.value === homeDeposit.returnValues.value
        )
      }).length === 0
    )
  }
}
function compareDepositsForeign(home) {
  return foreignDeposit => {
    return (
      home.filter(homeDeposit => {
        return (
          homeDeposit.transactionHash === foreignDeposit.returnValues.transactionHash &&
          homeDeposit.returnValues.recipient === foreignDeposit.returnValues.recipient &&
          homeDeposit.returnValues.value === foreignDeposit.returnValues.value
        )
      }).length === 0
    )
  }
}

function compareTransferHome(foreign) {
  return homeDeposit => {
    return (
      foreign.filter(foreignDeposit => {
        return (
          homeDeposit.returnValues.transactionHash === foreignDeposit.transactionHash &&
          homeDeposit.returnValues.recipient === foreignDeposit.returnValues.from &&
          homeDeposit.returnValues.value === foreignDeposit.returnValues.value
        )
      }).length === 0
    )
  }
}
function compareTransferForeign(home) {
  return foreignDeposit => {
    return (
      home.filter(homeDeposit => {
        return (
          foreignDeposit.transactionHash === homeDeposit.returnValues.transactionHash &&
          foreignDeposit.returnValues.from === homeDeposit.returnValues.recipient &&
          foreignDeposit.returnValues.value === homeDeposit.returnValues.value
        )
      }).length === 0
    )
  }
}

async function main() {
  try {
    const homeErcBridge = new web3Home.eth.Contract(HOME_ERC_TO_ERC_ABI, HOME_BRIDGE_ADDRESS)
    const bridgeModeHash = await homeErcBridge.methods.getBridgeMode().call()
    const bridgeMode = decodeBridgeMode(bridgeModeHash)
    const { HOME_ABI, FOREIGN_ABI } = getBridgeABIs(bridgeMode)
    const hasForeignErc =
      bridgeMode === BRIDGE_MODES.ERC_TO_ERC || bridgeMode === BRIDGE_MODES.ERC_TO_NATIVE
    const homeBridge = new web3Home.eth.Contract(HOME_ABI, HOME_BRIDGE_ADDRESS)
    const foreignBridge = new web3Foreign.eth.Contract(FOREIGN_ABI, FOREIGN_BRIDGE_ADDRESS)
    const erc20Contract = new web3Foreign.eth.Contract(ERC20_ABI, ERC20_ADDRESS)
    logger.debug("calling homeBridge.getPastEvents('UserRequestForSignature')")
    const homeDeposits = await homeBridge.getPastEvents('UserRequestForSignature', {
      fromBlock: HOME_DEPLOYMENT_BLOCK
    })
    logger.debug("calling foreignBridge.getPastEvents('RelayedMessage')")
    const foreignDeposits = await foreignBridge.getPastEvents('RelayedMessage', {
      fromBlock: FOREIGN_DEPLOYMENT_BLOCK
    })
    logger.debug("calling homeBridge.getPastEvents('AffirmationCompleted')")
    const homeWithdrawals = await homeBridge.getPastEvents('AffirmationCompleted', {
      fromBlock: HOME_DEPLOYMENT_BLOCK
    })
    logger.debug("calling foreignBridge.getPastEvents('UserRequestForAffirmation')")
    const foreignWithdrawals = hasForeignErc
      ? await erc20Contract.getPastEvents('Transfer', {
          fromBlock: FOREIGN_DEPLOYMENT_BLOCK,
          filter: { to: FOREIGN_BRIDGE_ADDRESS }
        })
      : await foreignBridge.getPastEvents('UserRequestForAffirmation', {
          fromBlock: FOREIGN_DEPLOYMENT_BLOCK
        })

    const onlyInHomeDeposits = homeDeposits.filter(compareDepositsHome(foreignDeposits))
    const onlyInForeignDeposits = foreignDeposits
      .concat([])
      .filter(compareDepositsForeign(homeDeposits))

    const onlyInHomeWithdrawals = hasForeignErc
      ? homeWithdrawals.filter(compareTransferHome(foreignWithdrawals))
      : homeWithdrawals.filter(compareDepositsForeign(foreignWithdrawals))
    const onlyInForeignWithdrawals = hasForeignErc
      ? foreignWithdrawals.filter(compareTransferForeign(homeWithdrawals))
      : foreignWithdrawals.filter(compareDepositsHome(homeWithdrawals))

    logger.debug('Done')
    return {
      onlyInHomeDeposits,
      onlyInForeignDeposits,
      onlyInHomeWithdrawals,
      onlyInForeignWithdrawals,
      lastChecked: Math.floor(Date.now() / 1000)
    }
  } catch (e) {
    logger.error(e)
    throw e
  }
}

module.exports = main
