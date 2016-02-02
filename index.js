var fs = require('fs')
var path = require('path')
var Promise = require('bluebird')
var redis = require('redis')
var map = require('async').map
var url = require('url')
var xor = require('lodash.xor')

function ExplicitInstalls (cb) {
  return checkCache()
    .then(function (pkgs) {
      return ExplicitInstalls.getPackages()
        .then(function (_pkgs) {
          var cachedPackages = (pkgs || []).map(function (p) {
            return p.name
          })

          if (xor(_pkgs, cachedPackages).length === 0) {
            // we can use the cached packages, since no new
            // packages have been found.
            return pkgs
          } else {
            return ExplicitInstalls.getLogos()
              .then(function (logos) {
                return loadPackageMeta(_pkgs, logos)
              })
          }
        })
    })
    .nodeify(cb)
}

ExplicitInstalls.getPackages = function () {
  return new Promise(function (resolve, reject) {
    fs.readFile(path.resolve(__dirname, './packages.json'), 'utf-8', function (err, packages) {
      if (err) return reject(err)
      else return resolve(JSON.parse(packages))
    })
  })
}

ExplicitInstalls.getLogos = function () {
  return new Promise(function (resolve, reject) {
    fs.readFile(path.resolve(__dirname, './logos.json'), 'utf-8', function (err, logos) {
      if (err) return reject(err)
      else return resolve(JSON.parse(logos))
    })
  })
}

ExplicitInstalls.npmStats = require('npm-stats')
ExplicitInstalls.client = redis.createClient(process.env.REDIS_URL)
ExplicitInstalls.client.on('error', function (err) {
  console.error(err.message)
})
ExplicitInstalls.cacheKey = '__npm_explicit_installs'
ExplicitInstalls.cacheTtl = 36000 * 4 // only reload packages every 4 hours.

function checkCache () {
  return new Promise(function (resolve, reject) {
    // redis client is failing to connect, don't use cache.
    if (!ExplicitInstalls.client.connected) return resolve(null)

    ExplicitInstalls.client.get(ExplicitInstalls.cacheKey, function (err, pkgs) {
      if (err) console.error('failed to read cache:', ExplicitInstalls.cacheKey)
      return resolve(pkgs ? JSON.parse(pkgs) : null)
    })
  })
}

function loadPackageMeta (pkgs, logos) {
  var opts = {}
  // slice the registry database
  // out of our remote URL.
  if (process.env.COUCH_URL_REMOTE) {
    var parsed = url.parse(process.env.COUCH_URL_REMOTE)
    opts.registry = parsed.protocol + '//' + parsed.host
    opts.modules = parsed.path.split('/')[1] || ''
  }
  // if the environment variable exists,
  // configure our package fetching service
  // with a proxy URL.
  if (process.env.PROXY_URL) {
    opts.nano = {
      requestDefaults: {
        proxy: process.env.PROXY_URL
      }
    }
  }

  return new Promise(function (resolve, reject) {
    map(pkgs, function (pkg, cb) {
      ExplicitInstalls.npmStats(opts).module(pkg).info(function (err, info) {
        if (err) {
          console.error('failed to load package:', err.message)
          return cb(null, packageError(pkg))
        }
        return cb(null, info)
      })
    }, function (err, pkgs) {
      if (err) {
        console.error('failed to load package meta formation:', err.message)
        return resolve([])
      }
      else return resolve(mapPkgs(pkgs, logos))
    })
  })
  .then(function (pkgs) {
    return populateCache(pkgs)
  })
}

function populateCache (pkgs) {
  return new Promise(function (resolve, reject) {
    // redis client is failing to connect, don't set cache.
    if (!ExplicitInstalls.client.connected) return resolve(pkgs)

    ExplicitInstalls.client.setex(ExplicitInstalls.cacheKey, ExplicitInstalls.cacheTtl, JSON.stringify(pkgs), function (err) {
      if (err) console.error('failed to cache packages:', ExplicitInstalls.cacheKey)
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

function packageError (pkg) {
  return {
    name: pkg,
    description: 'not found',
    'dist-tags': {
      latest: 'n/a'
    },
    time: {
      'n/a': Date().toString()
    },
    versions: {
      'n/a': {
        _npmUser: {
          name: 'n/a'
        }
      }
    }
  }
}

module.exports = ExplicitInstalls
