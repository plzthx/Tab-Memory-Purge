﻿"use strict"; /*jshint globalstrict: true*/

/**
 * set setInterval return value.
 * key = tabId
 * value = return setInterval value.
 */
var ticked = {};

/**
 * メモリ解放を行ったタブの情報が入ってる辞書型
 *
 * key = tabId
 * value = 下記のプロパティがあるオブジェクト
 *         url: 解放前のURL
 *         purgeurl: 休止ページのURL
 *         scrollPosition: スクロール量(x, y)を表すオブジェクト
 */
var unloaded = {};

/**
 * タブの解放を解除したタブのスクロール量(x, y)を一時的に保存する連想配列
 * key = tabId
 * value = スクロール量(x, y)を表す連想配列
 */
var temp_scroll_positions = {};

// the string that represents the temporary exclusion list
var temp_release = [];

// アクティブなタブを選択する前に選択していたタブのID
var old_active_ids = new TabIdHistory();

// the backup of released tabs.
var Backup = function(key) {
  this.key = key || '__backup_TABMEMORYPURGE__';
};
Backup.prototype.update = function(data, callback) {
  if (data === void 0 || data === null) {
    throw new Error('a invalid type of arguments.');
  }
  var write = {};
  write[this.key] = JSON.stringify(data);
  chrome.storage.local.set(write, function() {
    if (toType(callback) === 'function') {
      callback();
    }
  });
};
Backup.prototype.get = function(callback) {
  if (toType(callback) !== 'function') {
    throw new Error('A invalid type of arugments.');
  }

  chrome.storage.local.get(this.key, function(storages) {
    var backup = storages[this.key];
    if (toType(backup) === 'string' && backup !== '{}') {
      callback(JSON.parse(backup));
    }
  });
};
Backup.prototype.remove = function(callback) {
  if (toType(callback) !== 'function') {
    throw new Error('A invalid type of arugments.');
  }

  chrome.storage.local.remove(this.key, function() {
      callback();
  });
};
var tabBackup = new Backup();

// The url of the release point.
var blank_urls = {
  'local': chrome.runtime.getURL('blank.html'),
  'normal': 'https://tabmemorypurge.appspot.com/blank.html',
  'noreload': 'https://tabmemorypurge.appspot.com/blank_noreload.html'
};

// file of get scroll position of tab.
var get_scrollPos_script =
    'public/javascripts/content_scripts/getScrollPosition.js';

// a value which represents of the exclude list.
var NORMAL_EXCLUDE = 50000;
var USE_EXCLUDE = 50001;
var TEMP_EXCLUDE = 50002;
var EXTENSION_EXCLUDE = 50003;

// the path of icons.
// defined NORMAL_EXCLUDE etc... in common.js.
var icons = {};
icons[NORMAL_EXCLUDE] = chrome.runtime.getURL('icon/icon_019.png');
icons[USE_EXCLUDE] = chrome.runtime.getURL('icon/icon_019_use_exclude.png');
icons[TEMP_EXCLUDE] = chrome.runtime.getURL('icon/icon_019_temp_exclude.png');
icons[EXTENSION_EXCLUDE] =
    chrome.runtime.getURL('icon/icon_019_extension_exclude.png');

var extension_exclude_url =
    '^chrome-*\\w*://\n' +
    '^view-source:\n' +
    'tabmemorypurge.appspot.com/\n' +
    '^file:///\n';

function reloadBadge()
{
  var length = 0;
  for (var i in unloaded) {
    length++;
  }
  var badgeText = length.toString();
  chrome.browserAction.setBadgeText({ text: badgeText });
}

