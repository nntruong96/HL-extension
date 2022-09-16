"use strict";

(() => {
    function loadAllHighlightsOnPage() {
        // It happens frequently that we get here before all content scripts have been loaded.
        // This is because of the background script event 'tab.onUpdated' that is fired when
        // the user navigates to a different document. In this scenario, this content script
        // is executed before the content scripts from the manifest file have been loaded.
        // Furthermore, the 'DOMContentLoaded' event is fired before the content scripts are loaded.
        // This is not an issue because this content script is also loaded by default on every
        // page through the manifest configuration.
        if (typeof loadAll === "function") {
            loadAll(window.location.hostname + window.location.pathname, window.location.pathname);
        }
    }

    if (document.readyState === 'loading') {
        document.removeEventListener('DOMContentLoaded', loadAllHighlightsOnPage); // Prevent duplicates
        document.addEventListener('DOMContentLoaded', loadAllHighlightsOnPage);
    } else {
        // Run immediately if the page is already loaded
        loadAllHighlightsOnPage();
    }
})();
