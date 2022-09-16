'use strict';

const STORE_FORMAT_VERSION = chrome.runtime.getManifest().version;

let alternativeUrlIndexOffset = 0; // Number of elements stored in the alternativeUrl Key. Used to map highlight indices to correct key

function store(selection, container, url, href, color, textColor, callback) {
  /* eslint-disable-line no-redeclare, no-unused-vars */
  console.log('store ', selection, container, url, href, color, textColor);
  chrome.storage.local.get({ highlights: {} }, (result) => {
    const highlights = result.highlights;

    if (!highlights[url]) highlights[url] = [];

    const count = highlights[url].push({
      version: STORE_FORMAT_VERSION,
      string: selection.toString(),
      container: getQuery(container),
      anchorNode: getQuery(selection.anchorNode),
      anchorOffset: selection.anchorOffset,
      focusNode: getQuery(selection.focusNode),
      focusOffset: selection.focusOffset,
      color,
      textColor,
      href,
      uuid: crypto.randomUUID(),
      createdAt: Date.now(),
      tag: '',
    });
    chrome.storage.local.set({ highlights });

    if (callback) callback(count - 1 + alternativeUrlIndexOffset);
  });
}
function getHighlight(url, index, callback = () => {}) {
  /* eslint-disable-line no-redeclare, no-unused-vars */
  if (!chrome || !chrome.storage) {
    return { tag: '' };
  }
  chrome.storage.local.get({ highlights: {} }, (result) => {
    const highlights = result.highlights;
    let indexToUse = index - alternativeUrlIndexOffset;
    if (!highlights[url]) highlights[url] = [];
    // console.log('highlights[url]', highlights[url], indexToUse);
    if (!highlights[url] || !highlights[url][indexToUse]) {
      console.log('getHighlight 1');
      return callback({ tag: '' });
    }
    const data = highlights[url][indexToUse];
    console.log('getHighlight data.tag', data.tag);
    callback(data);
  });
}

function updateTag(url, index, tag, callback = () => {}) {
  /* eslint-disable-line no-redeclare, no-unused-vars */
  chrome.storage.local.get({ highlights: {} }, (result) => {
    const highlights = result.highlights;
    let indexToUse = index - alternativeUrlIndexOffset;
    if (!highlights[url]) highlights[url] = [];
    if (!highlights[url] || !highlights[url][indexToUse]) {
      return;
    }
    highlights[url][indexToUse].tag = tag;
    chrome.storage.local.set({ highlights });
    callback();
  });
}

function update(
  highlightIndex,
  url,
  alternativeUrl,
  newColor,
  newTextColor,
  tag,
  isDelete
) {
  /* eslint-disable-line no-redeclare, no-unused-vars */
  chrome.storage.local.get({ highlights: {} }, (result) => {
    console.log('result', result);
    const highlights = result.highlights;

    let urlToUse = url;
    let indexToUse = highlightIndex - alternativeUrlIndexOffset;
    if (highlightIndex < alternativeUrlIndexOffset) {
      urlToUse = alternativeUrl;
      indexToUse = highlightIndex;
    }

    const highlightsInKey = highlights[urlToUse];
    if (highlightsInKey) {
      const highlight = highlightsInKey[indexToUse];
      if (highlight) {
        highlight.color = newColor;
        highlight.textColor = newTextColor;
        highlight.updatedAt = Date.now();
        highlight.tag = tag;
        if (isDelete) {
          highlight.isDelete = true;
        }
        chrome.storage.local.set({ highlights });
      }
    }
  });
}

// alternativeUrl is optional
function loadAll(url, alternativeUrl) {
  /* eslint-disable-line no-redeclare, no-unused-vars */
  chrome.storage.local.get({ highlights: {} }, (result) => {
    let highlights = [];

    // Because of a bug in an older version of the code, some highlights were stored
    // using a key that didn't correspond to the full page URL. To fix this, if the
    // alternativeUrl exists, try to load highlights from there as well
    if (alternativeUrl) {
      highlights = highlights.concat(result.highlights[alternativeUrl] || []);
    }
    alternativeUrlIndexOffset = highlights.length;

    highlights = highlights.concat(result.highlights[url] || []);

    if (!highlights) return;

    for (let i = 0; i < highlights.length; i++) {
      load(highlights[i], i);
    }
  });
}

