#!/usr/bin/env node

var chalk = require('chalk')
var fs = require('fs')
var path = require('path')
var inquirer = require('inquirer')

require('yargs')
  .usage('$0 <cmd> [options]')
  .command('dry-run', 'show the packages that would be displayed on the home page', function () {
    var npmExplicitInstalls = require('../')
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
    var packages = require('../packages')
    inquirer.prompt({
      name: 'package',
      message: 'remove package from homepage',
      type: 'list',
      choices: packages,
    }, function (answer) {
      packages.splice(packages.indexOf(answer.package), 1)
      fs.writeFileSync(path.resolve(__dirname, '../packages.json'), JSON.stringify(packages, null, 2), 'utf-8')
    })
  })
  .command('add', 'add a new package to the home page', function () {
    var packages = require('../packages')
    var logos = require('../logos')

    inquirer.prompt([
      {
        name: 'package',
        message: 'name of package to add',
        validate: function (input) {
          if (!input.length) return 'you must provide a package name'
          else return true
        }
      },
      {
        name: 'logo',
        message: 'url of icon to use for package (optional)'
      }
    ], function (answer) {
      if (answer.logo) {
        logos[answer.package] = answer.logo
        fs.writeFileSync(path.resolve(__dirname, '../logos.json'), JSON.stringify(logos, null, 2), 'utf-8')
      }
      packages.push(answer.package)
      fs.writeFileSync(path.resolve(__dirname, '../packages.json'), JSON.stringify(packages, null, 2), 'utf-8')
    })
  })
  .help('help')
  .alias('h', 'help')
  .demand(1, 'you must provide a command to run')
  .argv
