const updateMessageLog = (logMsg: string, log: string[], divName: string): void => {
  log.push(logMsg);
  if (log.length > 6) {
    log.shift();
  }
  const result = log.map((val: string) => `<p>${val}</p>`).join("");
  const logDiv = document.getElementById(divName) as HTMLDivElement | null;
  if (logDiv) {
    logDiv.innerHTML = result;
  } else {
    console.error(`Log div with ID '${divName}' not found.`);
  }
};

const inputMessageLog: string[] = [];

export const updateInputMessageLog = (logMsg: string): void => {
  updateMessageLog(logMsg, inputMessageLog, "input-message-log");
};

const outputMessageLog: string[] = [];

export const updateOutputMessageLog = (logMsg: string): void => {
  updateMessageLog(logMsg, outputMessageLog, "output-message-log");
};
