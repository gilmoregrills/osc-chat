import {
  MembraneSynth,
  MetalSynth,
  NoiseSynth,
  PluckSynth,
  Synth,
  Oscillator,
  AmplitudeEnvelope,
  Time,
  Transport,
  Reverb,
  FeedbackDelay,
  Distortion,
  Chorus,
  Frequency,
  getDestination,
} from "tone";
import { convertIntsToPitchOctave } from "./utils";
import { updateInputMessageLog, updateOutputMessageLog } from "./logging";

class Channel {
  constructor(address) {
    this.address = address;
    this.channelType = "generic";
    this.volume = 0;
    this.lastMessageDescription = "awaiting input";
    this.effectsChain = [];
  }

  setVolume(vol) {
    this.volume = -vol;
  }

  generateInnerHTML() {
    console.log;
    return `
      <h2>channel:${this.address}</h2>
      <p>type:${this.channelType}</p>
      <p id="last_msg_desc_${this.address}"><span class="bouncy">${this.lastMessageDescription}</span></p>
    `;
  }

  render() {
    const channelDiv = document.getElementById(`channel_${this.address}`);
    channelDiv.innerHTML = this.generateInnerHTML();
  }

  renderEffectsChainAsHTML() {
    return this.effectsChain
      .map(
        (effect) => `<p><span class="bouncy">${effect.effectName}</span></p>`,
      )
      .join("");
  }

  initialise() {
    const div = document.createElement("div");
    div.id = `channel_${this.address}`;
    div.class = "channel";
    div.innerHTML = this.generateInnerHTML();
    document.getElementById("channel-container").appendChild(div);
  }

  updateLastMessageDescription(oscMsg) {
    this.lastMessageDescription = `received: [${oscMsg.args[1]}] from: ${oscMsg.args[0]}`;
  }

  handle(oscMsg) {
    console.log(
      `This is channel: ${this.address} handling the message: ${JSON.stringify(oscMsg)}`,
    );
    this.updateLastMessageDescription(oscMsg, note, duration);
    this.render();
  }
}

class InstrumentChannel extends Channel {
  constructor(address, voice, voiceName) {
    super(address);
    this.voice = voice;
    this.voiceName = voiceName;
    this.channelType = "instrument";
    this.lastMessageDescription = "awaiting input";
  }

  setVoice(arg) {
    const [voiceName, voice] = this.mapArgToVoice(arg);
    this.voiceName = voiceName;
    this.voice = voice;
  }

  mapArgToVoice(arg) {
    switch (arg) {
      case 1:
        return ["osc synth", Synth];
      case 2:
        return ["membrane synth", MembraneSynth];
      case 3:
        return ["'metal' synth", MetalSynth];
      case 4:
        return ["noise synth", NoiseSynth];
      case 5:
        return ["pluck synth", PluckSynth];
      default:
        return ["osc synth", Synth];
    }
  }

  generateInnerHTML() {
    return `
      <h2>channel:${this.address}</h2>
      <p>type:${this.channelType}</p>
      <h3>opt_group(0): effects</h3>
      ${this.renderEffectsChainAsHTML()}
      <h3>opt_group(1): vol</h3>
      <p id="vol_${this.address}">volume: <span class="bouncy">${this.volume}dB</span></p>
      <h3>opt_group(2): voice</h3>
      <p id="voice_${this.address}">voice: <span class="bouncy">${this.voiceName}</span></p>
      <p id="last_msg_desc_${this.address}"><span class="bouncy">${this.lastMessageDescription}</span></p>
    `;
  }

  updateLastMessageDescription(oscMsg, note, duration) {
    const messageString = `${oscMsg.args[0]} played: ${note} for: ${duration} on ${this.address}`;
    this.lastMessageDescription = messageString;
    updateOutputMessageLog(messageString);
  }

  handle(oscMsg) {
    console.log(
      `This is channel: ${this.address} handling the message: ${JSON.stringify(oscMsg)}`,
    );
    const note = convertIntsToPitchOctave(oscMsg.args[1][0], oscMsg.args[1][1]);
    const duration = Time(oscMsg.args[1][2] / 10).toNotation();

    const oscSynth = new this.voice({ volume: this.volume });

    const effects = this.effectsChain.map((effect) => effect.getEffect());

    oscSynth.chain(...effects, getDestination());

    const noteDuration = Time(duration).quantize("8n");
    oscSynth.triggerAttackRelease(note, noteDuration);

    const releaseTime = Time(oscSynth.envelope.release).toSeconds();
    setTimeout(
      () => oscSynth.dispose(),
      (noteDuration + releaseTime + 0.5) * 1000,
    );

    this.updateLastMessageDescription(oscMsg, note, duration);
    this.render();
  }
}

