import { OSCMessage, OSCArgument } from "../osc/types";

export const convertIntsToPitchOctave = (pitch: number, octave: number): string => {
  const pitchMap: { [key: number]: string } = {
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

// This function transforms a string like "1 10 20 30" into an OSCMessage-like structure.
// The actual OSCMessage structure has args as OSCArgument[], e.g. [{type: 'i', value: 10}, ...]
// This simplified version is used by the sequencer and then likely transformed again before sending.
interface SimplifiedOSCMessage {
  address: string;
  args: (string | number)[]; // Simplified: can be number or string before full OSC formatting
}

export const messageStringToMessage = (messageString: string): SimplifiedOSCMessage => {
  const messageArray = messageString.trim().split(" ");
  if (messageArray.length === 0 || !messageArray[0]) {
    console.error("Invalid message string:", messageString);
    return { address: "/error", args: ["invalid_message_string"] };
  }

  const address = `/${messageArray[0]}`;
  // Attempt to convert args to numbers, but keep as string if NaN
  // This is a simplified representation; actual OSC messages need typed args.
  const args = messageArray.slice(1).map((argStr: string) => {
    const num = Number(argStr);
    return isNaN(num) ? argStr : num;
  });

  return {
    address: address,
    args: args,
  };
};
