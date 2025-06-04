import {
  MembraneSynth,
  Synth,
  Oscillator,
  AmplitudeEnvelope,
  Time,
  Transport,
  Reverb,
  SynthOptions,
  MembraneSynthOptions,
  ToneOscillatorType,
  // BasicEnvelopeCurve, // Removed this import
  BasicPlaybackState,
  Unit,
  getDestination,
} from "tone";
import { convertIntsToPitchOctave } from "./utils";
import { updateInputMessageLog, updateOutputMessageLog } from "./logging";
import { OSCMessage, OSCArgument } from "../osc/types"; // Corrected path

// Define a type for the structure of amplitudeEnvelopeArgs
interface AmplitudeEnvelopeArgs {
  attack: number | Unit.Time;
  decay: number | Unit.Time;
  sustain: number; // Sustain is a factor between 0 and 1
  release: number | Unit.Time;
  attackCurve?: 'linear' | 'exponential';
  decayCurve?: 'linear' | 'exponential';
  releaseCurve?: 'linear' | 'exponential';
}

// Base class for all channels
class Channel {
  public address: string;
  public channelType: string;
  public volume: number; // in dB
  public lastMessageDescription: string;
  public effectsChain: EffectChannel[]; // Assuming EffectChannel is a defined class

  constructor(address: string) {
    this.address = address;
    this.channelType = "generic";
    this.volume = -8;
    this.lastMessageDescription = "awaiting input";
    this.effectsChain = [];
  }

  public setVolume(vol: number): void {
    this.volume = -vol; // Assuming vol is positive and represents attenuation
  }

  public generateInnerHTML(): string {
    return `
      <h2>channel:${this.address}</h2>
      <p>channel type: ${this.channelType}</p>
      <p id="last_msg_desc_${this.address}">${this.lastMessageDescription}</p>
    `;
  }

  public render(): void {
    const channelDiv = document.getElementById(`channel_${this.address}`) as HTMLDivElement | null;
    if (channelDiv) {
      channelDiv.innerHTML = this.generateInnerHTML();
    } else {
      console.error(`Channel div for address ${this.address} not found.`);
    }
  }

  public renderEffectsChainAsHTML(): string {
    return this.effectsChain
      .map((effect) => `<p>${effect.effectName}</p>`)
      .join("");
  }

  public initialise(): void {
    const div = document.createElement("div");
    div.id = `channel_${this.address}`;
    div.className = "channel"; // Use className for setting class
    div.innerHTML = this.generateInnerHTML();
    const container = document.getElementById("channel-container");
    if (container) {
      container.appendChild(div);
    } else {
      console.error("Channel container not found.");
    }
  }

  public updateLastMessageDescriptionFromOSC(oscMsg: OSCMessage): void {
    // Assuming args[0] is sender and args[1] is the primary content
    const sender = oscMsg.args[0]?.value; // Use .value
    const content = oscMsg.args[1]?.value; // Use .value
    this.lastMessageDescription = `received: [${JSON.stringify(content)}] from: ${sender}`;
  }

  // Base handle method, to be overridden by subclasses
  public handle(oscMsg: OSCMessage): void {
    console.log(
      `This is channel: ${this.address} handling the message: ${JSON.stringify(oscMsg)}`,
    );
    this.updateLastMessageDescriptionFromOSC(oscMsg); // Removed undefined 'note' and 'duration'
    this.render();
  }
}

// Type for the constructor of Synth-like classes
type SynthConstructor = new (options?: Partial<SynthOptions> | Partial<MembraneSynthOptions>) => Synth | MembraneSynth;


class InstrumentChannel extends Channel {
  public voice: SynthConstructor;
  public voiceName: string;

  constructor(address: string, voice: SynthConstructor, voiceName: string) {
    super(address);
    this.voice = voice;
    this.voiceName = voiceName;
    this.channelType = "instrument";
  }

  public setVoice(arg: number): void {
    const [voiceName, voiceConstructor] = this.mapArgToVoice(arg);
    this.voiceName = voiceName;
    this.voice = voiceConstructor;
  }