/**
* タブの解放を行います。
* @param {Number} tabId タブのID.
*/
function purge(tabId)
{
  if (toType(tabId) !== 'number') {
    throw new Error("Invalid argument. tabId isn't number.");
  }

  chrome.storage.local.get(null, function(storages) {
    chrome.tabs.get(tabId, function(tab) {
      // objScroll = タブのスクロール量(x, y)
      chrome.tabs.executeScript(
          tabId, { file: get_scrollPos_script }, function(objScroll) {
            var args = '';

            var title = tab.title ? '&title=' + tab.title : '';
            var favicon = tab.favIconUrl ? '&favicon=' + tab.favIconUrl : '';

            // 解放に使うページを設定
            var page = blank_urls.local;
            var storageName = 'release_page_radio';
            var release_page = storages[storageName] ||
                               default_values[storageName];
            switch (release_page) {
              case 'author': // 作者サイト
                storageName = 'no_release_checkbox';
                var no_release = storages[storageName] ||
                                 default_values[storageName];
                page = no_release ? blank_urls.noreload : blank_urls.normal;
                args += title + favicon;
                break;
              case 'normal': // 拡張機能内
                args += title + favicon;
                break;
              case 'assignment': // 指定URL
                storageName = 'release_url_text';
                var assignment_url = storages[storageName] ||
                                     default_values[storageName];
                if (assignment_url !== '') {
                  page = assignment_url;
                }

                storageName = 'assignment_title_checkbox';
                var checked_title = storages[storageName] ||
                                    default_values[storageName];
                if (checked_title) {
                  args += title;
                }

                storageName = 'assignment_favicon_checkbox';
                var checked_favicon = storages[storageName] ||
                                      default_values[storageName];
                if (checked_favicon) {
                  args += favicon;
                }
                break;
              default: // 該当なしの時は初期値を設定
                console.log("'release page' setting error." +
                            ' so to set default value.');
                chrome.storage.local.remove('release_page_radio');
                purge(tabId); // この関数を実行し直す
                break;
            }

            if (tab.url) {
              args += '&url=' + encodeURIComponent(tab.url);
            }
            var url = encodeURI(page) + '?' + encodeURIComponent(args);

            chrome.tabs.update(tabId, { url: url }, function(updated) {
              unloaded[updated.id] = {
                url: tab.url,
                purgeurl: url,
                scrollPosition: objScroll[0] || { x: 0 , y: 0 }
              };
              reloadBadge();
              deleteTick(tabId);
              tabBackup.update(unloaded);
            });
          });
    });
  });
}


/**
* 解放したタブを復元します。
* 引数urlが指定されていた場合、unloadedに該当するタブが
* 解放されているかどうかに関わらず、解放処理が行われる。
* @param {Number} tabId 復元するタブのID.
*/
function unPurge(tabId)
{
  if (toType(tabId) !== 'number') {
    throw new Error("Invalid argument. tabId isn't number.");
  }

  var url = unloaded[tabId].url;
  if (toType(url) !== 'string') {
    throw new Error("Can't get url of tabId in unloaded.");
  }

  chrome.tabs.update(tabId, { url: url }, function() {
    // スクロール位置を一時的に保存
    temp_scroll_positions[tabId] = unloaded[tabId].scrollPosition;

    delete unloaded[tabId];
    reloadBadge();
    setTick(tabId);
    tabBackup.update(unloaded);
  });
}


/**
* 解放状態・解放解除を交互に行う
* @param {Number} tabId 対象のタブのID.
*/
function purgeToggle(tabId)
{
  if (toType(tabId) !== 'number') {
    throw new Error("Invalid argument. tabId isn't number.");
  }

  if (unloaded[tabId]) {
    unPurge(tabId);
  } else {
    purge(tabId);
  }
}


/**
* 指定した除外リストの正規表現に指定したアドレスがマッチするか調べる
* @param {String} url マッチするか調べるアドレス.
* @param {Object} excludeOptions 除外リストの設定を表すオブジェクト.
*                        list    除外リストの値。複数のものは\nで区切る.
*                        options 正規表現のオプション.
* @param {Function} callback callback function.
*                   コールバック関数の引数にはBoolean型の値が入る.
*                   マッチしたらtrue, しなかったらfalse.
*/
function checkMatchUrlString(url, excludeOptions, callback)
{
  if (toType(url) !== 'string') {
    throw new Error("Invalid argument. the url isn't string.");
  }
  if (toType(excludeOptions) !== 'object') {
    throw new Error("Invalid argument. the excludeOptions isn't object.");
  }
  if (toType(excludeOptions.list) !== 'string') {
    throw new Error(
        "Invalid argument. the list in the excludeOptions isn't string.");
  }
  if (toType(excludeOptions.options) !== 'string') {
    throw new Error(
        "Invalid argument. the option in the excludeOptions isn't string.");
  }
  if (toType(callback) !== 'function') {
    throw new Error("Invalid argument. callback argument don't function type.");
  }

  var exclude_array = excludeOptions.list.split('\n');
  for (var i = 0; i < exclude_array.length; i++) {
    if (exclude_array[i] !== '') {
      var re = new RegExp(exclude_array[i], excludeOptions.options);
      if (re.test(url)) {
        callback(true);
        return;
      }
    }
  }
  callback(false);
}


