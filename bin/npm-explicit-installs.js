#!/usr/bin/env node

var npmExplicitInstalls = require('../')
var chalk = require('chalk')

require('yargs')
  .usage('$0 <cmd> [options]')
  .command('dry-run', 'show the packages that would be displayed on the home page', function () {
    npmExplicitInstalls.client.on('connect', function () {
      npmExplicitInstalls(function (err, pkgs) {
        if (err) {
          console.log(chalk.red(err.message))
          return
        }

        pkgs.forEach(function (pkg) {
          console.log(chalk.green(pkg.name), '(' + pkg.version + ')', chalk.gray(pkg.publisher.name))
        })
        npmExplicitInstalls.client.end()
      })
    })
  })
  .command('delete', 'delete packages from the home page', function () {
  })
  .help('help')
  .alias('h', 'help')
  .demand(1, 'you must provide a command to run')
  .argv
