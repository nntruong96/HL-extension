import {
  getFromBackgroundPage,
  getHighlights,
  DefaultFilter,
} from './utils.js';
import { getCurrentTab } from '../background/utils.js';
import { open as openRemoveAllModal } from './remove-all-modal.js';
import { open as openChangeColorModal } from './change-color-modal.js';
const highlightButton = document.getElementById('toggle-button');
const removeAllButton = document.getElementById('remove-all-button');
const copyAllButton = document.getElementById('copy-all-button');
const closeButton = document.getElementById('close-button');
const changeColorButton = document.getElementById('change-color-button');
const colorsListElement = document.getElementById('colors-list');
const selectedColorElement = document.getElementById('selected-color');
const shortcutLinkElement = document.getElementById('shortcut-link');
const shortcutLinkTextElement = document.getElementById('shortcut-link-text');
const highlightsListElement = document.getElementById('highlights-list');
const highlightsLostListElement = document.getElementById(
  'highlights-lost-list'
);

const highlightsEmptyStateElement = document.getElementById(
  'highlights-list-empty-state'
);
const highlightsErrorStateElement = document.getElementById(
  'highlights-list-error-state'
);
const highlightsListLostTitleElement = document.getElementById(
  'highlights-list-lost-title'
);

const highlightsInputSearch = document.getElementById('input-search');
const highlightsFilterTag = document.getElementById('filter-tag');
const highlightsFilterDomain = document.getElementById('filter-domain');

highlightsFilterTag.addEventListener('change', filterTagChange);
highlightsFilterDomain.addEventListener('change', filterDomainChange);
highlightsInputSearch.addEventListener('keyup', onChangeInputSearch);
let filterTag = DefaultFilter.value,
  fillterDomain = DefaultFilter.value,
  filterText = '',
  highlightsData = {},
  timeout,
  currentDomain;
function filterTagChange(e) {
  filterTag = e.target.value;
  initListHighlight();
}
function filterDomainChange(e) {
  fillterDomain = e.target.value;
  filterTag = DefaultFilter.value;
  initTag();
  initListHighlight();
}
function onChangeInputSearch(e) {
  filterText = e.target.value;
  if (timeout) {
    clearTimeout(timeout);
  }
  timeout = setTimeout(() => {
    initListHighlight();
  }, 500);
}
function colorChanged(colorOption) {
  const { backgroundColor, borderColor } = colorOption.style;
  const { colorTitle } = colorOption.dataset;

  // Swap (in the UI) the previous selected color and the newly selected one
  const {
    backgroundColor: previousBackgroundColor,
    borderColor: previousBorderColor,
  } = selectedColorElement.style;
  const { colorTitle: previousColorTitle } = selectedColorElement.dataset;
  colorOption.style.backgroundColor = previousBackgroundColor;
  colorOption.style.borderColor = previousBorderColor;
  colorOption.dataset.colorTitle = previousColorTitle;
  selectedColorElement.style.backgroundColor = backgroundColor;
  selectedColorElement.style.borderColor = borderColor;
  selectedColorElement.dataset.colorTitle = colorTitle;

  // Change the global highlighter color
  chrome.runtime.sendMessage({
    action: 'change-color',
    color: colorTitle,
    source: 'popup',
  });
}

function toggleHighlighterCursor() {
  chrome.runtime.sendMessage({
    action: 'toggle-highlighter-cursor',
    source: 'popup',
  });
  window.close();
}

function copyHighlights() {
  chrome.runtime.sendMessage({
    action: 'track-event',
    trackCategory: 'highlight-action',
    trackAction: 'copy-all',
  });
  navigator.clipboard.writeText(highlightsListElement.innerText);

  // Let the user know the copy went through
  const checkmarkEl = document.createElement('span');
  checkmarkEl.style.color = '#00ff00';
  checkmarkEl.innerHTML = ' &#10004;'; // Checkmark character
  copyAllButton.prepend(checkmarkEl);
}

function showEmptyState() {
  if (!highlightsListElement.querySelectorAll('.highlight').length) {
    highlightsEmptyStateElement.style.display = 'flex';
  } else {
    highlightsEmptyStateElement.style.display = 'none';
  }
}

function orderHighlights() {
  highlightsListElement.querySelectorAll('.highlight').forEach((highlight) => {
    if (highlight.classList.contains('lost')) {
      // Move lost highlights to the end of the list
      highlight.remove();
      highlightsLostListElement.appendChild(highlight);
    }
  });
}

