# angular-filemanager

A very smart filemanager to manage your files in the browser developed in AngularJS following Material Design styles by [Jonas Sciangula Street](https://github.com/joni2back)

This project provides a web file manager interface, **allowing you to create your own backend connector** following the [connector API](API.md). 
*By the way, we provide some example backend connectors in many languages as example (php-ftp, php-local, python, etc)*

[![Build Status](https://travis-ci.org/joni2back/angular-filemanager.svg?branch=master)](https://travis-ci.org/joni2back/angular-filemanager)


#### [Try the DEMO](https://joni2back.github.io/angular-filemanager/)
---------
![](https://raw.githubusercontent.com/joni2back/angular-filemanager/master/screenshot.gif)

### Features
  - Multiple file support
  - Multilanguage
  - List and Icon view
  - Multiple file upload
  - Pick files callback for third parties apps
  - Search files
  - Directory tree navigation
  - Copy, Move, Rename (Interactive UX)
  - Delete, Edit, Preview, Download
  - File permissions (Unix chmod style)
  - Mobile support

### TODO
  - Drag and drop
  - Dropbox and Google Drive connectors
  - Remove usage of jQuery

### Backend API
[Read the docs](API.md)

---------

### Using in your existing project
**1) Install deps using yarn with**
```yarn install```

**2) Include the dependencies in your project**
```html
<!-- third party -->
  <script src="node_modules/jquery/dist/jquery.min.js"></script>
  <script src="node_modules/angular/angular.min.js"></script>
  <script src="node_modules/angular-translate/dist/angular-translate.min.js"></script>
  <script src="node_modules/ng-file-upload/dist/ng-file-upload.min.js"></script>
  <script src="node_modules/bootstrap/dist/js/bootstrap.min.js"></script>
  <link rel="stylesheet" href="node_modules/bootswatch/paper/bootstrap.min.css" />

<!-- angular-explorer -->
  <link rel="stylesheet" href="dist/angular-explorer.min.css">
  <script src="dist/angular-explorer.min.js"></script>
```

**3) Use the angular directive in your HTML**
```html
<angular-explorer></angular-explorer>
```

---------

### Extending the configuration file by adding a script
```html
<script type="text/javascript">
angular.module('FileManagerApp').config(['fileManagerConfigProvider', function (config) {
  var defaults = config.$get();
  config.set({
    appName: 'angular-explorer',
    pickCallback: function(item) {
      var msg = 'Picked %s "%s" for external use'
        .replace('%s', item.type)
        .replace('%s', item.fullPath());
      window.alert(msg);
    },

    allowedActions: angular.extend(defaults.allowedActions, {
      pickFiles: true,
      pickFolders: false,
    }),
  });
}]);
</script>
```

### Create a new build with your changes
```sh
  gulp
```

You can do many things by extending the configuration. Like hide the sidebar or the search button. See [the list of default configurations](/src/js/providers/config.js).

---------

### Contribute
To contribute to the project you can simply fork this repo. To build a minified version, you can simply run the Gulp
task `gulp`. The minified/uglified files are created in the `dist` folder.

### Versioning
For transparency into our release cycle and in striving to maintain backward compatibility, angular-explorer is maintained under [the Semantic Versioning guidelines](http://semver.org/).

### Copyright and license
Code and documentation released under [the MIT license](https://github.com/joni2back/angular-filemanager/blob/master/LICENSE).
