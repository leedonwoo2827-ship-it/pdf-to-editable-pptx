function app() {
    return {
        job: null,           // {job_id, page_count, filename}
        pages: [],           // PageStatus[]
        overall_state: 'idle',
        outputReady: false,
        dpi: 200,
        dilation: 15,
        removeWatermark: false,
        toast: '',
        _pollTimer: null,

        // ----- Review mode -----
        review: {
            active: false,
            currentPage: 0,
            bgUrl: '',
            bgWidth: 0,
            bgHeight: 0,
            displayW: 1100,           // 에디터 캔버스 기본 CSS 픽셀 너비
            displayH: 0,              // 에디터 캔버스 기본 CSS 픽셀 높이 (이미지 로드 시 계산)
            zoom: 1.0,                // 사용자 줌 배율 (0.5 ~ 3.0). 캔버스 표시 크기에만 영향, viewBox는 그대로
            blocks: [],               // [{text, x_pt, y_pt, w_pt, h_pt, score, _px:{x,y,w,h}}]
            pageWPt: 1,
            pageHPt: 1,
            selectedIdx: null,
            tool: 'none',             // 'none' (캔버스 클릭으로는 박스 생성 X) or 'brush'
            drawing: null,            // 사각형 드래그 중인 영역
            brushPoints: [],          // 브러시 모드에서 현재 칠하는 점들
            // pendings: 사용자가 그렸지만 아직 commit하지 않은 새 영역들. 여러 개 동시에 둘 수 있음.
            // 각 항목: {id, x, y, w, h, text}
            pendings: [],
            activePendingId: null,    // 사이드 패널에 펼쳐 보일 항목 id (handles도 이 항목에만 표시)
            _pendingIdSeq: 0,
            ocring: false,
            committing: false,
            saving: false,
            regenerating: false,
            dirty: false,
            _dragStart: null,
            movingBlock: null,        // 기존 박스 드래그 이동 상태 {idx, startX, startY, origX_pt, origY_pt, moved}
            pendingDrag: null,        // pending 박스 이동/리사이즈 {pending, handle, startX, startY, origX, origY, origW, origH}
            resizingBlock: null,      // 기존 박스 코너 리사이즈 {idx, handle, startX, startY, origX_pt, origY_pt, origW_pt, origH_pt}
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
        // Average seconds per finished page. 0 until at least one page completes.
        get avgPageSeconds() {
            const done = this.pages.filter(p => p.state === 'done' && p.elapsed_s > 0);
            if (done.length === 0) return 0;
            const total = done.reduce((acc, p) => acc + (p.elapsed_s || 0), 0);
            return total / done.length;
        },
        // Sum of elapsed_s across finished pages. Approximates "total
        // conversion time" when pages run sequentially (which they do
        // in the current pipeline).
        get totalElapsedSeconds() {
            return this.pages.reduce((acc, p) => acc + (p.elapsed_s || 0), 0);
        },
        // Estimated seconds remaining = average * (queued + in-flight).
        get etaSeconds() {
            if (!this.job) return 0;
            if (this.avgPageSeconds === 0) return 0;
            const remaining = this.pages.filter(
                p => p.state !== 'done' && p.state !== 'error'
            ).length;
            return Math.round(this.avgPageSeconds * remaining);
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
            // Rough CPU-mode estimates (seconds/page). GPU mode is ~10x faster
            // — the elapsed counter in the running view tells the truth.
            const perPage = this.dpi >= 300 ? 90 : this.dpi >= 250 ? 70 : 50;
            const total = this.job.page_count * perPage;
            if (total < 60) return `~${total}s`;
            const m = Math.round(total / 60);
            return `~${m} min`;
        },
        showToast(msg, ms = 3000) {
            this.toast = msg;
            setTimeout(() => { if (this.toast === msg) this.toast = ''; }, ms);
        },
        // Format seconds as "Xs" (<60), "Xm Ys" (<3600), or "Xh Ym".
        // Returns "—" for 0/missing values so the summary doesn't show
        // a misleading "0s" before the first page completes.
        formatSeconds(s) {
            if (!s || s <= 0) return '—';
            const total = Math.round(s);
            if (total < 60) return `${total}s`;
            const m = Math.floor(total / 60);
            const sec = total % 60;
            if (m < 60) return sec === 0 ? `${m}m` : `${m}m ${sec}s`;
            const h = Math.floor(m / 60);
            const mm = m % 60;
            return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
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
                    body: JSON.stringify({
                        dpi: this.dpi,
                        dilation: this.dilation,
                        remove_watermark: this.removeWatermark,
                    }),
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
            this.review.pendings = [];
            this.review.activePendingId = null;
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
            this.review.pendings = [];
            this.review.activePendingId = null;
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
            this.review.activePendingId = null;
        },

        // ----- Pending helpers (multi) -----
        _appendPending(box) {
            const id = ++this.review._pendingIdSeq;
            const pending = {id, x: box.x, y: box.y, w: box.w, h: box.h, text: ''};
            // Alpine reactivity: 배열 참조 자체를 갈아끼워서 x-for 재렌더를 강제.
            // push()도 Alpine 3에서 추적되지만, SVG 안의 nested template 조합에서
            // 가끔 재렌더가 누락되는 케이스를 봤으므로 안전한 패턴으로.
            this.review.pendings = [...this.review.pendings, pending];
            this.review.activePendingId = id;
            return pending;
        },
        getPending(id) {
            return this.review.pendings.find(p => p.id === id) || null;
        },
        getActivePending() {
            return this.getPending(this.review.activePendingId);
        },
        setActivePending(id) {
            this.review.activePendingId = id;
            this.review.selectedIdx = null;
        },
        removePending(id) {
            this.review.pendings = this.review.pendings.filter(p => p.id !== id);
            if (this.review.activePendingId === id) {
                const list = this.review.pendings;
                this.review.activePendingId = list.length > 0 ? list[list.length - 1].id : null;
            }
        },

        deleteSelected() {
            if (this.review.selectedIdx === null) return;
            this.review.blocks.splice(this.review.selectedIdx, 1);
            this.review.selectedIdx = null;
            this.review.dirty = true;
        },

        // ----- Tool toggle (brush only) -----
        setReviewTool(name) {
            // 같은 도구를 다시 누르면 토글 해제 → 'none' (안전 모드).
            this.review.tool = (this.review.tool === name) ? 'none' : name;
            this.review.drawing = null;
            this.review.brushPoints = [];
            this.review._dragStart = null;
        },

        // ----- 박스 추가 (액션 버튼) -----
        // 캔버스 정중앙에 기본 크기 pending 하나 생성 + active로.
        // 사용자가 직접 캔버스를 클릭할 필요 없이 버튼으로만 생성하므로 실수가 줄어듦.
        createCenterPending() {
            const W = this.review.bgWidth || 1000;
            const H = this.review.bgHeight || 1000;
            const defaultW = Math.max(220, W * 0.15);
            const defaultH = Math.max(56, H * 0.05);
            const x = (W - defaultW) / 2;
            const y = (H - defaultH) / 2;
            this._appendPending({x, y, w: defaultW, h: defaultH});
            // 도구는 brush가 아닌 상태로 유지 — 캔버스 클릭은 생성 트리거 X.
            this.review.tool = 'none';
        },

        // 모든 pending 일괄 제거 (실수로 쌓인 빈 박스 정리용).
        clearAllPendings() {
            this.review.pendings = [];
            this.review.activePendingId = null;
        },

        // ----- Canvas zoom (캔버스 부분만 확대, 우측 패널/툴바는 그대로) -----
        reviewZoomIn() {
            this.review.zoom = Math.min(4.0, +(this.review.zoom * 1.25).toFixed(2));
        },
        reviewZoomOut() {
            this.review.zoom = Math.max(0.5, +(this.review.zoom / 1.25).toFixed(2));
        },
        reviewZoomReset() {
            this.review.zoom = 1.0;
        },

        // SVG 안에 pending 박스/라벨/핸들을 직접 createElementNS로 그린다.
        // Alpine x-for 가 SVG namespace 안에서 가끔 재렌더를 누락하는 이슈를
        // 우회하기 위함 — index.html의 <g x-ref="pendingsGroup"> 가 빈 컨테이너이고,
        // pendings/activePendingId 변경 시 $watch 가 이 함수를 호출한다.
        renderPendingsSVG() {
            const g = this.$refs && this.$refs.pendingsGroup;
            if (!g) return;
            const SVG_NS = 'http://www.w3.org/2000/svg';
            // 기존 자식들 제거.
            while (g.firstChild) g.removeChild(g.firstChild);

            // 1) 각 pending: rect + label
            this.review.pendings.forEach((p, idx) => {
                const isActive = this.review.activePendingId === p.id;
                const rect = document.createElementNS(SVG_NS, 'rect');
                rect.setAttribute('x', p.x);
                rect.setAttribute('y', p.y);
                rect.setAttribute('width', p.w);
                rect.setAttribute('height', p.h);
                rect.setAttribute('fill', isActive ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.18)');
                rect.setAttribute('stroke', isActive ? '#b45309' : '#d97706');
                rect.setAttribute('stroke-width', isActive ? 5 : 4);
                rect.setAttribute('class', 'cursor-move');
                rect.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.pendingHandleDown(p.id, 'move', e);
                });
                g.appendChild(rect);

                const text = document.createElementNS(SVG_NS, 'text');
                text.setAttribute('x', p.x + 8);
                text.setAttribute('y', p.y + 22);
                text.setAttribute('font-size', '16');
                text.setAttribute('font-weight', 'bold');
                text.setAttribute('font-family', 'sans-serif');
                text.setAttribute('fill', '#7c2d12');
                text.setAttribute('pointer-events', 'none');
                const preview = (p.text || '').slice(0, 28) || '(빈 박스)';
                text.textContent = `${idx + 1}. ${preview}`;
                g.appendChild(text);
            });

            // 2) active pending 의 4개 코너 핸들
            if (this.review.activePendingId !== null) {
                const handles = this.pendingHandlePositions(this.review.activePendingId);
                handles.forEach(h => {
                    const handle = document.createElementNS(SVG_NS, 'rect');
                    handle.setAttribute('x', h.x - h.size / 2);
                    handle.setAttribute('y', h.y - h.size / 2);
                    handle.setAttribute('width', h.size);
                    handle.setAttribute('height', h.size);
                    handle.setAttribute('fill', '#b45309');
                    handle.setAttribute('stroke', 'white');
                    handle.setAttribute('stroke-width', '2');
                    handle.setAttribute('class', `cursor-${h.cursor}`);
                    handle.addEventListener('mousedown', (e) => {
                        e.stopPropagation();
                        this.pendingHandleDown(this.review.activePendingId, h.name, e);
                    });
                    g.appendChild(handle);
                });
            }
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
        pendingHandlePositions(id) {
            const p = this.getPending(id);
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

        pendingHandleDown(id, handle, event) {
            event.stopPropagation();
            const target = this.getPending(id);
            if (!target) return;
            // 핸들 클릭 시 그 pending 을 active로 지정 — 다른 pending에서 핸들을 잡으면 바로 거기로 포커스 이동.
            this.review.activePendingId = id;
            this.review.selectedIdx = null;
            const p = this._svgPoint(event);
            this.review.pendingDrag = {
                pending: target,
                handle,
                startX: p.x,
                startY: p.y,
                origX: target.x,
                origY: target.y,
                origW: target.w,
                origH: target.h,
            };
        },

        // ----- 기존 박스 코너 리사이즈 핸들 -----
        blockHandlePositions(idx) {
            const b = this.review.blocks[idx];
            if (!b || !b._px) return [];
            const size = Math.max(14, Math.round((this.review.bgWidth || 1000) * 0.014));
            return [
                {name: 'nw', x: b._px.x,            y: b._px.y,            size, cursor: 'nwse-resize'},
                {name: 'ne', x: b._px.x + b._px.w,  y: b._px.y,            size, cursor: 'nesw-resize'},
                {name: 'sw', x: b._px.x,            y: b._px.y + b._px.h,  size, cursor: 'nesw-resize'},
                {name: 'se', x: b._px.x + b._px.w,  y: b._px.y + b._px.h,  size, cursor: 'nwse-resize'},
            ];
        },

        blockHandleDown(idx, handle, event) {
            event.stopPropagation();
            const p = this._svgPoint(event);
            const b = this.review.blocks[idx];
            this.review.resizingBlock = {
                idx,
                handle,
                startX: p.x,
                startY: p.y,
                origX_pt: b.x_pt,
                origY_pt: b.y_pt,
                origW_pt: b.w_pt,
                origH_pt: b.h_pt,
            };
            this.review.selectedIdx = idx;
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
            this.review.activePendingId = null;
        },

        // ----- SVG의 빈 영역에서 mousedown -----
        // 캔버스 빈 영역 클릭으로는 박스를 생성하지 않음 (실수 방지).
        // brush 도구가 활성화된 상태에서만 색칠 시작.
        // 박스 추가는 우측의 "+ 박스 추가" 버튼으로만 가능 → createCenterPending().
        reviewMouseDown(event) {
            if (this.review.movingBlock) return;
            this.review.selectedIdx = null;
            if (this.review.tool === 'brush') {
                const p = this._svgPoint(event);
                this.review.brushPoints = [p];
            }
        },

        reviewMouseMove(event) {
            // -1) 기존 박스 코너 리사이즈 중
            const rb = this.review.resizingBlock;
            if (rb) {
                const p = this._svgPoint(event);
                const dx_px = p.x - rb.startX;
                const dy_px = p.y - rb.startY;
                const sx_pt_per_px = this.review.pageWPt / (this.review.bgWidth || 1);
                const sy_pt_per_px = this.review.pageHPt / (this.review.bgHeight || 1);
                const dx_pt = dx_px * sx_pt_per_px;
                const dy_pt = dy_px * sy_pt_per_px;
                const minPt = 4;
                const block = this.review.blocks[rb.idx];
                if (rb.handle === 'nw') {
                    const nx = rb.origX_pt + dx_pt;
                    const ny = rb.origY_pt + dy_pt;
                    const nw = rb.origW_pt - dx_pt;
                    const nh = rb.origH_pt - dy_pt;
                    if (nw >= minPt) { block.x_pt = nx; block.w_pt = nw; }
                    if (nh >= minPt) { block.y_pt = ny; block.h_pt = nh; }
                } else if (rb.handle === 'ne') {
                    const ny = rb.origY_pt + dy_pt;
                    const nw = rb.origW_pt + dx_pt;
                    const nh = rb.origH_pt - dy_pt;
                    if (nw >= minPt) { block.w_pt = nw; }
                    if (nh >= minPt) { block.y_pt = ny; block.h_pt = nh; }
                } else if (rb.handle === 'sw') {
                    const nx = rb.origX_pt + dx_pt;
                    const nw = rb.origW_pt - dx_pt;
                    const nh = rb.origH_pt + dy_pt;
                    if (nw >= minPt) { block.x_pt = nx; block.w_pt = nw; }
                    if (nh >= minPt) { block.h_pt = nh; }
                } else if (rb.handle === 'se') {
                    const nw = rb.origW_pt + dx_pt;
                    const nh = rb.origH_pt + dy_pt;
                    if (nw >= minPt) { block.w_pt = nw; }
                    if (nh >= minPt) { block.h_pt = nh; }
                }
                const sx_px_per_pt = (this.review.bgWidth || 1) / this.review.pageWPt;
                const sy_px_per_pt = (this.review.bgHeight || 1) / this.review.pageHPt;
                block._px = {
                    x: block.x_pt * sx_px_per_pt,
                    y: block.y_pt * sy_px_per_pt,
                    w: block.w_pt * sx_px_per_pt,
                    h: block.h_pt * sy_px_per_pt,
                };
                return;
            }
            // 0) Pending 박스 이동/리사이즈 중
            const pd = this.review.pendingDrag;
            if (pd && pd.pending) {
                const target = pd.pending;
                const p = this._svgPoint(event);
                const dx = p.x - pd.startX;
                const dy = p.y - pd.startY;
                const minSize = 8;
                if (pd.handle === 'move') {
                    target.x = pd.origX + dx;
                    target.y = pd.origY + dy;
                } else if (pd.handle === 'nw') {
                    const nx = pd.origX + dx;
                    const ny = pd.origY + dy;
                    const nw = pd.origW - dx;
                    const nh = pd.origH - dy;
                    if (nw >= minSize) { target.x = nx; target.w = nw; }
                    if (nh >= minSize) { target.y = ny; target.h = nh; }
                } else if (pd.handle === 'ne') {
                    const ny = pd.origY + dy;
                    const nw = pd.origW + dx;
                    const nh = pd.origH - dy;
                    if (nw >= minSize) { target.w = nw; }
                    if (nh >= minSize) { target.y = ny; target.h = nh; }
                } else if (pd.handle === 'sw') {
                    const nx = pd.origX + dx;
                    const nw = pd.origW - dx;
                    const nh = pd.origH + dy;
                    if (nw >= minSize) { target.x = nx; target.w = nw; }
                    if (nh >= minSize) { target.h = nh; }
                } else if (pd.handle === 'se') {
                    const nw = pd.origW + dx;
                    const nh = pd.origH + dy;
                    if (nw >= minSize) { target.w = nw; }
                    if (nh >= minSize) { target.h = nh; }
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
            // 3) 사각형 도구는 mousedown 시점에 박스 + drag를 동시에 시작하고
            // 그 drag는 위쪽 0)분기 (pendingDrag) 가 처리하므로 여기엔 분기 불필요.
        },

        reviewMouseUp() {
            // -1) 기존 박스 리사이즈 종료
            if (this.review.resizingBlock) {
                this.review.dirty = true;
                this.review.resizingBlock = null;
                return;
            }
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
            // 2) 브러시 종료 → 칠한 영역의 bounding box를 새 pending으로
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
                this._appendPending({x, y, w, h});
                return;
            }
            // 3) 사각형 도구는 mousedown에서 즉시 박스 생성 + drag 시작이라
            // mouseup에서 추가로 할 일이 없음. pendingDrag가 위에서 이미 정리됨.
        },

        cancelPending(id) {
            this.removePending(id);
        },

        // OCR만 실행 — 검출된 텍스트를 해당 pending의 text 칸에 채워줌. 사용자가 검토 후
        // "블록으로 추가" 버튼으로 최종 commit하면 그제서야 inpaint + 저장.
        async ocrPending(id) {
            const target = this.getPending(id);
            if (!target) return;
            this.review.ocring = true;
            try {
                const W = this.review.bgWidth, H = this.review.bgHeight;
                const bbox_norm = [target.x / W, target.y / H, target.w / W, target.h / H];
                const r = await fetch(`/api/review/${this.job.job_id}/${this.review.currentPage}/ocr-region`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({bbox_norm}),
                });
                const data = await r.json();
                if (data.ok && data.block && data.block.text) {
                    target.text = data.block.text;
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
        async addPendingManual(id) {
            const target = this.getPending(id);
            if (!target) return;
            const text = (target.text || '').trim();
            if (!text) {
                this.showToast('텍스트를 입력해주세요.');
                return;
            }
            this.review.committing = true;
            try {
                const W = this.review.bgWidth, H = this.review.bgHeight;
                const bbox_norm = [target.x / W, target.y / H, target.w / W, target.h / H];
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
                this.removePending(id);
                this.showToast('영역 추가됨 (배경 정리 완료)');
            } catch (e) {
                this.showToast('추가 실패: ' + e.message);
            } finally {
                this.review.committing = false;
            }
        },

        // 모든 pending을 차례대로 commit. 서버 inpainting이 직렬로 일어나므로
        // pending 1개당 LaMa forward 1번이 필요하다.
        async addAllPendings() {
            // text 비어있는 pending은 commit 스킵 (사용자가 채워야 함)
            const ids = this.review.pendings
                .filter(p => (p.text || '').trim().length > 0)
                .map(p => p.id);
            if (ids.length === 0) {
                this.showToast('텍스트를 채운 박스가 없습니다.');
                return;
            }
            for (const id of ids) {
                await this.addPendingManual(id);
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