/**
* 与えられたURLが全ての除外リストに一致するか検索する。
* @param {String} url 対象のURL.
* @param {Function} callback callback function.
*                   コールバック関数の引数にはどのリストと一致したの数値が入る。
*                   USE_EXCLUDE    = 通常のユーザが変更できる除外アドレス
*                   TEMP_EXCLUDE   = 一時的な非解放リスト
*                   NORMAL_EXCLUDE = 一致しなかった。.
*/
function checkExcludeList(url, callback)
{
  if (toType(url) !== 'string') {
    throw new Error("Invalid argument. url isn't string.");
  }
  if (toType(callback) !== 'function') {
    throw new Error("Invalid argument. callback argument don't function type.");
  }

  chrome.storage.local.get(null, function(storages) {
    // Check exclusion list in the extension.
    checkMatchUrlString(
        url,
        { list: extension_exclude_url, options: 'i' },
        function(extension_match) {
          if (extension_match) {
            callback(EXTENSION_EXCLUDE);
            return;
          }

          // Check exclusion list in the options page.
          var storageName = 'exclude_url_textarea';
          var exclude_url = storages[storageName] ||
                            default_values[storageName];
          // get regular regex option.
          storageName = 'regex_insensitive_checkbox';
          var regex_insensitive = storages[storageName] ||
                                  default_values[storageName];
          checkMatchUrlString(
              url,
              { list: exclude_url, options: regex_insensitive ? 'i' : ''},
              function(normal_match) {
                if (normal_match) {
                  callback(USE_EXCLUDE);
                  return;
                }

                // Compared to the temporary exclusion list.
                if (temp_release.indexOf(url) !== -1) {
                  callback(TEMP_EXCLUDE);
                  return;
                }

                callback(NORMAL_EXCLUDE);
              }
          );
        }
    );
  });
}


/**
* 定期的に実行される関数。アンロードするかどうかを判断。
* @param {Number} tabId 処理を行うタブのID.
*/
function tick(tabId)
{
  if (toType(tabId) !== 'number') {
    throw new Error("Invalid argument. tabId isn't number.");
  }

  if (toType(unloaded[tabId]) !== 'object') {
    chrome.tabs.get(tabId, function(tab) {
      // アクティブタブへの処理の場合、行わない
      if (tab.active) {
        // アクティブにしたタブのアンロード時間更新
        unloadTimeProlong(tabId);
      } else {
        purge(tabId);
      }
    });
  }
}

/**
* 定期的に解放処理の判断が行われるよう設定します。
* @param {Number} tabId 設定するタブのID.
*/
function setTick(tabId)
{
  if (toType(tabId) !== 'number') {
    throw new Error("Invalid argument. tabId isn't number.");
  }

  chrome.storage.local.get(null, function(storages) {
    chrome.tabs.get(tabId, function(tab) {
      if (tab === void 0 || !tab.hasOwnProperty('url')) {
        return;
      }

      checkExcludeList(tab.url, function(state) {
        // 全ての除外アドレス一覧と比較
        if (state === NORMAL_EXCLUDE) {
          // 除外アドレスに含まれていない場合
          var storageName = 'timer_number';
          var timer = storages[storageName] || default_values[storageName];
          timer = timer * 60 * 1000; // 分(設定) * 秒数 * ミリ秒

          ticked[tabId] = setInterval(function() { tick(tabId); } , timer);
        } else { // include exclude list
          deleteTick();
        }
      });
    });
  });
}


