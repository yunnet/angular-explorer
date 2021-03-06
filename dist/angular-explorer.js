(function(window, angular) {
    'use strict';
    angular.module('FileManagerApp', ['pascalprecht.translate', 'ngFileUpload']);

    /**
     * jQuery inits
     */
    angular.element(window.document).on('shown.bs.modal', '.modal', function() {
        window.setTimeout(function() {
            angular.element('[autofocus]', this).focus();
        }.bind(this), 100);
    });

    angular.element(window.document).on('click', function() {
        angular.element('#context-menu').hide();
    });

    angular.element(window.document).on('contextmenu', '.main-navigation .table-files tr.item-list:has("td"), .item-list', function(e) {
        var menu = angular.element('#context-menu');

        if (e.pageX >= window.innerWidth - menu.width()) {
            e.pageX -= menu.width();
        }
        if (e.pageY >= window.innerHeight - menu.height()) {
            e.pageY -= menu.height();
        }

        menu.hide().css({
            left: e.pageX,
            top: e.pageY
        }).appendTo('body').show();
        e.preventDefault();
    });

    if (! Array.prototype.find) {
        Array.prototype.find = function(predicate) {
            if (this == null) {
                throw new TypeError('Array.prototype.find called on null or undefined');
            }
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }
            var list = Object(this);
            var length = list.length >>> 0;
            var thisArg = arguments[1];
            var value;

            for (var i = 0; i < length; i++) {
                value = list[i];
                if (predicate.call(thisArg, value, i, list)) {
                    return value;
                }
            }
            return undefined;
        };
    }

})(window, angular);

