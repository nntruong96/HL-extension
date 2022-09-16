// Converts the chrome runtime call into a promise to more easily fetch the results
function getFromBackgroundPage(payload, ignoreErrors = true) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      const error = chrome.runtime.lastError;
      if (!ignoreErrors && error) {
        reject(error);
        return;
      }

      if (!ignoreErrors && response.success === false) {
        reject(response.error);
        return;
      }

      resolve(response.response);
    });
  });
}

function getHighlights() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get({ highlights: {} }, (result) => {
      const highlights = result.highlights;
      resolve(highlights);
    });
  });
}

// Convert a hex string (with 6 hex digits) to a rgb string
function hexToRgb(hex) {
  if (!hex) return null;

  const [r, g, b] = hex
    .substring(1)
    .match(/.{2}/gu)
    .map((x) => parseInt(x, 16));
  return `rgb(${r}, ${g}, ${b})`;
}

// Convert a rgb string to a hex string
function rgbToHex(rgb) {
  if (!rgb) return null;

  return rgb.replace(
    /^rgb\((\d{1,3}), ?(\d{1,3}), ?(\d{1,3})\)$/gu,
    (m, r, g, b) => {
      const values = [r, g, b].map((x) =>
        parseInt(x, 10).toString(16).padStart(2, '0')
      );
      return `#${values.join('')}`;
    }
  );
}
const DefaultFilter = { value: 'All-67df8h49fn47rnry3hka732', text: 'All' };
export {
  getFromBackgroundPage,
  hexToRgb,
  rgbToHex,
  getHighlights,
  DefaultFilter,
};