  private mapArgToVoice(arg: number): [string, SynthConstructor] {
    switch (arg) {
      case 1:
        return ["osc synth", Synth];
      case 2:
        return ["membrane synth", MembraneSynth];
      default:
        return ["osc synth", Synth];
    }
  }

  public generateInnerHTML(): string {
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

  public updateLastMessageDescription(oscMsg: OSCMessage, note: string, duration: string): void {
    const sender = oscMsg.args[0]?.value; // Use .value
    const messageString = `${sender} played: ${note} for: ${duration} on ${this.address}`;
    this.lastMessageDescription = messageString;
    updateOutputMessageLog(messageString);
  }

  public handle(oscMsg: OSCMessage): void {
    console.log(
      `This is channel: ${this.address} handling the message: ${JSON.stringify(oscMsg)}`,
    );
    // Assuming oscMsg.args[1] contains an array [pitch, octave, durationMs]
    const mainArgs = oscMsg.args[1]?.value as any[]; // use .value
    if (!mainArgs || mainArgs.length < 3) {
      console.error("Invalid arguments for InstrumentChannel handle:", oscMsg);
      return;
    }
    const note = convertIntsToPitchOctave(mainArgs[0], mainArgs[1]);
    const durationNotation = Time(mainArgs[2] / 10).toNotation();

    const synthInstance = new this.voice({ volume: this.volume } as any); // Don't connect to destination yet
    const effectsToChain = this.effectsChain.map((effect) => effect.getEffect());

    if (effectsToChain.length > 0) {
      synthInstance.chain(...effectsToChain, getDestination());
    } else {
      synthInstance.toDestination();
    }

    synthInstance.triggerAttackRelease(note, Time(durationNotation).quantize("8n") as Unit.Time);


    this.updateLastMessageDescription(oscMsg, note, durationNotation);
    this.render();
  }
}

class SynthChannel extends Channel {
  public waveform: ToneOscillatorType; // Corrected type
  public amplitudeEnvelopeArgs: AmplitudeEnvelopeArgs;

  constructor(address: string, waveform: ToneOscillatorType) {
    super(address);
    this.waveform = waveform;
    this.channelType = "synth";
    this.amplitudeEnvelopeArgs = {
      attack: 0.1,
      decay: 0.2,
      sustain: 0.5,
      release: 1,
    };
  }

  public setAmplitudeEnvelope(attack: number, decay: number, sustain: number, release: number): void {
    this.amplitudeEnvelopeArgs = {
      attack: attack / 10,
      decay: decay / 10,
      sustain: sustain / 10, // Sustain is 0-1
      release: release / 10,
    };
    this.render(); // Re-render to show updated envelope
  }

  public setWaveformAndPartial(wave: number, partial?: number): void {
    this.waveform = this.mapArgsToWaveform(wave, partial);
    this.render(); // Re-render to show updated waveform
  }

  private mapArgsToWaveform(wave: number, partial?: number): ToneOscillatorType { // Corrected return type
    const p = partial === 0 || partial === undefined ? "" : `${partial}`;
    switch (wave) {
      case 1: return `sine${p}` as ToneOscillatorType;
      case 2: return `square${p}` as ToneOscillatorType;
      case 3: return `sawtooth${p}` as ToneOscillatorType;
      case 4: return `triangle${p}` as ToneOscillatorType;
      default: return `sine${p}` as ToneOscillatorType;
    }
  }

