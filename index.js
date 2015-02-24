var logos = require("./logos")

module.exports = require("./data")
  .slice(0,15)
  .map(function(pkg) {

    pkg.version = pkg['dist-tags'].latest
    if (pkg.versions) {
      pkg.version = pkg.versions[pkg.version].version
      pkg.publisher = pkg.versions[pkg.version]._npmUser
    }
    pkg.lastPublishedAt = pkg.time[pkg.version]
    delete pkg.versions

    // Add logos
    for (var name in logos) {
      if (name === pkg.name) {
        pkg.logo = logos[name]
      }
    }

    return pkg
  })
