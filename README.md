# Bridge Monitor

This tools allows you to spin up node.js server to monitor for 2 contracts on
Home and Foreign Eth networks to check for balance difference.
On Home network it checks for `HOME_BRIDGE_ADDRESS` balance
On Foreign network it checks for `POA20_ADDRESS` total supply.

Example of an API `/`:

```json
{
    "homeBalance": "4.7021411",
    "foreignTotalSupply": "4.7021411",
    "diff": "0",
    "lastChecked": 1523932521
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