  public generateInnerHTML(): string {
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

  public updateLastMessageDescription(oscMsg: OSCMessage, note: string, duration: string): void {
    const sender = oscMsg.args[0]?.value;
    const messageString = `${sender} played: ${note} for: ${duration} on ${this.address}`;
    this.lastMessageDescription = messageString;
    updateOutputMessageLog(messageString);
  }

  public handle(oscMsg: OSCMessage): void {
    console.log(
      `This is channel: ${this.address} handling the message: ${JSON.stringify(oscMsg)}`,
    );
    const mainArgs = oscMsg.args[1]?.value as any[]; // use .value
     if (!mainArgs || mainArgs.length < 3) {
      console.error("Invalid arguments for SynthChannel handle:", oscMsg);
      return;
    }
    const note = convertIntsToPitchOctave(mainArgs[0], mainArgs[1]);
    const durationNotation = Time(mainArgs[2] / 10).toNotation();

    const env = new AmplitudeEnvelope(this.amplitudeEnvelopeArgs).toDestination();
    const osc = new Oscillator({
      volume: this.volume,
      frequency: note,
      type: this.waveform,
    } as any); // Cast to any if type issues persist with OscillatorOptions

    const effectsToChain = this.effectsChain.map((effect) => effect.getEffect());

    if (effectsToChain.length > 0) {
      osc.chain(...effectsToChain, env);
    } else {
      osc.connect(env); // Connect directly to envelope if no effects
    }

    osc.start();
    env.triggerAttackRelease(Time(durationNotation).quantize("8n") as Unit.Time);

    // Ensure oscillator stops after release to free resources
    // Ensure release is treated as a number (seconds) for the calculation
    const releaseTimeSeconds = typeof this.amplitudeEnvelopeArgs.release === 'number'
      ? this.amplitudeEnvelopeArgs.release
      : Time(this.amplitudeEnvelopeArgs.release).toSeconds();

    Transport.scheduleOnce(() => {
        if (osc.state === "started" as BasicPlaybackState) { // Type assertion for state
            osc.stop();
            osc.dispose(); // Dispose to free up resources
        }
    }, `+${Time(durationNotation).toSeconds() + releaseTimeSeconds + 0.1}`);


    this.updateLastMessageDescription(oscMsg, note, durationNotation);
    this.render();
  }
}

// Define a type for Effect constructors if possible, or use 'any'
type EffectConstructor = new (options?: any) => any; // Replace 'any' with specific effect types if known

class EffectChannel extends Channel {
  public effect: EffectConstructor; // Type for the effect class/constructor
  public effectName: string;

  constructor(address: string, effect: EffectConstructor, effectName: string) {
    super(address);
    this.effect = effect;
    this.effectName = effectName;
    this.channelType = "effect";
  }

  // This should return an instance of a Tone.js effect
  public getEffect(): any { // Return type should be a Tone.js effect component
    return new this.effect();
  }

  public generateInnerHTML(): string {
    return `
      <h2>channel:${this.address}</h2>
      <p>channel type: ${this.channelType}</p>
      <h3>opt_group(1): effect</h3>
      <p id="effect_${this.address}">effect: ${this.effectName}</p>
    `;
  }

  public handle(oscMsg: OSCMessage): void {
    console.log(
      `This is channel: ${this.address}, channels of type effect don't handle messages directly.`,
    );
    // Effects channels typically don't handle direct messages for playback
    this.updateLastMessageDescriptionFromOSC(oscMsg);
    this.render();
  }
}

class ReverbChannel extends EffectChannel {
  public decayTime: Unit.Time;
  public wetness: number; // Changed from Unit.SignalValue to number (NormalRange 0-1)

  constructor(address: string) {
    super(address, Reverb, "reverb");
    this.decayTime = "10s" as Unit.Time;
    this.wetness = 1; // Wetness is a number between 0 and 1
  }

  public getEffect(): Reverb { // Specifically a Reverb instance
    return new this.effect({ // this.effect is Reverb constructor
      decay: this.decayTime,
      wet: this.wetness,
    });
  }

  public setDecayTime(args: any[]): void {
    // Ensure Time conversion is handled correctly, this.decayTime is Unit.Time
    this.decayTime = Time(args[0] / 10).valueOf() as Unit.Time;
    this.render();
  }

  public getDecayTimeAsNotation(): string {
    return Time(this.decayTime).toNotation();
  }

  public setWetness(args: any[]): void {
    this.wetness = (args[0] / 10); // Wetness is 0-1, ensure it's number
    this.render();
  }

