'use strict';

// Require
var gulp = require('gulp');
var templateCache = require('gulp-angular-templatecache');
var uglify = require('gulp-uglify');
var minifyCss = require('gulp-clean-css');
var concat = require('gulp-concat');
var eslint = require('gulp-eslint');
var del = require('del');
var path = require('path');

// Vars
var src = 'src/';
var dst = 'dist/';
var tplPath = 'src/templates'; //must be same as fileManagerConfig.tplPath
var jsMinFile = 'angular-explorer.min.js';
var jsFile = 'angular-explorer.js';
var cssMinFile = 'angular-explorer.min.css';
var cssFile = 'angular-explorer.css';

gulp.task('clean', function (cb) {
  del(dst + '/*', cb);
});

gulp.task('cache-templates', function () {
  return gulp.src(tplPath + '/*.html')
    .pipe(templateCache(jsFile, {
      module: 'FileManagerApp',
      base: function (file) {
        return tplPath + '/' + path.basename(file.history[0]);
      }
    }))
    .pipe(gulp.dest(dst));
});

gulp.task('concat-js', function () {
  return gulp.src([
      src + 'js/app.js',
      src + 'js/*/*.js',
      dst + jsFile
    ])
    .pipe(concat(jsFile))
    .pipe(gulp.dest(dst))

    .pipe(concat(jsMinFile))
    .pipe(uglify())
    .pipe(gulp.dest(dst));
});

gulp.task('merge-js', gulp.series('cache-templates', 'concat-js'));

gulp.task('minify-css', function () {
  return gulp.src(src + 'css/*.css')
    .pipe(concat(cssFile))
    .pipe(gulp.dest(dst))

    .pipe(minifyCss({
      compatibility: 'ie8'
    }))
    .pipe(concat(cssMinFile))
    .pipe(gulp.dest(dst));
});

gulp.task('lint', function () {
  return gulp.src([src + 'js/app.js', src + 'js/*/*.js'])
    .pipe(eslint({
      'rules': {
        'quotes': [2, 'single'],
        //'linebreak-style': [2, 'unix'],
        'semi': [2, 'always']
      },
      'env': {
        'browser': true
      },
      'globals': {
        'angular': true,
        'jQuery': true
      },
      'extends': 'eslint:recommended'
    }))
    .pipe(eslint.format())
    .pipe(eslint.failOnError());
});

gulp.task('default', gulp.series('merge-js', 'minify-css'));
gulp.task('build', gulp.series('clean', 'lint', 'default'));