class SynthChannel extends Channel {
  constructor(address, waveform) {
    super(address);
    this.waveform = waveform;
    this.channelType = "synth";
    (this.amplitudeEnvelopeArgs = {
      attack: 0.1,
      decay: 0.2,
      sustain: 0.5,
      release: 1,
    }),
      (this.lastMessageDescription = "awaiting input");
  }

  setAmplitudeEnvelope(attack, decay, sustain, release) {
    this.amplitudeEnvelopeArgs = {
      attack: attack / 10,
      decay: decay / 10,
      sustain: sustain / 10,
      release: release / 10,
    };
  }

  setWaveformAndPartial(wave, partial) {
    this.waveform = this.mapArgsToWaveform(wave, partial);
  }

  mapArgsToWaveform(wave, partial) {
    partial = partial === 0 || partial === undefined ? "" : `${partial}`;
    switch (wave) {
      case 1:
        return `sine${partial}`;
        break;
      case 2:
        return `square${partial}`;
        break;
      case 3:
        return `sawtooth${partial}`;
        break;
      case 4:
        return `triangle${partial}`;
        break;
      default:
        return `sine${partial}`;
    }
  }

  generateInnerHTML() {
    return `
      <h2>channel:${this.address}</h2>
      <p>type:${this.channelType}</p>
      <h3>opt_group(0): effects</h3>
      ${this.renderEffectsChainAsHTML()}
      <h3>opt_group(1): vol</h3>
      <p id="vol_${this.address}">volume: <span class="bouncy">${this.volume}</span>dB</p>
      <h3>opt_group(2): waveform</h3>
      <p id="waveform_${this.address}">waveform: <span class="bouncy">${this.waveform}</span></p>
      <h3>opt_group(3): envelope</h3>
      <p id="amplitude_envelope_${this.address}">amplitude envelope: <span class="bouncy">${JSON.stringify(this.amplitudeEnvelopeArgs)}</span></p>
      <p id="last_msg_desc_${this.address}"><span class="bouncy">${this.lastMessageDescription}</span></p>
    `;
  }

  updateLastMessageDescription(oscMsg, note, duration) {
    const messageString = `${oscMsg.args[0]} played: ${note} for: ${duration} on ${this.address}`;
    this.lastMessageDescription = messageString;
    updateOutputMessageLog(messageString);
  }

  handle(oscMsg) {
    console.log(
      `This is channel: ${this.address} handling the message: ${JSON.stringify(oscMsg)}`,
    );
    const note = convertIntsToPitchOctave(oscMsg.args[1][0], oscMsg.args[1][1]);
    const duration = Time(oscMsg.args[1][2] / 10).toNotation();

    const env = new AmplitudeEnvelope(this.amplitudeEnvelopeArgs);

    const osc = new Oscillator({
      volume: this.volume,
      frequency: note,
      type: this.waveform,
    });

    const effects = this.effectsChain.map((effect) => effect.getEffect());

    osc.chain(env, ...effects, getDestination());

    const noteDuration = Time(duration).quantize("8n");
    const stopTime = noteDuration + this.amplitudeEnvelopeArgs.release;
    osc.start();
    env.triggerAttackRelease(noteDuration);
    osc.stop(`+${stopTime}`);

    setTimeout(
      () => {
        osc.dispose();
        env.dispose();
      },
      (stopTime + 0.5) * 1000,
    );

    this.updateLastMessageDescription(oscMsg, note, duration);
    this.render();
  }
}

class EffectChannel extends Channel {
  constructor(address, effect, effectName, effectOptions = {}) {
    super(address);
    this.effect = effect;
    this.effectName = effectName;
    this.channelType = "effect";
    this.wetness = effectOptions.wet;
    this.effectNode = new effect(effectOptions);
  }

  getEffect() {
    return this.effectNode;
  }

  setWetness(args) {
    this.wetness = args[0] / 10;
    this.effectNode.wet.value = this.wetness;
  }

  generateInnerHTML() {
    return `
      <h2>channel:${this.address}</h2>
      <p>type:${this.channelType}</p>
      <h3>opt_group(1): effect</h3>
      <p id="effect_${this.address}">effect: <span class="bouncy">${this.effectName}</span></p>
    `;
  }

