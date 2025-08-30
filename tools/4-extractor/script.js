// Create a namespace for our tools to avoid global scope conflicts
window.SubTools = window.SubTools || {};

// Define the module for the Video Subtitle Extractor tool
window.SubTools.extractor = {
    // Module-level properties
    toolContainer: null,
    elements: {},
    ffmpeg: null,
    videoFile: null,
    subtitleTracks: [],

    // The init method is called by the main hub script to start the tool
    init: function(containerId) {
        this.toolContainer = document.getElementById(containerId);
        if (!this.toolContainer) {
            console.error(`Container with id "${containerId}" not found for Extractor tool.`);
            return;
        }

        // Scope all element queries to the tool's container
        this.elements = {
            videoInput: this.toolContainer.querySelector('#video-input'),
            statusText: this.toolContainer.querySelector('#status-text'),
            progressBar: this.toolContainer.querySelector('#progress-bar'),
            tracksContainer: this.toolContainer.querySelector('#tracks-container'),
            tracksList: this.toolContainer.querySelector('#tracks-list'),
            extractBtn: this.toolContainer.querySelector('#extract-btn'),
            outputFormatSelect: this.toolContainer.querySelector('#output-format'),
            previewBox: this.toolContainer.querySelector('#preview-box'),
            previewContent: this.toolContainer.querySelector('#preview-content')
        };
        
        // Initialize FFmpeg instance
        const { createFFmpeg, fetchFile } = FFmpeg;
        this.ffmpeg = createFFmpeg({
            log: true,
            corePath: 'assets/ffmpeg/ffmpeg-core.js',
        });
        
        // Bind event listeners
        this.elements.videoInput.addEventListener('change', this.handleFileSelect.bind(this));
        this.elements.extractBtn.addEventListener('click', this.handleExtract.bind(this));
        
        console.log('Extractor tool initialized.');
    },

    // The destroy method is called when switching to another tool
    destroy: function() {
        // Reset state and UI
        this.videoFile = null;
        this.subtitleTracks = [];
        this.resetUI();
        this.elements.videoInput.value = ''; // Clear file input
        // In a more complex app, you might terminate running ffmpeg processes if possible
        console.log('Extractor tool destroyed.');
    },
    
    // --- Core FFmpeg Functions ---

    handleFileSelect: async function(event) {
        this.videoFile = event.target.files[0];
        if (!this.videoFile) return;
        
        this.resetUI();
        this.elements.statusText.textContent = 'Preparing to scan... please wait.';

        if (!this.ffmpeg.isLoaded()) {
            await this.loadFFmpeg();
        }
        
        await this.scanForSubtitles();
    },

    loadFFmpeg: async function() {
        this.elements.statusText.textContent = 'Loading video processing engine (ffmpeg)... This may take a moment.';
        this.elements.progressBar.classList.remove('hidden');
        this.ffmpeg.setProgress(({ ratio }) => {
            this.elements.progressBar.value = ratio * 100;
        });
        await this.ffmpeg.load();
        this.elements.progressBar.classList.add('hidden');
    },

    scanForSubtitles: async function() {
        this.subtitleTracks = [];
        this.elements.statusText.textContent = 'Writing file to virtual memory...';
        this.ffmpeg.FS('writeFile', this.videoFile.name, await FFmpeg.fetchFile(this.videoFile));

        this.elements.statusText.textContent = 'Scanning for subtitle tracks...';
        
        let commandOutput = "";
        this.ffmpeg.setLogger(({ type, message }) => { if (type === 'fferr') commandOutput += message + '\n'; });

        try {
            await this.ffmpeg.run('-i', this.videoFile.name);
        } catch (e) { /* This error is expected; the output contains the stream info */ }
        finally {
            this.parseFFmpegOutput(commandOutput);
            this.displayTracks();
            this.ffmpeg.setLogger(() => {}); // Reset logger
        }
    },
    
    handleExtract: async function() {
        const selectedTracks = Array.from(this.toolContainer.querySelectorAll('input[name="subtitle-track"]:checked'));
        if (selectedTracks.length === 0) {
            alert('Please select at least one subtitle track to extract.');
            return;
        }

        this.elements.statusText.textContent = `Preparing to extract ${selectedTracks.length} track(s)...`;
        this.elements.progressBar.classList.remove('hidden');

        try {
            const filesToDownload = [];
            for (const trackInput of selectedTracks) {
                const trackIndex = trackInput.value;
                const originalFormat = trackInput.dataset.format;
                const outputFormat = this.elements.outputFormatSelect.value;

                const tempFilename = `output.${originalFormat}`;
                await this.ffmpeg.run('-i', this.videoFile.name, '-map', `0:${trackIndex}`, '-c', 'copy', tempFilename);
                const data = this.ffmpeg.FS('readFile', tempFilename);
                this.ffmpeg.FS('unlink', tempFilename);

                const fileContentStr = new TextDecoder().decode(data);
                
                let finalContent = fileContentStr;
                let finalFormat = outputFormat === 'original' ? originalFormat : outputFormat;

                if (outputFormat !== 'original' && outputFormat !== originalFormat) {
                    const parsedSubs = this.parseSubtitle(fileContentStr, originalFormat);
                    finalContent = this.buildSubtitle(parsedSubs, outputFormat);
                }
                
                const finalFileName = `${this.videoFile.name.split('.').slice(0, -1).join('.')}_${trackIndex}.${finalFormat}`;
                filesToDownload.push({ name: finalFileName, content: finalContent });
            }

            if (filesToDownload.length === 1) {
                this.triggerDownload(filesToDownload[0].content, filesToDownload[0].name);
            } else {
                const zip = new JSZip();
                filesToDownload.forEach(file => zip.file(file.name, file.content));
                const zipBlob = await zip.generateAsync({ type: "blob" });
                this.triggerDownload(zipBlob, 'subtitles.zip');
            }
            this.elements.statusText.textContent = `${filesToDownload.length} track(s) extracted successfully.`;

        } catch(e) {
            this.elements.statusText.textContent = 'An error occurred during extraction.';
            console.error(e);
        } finally {
            this.elements.progressBar.classList.add('hidden');
        }
    },

    handlePreview: async function(trackIndex, trackFormat) {
        this.elements.statusText.textContent = `Generating preview for track ${trackIndex}...`;
        this.elements.previewBox.classList.remove('hidden');
        this.elements.previewContent.textContent = 'Processing...';
        
        try {
            const tempFilename = `preview.${trackFormat}`;
            await this.ffmpeg.run('-i', this.videoFile.name, '-map', `0:${trackIndex}`, '-c', 'copy', tempFilename);
            const data = this.ffmpeg.FS('readFile', tempFilename);
            this.ffmpeg.FS('unlink', tempFilename);

            const fileContentStr = new TextDecoder().decode(data);
            const parsedSubs = this.parseSubtitle(fileContentStr, trackFormat);
            const previewText = parsedSubs.slice(0, 5).map(sub => sub.text).join('\n---\n');
            this.elements.previewContent.textContent = previewText || '(No text content found for preview)';
            this.elements.statusText.textContent = 'Preview is ready.';
        } catch (e) {
            this.elements.previewContent.textContent = 'Error generating preview.';
            console.error(e);
        }
    },

    // --- UI and Helper Functions ---
    
    parseFFmpegOutput: function(output) {
        const streamRegex = /Stream #0:(\d+).*?Subtitle: (\w+)(?:.*?Language: (\w+))?/g;
        let match;
        while ((match = streamRegex.exec(output)) !== null) {
            let format = match[2].toLowerCase();
            if (format === 'subrip') format = 'srt';
            this.subtitleTracks.push({
                index: match[1],
                format: format,
                language: match[3] || 'Unknown'
            });
        }
    },

    displayTracks: function() {
        if (this.subtitleTracks.length > 0) {
            this.elements.statusText.textContent = `${this.subtitleTracks.length} subtitle track(s) found. Please make a selection.`;
            this.elements.tracksList.innerHTML = '';
            this.subtitleTracks.forEach(track => {
                const div = document.createElement('div');
                div.className = 'track-item';
                div.innerHTML = `
                    <div class="track-item-info">
                        <input type="checkbox" name="subtitle-track" value="${track.index}" data-format="${track.format}">
                        <label>Track ${track.index} - Language: ${track.language} (Format: ${track.format.toUpperCase()})</label>
                    </div>
                    <button class="preview-btn" data-index="${track.index}" data-format="${track.format}">Preview</button>
                `;
                this.elements.tracksList.appendChild(div);
            });
            this.toolContainer.querySelectorAll('.preview-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.handlePreview(e.target.dataset.index, e.target.dataset.format);
                });
            });
            this.elements.tracksContainer.classList.remove('hidden');
            this.elements.extractBtn.disabled = false;
        } else {
            this.elements.statusText.textContent = 'No embedded subtitle tracks were found in this video.';
        }
    },
    
    resetUI: function() {
        this.elements.tracksContainer.classList.add('hidden');
        this.elements.previewBox.classList.add('hidden');
        this.elements.tracksList.innerHTML = '';
        this.elements.extractBtn.disabled = true;
        this.elements.progressBar.classList.add('hidden');
        this.elements.statusText.textContent = 'Select a video file (MKV, MP4) to begin.';
    },

    // --- Parser & Builder Functions ---

    parseSubtitle: function(content, format) {
        if (format === 'srt') return this.parseSrt(content);
        if (format === 'vtt') return this.parseVtt(content);
        if (format === 'ass') return this.parseAss(content);
        throw new Error(`Parsing for format "${format}" is not supported.`);
    },

    buildSubtitle: function(subtitles, format) {
        if (format === 'srt') return this.buildSrt(subtitles);
        if (format === 'vtt') return this.buildVtt(subtitles);
        throw new Error(`Building format "${format}" is not supported.`);
    },

    parseSrt: function(data) {
        return data.trim().replace(/\r/g, '').split('\n\n').map(block => {
            const lines = block.split('\n');
            if (lines.length >= 2 && lines[1]?.includes('-->')) {
                const [startTime, endTime] = lines[1].split(' --> ');
                return { startTime, endTime, text: lines.slice(2).join('\n') };
            }
            return null;
        }).filter(Boolean);
    },

    parseVtt: function(data) {
        const blocks = data.trim().replace(/\r/g, '').split('\n\n');
        const startIndex = blocks[0].toUpperCase().startsWith('WEBVTT') ? 1 : 0;
        return blocks.slice(startIndex).map(block => {
            const lines = block.split('\n');
            const timeLineIndex = lines.findIndex(line => line.includes('-->'));
            if (timeLineIndex !== -1) {
                const [startTime, endTime] = lines[timeLineIndex].split(' --> ');
                return { startTime: startTime.trim(), endTime: endTime.trim(), text: lines.slice(timeLineIndex + 1).join('\n') };
            }
            return null;
        }).filter(Boolean);
    },
    
    parseAss: function(data) {
        const subs = [];
        const lines = data.trim().split(/\r?\n/);
        const eventLines = lines.filter(line => line.startsWith('Dialogue:'));
        for (const line of eventLines) {
            const parts = line.split(',');
            if (parts.length >= 10) {
                const text = parts.slice(9).join(',').replace(/{.*?}/g, '').replace(/\\N/g, '\n');
                subs.push({
                    startTime: this.formatAssTime(parts[1]),
                    endTime: this.formatAssTime(parts[2]),
                    text: text
                });
            }
        }
        return subs;
    },

    buildSrt: function(subtitles) {
        return subtitles.map((sub, index) => {
            const startTime = sub.startTime.replace('.', ',');
            const endTime = sub.endTime.replace('.', ',');
            return `${index + 1}\n${startTime} --> ${endTime}\n${sub.text}`;
        }).join('\n\n') + '\n\n';
    },
    
    buildVtt: function(subtitles) {
        const content = subtitles.map(sub => `${sub.startTime} --> ${sub.endTime}\n${sub.text}`).join('\n\n');
        return "WEBVTT\n\n" + content + '\n\n';
    },

    formatAssTime: function(time) { // Converts H:MM:SS.ss to HH:MM:SS.sss
        const [h, m, s_cs] = time.split(':');
        const [s, cs] = s_cs.split('.');
        return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}.${(cs || '0').padEnd(3, '0')}`;
    },
    
    triggerDownload: function(content, fileName) {
        const blob = (typeof content === 'string') ? new Blob([content], { type: 'text/plain;charset=utf-8' }) : content;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    }
};
