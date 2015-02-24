var moment = require("moment")
var logos = require("./logos")

module.exports = require("./data")
  .slice(0,15)
  .map(function(pkg) {

    pkg.version = pkg['dist-tags'].latest
    if (pkg.versions) {
      pkg.version = pkg.versions[pkg.version].version
      pkg.publishedBy = pkg.versions[pkg.version]._npmUser
    }
    pkg.lastPublished = moment(pkg.time[pkg.version]).fromNow()
    delete pkg.versions

    // Add logos
    for (var name in logos) {
      if (name === pkg.name) {
        pkg.logo = logos[name]
      }
    }

    return pkg
  })
