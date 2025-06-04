"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageStringToMessage = exports.convertIntsToPitchOctave = void 0;
const convertIntsToPitchOctave = (pitch, octave) => {
    const pitchMap = {
        1: "C",
        2: "C#",
        3: "D",
        4: "D#",
        5: "E",
        6: "F",
        7: "F#",
        8: "G",
        9: "G#",
        10: "A",
        11: "A#",
        12: "B",
    };
    if (pitch < 1 || pitch > 12) {
        console.error(`Invalid pitch value: ${pitch}. Defaulting to C.`);
        return `C${octave}`;
    }
    return `${pitchMap[pitch]}${octave}`;
};
exports.convertIntsToPitchOctave = convertIntsToPitchOctave;
const messageStringToMessage = (messageString) => {
    const messageArray = messageString.trim().split(" ");
    if (messageArray.length === 0 || !messageArray[0]) {
        console.error("Invalid message string:", messageString);
        return { address: "/error", args: ["invalid_message_string"] };
    }
    const address = `/${messageArray[0]}`;
    // Attempt to convert args to numbers, but keep as string if NaN
    // This is a simplified representation; actual OSC messages need typed args.
    const args = messageArray.slice(1).map((argStr) => {
        const num = Number(argStr);
        return isNaN(num) ? argStr : num;
    });
    return {
        address: address,
        args: args,
    };
};
exports.messageStringToMessage = messageStringToMessage;
//# sourceMappingURL=utils.js.map