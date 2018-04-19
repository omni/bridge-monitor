require('dotenv').config();
const express = require('express')
const app = express()
const fs = require('fs')

async function readFile(path){
  try {
    const content = await fs.readFileSync(path);
    return JSON.parse(content)
  } catch(e) {
    console.error(e);
    return {
      error: "please check your worker"
    }
  }
}

app.get('/', async (req, res, next) => {
  try {
    const results = await readFile('./responses/getBalances.json');
    res.json(results);
  } catch (e) {
    //this will eventually be handled by your error handling middleware
    next(e) 
  }
})

app.get('/validators', async (req, res, next) => {
  try {
    const results = await readFile('./responses/validators.json');
    res.json(results);
  } catch (e) {
    //this will eventually be handled by your error handling middleware
    next(e) 
  }
})

const port = process.env.PORT || 3000;
app.set('port', port);
app.listen(port, () => console.log('Monitoring app listening on port 3000!'))