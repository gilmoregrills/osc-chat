"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOutputMessageLog = exports.updateInputMessageLog = void 0;
const updateMessageLog = (logMsg, log, divName) => {
    log.push(logMsg);
    if (log.length > 6) {
        log.shift();
    }
    const result = log.map((val) => `<p>${val}</p>`).join("");
    const logDiv = document.getElementById(divName);
    if (logDiv) {
        logDiv.innerHTML = result;
    }
    else {
        console.error(`Log div with ID '${divName}' not found.`);
    }
};
const inputMessageLog = [];
const updateInputMessageLog = (logMsg) => {
    updateMessageLog(logMsg, inputMessageLog, "input-message-log");
};
exports.updateInputMessageLog = updateInputMessageLog;
const outputMessageLog = [];
const updateOutputMessageLog = (logMsg) => {
    updateMessageLog(logMsg, outputMessageLog, "output-message-log");
};
exports.updateOutputMessageLog = updateOutputMessageLog;
//# sourceMappingURL=logging.js.map