  public generateInnerHTML(): string {
    return `
      <h2>channel:${this.address}</h2>
      <p>channel type: ${this.channelType}/${this.effectName}</p>
      <h3>opt_group(1): decay</h3>
      <p id="decay_${this.address}">decay: ${this.getDecayTimeAsNotation()}</p>
      <h3>opt_group(2): wetness</h3>
      <p id="wetness_${this.address}">wetness: ${this.wetness}</p>
    `;
  }
  // handle is inherited from EffectChannel (logs and renders)
}


class ControlChannel extends Channel {
  // The second argument to super(address, Synth) was incorrect for ControlChannel
  constructor(address: string) {
    super(address); // Control channels typically don't have their own synth voice
    this.channelType = "control";
  }

  public generateInnerHTML(): string {
    return `
      <h2>channel:${this.address}</h2>
      <p>channel type: ${this.channelType}</p>
      <p id="last_msg_desc_${this.address}">${this.lastMessageDescription}</p>
      <h3>opt_group(1): bpm</h3>
      <p>bpm: ${this.getGlobalBpm()}</p>
    `;
  }

  // Overload or specify types for updateLastMessageDescription
  public updateLastMessageDescriptionControl(channelAddr: string, action: string, name: string | undefined): void {
    this.lastMessageDescription = `${name || 'controller'} set channel ${channelAddr} to: ${action}`;
  }

  public setEffectsChainForChannel(targetChannel: Channel, effectAddresses: string[]): void {
    targetChannel.effectsChain = []; // Clear existing effects
    if (effectAddresses.length === 0) {
      return;
    }
    effectAddresses.forEach((effectAddr) => {
      const effectChannelInstance = allChannels.channels[`/${effectAddr}`];
      if (effectChannelInstance instanceof EffectChannel) {
        targetChannel.effectsChain.push(effectChannelInstance);
      } else {
        console.warn(`Channel /${effectAddr} is not an EffectChannel.`);
      }
    });
  }

  public getGlobalBpm(): number {
    return Transport.bpm.value;
  }

  public setGlobalBpm(args: any[]): void { // args should be number[] or string[]
    const bpmString = args.map(String).join(""); // Ensure args are converted to string then joined
    const bpm = parseInt(bpmString, 10);
    if (!isNaN(bpm)) {
      Transport.bpm.value = bpm;
    } else {
      console.error("Invalid BPM value:", args);
    }
    this.render(); // Re-render to show new BPM
  }

