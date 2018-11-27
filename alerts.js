require('dotenv').config()
const BN = require('bignumber.js')
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

async function main() {
  try {
    const homeErcBridge = new web3Home.eth.Contract(HOME_ERC_TO_ERC_ABI, HOME_BRIDGE_ADDRESS)
    const bridgeModeHash = await homeErcBridge.methods.getBridgeMode().call()
    const bridgeMode = decodeBridgeMode(bridgeModeHash)
    const { HOME_ABI, FOREIGN_ABI } = getBridgeABIs(bridgeMode)
    const hasForeignErc = bridgeMode === BRIDGE_MODES.ERC_TO_ERC || bridgeMode === BRIDGE_MODES.ERC_TO_NATIVE
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

    const xSignatures = foreignDeposits.filter(findDifferences(homeDeposits))
    const xAffirmations = homeWithdrawals.filter(findDifferences(foreignWithdrawals))

    logger.debug("building misbehavior blocks")
    const getBlockNumber = web3 => web3.eth.getBlockNumber()
    const toBN = n => new BN(n)
    const [ foreignBlockNumber, homeBlockNumber ] = (await Promise.all([web3Foreign, web3Home].map(getBlockNumber))).map(toBN)

    const xSignaturesMisbehavior = buildRangesObject(xSignatures.map(findMisbehaviorRange(foreignBlockNumber)).reduce(mergeRanges))
    const xAffirmationsMisbehavior = buildRangesObject(xAffirmations.map(findMisbehaviorRange(homeBlockNumber)).reduce(mergeRanges))

    logger.debug("extracting most recent transactionHash")
    const { transactionHash: xSignaturesMostRecentTxHash } = xSignatures.sort(sortEvents).reverse()[0]
    const { transactionHash: xAffirmationsMostRecentTxHash } = xAffirmations.sort(sortEvents).reverse()[0]

    logger.debug("building transaction objects")
    const foreignValidators = await Promise.all(xSignatures.map(event => findTxSender(web3Foreign)(event)))
    const homeValidators = await Promise.all(xAffirmations.map(event => findTxSender(web3Home)(event)))

    const xSignaturesTxs = xSignatures.map(normalizeEventInformation).reduce(buildTxList(foreignValidators), {})
    const xAffirmationsTxs = xAffirmations.map(normalizeEventInformation).reduce(buildTxList(homeValidators), {})

    logger.debug('Done')

    return {
      executeSignatures: {
        misbehavior: xSignaturesMisbehavior,
        mostRecentTxHash: xSignaturesMostRecentTxHash,
        transactions: xSignaturesTxs
      },
      executeAffirmations: {
        misbehavior: xAffirmationsMisbehavior,
        mostRecentTxHash: xAffirmationsMostRecentTxHash,
        transactions: xAffirmationsTxs
      },
      lastChecked: Math.floor(Date.now() / 1000)
    }
  } catch (e) {
    logger.error(e)
    throw e
  }
}

/**
 * Finds the location for the blockNumber in a specific range starting from currentBlockNumber
 * @param {BigNumber} currentBlockNumber
 * @returns {function({blockNumber?: *}): boolean[]}
 */
const findMisbehaviorRange = currentBlockNumber => ({ blockNumber }) => {
  const minus60 = currentBlockNumber.minus(60)
  const minus180 = currentBlockNumber.minus(180)
  const minus720 = currentBlockNumber.minus(720)
  const minus17280 = currentBlockNumber.minus(17280)

  return [
    minus60.lte(blockNumber),
    minus180.lte(blockNumber) && minus60.gt(blockNumber),
    minus720.lte(blockNumber) && minus180.gt(blockNumber),
    minus17280.lte(blockNumber) && minus720.gt(blockNumber),
    minus17280.gt(blockNumber)
  ]
}

/**
 * Merges range arrays into one single array
 * @param {Array} acc
 * @param {Array} range
 * @returns {Array}
 */
const mergeRanges = (acc, range) => acc.map((item, index) => item || range[index])

/**
 * Converts an array of boolean into the object representation of the ranges
 * @param {Array} range
 * @returns {{
 *  last60blocks: *,
 *  last60to180blocks: *,
 *  last180to720blocks: *,
 *  last720to17280blocks: *,
 *  last17280blocks: *
 * }}
 */
const buildRangesObject = range => ({
  last60blocks: range[0],
  last60to180blocks: range[1],
  last180to720blocks: range[2],
  last720to17280blocks: range[3],
  last17280blocks: range[4]
})

/**
 * Sorts events by blockNumber from oldest to newest
 * @param {Object} prev
 * @param {Object} next
 * @returns {number}
 */
const sortEvents = ({ blockNumber: prev }, { blockNumber: next }) => prev - next

/**
 * Retrieves the transaction object and returns the 'from' key from it using the provided web3 instance
 * @param {Object} web3
 * @returns {function({transactionHash?: *}): Transaction.from}
 */
const findTxSender = web3 => async ({ transactionHash }) => {
  const { from } = await web3.eth.getTransaction(transactionHash)
  return from
}

/**
 * Builds a list of transactions information using the txHash as key
 * _validatorsList_ is a correlative list of validators addresses for each event processed
 * @param {Array} validatorsList
 * @returns {{acc[event.txHash]: {
 *  value: string,
 *  block: number,
 *  referenceTx: string,
 *  recipient: string,
 *  validator: string
 * }}}
 */
const buildTxList = validatorsList => (acc, event, index) => {
  acc[event.txHash] = {
    value: event.value,
    block: event.blockNumber,
    referenceTx: event.referenceTx,
    recipient: event.recipient,
    validator: validatorsList[index]
  }
  return acc
}

/**
 * Finds a missing destDeposit in src list if there's any
 * @param {Array} src
 * @returns {function(*=): boolean}
 */
const findDifferences = src => dest => {
  const b = normalizeEventInformation(dest)

  return src
    .map(normalizeEventInformation)
    .filter(a => a.referenceTx === b.referenceTx && a.recipient === b.recipient && a.value === b.value).length === 0
}

/**
 * Normalizes the different event objects to facilitate data processing
 * @param {Object} event
 * @returns {{
 *  txHash: string,
 *  blockNumber: number,
 *  referenceTx: string,
 *  recipient: string | *,
 *  value: *
 * }}
 */
const normalizeEventInformation = event => ({
  txHash: event.transactionHash,
  blockNumber: event.blockNumber,
  referenceTx: event.returnValues.transactionHash || event.transactionHash,
  recipient: event.returnValues.recipient || event.returnValues.from,
  value: event.returnValues.value
})

module.exports = main