  handle(oscMsg) {
    console.log(
      `This is channel: ${this.address}, channels of type effect don't handle messages directly.`,
    );
  }
}

class ReverbChannel extends EffectChannel {
  constructor(address) {
    const decayTime = new Time("10s");
    super(address, Reverb, "reverb", {
      decay: decayTime.toSeconds(),
      wet: 0.4,
    });
    this.decayTime = decayTime;
  }

  setDecayTime(args) {
    this.decayTime = new Time(args[0] / 10);
    this.effectNode.decay = Math.max(this.decayTime.toSeconds(), 0.001);
  }

  getDecayTimeAsNotation() {
    return this.decayTime.toNotation();
  }

  generateInnerHTML() {
    return `
      <h2>channel:${this.address}</h2>
      <p>type:${this.channelType}/${this.effectName}</p>
      <h3>opt_group(1): decay</h3>
      <p id="decay_${this.address}">decay: <span class="bouncy">${this.getDecayTimeAsNotation()}/${this.decayTime.toSeconds()}s</span></p>
      <h3>opt_group(2): wetness</h3>
      <p id="wetness_${this.address}">wetness: <span class="bouncy">${this.wetness}</span></p>
    `;
  }
}

class DelayChannel extends EffectChannel {
  constructor(address) {
    const delayTime = new Time("0.25s");
    const feedback = 0.4;
    super(address, FeedbackDelay, "delay", {
      delayTime: delayTime.toSeconds(),
      feedback: feedback,
      wet: 0.35,
    });
    this.delayTime = delayTime;
    this.feedback = feedback;
  }

  setDelayTime(args) {
    this.delayTime = new Time(args[0] / 10);
    this.effectNode.delayTime = this.delayTime.toSeconds();
  }

  getDelayTimeAsNotation() {
    return this.delayTime.toNotation();
  }

  setFeedback(args) {
    this.feedback = args[0] / 10;
    this.effectNode.feedback.value = this.feedback;
  }

  generateInnerHTML() {
    return `
      <h2>channel:${this.address}</h2>
      <p>type:${this.channelType}/${this.effectName}</p>
      <h3>opt_group(1): delay</h3>
      <p id="delay_${this.address}">delay: <span class="bouncy">${this.getDelayTimeAsNotation()}/${this.delayTime.toSeconds()}s</span></p>
      <h3>opt_group(2): feedback</h3>
      <p id="feedback_${this.address}">feedback: <span class="bouncy">${this.feedback}</span></p>
      <h3>opt_group(3): wetness</h3>
      <p id="wetness_${this.address}">wetness: <span class="bouncy">${this.wetness}</span></p>
    `;
  }
}

class DistortionChannel extends EffectChannel {
  constructor(address) {
    const distortion = 0.2;
    super(address, Distortion, "distortion", {
      distortion: distortion,
      wet: 0.35,
    });
    this.distortion = distortion;
  }

  setDistortion(args) {
    this.distortion = args[0] / 10;
    this.effectNode.distortion.value = this.distortion;
  }

  generateInnerHTML() {
    return `
      <h2>channel:${this.address}</h2>
      <p>type:${this.channelType}/${this.effectName}</p>
      <h3>opt_group(1): distortion</h3>
      <p id="distortion_${this.address}">distortion: <span class="bouncy">${this.distortion}</span></p>
      <h3>opt_group(2): wetness</h3>
      <p id="wetness_${this.address}">wetness: <span class="bouncy">${this.wetness}</span></p>
    `;
  }
}

class ChorusChannel extends EffectChannel {
  constructor(address) {
    const frequency = new Frequency("1.5Hz");
    const delayTime = new Time("0.25s");
    const depth = 20;
    super(address, Chorus, "chorus", {
      frequency: frequency,
      delayTime: delayTime,
      depth: depth,
      wet: 0.35,
    });
    this.frequency = frequency;
    this.delayTime = delayTime;
    this.depth = depth;
  }

  setFrequency(args) {
    this.frequency = new Frequency(parseInt(args.join("")));
    this.effectNode.frequency.value = this.frequency;
  }

  setDelayTime(args) {
    this.delayTime = new Time(args[0] / 10);
    this.effectNode.delayTime = this.delayTime.toSeconds();
  }

  getDelayTimeAsNotation() {
    return this.delayTime.toNotation();
  }

