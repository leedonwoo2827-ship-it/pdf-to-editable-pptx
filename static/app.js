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
            displayW: 1100,           // 에디터 캔버스 CSS 픽셀 너비
            displayH: 0,              // 에디터 캔버스 CSS 픽셀 높이 (이미지 로드 시 계산)
            blocks: [],               // [{text, x_pt, y_pt, w_pt, h_pt, score, _px:{x,y,w,h}}]
            pageWPt: 1,
            pageHPt: 1,
            selectedIdx: null,
            tool: 'rect',             // 'rect' or 'brush'
            drawing: null,            // 사각형 드래그 중인 영역
            brushPoints: [],          // 브러시 모드에서 현재 칠하는 점들
            pending: null,            // 드래그/브러시 종료 후 OCR 대기 영역
            pendingText: '',
            ocring: false,
            committing: false,
            saving: false,
            regenerating: false,
            dirty: false,
            _dragStart: null,
            movingBlock: null,        // 기존 박스 드래그 이동 상태 {idx, startX, startY, origX_pt, origY_pt, moved}
            pendingDrag: null,        // pending 박스 이동/리사이즈 {handle, startX, startY, origX, origY, origW, origH}
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
            // 부모 div에 명시적 높이를 주면 SVG의 inset-0/h-full이 안정적으로 동작
            // → 좌표 변환에서 SVG 실제 픽셀 높이와 viewBox 높이가 정확히 매칭됨
            const ratio = img.naturalHeight / Math.max(img.naturalWidth, 1);
            this.review.displayH = Math.round(this.review.displayW * ratio);
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

        // ----- Tool toggle (rect / brush) -----
        setReviewTool(name) {
            this.review.tool = name;
            this.review.drawing = null;
            this.review.brushPoints = [];
            this.review._dragStart = null;
        },

        // ----- 좌표 변환 -----
        _svgPoint(event) {
            // svg가 아닌 자식 element에서 발생한 mousedown도 이 함수로 처리되므로
            // currentTarget 대신 closest('svg')을 사용
            const svg = (event.currentTarget?.tagName === 'svg')
                ? event.currentTarget
                : event.target.closest('svg');
            if (!svg) return {x: 0, y: 0};
            const rect = svg.getBoundingClientRect();
            const W = this.review.bgWidth || 1;
            const H = this.review.bgHeight || 1;
            const x = (event.clientX - rect.left) * (W / rect.width);
            const y = (event.clientY - rect.top) * (H / rect.height);
            return {x, y};
        },

        // ----- Pending 박스 핸들 (이동·리사이즈) -----
        pendingHandlePositions() {
            const p = this.review.pending;
            if (!p) return [];
            // 핸들 크기는 viewBox 단위. bg 크기에 비례하여 잘 보이도록.
            const size = Math.max(14, Math.round((this.review.bgWidth || 1000) * 0.014));
            return [
                {name: 'nw', x: p.x,         y: p.y,         size, cursor: 'nwse-resize'},
                {name: 'ne', x: p.x + p.w,   y: p.y,         size, cursor: 'nesw-resize'},
                {name: 'sw', x: p.x,         y: p.y + p.h,   size, cursor: 'nesw-resize'},
                {name: 'se', x: p.x + p.w,   y: p.y + p.h,   size, cursor: 'nwse-resize'},
            ];
        },

        pendingHandleDown(handle, event) {
            event.stopPropagation();
            if (!this.review.pending) return;
            const p = this._svgPoint(event);
            this.review.pendingDrag = {
                handle,
                startX: p.x,
                startY: p.y,
                origX: this.review.pending.x,
                origY: this.review.pending.y,
                origW: this.review.pending.w,
                origH: this.review.pending.h,
            };
        },

        // ----- 기존 박스 드래그 이동 시작 -----
        blockMouseDown(idx, event) {
            event.stopPropagation();
            const p = this._svgPoint(event);
            this.review.movingBlock = {
                idx,
                startX: p.x,
                startY: p.y,
                origX_pt: this.review.blocks[idx].x_pt,
                origY_pt: this.review.blocks[idx].y_pt,
                moved: false,
            };
            this.review.selectedIdx = idx;
            this.review.pending = null;
        },

        // ----- SVG의 빈 영역에서 mousedown -----
        reviewMouseDown(event) {
            // 기존 박스(rect/text/g) 위에서 mousedown은 blockMouseDown이 먼저 잡음
            if (this.review.movingBlock) return;

            const p = this._svgPoint(event);
            this.review.selectedIdx = null;
            this.review.pending = null;

            if (this.review.tool === 'brush') {
                this.review.brushPoints = [p];
            } else {
                this.review._dragStart = p;
                this.review.drawing = {x: p.x, y: p.y, w: 0, h: 0};
            }
        },

        reviewMouseMove(event) {
            // 0) Pending 박스 이동/리사이즈 중
            const pd = this.review.pendingDrag;
            if (pd && this.review.pending) {
                const p = this._svgPoint(event);
                const dx = p.x - pd.startX;
                const dy = p.y - pd.startY;
                const minSize = 8;
                if (pd.handle === 'move') {
                    this.review.pending.x = pd.origX + dx;
                    this.review.pending.y = pd.origY + dy;
                } else if (pd.handle === 'nw') {
                    const nx = pd.origX + dx;
                    const ny = pd.origY + dy;
                    const nw = pd.origW - dx;
                    const nh = pd.origH - dy;
                    if (nw >= minSize) { this.review.pending.x = nx; this.review.pending.w = nw; }
                    if (nh >= minSize) { this.review.pending.y = ny; this.review.pending.h = nh; }
                } else if (pd.handle === 'ne') {
                    const ny = pd.origY + dy;
                    const nw = pd.origW + dx;
                    const nh = pd.origH - dy;
                    if (nw >= minSize) { this.review.pending.w = nw; }
                    if (nh >= minSize) { this.review.pending.y = ny; this.review.pending.h = nh; }
                } else if (pd.handle === 'sw') {
                    const nx = pd.origX + dx;
                    const nw = pd.origW - dx;
                    const nh = pd.origH + dy;
                    if (nw >= minSize) { this.review.pending.x = nx; this.review.pending.w = nw; }
                    if (nh >= minSize) { this.review.pending.h = nh; }
                } else if (pd.handle === 'se') {
                    const nw = pd.origW + dx;
                    const nh = pd.origH + dy;
                    if (nw >= minSize) { this.review.pending.w = nw; }
                    if (nh >= minSize) { this.review.pending.h = nh; }
                }
                return;
            }
            // 1) 기존 박스 이동 중
            const m = this.review.movingBlock;
            if (m) {
                const p = this._svgPoint(event);
                const dx = p.x - m.startX;
                const dy = p.y - m.startY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                    m.moved = true;
                    const sx_pt_per_px = this.review.pageWPt / (this.review.bgWidth || 1);
                    const sy_pt_per_px = this.review.pageHPt / (this.review.bgHeight || 1);
                    const sx_px_per_pt = (this.review.bgWidth || 1) / this.review.pageWPt;
                    const sy_px_per_pt = (this.review.bgHeight || 1) / this.review.pageHPt;
                    const block = this.review.blocks[m.idx];
                    block.x_pt = m.origX_pt + dx * sx_pt_per_px;
                    block.y_pt = m.origY_pt + dy * sy_pt_per_px;
                    block._px.x = block.x_pt * sx_px_per_pt;
                    block._px.y = block.y_pt * sy_px_per_pt;
                }
                return;
            }
            // 2) 브러시 칠하는 중
            if (this.review.brushPoints.length > 0) {
                const p = this._svgPoint(event);
                this.review.brushPoints.push(p);
                return;
            }
            // 3) 사각형 드래그 중
            if (this.review._dragStart) {
                const p = this._svgPoint(event);
                const s = this.review._dragStart;
                this.review.drawing = {
                    x: Math.min(s.x, p.x),
                    y: Math.min(s.y, p.y),
                    w: Math.abs(p.x - s.x),
                    h: Math.abs(p.y - s.y),
                };
            }
        },

        reviewMouseUp() {
            // 0) Pending 박스 이동/리사이즈 종료
            if (this.review.pendingDrag) {
                this.review.pendingDrag = null;
                return;
            }
            // 1) 기존 박스 이동 종료
            const m = this.review.movingBlock;
            if (m) {
                if (m.moved) this.review.dirty = true;
                this.review.movingBlock = null;
                return;
            }
            // 2) 브러시 종료 → 칠한 영역의 bounding box를 OCR 후보로
            if (this.review.brushPoints.length > 0) {
                const pts = this.review.brushPoints;
                this.review.brushPoints = [];
                if (pts.length < 2) return;
                const xs = pts.map(p => p.x);
                const ys = pts.map(p => p.y);
                const PAD = 12;
                const x = Math.max(0, Math.min(...xs) - PAD);
                const y = Math.max(0, Math.min(...ys) - PAD);
                const w = (Math.max(...xs) - Math.min(...xs)) + 2 * PAD;
                const h = (Math.max(...ys) - Math.min(...ys)) + 2 * PAD;
                if (w < 16 || h < 16) return;
                this.review.pending = {x, y, w, h};
                this.review.pendingText = '';
                return;
            }
            // 3) 사각형 종료
            if (this.review._dragStart) {
                const d = this.review.drawing;
                this.review._dragStart = null;
                this.review.drawing = null;
                if (!d || d.w < 8 || d.h < 8) return;
                this.review.pending = d;
                this.review.pendingText = '';
            }
        },

        cancelPending() {
            this.review.pending = null;
            this.review.pendingText = '';
        },

        // OCR만 실행 — 검출된 텍스트를 입력칸에 채워줌. 사용자가 검토 후
        // "블록으로 추가" 버튼으로 최종 commit하면 그제서야 inpaint + 저장.
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
                if (data.ok && data.block && data.block.text) {
                    this.review.pendingText = data.block.text;
                    this.showToast(`OCR 결과: "${data.block.text.slice(0, 30)}"`);
                } else {
                    this.showToast(data.message || 'OCR이 텍스트를 찾지 못했습니다. 직접 입력해주세요.');
                }
            } catch (e) {
                this.showToast('OCR 실패: ' + e.message);
            } finally {
                this.review.ocring = false;
            }
        },

        // 사용자가 입력한 텍스트로 블록을 commit. 서버에서 그 영역 inpaint
        // + 블록 저장이 함께 일어나고, 프론트엔드는 새 bg를 다시 받아 표시.
        async addPendingManual() {
            if (!this.review.pending) return;
            const text = (this.review.pendingText || '').trim();
            if (!text) {
                this.showToast('텍스트를 입력해주세요.');
                return;
            }
            this.review.committing = true;
            try {
                const W = this.review.bgWidth, H = this.review.bgHeight;
                const p = this.review.pending;
                const bbox_norm = [p.x / W, p.y / H, p.w / W, p.h / H];
                const r = await fetch(`/api/review/${this.job.job_id}/${this.review.currentPage}/commit-region`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({bbox_norm, text}),
                });
                const data = await r.json();
                if (!data.ok || !data.block) {
                    this.showToast(data.message || '추가 실패');
                    return;
                }
                this._appendBlock(data.block);
                // 서버가 bg를 inpaint해서 다시 저장했으므로 캐시 무효화하고 새로 로드
                this.review.bgUrl = `/api/review/${this.job.job_id}/${this.review.currentPage}/bg.png?t=${Date.now()}`;
                this.review.pending = null;
                this.review.pendingText = '';
                // commit-region은 이미 서버에 저장한 상태이므로 현재 페이지의 dirty는
                // 그대로 유지 (다른 박스 편집은 아직 미저장). 하지만 추가는 이미 반영.
                this.showToast('영역 추가됨 (배경 정리 완료)');
            } catch (e) {
                this.showToast('추가 실패: ' + e.message);
            } finally {
                this.review.committing = false;
            }
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
