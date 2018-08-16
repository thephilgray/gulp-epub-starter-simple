import path from 'path'; // built-in node module that provides utilities for working with file and directory paths

import gulp from 'gulp'; // task runner
import Browser from 'browser-sync'; // dev server to host files on localhost and allow livereload upon changes
import del from 'del'; // a tool to delete files and directories
import sass from 'gulp-sass'; // gulp wrapper for node-sass, which compiles sass to css
import postcss from 'gulp-postcss'; // gulp wrapper for postcss, a tool for transforming styles with JS plugins
import autoprefixer from 'autoprefixer'; // tool to parse CSS and add vendor prefixes to CSS rules using values from Can I Use
import sourcemaps from 'gulp-sourcemaps';
import cleanCSS from 'gulp-clean-css';
import extensionReplace from 'gulp-ext-replace';
import rename from 'gulp-rename';
import gulpif from 'gulp-if';
import image from 'gulp-image';
import uglify from 'gulp-uglify';
import zip from 'gulp-zip';
import kebabCase from 'lodash/kebabCase'; // lodash function to transform text with spaces and other casing to kebab casing; good for ensureing clean pathnames and filenames

/*=============================================
=            config            =
=============================================*/

const config = {
  epubName: 'Textbook', // name of epub; can include spaces and various casing
  sourceDirectoryName: 'src', // name of top level source directory
  buildDirectoryName: 'build', // name of top level directory to output files to
  contentDirectoryName: 'EPUB', // name of directory in which all epub assets are stored, usually EPUB or OEBPS by convention
  devServerPort: 3000
};

// constants

const devMode = process.env === 'development'; // boolean; build set by run script is running in 'development' or 'production' mode

const sourceDirectoryPath = path.resolve(__dirname, config.sourceDirectoryName); // the path where all source code lives
const buildDirectoryPath = path.resolve(__dirname, config.buildDirectoryName); // the path to which all compiled code is output

const sourceContentDirectoryPath = `${sourceDirectoryPath}/${
  config.contentDirectoryName
}`; // the path to source epub assets
const buildContentDirectoryPath = `${buildDirectoryPath}/${kebabCase(
  config.epubName
)}${devMode ? '.epub' : ''}/${config.contentDirectoryName}`; // the path to output epub assets

/*=====  End of config  ======*/

/*=============================================
=            tasks            =
=============================================*/

/*----------  Clean Files  ----------*/

export const cleanFiles = () => del(config.buildDirectoryName);

/*----------  Copy Files  ----------*/

/**
 *
 * copy-files
 * copy all files to build directory, except html and scss
 *
 */

export const copyFiles = () =>
  gulp
    .src([
      `${sourceContentDirectoryPath}/**/*`,
      // do not copy html or scss; these will be custom-handled
      `!${sourceContentDirectoryPath}/html/**`,
      `!${sourceContentDirectoryPath}/scss/**`,
      `!${sourceContentDirectoryPath}/images/**`,
      `!${sourceContentDirectoryPath}/js/**`
    ])
    .pipe(gulp.dest(buildContentDirectoryPath));

/*----------  HTML - dev only  ----------*/

const HTMLSource = `${sourceContentDirectoryPath}/html/**/*.html`;

export const html = () =>
  gulp.src(HTMLSource).pipe(gulp.dest(`${buildContentDirectoryPath}/xhtml/`));

// watch changes to html in source directory and reload

export const watchHTML = () =>
  gulp.watch(HTMLSource, gulp.series('html', 'reload'));

/*----------  XHTML - build only  ----------*/

export const xhtml = () =>
  gulp
    .src(HTMLSource)
    .pipe(extensionReplace('.xhtml'))
    .pipe(gulp.dest(`${buildContentDirectoryPath}/xhtml/`));

// watch changes to html in source directory and reload

export const watchXHTML = () => gulp.watch(HTMLSource, gulp.series('xhtml'));

/*----------  CSS  ----------*/

const CSSSource = `${sourceContentDirectoryPath}/scss/**/*.scss`;

const sassOptions = {
  errLogToConsole: true,
  outputStyle: 'expanded'
};

const postcssPlugins = [
  autoprefixer({
    browsers: ['last 2 versions']
  })
];

