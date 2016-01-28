/* global describe it after beforeEach */

var npmExplicitInstalls = require('../')
var expect = require('chai').expect
var fs = require('fs')

require('chai').should()

describe('npm-explicit-installs', function () {
  beforeEach(function (done) {
    npmExplicitInstalls.client.del(npmExplicitInstalls.cacheKey, function (err) {
      return done(err)
    })
  })

  it("loads package data from the registry, if it's fallen out of cache", function (done) {
    npmExplicitInstalls.pkgs = function (pkgs, cb) {
      return cb(null, JSON.parse(
        fs.readFileSync('./test/fixtures/data.json', 'utf-8')
      ))
    }
    npmExplicitInstalls(function (err, pkgs) {
      expect(err).to.equal(null)
      var gruntCli = pkgs[1]
      gruntCli.name.should.equal('grunt-cli')
      gruntCli.version.should.equal('0.1.13')
      gruntCli.logo.should.equal('https://i.cloudup.com/bDkmXyEmr5.png')
      return done()
    })
  })

  it('populates cache', function (done) {
    npmExplicitInstalls.pkgs = function (pkgs, cb) {
      return cb(null, JSON.parse(
        fs.readFileSync('./test/fixtures/data.json', 'utf-8')
      ))
    }
    npmExplicitInstalls(function (err, pkgs) {
      expect(err).to.equal(null)
      npmExplicitInstalls.client.get(npmExplicitInstalls.cacheKey, function (err, pkgsCached) {
        expect(err).to.equal(null)
        pkgsCached = JSON.parse(pkgsCached)
        var gruntCli = pkgsCached[1]
        gruntCli.name.should.equal('grunt-cli')
        gruntCli.version.should.equal('0.1.13')
        gruntCli.logo.should.equal('https://i.cloudup.com/bDkmXyEmr5.png')
        return done()
      })
    })
  })

  it('uses cache if it is populated', function (done) {
    var pkgsCached = [
      {
        name: 'batman',
        version: '1.0.0',
        description: 'grumpy detective'
      }
    ]

    npmExplicitInstalls.client.set(npmExplicitInstalls.cacheKey, JSON.stringify(pkgsCached), function (err) {
      expect(err).to.equal(null)
      npmExplicitInstalls(function (err, pkgs) {
        expect(err).to.equal(null)
        pkgs.should.deep.equal(pkgsCached)
        return done()
      })
    })
  })

  after(function () { npmExplicitInstalls.client.end() })
})