(function (angular) {
    'use strict';
    var app = angular.module('FileManagerApp');

    app.directive('angularExplorer', ['$parse', 'fileManagerConfig', function ($parse, fileManagerConfig) {
        return {
            restrict: 'EA',
            templateUrl: fileManagerConfig.tplPath + '/main.html'
        };
    }]);

    app.directive('ngFile', ['$parse', function ($parse) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var model = $parse(attrs.ngFile);
                var modelSetter = model.assign;

                element.bind('change', function () {
                    scope.$apply(function () {
                        modelSetter(scope, element[0].files);
                    });
                });
            }
        };
    }]);

    app.directive('ngRightClick', ['$parse', function ($parse) {
        return function (scope, element, attrs) {
            var fn = $parse(attrs.ngRightClick);
            element.bind('contextmenu', function (event) {
                scope.$apply(function () {
                    event.preventDefault();
                    fn(scope, {
                        $event: event
                    });
                });
            });
        };
    }]);

})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').service('chmod', function () {

        var Chmod = function (initValue) {
            this.owner = this.getRwxObj();
            this.group = this.getRwxObj();
            this.others = this.getRwxObj();

            if (initValue) {
                var codes = isNaN(initValue) ?
                    this.convertfromCode(initValue) :
                    this.convertfromOctal(initValue);

                if (!codes) {
                    throw new Error('Invalid chmod input data (%s)'.replace('%s', initValue));
                }

                this.owner = codes.owner;
                this.group = codes.group;
                this.others = codes.others;
            }
        };

        Chmod.prototype.toOctal = function (prepend, append) {
            var result = [];
            ['owner', 'group', 'others'].forEach(function (key, i) {
                result[i] = this[key].read && this.octalValues.read || 0;
                result[i] += this[key].write && this.octalValues.write || 0;
                result[i] += this[key].exec && this.octalValues.exec || 0;
            }.bind(this));
            return (prepend || '') + result.join('') + (append || '');
        };

        Chmod.prototype.toCode = function (prepend, append) {
            var result = [];
            ['owner', 'group', 'others'].forEach(function (key, i) {
                result[i] = this[key].read && this.codeValues.read || '-';
                result[i] += this[key].write && this.codeValues.write || '-';
                result[i] += this[key].exec && this.codeValues.exec || '-';
            }.bind(this));
            return (prepend || '') + result.join('') + (append || '');
        };

        Chmod.prototype.getRwxObj = function () {
            return {
                read: false,
                write: false,
                exec: false
            };
        };

        Chmod.prototype.octalValues = {
            read: 4,
            write: 2,
            exec: 1
        };

        Chmod.prototype.codeValues = {
            read: 'r',
            write: 'w',
            exec: 'x'
        };

        Chmod.prototype.convertfromCode = function (str) {
            str = ('' + str).replace(/\s/g, '');
            str = str.length === 10 ? str.substr(1) : str;
            if (!/^[-rwxts]{9}$/.test(str)) {
                return;
            }

            var result = [],
                vals = str.match(/.{1,3}/g);
            for (var i in vals) {
                var rwxObj = this.getRwxObj();
                rwxObj.read = /r/.test(vals[i]);
                rwxObj.write = /w/.test(vals[i]);
                rwxObj.exec = /x|t/.test(vals[i]);
                result.push(rwxObj);
            }

            return {
                owner: result[0],
                group: result[1],
                others: result[2]
            };
        };

        Chmod.prototype.convertfromOctal = function (str) {
            str = ('' + str).replace(/\s/g, '');
            str = str.length === 4 ? str.substr(1) : str;
            if (!/^[0-7]{3}$/.test(str)) {
                return;
            }

            var result = [],
                vals = str.match(/.{1}/g);
            for (var i in vals) {
                var rwxObj = this.getRwxObj();
                rwxObj.read = /[4567]/.test(vals[i]);
                rwxObj.write = /[2367]/.test(vals[i]);
                rwxObj.exec = /[1357]/.test(vals[i]);
                result.push(rwxObj);
            }

            return {
                owner: result[0],
                group: result[1],
                others: result[2]
            };
        };

        return Chmod;
    });
})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').factory('item', ['fileManagerConfig', 'chmod', function (fileManagerConfig, Chmod) {

        var Item = function (model, path) {
            var rawModel = {
                name: model && model.name || '',
                path: path || [],
                type: model && model.type || 'file',
                size: model && parseInt(model.size || 0),
                date: parseMySQLDate(model && model.date),
                perms: new Chmod(model && model.rights),
                content: model && model.content || '',
                recursive: false,
                fullPath: function () {
                    var path = this.path.filter(Boolean);
                    return ('/' + path.join('/') + '/' + this.name).replace(/\/\//, '/');
                }
            };

            this.error = '';
            this.processing = false;

            this.model = angular.copy(rawModel);
            this.tempModel = angular.copy(rawModel);

            function parseMySQLDate(mysqlDate) {
                var d = (mysqlDate || '').toString().split(/[- :]/);
                return new Date(d[0], d[1] - 1, d[2], d[3], d[4], d[5]);
            }
        };

        Item.prototype.update = function () {
            angular.extend(this.model, angular.copy(this.tempModel));
        };

        Item.prototype.revert = function () {
            angular.extend(this.tempModel, angular.copy(this.model));
            this.error = '';
        };

        Item.prototype.isFolder = function () {
            return this.model.type === 'dir';
        };

        Item.prototype.isEditable = function () {
            return !this.isFolder() && fileManagerConfig.isEditableFilePattern.test(this.model.name);
        };

        Item.prototype.isImage = function () {
            return fileManagerConfig.isImageFilePattern.test(this.model.name);
        };

        Item.prototype.isCompressible = function () {
            return this.isFolder();
        };

        Item.prototype.isExtractable = function () {
            return !this.isFolder() && fileManagerConfig.isExtractableFilePattern.test(this.model.name);
        };

        Item.prototype.isSelectable = function () {
            return (this.isFolder() && fileManagerConfig.allowedActions.pickFolders) || (!this.isFolder() && fileManagerConfig.allowedActions.pickFiles);
        };

        return Item;
    }]);
})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').controller('FileManagerCtrl', [
        '$scope', '$rootScope', '$window', '$translate', 'fileManagerConfig', 'item', 'fileNavigator', 'apiMiddleware',
        function ($scope, $rootScope, $window, $translate, fileManagerConfig, Item, FileNavigator, ApiMiddleware) {

            var $storage = $window.localStorage;
            $scope.config = fileManagerConfig;
            $scope.reverse = false;
            $scope.predicate = ['model.type', 'model.name'];
            $scope.order = function (predicate) {
                $scope.reverse = ($scope.predicate[1] === predicate) ? !$scope.reverse : false;
                $scope.predicate[1] = predicate;
            };
            $scope.query = '';
            $scope.fileNavigator = new FileNavigator();
            $scope.apiMiddleware = new ApiMiddleware();
            $scope.uploadFileList = [];
            $scope.viewTemplate = $storage.getItem('viewTemplate') || 'main-icons.html';
            $scope.fileList = [];
            $scope.temps = [];

            $scope.$watch('temps', function () {
                if ($scope.singleSelection()) {
                    $scope.temp = $scope.singleSelection();
                } else {
                    $scope.temp = new Item({
                        rights: 644
                    });
                    $scope.temp.multiple = true;
                }
                $scope.temp.revert();
            });

            $scope.fileNavigator.onRefresh = function () {
                $scope.temps = [];
                $scope.query = '';
                $rootScope.selectedModalPath = $scope.fileNavigator.currentPath;
            };

            $scope.setTemplate = function (name) {
                $storage.setItem('viewTemplate', name);
                $scope.viewTemplate = name;
            };

            $scope.changeLanguage = function (locale) {
                if (locale) {
                    $storage.setItem('language', locale);
                    return $translate.use(locale);
                }
                $translate.use($storage.getItem('language') || fileManagerConfig.defaultLang);
            };

            $scope.isSelected = function (item) {
                return $scope.temps.indexOf(item) !== -1;
            };

            $scope.selectOrUnselect = function (item, $event) {
                var indexInTemp = $scope.temps.indexOf(item);
                var isRightClick = $event && $event.which == 3;

                if ($event && $event.target.hasAttribute('prevent')) {
                    $scope.temps = [];
                    return;
                }
                if (!item || (isRightClick && $scope.isSelected(item))) {
                    return;
                }
                if ($event && $event.shiftKey && !isRightClick) {
                    var list = $scope.fileList;
                    var indexInList = list.indexOf(item);
                    var lastSelected = $scope.temps[0];
                    var i = list.indexOf(lastSelected);
                    var current = undefined;
                    if (lastSelected && list.indexOf(lastSelected) < indexInList) {
                        $scope.temps = [];
                        while (i <= indexInList) {
                            current = list[i];
                            !$scope.isSelected(current) && $scope.temps.push(current);
                            i++;
                        }
                        return;
                    }
                    if (lastSelected && list.indexOf(lastSelected) > indexInList) {
                        $scope.temps = [];
                        while (i >= indexInList) {
                            current = list[i];
                            !$scope.isSelected(current) && $scope.temps.push(current);
                            i--;
                        }
                        return;
                    }
                }
                if ($event && !isRightClick && ($event.ctrlKey || $event.metaKey)) {
                    $scope.isSelected(item) ? $scope.temps.splice(indexInTemp, 1) : $scope.temps.push(item);
                    return;
                }
                $scope.temps = [item];
            };

            $scope.singleSelection = function () {
                return $scope.temps.length === 1 && $scope.temps[0];
            };

            $scope.totalSelecteds = function () {
                return {
                    total: $scope.temps.length
                };
            };

            $scope.selectionHas = function (type) {
                return $scope.temps.find(function (item) {
                    return item && item.model.type === type;
                });
            };

            $scope.prepareNewFolder = function () {
                var item = new Item(null, $scope.fileNavigator.currentPath);
                $scope.temps = [item];
                return item;
            };

            $scope.smartClick = function (item) {
                var pick = $scope.config.allowedActions.pickFiles;
                if (item.isFolder()) {
                    return $scope.fileNavigator.folderClick(item);
                }

                if (typeof $scope.config.pickCallback === 'function' && pick) {
                    var callbackSuccess = $scope.config.pickCallback(item.model);
                    if (callbackSuccess === true) {
                        return;
                    }
                }

                if (item.isImage()) {
                    if ($scope.config.previewImagesInModal) {
                        return $scope.openImagePreview(item);
                    }
                    return $scope.apiMiddleware.download(item, true);
                }

                if (item.isEditable()) {
                    return $scope.openEditItem(item);
                }
            };

            $scope.openImagePreview = function () {
                var item = $scope.singleSelection();
                $scope.apiMiddleware.apiHandler.inprocess = true;
                $scope.modal('imagepreview', null, true)
                    .find('#imagepreview-target')
                    .attr('src', $scope.getUrl(item))
                    .unbind('load error')
                    .on('load error', function () {
                        $scope.apiMiddleware.apiHandler.inprocess = false;
                        $scope.$apply();
                    });
            };

            $scope.openEditItem = function () {
                var item = $scope.singleSelection();
                $scope.apiMiddleware.getContent(item).then(function (data) {
                    item.tempModel.content = item.model.content = data.result;
                });
                $scope.modal('edit');
            };

            $scope.modal = function (id, hide, returnElement) {
                var element = angular.element('#' + id);
                element.modal(hide ? 'hide' : 'show');
                $scope.apiMiddleware.apiHandler.error = '';
                $scope.apiMiddleware.apiHandler.asyncSuccess = false;
                return returnElement ? element : true;
            };

            $scope.modalWithPathSelector = function (id) {
                $rootScope.selectedModalPath = $scope.fileNavigator.currentPath;
                return $scope.modal(id);
            };

            $scope.isInThisPath = function (path) {
                var currentPath = $scope.fileNavigator.currentPath.join('/') + '/';
                return currentPath.indexOf(path + '/') !== -1;
            };

            $scope.edit = function () {
                $scope.apiMiddleware.edit($scope.singleSelection()).then(function () {
                    $scope.modal('edit', true);
                });
            };

            $scope.changePermissions = function () {
                $scope.apiMiddleware.changePermissions($scope.temps, $scope.temp).then(function () {
                    $scope.fileNavigator.refresh();
                    $scope.modal('changepermissions', true);
                });
            };

            $scope.download = function () {
                var item = $scope.singleSelection();
                if ($scope.selectionHas('dir')) {
                    return;
                }
                if (item) {
                    return $scope.apiMiddleware.download(item);
                }
                return $scope.apiMiddleware.downloadMultiple($scope.temps);
            };

            $scope.copy = function () {
                var item = $scope.singleSelection();
                if (item) {
                    var name = item.tempModel.name.trim();
                    var nameExists = $scope.fileNavigator.fileNameExists(name);
                    if (nameExists && validateSamePath(item)) {
                        $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                        return false;
                    }
                    if (!name) {
                        $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                        return false;
                    }
                }
                $scope.apiMiddleware.copy($scope.temps, $rootScope.selectedModalPath).then(function () {
                    $scope.fileNavigator.refresh();
                    $scope.modal('copy', true);
                });
            };

            $scope.compress = function () {
                var name = $scope.temp.tempModel.name.trim();
                var nameExists = $scope.fileNavigator.fileNameExists(name);

                if (nameExists && validateSamePath($scope.temp)) {
                    $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                    return false;
                }
                if (!name) {
                    $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                    return false;
                }

                $scope.apiMiddleware.compress($scope.temps, name, $rootScope.selectedModalPath).then(function () {
                    $scope.fileNavigator.refresh();
                    if (!$scope.config.compressAsync) {
                        return $scope.modal('compress', true);
                    }
                    $scope.apiMiddleware.apiHandler.asyncSuccess = true;
                }, function () {
                    $scope.apiMiddleware.apiHandler.asyncSuccess = false;
                });
            };

            $scope.extract = function () {
                var item = $scope.temp;
                var name = $scope.temp.tempModel.name.trim();
                var nameExists = $scope.fileNavigator.fileNameExists(name);

                if (nameExists && validateSamePath($scope.temp)) {
                    $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                    return false;
                }
                if (!name) {
                    $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                    return false;
                }

                $scope.apiMiddleware.extract(item, name, $rootScope.selectedModalPath).then(function () {
                    $scope.fileNavigator.refresh();
                    if (!$scope.config.extractAsync) {
                        return $scope.modal('extract', true);
                    }
                    $scope.apiMiddleware.apiHandler.asyncSuccess = true;
                }, function () {
                    $scope.apiMiddleware.apiHandler.asyncSuccess = false;
                });
            };

            $scope.remove = function () {
                $scope.apiMiddleware.remove($scope.temps).then(function () {
                    $scope.fileNavigator.refresh();
                    $scope.modal('remove', true);
                });
            };

            $scope.move = function () {
                var anyItem = $scope.singleSelection() || $scope.temps[0];
                if (anyItem && validateSamePath(anyItem)) {
                    $scope.apiMiddleware.apiHandler.error = $translate.instant('error_cannot_move_same_path');
                    return false;
                }
                $scope.apiMiddleware.move($scope.temps, $rootScope.selectedModalPath).then(function () {
                    $scope.fileNavigator.refresh();
                    $scope.modal('move', true);
                });
            };

            $scope.rename = function () {
                var item = $scope.singleSelection();
                var name = item.tempModel.name;
                var samePath = item.tempModel.path.join('') === item.model.path.join('');
                if (!name || (samePath && $scope.fileNavigator.fileNameExists(name))) {
                    $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                    return false;
                }
                $scope.apiMiddleware.rename(item).then(function () {
                    $scope.fileNavigator.refresh();
                    $scope.modal('rename', true);
                });
            };

            $scope.createFolder = function () {
                var item = $scope.singleSelection();
                var name = item.tempModel.name;
                if (!name || $scope.fileNavigator.fileNameExists(name)) {
                    return $scope.apiMiddleware.apiHandler.error = $translate.instant('error_invalid_filename');
                }
                $scope.apiMiddleware.createFolder(item).then(function () {
                    $scope.fileNavigator.refresh();
                    $scope.modal('newfolder', true);
                });
            };

            $scope.addForUpload = function ($files) {
                $scope.uploadFileList = $scope.uploadFileList.concat($files);
                $scope.modal('uploadfile');
            };

            $scope.removeFromUpload = function (index) {
                $scope.uploadFileList.splice(index, 1);
            };

            $scope.uploadFiles = function () {
                $scope.apiMiddleware.upload($scope.uploadFileList, $scope.fileNavigator.currentPath).then(function () {
                    $scope.fileNavigator.refresh();
                    $scope.uploadFileList = [];
                    $scope.modal('uploadfile', true);
                }, function (data) {
                    var errorMsg = data.result && data.result.error || $translate.instant('error_uploading_files');
                    $scope.apiMiddleware.apiHandler.error = errorMsg;
                });
            };

            $scope.getUrl = function (_item) {
                return $scope.apiMiddleware.getUrl(_item);
            };

            var validateSamePath = function (item) {
                var selectedPath = $rootScope.selectedModalPath.join('');
                var selectedItemsPath = item && item.model.path.join('');
                return selectedItemsPath === selectedPath;
            };

            var getQueryParam = function (param) {
                var found = $window.location.search.substr(1).split('&').filter(function (item) {
                    return param === item.split('=')[0];
                });
                return found[0] && found[0].split('=')[1] || undefined;
            };

            $scope.changeLanguage(getQueryParam('lang'));
            $scope.isWindows = getQueryParam('server') === 'Windows';
            $scope.fileNavigator.refresh();

        }
    ]);
})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').controller('ModalFileManagerCtrl',
        ['$scope', '$rootScope', 'fileNavigator', function ($scope, $rootScope, FileNavigator) {

            $scope.reverse = false;
            $scope.predicate = ['model.type', 'model.name'];
            $scope.fileNavigator = new FileNavigator();
            $rootScope.selectedModalPath = [];

            $scope.order = function (predicate) {
                $scope.reverse = ($scope.predicate[1] === predicate) ? !$scope.reverse : false;
                $scope.predicate[1] = predicate;
            };

            $scope.select = function (item) {
                $rootScope.selectedModalPath = item.model.fullPath().split('/').filter(Boolean);
                $scope.modal('selector', true);
            };

            $scope.selectCurrent = function () {
                $rootScope.selectedModalPath = $scope.fileNavigator.currentPath;
                $scope.modal('selector', true);
            };

            $scope.selectedFilesAreChildOfPath = function (item) {
                var path = item.model.fullPath();
                return $scope.temps.find(function (item) {
                    var itemPath = item.model.fullPath();
                    if (path == itemPath) {
                        return true;
                    }
                    /*
                    if (path.startsWith(itemPath)) {
                        fixme names in same folder like folder-one and folder-one-two
                        at the moment fixed hidding affected folders
                    }
                    */
                });
            };

            $rootScope.openNavigator = function (path) {
                $scope.fileNavigator.currentPath = path;
                $scope.fileNavigator.refresh();
                $scope.modal('selector');
            };

            $rootScope.getSelectedPath = function () {
                var path = $rootScope.selectedModalPath.filter(Boolean);
                var result = '/' + path.join('/');
                if ($scope.singleSelection() && !$scope.singleSelection().isFolder()) {
                    result += '/' + $scope.singleSelection().tempModel.name;
                }
                return result.replace(/\/\//, '/');
            };

        }]);
})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').provider('fileManagerConfig', function () {

        var values = {
            appName: 'angular-explorer v1.5.3',
            defaultLang: 'en',
            multiLang: true,

            listUrl: 'api/handler',
            renameUrl: 'api/handler',
            copyUrl: 'api/handler',
            moveUrl: 'api/handler',
            removeUrl: 'api/handler',
            editUrl: 'api/handler',
            getContentUrl: 'api/handler',
            createFolderUrl: 'api/handler',
            uploadUrl: 'api/upload',
            downloadFileUrl: 'api/download',
            downloadMultipleUrl: 'api/download',
            compressUrl: 'api/handler',
            extractUrl: 'api/handler',
            permissionsUrl: 'api/handler',
            basePath: '/',

            searchForm: true,
            sidebar: true,
            breadcrumb: true,
            allowedActions: {
                upload: true,
                rename: true,
                move: true,
                copy: true,
                edit: true,
                changePermissions: true,
                compress: true,
                compressChooseName: true,
                extract: true,
                download: true,
                downloadMultiple: true,
                preview: true,
                remove: true,
                createFolder: true,
                pickFiles: false,
                pickFolders: false
            },

            multipleDownloadFileName: 'angular-explorer.zip',
            filterFileExtensions: [],
            showExtensionIcons: true,
            showSizeForDirectories: false,
            useBinarySizePrefixes: false,
            downloadFilesByAjax: true,
            previewImagesInModal: true,
            enablePermissionsRecursive: true,
            compressAsync: false,
            extractAsync: false,
            pickCallback: null,

            isEditableFilePattern: /\.(txt|diff?|patch|svg|asc|cnf|cfg|conf|html?|.html|cfm|cgi|aspx?|ini|pl|py|md|css|cs|js|jsp|log|htaccess|htpasswd|gitignore|gitattributes|env|json|atom|eml|rss|markdown|sql|xml|xslt?|sh|rb|as|bat|cmd|cob|for|ftn|frm|frx|inc|lisp|scm|coffee|php[3-6]?|java|c|cbl|go|h|scala|vb|tmpl|lock|go|yml|yaml|tsv|lst)$/i,
            isImageFilePattern: /\.(jpe?g|gif|bmp|png|svg|tiff?)$/i,
            isExtractableFilePattern: /\.(gz|tar|rar|g?zip)$/i,
            tplPath: 'src/templates'
        };

        return {
            $get: function () {
                return values;
            },
            set: function (constants) {
                angular.extend(values, constants);
            }
        };

    });
})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').config(['$translateProvider', function ($translateProvider) {
        $translateProvider.useSanitizeValueStrategy(null);

        $translateProvider.translations('en', {
            filemanager: 'File Manager',
            language: 'Language',
            english: 'English',
            spanish: 'Spanish',
            portuguese: 'Portuguese',
            french: 'French',
            german: 'German',
            hebrew: 'Hebrew',
            italian: 'Italian',
            slovak: 'Slovak',
            chinese_tw: 'Traditional Chinese',
            chinese_cn: 'Simple Chinese',
            russian: 'Russian',
            ukrainian: 'Ukrainian',
            turkish: 'Turkish',
            persian: 'Persian',
            polish: 'Polish',
            dutch: 'Dutch',
            confirm: 'Confirm',
            cancel: 'Cancel',
            close: 'Close',
            upload_files: 'Upload files',
            files_will_uploaded_to: 'Files will be uploaded to',
            select_files: 'Select files',
            uploading: 'Uploading',
            permissions: 'Permissions',
            select_destination_folder: 'Select the destination folder',
            source: 'Source',
            destination: 'Destination',
            copy_file: 'Copy file',
            sure_to_delete: 'Are you sure to delete',
            change_name_move: 'Change name / move',
            enter_new_name_for: 'Enter new name for',
            extract_item: 'Extract item',
            extraction_started: 'Extraction started in a background process',
            compression_started: 'Compression started in a background process',
            enter_folder_name_for_extraction: 'Enter the folder name for the extraction of',
            enter_file_name_for_compression: 'Enter the file name for the compression of',
            toggle_fullscreen: 'Toggle fullscreen',
            edit_file: 'Edit file',
            file_content: 'File content',
            loading: 'Loading',
            search: 'Search',
            create_folder: 'Create folder',
            create: 'Create',
            folder_name: 'Folder name',
            upload: 'Upload',
            change_permissions: 'Change permissions',
            change: 'Change',
            details: 'Details',
            icons: 'Icons',
            list: 'List',
            name: 'Name',
            size: 'Size',
            actions: 'Actions',
            date: 'Date',
            selection: 'Selection',
            no_files_in_folder: 'No files in this folder',
            no_folders_in_folder: 'This folder not contains children folders',
            select_this: 'Select this',
            go_back: 'Go back',
            wait: 'Wait',
            move: 'Move',
            download: 'Download',
            view_item: 'View item',
            remove: 'Delete',
            edit: 'Edit',
            save: 'Save',
            copy: 'Copy',
            rename: 'Rename',
            extract: 'Extract',
            compress: 'Compress',
            error_invalid_filename: 'Invalid filename or already exists, specify another name',
            error_modifying: 'An error occurred modifying the file',
            error_deleting: 'An error occurred deleting the file or folder',
            error_renaming: 'An error occurred renaming the file',
            error_copying: 'An error occurred copying the file',
            error_compressing: 'An error occurred compressing the file or folder',
            error_extracting: 'An error occurred extracting the file',
            error_creating_folder: 'An error occurred creating the folder',
            error_getting_content: 'An error occurred getting the content of the file',
            error_changing_perms: 'An error occurred changing the permissions of the file',
            error_uploading_files: 'An error occurred uploading files',
            sure_to_start_compression_with: 'Are you sure to compress',
            owner: 'Owner',
            group: 'Group',
            others: 'Others',
            read: 'Read',
            write: 'Write',
            exec: 'Exec',
            original: 'Original',
            changes: 'Changes',
            recursive: 'Recursive',
            preview: 'Item preview',
            open: 'Open',
            these_elements: 'these {{total}} elements',
            new_folder: 'New folder',
            download_as_zip: 'Download as ZIP'
        });

        $translateProvider.translations('nl', {
            filemanager: 'Bestand beheerder',
            language: 'Taal',
            english: 'Engels',
            spanish: 'Spaans',
            portuguese: 'Portugees',
            french: 'Frans',
            german: 'Duits',
            hebrew: 'Hebrews',
            slovak: 'Slowakije',
            chinese: 'Chinees',
            russian: 'Russisch',
            ukrainian: 'Oekra??ens',
            turkish: 'Turks',
            persian: 'Perzisch',
            confirm: 'Bevestigen',
            cancel: 'Annuleren',
            close: 'Sluiten',
            upload_files: 'Bestanden uploaden',
            files_will_uploaded_to: 'Bestanden worden ge??pload naar',
            select_files: 'Selecteer bestanden',
            uploading: 'Uploaden',
            permissions: 'Rechten',
            select_destination_folder: 'Selecteer de map van bestemming',
            source: 'Bron',
            destination: 'Doel',
            copy_file: 'Kopieer bestand',
            sure_to_delete: 'Weet je zeker dat je wilt verwijderen',
            change_name_move: 'Hernoemen / verplaatsen',
            enter_new_name_for: 'Typ een nieuwe naam voor',
            extract_item: 'Uitpakken',
            extraction_started: 'Uitpakken gestart als achtergrond proces',
            compression_started: 'Inpakken gestart als achtergrond proces',
            enter_folder_name_for_extraction: 'Typ een map naar voor het uitpakken van',
            enter_file_name_for_compression: 'Typ een bestandsnaam voor het inpakken van',
            toggle_fullscreen: 'Volledigscherm',
            edit_file: 'Bewerk bestand',
            file_content: 'Bestandsinhoud',
            loading: 'Laden',
            search: 'Zoeken',
            create_folder: 'Maak map',
            create: 'Maak',
            folder_name: 'Map naam',
            upload: 'Uploaden',
            change_permissions: 'Rechten aanpassen',
            change: 'Aanpassen',
            details: 'Details',
            icons: 'Iconen',
            list: 'Lijst',
            name: 'Naam',
            size: 'Grootte',
            actions: 'Acties',
            date: 'Datum',
            no_files_in_folder: 'Geen bestanden in deze map',
            no_folders_in_folder: 'Deze map bevat geen submappen',
            select_this: 'Selecteer dit',
            go_back: 'Ga terug',
            wait: 'Wacht',
            move: 'Verplaats',
            download: 'Download',
            view_item: 'Bekijk item',
            remove: 'Verwijderen',
            edit: 'Bewerken',
            save: 'Bewerken',
            copy: 'Kopi??ren',
            rename: 'Hernoemen',
            extract: 'Uitpakken',
            compress: 'Inpakken',
            error_invalid_filename: 'Ongeldige bestandsnaam of bestand al aanwezig, kies een andere naam',
            error_modifying: 'Er is een fout opgetreden met het bewerken van het bestand',
            error_deleting: 'Er is een fout opgetreden tijdens het verwijderen van de bestand of map',
            error_renaming: 'Er is een fout opgetreden tijdens het hernoemen van het bestand',
            error_copying: 'Er is een fout opgetreden tijdens het kopi??ren van het bestand',
            error_compressing: 'Er is een fout opgetreden tijdens het inpakken van het bestand of map',
            error_extracting: 'Er is een fout opgetreden tijdens het uitpakken van het bestand',
            error_creating_folder: 'Er is een fout opgetreden tijdens het maken van de map',
            error_getting_content: 'Er is een fout opgetreden tijdens het ophalen van de inhoud van het bestand',
            error_changing_perms: 'Er is een fout opgetreden tijdens het aanpassen van de rechten van het bestand',
            error_uploading_files: 'Er is een fout opgetreden tijdens het uploaden van de bestanden',
            sure_to_start_compression_with: 'Weet je zeker dat je dit wilt inpakken',
            owner: 'Eigenaar',
            group: 'Groep',
            others: 'Andere',
            read: 'Lees',
            write: 'Schrijf',
            exec: 'Uitvoeren',
            original: 'Origineel',
            changes: 'Aanpassingen',
            recursive: 'Recursieve',
            preview: 'Item bekijken',
            open: 'Openen',
            these_elements: 'Deze {{total}} elementen',
            new_folder: 'Nieuwe map',
            download_as_zip: 'Download als ZIP'
        });

        $translateProvider.translations('he', {
            filemanager: '???????? ??????????',
            language: '??????',
            english: '????????????',
            spanish: '????????????',
            portuguese: '??????????????????',
            french: '????????????',
            german: '????????????',
            hebrew: '????????',
            italian: '????????????',
            slovak: '????????????',
            chinese_tw: '?????????? ??????????????',
            chinese_cn: '?????????? ??????????',
            russian: '????????????',
            ukrainian: '????????????????',
            turkish: '??????????',
            persian: '????????????????',
            polish: '??????????',
            confirm: '??????',
            cancel: '??????',
            close: '????????',
            upload_files: '???????? ??????????',
            files_will_uploaded_to: '???????????? ???????? ??',
            select_files: '?????? ??????????',
            uploading: '????????',
            permissions: '????????????',
            select_destination_folder: '?????? ???????????? ??????',
            source: '????????',
            destination: '??????',
            copy_file: '???????? ????????',
            sure_to_delete: '?????? ?????? ???????? ?????????????? ??????????',
            change_name_move: '?????? ???? / ??????',
            enter_new_name_for: '???????? ???? ?????? ????????',
            extract_item: '?????? ????????',
            extraction_started: '?????????? ???????????? ?????????? ????????',
            compression_started: '?????????? ???????????? ?????????? ????????',
            enter_folder_name_for_extraction: '???????? ???? ???????????? ???????????? ????????',
            enter_file_name_for_compression: '?????? ???? ???? ?????????? ???????? ???????????? ????',
            toggle_fullscreen: '????????/?????? ?????? ??????',
            edit_file: '???????? ????????',
            file_content: '???????? ??????????',
            loading: '????????',
            search: '??????',
            create_folder: '?????? ????????????',
            create: '??????',
            folder_name: '???? ????????????',
            upload: '????????',
            change_permissions: '?????? ????????????',
            change: '??????',
            details: '??????????',
            icons: '??????????',
            list: '??????????',
            name: '????',
            size: '????????',
            actions: '????????????',
            date: '??????????',
            selection: '??????????????????',
            no_files_in_folder: '?????? ?????????? ?????????????? ????',
            no_folders_in_folder: '?????????????? ?????? ???????? ?????????? ?????? ????????????',
            select_this: '?????? ???? ????',
            go_back: '???????? ??????????',
            wait: '??????',
            move: '??????',
            download: '????????',
            view_item: '?????? ????????',
            remove: '??????',
            edit: '????????',
            save: '????????',
            copy: '????????',
            rename: '?????? ????',
            extract: '??????',
            compress: '????????',
            error_invalid_filename: '???? ???????? ???????? ???????? ???? ????????, ???????? ???? ???????? ??????',
            error_modifying: '???????????? ?????????? ?????? ?????????? ??????????',
            error_deleting: '???????????? ?????????? ?????? ?????????? ?????????? ???? ??????????????',
            error_renaming: '???????????? ?????????? ?????? ?????????? ???? ??????????',
            error_copying: '???????????? ?????????? ?????? ?????????? ??????????',
            error_compressing: '???????????? ?????????? ?????? ?????????? ?????????? ???? ??????????????',
            error_extracting: '???????????? ?????????? ?????? ?????????? ?????????? ???? ??????????????',
            error_creating_folder: '???????????? ?????????? ?????? ?????????? ??????????????',
            error_getting_content: '???????????? ?????????? ?????? ???????? ???????? ??????????',
            error_changing_perms: '???????????? ?????????? ?????? ?????????? ???????????? ??????????',
            error_uploading_files: '???????????? ?????????? ?????? ?????????? ????????????',
            sure_to_start_compression_with: '?????? ?????? ???????? ?????????????? ??????????',
            owner: '??????????',
            group: '??????????',
            others: '??????????',
            read: '??????????',
            write: '??????????',
            exec: '????????',
            original: '??????????',
            changes: '??????????????',
            recursive: '??????????????',
            preview: '???????? ????????',
            open: '??????',
            new_folder: '?????????? ????????',
            download_as_zip: '???????????? ??????'
        });

        $translateProvider.translations('pt', {
            filemanager: 'Gerenciador de arquivos',
            language: 'L??ngua',
            english: 'Ingl??s',
            spanish: 'Espanhol',
            portuguese: 'Portugues',
            french: 'Franc??s',
            german: 'Alem??o',
            hebrew: 'Hebraico',
            italian: 'Italiano',
            slovak: 'Eslovaco',
            chinese_tw: 'Tradicional Chinesa',
            chinese_cn: 'Chin??s Simplificado',
            russian: 'Russo',
            ukrainian: 'Ucraniano',
            turkish: 'Turco',
            persian: 'Persa',
            polish: 'Polon??s',
            confirm: 'Confirmar',
            cancel: 'Cancelar',
            close: 'Fechar',
            upload_files: 'Carregar arquivos',
            files_will_uploaded_to: 'Os arquivos ser??o enviados para',
            select_files: 'Selecione os arquivos',
            uploading: 'Carregar',
            permissions: 'Autoriza????es',
            select_destination_folder: 'Selecione a pasta de destino',
            source: 'Origem',
            destination: 'Destino',
            copy_file: 'Copiar arquivo',
            sure_to_delete: 'Tem certeza de que deseja apagar',
            change_name_move: 'Renomear / mudan??a',
            enter_new_name_for: 'Digite o novo nome para',
            extract_item: 'Extrair arquivo',
            extraction_started: 'A extra????o come??ou em um processo em segundo plano',
            compression_started: 'A compress??o come??ou em um processo em segundo plano',
            enter_folder_name_for_extraction: 'Digite o nome da pasta para a extra????o de',
            enter_file_name_for_compression: 'Digite o nome do arquivo para a compress??o de',
            toggle_fullscreen: 'Ativar/desativar tela cheia',
            edit_file: 'Editar arquivo',
            file_content: 'Conte??do do arquivo',
            loading: 'Carregando',
            search: 'Localizar',
            create_folder: 'Criar Pasta',
            create: 'Criar',
            folder_name: 'Nome da pasta',
            upload: 'Fazer',
            change_permissions: 'Alterar permiss??es',
            change: 'Alterar',
            details: 'Detalhes',
            icons: 'Icones',
            list: 'Lista',
            name: 'Nome',
            size: 'Tamanho',
            actions: 'A????es',
            date: 'Data',
            selection: 'Sele????o',
            no_files_in_folder: 'N??o h?? arquivos nesta pasta',
            no_folders_in_folder: 'Esta pasta n??o cont??m subpastas',
            select_this: 'Selecione esta',
            go_back: 'Voltar',
            wait: 'Espere',
            move: 'Mover',
            download: 'Baixar',
            view_item: 'Veja o arquivo',
            remove: 'Excluir',
            edit: 'Editar',
            save: 'Editar',
            copy: 'Copiar',
            rename: 'Renomear',
            extract: 'Extrair',
            compress: 'Comprimir',
            error_invalid_filename: 'Nome do arquivo inv??lido ou nome de arquivo j?? existe, especifique outro nome',
            error_modifying: 'Ocorreu um erro ao modificar o arquivo',
            error_deleting: 'Ocorreu um erro ao excluir o arquivo ou pasta',
            error_renaming: 'Ocorreu um erro ao mudar o nome do arquivo',
            error_copying: 'Ocorreu um erro ao copiar o arquivo',
            error_compressing: 'Ocorreu um erro ao comprimir o arquivo ou pasta',
            error_extracting: 'Ocorreu um erro ao extrair o arquivo',
            error_creating_folder: 'Ocorreu um erro ao criar a pasta',
            error_getting_content: 'Ocorreu um erro ao obter o conte??do do arquivo',
            error_changing_perms: 'Ocorreu um erro ao alterar as permiss??es do arquivo',
            error_uploading_files: 'Ocorreu um erro upload de arquivos',
            sure_to_start_compression_with: 'Tem certeza que deseja comprimir',
            owner: 'Propriet??rio',
            group: 'Grupo',
            others: 'Outros',
            read: 'Leitura',
            write: 'Escrita ',
            exec: 'Execu????o',
            original: 'Original',
            changes: 'Mudan??as',
            recursive: 'Recursiva',
            preview: 'Visualiza????o',
            open: 'Abrir',
            these_elements: 'estes {{total}} elements',
            new_folder: 'Nova pasta',
            download_as_zip: 'Download como ZIP'
        });

        $translateProvider.translations('es', {
            filemanager: 'Administrador de archivos',
            language: 'Idioma',
            english: 'Ingles',
            spanish: 'Espa??ol',
            portuguese: 'Portugues',
            french: 'Franc??s',
            german: 'Alem??n',
            hebrew: 'Hebreo',
            italian: 'Italiano',
            slovak: 'Eslovaco',
            chinese_tw: 'Tradicional China',
            chinese_cn: 'Chino Simplificado',
            russian: 'Ruso',
            ukrainian: 'Ucraniano',
            turkish: 'Turco',
            persian: 'Persa',
            polish: 'Polaco',
            confirm: 'Confirmar',
            cancel: 'Cancelar',
            close: 'Cerrar',
            upload_files: 'Subir archivos',
            files_will_uploaded_to: 'Los archivos seran subidos a',
            select_files: 'Seleccione los archivos',
            uploading: 'Subiendo',
            permissions: 'Permisos',
            select_destination_folder: 'Seleccione la carpeta de destino',
            source: 'Origen',
            destination: 'Destino',
            copy_file: 'Copiar archivo',
            sure_to_delete: 'Esta seguro que desea eliminar',
            change_name_move: 'Renombrar / mover',
            enter_new_name_for: 'Ingrese el nuevo nombre para',
            extract_item: 'Extraer archivo',
            extraction_started: 'La extraccion ha comenzado en un proceso de segundo plano',
            compression_started: 'La compresion ha comenzado en un proceso de segundo plano',
            enter_folder_name_for_extraction: 'Ingrese el nombre de la carpeta para la extraccion de',
            enter_file_name_for_compression: 'Ingrese el nombre del archivo para la compresion de',
            toggle_fullscreen: 'Activar/Desactivar pantalla completa',
            edit_file: 'Editar archivo',
            file_content: 'Contenido del archivo',
            loading: 'Cargando',
            search: 'Buscar',
            create_folder: 'Crear carpeta',
            create: 'Crear',
            folder_name: 'Nombre de la carpeta',
            upload: 'Subir',
            change_permissions: 'Cambiar permisos',
            change: 'Cambiar',
            details: 'Detalles',
            icons: 'Iconos',
            list: 'Lista',
            name: 'Nombre',
            size: 'Tama??o',
            actions: 'Acciones',
            date: 'Fecha',
            selection: 'Selecci??n',
            no_files_in_folder: 'No hay archivos en esta carpeta',
            no_folders_in_folder: 'Esta carpeta no contiene sub-carpetas',
            select_this: 'Seleccionar esta',
            go_back: 'Volver',
            wait: 'Espere',
            move: 'Mover',
            download: 'Descargar',
            view_item: 'Ver archivo',
            remove: 'Eliminar',
            edit: 'Editar',
            save: 'Editar',
            copy: 'Copiar',
            rename: 'Renombrar',
            extract: 'Extraer',
            compress: 'Comprimir',
            error_invalid_filename: 'El nombre del archivo es invalido o ya existe',
            error_modifying: 'Ocurrio un error al intentar modificar el archivo',
            error_deleting: 'Ocurrio un error al intentar eliminar el archivo',
            error_renaming: 'Ocurrio un error al intentar renombrar el archivo',
            error_copying: 'Ocurrio un error al intentar copiar el archivo',
            error_compressing: 'Ocurrio un error al intentar comprimir el archivo',
            error_extracting: 'Ocurrio un error al intentar extraer el archivo',
            error_creating_folder: 'Ocurrio un error al intentar crear la carpeta',
            error_getting_content: 'Ocurrio un error al obtener el contenido del archivo',
            error_changing_perms: 'Ocurrio un error al cambiar los permisos del archivo',
            error_uploading_files: 'Ocurrio un error al subir archivos',
            sure_to_start_compression_with: 'Esta seguro que desea comprimir',
            owner: 'Propietario',
            group: 'Grupo',
            others: 'Otros',
            read: 'Lectura',
            write: 'Escritura',
            exec: 'Ejecucion',
            original: 'Original',
            changes: 'Cambios',
            recursive: 'Recursivo',
            preview: 'Vista previa',
            open: 'Abrir',
            these_elements: 'estos {{total}} elementos',
            new_folder: 'Nueva carpeta',
            download_as_zip: 'Descargar como ZIP'
        });

        $translateProvider.translations('fr', {
            filemanager: 'Gestionnaire de fichier',
            language: 'Langue',
            english: 'Anglais',
            spanish: 'Espagnol',
            portuguese: 'Portugais',
            french: 'Fran??ais',
            german: 'Allemand',
            hebrew: 'H??breu',
            italian: 'Italien',
            slovak: 'Slovaque',
            chinese_tw: 'Traditionnelle Chinoise',
            chinese_cn: 'Chinois Simplifi??',
            russian: 'Russe',
            ukrainian: 'Ukrainien',
            turkish: 'Turc',
            persian: 'Persan',
            polish: 'Polonais',
            confirm: 'Confirmer',
            cancel: 'Annuler',
            close: 'Fermer',
            upload_files: 'T??l??charger des fichiers',
            files_will_uploaded_to: 'Les fichiers seront upload?? dans',
            select_files: 'S??lectionnez les fichiers',
            uploading: 'Upload en cours',
            permissions: 'Permissions',
            select_destination_folder: 'S??lectionn?? le dossier de destination',
            source: 'Source',
            destination: 'Destination',
            copy_file: 'Copier le fichier',
            sure_to_delete: '??tes-vous s??r de vouloir supprimer',
            change_name_move: 'Renommer / D??placer',
            enter_new_name_for: 'Entrer le nouveau nom pour',
            extract_item: 'Extraires les ??l??ments',
            extraction_started: 'L\'extraction a d??marr?? en t??che de fond',
            compression_started: 'La compression a d??marr?? en t??che de fond',
            enter_folder_name_for_extraction: 'Entrer le nom du dossier pour l\'extraction de',
            enter_file_name_for_compression: 'Entrez le nom de fichier pour la compression de',
            toggle_fullscreen: 'Basculer en plein ??cran',
            edit_file: '??diter le fichier',
            file_content: 'Contenu du fichier',
            loading: 'Chargement en cours',
            search: 'Recherche',
            create_folder: 'Cr??er un dossier',
            create: 'Cr??er',
            folder_name: 'Nom du dossier',
            upload: 'Upload',
            change_permissions: 'Changer les permissions',
            change: 'Changer',
            details: 'Details',
            icons: 'Icons',
            list: 'Liste',
            name: 'Nom',
            size: 'Taille',
            actions: 'Actions',
            date: 'Date',
            selection: 'S??lection',
            no_files_in_folder: 'Aucun fichier dans ce dossier',
            no_folders_in_folder: 'Ce dossier ne contiens pas de dossier',
            select_this: 'S??lectionner',
            go_back: 'Retour',
            wait: 'Patienter',
            move: 'D??placer',
            download: 'T??l??charger',
            view_item: 'Voir l\'??l??ment',
            remove: 'Supprimer',
            edit: '??diter',
            save: '??diter',
            copy: 'Copier',
            rename: 'Renommer',
            extract: 'Extraire',
            compress: 'Compresser',
            error_invalid_filename: 'Nom de fichier invalide ou d??j?? existant, merci de sp??cifier un autre nom',
            error_modifying: 'Une erreur est survenue pendant la modification du fichier',
            error_deleting: 'Une erreur est survenue pendant la suppression du fichier ou du dossier',
            error_renaming: 'Une erreur est survenue pendant le renommage du fichier',
            error_copying: 'Une erreur est survenue pendant la copie du fichier',
            error_compressing: 'Une erreur est survenue pendant la compression du fichier ou du dossier',
            error_extracting: 'Une erreur est survenue pendant l\'extraction du fichier',
            error_creating_folder: 'Une erreur est survenue pendant la cr??ation du dossier',
            error_getting_content: 'Une erreur est survenue pendant la r??cup??ration du contenu du fichier',
            error_changing_perms: 'Une erreur est survenue pendant le changement des permissions du fichier',
            error_uploading_files: 'Une erreur est survenue pendant l\'upload des fichiers',
            sure_to_start_compression_with: '??tes-vous s??re de vouloir compresser',
            owner: 'Propri??taire',
            group: 'Groupe',
            others: 'Autres',
            read: 'Lecture',
            write: '??criture',
            exec: '??x??cution',
            original: 'Original',
            changes: 'Modifications',
            recursive: 'R??cursif',
            preview: 'Aper??u',
            open: 'Ouvrir',
            these_elements: 'ces {{total}} ??l??ments',
            new_folder: 'Nouveau dossier',
            download_as_zip: 'T??l??charger comme ZIP'
        });

        $translateProvider.translations('de', {
            filemanager: 'Dateimanager',
            language: 'Sprache',
            english: 'Englisch',
            spanish: 'Spanisch',
            portuguese: 'Portugiesisch',
            french: 'Franz??sisch',
            german: 'Deutsch',
            hebrew: 'Hebr??isch',
            italian: 'Italienisch',
            slovak: 'Slowakisch',
            chinese_tw: 'Traditionelles Chinesisch',
            chinese_cn: 'Vereinfachtes Chinesisch',
            russian: 'Russisch',
            ukrainian: 'Ukrainisch',
            turkish: 'T??rkisch',
            persian: 'Persisch',
            polish: 'Polnisch',
            confirm: 'Best??tigen',
            cancel: 'Abbrechen',
            close: 'Schlie??en',
            upload_files: 'Hochladen von Dateien',
            files_will_uploaded_to: 'Dateien werden hochgeladen nach',
            select_files: 'W??hlen Sie die Dateien',
            uploading: 'Lade hoch',
            permissions: 'Berechtigungen',
            select_destination_folder: 'W??hlen Sie einen Zielordner',
            source: 'Quelle',
            destination: 'Ziel',
            copy_file: 'Datei kopieren',
            sure_to_delete: 'Sind Sie sicher, dass Sie die Datei l??schen m??chten?',
            change_name_move: 'Namen ??ndern / verschieben',
            enter_new_name_for: 'Geben Sie den neuen Namen ein f??r',
            extract_item: 'Archiv entpacken',
            extraction_started: 'Entpacken hat im Hintergrund begonnen',
            compression_started: 'Komprimierung hat im Hintergrund begonnen',
            enter_folder_name_for_extraction: 'Geben Sie den Verzeichnisnamen f??r die Entpackung an von',
            enter_file_name_for_compression: 'Geben Sie den Dateinamen f??r die Kompression an von',
            toggle_fullscreen: 'Vollbild umschalten',
            edit_file: 'Datei bearbeiten',
            file_content: 'Dateiinhalt',
            loading: 'Lade',
            search: 'Suche',
            create_folder: 'Ordner erstellen',
            create: 'Erstellen',
            folder_name: 'Verzeichnisname',
            upload: 'Hochladen',
            change_permissions: 'Berechtigungen ??ndern',
            change: '??ndern',
            details: 'Details',
            icons: 'Symbolansicht',
            list: 'Listenansicht',
            name: 'Name',
            size: 'Gr????e',
            actions: 'Aktionen',
            date: 'Datum',
            selection: 'Auswahl',
            no_files_in_folder: 'Keine Dateien in diesem Ordner',
            no_folders_in_folder: 'Dieser Ordner enth??lt keine Unterordner',
            select_this: 'Ausw??hlen',
            go_back: 'Zur??ck',
            wait: 'Warte',
            move: 'Verschieben',
            download: 'Herunterladen',
            view_item: 'Datei ansehen',
            remove: 'L??schen',
            edit: 'Bearbeiten',
            save: 'Bearbeiten',
            copy: 'Kopieren',
            rename: 'Umbenennen',
            extract: 'Entpacken',
            compress: 'Komprimieren',
            error_invalid_filename: 'Ung??ltiger Dateiname oder existiert bereits',
            error_modifying: 'Beim Bearbeiten der Datei ist ein Fehler aufgetreten',
            error_deleting: 'Beim L??schen der Datei oder des Ordners ist ein Fehler aufgetreten',
            error_renaming: 'Beim Umbennenen der Datei ist ein Fehler aufgetreten',
            error_copying: 'Beim Kopieren der Datei ist ein Fehler aufgetreten',
            error_compressing: 'Beim Komprimieren der Datei oder des Ordners ist ein Fehler aufgetreten',
            error_extracting: 'Beim Entpacken der Datei ist ein Fehler aufgetreten',
            error_creating_folder: 'Beim Erstellen des Ordners ist ein Fehler aufgetreten',
            error_getting_content: 'Beim Laden des Dateiinhalts ist ein Fehler aufgetreten',
            error_changing_perms: 'Beim ??ndern der Dateiberechtigungen ist ein Fehler aufgetreten',
            error_uploading_files: 'Beim Hochladen der Dateien ist ein Fehler aufgetreten',
            sure_to_start_compression_with: 'M??chten Sie die Datei wirklich komprimieren?',
            owner: 'Besitzer',
            group: 'Gruppe',
            others: 'Andere',
            read: 'Lesen',
            write: 'Schreiben',
            exec: 'Ausf??hren',
            original: 'Original',
            changes: '??nderungen',
            recursive: 'Rekursiv',
            preview: 'Dateivorschau',
            open: '??ffnen',
            these_elements: 'diese {{total}} elemente',
            new_folder: 'Neuer ordner',
            download_as_zip: 'Download als ZIP'
        });

        $translateProvider.translations('sk', {
            filemanager: 'Spr??vca s??borov',
            language: 'Jazyk',
            english: 'Angli??tina',
            spanish: '??paniel??ina',
            portuguese: 'Portugal??ina',
            french: 'Franc??z??tina',
            german: 'Nem??ina',
            hebrew: 'Hebrej??ina',
            italian: 'Ital??tina',
            slovak: 'Sloven??ina',
            chinese_tw: 'Tradi??n?? ????nska',
            chinese_cn: 'Zjednodu??en?? ????n??tina',
            russian: 'Rusk??',
            ukrainian: 'Ukrajinsk??',
            turkish: 'Tureck??',
            persian: 'Perzsk??',
            polish: 'Po??sk??',
            confirm: 'Potvrdi??',
            cancel: 'Zru??i??',
            close: 'Zavrie??',
            upload_files: 'Nahr??va?? s??bory',
            files_will_uploaded_to: 'S??bory bud?? nahran?? do',
            select_files: 'Vybra?? s??bory',
            uploading: 'Nahr??vanie',
            permissions: 'Opr??vnenia',
            select_destination_folder: 'Vyberte cie??ov?? pr??e??inok',
            source: 'Zdroj',
            destination: 'Cie??',
            copy_file: 'Kop??rova?? s??bor',
            sure_to_delete: 'Ste si ist??, ??e chcete vymaza??',
            change_name_move: 'Premenova?? / Premiestni??',
            enter_new_name_for: 'Zadajte nov?? meno pre',
            extract_item: 'Rozbali?? polo??ku',
            extraction_started: 'Rozba??ovanie za??alo v procese na pozad??',
            compression_started: 'Kompresia za??ala v procese na pzoad??',
            enter_folder_name_for_extraction: 'Zadajte n??zov prie??inka na rozbalenie',
            enter_file_name_for_compression: 'Zadajte n??zov s??boru pre kompresiu',
            toggle_fullscreen: 'Prepn???? re??im na cel?? obrazovku',
            edit_file: 'Upravi?? s??bor',
            file_content: 'Obsah s??boru',
            loading: 'Na????tavanie',
            search: 'H??ada??',
            create_folder: 'Vytvori?? prie??inok',
            create: 'Vytvori??',
            folder_name: 'N??zov prie??inka',
            upload: 'Nahra??',
            change_permissions: 'Zmeni?? opr??vnenia',
            change: 'Zmeni??',
            details: 'Podrobnosti',
            icons: 'Ikony',
            list: 'Zoznam',
            name: 'Meno',
            size: 'Ve??kos??',
            actions: 'Akcie',
            date: 'D??tum',
            selection: 'V??ber',
            no_files_in_folder: 'V tom to prie??inku nie s?? ??iadne s??bory',
            no_folders_in_folder: 'Tento prie??inok neobsahuje ??iadne ??al??ie prie??inky',
            select_this: 'Vybra?? tento',
            go_back: '??s?? sp????',
            wait: 'Po??kajte',
            move: 'Presun????',
            download: 'Stiahnu??',
            view_item: 'Zobrazi?? polo??ku',
            remove: 'Vymaza??',
            edit: 'Upravi??',
            save: 'Upravi??',
            copy: 'Kop??rova??',
            rename: 'Premenova??',
            extract: 'Rozbali??',
            compress: 'Komprimova??',
            error_invalid_filename: 'Neplatn?? alebo duplicitn?? meno s??boru, vyberte in?? meno',
            error_modifying: 'Vyskytla sa chyba pri upravovan?? s??boru',
            error_deleting: 'Vyskytla sa chyba pri mazan?? s??boru alebo prie??inku',
            error_renaming: 'Vyskytla sa chyba pri premenovan?? s??boru',
            error_copying: 'Vyskytla sa chyba pri kop??rovan?? s??boru',
            error_compressing: 'Vyskytla sa chyba pri komprimovan?? s??boru alebo prie??inka',
            error_extracting: 'Vyskytla sa chyba pri rozba??ovan?? s??boru',
            error_creating_folder: 'Vyskytla sa chyba pri vytv??ran?? prie??inku',
            error_getting_content: 'Vyskytla sa chyba pri z??skavan?? obsahu s??boru',
            error_changing_perms: 'Vyskytla sa chyba pri zmene opr??vnen?? s??boru',
            error_uploading_files: 'Vyskytla sa chyba pri nahr??van?? s??borov',
            sure_to_start_compression_with: 'Ste si ist??, ??e chcete komprimova??',
            owner: 'Vlastn??k',
            group: 'Skupina',
            others: 'Ostatn??',
            read: '????tanie',
            write: 'Zapisovanie',
            exec: 'Sp????tanie',
            original: 'Origin??l',
            changes: 'Zmeny',
            recursive: 'Rekurz??vne',
            preview: 'N??h??ad polo??ky',
            open: 'Otvori??',
            these_elements: 't??chto {{total}} prvkov',
            new_folder: 'Nov?? prie??inok',
            download_as_zip: 'Stiahnu?? ako ZIP'
        });

        $translateProvider.translations('zh_cn', {
            filemanager: '???????????????',
            language: '??????',
            english: '??????',
            spanish: '????????????',
            portuguese: '????????????',
            french: '??????',
            german: '??????',
            hebrew: '????????????',
            italian: '?????????',
            slovak: '???????????????',
            chinese_tw: '????????????',
            chinese_cn: '????????????',
            russian: '??????',
            ukrainian: '?????????',
            turkish: '?????????',
            persian: '?????????',
            polish: '?????????',
            confirm: '??????',
            cancel: '??????',
            close: '??????',
            upload_files: '????????????',
            files_will_uploaded_to: '??????????????????',
            select_files: '????????????',
            uploading: '?????????',
            permissions: '??????',
            select_destination_folder: '??????????????????',
            source: '??????',
            destination: '?????????',
            copy_file: '????????????',
            sure_to_delete: '??????????????????',
            change_name_move: '??????????????????',
            enter_new_name_for: '??????????????????',
            extract_item: '??????',
            extraction_started: '???????????????????????????',
            compression_started: '???????????????????????????',
            enter_folder_name_for_extraction: '??????????????????????????????',
            enter_file_name_for_compression: '???????????????????????????',
            toggle_fullscreen: '????????????',
            edit_file: '????????????',
            file_content: '????????????',
            loading: '?????????',
            search: '??????',
            create_folder: '???????????????',
            create: '??????',
            folder_name: '???????????????',
            upload: '??????',
            change_permissions: '????????????',
            change: '??????',
            details: '????????????',
            icons: '??????',
            list: '??????',
            name: '??????',
            size: '??????',
            actions: '??????',
            date: '??????',
            selection: '??????',
            no_files_in_folder: '????????????????????????',
            no_folders_in_folder: '?????????????????????????????????',
            select_this: '???????????????',
            go_back: '??????',
            wait: '??????',
            move: '??????',
            download: '??????',
            view_item: '????????????',
            remove: '??????',
            edit: '??????',
            save: '??????',
            copy: '??????',
            rename: '?????????',
            extract: '??????',
            compress: '??????',
            error_invalid_filename: '????????????????????????????????????, ?????????????????????',
            error_modifying: '??????????????????',
            error_deleting: '??????????????????????????????',
            error_renaming: '?????????????????????',
            error_copying: '??????????????????',
            error_compressing: '??????????????????????????????',
            error_extracting: '??????????????????',
            error_creating_folder: '?????????????????????',
            error_getting_content: '????????????????????????',
            error_changing_perms: '????????????????????????',
            error_uploading_files: '??????????????????',
            sure_to_start_compression_with: '??????????????????',
            owner: '?????????',
            group: '??????',
            others: '??????',
            read: '??????',
            write: '??????',
            exec: '??????',
            original: '??????',
            changes: '??????',
            recursive: '??????',
            preview: '????????????',
            open: '??????',
            these_elements: '??? {{total}} ???',
            new_folder: '????????????',
            download_as_zip: '?????????ZIP'
        });

        $translateProvider.translations('zh_tw', {
            filemanager: '???????????????',
            language: '??????',
            english: '??????',
            spanish: '????????????',
            portuguese: '????????????',
            french: '??????',
            german: '??????',
            hebrew: '????????????',
            italian: '?????????',
            slovak: '???????????????',
            chinese_tw: '????????????',
            chinese_cn: '????????????',
            russian: '??????',
            ukrainian: '?????????',
            turkish: '?????????',
            persian: '?????????',
            polish: '?????????',
            confirm: '??????',
            cancel: '??????',
            close: '??????',
            upload_files: '????????????',
            files_will_uploaded_to: '??????????????????',
            select_files: '????????????',
            uploading: '?????????',
            permissions: '??????',
            select_destination_folder: '??????????????????',
            source: '??????',
            destination: '?????????',
            copy_file: '????????????',
            sure_to_delete: '??????????????????',
            change_name_move: '??????????????????',
            enter_new_name_for: '??????????????????',
            extract_item: '??????',
            extraction_started: '???????????????????????????',
            compression_started: '???????????????????????????',
            enter_folder_name_for_extraction: '??????????????????????????????',
            enter_file_name_for_compression: '????????????????????????',
            toggle_fullscreen: '???????????????',
            edit_file: '????????????',
            file_content: '????????????',
            loading: '?????????',
            search: '??????',
            create_folder: '???????????????',
            create: '??????',
            folder_name: '???????????????',
            upload: '??????',
            change_permissions: '????????????',
            change: '??????',
            details: '????????????',
            icons: '??????',
            list: '??????',
            name: '??????',
            size: '??????',
            actions: '??????',
            date: '??????',
            selection: '??????',
            no_files_in_folder: '????????????????????????',
            no_folders_in_folder: '?????????????????????????????????',
            select_this: '??????????????????',
            go_back: '??????',
            wait: '??????',
            move: '??????',
            download: '??????',
            view_item: '??????',
            remove: '??????',
            edit: '??????',
            save: '??????',
            copy: '??????',
            rename: '????????????',
            extract: '??????',
            compress: '??????',
            error_invalid_filename: '?????????????????????????????????, ?????????????????????',
            error_modifying: '??????????????????',
            error_deleting: '??????????????????????????????',
            error_renaming: '????????????????????????',
            error_copying: '??????????????????',
            error_compressing: '??????????????????????????????',
            error_extracting: '??????????????????',
            error_creating_folder: '?????????????????????',
            error_getting_content: '????????????????????????',
            error_changing_perms: '????????????????????????',
            error_uploading_files: '??????????????????',
            sure_to_start_compression_with: '??????????????????',
            owner: '?????????',
            group: '??????',
            others: '??????',
            read: '??????',
            write: '??????',
            exec: '??????',
            original: '??????',
            changes: '?????????',
            recursive: '????????????????????????',
            preview: '??????',
            open: '??????',
            these_elements: '??? {{total}} ???',
            new_folder: '????????????',
            download_as_zip: '???ZIP??????'
        });

        $translateProvider.translations('ru', {
            filemanager: '???????????????? ????????????????',
            language: '????????',
            english: '????????????????????',
            spanish: '??????????????????',
            portuguese: '??????????????????????????',
            french: '????????????????????',
            german: '????????????????',
            hebrew: '??????????',
            italian: '??????????????????????',
            slovak: '??????????????????',
            chinese_tw: '???????????????????????? ??????????????????',
            chinese_cn: '???????????????????? ??????????????????',
            russian: '??????????????',
            ukrainian: '????????????????',
            turkish: '????????????????',
            persian: '????????????????????',
            polish: '????????????????',
            confirm: '??????????????????????',
            cancel: '????????????????',
            close: '??????????????',
            upload_files: '???????????????? ????????????',
            files_will_uploaded_to: '?????????? ?????????? ?????????????????? ??: ',
            select_files: '???????????????? ??????????',
            uploading: '????????????????',
            permissions: '????????????????????',
            select_destination_folder: '???????????????? ?????????? ????????????????????',
            source: '????????????????',
            destination: '????????',
            copy_file: '?????????????????????? ????????',
            sure_to_delete: '?????????????????????????? ???????????????',
            change_name_move: '?????????????????????????? / ??????????????????????',
            enter_new_name_for: '?????????? ?????? ??????',
            extract_item: '??????????????',
            extraction_started: '???????????????????? ????????????',
            compression_started: '???????????? ????????????',
            enter_folder_name_for_extraction: '?????????????? ?? ?????????????????? ??????????',
            enter_file_name_for_compression: '?????????????? ?????? ????????????',
            toggle_fullscreen: '???? ???????? ??????????',
            edit_file: '??????????????????????????',
            file_content: '???????????????????? ??????????',
            loading: '????????????????',
            search: '??????????',
            create_folder: '?????????????? ??????????',
            create: '??????????????',
            folder_name: '?????? ??????????',
            upload: '??????????????????',
            change_permissions: '???????????????? ????????????????????',
            change: '????????????????',
            details: '????????????????',
            icons: '????????????',
            list: '????????????',
            name: '??????',
            size: '????????????',
            actions: '????????????????',
            date: '????????',
            selection: '??????????',
            no_files_in_folder: '???????????? ??????????',
            no_folders_in_folder: '???????????? ??????????',
            select_this: '??????????????',
            go_back: '??????????',
            wait: '??????????????????',
            move: '??????????????????????',
            download: '??????????????',
            view_item: '???????????????????? ????????????????????',
            remove: '??????????????',
            edit: '??????????????????????????',
            save: '??????????????????????????',
            copy: '??????????????????????',
            rename: '??????????????????????????',
            extract: '??????????????',
            compress: '??????????',
            error_invalid_filename: '?????? ???????????????? ?????? ?????? ????????????????????, ???????????????? ????????????',
            error_modifying: '?????????????????? ???????????? ?????? ?????????????????????????????? ??????????',
            error_deleting: '?????????????????? ???????????? ?????? ????????????????',
            error_renaming: '?????????????????? ???????????? ?????? ???????????????????????????? ??????????',
            error_copying: '?????????????????? ???????????? ?????? ?????????????????????? ??????????',
            error_compressing: '?????????????????? ???????????? ?????? ????????????',
            error_extracting: '?????????????????? ???????????? ?????? ????????????????????',
            error_creating_folder: '?????????????????? ???????????? ?????? ???????????????? ??????????',
            error_getting_content: '?????????????????? ???????????? ?????? ?????????????????? ??????????????????????',
            error_changing_perms: '?????????????????? ???????????? ?????? ?????????????????? ????????????????????',
            error_uploading_files: '?????????????????? ???????????? ?????? ????????????????',
            sure_to_start_compression_with: '?????????????????????????? ??????????',
            owner: '????????????????',
            group: '????????????',
            others: '????????????',
            read: '????????????',
            write: '????????????',
            exec: '????????????????????',
            original: '????-??????????????????',
            changes: '??????????????????',
            recursive: '????????????????????',
            preview: '????????????????',
            open: '??????????????',
            these_elements: '?????????? {{total}} ??????????????????',
            new_folder: '?????????? ??????????',
            download_as_zip: 'Download as ZIP'
        });

        $translateProvider.translations('ua', {
            filemanager: '???????????????? ????????????????',
            language: '????????',
            english: '????????????????????',
            spanish: '??????????????????',
            portuguese: '??????????????????????????',
            french: '????????????????????',
            german: '????????????????',
            hebrew: '??????????',
            italian: '??????????????????????',
            slovak: '??????????????????',
            chinese_tw: '?????????????????????? ????????????????????',
            chinese_cn: 'C?????????????? ??????????????????',
            russian: '????????????????????',
            ukrainian: '??????????????????????',
            turkish: '????????????????',
            persian: '????????????????',
            polish: '????????????????',
            confirm: '??????????????????????',
            cancel: '??????????????????',
            close: '??????????????',
            upload_files: '???????????????????????? ????????????',
            files_will_uploaded_to: '?????????? ???????????? ?????????????????????? ??: ',
            select_files: '???????????????? ??????????',
            uploading: '????????????????????????',
            permissions: '??????????????',
            select_destination_folder: '???????????????? ?????????? ??????????????????????',
            source: '??????????????',
            destination: '????????',
            copy_file: '???????????????????? ????????',
            sure_to_delete: '???????????? ???????????????',
            change_name_move: '?????????????????????????? / ??????????????????????',
            enter_new_name_for: '???????? ????\'?? ??????',
            extract_item: '??????????????',
            extraction_started: '???????????????????? ????????????',
            compression_started: '?????????????????? ????????????',
            enter_folder_name_for_extraction: '?????????????? ?? ?????????????????? ??????????',
            enter_file_name_for_compression: '?????????????? ?????? ????????????',
            toggle_fullscreen: '???? ???????? ??????????',
            edit_file: '????????????????????',
            file_content: '?????????? ??????????',
            loading: '????????????????????????',
            search: '??????????',
            create_folder: '???????????????? ??????????',
            create: '????????????????',
            folder_name: '????\'??  ??????????',
            upload: '??????????????????????',
            change_permissions: '?????????????? ??????????????',
            change: '????????????????????',
            details: '??????????????????????',
            icons: '????????????',
            list: '????????????',
            name: '????\'??',
            size: '????????????',
            actions: '??????',
            date: '????????',
            selection: '??????????',
            no_files_in_folder: '?????????? ??????????',
            no_folders_in_folder: '?????????? ??????????',
            select_this: '??????????????',
            go_back: '??????????',
            wait: '??????????????????',
            move: '??????????????????????',
            download: '??????????????',
            view_item: '???????????????? ??????????',
            remove: '????????????????',
            edit: '????????????????????',
            save: '????????????????????',
            copy: '??????????????????',
            rename: '??????????????????????????',
            extract: '??????????????????????????',
            compress: '????????????????????',
            error_invalid_filename: '????\'?? ?????????????? ?????? ?????? ??????????, ???????????????? ????????',
            error_modifying: '?????????????? ?????????????? ?????? ?????????????????????? ??????????',
            error_deleting: '?????????????? ?????????????? ?????? ??????????????????',
            error_renaming: '?????????????? ?????????????? ?????? ?????????? ?????????? ??????????',
            error_copying: '?????????????? ?????????????? ?????? ???????????????????? ??????????',
            error_compressing: '?????????????? ?????????????? ?????? ??????????????????',
            error_extracting: '?????????????? ?????????????? ?????? ????????????????????????',
            error_creating_folder: '?????????????? ?????????????? ?????? ?????????????????? ??????????',
            error_getting_content: '?????????????? ?????????????? ?????? ?????????????????? ????????????',
            error_changing_perms: '?????????????? ?????????????? ?????? ?????????? ????????????????',
            error_uploading_files: '?????????????? ?????????????? ?????? ????????????????????????',
            sure_to_start_compression_with: '???????????? ????????????????',
            owner: '??????????????',
            group: '??????????',
            others: '????????',
            read: '??????????????',
            write: '??????????',
            exec: '??????????????????',
            original: '???? ??????????????????????????',
            changes: '??????????',
            recursive: '????????????????????',
            preview: '????????????????',
            open: '????????????????',
            these_elements: '???????????? {{total}} ??????????????????',
            new_folder: '???????? ??????????',
            download_as_zip: 'Download as ZIP'
        });

        $translateProvider.translations('tr', {
            filemanager: 'Dosya Y??neticisi',
            language: 'Dil',
            english: '??ngilizce',
            spanish: '??spanyolca',
            portuguese: 'Portekizce',
            french: 'Frans??zca',
            german: 'Almanca',
            hebrew: '??branice',
            italian: '??talyanca',
            slovak: 'Slovak??a',
            chinese_tw: 'Geleneksel ??in',
            chinese_cn: 'Basitle??tirilmi?? ??ince',
            russian: 'Rus??a',
            ukrainian: 'Ukraynaca',
            turkish: 'T??rk??e',
            persian: 'Fars??a',
            polish: 'Leh??e',
            confirm: 'Onayla',
            cancel: '??ptal Et',
            close: 'Kapat',
            upload_files: 'Dosya y??kle',
            files_will_uploaded_to: 'Dosyalar y??klenecektir.',
            select_files: 'Dosya Se??',
            uploading: 'Y??kleniyor',
            permissions: '??zinler',
            select_destination_folder: 'Hedef klas??r se??in',
            source: 'Kaynak',
            destination: 'Hedef',
            copy_file: 'Dosyay?? kopyala',
            sure_to_delete: 'Silmek istedi??inden emin misin',
            change_name_move: '??smini de??i??tir / ta????',
            enter_new_name_for: 'Yeni ad girin',
            extract_item: 'Dosya ????kar',
            extraction_started: '????karma i??lemi arkaplanda devam ediyor',
            compression_started: 'S??k????t??rma i??lemi arkaplanda ba??lad??',
            enter_folder_name_for_extraction: '????kar??lmas?? i??in klas??r ad?? girin',
            enter_file_name_for_compression: 'S??k????t??r??lmas?? i??in dosya ad?? girin',
            toggle_fullscreen: 'Tam ekran moduna ge??',
            edit_file: 'Dosyay?? d??zenle',
            file_content: 'Dosya i??eri??i',
            loading: 'Y??kleniyor',
            search: 'Ara',
            create_folder: 'Klas??r olu??tur',
            create: 'Olu??tur',
            folder_name: 'Klas??r ad??',
            upload: 'Y??kle',
            change_permissions: '??zinleri de??i??tir',
            change: 'De??i??tir',
            details: 'Detaylar',
            icons: 'simgeler',
            list: 'Liste',
            name: 'Ad??',
            size: 'Boyutu',
            actions: '????lemler',
            date: 'Tarih',
            selection: 'Se??im',
            no_files_in_folder: 'Klas??rde hi?? dosya yok',
            no_folders_in_folder: 'Bu klas??r alt klas??r i??ermez',
            select_this: 'Bunu se??',
            go_back: 'Geri git',
            wait: 'Bekle',
            move: 'Ta????',
            download: '??ndir',
            view_item: 'Dosyay?? g??r??nt??le',
            remove: 'Sil',
            edit: 'D??zenle',
            save: 'D??zenle',
            copy: 'Kopyala',
            rename: 'Yeniden Adland??r',
            extract: '????kart',
            compress: 'S??k????t??r',
            error_invalid_filename: 'Ge??ersiz dosya ad??, bu dosya ad??na sahip dosya mevcut',
            error_modifying: 'Dosya d??zenlenirken bir hata olu??tu',
            error_deleting: 'Klas??r veya dosya silinirken bir hata olu??tu',
            error_renaming: 'Dosya yeniden adland??r??l??rken bir hata olu??tu',
            error_copying: 'Dosya kopyalan??rken bir hata olu??tu',
            error_compressing: 'Dosya veya klas??r s??k????t??r??l??rken bir hata olu??tu',
            error_extracting: '????kart??l??rken bir hata olu??tu',
            error_creating_folder: 'Klas??r olu??turulurken bir hata olu??tu',
            error_getting_content: 'Dosya detaylar?? al??n??rken bir hata olu??tu',
            error_changing_perms: 'Dosyan??n izini de??i??tirilirken bir hata olu??tu',
            error_uploading_files: 'Dosyalar y??klenirken bir hata olu??tu',
            sure_to_start_compression_with: 'S??k????t??rmak istedi??inden emin misin',
            owner: 'Sahip',
            group: 'Grup',
            others: 'Di??erleri',
            read: 'Okuma',
            write: 'Yazma',
            exec: 'Ger??ekle??tir',
            original: 'Orjinal',
            changes: 'De??i??iklikler',
            recursive: 'Yinemeli',
            preview: 'Dosyay?? ??nizle',
            open: 'A??',
            these_elements: '{{total}} eleman',
            new_folder: 'Yeni Klas??r',
            download_as_zip: 'ZIP olarak indir'
        });

        $translateProvider.translations('fa', {
            filemanager: '???????????? ???????? ????',
            language: '????????',
            english: '??????????????',
            spanish: '??????????????????',
            portuguese: '??????????????',
            french: '????????????',
            german: '????????????',
            hebrew: '????????',
            italian: '??????????????????',
            slovak: '????????????',
            chinese_tw: '???????? ????????',
            chinese_cn: '???????? ???????? ??????',
            russian: '????????',
            ukrainian: '????????????????',
            turkish: '????????',
            persian: '??????????',
            polish: '??????????????',
            confirm: '??????????',
            cancel: '????',
            close: '????????',
            upload_files: '?????????? ????????',
            files_will_uploaded_to: '???????? ???? ?????????? ???? ???????? ????',
            select_files: '???????????? ???????? ????',
            uploading: '???? ?????? ??????????',
            permissions: '???????? ????',
            select_destination_folder: '???????? ???????? ???? ???????????? ????????',
            source: '????????',
            destination: '????????',
            copy_file: '?????? ????????',
            sure_to_delete: '?????????? ?????????? ???? ???????????? ?????? ??????????',
            change_name_move: '?????????? ?????? ?? ??????????????',
            enter_new_name_for: '?????? ?????????? ???????? ???????? ????????',
            extract_item: '???????? ???????? ???? ???????? ??????????',
            extraction_started: '???? ?????????? ???? ???? ?????????? ???????? ???? ???????? ???????? ???? ???????? ?????????? ??????',
            compression_started: '???? ?????????? ???? ???? ?????????? ???????? ???? ?????????? ???????? ??????',
            enter_folder_name_for_extraction: '?????? ???????? ???????? ???????? ???????? ???????? ???? ???????? ?????????? ???? ???????? ????????',
            enter_file_name_for_compression: '?????? ???????? ???????? ???????? ?????????? ???????? ???? ???????? ????????',
            toggle_fullscreen: '?????????? ???????? ???????? ????????',
            edit_file: '????????????',
            file_content: '??????????????',
            loading: '???? ?????? ????????????????',
            search: '??????????',
            create_folder: '???????? ????????',
            create: '??????????',
            folder_name: '?????? ????????',
            upload: '??????????',
            change_permissions: '?????????? ???????? ????',
            change: '??????????',
            details: '????????????',
            icons: '?????????? ????',
            list: '????????',
            name: '??????',
            size: '????????',
            actions: '??????????',
            date: '??????????',
            selection: '????????????',
            no_files_in_folder: '?????? ?????????? ???? ?????? ???????? ????????',
            no_folders_in_folder: '?????? ???????? ???? ???????? ?????? ???????? ???????? ??????????',
            select_this: '????????????',
            go_back: '????????????',
            wait: '?????????? ????????????',
            move: '??????????????',
            download: '????????????',
            view_item: '???????????? ?????? ????????',
            remove: '??????',
            edit: '????????????',
            save: '????????????',
            copy: '??????',
            rename: '?????????? ??????',
            extract: '???????? ???? ???????? ??????????',
            compress: '?????????? ????????',
            error_invalid_filename: '?????? ???????? ???????? ???????? ???????? ?? ???? ???????? ?????????????? ?????? ???????? ???????? ?????? ?????????? ???????? ????????',
            error_modifying: '???? ?????????? ?????????? ???????? ?????????? ?????? ??????',
            error_deleting: '???? ?????????? ?????? ???????? ?????????? ?????? ??????',
            error_renaming: '???? ?????????? ?????????? ?????? ???????? ?????????? ?????? ??????',
            error_copying: '???? ?????????? ?????? ???????? ???????? ?????????? ?????? ??????',
            error_compressing: '???? ?????????? ?????????? ???????? ???????? ?????????? ?????? ??????',
            error_extracting: '???? ?????????? ???????? ???????? ???????? ???? ???????? ?????????? ?????????? ?????? ??????',
            error_creating_folder: '???? ?????????? ???????? ???????? ?????????? ?????? ??????',
            error_getting_content: '???? ?????????? ???????????????? ?????????????? ???????? ?????????? ???? ??????',
            error_changing_perms: '???? ?????????? ?????????? ???????? ?????? ???????? ?????????? ???? ??????',
            error_uploading_files: '???? ?????????? ???????? ?????????? ???? ??????',
            sure_to_start_compression_with: '?????????? ?????????? ?????????? ???????? ?????????? ??????',
            owner: '???????? ????????',
            group: '????????',
            others: '????????????',
            read: '????????????',
            write: '??????????',
            exec: '???????? ????????',
            original: '????????',
            changes: '??????????????',
            recursive: '??????????????',
            preview: '?????? ??????????',
            open: '?????? ????????',
            these_elements: '?????????? {{total}} ????????',
            new_folder: '???????? ????????',
            download_as_zip: '???? ?????????? ???????? ?????????? ???????????? ??????'
        });

        $translateProvider.translations('pl', {
            filemanager: 'Menad??er plik??w',
            language: 'J??zyk',
            english: 'Angielski',
            spanish: 'Hiszpa??ski',
            portuguese: 'Portugalski',
            french: 'Francuski',
            german: 'Niemiecki',
            hebrew: 'Hebrajski',
            italian: 'W??oski',
            slovak: 'S??owacki',
            chinese_tw: 'Tradycyjny Chi??ski',
            chinese_cn: 'Chi??ski Uproszczony',
            russian: 'Rosyjski',
            ukrainian: 'Ukrai??ski',
            turkish: 'Turecki',
            persian: 'Perski',
            polish: 'Polski',
            confirm: 'Potwierd??',
            cancel: 'Anuluj',
            close: 'Zamknij',
            upload_files: 'Wgraj pliki',
            files_will_uploaded_to: 'Pliki b??d?? umieszczone w katalogu',
            select_files: 'Wybierz pliki',
            uploading: '??adowanie',
            permissions: 'Uprawnienia',
            select_destination_folder: 'Wybierz folder docelowy',
            source: '??r??d??o',
            destination: 'Cel',
            copy_file: 'Kopiuj plik',
            sure_to_delete: 'Jeste?? pewien, ??e chcesz skasowa??',
            change_name_move: 'Zmie?? nazw?? / przenie??',
            enter_new_name_for: 'Wpisz now?? nazw?? dla',
            extract_item: 'Rozpakuj element',
            extraction_started: 'Rozpakowywanie rozpocz????o si?? w tle',
            compression_started: 'Kompresowanie rozpocz????o si?? w tle',
            enter_folder_name_for_extraction: 'Wpisz nazw?? folderu do rozpakowania',
            enter_file_name_for_compression: 'Wpisz nazw?? folderu do skompresowania',
            toggle_fullscreen: 'Tryb pe??noekranowy',
            edit_file: 'Edytuj plik',
            file_content: 'Zawarto???? pliku',
            loading: '??adowanie',
            search: 'Szukaj',
            create_folder: 'Stw??rz folder',
            create: 'Utw??rz',
            folder_name: 'Nazwa folderu',
            upload: 'Wgraj',
            change_permissions: 'Zmie?? uprawnienia',
            change: 'Zmie??',
            details: 'Szczeg????y',
            icons: 'Ikony',
            list: 'Lista',
            name: 'Nazwa',
            size: 'Rozmiar',
            actions: 'Akcje',
            date: 'Data',
            selection: 'Zaznaczone',
            no_files_in_folder: 'Brak plik??w w tym folderze',
            no_folders_in_folder: 'Ten folder nie zawiera podfolder??w',
            select_this: 'Wybierz ten',
            go_back: 'W g??r??',
            wait: 'Wait',
            move: 'Przenie??',
            download: 'Pobierz',
            view_item: 'Wy??wietl',
            remove: 'Usu??',
            edit: 'Edycja',
            save: 'Edycja',
            copy: 'Kopiuj',
            rename: 'Zmie?? nazw??',
            extract: 'Rozpakuj',
            compress: 'Skompresuj',
            error_invalid_filename: 'B????dna nazwa pliku lub plik o takiej nazwie ju?? istnieje, prosz?? u??y?? innej nazwy',
            error_modifying: 'Wyst??pi?? b????d podczas modyfikowania pliku',
            error_deleting: 'Wyst??pi?? b????d podczas usuwania pliku lub folderu',
            error_renaming: 'Wyst??pi?? b????d podczas zmiany nazwy pliku',
            error_copying: 'Wyst??pi?? b????d podczas kopiowania pliku',
            error_compressing: 'Wyst??pi?? b????d podczas kompresowania pliku lub folderu',
            error_extracting: 'Wyst??pi?? b????d podczas rozpakowywania pliku',
            error_creating_folder: 'Wyst??pi?? b????d podczas tworzenia nowego folderu',
            error_getting_content: 'Wyst??pi?? b????d podczas pobierania zawarto??ci pliku',
            error_changing_perms: 'Wyst??pi?? b????d podczas zmiany uprawnie?? pliku',
            error_uploading_files: 'Wyst??pi?? b????d podczas wgrywania plik??w',
            sure_to_start_compression_with: 'Jeste?? pewien, ??e chcesz skompresowa??',
            owner: 'W??a??ciciel',
            group: 'Grupa',
            others: 'Inni',
            read: 'Odczyt',
            write: 'Zapis',
            exec: 'Wykonywanie',
            original: 'Orygina??',
            changes: 'Zmiany',
            recursive: 'Rekursywnie',
            preview: 'Podgl??d elementu',
            open: 'Otw??rz',
            these_elements: 'te {{total}} elementy?',
            new_folder: 'Nowy folder',
            download_as_zip: 'Pobierz jako ZIP'
        });

        $translateProvider.translations('it', {
            filemanager: 'Gestore File',
            language: 'Lingua',
            english: 'Inglese',
            spanish: 'Spagnolo',
            portuguese: 'Portoghese',
            french: 'Francese',
            german: 'Tedesco',
            hebrew: 'Ebraico',
            slovak: 'Slovacco',
            chinese_tw: 'Cinese Tradizionale',
            chinese_cn: 'Cinese',
            russian: 'Russo',
            ukrainian: 'Ucraino',
            turkish: 'Turco',
            persian: 'Persiano',
            polish: 'Polacco',
            confirm: 'Conferma',
            cancel: 'Annulla',
            close: 'Chiudi',
            upload_files: 'Carica files',
            files_will_uploaded_to: 'I files saranno caricati in',
            select_files: 'Seleziona i files',
            uploading: 'Trasferimento',
            permissions: 'Permessi',
            select_destination_folder: 'Select carterlla di destinazione',
            source: 'Sorgente',
            destination: 'Destinazione',
            copy_file: 'Copia file',
            sure_to_delete: 'Sicuro di voler eliminare',
            change_name_move: 'Rinomina / sposta',
            enter_new_name_for: 'Inserisci nuovo nome per',
            extract_item: 'Estrai elemento',
            extraction_started: 'Decompressione avviata da un processo in background',
            compression_started: 'Compressione avviata da un processo in background',
            enter_folder_name_for_extraction: 'Inserisci nome cartella per l\'estrazione di',
            enter_file_name_for_compression: 'Inserisci nome file per la compressione di',
            toggle_fullscreen: 'Passa a schermo intero',
            edit_file: 'Modifica file',
            file_content: 'Contenuto del file',
            loading: 'Caricamento',
            search: 'Cerca',
            create_folder: 'Crea cartella',
            create: 'Crea',
            folder_name: 'Nome cartella',
            upload: 'Upload',
            change_permissions: 'Modifica permessi',
            change: 'Modifica',
            details: 'Dettagli',
            icons: 'Icone',
            list: 'Lista',
            name: 'Nome',
            size: 'Dimensione',
            actions: 'Azioni',
            date: 'Data',
            selection: 'Selezione',
            no_files_in_folder: 'Nessun file nella cartella',
            no_folders_in_folder: 'Questa cartella non contiene altre cartelle',
            select_this: 'Seleziona questo',
            go_back: 'Indietro',
            wait: 'Attendere',
            move: 'Sposta',
            download: 'Scarica',
            view_item: 'Visualizza elemento',
            remove: 'Elimina',
            edit: 'Modifica',
            save: 'Modifica',
            copy: 'Copia',
            rename: 'Rinomina',
            extract: 'Estrai',
            compress: 'Comprimi',
            error_invalid_filename: 'Nome file non valido o gi?? esistente, specificarne un\'altro',
            error_modifying: 'Errore durante la modifica del file',
            error_deleting: 'Errore durante l\'eliminazione del file o della cartella',
            error_renaming: 'Errore durante la rinomina del file',
            error_copying: 'Errore durante la copia del file',
            error_compressing: 'Errore durante la compressione del file o della cartella',
            error_extracting: 'Errore durante l\'estrazione del file',
            error_creating_folder: 'Errore nella creazione della cartella',
            error_getting_content: 'Errore nel recupero del contenuto del file',
            error_changing_perms: 'Errore durante la modifica dei permessi del file',
            error_uploading_files: 'Errore durante il trasferimento dei files',
            sure_to_start_compression_with: 'Sicuro di voler comprimere',
            owner: 'Proprietario',
            group: 'Gruppo',
            others: 'Altri',
            read: 'Lettura',
            write: 'Scrittura',
            exec: 'Esecuzione',
            original: 'Originario',
            changes: 'Cambiamenti',
            recursive: 'Ricorsivo',
            preview: 'Anteprima',
            open: 'Apri',
            these_elements: 'questi {{total}} elementi',
            new_folder: 'Nuova cartella',
            download_as_zip: 'Scarica come file ZIP'
        });

    }]);
})(angular);
(function (angular) {
    'use strict';
    var app = angular.module('FileManagerApp');

    app.filter('strLimit', ['$filter', function ($filter) {
        return function (input, limit, more) {
            if (input.length <= limit) {
                return input;
            }
            return $filter('limitTo')(input, limit) + (more || '...');
        };
    }]);

    app.filter('fileExtension', ['$filter', function ($filter) {
        return function (input) {
            return /\./.test(input) && $filter('strLimit')(input.split('.').pop(), 3, '..') || '';
        };
    }]);

    app.filter('formatDate', ['$filter', function () {
        return function (input) {
            return input instanceof Date ?
                input.toISOString().substring(0, 19).replace('T', ' ') :
                (input.toLocaleString || input.toString).apply(input);
        };
    }]);

    app.filter('humanReadableFileSize', ['$filter', 'fileManagerConfig', function ($filter, fileManagerConfig) {
        // See https://en.wikipedia.org/wiki/Binary_prefix
        var decimalByteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
        var binaryByteUnits = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

        return function (input) {
            var i = -1;
            var fileSizeInBytes = input;

            do {
                fileSizeInBytes = fileSizeInBytes / 1024;
                i++;
            } while (fileSizeInBytes > 1024);

            var result = fileManagerConfig.useBinarySizePrefixes ? binaryByteUnits[i] : decimalByteUnits[i];
            return Math.max(fileSizeInBytes, 0.1).toFixed(1) + ' ' + result;
        };
    }]);
})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').service('apiHandler', ['$http', '$q', '$window', '$translate', '$httpParamSerializer', 'Upload',
        function ($http, $q, $window, $translate, $httpParamSerializer, Upload) {

            $http.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

            var ApiHandler = function () {
                this.inprocess = false;
                this.asyncSuccess = false;
                this.error = '';
            };

            ApiHandler.prototype.deferredHandler = function (data, deferred, code, defaultMsg) {
                if (!data || typeof data !== 'object') {
                    this.error = 'Error %s - Bridge response error, please check the API docs or this ajax response.'.replace('%s', code);
                }
                if (code == 404) {
                    this.error = 'Error 404 - Backend bridge is not working, please check the ajax response.';
                }
                if (data.result && data.result.error) {
                    this.error = data.result.error;
                }
                if (!this.error && data.error) {
                    this.error = data.error.message;
                }
                if (!this.error && defaultMsg) {
                    this.error = defaultMsg;
                }
                if (this.error) {
                    return deferred.reject(data);
                }
                return deferred.resolve(data);
            };

            ApiHandler.prototype.list = function (apiUrl, path, customDeferredHandler, exts) {
                var self = this;
                var dfHandler = customDeferredHandler || self.deferredHandler;
                var deferred = $q.defer();
                var data = {
                    action: 'list',
                    path: path,
                    fileExtensions: exts && exts.length ? exts : undefined
                };

                self.inprocess = true;
                self.error = '';

                $http.post(apiUrl, data).then(function (response) {
                    dfHandler(response.data, deferred, response.status);
                }, function (response) {
                    dfHandler(response.data, deferred, response.status, 'Unknown error listing, check the response');
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.copy = function (apiUrl, items, path, singleFilename) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'copy',
                    items: items,
                    newPath: path
                };

                if (singleFilename && items.length === 1) {
                    data.singleFilename = singleFilename;
                }

                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_copying'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.move = function (apiUrl, items, path) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'move',
                    items: items,
                    newPath: path
                };
                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_moving'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.remove = function (apiUrl, items) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'remove',
                    items: items
                };

                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_deleting'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.upload = function (apiUrl, destination, files) {
                var self = this;
                var deferred = $q.defer();
                self.inprocess = true;
                self.progress = 0;
                self.error = '';

                var data = {
                    destination: destination
                };

                for (var i = 0; i < files.length; i++) {
                    data['file-' + i] = files[i];
                }

                if (files && files.length) {
                    Upload.upload({
                        url: apiUrl,
                        data: data
                    }).then(function (data) {
                        self.deferredHandler(data.data, deferred, data.status);
                    }, function (data) {
                        self.deferredHandler(data.data, deferred, data.status, 'Unknown error uploading files');
                    }, function (evt) {
                        self.progress = Math.min(100, parseInt(100.0 * evt.loaded / evt.total)) - 1;
                    })['finally'](function () {
                        self.inprocess = false;
                        self.progress = 0;
                    });
                }

                return deferred.promise;
            };

            ApiHandler.prototype.getContent = function (apiUrl, itemPath) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'getContent',
                    item: itemPath
                };

                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_getting_content'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.edit = function (apiUrl, itemPath, content) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'edit',
                    item: itemPath,
                    content: content
                };

                self.inprocess = true;
                self.error = '';

                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_modifying'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.rename = function (apiUrl, itemPath, newPath) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'rename',
                    item: itemPath,
                    newItemPath: newPath
                };
                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_renaming'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.getUrl = function (apiUrl, path) {
                var data = {
                    action: 'download',
                    path: path
                };
                return path && [apiUrl, $httpParamSerializer(data)].join('?');
            };

            ApiHandler.prototype.download = function (apiUrl, itemPath, toFilename, downloadByAjax, forceNewWindow) {
                var self = this;
                var url = this.getUrl(apiUrl, itemPath);

                if (!downloadByAjax || forceNewWindow || !$window.saveAs) {
                    !$window.saveAs && $window.console.log('Your browser dont support ajax download, downloading by default');
                    return !!$window.open(url, '_blank', '');
                }

                var deferred = $q.defer();
                self.inprocess = true;
                $http.get(url).then(function (response) {
                    var bin = new $window.Blob([response.data]);
                    deferred.resolve(response.data);
                    $window.saveAs(bin, toFilename);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_downloading'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.downloadMultiple = function (apiUrl, items, toFilename, downloadByAjax, forceNewWindow) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'downloadMultiple',
                    items: items,
                    toFilename: toFilename
                };
                var url = [apiUrl, $httpParamSerializer(data)].join('?');

                if (!downloadByAjax || forceNewWindow || !$window.saveAs) {
                    !$window.saveAs && $window.console.log('Your browser dont support ajax download, downloading by default');
                    return !!$window.open(url, '_blank', '');
                }

                self.inprocess = true;
                $http.get(apiUrl).then(function (response) {
                    var bin = new $window.Blob([response.data]);
                    deferred.resolve(response.data);
                    $window.saveAs(bin, toFilename);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_downloading'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.compress = function (apiUrl, items, compressedFilename, path) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'compress',
                    items: items,
                    destination: path,
                    compressedFilename: compressedFilename
                };

                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_compressing'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.extract = function (apiUrl, item, folderName, path) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'extract',
                    item: item,
                    destination: path,
                    folderName: folderName
                };

                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_extracting'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.changePermissions = function (apiUrl, items, permsOctal, permsCode, recursive) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'changePermissions',
                    items: items,
                    perms: permsOctal,
                    permsCode: permsCode,
                    recursive: !!recursive
                };

                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_changing_perms'));
                })['finally'](function () {
                    self.inprocess = false;
                });
                return deferred.promise;
            };

            ApiHandler.prototype.createFolder = function (apiUrl, path) {
                var self = this;
                var deferred = $q.defer();
                var data = {
                    action: 'createFolder',
                    newPath: path
                };

                self.inprocess = true;
                self.error = '';
                $http.post(apiUrl, data).then(function (response) {
                    self.deferredHandler(response.data, deferred, response.status);
                }, function (response) {
                    self.deferredHandler(response.data, deferred, response.status, $translate.instant('error_creating_folder'));
                })['finally'](function () {
                    self.inprocess = false;
                });

                return deferred.promise;
            };

            return ApiHandler;

        }
    ]);
})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').service('apiMiddleware', ['$window', 'fileManagerConfig', 'apiHandler',
        function ($window, fileManagerConfig, ApiHandler) {

            var ApiMiddleware = function () {
                this.apiHandler = new ApiHandler();
            };

            ApiMiddleware.prototype.getPath = function (arrayPath) {
                return '/' + arrayPath.join('/');
            };

            ApiMiddleware.prototype.getFileList = function (files) {
                return (files || []).map(function (file) {
                    return file && file.model.fullPath();
                });
            };

            ApiMiddleware.prototype.getFilePath = function (item) {
                return item && item.model.fullPath();
            };

            ApiMiddleware.prototype.list = function (path, customDeferredHandler) {
                return this.apiHandler.list(fileManagerConfig.listUrl, this.getPath(path), customDeferredHandler);
            };

            ApiMiddleware.prototype.copy = function (files, path) {
                var items = this.getFileList(files);
                var singleFilename = items.length === 1 ? files[0].tempModel.name : undefined;
                return this.apiHandler.copy(fileManagerConfig.copyUrl, items, this.getPath(path), singleFilename);
            };

            ApiMiddleware.prototype.move = function (files, path) {
                var items = this.getFileList(files);
                return this.apiHandler.move(fileManagerConfig.moveUrl, items, this.getPath(path));
            };

            ApiMiddleware.prototype.remove = function (files) {
                var items = this.getFileList(files);
                return this.apiHandler.remove(fileManagerConfig.removeUrl, items);
            };

            ApiMiddleware.prototype.upload = function (files, path) {
                if (!$window.FormData) {
                    throw new Error('Unsupported browser version');
                }

                var destination = this.getPath(path);

                return this.apiHandler.upload(fileManagerConfig.uploadUrl, destination, files);
            };

            ApiMiddleware.prototype.getContent = function (item) {
                var itemPath = this.getFilePath(item);
                return this.apiHandler.getContent(fileManagerConfig.getContentUrl, itemPath);
            };

            ApiMiddleware.prototype.edit = function (item) {
                var itemPath = this.getFilePath(item);
                return this.apiHandler.edit(fileManagerConfig.editUrl, itemPath, item.tempModel.content);
            };

            ApiMiddleware.prototype.rename = function (item) {
                var itemPath = this.getFilePath(item);
                var newPath = item.tempModel.fullPath();

                return this.apiHandler.rename(fileManagerConfig.renameUrl, itemPath, newPath);
            };

            ApiMiddleware.prototype.getUrl = function (item) {
                var itemPath = this.getFilePath(item);
                return this.apiHandler.getUrl(fileManagerConfig.downloadFileUrl, itemPath);
            };

            ApiMiddleware.prototype.download = function (item, forceNewWindow) {
                //TODO: add spinner to indicate file is downloading
                var itemPath = this.getFilePath(item);
                var toFilename = item.model.name;

                if (item.isFolder()) {
                    return;
                }

                return this.apiHandler.download(
                    fileManagerConfig.downloadFileUrl,
                    itemPath,
                    toFilename,
                    fileManagerConfig.downloadFilesByAjax,
                    forceNewWindow
                );
            };

            ApiMiddleware.prototype.downloadMultiple = function (files, forceNewWindow) {
                var items = this.getFileList(files);
                var timestamp = new Date().getTime().toString().substr(8, 13);
                var toFilename = timestamp + '-' + fileManagerConfig.multipleDownloadFileName;

                return this.apiHandler.downloadMultiple(
                    fileManagerConfig.downloadMultipleUrl,
                    items,
                    toFilename,
                    fileManagerConfig.downloadFilesByAjax,
                    forceNewWindow
                );
            };

            ApiMiddleware.prototype.compress = function (files, compressedFilename, path) {
                var items = this.getFileList(files);
                return this.apiHandler.compress(fileManagerConfig.compressUrl, items, compressedFilename, this.getPath(path));
            };

            ApiMiddleware.prototype.extract = function (item, folderName, path) {
                var itemPath = this.getFilePath(item);
                return this.apiHandler.extract(fileManagerConfig.extractUrl, itemPath, folderName, this.getPath(path));
            };

            ApiMiddleware.prototype.changePermissions = function (files, dataItem) {
                var items = this.getFileList(files);
                var code = dataItem.tempModel.perms.toCode();
                var octal = dataItem.tempModel.perms.toOctal();
                var recursive = !!dataItem.tempModel.recursive;

                return this.apiHandler.changePermissions(fileManagerConfig.permissionsUrl, items, code, octal, recursive);
            };

            ApiMiddleware.prototype.createFolder = function (item) {
                var path = item.tempModel.fullPath();
                return this.apiHandler.createFolder(fileManagerConfig.createFolderUrl, path);
            };

            return ApiMiddleware;

        }
    ]);
})(angular);
(function (angular) {
    'use strict';
    angular.module('FileManagerApp').service('fileNavigator', [
        'apiMiddleware', 'fileManagerConfig', 'item',
        function (ApiMiddleware, fileManagerConfig, Item) {

            var FileNavigator = function () {
                this.apiMiddleware = new ApiMiddleware();
                this.requesting = false;
                this.fileList = [];
                this.currentPath = this.getBasePath();
                this.history = [];
                this.error = '';

                this.onRefresh = function () {};
            };

            FileNavigator.prototype.getBasePath = function () {
                var path = (fileManagerConfig.basePath || '').replace(/^\//, '');
                return path.trim() ? path.split('/') : [];
            };

            FileNavigator.prototype.deferredHandler = function (data, deferred, code, defaultMsg) {
                if (!data || typeof data !== 'object') {
                    this.error = 'Error %s - Bridge response error, please check the API docs or this ajax response.'.replace('%s', code);
                }
                if (code == 404) {
                    this.error = 'Error 404 - Backend bridge is not working, please check the ajax response.';
                }
                if (code == 200) {
                    this.error = null;
                }
                if (!this.error && data.result && data.result.error) {
                    this.error = data.result.error;
                }
                if (!this.error && data.error) {
                    this.error = data.error.message;
                }
                if (!this.error && defaultMsg) {
                    this.error = defaultMsg;
                }
                if (this.error) {
                    return deferred.reject(data);
                }
                return deferred.resolve(data);
            };

            FileNavigator.prototype.list = function () {
                return this.apiMiddleware.list(this.currentPath, this.deferredHandler.bind(this));
            };

            FileNavigator.prototype.refresh = function () {
                var self = this;
                if (!self.currentPath.length) {
                    self.currentPath = this.getBasePath();
                }
                var path = self.currentPath.join('/');
                self.requesting = true;
                self.fileList = [];
                return self.list().then(function (data) {
                    self.fileList = (data.result || []).map(function (file) {
                        return new Item(file, self.currentPath);
                    });
                    self.buildTree(path);
                    self.onRefresh();
                }).finally(function () {
                    self.requesting = false;
                });
            };

            FileNavigator.prototype.buildTree = function (path) {
                var flatNodes = [],
                    selectedNode = {};

                function recursive(parent, item, path) {
                    var absName = path ? (path + '/' + item.model.name) : item.model.name;
                    if (parent.name && parent.name.trim() && path.trim().indexOf(parent.name) !== 0) {
                        parent.nodes = [];
                    }
                    if (parent.name !== path) {
                        parent.nodes.forEach(function (nd) {
                            recursive(nd, item, path);
                        });
                    } else {
                        for (var e in parent.nodes) {
                            if (parent.nodes[e].name === absName) {
                                return;
                            }
                        }
                        parent.nodes.push({
                            item: item,
                            name: absName,
                            nodes: []
                        });
                    }

                    parent.nodes = parent.nodes.sort(function (a, b) {
                        return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() === b.name.toLowerCase() ? 0 : 1;
                    });
                }

                function flatten(node, array) {
                    array.push(node);
                    for (var n in node.nodes) {
                        flatten(node.nodes[n], array);
                    }
                }

                function findNode(data, path) {
                    return data.filter(function (n) {
                        return n.name === path;
                    })[0];
                }

                //!this.history.length && this.history.push({name: '', nodes: []});
                !this.history.length && this.history.push({
                    name: this.getBasePath()[0] || '',
                    nodes: []
                });
                flatten(this.history[0], flatNodes);
                selectedNode = findNode(flatNodes, path);
                selectedNode && (selectedNode.nodes = []);

                for (var o in this.fileList) {
                    var item = this.fileList[o];
                    item instanceof Item && item.isFolder() && recursive(this.history[0], item, path);
                }
            };

            FileNavigator.prototype.folderClick = function (item) {
                this.currentPath = [];
                if (item && item.isFolder()) {
                    this.currentPath = item.model.fullPath().split('/').splice(1);
                }
                this.refresh();
            };

            FileNavigator.prototype.upDir = function () {
                if (this.currentPath[0]) {
                    this.currentPath = this.currentPath.slice(0, -1);
                    this.refresh();
                }
            };

            FileNavigator.prototype.goTo = function (index) {
                this.currentPath = this.currentPath.slice(0, index + 1);
                this.refresh();
            };

            FileNavigator.prototype.fileNameExists = function (fileName) {
                return this.fileList.find(function (item) {
                    return fileName && item.model.name.trim() === fileName.trim();
                });
            };

            FileNavigator.prototype.listHasFolders = function () {
                return this.fileList.find(function (item) {
                    return item.model.type === 'dir';
                });
            };

            FileNavigator.prototype.getCurrentFolderName = function () {
                return this.currentPath.slice(-1)[0] || '/';
            };

            return FileNavigator;
        }
    ]);
})(angular);
angular.module('FileManagerApp').run(['$templateCache', function($templateCache) {$templateCache.put('src/templates/current-folder-breadcrumb.html','<ol class="breadcrumb">\r\n    <li>\r\n        <a href="" ng-click="fileNavigator.goTo(-1)">\r\n            {{"filemanager" | translate}}\r\n        </a>\r\n    </li>\r\n    <li ng-repeat="(key, dir) in fileNavigator.currentPath track by key" ng-class="{\'active\':$last}" class="animated fast fadeIn">\r\n        <a href="" ng-show="!$last" ng-click="fileNavigator.goTo(key)">\r\n            {{dir | strLimit : 8}}\r\n        </a>\r\n        <span ng-show="$last">\r\n            {{dir | strLimit : 12}}\r\n        </span>\r\n    </li>\r\n</ol>');
$templateCache.put('src/templates/item-context-menu.html','<div id="context-menu" class="dropdown clearfix animated fast fadeIn">\r\n    <ul class="dropdown-menu dropdown-right-click" role="menu" aria-labelledby="dropdownMenu" ng-show="temps.length">\r\n\r\n        <li ng-show="singleSelection() && singleSelection().isFolder()">\r\n            <a href="" tabindex="-1" ng-click="smartClick(singleSelection())">\r\n                <i class="glyphicon glyphicon-folder-open"></i> {{\'open\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.pickCallback && singleSelection() && singleSelection().isSelectable()">\r\n            <a href="" tabindex="-1" ng-click="config.pickCallback(singleSelection().model)">\r\n                <i class="glyphicon glyphicon-hand-up"></i> {{\'select_this\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.download && !selectionHas(\'dir\') && singleSelection()">\r\n            <a href="" tabindex="-1" ng-click="download()">\r\n                <i class="glyphicon glyphicon-cloud-download"></i> {{\'download\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.downloadMultiple && !selectionHas(\'dir\') && !singleSelection()">\r\n            <a href="" tabindex="-1" ng-click="download()">\r\n                <i class="glyphicon glyphicon-cloud-download"></i> {{\'download_as_zip\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.preview && singleSelection().isImage() && singleSelection()">\r\n            <a href="" tabindex="-1" ng-click="openImagePreview()">\r\n                <i class="glyphicon glyphicon-picture"></i> {{\'view_item\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.rename && singleSelection()">\r\n            <a href="" tabindex="-1" ng-click="modal(\'rename\')">\r\n                <i class="glyphicon glyphicon-edit"></i> {{\'rename\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.move">\r\n            <a href="" tabindex="-1" ng-click="modalWithPathSelector(\'move\')">\r\n                <i class="glyphicon glyphicon-arrow-right"></i> {{\'move\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.copy && !selectionHas(\'dir\')">\r\n            <a href="" tabindex="-1" ng-click="modalWithPathSelector(\'copy\')">\r\n                <i class="glyphicon glyphicon-log-out"></i> {{\'copy\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.edit && singleSelection() && singleSelection().isEditable()">\r\n            <a href="" tabindex="-1" ng-click="openEditItem()">\r\n                <i class="glyphicon glyphicon-pencil"></i> {{\'edit\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.changePermissions">\r\n            <a href="" tabindex="-1" ng-click="modal(\'changepermissions\')">\r\n                <i class="glyphicon glyphicon-lock"></i> {{\'permissions\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.compress && (!singleSelection() || selectionHas(\'dir\'))">\r\n            <a href="" tabindex="-1" ng-click="modal(\'compress\')">\r\n                <i class="glyphicon glyphicon-compressed"></i> {{\'compress\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li ng-show="config.allowedActions.extract && singleSelection() && singleSelection().isExtractable()">\r\n            <a href="" tabindex="-1" ng-click="modal(\'extract\')">\r\n                <i class="glyphicon glyphicon-export"></i> {{\'extract\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n        <li class="divider" ng-show="config.allowedActions.remove"></li>\r\n        \r\n        <li ng-show="config.allowedActions.remove">\r\n            <a href="" tabindex="-1" ng-click="modal(\'remove\')">\r\n                <i class="glyphicon glyphicon-trash"></i> {{\'remove\' | translate}}\r\n            </a>\r\n        </li>\r\n\r\n    </ul>\r\n\r\n    <ul class="dropdown-menu dropdown-right-click" role="menu" aria-labelledby="dropdownMenu" ng-show="!temps.length">\r\n        <li ng-show="config.allowedActions.createFolder">\r\n            <a href="" tabindex="-1" ng-click="modal(\'newfolder\') && prepareNewFolder()">\r\n                <i class="glyphicon glyphicon-plus"></i> {{\'new_folder\' | translate}}\r\n            </a>\r\n        </li>\r\n        <li ng-show="config.allowedActions.upload">\r\n            <a href="" tabindex="-1" ng-click="modal(\'uploadfile\')">\r\n                <i class="glyphicon glyphicon-cloud-upload"></i> {{\'upload_files\' | translate}}\r\n            </a>\r\n        </li>\r\n    </ul>\r\n</div>');
$templateCache.put('src/templates/main-icons.html','<div class="iconset noselect">\r\n    <div class="item-list clearfix" ng-click="selectOrUnselect(null, $event)" ng-right-click="selectOrUnselect(null, $event)" prevent="true">\r\n        <div class="col-120" ng-repeat="item in $parent.fileList = (fileNavigator.fileList | filter: {model:{name: query}})" ng-show="!fileNavigator.requesting && !fileNavigator.error">\r\n            <a href="" class="thumbnail text-center" ng-click="selectOrUnselect(item, $event)" ng-dblclick="smartClick(item)" ng-right-click="selectOrUnselect(item, $event)" title="{{item.model.name}} ({{item.model.size | humanReadableFileSize}})" ng-class="{selected: isSelected(item)}">\r\n                <div class="item-icon">\r\n                    <i class="glyphicon glyphicon-folder-open" ng-show="item.model.type === \'dir\'"></i>\r\n                    <i class="glyphicon glyphicon-file" data-ext="{{ item.model.name | fileExtension }}" ng-show="item.model.type === \'file\'" ng-class="{\'item-extension\': config.showExtensionIcons}"></i>\r\n                </div>\r\n                {{item.model.name | strLimit : 11 }}\r\n            </a>\r\n        </div>\r\n    </div>\r\n\r\n    <div ng-show="fileNavigator.requesting">\r\n        <div ng-include="config.tplPath + \'/spinner.html\'"></div>\r\n    </div>\r\n\r\n    <div class="alert alert-warning" ng-show="!fileNavigator.requesting && fileNavigator.fileList.length < 1 && !fileNavigator.error">\r\n        {{"no_files_in_folder" | translate}}...\r\n    </div>\r\n    \r\n    <div class="alert alert-danger" ng-show="!fileNavigator.requesting && fileNavigator.error">\r\n        {{ fileNavigator.error }}\r\n    </div>\r\n</div>');
$templateCache.put('src/templates/main-table-modal.html','<table class="table table-condensed table-modal-condensed mb0">\r\n    <thead>\r\n        <tr>\r\n            <th>\r\n                <a href="" ng-click="order(\'model.name\')">\r\n                    {{"name" | translate}}\r\n                    <span class="sortorder" ng-show="predicate[1] === \'model.name\'" ng-class="{reverse:reverse}"></span>\r\n                </a>\r\n            </th>\r\n            <th class="text-right"></th>\r\n        </tr>\r\n    </thead>\r\n    <tbody class="file-item">\r\n        <tr ng-show="fileNavigator.requesting">\r\n            <td colspan="2">\r\n                <div ng-include="config.tplPath + \'/spinner.html\'"></div>\r\n            </td>\r\n        </tr>\r\n        <tr ng-show="!fileNavigator.requesting && !fileNavigator.listHasFolders() && !fileNavigator.error">\r\n            <td>\r\n                {{"no_folders_in_folder" | translate}}...\r\n            </td>\r\n            <td class="text-right">\r\n                <button class="btn btn-sm btn-default" ng-click="fileNavigator.upDir()">{{"go_back" | translate}}</button>\r\n            </td>\r\n        </tr>\r\n        <tr ng-show="!fileNavigator.requesting && fileNavigator.error">\r\n            <td colspan="2">\r\n                {{ fileNavigator.error }}\r\n            </td>\r\n        </tr>\r\n        <tr ng-repeat="item in fileNavigator.fileList | orderBy:predicate:reverse" ng-show="!fileNavigator.requesting && item.model.type === \'dir\'" ng-if="!selectedFilesAreChildOfPath(item)">\r\n            <td>\r\n                <a href="" ng-click="fileNavigator.folderClick(item)" title="{{item.model.name}} ({{item.model.size | humanReadableFileSize}})">\r\n                    <i class="glyphicon glyphicon-folder-close"></i>\r\n                    {{item.model.name | strLimit : 32}}\r\n                </a>\r\n            </td>\r\n            <td class="text-right">\r\n                <button class="btn btn-sm btn-default" ng-click="select(item)">\r\n                    <i class="glyphicon glyphicon-hand-up"></i> {{"select_this" | translate}}\r\n                </button>\r\n            </td>\r\n        </tr>\r\n    </tbody>\r\n</table>');
$templateCache.put('src/templates/main-table.html','<table class="table mb0 table-files noselect">\r\n    <thead>\r\n        <tr>\r\n            <th>\r\n                <a href="" ng-click="order(\'model.name\')">\r\n                    {{"name" | translate}}\r\n                    <span class="sortorder" ng-show="predicate[1] === \'model.name\'" ng-class="{reverse:reverse}"></span>\r\n                </a>\r\n            </th>\r\n            <th class="hidden-xs" ng-hide="config.hideSize">\r\n                <a href="" ng-click="order(\'model.size\')">\r\n                    {{"size" | translate}}\r\n                    <span class="sortorder" ng-show="predicate[1] === \'model.size\'" ng-class="{reverse:reverse}"></span>\r\n                </a>\r\n            </th>\r\n            <th class="hidden-sm hidden-xs" ng-hide="config.hideDate">\r\n                <a href="" ng-click="order(\'model.date\')">\r\n                    {{"date" | translate}}\r\n                    <span class="sortorder" ng-show="predicate[1] === \'model.date\'" ng-class="{reverse:reverse}"></span>\r\n                </a>\r\n            </th>\r\n            <th class="hidden-sm hidden-xs" ng-hide="config.hidePermissions">\r\n                <a href="" ng-click="order(\'model.permissions\')">\r\n                    {{"permissions" | translate}}\r\n                    <span class="sortorder" ng-show="predicate[1] === \'model.permissions\'" ng-class="{reverse:reverse}"></span>\r\n                </a>\r\n            </th>\r\n        </tr>\r\n    </thead>\r\n    <tbody class="file-item">\r\n        <tr ng-show="fileNavigator.requesting">\r\n            <td colspan="5">\r\n                <div ng-include="config.tplPath + \'/spinner.html\'"></div>\r\n            </td>\r\n        </tr>\r\n        <tr ng-show="!fileNavigator.requesting &amp;&amp; fileNavigator.fileList.length < 1 &amp;&amp; !fileNavigator.error">\r\n            <td colspan="5">\r\n                {{"no_files_in_folder" | translate}}...\r\n            </td>\r\n        </tr>\r\n        <tr ng-show="!fileNavigator.requesting &amp;&amp; fileNavigator.error">\r\n            <td colspan="5">\r\n                {{ fileNavigator.error }}\r\n            </td>\r\n        </tr>\r\n        <tr class="item-list" ng-repeat="item in $parent.fileList = (fileNavigator.fileList | filter: {model:{name: query}} | orderBy:predicate:reverse)" ng-show="!fileNavigator.requesting" ng-click="selectOrUnselect(item, $event)" ng-dblclick="smartClick(item)" ng-right-click="selectOrUnselect(item, $event)" ng-class="{selected: isSelected(item)}">\r\n            <td>\r\n                <a href="" title="{{item.model.name}} ({{item.model.size | humanReadableFileSize}})">\r\n                    <i class="glyphicon glyphicon-folder-close" ng-show="item.model.type === \'dir\'"></i>\r\n                    <i class="glyphicon glyphicon-file" ng-show="item.model.type === \'file\'"></i>\r\n                    {{item.model.name | strLimit : 64}}\r\n                </a>\r\n            </td>\r\n            <td class="hidden-xs">\r\n                <span ng-show="item.model.type !== \'dir\' || config.showSizeForDirectories">\r\n                    {{item.model.size | humanReadableFileSize}}\r\n                </span>\r\n            </td>\r\n            <td class="hidden-sm hidden-xs" ng-hide="config.hideDate">\r\n                {{item.model.date | formatDate }}\r\n            </td>\r\n            <td class="hidden-sm hidden-xs" ng-hide="config.hidePermissions">\r\n                {{item.model.perms.toCode(item.model.type === \'dir\'?\'d\':\'-\')}}\r\n            </td>\r\n        </tr>\r\n    </tbody>\r\n</table>\r\n');
$templateCache.put('src/templates/main.html','<div ng-controller="FileManagerCtrl">\r\n    <div ng-include="config.tplPath + \'/navbar.html\'"></div>\r\n\r\n    <div class="container-fluid">\r\n        <div class="row">\r\n\r\n            <div class="col-sm-4 col-md-3 sidebar file-tree animated slow fadeIn" ng-include="config.tplPath + \'/sidebar.html\'" ng-show="config.sidebar &amp;&amp; fileNavigator.history[0]">\r\n            </div>\r\n\r\n            <div class="main" ng-class="config.sidebar &amp;&amp; fileNavigator.history[0] &amp;&amp; \'col-sm-8 col-md-9\'" ngf-model-options="{updateOn: \'drop\', allowInvalid: false, debounce: 0}" ngf-drop="addForUpload($files)" ngf-drag-over-class="\'upload-dragover\'" ngf-multiple="true">\r\n                <div ng-include="config.tplPath + \'/\' + viewTemplate" class="main-navigation clearfix"></div>\r\n            </div>\r\n        </div>\r\n    </div>\r\n\r\n    <div ng-include="config.tplPath + \'/modals.html\'"></div>\r\n    <div ng-include="config.tplPath + \'/item-context-menu.html\'"></div>\r\n</div>\r\n');
$templateCache.put('src/templates/modals.html','<div class="modal animated fadeIn" id="imagepreview">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n      <div class="modal-header">\r\n        <button type="button" class="close" data-dismiss="modal">\r\n            <span aria-hidden="true">&times;</span>\r\n            <span class="sr-only">{{"close" | translate}}</span>\r\n        </button>\r\n        <h4 class="modal-title">{{"preview" | translate}}</h4>\r\n      </div>\r\n      <div class="modal-body">\r\n        <div class="text-center">\r\n          <img id="imagepreview-target" class="preview" alt="{{singleSelection().model.name}}" ng-class="{\'loading\': apiMiddleware.apiHandler.inprocess}">\r\n          <span class="label label-warning" ng-show="apiMiddleware.apiHandler.inprocess">{{\'loading\' | translate}} ...</span>\r\n        </div>\r\n        <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n      </div>\r\n      <div class="modal-footer">\r\n        <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"close" | translate}}</button>\r\n      </div>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="remove">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n    <form ng-submit="remove()">\r\n      <div class="modal-header">\r\n        <button type="button" class="close" data-dismiss="modal">\r\n            <span aria-hidden="true">&times;</span>\r\n            <span class="sr-only">{{"close" | translate}}</span>\r\n        </button>\r\n        <h4 class="modal-title">{{"confirm" | translate}}</h4>\r\n      </div>\r\n      <div class="modal-body">\r\n        {{\'sure_to_delete\' | translate}} <span ng-include data-src="\'selected-files-msg\'"></span>\r\n\r\n        <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n      </div>\r\n      <div class="modal-footer">\r\n        <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"cancel" | translate}}</button>\r\n        <button type="submit" class="btn btn-primary" ng-disabled="apiMiddleware.apiHandler.inprocess" autofocus="autofocus">{{"remove" | translate}}</button>\r\n      </div>\r\n      </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="move">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n        <form ng-submit="move()">\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{\'move\' | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n              <div ng-include data-src="\'path-selector\'" class="clearfix"></div>\r\n              <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"cancel" | translate}}</button>\r\n              <button type="submit" class="btn btn-primary" ng-disabled="apiMiddleware.apiHandler.inprocess">{{\'move\' | translate}}</button>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n\r\n<div class="modal animated fadeIn" id="rename">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n        <form ng-submit="rename()">\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{\'rename\' | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n              <label class="radio">{{\'enter_new_name_for\' | translate}} <b>{{singleSelection() && singleSelection().model.name}}</b></label>\r\n              <input class="form-control" ng-model="singleSelection().tempModel.name" autofocus="autofocus">\r\n\r\n              <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"cancel" | translate}}</button>\r\n              <button type="submit" class="btn btn-primary" ng-disabled="apiMiddleware.apiHandler.inprocess">{{\'rename\' | translate}}</button>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="copy">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n        <form ng-submit="copy()">\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{\'copy_file\' | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n              <div ng-show="singleSelection()">\r\n                <label class="radio">{{\'enter_new_name_for\' | translate}} <b>{{singleSelection().model.name}}</b></label>\r\n                <input class="form-control" ng-model="singleSelection().tempModel.name" autofocus="autofocus">\r\n              </div>\r\n\r\n              <div ng-include data-src="\'path-selector\'" class="clearfix"></div>\r\n              <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"cancel" | translate}}</button>\r\n              <button type="submit" class="btn btn-primary" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"copy" | translate}}</button>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="compress">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n        <form ng-submit="compress()">\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{\'compress\' | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n              <div ng-show="apiMiddleware.apiHandler.asyncSuccess">\r\n                  <div class="label label-success error-msg">{{\'compression_started\' | translate}}</div>\r\n              </div>\r\n              <div ng-hide="apiMiddleware.apiHandler.asyncSuccess">\r\n                  <div ng-hide="config.allowedActions.compressChooseName">\r\n                    {{\'sure_to_start_compression_with\' | translate}} <b>{{singleSelection().model.name}}</b> ?\r\n                  </div>\r\n                  <div ng-show="config.allowedActions.compressChooseName">\r\n                    <label class="radio">\r\n                      {{\'enter_file_name_for_compression\' | translate}}\r\n                      <span ng-include data-src="\'selected-files-msg\'"></span>\r\n                    </label>\r\n                    <input class="form-control" ng-model="temp.tempModel.name" autofocus="autofocus">\r\n                  </div>\r\n              </div>\r\n\r\n              <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <div ng-show="apiMiddleware.apiHandler.asyncSuccess">\r\n                  <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"close" | translate}}</button>\r\n              </div>\r\n              <div ng-hide="apiMiddleware.apiHandler.asyncSuccess">\r\n                  <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"cancel" | translate}}</button>\r\n                  <button type="submit" class="btn btn-primary" ng-disabled="apiMiddleware.apiHandler.inprocess">{{\'compress\' | translate}}</button>\r\n              </div>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="extract" ng-init="singleSelection().emptyName()">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n        <form ng-submit="extract()">\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{\'extract_item\' | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n              <div ng-show="apiMiddleware.apiHandler.asyncSuccess">\r\n                  <div class="label label-success error-msg">{{\'extraction_started\' | translate}}</div>\r\n              </div>\r\n              <div ng-hide="apiMiddleware.apiHandler.asyncSuccess">\r\n                  <label class="radio">{{\'enter_folder_name_for_extraction\' | translate}} <b>{{singleSelection().model.name}}</b></label>\r\n                  <input class="form-control" ng-model="singleSelection().tempModel.name" autofocus="autofocus">\r\n              </div>\r\n              <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <div ng-show="apiMiddleware.apiHandler.asyncSuccess">\r\n                  <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"close" | translate}}</button>\r\n              </div>\r\n              <div ng-hide="apiMiddleware.apiHandler.asyncSuccess">\r\n                  <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"cancel" | translate}}</button>\r\n                  <button type="submit" class="btn btn-primary" ng-disabled="apiMiddleware.apiHandler.inprocess">{{\'extract\' | translate}}</button>\r\n              </div>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="edit" ng-class="{\'modal-fullscreen\': fullscreen}">\r\n  <div class="modal-dialog modal-lg">\r\n    <div class="modal-content">\r\n        <form ng-submit="edit()">\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <button type="button" class="close fullscreen" ng-click="fullscreen=!fullscreen">\r\n                  <i class="glyphicon glyphicon-fullscreen"></i>\r\n                  <span class="sr-only">{{\'toggle_fullscreen\' | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{\'edit_file\' | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n                <label class="radio bold">{{ singleSelection().model.fullPath() }}</label>\r\n                <span class="label label-warning" ng-show="apiMiddleware.apiHandler.inprocess">{{\'loading\' | translate}} ...</span>\r\n                <textarea class="form-control code" ng-model="singleSelection().tempModel.content" ng-show="!apiMiddleware.apiHandler.inprocess" autofocus="autofocus"></textarea>\r\n                <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{\'close\' | translate}}</button>\r\n              <button type="submit" class="btn btn-primary" ng-show="config.allowedActions.edit" ng-disabled="apiMiddleware.apiHandler.inprocess">{{\'save\' | translate}}</button>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="newfolder">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n        <form ng-submit="createFolder()">\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{\'new_folder\' | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n              <label class="radio">{{\'folder_name\' | translate}}</label>\r\n              <input class="form-control" ng-model="singleSelection().tempModel.name" autofocus="autofocus">\r\n              <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"cancel" | translate}}</button>\r\n              <button type="submit" class="btn btn-primary" ng-disabled="apiMiddleware.apiHandler.inprocess">{{\'create\' | translate}}</button>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="uploadfile">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n        <form>\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{"upload_files" | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n              <label class="radio">\r\n                {{"files_will_uploaded_to" | translate}} \r\n                <b>/{{fileNavigator.currentPath.join(\'/\')}}</b>\r\n              </label>\r\n              <button class="btn btn-default btn-block" ngf-select="$parent.addForUpload($files)" ngf-multiple="true">\r\n                {{"select_files" | translate}}\r\n              </button>\r\n              \r\n              <div class="upload-list">\r\n                <ul class="list-group">\r\n                  <li class="list-group-item" ng-repeat="(index, uploadFile) in $parent.uploadFileList">\r\n                    <button class="btn btn-sm btn-danger pull-right" ng-click="$parent.removeFromUpload(index)">\r\n                        &times;\r\n                    </button>\r\n                    <h5 class="list-group-item-heading">{{uploadFile.name}}</h5>\r\n                    <p class="list-group-item-text">{{uploadFile.size | humanReadableFileSize}}</p>\r\n                  </li>\r\n                </ul>\r\n                <div ng-show="apiMiddleware.apiHandler.inprocess">\r\n                  <em>{{"uploading" | translate}}... {{apiMiddleware.apiHandler.progress}}%</em>\r\n                  <div class="progress mb0">\r\n                    <div class="progress-bar active" role="progressbar" aria-valuenow="{{apiMiddleware.apiHandler.progress}}" aria-valuemin="0" aria-valuemax="100" style="width: {{apiMiddleware.apiHandler.progress}}%"></div>\r\n                  </div>\r\n                </div>\r\n              </div>\r\n              <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <div>\r\n                  <button type="button" class="btn btn-default" data-dismiss="modal">{{"cancel" | translate}}</button>\r\n                  <button type="submit" class="btn btn-primary" ng-disabled="!$parent.uploadFileList.length || apiMiddleware.apiHandler.inprocess" ng-click="uploadFiles()">{{\'upload\' | translate}}</button>\r\n              </div>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="changepermissions">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n        <form ng-submit="changePermissions()">\r\n            <div class="modal-header">\r\n              <button type="button" class="close" data-dismiss="modal">\r\n                  <span aria-hidden="true">&times;</span>\r\n                  <span class="sr-only">{{"close" | translate}}</span>\r\n              </button>\r\n              <h4 class="modal-title">{{\'change_permissions\' | translate}}</h4>\r\n            </div>\r\n            <div class="modal-body">\r\n              <table class="table mb0">\r\n                  <thead>\r\n                      <tr>\r\n                          <th>{{\'permissions\' | translate}}</th>\r\n                          <th class="col-xs-1 text-center">{{\'read\' | translate}}</th>\r\n                          <th class="col-xs-1 text-center">{{\'write\' | translate}}</th>\r\n                          <th class="col-xs-1 text-center">{{\'exec\' | translate}}</th>\r\n                      </tr>\r\n                  </thead>\r\n                  <tbody>\r\n                      <tr ng-repeat="(permTypeKey, permTypeValue) in temp.tempModel.perms">\r\n                          <td>{{permTypeKey | translate}}</td>\r\n                          <td ng-repeat="(permKey, permValue) in permTypeValue" class="col-xs-1 text-center" ng-click="main()">\r\n                              <label class="col-xs-12">\r\n                                <input type="checkbox" ng-model="temp.tempModel.perms[permTypeKey][permKey]">\r\n                              </label>\r\n                          </td>\r\n                      </tr>\r\n                </tbody>\r\n              </table>\r\n              <div class="checkbox" ng-show="config.enablePermissionsRecursive && selectionHas(\'dir\')">\r\n                <label>\r\n                  <input type="checkbox" ng-model="temp.tempModel.recursive"> {{\'recursive\' | translate}}\r\n                </label>\r\n              </div>\r\n              <div class="clearfix mt10">\r\n                  <span class="label label-primary pull-left" ng-hide="temp.multiple">\r\n                    {{\'original\' | translate}}: \r\n                    {{temp.model.perms.toCode(selectionHas(\'dir\') ? \'d\':\'-\')}} \r\n                    ({{temp.model.perms.toOctal()}})\r\n                  </span>\r\n                  <span class="label label-primary pull-right">\r\n                    {{\'changes\' | translate}}: \r\n                    {{temp.tempModel.perms.toCode(selectionHas(\'dir\') ? \'d\':\'-\')}} \r\n                    ({{temp.tempModel.perms.toOctal()}})\r\n                  </span>\r\n              </div>\r\n              <div ng-include data-src="\'error-bar\'" class="clearfix"></div>\r\n            </div>\r\n            <div class="modal-footer">\r\n              <button type="button" class="btn btn-default" data-dismiss="modal">{{"cancel" | translate}}</button>\r\n              <button type="submit" class="btn btn-primary" ng-disabled="">{{\'change\' | translate}}</button>\r\n            </div>\r\n        </form>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<div class="modal animated fadeIn" id="selector" ng-controller="ModalFileManagerCtrl">\r\n  <div class="modal-dialog">\r\n    <div class="modal-content">\r\n      <div class="modal-header">\r\n        <button type="button" class="close" data-dismiss="modal">\r\n            <span aria-hidden="true">&times;</span>\r\n            <span class="sr-only">{{"close" | translate}}</span>\r\n        </button>\r\n        <h4 class="modal-title">{{"select_destination_folder" | translate}}</h4>\r\n      </div>\r\n      <div class="modal-body">\r\n        <div>\r\n            <div ng-include="config.tplPath + \'/current-folder-breadcrumb.html\'"></div>\r\n            <div ng-include="config.tplPath + \'/main-table-modal.html\'"></div>\r\n            <hr />\r\n            <button class="btn btn-sm btn-default" ng-click="selectCurrent()">\r\n                <i class="glyphicon"></i> {{"select_this" | translate}}\r\n            </button>\r\n        </div>\r\n      </div>\r\n      <div class="modal-footer">\r\n        <button type="button" class="btn btn-default" data-dismiss="modal" ng-disabled="apiMiddleware.apiHandler.inprocess">{{"close" | translate}}</button>\r\n      </div>\r\n    </div>\r\n  </div>\r\n</div>\r\n\r\n<script type="text/ng-template" id="path-selector">\r\n  <div class="panel panel-primary mt10 mb0">\r\n    <div class="panel-body">\r\n        <div class="detail-sources">\r\n          <div class="like-code mr5"><b>{{"selection" | translate}}:</b>\r\n            <span ng-include="\'selected-files-msg\'"></span>\r\n          </div>\r\n        </div>\r\n        <div class="detail-sources">\r\n          <div class="like-code mr5">\r\n            <b>{{"destination" | translate}}:</b> {{ getSelectedPath() }}\r\n          </div>\r\n          <a href="" class="label label-primary" ng-click="openNavigator(fileNavigator.currentPath)">\r\n            {{\'change\' | translate}}\r\n          </a>\r\n        </div>\r\n    </div>\r\n  </div>\r\n</script>\r\n\r\n<script type="text/ng-template" id="error-bar">\r\n  <div class="label label-danger error-msg pull-left animated fadeIn" ng-show="apiMiddleware.apiHandler.error">\r\n    <i class="glyphicon glyphicon-remove-circle"></i>\r\n    <span>{{apiMiddleware.apiHandler.error}}</span>\r\n  </div>\r\n</script>\r\n\r\n<script type="text/ng-template" id="selected-files-msg">\r\n  <span ng-show="temps.length == 1">\r\n    {{singleSelection().model.name}}\r\n  </span>\r\n  <span ng-show="temps.length > 1">\r\n    {{\'these_elements\' | translate:totalSelecteds()}}\r\n    <a href="" class="label label-primary" ng-click="showDetails = !showDetails">\r\n      {{showDetails ? \'-\' : \'+\'}} {{\'details\' | translate}}\r\n    </a>\r\n  </span>\r\n  <div ng-show="temps.length > 1 &amp;&amp; showDetails">\r\n    <ul class="selected-file-details">\r\n      <li ng-repeat="tempItem in temps">\r\n        <b>{{tempItem.model.name}}</b>\r\n      </li>\r\n    </ul>\r\n  </div>\r\n</script>\r\n');
$templateCache.put('src/templates/navbar.html','<nav class="navbar navbar-inverse">\r\n    <div class="container-fluid">\r\n        <div class="row">\r\n            <div class="col-sm-9 col-md-10 hidden-xs">\r\n                <div ng-show="!config.breadcrumb">\r\n                    <a class="navbar-brand hidden-xs ng-binding" href="">angular-{{"filemanager" | translate}}</a>\r\n                </div>\r\n                <div ng-include="config.tplPath + \'/current-folder-breadcrumb.html\'" ng-show="config.breadcrumb">\r\n                </div>\r\n            </div>\r\n            <div class="col-sm-3 col-md-2">\r\n                <div class="navbar-collapse">\r\n                    <div class="navbar-form navbar-right text-right">\r\n                        <div class="pull-left visible-xs" ng-if="fileNavigator.currentPath.length">\r\n                            <button class="btn btn-primary btn-flat" ng-click="fileNavigator.upDir()">\r\n                                <i class="glyphicon glyphicon-chevron-left"></i>\r\n                            </button>\r\n                            {{fileNavigator.getCurrentFolderName() | strLimit : 12}}\r\n                        </div>\r\n                        <div class="btn-group">\r\n                            <button class="btn btn-flat btn-sm dropdown-toggle" type="button" id="dropDownMenuSearch" data-toggle="dropdown" aria-expanded="true">\r\n                                <i class="glyphicon glyphicon-search mr2"></i>\r\n                            </button>\r\n                            <div class="dropdown-menu animated fast fadeIn pull-right" role="menu" aria-labelledby="dropDownMenuLang">\r\n                                <input type="text" class="form-control" ng-show="config.searchForm" placeholder="{{\'search\' | translate}}..." ng-model="$parent.query">\r\n                            </div>\r\n                        </div>\r\n\r\n                        <button class="btn btn-flat btn-sm" ng-click="$parent.setTemplate(\'main-icons.html\')" ng-show="$parent.viewTemplate !==\'main-icons.html\'" title="{{\'icons\' | translate}}">\r\n                            <i class="glyphicon glyphicon-th-large"></i>\r\n                        </button>\r\n\r\n                        <button class="btn btn-flat btn-sm" ng-click="$parent.setTemplate(\'main-table.html\')" ng-show="$parent.viewTemplate !==\'main-table.html\'" title="{{\'list\' | translate}}">\r\n                            <i class="glyphicon glyphicon-th-list"></i>\r\n                        </button>\r\n\r\n                        <div class="btn-group">\r\n                            <button class="btn btn-flat btn-sm dropdown-toggle" type="button" id="dropDownMenuLang" data-toggle="dropdown" aria-expanded="true" ng-show="config.multiLang">\r\n                                <i class="glyphicon glyphicon-globe mr2"></i>\r\n                            </button>\r\n\r\n                            <ul class="dropdown-menu scrollable-menu animated fast fadeIn pull-right" role="menu" aria-labelledby="dropDownMenuLang">\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'en\')">English</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'zh_tw\')">\u6B63\u9AD4\u4E2D\u6587</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'zh_cn\')">\u7B80\u4F53\u4E2D\u6587</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'es\')">Espa\xF1ol</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'nl\')">Nederlands</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'pt\')">Portugues</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'fr\')">Fran\xE7ais</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'de\')">Deutsch</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'he\')">\u05E2\u05D1\u05E8\u05D9</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'it\')">italiano</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'sk\')">Sloven\u010Dina</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'ru\')">\u0440\u0443\u0441\u0441\u043A\u0438\u0439</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'ua\')">\u0443\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0438\u0439</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'tr\')">T\xFCrk\xE7e</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'fa\')">\u0641\u0627\u0631\u0633\u06CC</a></li>\r\n                                <li role="presentation"><a role="menuitem" tabindex="-1" href="" ng-click="changeLanguage(\'pl\')">Polski</a></li>\r\n                            </ul>\r\n                        </div>\r\n\r\n                        <div class="btn-group">\r\n                            <button class="btn btn-flat btn-sm dropdown-toggle" type="button" id="more" data-toggle="dropdown" aria-expanded="true">\r\n                                <i class="glyphicon glyphicon-option-vertical"></i>\r\n                            </button>\r\n\r\n                            <ul class="dropdown-menu scrollable-menu animated fast fadeIn pull-right" role="menu" aria-labelledby="more">\r\n                                <li role="presentation" ng-show="config.allowedActions.createFolder" ng-click="modal(\'newfolder\') && prepareNewFolder()">\r\n                                    <a href="" role="menuitem" tabindex="-1">\r\n                                        <i class="glyphicon glyphicon-plus"></i> {{"new_folder" | translate}}\r\n                                    </a>\r\n                                </li>\r\n                                <li role="presentation" ng-show="config.allowedActions.upload" ng-click="modal(\'uploadfile\')">\r\n                                    <a href="" role="menuitem" tabindex="-1">\r\n                                        <i class="glyphicon glyphicon-cloud-upload"></i> {{"upload_files" | translate}}\r\n                                    </a>\r\n                                </li>\r\n                            </ul>\r\n                        </div>\r\n                    </div>\r\n                </div>\r\n            </div>\r\n        </div>\r\n    </div>\r\n</nav>\r\n');
$templateCache.put('src/templates/sidebar.html','<ul class="nav nav-sidebar file-tree-root">\r\n    <li ng-repeat="item in fileNavigator.history" ng-include="\'folder-branch-item\'" ng-class="{\'active\': item.name == fileNavigator.currentPath.join(\'/\')}"></li>\r\n</ul>\r\n\r\n<script type="text/ng-template" id="folder-branch-item">\r\n    <a href="" ng-click="fileNavigator.folderClick(item.item)" class="animated fast fadeInDown">\r\n\r\n        <span class="point">\r\n            <i class="glyphicon glyphicon-chevron-down" ng-show="isInThisPath(item.name)"></i>\r\n            <i class="glyphicon glyphicon-chevron-right" ng-show="!isInThisPath(item.name)"></i>\r\n        </span>\r\n\r\n        <i class="glyphicon glyphicon-folder-open mr2" ng-show="isInThisPath(item.name)"></i>\r\n        <i class="glyphicon glyphicon-folder-close mr2" ng-show="!isInThisPath(item.name)"></i>\r\n        {{ (item.name.split(\'/\').pop() || fileNavigator.getBasePath().join(\'/\') || \'/\') | strLimit : 30 }}\r\n    </a>\r\n    <ul class="nav nav-sidebar">\r\n        <li ng-repeat="item in item.nodes" ng-include="\'folder-branch-item\'" ng-class="{\'active\': item.name == fileNavigator.currentPath.join(\'/\')}"></li>\r\n    </ul>\r\n</script>');
$templateCache.put('src/templates/spinner.html','<div class="spinner-wrapper col-xs-12">\r\n    <svg class="spinner-container" style="width:65px;height:65px" viewBox="0 0 44 44">\r\n        <circle class="path" cx="22" cy="22" r="20" fill="none" stroke-width="4"></circle>\r\n    </svg>\r\n</div>');}]);