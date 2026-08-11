import {
  MembraneSynth,
  Synth,
  Oscillator,
  AmplitudeEnvelope,
  Time,
  Transport,
  Reverb,
  FeedbackDelay,
  getDestination,
} from "tone";
import { convertIntsToPitchOctave } from "./utils";
import { updateInputMessageLog, updateOutputMessageLog } from "./logging";

class Channel {
  constructor(address) {
    this.address = address;
    this.channelType = "generic";
    this.volume = -8;
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
      <p>channel type: ${this.channelType}</p>
      <p id="last_msg_desc_${this.address}">${this.lastMessageDescription}</p>
    `;
  }

  render() {
    const channelDiv = document.getElementById(`channel_${this.address}`);
    channelDiv.innerHTML = this.generateInnerHTML();
  }

  renderEffectsChainAsHTML() {
    return this.effectsChain
      .map((effect) => `<p>${effect.effectName}</p>`)
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
        break;
      case 2:
        return ["membrane synth", MembraneSynth];
        break;
      default:
        return ["osc synth", Synth];
    }
  }

  generateInnerHTML() {
    return `
      <h2>channel:${this.address}</h2>
      <p>channel type: ${this.channelType}</p>
      <h3>opt_group(0): effects</h3>
      ${this.renderEffectsChainAsHTML()}
      <h3>opt_group(1): vol</h3>
      <p id="vol_${this.address}">volume: ${this.volume}dB</p>
      <h3>opt_group(2): voice</h3>
      <p id="voice_${this.address}">voice: ${this.voiceName}</p>
      <p id="last_msg_desc_${this.address}">${this.lastMessageDescription}</p>
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
      <p>channel type: ${this.channelType}</p>
      <h3>opt_group(0): effects</h3>
      ${this.renderEffectsChainAsHTML()}
      <h3>opt_group(1): vol</h3>
      <p id="vol_${this.address}">volume: ${this.volume}dB</p>
      <h3>opt_group(2): waveform</h3>
      <p id="waveform_${this.address}">waveform: ${this.waveform}</p>
      <h3>opt_group(3): envelope</h3>
      <p id="amplitude_envelope_${this.address}">amplitude envelope: ${JSON.stringify(this.amplitudeEnvelopeArgs)}</p>
      <p id="last_msg_desc_${this.address}">${this.lastMessageDescription}</p>
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

    setTimeout(() => {
      osc.dispose();
      env.dispose();
    }, (stopTime + 0.5) * 1000);

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
      <p>channel type: ${this.channelType}</p>
      <h3>opt_group(1): effect</h3>
      <p id="effect_${this.address}">effect: ${this.effectName}</p>
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
    this.decayTime = new Time(args[0] / 2);
    this.effectNode.decay = Math.max(this.decayTime.toSeconds(), 0.001);
  }

  getDecayTimeAsNotation() {
    return this.decayTime.toNotation();
  }

  generateInnerHTML() {
    return `
      <h2>channel:${this.address}</h2>
      <p>channel type: ${this.channelType}/${this.effectName}</p>
      <h3>opt_group(1): decay</h3>
      <p id="decay_${this.address}">decay: ${this.getDecayTimeAsNotation()}/${this.decayTime.toSeconds()}s</p>
      <h3>opt_group(2): wetness</h3>
      <p id="wetness_${this.address}">wetness: ${this.wetness}</p>
    `;
  }

  handle(oscMsg) {
    console.log(
      `This is channel: ${this.address}, channels of type effect don't handle messages directly.`,
    );
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
    this.effectNode.delayTime.value = this.delayTime.toSeconds();
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
      <p>channel type: ${this.channelType}/${this.effectName}</p>
      <h3>opt_group(1): delay</h3>
      <p id="delay_${this.address}">delay: ${this.getDelayTimeAsNotation()}/${this.delayTime.toSeconds()}s</p>
      <h3>opt_group(2): feedback</h3>
      <p id="feedback_${this.address}">feedback: ${this.feedback}</p>
      <h3>opt_group(3): wetness</h3>
      <p id="wetness_${this.address}">wetness: ${this.wetness}</p>
    `;
  }

  handle(oscMsg) {
    console.log(
      `This is channel: ${this.address}, channels of type effect don't handle messages directly.`,
    );
  }
}

class ControlChannel extends Channel {
  constructor(address) {
    super(address, Synth);
    this.channelType = "control";
  }

  generateInnerHTML() {
    return `
      <h2>channel:${this.address}</h2>
      <p>channel type: ${this.channelType}</p>
      <p id="last_msg_desc_${this.address}">${this.lastMessageDescription}</p>
      <h3>opt_group(1): bpm</h3>
      <p>bpm: ${this.getGlobalBpm()}</p>
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
    "/3": new ReverbChannel("/3"),
    "/4": new DelayChannel("/4"),
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
