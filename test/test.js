/* global describe it after beforeEach, before */

var npmExplicitInstalls = null
var clearRequire = require('clear-require')
var expect = require('chai').expect
var fs = require('fs')
var redis = require('redis')

require('chai').should()
console.error = function() {}

describe('npm-explicit-installs', function () {
  describe('redis is down', function () {
    before(function () {
      process.env.REDIS_URL = 'redis://fake:9999'
      npmExplicitInstalls = require('../')
    })

    it('returns a list of packages', function (done) {
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

    after(function () { npmExplicitInstalls.client.end() })
  })

  describe('redis is up', function () {
    function clean (done) {
      npmExplicitInstalls.client.del(npmExplicitInstalls.cacheKey, function (err) {
        return done(err)
      })
    }
    before(function () {
      delete process.env.REDIS_URL
      clearRequire('../')
      npmExplicitInstalls = require('../')
    })
    beforeEach(clean)
    after(clean)

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

    it('returns a list of packages if redis dies', function (done) {
      var client = redis.createClient()
      var original = npmExplicitInstalls.client
      npmExplicitInstalls.client = client
      npmExplicitInstalls.pkgs = function (pkgs, cb) {
        return cb(null, JSON.parse(
          fs.readFileSync('./test/fixtures/data.json', 'utf-8')
        ))
      }

      client.end()
      npmExplicitInstalls(function (err, pkgs) {
        npmExplicitInstalls.client = original
        expect(err).to.equal(null)
        var gruntCli = pkgs[1]
        gruntCli.name.should.equal('grunt-cli')
        gruntCli.version.should.equal('0.1.13')
        gruntCli.logo.should.equal('https://i.cloudup.com/bDkmXyEmr5.png')
        return done()
      })
    })

    after(function () { npmExplicitInstalls.client.end() })
  })

  describe('package service is down', function () {
    it('resolves an empty array of packages', function () {
      npmExplicitInstalls.pkgs = function (pkgs, cb) {
        return cb(Error("i hame no idea what I'm doing"))
      }
      npmExplicitInstalls(function (err, pkgs) {
        expect(err).to.equal(null)
        expect(pkgs).to.deep.equal([])
        return done()
      })
    })
  })
})
