/*jshint maxlen: 120, unused: false*/
(function(window) {
  "use strict";

  /* for this script. */
  function setObjectProperty(obj, name, value)
  {
    console.log('setObjectProperty in common.js', obj, name, value);
    if (obj.hasOwnProperty(name)) {
      throw new Error('Already contain to + obj', name, value);
    }
    obj[name] = value;
  }

  /* Default Values. */
  var defaultValues = {
    'no_release': false,
    'timer': 20,
    'exclude_url':
        '^https://\n' +
        '^http*://(10.\\d{0,3}|172.(1[6-9]|2[0-9]|3[0-1])|192.168).\\d{1,3}.\\d{1,3}\n' +
        'localhost\n' +
        'nicovideo.jp\n' +
        'youtube.com',
    'regex_insensitive': true,
    'enable_auto_purge': true,
    'remaiming_memory': 500,
    'max_history': 7,
    'max_sessions': 10,
    'purging_all_tabs_except_active': false,
    'max_opening_tabs': 5,
    'interval_timing': 5,

    'keybind_release': JSON.stringify({}),
    'keybind_switch_not_release': JSON.stringify({}),
    'keybind_all_purge': JSON.stringify({}),
    'keybind_all_purge_without_exclude_list': JSON.stringify({}),
    'keybind_all_unpurge': JSON.stringify({}),
    'keybind_exclude_url':
        'nicovideo.jp\n' +
        'youtube.com',
    'keybind_regex_insensitive': true,
  };
  setObjectProperty(window, 'versionKey', 'version');
  defaultValues[window.versionKey] = chrome.app.getDetails();

  setObjectProperty(window, 'previousSessionTimeKey', 'previous_session_time');
  defaultValues[window.previousSessionTimeKey] = null;

  setObjectProperty(window, 'defaultValues', defaultValues);

  setObjectProperty(window, 'dbName', 'TMP_DB');
  setObjectProperty(window, 'dbVersion', 2);
  setObjectProperty(window, 'dbHistoryName', 'history');
  setObjectProperty(window, 'dbDataURIName', 'dataURI');
  setObjectProperty(window, 'dbPageInfoName', 'pageInfo');
  setObjectProperty(window, 'dbSessionName', 'session');
  setObjectProperty(window, 'dbSavedSessionName', 'savedSession');

  var dbCreateStores = {};
  dbCreateStores[window.dbHistoryName] = {
    property: {
      keyPath: 'date',
      autoIncrement: false,
    },
  };
  dbCreateStores[window.dbDataURIName] = {
    property: {
      keyPath: 'host',
      autoIncrement: false,
    },
  };
  dbCreateStores[window.dbPageInfoName] = {
    property: {
      keyPath: 'url',
      autoIncrement: false,
    },
  };
  dbCreateStores[window.dbSessionName] = {
    property: {
      keyPath: 'id',
      autoIncrement: true,
    },
    indexs: {
      date: {
        targets: ['date'],
        property: { unique: false },
      },
    },
  };
  dbCreateStores[window.dbSavedSessionName] = {
    property: {
      keyPath: 'id',
      autoIncrement: true,
    },
    indexs: {
      date: {
        targets: ['date'],
        property: { unique: false },
      },
    },
  };
  setObjectProperty(window, 'dbCreateStores', dbCreateStores);

  var blankUrl = chrome.runtime.getURL('blank.html');
  setObjectProperty(window, 'extensionExcludeUrl',
      '^chrome-*\\w*://\n' +
      '^view-source:\n' +
      '^file:///\n' +
      '^' + blankUrl
  );

  // initTranslationsでキー名を使用するときに使う。
  // どのファイルを選択しても問題ない。
  setObjectProperty(window, 'translationPath',
    chrome.runtime.getURL('_locales/ja/messages.json') ||
    chrome.runtime.getURL('_locales/en/messages.json'));
  // file of get scroll position of tab.
  setObjectProperty(window, 'getScrollPosScript', 'js/load_scripts/getScrollPosition.js');

  // a value which represents of the exclude list.
  var excludeValues = [
    'DISABLE_TIMER',     // 1
    'INVALID_EXCLUDE',   // 2
    'KEYBIND_EXCLUDE',   // 4
    'NORMAL',            // 8
    'USE_EXCLUDE',       // 16
    'TEMP_EXCLUDE',      // 32
    'EXTENSION_EXCLUDE', // 64
  ];
  excludeValues.forEach(function(v, i) {
    window[v] = window[v] || 1 << i;
  });

  // the path of icons.
  // defined NORMAL etc... in common.js.
  var icons = new Map();
  var iconNumbers = new Map();
  iconNumbers.set('icon_disable_timer', DISABLE_TIMER);
  iconNumbers.set('icon_019', NORMAL);
  iconNumbers.set('icon_019_use_exclude', USE_EXCLUDE);
  iconNumbers.set('icon_019_temp_exclude', TEMP_EXCLUDE);
  iconNumbers.set('icon_019_extension_exclude', EXTENSION_EXCLUDE);

  var keybindIconSuffix = '_with_keybind';
  var iter = iconNumbers.entries();
  for (var i = iter.next(); !i.done; i = iter.next()) {
    icons.set(i.value[1], chrome.runtime.getURL('icon/' + i.value[0] + '.png'));
    icons.set(i.value[1] | KEYBIND_EXCLUDE,
      chrome.runtime.getURL('icon/' + i.value[0] + keybindIconSuffix + '.png'));
  }
  setObjectProperty(window, 'icons', icons);

  setObjectProperty(window, 'blankUrl', blankUrl);
  setObjectProperty(window, 'optionPage', chrome.runtime.getURL('options.html'));
  setObjectProperty(window, 'changeHistory', chrome.runtime.getURL('History.txt'));
  setObjectProperty(window, 'UPDATE_CONFIRM_DIALOG', 'TMP_UPDATE_CONFIRMATION_DIALOG');
  setObjectProperty(window, 'RESTORE_PREVIOUS_SESSION', 'TMP_RESTORE_PREVIOUS_SESSION');
  setObjectProperty(window, 'updateCheckTime', 30 * 60 * 1000); // min * sec * Millisec.
})(this);
