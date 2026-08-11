import { Master, Waveform, Transport } from "tone";

const makeCanvas = () => {
  const div = document.getElementById("waveform");
  const canvas = document.createElement("canvas");
  div.appendChild(canvas);
  canvas.id = "waveform-canvas";
  canvas.width = div.offsetWidth;
  canvas.height = div.offsetHeight;
  return canvas;
};

const nearestPowerOf2 = (n) => {
  return 1 << (31 - Math.clz32(n));
};

export const startWaveformLoop = () => {
  const canvas = makeCanvas();
  const ctx = canvas.getContext("2d");
  const midpt = canvas.height / 2;
  const waveformWidth = nearestPowerOf2(canvas.width);
  const waveformPointInterval = canvas.width / waveformWidth; // maybe -1
  const waveform = new Waveform(waveformWidth);
  Master.connect(waveform);

  const repeat = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const waveData = waveform.getValue();
    var x = 0;
    ctx.beginPath();
    waveData.forEach((val, index) => {
      ctx.rect(x, midpt + val * midpt, 1, 1);
      x += waveformPointInterval;
    });
    ctx.stroke();
  };

  Transport.scheduleRepeat(repeat, "0.2");
};
