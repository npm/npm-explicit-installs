/* global describe it after beforeEach, before */

var npmExplicitInstalls = require('../')
var clearRequire = require('clear-require')
var expect = require('chai').expect
var fs = require('fs')
var redis = require('redis')

require('chai').should()
console.error = function () {}

// mock require('npm-stats').module('lodash').info(cb).
function mockNpmStats (npmExplicitInstalls, error) {
  var data = JSON.parse(fs.readFileSync('./test/fixtures/data.json', 'utf-8'))

  npmExplicitInstalls.npmStats = function (opts) {
    return {
      module: function (module) {
        return {
          info: function (cb) {
            if (error) return cb(error)

            var pkg = data.filter(function (p) {
              return p.name === module
            })[0]
            return cb(null, pkg)
          }
        }
      }
    }
  }
}

function mockFs (npmExplicitInstalls, mockPath, contents) {
  npmExplicitInstalls.fs = {
    readFile: function (path, encoding, cb) {
      if (path.indexOf(mockPath) === -1) return fs.readFile(path, encoding, cb)
      if (typeof contents !== 'string') return cb(contents)
      else return cb(null, contents)
    }
  }
}

function mockGetPackages (npmExplicitInstalls, packages) {
  var original = npmExplicitInstalls.getPackages

  npmExplicitInstalls.getPackages = function () {
    return new Promise(function (resolve, reject) {
      process.nextTick(function () {
        resolve(packages)
      })
    })
  }

  return function reset () {
    npmExplicitInstalls.getPackages = original
  }
}

describe('npm-explicit-installs', function () {
  describe('redis is down', function () {
    before(function () {
      process.env.REDIS_URL = 'redis://fake:9999'
      clearRequire('../')
      npmExplicitInstalls = require('../')
      mockNpmStats(npmExplicitInstalls)
    })

    it('returns a list of packages', function (done) {
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
      mockNpmStats(npmExplicitInstalls)
    })
    beforeEach(function (done) {
      mockNpmStats(npmExplicitInstalls)
      clean(done)
    })
    after(clean)

    it("loads package data from the registry, if it's fallen out of cache", function (done) {
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

      var reset = mockGetPackages(npmExplicitInstalls, ['batman'])

      npmExplicitInstalls.client.set(npmExplicitInstalls.cacheKey, JSON.stringify(pkgsCached), function (err) {
        expect(err).to.equal(null)
        npmExplicitInstalls(function (err, pkgs) {
          reset()
          expect(err).to.equal(null)
          pkgs.should.deep.equal(pkgsCached)
          return done()
        })
      })
    })

    it('skips cache if cache contains invalid JSON', function (done) {
      npmExplicitInstalls.client.set(npmExplicitInstalls.cacheKey, '{"name":', function (err) {
        expect(err).to.equal(null)
        npmExplicitInstalls(function (err, pkgs) {
          expect(err).to.equal(null)
          var gruntCli = pkgs[1]
          gruntCli.name.should.equal('grunt-cli')
          gruntCli.version.should.equal('0.1.13')
          gruntCli.logo.should.equal('https://i.cloudup.com/bDkmXyEmr5.png')
          return done()
        })
      })
    })

    it('does not use cache if list of packages has changed', function (done) {
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
          var gruntCli = pkgs[1]
          gruntCli.name.should.equal('grunt-cli')
          gruntCli.version.should.equal('0.1.13')
          gruntCli.logo.should.equal('https://i.cloudup.com/bDkmXyEmr5.png')
          return done()
        })
      })
    })

    it('returns a list of packages if redis dies', function (done) {
      var client = redis.createClient()
      var original = npmExplicitInstalls.client
      npmExplicitInstalls.client = client

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

    describe('bustCache', function () {
      it('deletes entry in redis', function (done) {
        npmExplicitInstalls.client.set(npmExplicitInstalls.cacheKey, JSON.stringify({}), function (err) {
          expect(err).to.equal(null)
          npmExplicitInstalls.bustCache(function (err) {
            expect(err).to.equal(null)
            npmExplicitInstalls.client.get(npmExplicitInstalls.cacheKey, function (err, res) {
              expect(err).to.equal(null)
              expect(res).to.equal(null)
              return done()
            })
          })
        })
      })
    })

    after(function () { npmExplicitInstalls.client.end() })
  })

  describe('package service is down', function () {
    it('populates packages with the default packageError object', function (done) {
      mockNpmStats(npmExplicitInstalls, Error("i have no idea what I'm doing"))
      npmExplicitInstalls(function (err, pkgs) {
        expect(err).to.equal(null)
        pkgs[0].description.should.equal('not found')
        return done()
      })
    })
  })

  describe('bad files', function () {
    it('handles bad packages.json having been written to disk', function (done) {
      mockFs(npmExplicitInstalls, 'packages.json', '{"foo":')
      npmExplicitInstalls(function (err, pkgs) {
        expect(err).to.equal(null)
        pkgs.length.should.eq(0)
        return done()
      })
    })

    it('handles reading packages.json thowing error', function (done) {
      mockFs(npmExplicitInstalls, 'packages.json', Error('i have no idea what i am doing'))
      npmExplicitInstalls(function (err, pkgs) {
        expect(err).to.equal(null)
        pkgs.length.should.eq(0)
        return done()
      })
    })

    it('handles bad logos.json having been written to disk', function (done) {
      mockFs(npmExplicitInstalls, 'logos.json', '{"foo":')
      npmExplicitInstalls(function (err, logos) {
        expect(err).to.equal(null)
        Array.isArray(logos).should.equal(true)
        return done()
      })
    })

    it('handles reading logos.json thowing error', function (done) {
      mockFs(npmExplicitInstalls, 'logos.json', Error('i have no idea what i am doing'))
      npmExplicitInstalls(function (err, logos) {
        expect(err).to.equal(null)
        Array.isArray(logos).should.equal(true)
        return done()
      })
    })
  })
})