function showLostHighlightsTitle() {
  highlightsListLostTitleElement.remove();
  const lostHighlightElements =
    highlightsLostListElement.querySelectorAll('.lost');
  if (lostHighlightElements.length > 0) {
    highlightsListElement.insertBefore(
      highlightsListLostTitleElement,
      lostHighlightElements[0]
    );
  }
}

function updateHighlightsListState() {
  showEmptyState();
  orderHighlights();
  showLostHighlightsTitle();
}

function hideErrorState() {
  highlightsErrorStateElement.style.display = 'none';
}
hideErrorState(); // Hide by default

function showErrorState() {
  highlightsErrorStateElement.style.display = 'flex';
  highlightsEmptyStateElement.style.display = 'none'; // Also hide the empty state
}
function initOption(value, text) {
  const newEl = document.createElement('option');
  newEl.innerText = text;
  newEl.setAttribute('value', value);
  return newEl;
}
function initTag() {
  let tags = [];
  highlightsFilterTag.replaceChildren();
  highlightsFilterTag.appendChild(
    initOption(DefaultFilter.value, DefaultFilter.text)
  );
  for (let domain in highlightsData) {
    let data4Domain = highlightsData[domain];
    if (fillterDomain !== DefaultFilter.value && domain !== fillterDomain) {
      continue;
    }
    data4Domain.forEach((hl, index) => {
      if (hl.tag && !tags.includes(hl.tag) && !hl.isDelete) {
        tags.push(hl.tag);
        highlightsFilterTag.appendChild(initOption(hl.tag, hl.tag));
      }
    });
  }

  return tags;
}
function initDomains() {
  highlightsFilterDomain.appendChild(initOption(fillterDomain, fillterDomain));
  let domains = Object.keys(highlightsData);
  domains.forEach((domain) => {
    if (fillterDomain === domain) return;
    let hasItem = false;
    highlightsData[domain].forEach((item) =>
      !item.isDelete ? (hasItem = true) : ''
    );
    if (hasItem) {
      highlightsFilterDomain.appendChild(initOption(domain, domain));
    }
  });
  highlightsFilterDomain.appendChild(
    initOption(DefaultFilter.value, DefaultFilter.text)
  );
  return domains;
}
function filterWithDomain(data = []) {
  if (fillterDomain !== DefaultFilter.value) {
    data = highlightsData[fillterDomain]?.map(
      (item, index) =>
        ({
          ...item,
          domain: fillterDomain,
          index,
        } || [])
    );
  } else {
    for (let domain in highlightsData) {
      data = data.concat(
        highlightsData[domain]?.map(
          (item, index) =>
            ({
              ...item,
              domain,
              index,
            } || [])
        )
      );
    }
  }
  return data;
}
function filterWithTag(data = []) {
  data = data.filter((item) => {
    if (filterTag === DefaultFilter.value) {
      return true;
    }
    return item.tag === filterTag;
  });
  return data;
}
function filterWithText(data = []) {
  data = data.filter((item) => {
    if (filterText === '') {
      return true;
    }
    return item.string.toUpperCase().indexOf(filterText.toUpperCase()) >= 0;
  });
  return data;
}
async function initListHighlight(render = true) {
  //fillterDomain filterTag  filterText
  let data = [];
  data = filterWithDomain(data);
  data = filterWithTag(data);
  data = filterWithText(data);
  data = data.filter((item, index) => item.textColor !== 'inherit');
  if (render) {
    initHLElement(data);
  }
  return data;
}
function initHLElement(data = []) {
  let el = highlightsListElement.getElementsByClassName('highlight-exit');
  for (let i = el.length - 1; i >= 0; i--) {
    el[i].remove();
  }

  for (let i = 0; i < data.length; i++) {
    const newEl = document.createElement('div');
    newEl.classList.add('highlight', 'highlight-exit');
    newEl.innerText = data[i].string + (data[i].tag ? `(#${data[i].tag})` : '');
    const highlightId = data[i].index;
    if (data[i].domain === currentDomain) {
      newEl.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'show-highlight', highlightId });
      });

      const newDeleteIconEl = document.createElement('span');
      newDeleteIconEl.classList.add('material-icons', 'delete-icon');
      newDeleteIconEl.innerText = 'delete';
      newDeleteIconEl.onclick = (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage(
          { action: 'remove-highlight', highlightId, url: data[i].domain },
          () => {
            newEl.remove();
            updateHighlightsListState();
          }
        );
      };
      newEl.appendChild(newDeleteIconEl);
    } else {
      newEl.addEventListener('click', () => {
        chrome.tabs.create({ url: `https://${data[i].domain}` });
      });
      const newDeleteIconEl = document.createElement('span');
      newDeleteIconEl.classList.add('material-icons', 'delete-icon');
      newDeleteIconEl.innerText = 'arrow_outward';
      newEl.appendChild(newDeleteIconEl);
    }
    highlightsListElement.appendChild(newEl);
  }
  updateHighlightsListState();
}

