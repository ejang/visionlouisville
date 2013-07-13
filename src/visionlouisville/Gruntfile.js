module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      dist: {
        files: [
          {
            dest: 'static/js/dist/components.min.js',
            src: [
              'static/components/jquery/jquery.js',
              'static/components/handlebars.js/dist/handlebars.js',
              'static/components/underscore/underscore-min.js',
              'static/components/backbone/backbone.js',
              'static/components/backbone-relational/backbone-relational.js',
              'static/components/backbone.marionette/lib/backbone.marionette.js',
              'static/components/moment/moment.js',
              'static/components/swiper/dist/idangerous.swiper-2.0.js',
              'static/components/Countable/Countable.js'
            ]
          },
          {
            dest: 'static/js/dist/app.min.js',
            src: [
              'static/js/django-csrf.js',
              'static/js/config.js',
              'static/js/utils.js',
              'static/js/handlebars-helpers.js',
              'static/js/models.js',
              'static/js/views.js',
              'static/js/app.js'
            ]
          },
          {
            dest: 'static/js/dist/modernizr.min.js',
            src: [
              'static/components/modernizr/modernizr.js'
            ]
          }
        ]
      }
    },
    cssmin: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      dist: {
        files: [
          {
            dest: 'static/css/dist/components.min.css',
            src: [
              'static/components/normalize-css/normalize.css'
            ]
          },
          {
            dest: 'static/css/dist/swiper.min.css',
            src: [
              'static/components/swiper/dist/idangerous.swiper.css'
            ]
          },
          {
            dest: 'static/css/dist/styles.min.css',
            src: [
              'static/css/styles.css'
            ]
          }
        ]
      }
    }
  });

  // Load the plugins
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-cssmin');

  // Default task(s).
  grunt.registerTask('default', ['uglify', 'cssmin']);

};