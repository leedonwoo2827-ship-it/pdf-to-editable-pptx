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

        // ----- Review mode -----
        review: {
            active: false,
            currentPage: 0,
            bgUrl: '',
            bgWidth: 0,
            bgHeight: 0,
            displayW: 1100,           // CSS pixel width for the editor canvas
            blocks: [],               // [{text, x_pt, y_pt, w_pt, h_pt, score, _px:{x,y,w,h}}]
            pageWPt: 1,
            pageHPt: 1,
            selectedIdx: null,
            drawing: null,            // {x, y, w, h} in image-pixel units while dragging
            pending: null,            // {x, y, w, h} after drag finishes
            pendingText: '',
            ocring: false,
            saving: false,
            regenerating: false,
            dirty: false,
            _dragStart: null,
        },

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

        // =================== REVIEW MODE ===================

        async enterReview() {
            if (!this.job) return;
            this.review.active = true;
            this.review.currentPage = 0;
            await this.loadReviewPage(0);
        },

        exitReview() {
            this.review.active = false;
            this.review.selectedIdx = null;
            this.review.pending = null;
            this.review.drawing = null;
            this.review.dirty = false;
        },

        async reviewNext() {
            if (!this.job) return;
            if (this.review.currentPage >= this.job.page_count - 1) return;
            if (this.review.dirty) await this.saveCurrentPage();
            await this.loadReviewPage(this.review.currentPage + 1);
        },

        async reviewPrev() {
            if (!this.job) return;
            if (this.review.currentPage <= 0) return;
            if (this.review.dirty) await this.saveCurrentPage();
            await this.loadReviewPage(this.review.currentPage - 1);
        },

        async loadReviewPage(idx) {
            this.review.currentPage = idx;
            this.review.selectedIdx = null;
            this.review.pending = null;
            this.review.pendingText = '';
            this.review.drawing = null;
            this.review.dirty = false;
            this.review.bgUrl = `/api/review/${this.job.job_id}/${idx}/bg.png?t=${Date.now()}`;
            try {
                const r = await fetch(`/api/review/${this.job.job_id}/${idx}/state`);
                if (!r.ok) throw new Error(`state ${r.status}`);
                const data = await r.json();
                this.review.pageWPt = data.page_w_pt;
                this.review.pageHPt = data.page_h_pt;
                this.review.blocks = (data.blocks || []).map(b => ({...b, _px: {x: 0, y: 0, w: 0, h: 0}}));
                // Pixel positions are filled in once the image actually loads
                // (we don't know bg image pixel size until then).
            } catch (e) {
                this.showToast('Could not load page state: ' + e.message);
            }
        },

        onReviewBgLoaded(event) {
            const img = event.target;
            this.review.bgWidth = img.naturalWidth;
            this.review.bgHeight = img.naturalHeight;
            this._recomputeBlockPixels();
        },

        _recomputeBlockPixels() {
            const W = this.review.bgWidth, H = this.review.bgHeight;
            const wPt = this.review.pageWPt, hPt = this.review.pageHPt;
            if (!W || !wPt) return;
            const sx = W / wPt, sy = H / hPt;
            this.review.blocks.forEach(b => {
                b._px = {
                    x: b.x_pt * sx,
                    y: b.y_pt * sy,
                    w: b.w_pt * sx,
                    h: b.h_pt * sy,
                };
            });
        },

        // ----- Selection / edit / delete -----
        selectBlock(idx) {
            this.review.selectedIdx = idx;
            this.review.pending = null;
        },

        deleteSelected() {
            if (this.review.selectedIdx === null) return;
            this.review.blocks.splice(this.review.selectedIdx, 1);
            this.review.selectedIdx = null;
            this.review.dirty = true;
        },

        // ----- Drag-to-draw new region -----
        _svgPoint(event) {
            const svg = event.currentTarget;
            const rect = svg.getBoundingClientRect();
            const W = this.review.bgWidth || 1;
            const H = this.review.bgHeight || 1;
            const x = (event.clientX - rect.left) * (W / rect.width);
            const y = (event.clientY - rect.top) * (H / rect.height);
            return {x, y};
        },

        reviewMouseDown(event) {
            if (event.target.tagName === 'rect' || event.target.tagName === 'text') {
                // clicking an existing block — let the @click on <g> handle it
                return;
            }
            const p = this._svgPoint(event);
            this.review._dragStart = p;
            this.review.drawing = {x: p.x, y: p.y, w: 0, h: 0};
            this.review.pending = null;
            this.review.selectedIdx = null;
        },

        reviewMouseMove(event) {
            if (!this.review._dragStart) return;
            const p = this._svgPoint(event);
            const s = this.review._dragStart;
            this.review.drawing = {
                x: Math.min(s.x, p.x),
                y: Math.min(s.y, p.y),
                w: Math.abs(p.x - s.x),
                h: Math.abs(p.y - s.y),
            };
        },

        reviewMouseUp() {
            if (!this.review._dragStart) return;
            const d = this.review.drawing;
            this.review._dragStart = null;
            this.review.drawing = null;
            if (!d || d.w < 8 || d.h < 8) return;  // ignore tiny drags
            this.review.pending = d;
            this.review.pendingText = '';
        },

        cancelPending() {
            this.review.pending = null;
            this.review.pendingText = '';
        },

        async ocrPending() {
            if (!this.review.pending) return;
            this.review.ocring = true;
            try {
                const W = this.review.bgWidth, H = this.review.bgHeight;
                const p = this.review.pending;
                const bbox_norm = [p.x / W, p.y / H, p.w / W, p.h / H];
                const r = await fetch(`/api/review/${this.job.job_id}/${this.review.currentPage}/ocr-region`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({bbox_norm}),
                });
                const data = await r.json();
                if (!data.ok || !data.block) {
                    this.showToast(data.message || 'No text detected');
                    return;
                }
                this._appendBlock(data.block);
                this.review.pending = null;
                this.review.pendingText = '';
                this.review.dirty = true;
                this.showToast(`Added: "${data.block.text.slice(0, 24)}"`);
            } catch (e) {
                this.showToast('OCR failed: ' + e.message);
            } finally {
                this.review.ocring = false;
            }
        },

        addPendingManual() {
            if (!this.review.pending || !this.review.pendingText.trim()) return;
            const W = this.review.bgWidth, H = this.review.bgHeight;
            const wPt = this.review.pageWPt, hPt = this.review.pageHPt;
            const sx = wPt / W, sy = hPt / H;
            const p = this.review.pending;
            this._appendBlock({
                text: this.review.pendingText.trim(),
                x_pt: p.x * sx,
                y_pt: p.y * sy,
                w_pt: p.w * sx,
                h_pt: p.h * sy,
                score: 0.99,
            });
            this.review.pending = null;
            this.review.pendingText = '';
            this.review.dirty = true;
        },

        _appendBlock(block) {
            const W = this.review.bgWidth, H = this.review.bgHeight;
            const wPt = this.review.pageWPt || 1, hPt = this.review.pageHPt || 1;
            const sx = W / wPt, sy = H / hPt;
            block._px = {
                x: block.x_pt * sx,
                y: block.y_pt * sy,
                w: block.w_pt * sx,
                h: block.h_pt * sy,
            };
            this.review.blocks.push(block);
            this.review.selectedIdx = this.review.blocks.length - 1;
        },

        // ----- Save / regenerate -----
        async saveCurrentPage() {
            if (!this.review.dirty) return;
            this.review.saving = true;
            try {
                const blocks = this.review.blocks.map(b => ({
                    text: b.text,
                    x_pt: b.x_pt,
                    y_pt: b.y_pt,
                    w_pt: b.w_pt,
                    h_pt: b.h_pt,
                    score: b.score ?? 0.9,
                }));
                const r = await fetch(`/api/review/${this.job.job_id}/${this.review.currentPage}/blocks`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({blocks}),
                });
                if (!r.ok) {
                    const err = await r.json().catch(() => ({}));
                    throw new Error(err.detail || `save failed (${r.status})`);
                }
                this.review.dirty = false;
                this.showToast('Page saved.');
            } catch (e) {
                this.showToast('Save error: ' + e.message);
            } finally {
                this.review.saving = false;
            }
        },

        async regenerateAndDownload() {
            if (!this.job) return;
            if (this.review.dirty) await this.saveCurrentPage();
            this.review.regenerating = true;
            try {
                const r = await fetch(`/api/review/${this.job.job_id}/regenerate`, {method: 'POST'});
                if (!r.ok) {
                    const err = await r.json().catch(() => ({}));
                    throw new Error(err.detail || `regenerate failed (${r.status})`);
                }
                // Trigger download
                window.location = `/api/result/${this.job.job_id}`;
                this.showToast('Re-exported. Download starting…');
            } catch (e) {
                this.showToast('Re-export error: ' + e.message);
            } finally {
                this.review.regenerating = false;
            }
        },
    };
}