/**
* 定期的な処理を停止
* @param {Number} tabId 停止するタブのID.
*/
function deleteTick(tabId)
{
  if (ticked.hasOwnProperty(tabId)) {
    clearInterval(ticked[tabId]);
    delete ticked[tabId];
  }
}


/**
* アンロード時間の延長
* @param {Number} tabId 延長するタブのID.
*/
function unloadTimeProlong(tabId)
{
  deleteTick(tabId);
  setTick(tabId);
}


/**
* 指定した辞書型の再帰処理し、タブを復元する。
* 引数は第一引数のみを指定。
*
* @param {Object} object オブジェクト型。これのみを指定する.
*                        基本的にオブジェクト型unloaded変数のバックアップを渡す.
* @param {String} keys オブジェクト型のキー名の配列.省略可能.
* @param {Number} index keysの再帰処理開始位置.デフォルトは0、省略可能.
* @param {Number} end keysの最後の要素から一つ後の位置.
*                     デフォルトはkeys.length、省略可能.
*/
function restore(object, keys, index, end)
{
  if (toType(object) !== 'object') {
    throw new Error("Invalid argument. object isn't object.");
  }
  if (keys !== void 0 && toType(keys) !== 'array') {
    throw new Error("Invalid argument. keys isn't array or undefined.");
  }
  if (index !== void 0 && toType(index) !== 'number') {
    throw new Error("Invalid argument. index isn't number or undefined.");
  }
  if (end !== void 0 && toType(end) !== 'number') {
    throw new Error("Invalid argument. end isn't number or undefined.");
  }

  // 最後まで処理を行ったらunloadedに上書き
  if (index >= end) {
    unloaded = object;
    return;
  }

  // 初期値
  if (toType(keys) !== 'array') {
    keys = [];
    for (var i in object) {
      keys.push(i);
    }
    index = 0;
    end = keys.length;
  }

  var tabId = parseInt(keys[index], 10);
  chrome.tabs.get(tabId, function(tab) {
    if (tab === void 0 || tab === null) {
      // タブが存在しない場合、新規作成
      var purgeurl = object[tabId].purgeurl;
      chrome.tabs.create({ url: purgeurl, active: false }, function(tab) {
        var temp = object[tabId];
        delete object[tabId];
        object[tab.id] = temp;

        restore(object, keys, ++index, end);
      });
    }
  });
}

/**
 * 指定したタブの状態に合わせ、ブラウザアクションのアイコンを変更する。
 * 保存データには変更したアイコンファイルを表す文字列が入る。
 * この値はハッシュ変数(icons)のキー名でもある。
 * @param {Tab} tab 対象のタブ.
 */
function reloadBrowserIcon(tab)
{
  if (toType(tab) !== 'object') {
    throw new Error("Invalid argument. tab isn't object.");
  }

  checkExcludeList(tab.url, function(change_icon) {
    chrome.browserAction.setIcon(
        { path: icons[change_icon], tabId: tab.id }, function() {
          var save = {};
          save.purgeIcon = change_icon;
          chrome.storage.local.set(save);
        }
    );
  });
}


/**
* 非解放・非解放解除を交互に行う
* @param {Tab} tab 対象のタブオブジェクト.
*/
function tempReleaseToggle(tab)
{
  if (toType(tab) !== 'object') {
    throw new Error("Invalid argument. tab isn't object.");
  }

  var index = temp_release.indexOf(tab.url);
  if (index === -1) {
    // push url in temp_release.
    temp_release.push(tab.url);
  } else {
    // remove url in temp_release.
    temp_release.splice(index, 1);
  }
  reloadBrowserIcon(tab);
  unloadTimeProlong(tab.id);
}


