﻿/*jshint globalstrict: true*/
/*jshint shadow: true*/
/*jshint loopfunc: true*/
/*global generateRegexTool: true*/
'use strict';

function loadValues(document, values, debugCallback)
{
  if (document === void 0 ||
      toType(values) !== 'object' && values !== null || values === void 0) {
    throw new Error('Arguments type error.');
  }

  // Get All Option Value.
  chrome.storage.local.get(null, function(items) {
    var debugList = []; // use Debug

    items = values || items;
    var element = null;
    for (var key in items) {
      var value = items[key];
      var elName = key.match(
          /(^[\w]*)_(text|password|radio|checkbox|number|textarea)$/);
      if (elName) {
        switch (elName[2]) {
          case 'number':
            element = document.evaluate(
                '//input[@name="' + elName[1] + '"]',
                document, null, 7, null);
            if (element.snapshotLength !== 1) {
              console.log('loadValues() Get ' + elName[1] + ' error.');
              continue;
            }
            element.snapshotItem(0).value = value;
            debugList.push(elName[1]);
            break;
          case 'radio':
            element = document.evaluate(
                '//input[@name="' + elName[1] + '"][@value="' + value + '"]',
                document, null, 7, null);
            if (element.snapshotLength !== 1) {
              console.log('loadValues() Get ' + elName[1] + ' error.');
              continue;
            }
            element.snapshotItem(0).checked = true;
            debugList.push(elName[1]);
            break;
          case 'checkbox':
            element = document.evaluate(
                '//input[@name="' + elName[1] + '"]', document, null, 7, null);
            if (element.snapshotLength !== 1) {
              console.log('loadValues() Get ' + elName[1] + ' error.');
              continue;
            }
            element.snapshotItem(0).checked = value;
            debugList.push(elName[1]);
            break;
          case 'password':
          case 'text':
            element = document.evaluate(
                '//input[@name="' + elName[1] + '"]', document, null, 7, null);
            if (element.snapshotLength !== 1) {
              console.log('loadValues() Get ' + elName[1] + ' error.');
              continue;
            }
            element.snapshotItem(0).value = trim(value);
            debugList.push(elName[1]);
            break;
          case 'textarea':
            element = document.evaluate(
                '//textarea[@name="' + elName[1] + '"]',
                document, null, 7, null);
            if (element.snapshotLength !== 1) {
              console.log('loadValues() Get ' + elName[1] + ' error.');
              continue;
            }
            element.snapshotItem(0).value = trim(value);
            debugList.push(elName[1]);
            break;
        }
      }
    }

    if (toType(debugCallback) === 'function') {
      debugCallback(debugList);
    }
  });
}

function saveValues(document, saveTypes, callback)
{
  if (document === void 0 || toType(saveTypes) !== 'array') {
    throw new Error('Invalid argument.');
  }

  // inputタグの保存するtype
  var types = '';
  for (var i = 0; i < saveTypes.length; i++) {
    types += '@type="' + saveTypes[i] + '"';
    if (i + 1 < saveTypes.length) {
      types += ' or ';
    }
  }

  var storageName;
  var writeData = {};
  var inputs = document.evaluate(
      '//input[' + types + ']', document, null, 7, null);
  for (var i = 0; i < inputs.snapshotLength; i++) {
    var item = inputs.snapshotItem(i);
    if (item.name.length === 0) {
      continue;
    }

    storageName = item.name + '_' + item.type;
    switch (item.type) {
      case 'radio':
        if (item.checked) {
          writeData[storageName] = item.value;
        }
        break;
      case 'checkbox':
        writeData[storageName] = item.checked;
        break;
      case 'text':
        writeData[storageName] = trim(item.value);
        break;
      case 'number':
        writeData[storageName] = item.value;
        break;
    }
  }

  var textareas = document.evaluate('//textarea', document, null, 7, null);
  for (var i = 0; i < textareas.snapshotLength; i++) {
    var item = textareas.snapshotItem(i);
    storageName = item.name + '_' + item.tagName.toLowerCase();
    writeData[storageName] = trim(item.value);
  }

  // writeData options.
  chrome.storage.local.set(writeData, function() {
    // writeDatad key catalog
    var debug = [];
    for (var key in writeData) {
      debug.push(key);
    }

    if (toType(callback) === 'function') {
      callback(debug);
    }
  });
}


