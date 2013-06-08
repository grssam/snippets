/**
 * Copyright (C) 2013 Girish Sharma <scrapmachines@gmail.com>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Author:
 *   Girish Sharma <scrapmachines@gmail.com>
 */
(function (root, factory) {
  'use strict';

  // Universal Module Definition (UMD) to support AMD, CommonJS/Node.js,
  // Rhino, and plain browser loading.
  if (typeof define === 'function' && define.amd) {
    define(['exports'], factory);
  }
  else if (typeof exports !== 'undefined') {
    factory(exports);
  }
  else {
    factory((root.selectors = {}));
  }
}(this, function (exports) {

// Maximum number of selector suggestions shown in the panel.
var MAX_SUGGESTIONS = 15,
// Maximum allowed width of the popup.
    MAX_POPUP_WIDTH = 400;

/**
 * Autocomplete popup UI implementation.
 *
 * @constructor
 * @param Document aDocument
 *        The document you want the popup attached to.
 * @param Object aOptions
 *        An object consiting any of the following options:
 *        - font {String} The font that is being used in the input box.
 *        - class {String} The class that you want the popup to have.
 *        - position {String} The preffered position of the popup (above or below).
 *        - autoSelect {Boolean} Boolean to allow the first entry of the popup
 *                     panel to be automatically selected when the popup shows.
 *        - onSelect {String} The select event handler for the popup.
 *        - onClick {String} The click event handler for the popup.
 *        - onKeypress {String} The keypress event handler for the popup.
 */
var Popup = function Popup(aDocument, aOptions) {
  this.document = aDocument;

  aOptions = aOptions || {};
  this.autoSelect = aOptions.autoSelect || false;
  this.position = aOptions.position || "above";

  this.onSelect = aOptions.onSelect;
  this.onClick = aOptions.onClick;
  this.onKeypress = aOptions.onKeypress;
  this._onKeypress = this._onKeypress.bind(this);
  this._onClick = this._onClick.bind(this);

  var id = "selectorsPopup";
  // Reuse the existing popup elements.
  this.panel = this.document.getElementById(id);
  if (!this.panel) {
    this.panel = this.document.createElement("div");
    this.panel.setAttribute("id", id);
    this.panel.className = aOptions.class || "autocomplete";
    this.document.documentElement.appendChild(this.panel);
  }
  else {
    this.panel.className = aOptions.class || "autocomplete"
  }

  if (this.onSelect) {
    this.panel.addEventListener("select", this.onSelect, false);
  }

  this.panel.addEventListener("keypress", this._onKeypress, false);
  this.panel.addEventListener("mouseup", this._onClick, false);

  // Detecting webkit due to https://bugs.webkit.org/show_bug.cgi?id=92029 :(
  this.isWebkit = !!navigator.userAgent.match(/webkit/ig);

  if (this.isWebkit) {
    this.document.addEventListener("keydown", function(event) {
      if (!this.isOpen()) {
        return;
      }
      if (event.keyCode == 38) {
        this.selectPreviousItem();
      }
      else if (event.keyCode == 40) {
        this.selectNextItem();
      }
      else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    }.bind(this));
  }

  // creating the CSS
  var css = document.getElementById("selectorPopupCSS");
  if (!css) {
    var css = document.createElement('style');
    css.id = "selectorPopupCSS";
    css.type = 'text/css';
    document.querySelector("head").appendChild(css);
  }

  // A trick to write formatted CSS without any inturruption.
  // Using /*! to prevent this comment from getting removed after minifying.
  var styles = function() {/*!
#selectorsPopup {
  background: white;
  box-shadow: 0 0 5px lightblue;
  border-radius: 4px;
  position: absolute;
  z-index: 99999;
  overflow: hidden;
  display: none;
  min-width: 150px;
}
#selectorsPopup pre {
  margin: 0 !important;
}
#selectorsPopup label {
  color: grey;
  display: inline-block;
  width: calc(100% - 10px);
  padding: 0px 4px;
  float: left;
  border: 1px solid transparent;
  font-family: %FONT%;
}
#selectorsPopup pre:nth-child(2) label {
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}
#selectorsPopup pre:last-child label {
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
}
#selectorsPopup label.pre:before {
  color: #000;
  content: attr(data-pre);
  display: inline-block;
}
#selectorsPopup label.count {
  padding: 0 20px 0 4px !important;
}
#selectorsPopup label.count:after {
  color: #000;
  content: attr(data-count);
  display: inline-block;
  float: right;
  width: 0;
  margin: 0 10px 0 -10px;
}
#selectorsPopup input {
  opacity: 0;
  margin: -20px 0 0 0 !important;
  float: right;
  pointer-events: none;
}
#selectorsPopup label:hover:active,
#selectorsPopup input:checked + pre label {
  background: lightblue;
}
#selectorsPopup input:checked:focus + pre label,
#selectorsPopup label:hover {
  border: 1px solid #224;
}
#selectorsPopup input:checked:focus + pre label,
#selectorsPopup input:checked:focus + pre label.pre:before,
#selectorsPopup input:checked:focus + pre label.count:after {
  color: #000;
}
*/}.toString().split("/*")[1].split("*/")[0].slice(1)
   .replace("%FONT%", aOptions.font || "");

  if (css.styleSheet) {
    css.styleSheet.cssText = styles;
  }
  else {
    css.appendChild(document.createTextNode(styles));
  }
}

Popup.prototype = {
  document: null,
  panel: null,

  // Event handlers.
  onSelect: null,
  onClick: null,
  onKeypress: null,

  _open: false,
  _cachedString: "",
  values: [],
  selectedIndex: -1,
  height: null,

  /**
   * Open the autocomplete popup panel.
   *
   * @param x {Number} The x coordinate of the top left point of the input box.
   * @param y {Number} The y coordinate of the top left point of the input box.
   */
  openPopup: function P_openPopup(x, y) {
    this.panel.style.display = "block";
    // If position is above, the (x, y) point will be the bottom left point of
    // the popup, unless there is not enough space to show the popup above.
    if (this.position == "above") {
      var height = 0;
      if (this.values.length) {
        var style = this.panel.getBoundingClientRect();
        height = style.height;
      }
      this.panel.style.top = (y - height) +"px";
    }
    else {
      this.panel.style.top = (y + 20) +"px";
    }
    this.panel.style.left = x +"px";
    this._open = true;

    if (this.autoSelect) {
      this.selectFirstItem();
    }
  },

  /**
   * Hide the autocomplete popup panel.
   */
  hidePopup: function P_hidePopup() {
    this._open = false;
    this.panel.style.display = "none";
  },

  /**
   * Check if the autocomplete popup is open.
   */
  isOpen: function P_isOpen() {
    return this._open;
  },

  /**
   * Destroy the object instance.
   */
  destroy: function P_destroy() {
    if (this.isOpen()) {
      this.hidePopup();
    }
    this.clearItems();

    if (this.onSelect) {
      this.panel.removeEventListener("select", this.onSelect, false);
    }

    this.panel.removeEventListener("keypress", this._onKeypress, false);
    this.panel.removeEventListener("mouseup", this._onClick, false);

    this.panel.parentNode.removeChild(this.panel);
    this.document = null;
    this.panel = null;
  },

  /**
   * Gets the autocomplete items array.
   *
   * @param aIndex {Number} The index of the item what is wanted.
   *
   * @return {Object} The autocomplete item at index aIndex.
   */
  getItemAtIndex: function P_getItemAtIndex(aIndex) {
    return this.values[aIndex];
  },

  /**
   * Get the autocomplete items array.
   *
   * @return {Array} The array of autocomplete items.
   */
  getItems: function P_getItems() {
    return this.values;
  },

  /**
   * Sets the autocomplete items list, in one go.
   *
   * @param {Array} aItems
   *        The list of items you want displayed in the popup list.
   */
  setItems: function P_setItems(aItems) {
    this.clearItems();
    aItems.forEach(this.appendItem, this);

    this._flushItems();

    if (this.isOpen() && this.autoSelect) {
      this.selectFirstItem();
    }
  },

  /**
   * Selects the first item of the richlistbox. Note that first item here is the
   * item closes to the input element, which means that 0th index if position is
   * below, and last index if position is above.
   */
  selectFirstItem: function P_selectFirstItem() {
    if (this.position.indexOf("above") > -1) {
      this.panel.childNodes[(this.selectedIndex = this.values.length - 1)*2].checked = true;
    }
    else {
      this.panel.childNodes[this.selectedIndex = 0].checked = true;
    }
  },

  /**
   * Private method to handle keypress on the popup, update the selectedIndex
   * and then call the provided onKeypress method.
   *
   * @private
   */
  _onKeypress: function P__onKeypress() {
    for (var i = 0; i < this.values.length; i++) {
      if (this.panel.childNodes[i*2].checked) {
        this.selectedIndex = i;
        break;
      }
    }
    if (this.onKeypress) {
      this.onKeypress(aEvent);
    }
  },

  /**
   * Private method to handle click on the popup, update the selectedIndex and
   * then call the provided onKeypress method.
   *
   * @private
   */
  _onClick: function P__onClick(aEvent) {
    for (var i = 0; i < this.values.length; i++) {
      if (this.panel.childNodes[i*2 + 1].firstChild == aEvent.target) {
        this.selectedIndex = i;
        break;
      }
    }
    if (this.onClick) {
      this.onClick(aEvent);
    }
  },

  /**
   * Clears all the items from the autocomplete list.
   */
  clearItems: function P_clearItems() {
    this.panel.innerHTML = "";
    this.selectedIndex = -1;
    this._cachedString = "";
    this.values = [];
  },

  /**
   * Returns the object associated with the selected item. Note that this does
   * not return the DOM element of the selected item, but the object in the form
   * of {label, preLabe, count}.
   *
   * @return {Object} The object corresponding to the selected item.
   */
  getSelectedItem: function P_getSelectedItem() {
    return this.values[this.selectedIndex];
  },

  /**
   * Appends an item into the autocomplete list.
   *
   * @param {Object} aItem
   *        The item you want appended to the list.
   *        The item object can have the following properties:
   *        - label {String} Property which is used as the displayed value.
   *        - preLabel {String} [Optional] The String that will be displayed
   *                   before the label indicating that this is the already
   *                   present text in the input box, and label is the text
   *                   that will be auto completed. When this property is
   *                   present, |preLabel.length| starting characters will be
   *                   removed from label.
   *        - count {Number} [Optional] The number to represent the count of
   *                autocompleted label.
   */
  appendItem: function P_appendItem(aItem) {
    var str = this._cachedString;
    var label = aItem.label.slice((aItem.preLabel || "").length);
    str += "<input type='radio' name='autocomplete-radios' value='" + label +
           "' id='" + label + "'><pre><label";
    var cls = "";
    if (aItem.preLabel) {
      str += " data-pre='" + aItem.preLabel + "'";
      cls += "pre";
    }
    if (aItem.count && aItem.count > 1) {
      str += " data-count='" + aItem.count + "'";
      cls += " count";
    }
    if (cls) {
      str += " class='" + cls + "'";
    }
    str += " for='" + label + "'>" + label + "</label></pre>";
    this._cachedString = str;
    this.values.push(aItem);
  },

  /**
   * Method to flush the generated string by the appendItems method into the
   * panel's inner HTML.
   *
   * @private
   */
  _flushItems: function P__flushItems() {
    this.panel.innerHTML = this._cachedString;
  },

  /**
   * Finds the label element that belongs to an item.
   *
   * @private
   *
   * @param {Object} aItem
   *        The object you want found in the list.
   *
   * @return {nsIDOMNode|null}
   *         The nsIDOMNode that belongs to the given item object. This node is
   *         the label element.
   */
  _findListItem: function P__findListItem(aItem) {
    var toReturn = null;
    this.values.some(function (item, i) {
      var found = true;
      for (var a in item) {
        if (item[a] != aItem[a]) {
          found = false;
        }
      }
      if (found) {
        toReturn = this.panel.childNodes[i*2];
        return true
      }
    });
    return toReturn;
  },

  /**
   * Removes an item from the popup list.
   *
   * @param {Object} aItem
   *        The item you want removed.
   */
  removeItem: function P_removeItem(aItem) {
    var item = this._findListItem(aItem);
    item && this.panel.removeChild(item.nextSibling) && this.panel.removeChild(item);
  },

  /**
   * Returns the number of items in the popup.
   *
   * @returns {Number} The number of items in the popup
   */
  itemCount: function P_itemCount() {
    return this.values.length;
  },

  /**
   * Selects the next item in the list.
   *
   * @return {Object} The newly selected item object.
   */
  selectNextItem: function P_selectNextItem() {
    if (this.selectedIndex < (this.itemCount() - 1)) {
      this.selectedIndex++;
    }
    else {
      this.selectedIndex = 0;
    }
    this.panel.childNodes[this.selectedIndex*2].checked = true;
    return this.getSelectedItem();
  },

  /**
   * Selects the previous item in the list.
   *
   * @return {Object} The newly selected item object.
   */
  selectPreviousItem: function P_selectPreviousItem() {
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
    }
    else {
      this.selectedIndex = this.itemCount() - 1;
    }
    this.panel.childNodes[this.selectedIndex*2].checked = true;
    return this.getSelectedItem();
  },

  /**
   * Focuses the selected item in the popup.
   */
  focus: function P_focus() {
    this.panel.childNodes[this.selectedIndex*2].checked = true;
    this.panel.childNodes[this.selectedIndex*2].focus();
  },
};

/**
 * Converts any input box on a page to a CSS selector search and suggestion box.
 *
 * @constructor
 * @param {nsIDOMDocument} aContentDocument
 *        The content document which inspector is attached to.
 * @param {nsiInputElement|String} aInputNode
 *        The input element or the selector for teh input element to which the
 *        panel will be attached and from where search input will be taken.
 * @param {Object} aOptions
 *        The options provided to the selector. Current available options are:
 *        - TODO
 * @arguments The following combinations of the above three arguments is possible
 *            - (aContentDocument, aInputNode[, aOptions])
 *            - (aContentDocument, String[, aOptions])
 *            - (aInputNode[, aOptions])
 *            - (String[, aOptions])
 */
function SelectorSearch() {
  this.searchBox = (typeof arguments[0] == "string")
                   ? (this.doc = document).querySelector(arguments[0])
                   : (!arguments[0].ownerDocument)
                     ? (this.doc = arguments[0] && typeof arguments[1] == "string")
                       ? this.doc.querySelector(arguments[1])
                       : arguments[1]
                     : (this.doc = arguments[0].ownerDocument, arguments[0]);

  var last = arguments[arguments.length - 1];
  this.options = (last !== this.searchBox)
                 ? (typeof last == "object")
                   ? last : {}
                 : {};
  this.panelDoc = this.searchBox.ownerDocument;

  // initialize variables.
  this._lastSearched = null;
  this._lastValidSearch = "";
  this._lastToLastValidSearch = null;
  this._searchResults = null;
  this._searchSuggestions = {};
  this._searchIndex = 0;

  // bind!
  this._showPopup = this._showPopup.bind(this);
  this._onHTMLSearch = this._onHTMLSearch.bind(this);
  this._onSearchKeypress = this._onSearchKeypress.bind(this);
  this._onListBoxKeypress = this._onListBoxKeypress.bind(this);

  // Options for the Popup.
  var options = {
    font: this.searchBox.ownerDocument.defaultView.getComputedStyle(this.searchBox).fontFamily,
    autoSelect: true,
    onClick: this._onListBoxKeypress,
    onSelect: this._onListBoxKeypress,
    onKeypress: this._onListBoxKeypress,
  };
  this.searchPopup = new Popup(this.panelDoc, options);

  // event listeners.
  this.searchBox.addEventListener("keypress", this._onSearchKeypress, true);
  this.searchBox.addEventListener("input", this._onHTMLSearch, true);
}

SelectorSearch.prototype = {

  // The possible states of the query.
  States: {
    CLASS: "class",
    ID: "id",
    TAG: "tag",
  },

  // The current state of the query.
  _state: null,

  // The query corresponding to last state computation.
  _lastStateCheckAt: null,

  /**
   * Computes the state of the query. State refers to whether the query
   * currently requires a class suggestion, or a tag, or an Id suggestion.
   * This getter will effectively compute the state by traversing the query
   * character by character each time the query changes.
   *
   * @example
   *        '#f' requires an Id suggestion, so the state is States.ID
   *        'div > .foo' requires class suggestion, so state is States.CLASS
   */
  state: function() {
    if (!this.searchBox || !this.searchBox.value) {
      return null;
    }

    var query = this.searchBox.value;
    if (this._lastStateCheckAt == query) {
      // If query is the same, return early.
      return this._state;
    }
    this._lastStateCheckAt = query;

    this._state = null;
    var subQuery = "",
        queryLen = query.length,
        tempArray, secondLastChar, lastChar;
    // Now we iterate over the query and decide the state character by character.
    // The logic here is that while iterating, the state can go from one to
    // another with some restrictions. Like, if the state is Class, then it can
    // never go to Tag state without a space or '>' character; Or like, a Class
    // state with only '.' cannot go to an Id state without any [a-zA-Z] after
    // the '.' which means that '.#' is a selector matching a class name '#'.
    // Similarily for '#.' which means a selctor matching an id '.'.
    for (var i = 1; i <= queryLen; i++) {
      // Calculate the state.
      subQuery = query.slice(0, i);
      tempArray = subQuery.slice(-2);
      secondLastChar = tempArray[0];
      lastChar = tempArray[1];
      switch (this._state) {
        case null:
          // This will happen only in the first iteration of the for loop.
          lastChar = secondLastChar;
        case this.States.TAG:
          this._state = lastChar == "."
            ? this.States.CLASS
            : lastChar == "#"
              ? this.States.ID
              : this.States.TAG;
          break;

        case this.States.CLASS:
          if (subQuery.match(/[\.]+[^\.]*$/)[0].length > 2) {
            // Checks whether the subQuery has atleast one [a-zA-Z] after the '.'.
            this._state = (lastChar == " " || lastChar == ">")
            ? this.States.TAG
            : lastChar == "#"
              ? this.States.ID
              : this.States.CLASS;
          }
          break;

        case this.States.ID:
          if (subQuery.match(/[#]+[^#]*$/)[0].length > 2) {
            // Checks whether the subQuery has atleast one [a-zA-Z] after the '#'.
            this._state = (lastChar == " " || lastChar == ">")
            ? this.States.TAG
            : lastChar == "."
              ? this.States.CLASS
              : this.States.ID;
          }
          break;
      }
    }
    return this._state;
  },

  /**
   * Removes event listeners and cleans up references.
   */
  destroy: function SelectorSearch_destroy() {
    // event listeners.
    this.searchBox.removeEventListener("keypress", this._onSearchKeypress, true);
    this.searchBox.removeEventListener("input", this._onHTMLSearch, true);
    this.searchPopup.destroy();
    this.searchPopup = null;
    this.searchBox = null;
    this.doc = null;
    this.panelDoc = null;
    this._searchResults = null;
    this._searchSuggestions = null;
    this.callback = null;
  },

  /**
   * The command callback for the input box. This function is automatically
   * invoked as the user is typing if the input box type is search.
   */
  _onHTMLSearch: function SelectorSearch__onHTMLSearch() {
    var query = this.searchBox.value;
    if (query == this._lastSearched) {
      return;
    }
    this._lastSearched = query;
    this._searchIndex = 0;

    if (query.length == 0) {
      this._lastValidSearch = "";
      this.searchBox.removeAttribute("filled");
      this.searchBox.classList.remove("devtools-no-search-result");
      if (this.searchPopup.isOpen()) {
        this.searchPopup.hidePopup();
      }
      return;
    }

    this.searchBox.setAttribute("filled", true);
    try {
      this._searchResults = this.doc.querySelectorAll(query);
    }
    catch (ex) {
      this._searchResults = [];
    }
    if (this._searchResults.length > 0) {
      this._lastValidSearch = query;
      // Even though the selector matched atleast one node, there is still
      // possibility of suggestions.
      if (query.match(/[\s>+]$/)) {
        // If the query has a space or '>' at the end, create a selector to match
        // the children of the selector inside the search box by adding a '*'.
        this._lastValidSearch += "*";
      }
      else if (query.match(/[\s>+][\.#a-zA-Z][\.#>\s+]*$/)) {
        // If the query is a partial descendant selector which does not matches
        // any node, remove the last incomplete part and add a '*' to match
        // everything. For ex, convert 'foo > b' to 'foo > *' .
        var lastPart = query.match(/[\s>+][\.#a-zA-Z][^>\s+]*$/)[0];
        this._lastValidSearch = query.slice(0, -1 * lastPart.length + 1) + "*";
      }

      if (!query.slice(-1).match(/[\.#\s>+]/)) {
        // Hide the popup if we have some matching nodes and the query is not
        // ending with [.# >] which means that the selector is not at the
        // beginning of a new class, tag or id.
        if (this.searchPopup.isOpen()) {
          this.searchPopup.hidePopup();
        }
      }
      else {
        this.showSuggestions();
      }
      this.searchBox.classList.remove("devtools-no-search-result");
      this.callback(this._searchResults[0]);
    }
    else {
      if (query.match(/[\s>+]$/)) {
        this._lastValidSearch = query + "*";
      }
      else if (query.match(/[\s>+][\.#a-zA-Z][\.#>\s+]*$/)) {
        var lastPart = query.match(/[\s+>][\.#a-zA-Z][^>\s+]*$/)[0];
        this._lastValidSearch = query.slice(0, -1 * lastPart.length + 1) + "*";
      }
      this.searchBox.classList.add("devtools-no-search-result");
      this.showSuggestions();
    }
  },

  /**
   * Handles keypresses inside the input box.
   */
  _onSearchKeypress: function SelectorSearch__onSearchKeypress(aEvent) {
    var query = this.searchBox.value;
    switch(aEvent.keyCode) {
      case aEvent.DOM_VK_ENTER:
      case aEvent.DOM_VK_RETURN:
        if (query == this._lastSearched) {
          this._searchIndex = (this._searchIndex + 1) % this._searchResults.length;
        }
        else {
          this._onHTMLSearch();
          return;
        }
        break;

      case aEvent.DOM_VK_UP:
        if (this.searchPopup.isOpen() && this.searchPopup.itemCount() > 0) {
          this.searchPopup.selectPreviousItem();
          this.searchPopup.focus();
          this.searchBox.value = this.searchPopup.getSelectedItem().label;
        }
        else if (--this._searchIndex < 0) {
          this._searchIndex = this._searchResults.length - 1;
        }
        break;

      case aEvent.DOM_VK_DOWN:
        if (this.searchPopup.isOpen() && this.searchPopup.itemCount() > 0) {
          this.searchPopup.selectedIndex = 0;
          this.searchPopup.focus();
          this.searchBox.value = this.searchPopup.getSelectedItem().label;
        }
        this._searchIndex = (this._searchIndex + 1) % this._searchResults.length;
        break;

      case aEvent.DOM_VK_TAB:
        if (this.searchPopup.isOpen() &&
            this.searchPopup.getItemAtIndex(this.searchPopup.itemCount() - 1)
                .preLabel == query) {
          this.searchBox.value = this.searchPopup.getSelectedItem().label;
          this._onHTMLSearch();
        }
        break;

      case aEvent.DOM_VK_BACK_SPACE:
      case aEvent.DOM_VK_DELETE:
        // need to throw away the lastValidSearch.
        this._lastToLastValidSearch = null;
        // This gets the most complete selector from the query. For ex.
        // '.foo.ba' returns '.foo' , '#foo > .bar.baz' returns '#foo > .bar'
        // '.foo +bar' returns '.foo +' and likewise.
        this._lastValidSearch = (query.match(/(.*)[\.#][^\.# ]{0,}$/) ||
                                 query.match(/(.*[\s>+])[a-zA-Z][^\.# ]{0,}$/) ||
                                 ["",""])[1];
        return;

      default:
        return;
    }

    aEvent.preventDefault();
    aEvent.stopPropagation();
    if (this._searchResults.length > 0) {
      this.callback(this._searchResults[this._searchIndex]);
    }
  },

  /**
   * Handles keypress and mouse click on the suggestions richlistbox.
   */
  _onListBoxKeypress: function SelectorSearch__onListBoxKeypress(aEvent) {
    switch(aEvent.keyCode || aEvent.button) {
      case aEvent.DOM_VK_ENTER:
      case aEvent.DOM_VK_RETURN:
      case aEvent.DOM_VK_TAB:
      case 0: // left mouse button
        aEvent.stopPropagation();
        aEvent.preventDefault();
        this.searchBox.value = this.searchPopup.getSelectedItem().label;
        this.searchBox.focus();
        this._onHTMLSearch();
        break;

      case aEvent.DOM_VK_UP:
        if (this.searchPopup.selectedIndex == 0) {
          this.searchPopup.selectedIndex = -1;
          aEvent.stopPropagation();
          aEvent.preventDefault();
          this.searchBox.focus();
        }
        else {
          var index = this.searchPopup.selectedIndex;
          this.searchBox.value = this.searchPopup.getItemAtIndex(index - 1).label;
        }
        break;

      case aEvent.DOM_VK_DOWN:
        if (this.searchPopup.selectedIndex == this.searchPopup.itemCount() - 1) {
          this.searchPopup.selectedIndex = -1;
          aEvent.stopPropagation();
          aEvent.preventDefault();
          this.searchBox.focus();
        }
        else {
          var index = this.searchPopup.selectedIndex;
          this.searchBox.value = this.searchPopup.getItemAtIndex(index + 1).label;
        }
        break;

      case aEvent.DOM_VK_BACK_SPACE:
        aEvent.stopPropagation();
        aEvent.preventDefault();
        this.searchBox.focus();
        if (this.searchBox.selectionStart > 0) {
          this.searchBox.value =
            this.searchBox.value.substring(0, this.searchBox.selectionStart - 1);
        }
        this._lastToLastValidSearch = null;
        var query = this.searchBox.value;
        this._lastValidSearch = (query.match(/(.*)[\.#][^\.# ]{0,}$/) ||
                                 query.match(/(.*[\s>+])[a-zA-Z][^\.# ]{0,}$/) ||
                                 ["",""])[1];
        this._onHTMLSearch();
        break;
    }
  },

  
  /**
   * Populates the suggestions list and show the suggestion popup.
   */
  _showPopup: function SelectorSearch__showPopup(aList, aFirstPart) {
    // Sort alphabetically in increaseing order.
    aList = aList.sort();
    // Sort based on count= in decreasing order.
    aList = aList.sort(function(a, b) {
      return a[1] < b[1];
    });

    var total = 0;
    var query = this.searchBox.value;
    var toLowerCase = false;
    var items = [];
    // In case of tagNames, change the case to small.
    if (query.match(/.*[\.#][^\.#]{0,}$/) == null) {
      toLowerCase = true;
    }
    var value, len = aList.length;
    for (var i = 0; i < len; i++) {
      value = aList[i][0];
      // for cases like 'div ' or 'div >' or 'div+'
      if (query.match(/[\s>+]$/)) {
        value = query + value;
      }
      // for cases like 'div #a' or 'div .a' or 'div > d' and likewise
      else if (query.match(/[\s>+][\.#a-zA-Z][^\s>+\.#]*$/)) {
        var lastPart = query.match(/[\s>+][\.#a-zA-Z][^>\s+\.#]*$/)[0];
        value = query.slice(0, -1 * lastPart.length + 1) + value;
      }
      // for cases like 'div.class' or '#foo.bar' and likewise
      else if (query.match(/[a-zA-Z][#\.][^#\.\s+>]*$/)) {
        var lastPart = query.match(/[a-zA-Z][#\.][^#\.\s>+]*$/)[0];
        value = query.slice(0, -1 * lastPart.length + 1) + value;
      }
      var item = {
        preLabel: query,
        label: value,
        count: aList[i][1]
      };
      if (toLowerCase) {
        item.label = value.toLowerCase();
      }
      items.unshift(item);
      if (++total > MAX_SUGGESTIONS - 1) {
        break;
      }
    }
    if (total > 0) {
      this.searchPopup.setItems(items);
      var style = this.searchBox.getBoundingClientRect();
      this.searchPopup.openPopup(style.left, style.top);
    }
    else {
      this.searchPopup.hidePopup();
    }
  },

  /**
   * Suggests classes,ids and tags based on the user input as user types in the
   * searchbox.
   */
  showSuggestions: function SelectorSearch_showSuggestions() {
    var query = this.searchBox.value;
    if (this._lastValidSearch != "" &&
        this._lastToLastValidSearch != this._lastValidSearch) {
      this._searchSuggestions = {
        ids: {},
        classes: {},
        tags: {}
      };

      var nodes = [], node, len, className, len2;
      try {
        nodes = this.doc.querySelectorAll(this._lastValidSearch);
      } catch (ex) {}
      len = nodes.length;
      for (var i = 0; i < len; i++) {
        node = nodes[i];
        len2 = node.classList.length;
        this._searchSuggestions.ids[node.id] = 1;
        this._searchSuggestions.tags[node.tagName] = (this._searchSuggestions.tags[node.tagName] || 0) + 1;
        for (var j = 0; j < len2; j++) {
          className = node.classList[j];
          this._searchSuggestions.classes[className] = (this._searchSuggestions.classes[className] || 0) + 1;
        }
      }
      this._lastToLastValidSearch = this._lastValidSearch;
    }
    else if (this._lastToLastValidSearch != this._lastValidSearch) {
      this._searchSuggestions = {
        ids: {},
        classes: {},
        tags: {}
      };

      if (query.length == 0) {
        return;
      }

      var nodes = null, node, className, len, len2, i, j;
      if (this.state() == this.States.CLASS) {
        nodes = this.doc.querySelectorAll("[class]");
        len = nodes.length;
        len2 = node.classList.length;
        for (i = 0; i < len; i++) {
          node = nodes[i];
          for (j = 0; j < len2; j++) {
            className = node.classList[j];
            this._searchSuggestions.classes[className] = (this._searchSuggestions.classes[className] || 0) + 1;
          }
        }
      }
      else if (this.state() == this.States.ID) {
        nodes = this.doc.querySelectorAll("[id]");
        len = nodes.length;
        for (i = 0; i < len; i++) {
          node = nodes[i];
          this._searchSuggestions.ids[node.id] = 1;
        }
      }
      else if (this.state() == this.States.TAG) {
        nodes = this.doc.getElementsByTagName("*");
        len = nodes.length;
        for (i = 0; i < len; i++) {
          node = nodes[i];
          this._searchSuggestions.tags[node.tagName] = (this._searchSuggestions.tags[node.tagName] || 0) + 1;
        }
      }
      else {
        return;
      }
      this._lastToLastValidSearch = this._lastValidSearch;
    }

    // Filter the suggestions based on search box value.
    var result = [],
        firstPart = "";
    if (this.state() == this.States.TAG) {
      // gets the tag that is being completed. For ex. 'div.foo > s' returns 's',
      // 'di' returns 'di' and likewise.
      firstPart = (query.match(/[\s>+]?([a-zA-Z]*)$/) || ["",query])[1];
      for (var tag in this._searchSuggestions.tags) {
        if (tag.toLowerCase().indexOf(firstPart.toLowerCase()) == 0) {
          result.push([tag, this._searchSuggestions.tags[tag]]);
        }
      }
    }
    else if (this.state() == this.States.CLASS) {
      // gets the class that is being completed. For ex. '.foo.b' returns 'b'
      firstPart = query.match(/\.([^\.]*)$/)[1];
      for (var className in this._searchSuggestions.classes) {
        if (className.indexOf(firstPart) == 0) {
          result.push(["." + className, this._searchSuggestions.classes[className]]);
        }
      }
      firstPart = "." + firstPart;
    }
    else if (this.state() == this.States.ID) {
      // gets the id that is being completed. For ex. '.foo#b' returns 'b'
      firstPart = query.match(/#([^#]*)$/)[1];
      for (var id in this._searchSuggestions.ids) {
        if (id.indexOf(firstPart) == 0) {
          result.push(["#" + id, 1]);
        }
      }
      firstPart = "#" + firstPart;
    }

    this._showPopup(result, firstPart);
  },
};

exports.search = SelectorSearch;
return exports;
}));
