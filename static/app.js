function app() {
    return {
        job: null,           // {job_id, page_count, filename}
        pages: [],           // PageStatus[]
        overall_state: 'idle',
        outputReady: false,
        dpi: 200,
        dilation: 15,
        toast: '',
        _pollTimer: null,

        async init() {
            // Nothing to load on init — fully local now
        },

        // ----- Computed -----
        get running()  { return this.overall_state === 'running'; },
        get complete() { return this.overall_state === 'complete'; },
        get failed()   { return this.overall_state === 'failed'; },
        get cancelled(){ return this.overall_state === 'cancelled'; },
        get doneCount() { return this.pages.filter(p => p.state === 'done').length; },
        get errorCount(){ return this.pages.filter(p => p.state === 'error').length; },
        get overallPercent() {
            if (!this.job) return 0;
            const total = this.job.page_count || 1;
            const finished = this.pages.filter(p => p.state === 'done' || p.state === 'error').length;
            return Math.min(100, Math.round((finished / total) * 100));
        },
        get currentMessage() {
            const inFlight = this.pages.find(p =>
                p.state === 'rendering' || p.state === 'ocr' || p.state === 'inpainting'
            );
            if (inFlight) {
                return `Page ${inFlight.index + 1}: ${inFlight.state}…`;
            }
            return 'Working…';
        },

        // ----- Helpers -----
        thumbUrl(idx) {
            if (!this.job) return '';
            return `/api/page/${this.job.job_id}/${idx}.png`;
        },
        stateIcon(state) {
            return ({
                queued: '⏳',
                rendering: '🔄',
                ocr: '🔄',
                inpainting: '🔄',
                done: '✅',
                warning: '⚠️',
                error: '❌',
            })[state] || '⏳';
        },
        stateLabel(ps) {
            switch (ps.state) {
                case 'done':
                    return `${ps.text_block_count} text blocks · ${ps.elapsed_s}s`;
                case 'rendering': return 'Rendering page…';
                case 'ocr':       return 'Detecting text…';
                case 'inpainting':return 'Removing text from background…';
                case 'error':     return ps.message || 'Failed';
                case 'warning':   return ps.message || 'Warning';
                default:          return 'Queued';
            }
        },
        estimateTime() {
            if (!this.job) return '';
            const perPage = this.dpi >= 250 ? 80 : this.dpi >= 200 ? 50 : this.dpi >= 150 ? 30 : 20;
            const total = this.job.page_count * perPage;
            if (total < 60) return `~${total}s`;
            const m = Math.round(total / 60);
            return `~${m} min`;
        },
        showToast(msg, ms = 3000) {
            this.toast = msg;
            setTimeout(() => { if (this.toast === msg) this.toast = ''; }, ms);
        },

        // ----- Upload -----
        async onUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            this.showToast('Uploading…');
            try {
                const r = await fetch('/api/upload', { method: 'POST', body: formData });
                if (!r.ok) {
                    const err = await r.json().catch(() => ({}));
                    throw new Error(err.detail || `Upload failed (${r.status})`);
                }
                const data = await r.json();
                this.job = data;
                this.pages = Array.from({ length: data.page_count }, (_, i) => ({
                    index: i, state: 'queued', text_block_count: 0, elapsed_s: 0, message: ''
                }));
                this.overall_state = 'idle';
                this.outputReady = false;
                this.showToast(`${data.page_count} pages loaded.`);
            } catch (e) {
                this.showToast('Error: ' + e.message);
            }
        },

        reset() {
            this.stopPolling();
            this.job = null;
            this.pages = [];
            this.overall_state = 'idle';
            this.outputReady = false;
        },

        // ----- Process / status -----
        async startProcess() {
            if (!this.job) return;
            try {
                const r = await fetch(`/api/process/${this.job.job_id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dpi: this.dpi, dilation: this.dilation }),
                });
                if (!r.ok) {
                    const err = await r.json().catch(() => ({}));
                    throw new Error(err.detail || 'Failed to start');
                }
                const status = await r.json();
                this.applyStatus(status);
                this.startPolling();
                this.showToast('Conversion started…');
            } catch (e) {
                this.showToast('Error: ' + e.message);
            }
        },

        async cancelProcess() {
            if (!this.job) return;
            try {
                await fetch(`/api/cancel/${this.job.job_id}`, { method: 'POST' });
                this.showToast('Cancelling…');
            } catch (_) {}
        },

        applyStatus(status) {
            if (!status) return;
            this.pages = status.pages || [];
            this.overall_state = status.overall_state;
            this.outputReady = status.output_ready;
            if (status.error) this.errorMessage = status.error;
        },

        startPolling() {
            this.stopPolling();
            const tick = async () => {
                if (!this.job) return;
                try {
                    const r = await fetch(`/api/status/${this.job.job_id}`);
                    if (r.ok) {
                        const status = await r.json();
                        this.applyStatus(status);
                        if (
                            status.overall_state === 'complete'
                            || status.overall_state === 'failed'
                            || status.overall_state === 'cancelled'
                        ) {
                            this.stopPolling();
                            if (status.overall_state === 'complete') {
                                this.showToast('Done. Click Download.');
                            } else if (status.overall_state === 'cancelled') {
                                this.showToast('Cancelled.');
                            } else {
                                this.showToast('Failed: ' + (status.error || 'unknown'));
                            }
                            return;
                        }
                    }
                } catch (_) {}
                this._pollTimer = setTimeout(tick, 1500);
            };
            this._pollTimer = setTimeout(tick, 800);
        },
        stopPolling() {
            if (this._pollTimer) {
                clearTimeout(this._pollTimer);
                this._pollTimer = null;
            }
        },
    };
}