/**
* 指定されたタブに最も近い未解放のタブをアクティブにする。
* 右側から探索され、見つからなかったら左側を探索する。
* 何も見つからなければ新規タブを作成してそのタブをアクティブにする。
* @param {Tab} tab 基準点となるタブ.
*/
function searchUnloadedTabNearPosition(tab)
{
  if (toType(tab) !== 'object') {
    throw new Error("Invalid argument. tab isn't object.");
  }

  // 現在のタブの左右の未解放のタブを選択する
  chrome.windows.get(tab.windowId, { populate: true }, function(win) {
    // current tab index.
    var i = tab.index;

    // Search right than current tab.
    var j = i + 1;
    while (j < win.tabs.length && unloaded.hasOwnProperty(win.tabs[j].id)) {
      j++;
    }

    // Search the left if can't find.
    if (j >= win.tabs.length) {
      j = i - 1;
      while (0 <= j && unloaded.hasOwnProperty(win.tabs[j].id)) {
        j--;
      }
    }

    if (0 <= j && j < win.tabs.length) {
      // If found tab, It's active.
      chrome.tabs.update(win.tabs[j].id, { active: true });
    } else {
      // If can not find the tab to activate to create a new tab.
      chrome.tabs.create({ active: true });
    }
  });
}


/**
 * 初期化.
 */
function initialize()
{
  chrome.windows.getAll({ populate: true }, function(wins) {
    for (var i = 0; i < wins.length; i++) {
      for (var j = 0; j < wins[i].tabs.length; j++) {
        setTick(wins[i].tabs[j].id);
      }
    }
  });
  reloadBadge();
}

chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.storage.local.get(null, function(storages) {
    chrome.tabs.get(activeInfo.tabId, function(tab) {
      // アイコンの状態を変更
      reloadBrowserIcon(tab);

      // 前にアクティブにされていたタブのアンロード時間を更新
      if (!old_active_ids.isEmpty(tab.windowId)) {
        unloadTimeProlong(old_active_ids.lastPrevious(tab.windowId));
      }
      old_active_ids.update({ windowId: tab.windowId, id: activeInfo.tabId });

      if (toType(unloaded[activeInfo.tabId]) === 'object') {
        var storageName = 'no_release_checkbox';
        var no_release = storages[storageName] || default_values[storageName];
        if (no_release === false) {
          // アクティブにしたタブがアンロード済みだった場合、再読込
          // 解放ページ側の処理と二重処理になるが、
          // どちらかが先に実行されるので問題なし。
          unPurge(activeInfo.tabId);
        } else {
          delete unloaded[activeInfo.tabId];
        }
      }
    });
  });
});

chrome.tabs.onCreated.addListener(function(tab) {
  setTick(tab.id);
});

chrome.tabs.onAttached.addListener(function(tabId) {
  setTick(tabId);
});

chrome.tabs.onRemoved.addListener(function(tabId) {
  delete unloaded[tabId];
  deleteTick(tabId);
  tabBackup.update(unloaded);
});

chrome.tabs.onDetached.addListener(function(tabId) {
  delete unloaded[tabId];
  deleteTick(tabId);
  tabBackup.update(unloaded);
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    reloadBrowserIcon(tab);

    // 解放解除時に動作。
    // 指定したタブの解放時のスクロール量があった場合、それを復元する
    var scrollPos = temp_scroll_positions[tab.id];
    if (toType(scrollPos) === 'object') {
      chrome.tabs.executeScript(
          tab.id, { code: 'scroll(' + scrollPos.x + ', ' + scrollPos.y + ');' },
          function() {
            delete temp_scroll_positions[tab.id];
          }
      );
    }
  }
});

chrome.windows.onRemoved.addListener(function(windowId) {
  old_active_ids.remove({ windowId: windowId });
  if (old_active_ids.length <= 0) {
    tabBackup.remove();
  }
});

chrome.runtime.onMessage.addListener(function(message) {
  switch (message.event) {
    case 'initialize':
      initialize();
      break;
    case 'release':
      chrome.tabs.getSelected(function(tab) {
        purgeToggle(tab.id);
        searchUnloadedTabNearPosition(tab);
      });
      break;
    case 'non_release':
      chrome.tabs.getSelected(function(tab) {
        tempReleaseToggle(tab);
      });
      break;
    case 'all_unpurge':
      // 解放されている全てのタブを解放解除
      for (var key in unloaded) {
        unPurge(parseInt(key, 10));
      }
      break;
    case 'restore':
      tabBackup.get(function(json) {
        restore(json);
      });
      break;
  }
});

initialize();