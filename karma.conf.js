module.exports = function (config) {
  config.set({
    frameworks: ['browserify', 'detectBrowsers', 'mocha'],
    files: [
      'test/*.js',
      'test/storage/*.js',
      'test/connector/*.js',
      'test/blockchain/*.js'
    ],
    preprocessors: {
      'test/*.js': ['browserify'],
      'test/storage/*.js': ['browserify'],
      'test/connector/*.js': ['browserify'],
      'test/blockchain/*.js': ['browserify']
    },
    singleRun: true,
    plugins: [
      'karma-browserify',
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-detect-browsers',
      'karma-mocha'
    ],
    browserify: {
      debug: true
    },
    detectBrowsers: {
      enabled: true,
      usePhantomJS: false,
      postDetection: function (availableBrowser) {
        if (process.env.TRAVIS) {
          return ['Firefox']
        }

        // var browsers = ['Chrome', 'Firefox']
        var browsers = ['Firefox']
        return browsers.filter(function (browser) {
          return availableBrowser.indexOf(browser) !== -1
        })
      }
    }
  })
}