export const css = () =>
  gulp
    .src([`${sourceContentDirectoryPath}/scss/styles.scss`], {
      base: sourceContentDirectoryPath
    })
    .pipe(gulpif(devMode, sourcemaps.init()))
    .pipe(sass(sassOptions).on('error', sass.logError))
    .pipe(gulpif(!devMode, cleanCSS()))
    .pipe(gulpif(devMode, sourcemaps.write()))
    .pipe(postcss(postcssPlugins))
    .pipe(
      rename({
        dirname: 'css'
      })
    )
    .pipe(gulp.dest(buildContentDirectoryPath));

// watch changes to html in source directory and reload

export const watchCSS = () =>
  gulp.watch(CSSSource, gulp.series('css', 'reload'));

/*----------  Images  ----------*/

const imageSource = `${sourceContentDirectoryPath}/images/*`;

const imageOptions = {
  // pass in options to optimize images
  // optipng: ['-i 1', '-strip all', '-fix', '-o7', '-force'],
  // pngquant: ['--speed=1', '--force', 256],
  // zopflipng: ['-y', '--lossy_8bit', '--lossy_transparent'],
  // jpegRecompress: ['--strip', '--quality', 'medium', '--min', 40, '--max', 80],
  // mozjpeg: ['-optimize', '-progressive'],
  // guetzli: ['--quality', 85],
  // gifsicle: ['--optimize'],
  // svgo: ['--enable', 'cleanupIDs', '--disable', 'convertColors']
};

export const images = () =>
  gulp
    .src([imageSource])
    .pipe(image(imageOptions))
    .pipe(gulp.dest(`${buildContentDirectoryPath}/images/`));

export const watchImages = () =>
  gulp.watch(imageSource, gulp.series('images', 'reload'));

/*----------  JavaScript  ----------*/

const JSSource = `${sourceContentDirectoryPath}/js/*`;

export const js = () =>
  gulp
    .src([JSSource])
    .pipe(gulpif(!devMode, uglify())) // minimize js if production
    .pipe(gulp.dest(buildContentDirectoryPath));

export const watchJS = () => gulp.watch(JSSource, gulp.series('js', 'reload'));

/*----------  Zip as EPUB  ----------*/

export const zipEpub = () =>
  gulp
    .src(`${buildDirectoryPath}/**/*`)
    .pipe(zip(`${kebabCase(config.epubName)}.epub`))
    .pipe(gulp.dest('.'));

/*----------  Validate .epub  ----------*/

// requires java jre sdk

var exec = require('child_process').exec;

export const validate = done => {
  exec(
    `java -jar bin/epubcheck-4.0.2/epubcheck.jar ${config.epubName}.epub > ${
      config.epubName
    }.epub.errors 2>&1`,
    function(err, stdout, stderr) {
      if (err) {
        console.log(stderr);
      }
      console.log(stdout);
    }
  );
  done();
};

/*----------  Dev Server - dev only  ----------*/
const browser = Browser.create(); // create a new instance of browser-sync

export const serve = done => {
  const options = {
    server: {
      baseDir: path.relative(__dirname, buildContentDirectoryPath),
      directory: true,
      port: config.devServerPort,
      open: true
    },
    startPath: '/xhtml'
  };

  browser.init(options);
  done();
};

export const reload = done => {
  if (browser) {
    browser.reload();
  }
  done();
};

/*=====  End of tasks  ======*/

/*=============================================
=            series            =
=============================================*/

/*----------  npm run dev  ----------*/

export const dev = gulp.series(
  cleanFiles,
  copyFiles,
  html,
  images,
  css,
  js,
  serve,
  gulp.parallel(watchHTML, watchCSS)
);

/*----------  npm run build:proof  ----------*/

export const buildProof = gulp.series(
  cleanFiles,
  copyFiles,
  xhtml,
  images,
  css,
  js,
  gulp.parallel(watchXHTML, watchCSS)
);

/*----------  npm run build:epub  ----------*/

export const buildEpub = gulp.series(
  cleanFiles,
  copyFiles,
  xhtml,
  images,
  css,
  js,
  gulp.series(zipEpub)
);

/*----------  npm run build:validate  ----------*/

export const buildValidate = gulp.series(buildEpub, gulp.series(validate));

// default gulp task

export default dev;
/*=====  End of series  ======*/
