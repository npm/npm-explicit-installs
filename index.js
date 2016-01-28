var packages = require('./packages')
var logos = require('./logos')
var Promise = require('bluebird')
var redis = require('redis')

function ExplicitInstalls (cb) {
  return checkCache()
    .then(function (pkgs) {
      if (pkgs) {
        return pkgs
      } else {
        return ExplicitInstalls.getPackages()
          .then(function (_pkgs) {
            pkgs = _pkgs
            return ExplicitInstalls.getLogos()
          })
          .then(function (logos) {
            return loadPackageMeta(pkgs, logos)
          })
      }
    })
    .nodeify(cb)
}

ExplicitInstalls.getPackages = function (cb) {
  return new Promise(function (resolve, reject) {
    process.nextTick(function () {
      resolve(packages)
    })
  })
}

ExplicitInstalls.getLogos = function (cb) {
  return new Promise(function (resolve, reject) {
    process.nextTick(function () {
      resolve(logos)
    })
  })
}

ExplicitInstalls.pkgs = require('pkgs')
ExplicitInstalls.client = redis.createClient(process.env.REDIS_URL)
ExplicitInstalls.cacheKey = '__npm_explicit_installs'
ExplicitInstalls.cacheTtl = 36000 // only reload packages every hour.

function checkCache () {
  return new Promise(function (resolve, reject) {
    ExplicitInstalls.client.get(ExplicitInstalls.cacheKey, function (err, pkgs) {
      if (err) console.error('failed to read cache', ExplicitInstalls.cacheKey)
      return resolve(pkgs ? JSON.parse(pkgs) : null)
    })
  })
}

function loadPackageMeta (pkgs, logos) {
  return new Promise(function (resolve, reject) {
    ExplicitInstalls.pkgs(pkgs, function (err, pkgs) {
      if (err) return reject(err)
      else return resolve(mapPkgs(pkgs, logos))
    })
  })
  .then(function (pkgs) {
    return populateCache(pkgs)
  })
}

function populateCache (pkgs) {
  return new Promise(function (resolve, reject) {
    ExplicitInstalls.client.setex(ExplicitInstalls.cacheKey, ExplicitInstalls.cacheTtl, JSON.stringify(pkgs), function (err) {
      if (err) console.error('failed to cache packages to', ExplicitInstalls.cacheKey)
      return resolve(pkgs)
    })
  })
}

/*
  Make pkgs match the format expected by newww:
    {{name}}
    {{version}}
    {{description}}
    {{version}}
    {{lastPublishedAt}}
    {{publisher.name}}
*/
function mapPkgs (pkgs, logos) {
  return pkgs.map(function (pkg) {
    var version = pkg['dist-tags'].latest

    return {
      name: pkg.name,
      description: pkg.description,
      version: version,
      lastPublishedAt: pkg.time[version],
      publisher: pkg.versions[version]._npmUser,
      logo: logos[pkg.name]
    }
  })
}

module.exports = ExplicitInstalls
