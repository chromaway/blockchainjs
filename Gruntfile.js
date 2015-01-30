module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    browserify: {
      production: {
        src: ['src/index.js'],
        dest: 'build/blockchainjs.js',
        options: {
          browserifyOptions: {
            standalone: 'blockchainjs'
          }
        }
      },
      test: {
        src: ['test/**/*.js'],
        dest: 'build/blockchainjs.test.js'
      }
    },
    clean: {
      builds: {
        src: ['build']
      }
    },
    jshint: {
      src: ['Gruntfile.js', 'src/**/*.js', 'test/**/*.js'],
      options: {
        jshintrc: true,
        reporter: require('jshint-stylish')
      }
    },
    jscs: {
      src: ['Gruntfile.js', 'src/**/*.js', 'test/**/*.js'],
      options: {
        config: '.jscsrc'
      }
    },
    mocha_istanbul: {
      coverage: {
        src: 'test',
        options: {
          mask: '**/*.js',
          reporter: 'spec',
          timeout: 20000
        }
      },
      coveralls: {
        src: 'test',
        options: {
          coverage: true,
          mask: '**/*.js',
          reporter: 'spec',
          timeout: 20000
        }
      }
    },
    mochaTest: {
      test: {
        src: ['test/**/*.js'],
        options: {
          reporter: 'spec',
          timeout: 20000
        }
      }
    },
    uglify: {
      production: {
        files: {
          'build/blockchainjs.min.js': 'build/blockchainjs.js'
        }
      }
    }
  })

  grunt.event.on('coverage', function (lcov, done) {
    require('coveralls').handleInput(lcov, function (error) {
      if (error && !(error instanceof Error)) {
        error = new Error(error)
      }

      done(error)
    })
  })

  grunt.loadNpmTasks('grunt-browserify')
  grunt.loadNpmTasks('grunt-contrib-clean')
  grunt.loadNpmTasks('grunt-contrib-jshint')
  grunt.loadNpmTasks('grunt-contrib-uglify')
  grunt.loadNpmTasks('grunt-jscs')
  grunt.loadNpmTasks('grunt-mocha-istanbul')
  grunt.loadNpmTasks('grunt-mocha-test')

  grunt.registerTask('build', ['browserify:production', 'uglify:production'])
  grunt.registerTask('coverage', ['mocha_istanbul:coverage'])
  grunt.registerTask('coveralls', ['mocha_istanbul:coveralls'])
  grunt.registerTask('test', ['mochaTest'])
}