  setDepth(args) {
    this.depth = parseInt(args.join(""));
    this.effectNode.depth = this.depth;
  }

  generateInnerHTML() {
    return `
      <h2>channel:${this.address}</h2>
      <p>type:${this.channelType}/${this.effectName}</p>
      <h3>opt_group(1): frequency</h3>
      <p id="frequency_${this.address}">frequency: <span class="bouncy">${this.frequency.toFrequency()}Hz</span></p>
      <h3>opt_group(2): delay</h3>
      <p id="delay_${this.address}">delay: <span class="bouncy">${this.getDelayTimeAsNotation()}/${this.delayTime.toSeconds()}s</span></p>
      <h3>opt_group(3): depth</h3>
      <p id="depth_${this.address}">depth: <span class="bouncy">${this.depth}</span></p>
      <h3>opt_group(4): wetness</h3>
      <p id="wetness_${this.address}">wetness: <span class="bouncy">${this.wetness}</span></p>
    `;
  }
}

// class PhaserChannel extends EffectChannel {
//   constructor(address) {
//     const distortion = 0.2;
//     super(address, Phaser, "phaser", {
//       distortion: distortion,
//       wet: 0.35,
//     });
//     this.distortion = distortion;
//   }
//
//   setDistortion(args) {
//     this.distortion = args[0] / 10;
//     this.effectNode.distortion.value = this.distortion;
//   }
//
//   generateInnerHTML() {
//     return `
//       <h2>channel:${this.address}</h2>
//       <p>type:${this.channelType}/${this.effectName}</p>
//       <h3>opt_group(1): distortion</h3>
//       <p id="distortion_${this.address}">distortion: <span class="bouncy">${this.distortion}</span></p>
//       <h3>opt_group(2): wetness</h3>
//       <p id="wetness_${this.address}">wetness: <span class="bouncy">${this.wetness}</span></p>
//     `;
//   }
// }

class ControlChannel extends Channel {
  constructor(address) {
    super(address, Synth);
    this.channelType = "control";
  }

  generateInnerHTML() {
    return `
      <h2>channel:${this.address}</h2>
      <p>type:${this.channelType}</p>
      <h3>opt_group(1): bpm</h3>
      <p>bpm: <span class="bouncy">${this.getGlobalBpm()}</span></p>
      <p id="last_msg_desc_${this.address}"><span class="bouncy">${this.lastMessageDescription}</span></p>
    `;
  }

  updateLastMessageDescription(channel, action, name) {
    this.lastMessageDescription = `${name} set:channel:${channel} to: ${action}`;
  }

  setEffectsChainForChannel(channel, effects) {
    channel.effectsChain = effects
      .map((effect) => allChannels.channels[`/${effect}`])
      .filter((effectChannel) => effectChannel instanceof EffectChannel);
  }

  getGlobalBpm() {
    return Transport.bpm.value;
  }

  setGlobalBpm(args) {
    const bpm = parseInt(args.join(""));
    Transport.bpm.value = bpm;
  }