(async function initializeHighlightsList() {
  let highlights = [],
    tab;
  try {
    highlights = await getHighlights();
    highlightsData = highlights;
    tab = await getCurrentTab();
  } catch (err) {
    console.log(err);
    showErrorState();
    return;
  }
  let currentUrl = new URL(tab.url);
  fillterDomain = currentUrl.hostname + currentUrl.pathname;
  currentDomain = currentUrl.hostname + currentUrl.pathname;
  initTag(highlights);
  initDomains(highlights);
  let data = await initListHighlight(false);
  if (data.length == 0) {
    updateHighlightsListState();
    return;
  }
  initHLElement(data);
  updateHighlightsListState();
})();

(async function initializeColorsList() {
  const color = await getFromBackgroundPage({ action: 'get-current-color' });
  const colorOptions = await getFromBackgroundPage({
    action: 'get-color-options',
  });

  colorOptions.forEach((colorOption) => {
    const colorTitle = colorOption.title;
    const selected = colorTitle === color.title;
    const colorOptionElement = selected
      ? selectedColorElement
      : document.createElement('div');

    colorOptionElement.classList.add('color');
    colorOptionElement.dataset.colorTitle = colorTitle;
    colorOptionElement.style.backgroundColor = colorOption.color;
    if (colorOption.textColor)
      colorOptionElement.style.borderColor = colorOption.textColor;

    if (!selected) {
      colorOptionElement.addEventListener('click', (e) =>
        colorChanged(e.target)
      );
      colorsListElement.appendChild(colorOptionElement);
    }
  });
})();

(async function initializeLostHighlights() {
  //   updateHighlightsListState();
  //   const lostHighlights = await getFromBackgroundPage({
  //     action: 'get-lost-highlights',
  //   });

  //   if (!Array.isArray(lostHighlights) || lostHighlights.length == 0) {
  //     return;
  //   }
  //   console.log('lostHighlights', lostHighlights);
  //   // Populate with new elements
  //   let el = highlightsLostListElement.getElementsByClassName('lost');
  //   for (let i = 0; i < el.length; i++) {
  //     el[i].remove();
  //   }
  //   lostHighlights.forEach((lostHighlight) => {
  //     if (!lostHighlight?.string) return;

  //     const newEl = document.createElement('div');
  //     newEl.classList.add('highlight', 'lost');
  //     newEl.innerText = lostHighlight.string;
  //   const newDeleteIconEl = document.createElement('span');
  //   newDeleteIconEl.classList.add('material-icons', 'delete-icon');
  //   newDeleteIconEl.innerText = 'delete';
  //   newDeleteIconEl.onclick = () => {
  //     chrome.runtime.sendMessage(
  //       { action: 'remove-highlight', highlightId: lostHighlight.index },
  //       () => {
  //         newEl.remove();
  //         updateHighlightsListState();
  //       }
  //     );
  //   };
  //   newEl.appendChild(newDeleteIconEl);
  //     highlightsLostListElement.appendChild(newEl);
  //   });

  updateHighlightsListState();
})();
// Retrieve the shortcut for the highlight command from the Chrome settings and display it
(async function initializeShortcutLinkText() {
  const commands = await chrome.commands.getAll();
  commands.forEach((command) => {
    if (command.name === 'execute-highlight') {
      if (command.shortcut) {
        shortcutLinkTextElement.textContent = command.shortcut;
      } else {
        shortcutLinkTextElement.textContent = '-';
      }
    }
  });
})();

// Register Events
highlightButton.addEventListener('click', toggleHighlighterCursor);
copyAllButton.addEventListener('click', copyHighlights);
removeAllButton.addEventListener('click', openRemoveAllModal);
changeColorButton.addEventListener('click', openChangeColorModal);
selectedColorElement.addEventListener('click', openChangeColorModal);

shortcutLinkElement.addEventListener('click', () => {
  // Open the shortcuts Chrome settings page in a new tab
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

closeButton.addEventListener('click', () => window.close());

// Register (in analytics) that the popup was opened
chrome.runtime.sendMessage({
  action: 'track-event',
  trackCategory: 'popup',
  trackAction: 'opened',
});
