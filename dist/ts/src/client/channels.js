"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allChannels = void 0;
const tone_1 = require("tone");
const utils_1 = require("./utils");
const logging_1 = require("./logging");
// Base class for all channels
class Channel {
    constructor(address) {
        this.address = address;
        this.channelType = "generic";
        this.volume = -8;
        this.lastMessageDescription = "awaiting input";
        this.effectsChain = [];
    }
    setVolume(vol) {
        this.volume = -vol; // Assuming vol is positive and represents attenuation
    }
    generateInnerHTML() {
        return `
      <h2>channel:${this.address}</h2>
      <p>channel type: ${this.channelType}</p>
      <p id="last_msg_desc_${this.address}">${this.lastMessageDescription}</p>
    `;
    }
    render() {
        const channelDiv = document.getElementById(`channel_${this.address}`);
        if (channelDiv) {
            channelDiv.innerHTML = this.generateInnerHTML();
        }
        else {
            console.error(`Channel div for address ${this.address} not found.`);
        }
    }
    renderEffectsChainAsHTML() {
        return this.effectsChain
            .map((effect) => `<p>${effect.effectName}</p>`)
            .join("");
    }
    initialise() {
        const div = document.createElement("div");
        div.id = `channel_${this.address}`;
        div.className = "channel"; // Use className for setting class
        div.innerHTML = this.generateInnerHTML();
        const container = document.getElementById("channel-container");
        if (container) {
            container.appendChild(div);
        }
        else {
            console.error("Channel container not found.");
        }
    }
    updateLastMessageDescriptionFromOSC(oscMsg) {
        // Assuming args[0] is sender and args[1] is the primary content
        const sender = oscMsg.args[0]?.value; // Use .value
        const content = oscMsg.args[1]?.value; // Use .value
        this.lastMessageDescription = `received: [${JSON.stringify(content)}] from: ${sender}`;
    }
    // Base handle method, to be overridden by subclasses
    handle(oscMsg) {
        console.log(`This is channel: ${this.address} handling the message: ${JSON.stringify(oscMsg)}`);
        this.updateLastMessageDescriptionFromOSC(oscMsg); // Removed undefined 'note' and 'duration'
        this.render();
    }
}
class InstrumentChannel extends Channel {
    constructor(address, voice, voiceName) {
        super(address);
        this.voice = voice;
        this.voiceName = voiceName;
        this.channelType = "instrument";
    }
    setVoice(arg) {
        const [voiceName, voiceConstructor] = this.mapArgToVoice(arg);
        this.voiceName = voiceName;
        this.voice = voiceConstructor;
    }
    mapArgToVoice(arg) {
        switch (arg) {
            case 1:
                return ["osc synth", tone_1.Synth];
            case 2:
                return ["membrane synth", tone_1.MembraneSynth];
            default:
                return ["osc synth", tone_1.Synth];
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
        const sender = oscMsg.args[0]?.value; // Use .value
        const messageString = `${sender} played: ${note} for: ${duration} on ${this.address}`;
        this.lastMessageDescription = messageString;
        (0, logging_1.updateOutputMessageLog)(messageString);
    }
    handle(oscMsg) {
        console.log(`This is channel: ${this.address} handling the message: ${JSON.stringify(oscMsg)}`);
        // Assuming oscMsg.args[1] contains an array [pitch, octave, durationMs]
        const mainArgs = oscMsg.args[1]?.value; // use .value
        if (!mainArgs || mainArgs.length < 3) {
            console.error("Invalid arguments for InstrumentChannel handle:", oscMsg);
            return;
        }
        const note = (0, utils_1.convertIntsToPitchOctave)(mainArgs[0], mainArgs[1]);
        const durationNotation = (0, tone_1.Time)(mainArgs[2] / 10).toNotation();
        const synthInstance = new this.voice({ volume: this.volume }); // Don't connect to destination yet
        const effectsToChain = this.effectsChain.map((effect) => effect.getEffect());
        if (effectsToChain.length > 0) {
            synthInstance.chain(...effectsToChain, (0, tone_1.getDestination)());
        }
        else {
            synthInstance.toDestination();
        }
        synthInstance.triggerAttackRelease(note, (0, tone_1.Time)(durationNotation).quantize("8n"));
        this.updateLastMessageDescription(oscMsg, note, durationNotation);
        this.render();
    }
}
class SynthChannel extends Channel {
    constructor(address, waveform) {
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
    setAmplitudeEnvelope(attack, decay, sustain, release) {
        this.amplitudeEnvelopeArgs = {
            attack: attack / 10,
            decay: decay / 10,
            sustain: sustain / 10, // Sustain is 0-1
            release: release / 10,
        };
        this.render(); // Re-render to show updated envelope
    }
    setWaveformAndPartial(wave, partial) {
        this.waveform = this.mapArgsToWaveform(wave, partial);
        this.render(); // Re-render to show updated waveform
    }
    mapArgsToWaveform(wave, partial) {
        const p = partial === 0 || partial === undefined ? "" : `${partial}`;
        switch (wave) {
            case 1: return `sine${p}`;
            case 2: return `square${p}`;
            case 3: return `sawtooth${p}`;
            case 4: return `triangle${p}`;
            default: return `sine${p}`;
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
        const sender = oscMsg.args[0]?.value;
        const messageString = `${sender} played: ${note} for: ${duration} on ${this.address}`;
        this.lastMessageDescription = messageString;
        (0, logging_1.updateOutputMessageLog)(messageString);
    }
    handle(oscMsg) {
        console.log(`This is channel: ${this.address} handling the message: ${JSON.stringify(oscMsg)}`);
        const mainArgs = oscMsg.args[1]?.value; // use .value
        if (!mainArgs || mainArgs.length < 3) {
            console.error("Invalid arguments for SynthChannel handle:", oscMsg);
            return;
        }
        const note = (0, utils_1.convertIntsToPitchOctave)(mainArgs[0], mainArgs[1]);
        const durationNotation = (0, tone_1.Time)(mainArgs[2] / 10).toNotation();
        const env = new tone_1.AmplitudeEnvelope(this.amplitudeEnvelopeArgs).toDestination();
        const osc = new tone_1.Oscillator({
            volume: this.volume,
            frequency: note,
            type: this.waveform,
        }); // Cast to any if type issues persist with OscillatorOptions
        const effectsToChain = this.effectsChain.map((effect) => effect.getEffect());
        if (effectsToChain.length > 0) {
            osc.chain(...effectsToChain, env);
        }
        else {
            osc.connect(env); // Connect directly to envelope if no effects
        }
        osc.start();
        env.triggerAttackRelease((0, tone_1.Time)(durationNotation).quantize("8n"));
        // Ensure oscillator stops after release to free resources
        // Ensure release is treated as a number (seconds) for the calculation
        const releaseTimeSeconds = typeof this.amplitudeEnvelopeArgs.release === 'number'
            ? this.amplitudeEnvelopeArgs.release
            : (0, tone_1.Time)(this.amplitudeEnvelopeArgs.release).toSeconds();
        tone_1.Transport.scheduleOnce(() => {
            if (osc.state === "started") { // Type assertion for state
                osc.stop();
                osc.dispose(); // Dispose to free up resources
            }
        }, `+${(0, tone_1.Time)(durationNotation).toSeconds() + releaseTimeSeconds + 0.1}`);
        this.updateLastMessageDescription(oscMsg, note, durationNotation);
        this.render();
    }
}
class EffectChannel extends Channel {
    constructor(address, effect, effectName) {
        super(address);
        this.effect = effect;
        this.effectName = effectName;
        this.channelType = "effect";
    }
    // This should return an instance of a Tone.js effect
    getEffect() {
        return new this.effect();
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
        console.log(`This is channel: ${this.address}, channels of type effect don't handle messages directly.`);
        // Effects channels typically don't handle direct messages for playback
        this.updateLastMessageDescriptionFromOSC(oscMsg);
        this.render();
    }
}
class ReverbChannel extends EffectChannel {
    constructor(address) {
        super(address, tone_1.Reverb, "reverb");
        this.decayTime = "10s";
        this.wetness = 1; // Wetness is a number between 0 and 1
    }
    getEffect() {
        return new this.effect({
            decay: this.decayTime,
            wet: this.wetness,
        });
    }
    setDecayTime(args) {
        // Ensure Time conversion is handled correctly, this.decayTime is Unit.Time
        this.decayTime = (0, tone_1.Time)(args[0] / 10).valueOf();
        this.render();
    }
    getDecayTimeAsNotation() {
        return (0, tone_1.Time)(this.decayTime).toNotation();
    }
    setWetness(args) {
        this.wetness = (args[0] / 10); // Wetness is 0-1, ensure it's number
        this.render();
    }
    generateInnerHTML() {
        return `
      <h2>channel:${this.address}</h2>
      <p>channel type: ${this.channelType}/${this.effectName}</p>
      <h3>opt_group(1): decay</h3>
      <p id="decay_${this.address}">decay: ${this.getDecayTimeAsNotation()}</p>
      <h3>opt_group(2): wetness</h3>
      <p id="wetness_${this.address}">wetness: ${this.wetness}</p>
    `;
    }
}
class ControlChannel extends Channel {
    // The second argument to super(address, Synth) was incorrect for ControlChannel
    constructor(address) {
        super(address); // Control channels typically don't have their own synth voice
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
    // Overload or specify types for updateLastMessageDescription
    updateLastMessageDescriptionControl(channelAddr, action, name) {
        this.lastMessageDescription = `${name || 'controller'} set channel ${channelAddr} to: ${action}`;
    }
    setEffectsChainForChannel(targetChannel, effectAddresses) {
        targetChannel.effectsChain = []; // Clear existing effects
        if (effectAddresses.length === 0) {
            return;
        }
        effectAddresses.forEach((effectAddr) => {
            const effectChannelInstance = exports.allChannels.channels[`/${effectAddr}`];
            if (effectChannelInstance instanceof EffectChannel) {
                targetChannel.effectsChain.push(effectChannelInstance);
            }
            else {
                console.warn(`Channel /${effectAddr} is not an EffectChannel.`);
            }
        });
    }
    getGlobalBpm() {
        return tone_1.Transport.bpm.value;
    }
    setGlobalBpm(args) {
        const bpmString = args.map(String).join(""); // Ensure args are converted to string then joined
        const bpm = parseInt(bpmString, 10);
        if (!isNaN(bpm)) {
            tone_1.Transport.bpm.value = bpm;
        }
        else {
            console.error("Invalid BPM value:", args);
        }
        this.render(); // Re-render to show new BPM
    }
    handle(oscMsg) {
        console.log(`This is channel: ${this.address} handling the message: ${JSON.stringify(oscMsg)}`);
        const mainArgs = oscMsg.args[1]?.value; // use .value
        if (!mainArgs || mainArgs.length < 2) { // Need at least target channel and option group
            console.error("Invalid arguments for ControlChannel handle:", oscMsg);
            return;
        }
        const targetChannelAddress = `/${mainArgs[0]}`;
        const targetChannel = exports.allChannels.channels[targetChannelAddress];
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
                    this.setEffectsChainForChannel(targetChannel, params);
                    actionMessage = `effects: ${targetChannel.effectsChain.map(e => e.effectName).join(", ")}`;
                    break;
                case 1: // Volume
                    if (params.length > 0) {
                        targetChannel.setVolume(params[0]);
                        actionMessage = `volume: ${targetChannel.volume}dB`;
                    }
                    break;
                // InstrumentChannel specific
                case 2:
                    if (targetChannel instanceof InstrumentChannel && params.length > 0) {
                        targetChannel.setVoice(params[0]);
                        actionMessage = `voice: ${targetChannel.voiceName}`;
                    }
                    else if (targetChannel instanceof SynthChannel && params.length > 0) { // SynthChannel specific
                        targetChannel.setWaveformAndPartial(params[0], params[1]);
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
        }
        else if (targetChannel instanceof ControlChannel) { // Control another ControlChannel (e.g. this one for BPM)
            switch (optionGroup) {
                case 1: // BPM
                    targetChannel.setGlobalBpm(params); // Pass all remaining params for BPM
                    actionMessage = `bpm: ${targetChannel.getGlobalBpm()}`;
                    break;
                default:
                    console.log("Invalid option group for Control Channel:", optionGroup);
                    return;
            }
        }
        else if (targetChannel instanceof ReverbChannel) { // Specifically ReverbChannel
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
        }
        else if (targetChannel instanceof EffectChannel) { // Generic EffectChannel (if any other than Reverb)
            // Add handlers if there are generic EffectChannel params
            console.log("No specific control implemented for generic EffectChannel type via ControlChannel yet.");
            actionMessage = `params set for ${targetChannel.effectName}`;
        }
        if (actionMessage) { // Only render if an action was taken
            targetChannel.render();
            this.updateLastMessageDescriptionControl(targetChannel.address, actionMessage, oscMsg.args[0]?.value);
        }
        this.render();
    }
}
exports.allChannels = {
    channels: {
        "/0": new ControlChannel("/0"),
        "/1": new InstrumentChannel("/1", tone_1.Synth, "osc synth"),
        "/2": new SynthChannel("/2", "sine"), // Corrected cast
        "/3": new ReverbChannel("/3"),
    },
    async initialise() {
        console.log("Initialising channels with defaults.");
        for (const addr in this.channels) {
            if (this.channels.hasOwnProperty(addr)) {
                this.channels[addr].initialise();
            }
        }
        console.log("Fetching last control message for each channel and option group from backend.");
        try {
            const response = await fetch("/api/get-control-messages");
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Assuming the server sends back { controlMessages: OSCMessage[] }
            const data = await response.json();
            if (data.controlMessages && Array.isArray(data.controlMessages)) {
                data.controlMessages.forEach((oscMsg) => {
                    // Ensure oscMsg.address is valid and exists in allChannels.channels
                    const targetChannel = this.channels[oscMsg.address];
                    if (targetChannel) {
                        targetChannel.handle(oscMsg); // Let each channel handle its control message
                        const sender = oscMsg.args[0]?.value; // use .value
                        const messageContent = oscMsg.args[1]?.value; // use .value
                        (0, logging_1.updateInputMessageLog)(`${sender}: ${JSON.stringify(messageContent)} -> ${oscMsg.address}`);
                    }
                    else {
                        console.warn(`Received control message for unknown channel: ${oscMsg.address}`);
                    }
                });
            }
            else {
                console.error("Control messages data is not in expected format:", data);
            }
        }
        catch (error) {
            console.error("Failed to fetch or process control messages:", error);
        }
    },
};
//# sourceMappingURL=channels.js.map