  handle(oscMsg) {
    console.log(
      `This is channel: ${this.address} handling the message: ${JSON.stringify(oscMsg)}`,
    );

    const channel = allChannels.channels[`/${oscMsg.args[1][0]}`];
    if (channel === undefined) {
      console.log("Invalid channel address");
      return;
    }
    var actionMessage = "";

    if (channel instanceof InstrumentChannel) {
      switch (oscMsg.args[1][1]) {
        case 0:
          this.setEffectsChainForChannel(channel, oscMsg.args[1].slice(2));
          actionMessage = `effects: ${channel.effectsChain.map(
            (effect) => effect.effectName,
          )}`;
          break;
        case 1:
          channel.setVolume(oscMsg.args[1][2]);
          actionMessage = `volume: ${channel.volume}`;
          break;
        case 2:
          channel.setVoice(oscMsg.args[1][2]);
          actionMessage = `voice: ${channel.voiceName}`;
          break;
        default:
          console.log("Invalid option group");
      }
    } else if (channel instanceof SynthChannel) {
      switch (oscMsg.args[1][1]) {
        case 0:
          this.setEffectsChainForChannel(channel, oscMsg.args[1].slice(2));
          actionMessage = `effects: ${channel.effectsChain.map(
            (effect) => effect.effectName,
          )}`;
          break;
        case 1:
          channel.setVolume(oscMsg.args[1][2]);
          actionMessage = `volume: ${channel.volume}`;
          break;
        case 2:
          channel.setWaveformAndPartial(oscMsg.args[1][2], oscMsg.args[1][3]);
          actionMessage = `waveform: ${channel.waveform}`;
          break;
        case 3:
          channel.setAmplitudeEnvelope(
            oscMsg.args[1][2],
            oscMsg.args[1][3],
            oscMsg.args[1][4],
            oscMsg.args[1][5],
          );
          actionMessage = `amplitude envelope: ${JSON.stringify(
            channel.amplitudeEnvelopeArgs,
          )}`;
          break;
        default:
          console.log("Invalid option group");
      }
    } else if (channel instanceof ControlChannel) {
      switch (oscMsg.args[1][1]) {
        case 1:
          channel.setGlobalBpm(oscMsg.args[1].slice(2));
          actionMessage = `bpm: ${channel.getGlobalBpm()}`;
          break;
        default:
          console.log("Invalid option group");
      }
    } else if (channel instanceof ReverbChannel) {
      switch (oscMsg.args[1][1]) {
        case 1:
          channel.setDecayTime(oscMsg.args[1].slice(2));
          actionMessage = `decay: ${channel.getDecayTimeAsNotation()}`;
          break;
        case 2:
          channel.setWetness(oscMsg.args[1].slice(2));
          actionMessage = `wetness: ${channel.wetness}`;
          break;
        default:
          console.log("Invalid option group");
      }
    } else if (channel instanceof DelayChannel) {
      switch (oscMsg.args[1][1]) {
        case 1:
          channel.setDelayTime(oscMsg.args[1].slice(2));
          actionMessage = `delay: ${channel.getDelayTimeAsNotation()}`;
          break;
        case 2:
          channel.setFeedback(oscMsg.args[1].slice(2));
          actionMessage = `feedback: ${channel.feedback}`;
          break;
        case 3:
          channel.setWetness(oscMsg.args[1].slice(2));
          actionMessage = `wetness: ${channel.wetness}`;
          break;
        default:
          console.log("Invalid option group");
      }
    } else if (channel instanceof DistortionChannel) {
      switch (oscMsg.args[1][1]) {
        case 1:
          channel.setDistortion(oscMsg.args[1].slice(2));
          actionMessage = `distortion: ${channel.distortion}`;
          break;
        case 2:
          channel.setWetness(oscMsg.args[1].slice(2));
          actionMessage = `wetness: ${channel.wetness}`;
          break;
        default:
          console.log("Invalid option group");
      }
    } else if (channel instanceof ChorusChannel) {
      switch (oscMsg.args[1][1]) {
        case 1:
          channel.setFrequency(oscMsg.args[1].slice(2));
          actionMessage = `frequency: ${channel.frequency}`;
          break;
        case 2:
          channel.setDelayTime(oscMsg.args[1].slice(2));
          actionMessage = `delay: ${channel.getDelayTimeAsNotation()}`;
          break;
        case 3:
          channel.setDepth(oscMsg.args[1].slice(2));
          actionMessage = `depth: ${channel.depth}`;
          break;
        case 4:
          channel.setWetness(oscMsg.args[1].slice(2));
          actionMessage = `wetness: ${channel.wetness}`;
          break;
        default:
          console.log("Invalid option group");
      }
    }

    channel.render();
    this.updateLastMessageDescription(
      channel.address,
      actionMessage,
      oscMsg.args[0],
    );
    this.render();
  }
}

export const allChannels = {
  channels: {
    "/0": new ControlChannel("/0"),
    "/1": new InstrumentChannel("/1", Synth, "osc synth"),
    "/2": new SynthChannel("/2", "sine"),
    "/3": new SynthChannel("/3", "sawtooth"),
    "/4": new ReverbChannel("/3"),
    "/5": new DelayChannel("/4"),
    "/6": new DistortionChannel("/5"),
    "/7": new ChorusChannel("/6"),
  },

  async initialise() {
    console.log("Initialising channels with defaults.");
    for (const addr in this.channels) {
      this.channels[addr].initialise();
    }

    console.log(
      "Fetching last control message for each channel and option group from backend.",
    );
    const response = await fetch("/api/get-control-messages");
    const controlMessages = await response.json();
    controlMessages.controlMessages.forEach((oscMsg) => {
      this.channels[oscMsg.address].handle(oscMsg);
      updateInputMessageLog(
        `${oscMsg.args[0]}: ${JSON.stringify(oscMsg.args[1])} -> ${oscMsg.address}`,
      );
    });
  },
};
