export const convertIntsToPitchOctave = (pitch, octave) => {
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
  return `${pitchMap[pitch]}${octave}`;
};