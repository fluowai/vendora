const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._playQueue = [];
    this.port.onmessage = (e) => {
      if (e.data.type === 'audiooutput') {
        this._playQueue.push(new Float32Array(e.data.data));
        if (this._playQueue.length > 30) {
          this._playQueue.splice(0, this._playQueue.length - 30);
        }
      }
    };
  }

  process(inputs, outputs, _parameters) {
    const input = inputs[0];
    if (input && input.length > 0 && input[0].length > 0) {
      const data = new Float32Array(input[0]);
      this.port.postMessage({ type: 'audioinput', data: data.buffer }, [data.buffer]);
    }

    const output = outputs[0];
    if (output && output.length > 0) {
      if (this._playQueue.length > 0) {
        const chunk = this._playQueue.shift();
        const len = Math.min(chunk.length, output[0].length);
        output[0].set(chunk.subarray(0, len));
      }
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`.trim();

let workletUrl: string | null = null;

function float32ToInt16LE(input: Float32Array): ArrayBuffer {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  return output.buffer;
}

function getWorkletUrl(): string {
  if (!workletUrl) {
    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
    workletUrl = URL.createObjectURL(blob);
  }
  return workletUrl;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private fallbackInput: ScriptProcessorNode | null = null;
  private fallbackOutput: ScriptProcessorNode | null = null;
  private _onAudioData: ((data: ArrayBuffer) => void) | null = null;
  private playQueue: Float32Array[] = [];
  private _started = false;
  private _useWorklet = true;

  get onAudioData() {
    return this._onAudioData;
  }

  set onAudioData(cb: ((data: ArrayBuffer) => void) | null) {
    this._onAudioData = cb;
  }

  private setupFallback(source: MediaStreamAudioSourceNode) {
    this.fallbackInput = this.ctx!.createScriptProcessor(4096, 1, 1);
    source.connect(this.fallbackInput);
    this.fallbackInput.connect(this.ctx!.destination);
    this.fallbackInput.onaudioprocess = (e) => {
      if (!this._onAudioData) return;
      const input = e.inputBuffer.getChannelData(0);
      const int16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
      }
      this._onAudioData(int16.buffer);
    };

    this.fallbackOutput = this.ctx!.createScriptProcessor(4096, 0, 1);
    this.fallbackOutput.connect(this.ctx!.destination);
    this.fallbackOutput.onaudioprocess = (e) => {
      const out = e.outputBuffer.getChannelData(0);
      if (this.playQueue.length > 0) {
        const chunk = this.playQueue.shift()!;
        const len = Math.min(chunk.length, out.length);
        out.set(chunk.subarray(0, len));
      }
    };
  }

  async start(): Promise<void> {
    if (this._started) return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
    });

    this.ctx = new AudioContext({ sampleRate: 16000 });
    const source = this.ctx.createMediaStreamSource(this.stream);

    if (this._useWorklet && this.ctx.audioWorklet) {
      try {
        const url = getWorkletUrl();
        await this.ctx.audioWorklet.addModule(url);
        this.workletNode = new AudioWorkletNode(this.ctx, 'pcm-processor');
        source.connect(this.workletNode);
        this.workletNode.connect(this.ctx.destination);

        this.workletNode.port.onmessage = (e) => {
          if (e.data.type === 'audioinput' && this._onAudioData) {
            this._onAudioData(float32ToInt16LE(new Float32Array(e.data.data)));
          }
        };
      } catch {
        this._useWorklet = false;
        this.setupFallback(source);
      }
    } else {
      this.setupFallback(source);
    }

    this._started = true;
  }

  enqueuePlayback(pcm: Float32Array) {
    if (this.workletNode) {
      const copy = new Float32Array(pcm);
      try {
        this.workletNode.port.postMessage({ type: 'audiooutput', data: copy.buffer }, [copy.buffer]);
      } catch {
        this.playQueue.push(pcm);
        if (this.playQueue.length > 30) {
          this.playQueue.splice(0, this.playQueue.length - 30);
        }
      }
    } else {
      this.playQueue.push(pcm);
      if (this.playQueue.length > 30) {
        this.playQueue.splice(0, this.playQueue.length - 30);
      }
    }
  }

  stop() {
    this._started = false;
    this._onAudioData = null;
    this.playQueue = [];

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.fallbackInput) {
      this.fallbackInput.disconnect();
      this.fallbackInput = null;
    }
    if (this.fallbackOutput) {
      this.fallbackOutput.disconnect();
      this.fallbackOutput = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  static cleanupUrl() {
    if (workletUrl) {
      URL.revokeObjectURL(workletUrl);
      workletUrl = null;
    }
  }
}
