export class AudioManager {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private inputProcessor: ScriptProcessorNode | null = null;
  private outputProcessor: ScriptProcessorNode | null = null;
  private playQueue: Float32Array[] = [];
  private _onAudioData: ((data: ArrayBuffer) => void) | null = null;
  private _started = false;

  get onAudioData() {
    return this._onAudioData;
  }

  set onAudioData(cb: ((data: ArrayBuffer) => void) | null) {
    this._onAudioData = cb;
  }

  async start(): Promise<void> {
    if (this._started) return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
    });

    this.ctx = new AudioContext({ sampleRate: 16000 });
    const source = this.ctx.createMediaStreamSource(this.stream);

    this.inputProcessor = this.ctx.createScriptProcessor(4096, 1, 1);
    source.connect(this.inputProcessor);
    this.inputProcessor.connect(this.ctx.destination);
    this.inputProcessor.onaudioprocess = (e) => {
      if (!this._onAudioData) return;
      const input = e.inputBuffer.getChannelData(0);
      const int16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
      }
      this._onAudioData(int16.buffer);
    };

    this.outputProcessor = this.ctx.createScriptProcessor(4096, 0, 1);
    this.outputProcessor.connect(this.ctx.destination);
    this.outputProcessor.onaudioprocess = (e) => {
      const out = e.outputBuffer.getChannelData(0);
      if (this.playQueue.length > 0) {
        const chunk = this.playQueue.shift()!;
        const len = Math.min(chunk.length, out.length);
        out.set(chunk.subarray(0, len));
      }
    };

    this._started = true;
  }

  enqueuePlayback(pcm: Float32Array) {
    this.playQueue.push(pcm);
    if (this.playQueue.length > 30) {
      this.playQueue.splice(0, this.playQueue.length - 30);
    }
  }

  stop() {
    this._started = false;
    this._onAudioData = null;
    this.playQueue = [];

    if (this.inputProcessor) {
      this.inputProcessor.disconnect();
      this.inputProcessor = null;
    }
    if (this.outputProcessor) {
      this.outputProcessor.disconnect();
      this.outputProcessor = null;
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
}
