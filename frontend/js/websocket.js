// ============================================================
// VoteSphere — WebSocket client with auto-reconnect
// Handles live result updates from API Gateway WebSocket API
// ============================================================

class LiveSocket {
  /**
   * @param {(msg:any)=>void} onMessage   Called with each parsed JSON message
   * @param {(status:string)=>void} onStatus  Called with 'connecting'|'connected'|'disconnected'
   */
  constructor(onMessage, onStatus) {
    this.ws = null;
    this.pollId = null;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.retry = 0;
    this.timer = null;
    this.manualClose = false;
  }

  connect(pollId) {
    this.pollId = pollId;
    this.manualClose = false;
    this._open();
  }

  _open() {
    if (!this.pollId) return;
    this.onStatus && this.onStatus('connecting');

    const url = CONFIG.WS_URL.replace(/\/$/, '');

    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.onStatus && this.onStatus('disconnected');
      return this._scheduleReconnect();
    }

    this.ws.onopen = () => {
      this.retry = 0;
      this.onStatus && this.onStatus('connected');
      // Ask the server to subscribe this connection to the given poll
      try {
        this.ws.send(JSON.stringify({ action: 'subscribe', poll_id: this.pollId }));
      } catch (_) {}
    };

    this.ws.onmessage = (ev) => {
      let data = null;
      try {
        data = JSON.parse(ev.data);
      } catch (_) {
        return;
      }
      this.onMessage && this.onMessage(data);
    };

    this.ws.onclose = () => {
      this.onStatus && this.onStatus('disconnected');
      if (!this.manualClose) this._scheduleReconnect();
    };

    this.ws.onerror = () => {
      try { this.ws.close(); } catch (_) {}
    };
  }

  _scheduleReconnect() {
    clearTimeout(this.timer);
    // Exponential backoff: 1s, 2s, 4s, 8s, 15s max
    const delay = Math.min(1000 * Math.pow(2, this.retry), 15000);
    this.retry++;
    this.timer = setTimeout(() => this._open(), delay);
  }

  disconnect() {
    this.manualClose = true;
    clearTimeout(this.timer);
    this.pollId = null;
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
      this.ws = null;
    }
  }
}