#!/usr/bin/env node
import { main } from '../dist/cli.js'
main(process.argv.slice(2))
  .then(code => { process.exitCode = code })
  .catch(err => {
    console.error(`asset-sweep: ${err.message}`)
    process.exitCode = 2
  })