// noErrorTracking is optional
function load(highlightVal, highlightIndex, noErrorTracking) {
  /* eslint-disable-line no-redeclare */
  const selection = {
    anchorNode: elementFromQuery(highlightVal.anchorNode),
    anchorOffset: highlightVal.anchorOffset,
    focusNode: elementFromQuery(highlightVal.focusNode),
    focusOffset: highlightVal.focusOffset,
  };

  const { color, string: selectionString, textColor, version } = highlightVal;
  const container = elementFromQuery(highlightVal.container);

  if (!selection.anchorNode || !selection.focusNode || !container) {
    if (!noErrorTracking) {
      addHighlightError(highlightVal, highlightIndex);
    }
    return false;
  }

  const success = highlight(
    selectionString,
    container,
    selection,
    color,
    textColor,
    highlightIndex,
    version
  );

  if (!noErrorTracking && !success) {
    addHighlightError(highlightVal, highlightIndex);
  }
  return success;
}

function removeHighlight(highlightIndex, url, alternativeUrl) {
  /* eslint-disable-line no-redeclare, no-unused-vars */
  chrome.storage.local.get({ highlights: {} }, (result) => {
    const highlights = result.highlights;
    if (highlightIndex < alternativeUrlIndexOffset) {
      highlights[alternativeUrl].splice(highlightIndex, 1);
    } else {
      highlights[url].splice(highlightIndex - alternativeUrlIndexOffset, 1);
    }
    chrome.storage.local.set({ highlights });
  });
}

// alternativeUrl is optional
function clearPage(url, alternativeUrl) {
  /* eslint-disable-line no-redeclare, no-unused-vars */
  chrome.storage.local.get({ highlights: {} }, (result) => {
    const highlights = result.highlights;
    delete highlights[url];

    if (alternativeUrl) {
      // See 'loadAll()' for an explaination of why this is necessary
      delete highlights[alternativeUrl];
    }

    chrome.storage.local.set({ highlights });
  });
}

function elementFromQuery(storedQuery) {
  const re = />textNode:nth-of-type\(([0-9]+)\)$/iu;
  const result = re.exec(storedQuery);

  if (result) {
    // For text nodes, nth-of-type needs to be handled differently (not a valid CSS selector)
    const textNodeIndex = parseInt(result[1], 10);
    storedQuery = storedQuery.replace(re, '');
    const parent = robustQuerySelector(storedQuery);

    if (!parent) return undefined;

    return parent.childNodes[textNodeIndex];
  }

  return robustQuerySelector(storedQuery);
}

function robustQuerySelector(query) {
  try {
    return document.querySelector(query);
  } catch (error) {
    // It is possible that this query fails because of an invalid CSS selector that actually exists in the DOM.
    // This was happening for example here: https://lawphil.net/judjuris/juri2013/sep2013/gr_179987_2013.html
    // where there is a tag <p"> that is invalid in HTML5 but was still rendered by the browser
    // In this case, manually find the element:
    let element = document;
    for (const queryPart of query.split('>')) {
      if (!element) return null;

      const re = /^(.*):nth-of-type\(([0-9]+)\)$/iu;
      const result = re.exec(queryPart);
      const [, tagName, index] = result || [undefined, queryPart, 1];
      element = Array.from(element.childNodes).filter(
        (child) => child.localName === tagName
      )[index - 1];
    }
    return element;
  }
}

// From an DOM element, get a query to that DOM element
function getQuery(element) {
  if (element.id) return `#${escapeCSSString(element.id)}`;
  if (element.localName === 'html') return 'html';

  const parent = element.parentNode;

  const parentSelector = getQuery(parent);
  // The element is a text node
  if (!element.localName) {
    // Find the index of the text node:
    const index = Array.prototype.indexOf.call(parent.childNodes, element);
    return `${parentSelector}>textNode:nth-of-type(${index})`;
  } else {
    const index =
      Array.from(parent.childNodes)
        .filter((child) => child.localName === element.localName)
        .indexOf(element) + 1;
    return `${parentSelector}>${element.localName}:nth-of-type(${index})`;
  }
}

// Colons and spaces are accepted in IDs in HTML but not in CSS syntax
// Similar (but much more simplified) to the CSS.escape() working draft
function escapeCSSString(cssString) {
  return cssString.replace(/(:)/gu, '\\$1');
}
