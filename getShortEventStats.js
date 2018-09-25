require('dotenv').config()
const Web3 = require('web3')
const logger = require('./logger')('getShortEventStats.js')
const { BRIDGE_MODES } = require('./utils/bridgeMode')

const {
  HOME_RPC_URL,
  FOREIGN_RPC_URL,
  HOME_BRIDGE_ADDRESS,
  FOREIGN_BRIDGE_ADDRESS,
  POA20_ADDRESS
} = process.env
const HOME_DEPLOYMENT_BLOCK = Number(process.env.HOME_DEPLOYMENT_BLOCK) || 0
const FOREIGN_DEPLOYMENT_BLOCK = Number(process.env.FOREIGN_DEPLOYMENT_BLOCK) || 0

const homeProvider = new Web3.providers.HttpProvider(HOME_RPC_URL)
const web3Home = new Web3(homeProvider)

const foreignProvider = new Web3.providers.HttpProvider(FOREIGN_RPC_URL)
const web3Foreign = new Web3(foreignProvider)

const HOME_NATIVE_ABI = require('./abis/HomeBridgeNativeToErc.abi')
const FOREIGN_NATIVE_ABI = require('./abis/ForeignBridgeNativeToErc.abi')
const HOME_ERC_ABI = require('./abis/HomeBridgeErcToErc.abi')
const FOREIGN_ERC_ABI = require('./abis/ForeignBridgeErcToErc.abi')
const HOME_ERC_TO_NATIVE_ABI = require('./abis/HomeBridgeErcToNative.abi')
const FOREIGN_ERC_TO_NATIVE_ABI = require('./abis/ForeignBridgeErcToNative.abi')
const ERC20_ABI = require('./abis/ERC20.abi')
const BRIDGE_VALIDATORS_ABI = require('./abis/BridgeValidators.abi')

async function main(bridgeMode) {
  try {
    let HOME_ABI = null
    let FOREIGN_ABI = null
    if (bridgeMode === BRIDGE_MODES.NATIVE_TO_ERC) {
      HOME_ABI = HOME_NATIVE_ABI
      FOREIGN_ABI = FOREIGN_NATIVE_ABI
    } else if (bridgeMode === BRIDGE_MODES.ERC_TO_ERC) {
      HOME_ABI = HOME_ERC_ABI
      FOREIGN_ABI = FOREIGN_ERC_ABI
    } else if (bridgeMode === BRIDGE_MODES.ERC_TO_NATIVE) {
      HOME_ABI = HOME_ERC_TO_NATIVE_ABI
      FOREIGN_ABI = FOREIGN_ERC_TO_NATIVE_ABI
    } else {
      throw new Error(`Unrecognized bridge mode: ${bridgeMode}`)
    }
    const homeBridge = new web3Home.eth.Contract(HOME_ABI, HOME_BRIDGE_ADDRESS)
    const foreignBridge = new web3Foreign.eth.Contract(FOREIGN_ABI, FOREIGN_BRIDGE_ADDRESS)
    const erc20Contract = new web3Foreign.eth.Contract(ERC20_ABI, POA20_ADDRESS)
    logger.debug('calling homeBridge.methods.validatorContract().call()')
    const validatorHomeAddress = await homeBridge.methods.validatorContract().call()
    logger.debug('calling foreignBridge.methods.validatorContract().call()')
    const validatorForeignAddress = await foreignBridge.methods.validatorContract().call()
    const homeValidators = new web3Home.eth.Contract(BRIDGE_VALIDATORS_ABI, validatorHomeAddress)
    const foreignValidators = new web3Foreign.eth.Contract(
      BRIDGE_VALIDATORS_ABI,
      validatorForeignAddress
    )
    logger.debug('calling homeValidators.methods.requiredSignatures().call()')
    const reqSigHome = await homeValidators.methods.requiredSignatures().call()
    logger.debug('calling foreignValidators.methods.requiredSignatures().call()')
    const reqSigForeign = await foreignValidators.methods.requiredSignatures().call()
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
    const foreignWithdrawals =
      bridgeMode === BRIDGE_MODES.ERC_TO_ERC || bridgeMode === BRIDGE_MODES.ERC_TO_NATIVE
        ? await erc20Contract.getPastEvents('Transfer', {
            fromBlock: FOREIGN_DEPLOYMENT_BLOCK,
            filter: { to: FOREIGN_BRIDGE_ADDRESS }
          })
        : await foreignBridge.getPastEvents('UserRequestForAffirmation', {
            fromBlock: FOREIGN_DEPLOYMENT_BLOCK
          })
    logger.debug('Done')
    return {
      depositsDiff: homeDeposits.length - foreignDeposits.length,
      withdrawalDiff: homeWithdrawals.length - foreignWithdrawals.length,
      home: {
        deposits: homeDeposits.length,
        withdrawals: homeWithdrawals.length,
        requiredSignatures: Number(reqSigHome)
      },
      foreign: {
        deposits: foreignDeposits.length,
        withdrawals: foreignWithdrawals.length,
        requiredSignatures: Number(reqSigForeign)
      },
      requiredSignaturesMatch: reqSigHome === reqSigForeign
    }
  } catch (e) {
    logger.error(e)
    throw e
  }
}
module.exports = main
