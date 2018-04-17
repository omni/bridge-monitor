require('dotenv').config();
const express = require('express')
const app = express()
const fs = require('fs')

async function main(){
  try {
    const content = await fs.readFileSync('./results.json');
    return JSON.parse(content)
  } catch(e) {
    console.error(e);
  }

}
main()

app.get('/', async (req, res, next) => {
  try {
    const getBalances = await main();
    res.json(getBalances);
  } catch (e) {
    //this will eventually be handled by your error handling middleware
    next(e) 
  }
})
const port = process.env.PORT || 3000;
app.set('port', port);
app.listen(port, () => console.log('Example app listening on port 3000!'))