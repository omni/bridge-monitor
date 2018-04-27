# Bridge Monitor
Deployed version:
https://bridge-monitoring.poa.net/

This tools allows you to spin up node.js server to monitor for 2 contracts on
Home and Foreign Eth networks to check for balance difference.
On Home network it checks for `HOME_BRIDGE_ADDRESS` balance
On Foreign network it checks for `POA20_ADDRESS` total supply.

Example of an API `/`:

```json

{
  "home": {
    "balance": "145.589637026290448384",
    "deposits": 7641,
    "withdrawals": 128
  },
  "foreign": {
    "totalSupply": "164.0563811",
    "deposits": 7642,
    "withdrawals": 125
  },
  "balanceDiff": -18.466744073709553,
  "lastChecked": 1524872762,
  "depositsDiff": -1,
  "withdrawalDiff": 3,
  "timeDiff": 20
}
```
/validators
```json
{
  "home": {
    "validators": {
      "0xb8988B690910913c97A090c3a6f80FAD8b3A4683": {
        "balance": "123.835674629",
        "leftTx": 412785582096666,
        "gasPrice": 1
      }
    }
  },
  "foreign": {
    "validators": {
      "0xb8988B690910913c97A090c3a6f80FAD8b3A4683": {
        "balance": "10.523898627992509332",
        "leftTx": 17539,
        "gasPrice": 2
      }
    }
  },
  "lastChecked": 1524872829,
  "timeDiff": 17
}
```

# How to run
Create .env file
```bash
HOME_RPC_URL=https://sokol.poa.network
FOREIGN_RPC_URL=https://kovan.infura.io/mew
HOME_BRIDGE_ADDRESS=0xABb4C1399DcC28FBa3Beb76CAE2b50Be3e087353
FOREIGN_BRIDGE_ADDRESS=0xE405F6872cE38a7a4Ff63DcF946236D458c2ca3a
POA20_ADDRESS=0x6F794fb14d01f7551C1fe5614FDDf5895A2e82d3
GAS_PRICE_SPEED_TYPE=standard
GAS_LIMIT=300000
```

```bash
npm i
node checkWorker.js
node index.js
```

You can create cron job to run worker:
```bash
crontab -e
* * * * * cd /bridge-monitor; node /bridge-monitor/checkWorker.js
```