/**
* 「解放に使うぺージを指定」の項目の有効無効状態を確認・変更
*/
function releasePageChangeState()
{
  var selectElement = document.evaluate(
      '//input[@name="release_page" and @value="assignment"]',
      document, null, 7, null);
  if (selectElement.snapshotLength !== 1) {
    throw new Error("onReleasePage function. can't get selectElement.");
  }

  var assi_options = document.evaluate(
      '//li[@id="assignment_options"]/input[@type="checkbox"]',
      document, null, 7, null);
  if (assi_options.snapshotLength !== 2) {
    throw new Error("onReleasePage function. can't get assi_options.");
  }
  var state = selectElement.snapshotItem(0).checked;
  var release_url = document.querySelector("input[name='release_url']");
  release_url.enabled = state;
  release_url.disabled = !state;
  for (var j = 0; j < assi_options.snapshotLength; j++) {
    assi_options.snapshotItem(j).disabled = state;
  }
}

document.addEventListener('DOMContentLoaded', function() {
  initTranslations(document, translation_path, 'Text');
  loadValues(document, default_values, function() {
    initKeybind(document, null, function() {
      loadValues(document, null, function() {
        releasePageChangeState();
      });
    });
  });

  var timeoutTime = 1000;

  // 設定項目など
  var elements = document.querySelectorAll("input[name='release_page']");
  for (var i = 0; i < elements.length; i++) {
    elements[i].addEventListener('click', releasePageChangeState);
  }

  // section buttons.
  var normal = document.getElementById('normal');
  var keybind = document.getElementById('keybind');
  normal.addEventListener('click', function() {
      document.getElementById('normal_options').style.display = 'block';
      normal.disabled = true;
      document.getElementById('keybind_options').style.display = 'none';
      keybind.disabled = false;
  });
  keybind.addEventListener('click', function() {
      document.getElementById('normal_options').style.display = 'none';
      normal.disabled = false;
      document.getElementById('keybind_options').style.display = 'block';
      keybind.disabled = true;
  });

  /* keybind */
  // Set Button
  var bindButtons = document.evaluate(
                '//button[@class="bindStart"]', document, null, 7, null);
  var bindStart = null;
  for (var i = 0; i < bindButtons.snapshotLength; i++) {
    bindButtons.snapshotItem(i).addEventListener('click', function() {
        bindStart = this.parentNode.parentNode.attributes.name.nodeValue;
    });
  }
  // Clear Button
  var bindClears = document.evaluate(
                '//button[@class="bindClear"]', document, null, 7, null);
  for (var i = 0; i < bindClears.snapshotLength; i++) {
    bindClears.snapshotItem(i).addEventListener('click', function() {
      var name = this.parentNode.parentNode.attributes.name.nodeValue;
      var optionName = name + '_keybind_text';
      if (default_values.hasOwnProperty(optionName)) {
        var keyInfo = JSON.parse(default_values[optionName]);
        var output = generateKeyString(keyInfo);
        showKey(document, name, output);
        copyKeyInfoToSaveArea(name, keyInfo);
      }
    });
  }
  function initKeybind(document, values, callback)
  {
    if (document === void 0 ||
        toType(values) !== 'object' && values !== null) {
      throw new Error(
        'initKeybind function is error. Invalid type of arguments.');
    }

    // show current key.
    chrome.storage.local.get(null, function(items) {
      var regex = /([\w_]+)_keybind_text/;
      var items = values || items;
      for (var key in items) {
        var matches = key.match(regex);
        if (matches) {
          var keyElement = document.getElementsByClassName(matches.input);
          if (keyElement !== void 0 && keyElement !== null) {
            var keyInfo = JSON.parse(items[key]);
            var output = generateKeyString(keyInfo);
            showKey(document, matches[1], output);
            copyKeyInfoToSaveArea(matches[1], keyInfo);

            if (toType(callback) === 'function') {
              callback();
            }
          }
        }
      }
    });
  }
  function keyCheck(e)
  {
    if (e === void 0) {
      throw new Error("Invalid argument. don't get event object.");
    }

    return {
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      meta: e.metaKey,
      keyCode: e.keyCode
    };
  }
  function generateKeyString(keyInfo)
  {
    if (toType(keyInfo) !== 'object') {
      throw new Error('Invalid type of argument.');
    }

    var output = '';
    if (keyInfo.meta) { output += 'Meta +'; }
    if (keyInfo.ctrl) { output += 'Ctrl +'; }
    if (keyInfo.alt) { output += 'Alt +'; }
    if (keyInfo.shift) { output += 'Shift +'; }
    var charKey = String.fromCharCode(keyInfo.keyCode);
    output += charKey;
    return output;
  }
  function showKey(document, bindStart, output)
  {
    if (document === void 0 ||
        toType(bindStart) !== 'string' || toType(output) !== 'string') {
      throw new Error('showKey function is error. invalid type of arguments.');
    }

    var elementCode =
        '//section[@id="keybind_options"]//tr[@name="' + bindStart + '"]';

    var outElement = document.evaluate(
        elementCode + '//*[@class="pressKey"]', document, null, 7, null);
    if (outElement.snapshotLength !== 1) {
      throw new Error('snapshotLength is not 1 in showKey.');
    }
    outElement.snapshotItem(0).value = output;
  }
  function copyKeyInfoToSaveArea(bindStart, keyInfo)
  {
    var elementCode =
        '//section[@id="keybind_options"]//tr[@name="' + bindStart + '"]';

    var keydata = document.evaluate(
        elementCode + '//input[@class="keydata"]', document, null, 7, null);
    if (keydata.snapshotLength !== 1) {
        throw new Error('snapshotLength is not 1 in copyKeyInfoToSaveArea.');
    }
    keydata.snapshotItem(0).value = JSON.stringify(keyInfo);
  }

  document.addEventListener('keyup', function(event) {
    try {
      if (bindStart !== null) {
        var keyInfo = keyCheck(event);
        if (32 < keyInfo.keyCode && keyInfo.keyCode < 123) {
          var output = generateKeyString(keyInfo);
          showKey(document, bindStart, output);
          copyKeyInfoToSaveArea(bindStart, keyInfo);
        } else {
          throw new Error("It don't correspond.");
        }
      }
    } catch (e) {
      if (e.message !== "It don't correspond.") {
        console.log(e.message);
        return;
      }

      var elementCode =
          '//section[@id="keybind_options"]//tr[@name="' + bindStart + '"]';

      var bind_status = document.evaluate(
          elementCode + '//*[@class="status"]', document, null, 7, null);
      if (bind_status.snapshotLength !== 1) {
          throw new Error('snapshotLength is not 1.');
      }
      var item = bind_status.snapshotItem(0);
      item.innerText = e.message;
      setTimeout(function() {
        item.innerText = '';
      }, timeoutTime);
    } finally {
      bindStart = null;
    }
  });

  /* status */
  var status = document.getElementById('status');
  document.getElementById('save').addEventListener('click', function() {
    saveValues(document, ['checkbox', 'radio', 'text', 'number'], function() {
      chrome.runtime.sendMessage({ event: 'initialize' });

      status.innerHTML = 'Options Saved.';
      setTimeout(function() {
        status.innerHTML = '';
      }, timeoutTime);
    });
  }, false);
  document.getElementById('load').addEventListener('click', function() {
    loadValues(document, null, function() {
      status.innerHTML = 'Options Loaded.';
      setTimeout(function() {
        status.innerHTML = '';
      }, timeoutTime);
    });
  }, false);
  document.getElementById('init').addEventListener('click', function() {
    loadValues(document, default_values, function() {
      initKeybind(document, default_values, function() {
        status.innerHTML = 'Options Initialized.';
        setTimeout(function() {
          status.innerHTML = '';
        }, timeoutTime);
      });
    });
  }, false);

  // Import and Export
  var config_view = document.getElementById('config_view');
  var config_view_status = document.getElementById('config_view_status');
  document.getElementById('export').addEventListener('click', function() {
    chrome.storage.local.get(null, function(items) {
      config_view.value = JSON.stringify(items);
    });
  }, false);
  document.getElementById('import').addEventListener('click', function() {
    try {
      var items = JSON.parse(config_view.value);
      loadValues(document, items, function() {
        config_view_status.textContent = 'Success. Please, save';
        config_view_status.style.color = 'green';
        setTimeout(function() {
          config_view_status.innerHTML = '';
        }, 1000);
      });
    } catch (error) {
      config_view_status.textContent = 'Import error. invalid string.';
      config_view_status.style.color = 'red';
      return;
    }
  }, false);

  /* 正規表現確認ツール関係 */
  // 正規表現確認ツールの表示・非表示アニメーション
  var switch_button_name = 'close_button';
  var tool_box = document.getElementById('tool_box');
  tool_box.appendChild(
    generateRegexTool('460px', switch_button_name, 'Text'));

  // toggle
  var switchButton = document.getElementsByClassName('switch_tool');
  for (var i = 0; i < switchButton.length; i++) {
    switchButton[i].addEventListener('click', function() {
      var close_button = tool_box.getElementsByClassName(switch_button_name);
      for (var j = 0; j < close_button.length; j++) {
        var evt = document.createEvent('UIEvent');
        evt.initEvent('click', false, false);
        close_button[j].dispatchEvent(evt);
      }
    });
  }
});