  public handle(oscMsg: OSCMessage): void {
    console.log(
      `This is channel: ${this.address} handling the message: ${JSON.stringify(oscMsg)}`,
    );

    const mainArgs = oscMsg.args[1]?.value as any[]; // use .value
    if (!mainArgs || mainArgs.length < 2) { // Need at least target channel and option group
        console.error("Invalid arguments for ControlChannel handle:", oscMsg);
        return;
    }

    const targetChannelAddress = `/${mainArgs[0]}`;
    const targetChannel = allChannels.channels[targetChannelAddress];

    if (!targetChannel) {
      console.log(`Invalid target channel address: ${targetChannelAddress}`);
      return;
    }

    let actionMessage = "";
    const optionGroup = mainArgs[1]; // This is the opt_group number
    const params = mainArgs.slice(2); // Remaining parameters for the action

    if (targetChannel instanceof InstrumentChannel || targetChannel instanceof SynthChannel) {
      switch (optionGroup) {
        case 0: // Effects chain
          // Params here are effect addresses (e.g., string numbers "3", "4")
          this.setEffectsChainForChannel(targetChannel, params as string[]);
          actionMessage = `effects: ${targetChannel.effectsChain.map(e => e.effectName).join(", ")}`;
          break;
        case 1: // Volume
          if (params.length > 0) {
            targetChannel.setVolume(params[0] as number);
            actionMessage = `volume: ${targetChannel.volume}dB`;
          }
          break;
        // InstrumentChannel specific
        case 2:
          if (targetChannel instanceof InstrumentChannel && params.length > 0) {
            targetChannel.setVoice(params[0] as number);
            actionMessage = `voice: ${targetChannel.voiceName}`;
          } else if (targetChannel instanceof SynthChannel && params.length > 0) { // SynthChannel specific
            targetChannel.setWaveformAndPartial(params[0] as number, params[1] as number | undefined);
            actionMessage = `waveform: ${targetChannel.waveform}`;
          }
          break;
        // SynthChannel specific
        case 3:
          if (targetChannel instanceof SynthChannel && params.length >= 4) {
            targetChannel.setAmplitudeEnvelope(params[0], params[1], params[2], params[3]);
            actionMessage = `envelope: ${JSON.stringify(targetChannel.amplitudeEnvelopeArgs)}`;
          }
          break;
        default:
          console.log("Invalid option group for Instrument/Synth Channel:", optionGroup);
          return; // Return early if invalid option group
      }
    } else if (targetChannel instanceof ControlChannel) { // Control another ControlChannel (e.g. this one for BPM)
      switch (optionGroup) {
        case 1: // BPM
          targetChannel.setGlobalBpm(params); // Pass all remaining params for BPM
          actionMessage = `bpm: ${targetChannel.getGlobalBpm()}`;
          break;
        default:
          console.log("Invalid option group for Control Channel:", optionGroup);
          return;
      }
    } else if (targetChannel instanceof ReverbChannel) { // Specifically ReverbChannel
       switch (optionGroup) {
        case 1: // Decay Time
          if (params.length > 0) {
            targetChannel.setDecayTime(params);
            actionMessage = `decay: ${targetChannel.getDecayTimeAsNotation()}`;
          }
          break;
        case 2: // Wetness
          if (params.length > 0) {
            targetChannel.setWetness(params);
            actionMessage = `wetness: ${targetChannel.wetness}`;
          }
          break;
        default:
          console.log("Invalid option group for ReverbChannel:", optionGroup);
          return;
      }
    } else if (targetChannel instanceof EffectChannel) { // Generic EffectChannel (if any other than Reverb)
        // Add handlers if there are generic EffectChannel params
        console.log("No specific control implemented for generic EffectChannel type via ControlChannel yet.");
        actionMessage = `params set for ${targetChannel.effectName}`;
    }


    if (actionMessage) { // Only render if an action was taken
        targetChannel.render();
        this.updateLastMessageDescriptionControl(targetChannel.address, actionMessage, oscMsg.args[0]?.value as string | undefined);
    }
    this.render();
  }
}

interface AllChannels {
  channels: {
    [key: string]: Channel; // Dictionary of Channel instances
  };
  initialise: () => Promise<void>;
}

export const allChannels: AllChannels = {
  channels: {
    "/0": new ControlChannel("/0"),
    "/1": new InstrumentChannel("/1", Synth as SynthConstructor, "osc synth"),
    "/2": new SynthChannel("/2", "sine" as ToneOscillatorType), // Corrected cast
    "/3": new ReverbChannel("/3"),
  },

  async initialise() {
    console.log("Initialising channels with defaults.");
    for (const addr in this.channels) {
      if (this.channels.hasOwnProperty(addr)) {
        this.channels[addr].initialise();
      }
    }

    console.log(
      "Fetching last control message for each channel and option group from backend.",
    );
    try {
      const response = await fetch("/api/get-control-messages");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      // Assuming the server sends back { controlMessages: OSCMessage[] }
      const data: { controlMessages: OSCMessage[] } = await response.json();

      if (data.controlMessages && Array.isArray(data.controlMessages)) {
        data.controlMessages.forEach((oscMsg: OSCMessage) => {
          // Ensure oscMsg.address is valid and exists in allChannels.channels
          const targetChannel = this.channels[oscMsg.address];
          if (targetChannel) {
            targetChannel.handle(oscMsg); // Let each channel handle its control message
            const sender = oscMsg.args[0]?.value; // use .value
            const messageContent = oscMsg.args[1]?.value; // use .value
            updateInputMessageLog(
              `${sender}: ${JSON.stringify(messageContent)} -> ${oscMsg.address}`,
            );
          } else {
            console.warn(`Received control message for unknown channel: ${oscMsg.address}`);
          }
        });
      } else {
        console.error("Control messages data is not in expected format:", data);
      }
    } catch (error) {
      console.error("Failed to fetch or process control messages:", error);
    }
  },
};
