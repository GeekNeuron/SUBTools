document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const videoInput = document.getElementById('video-input');
    const statusText = document.getElementById('status-text');
    const progressBar = document.getElementById('progress-bar');
    const tracksContainer = document.getElementById('tracks-container');
    const tracksList = document.getElementById('tracks-list');
    const extractBtn = document.getElementById('extract-btn');
    const outputFormatSelect = document.getElementById('output-format');
    const previewBox = document.getElementById('preview-box');
    const previewContent = document.getElementById('preview-content');

    // FFmpeg setup
    const { createFFmpeg, fetchFile } = FFmpeg;
    const ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
    });

    let videoFile = null;
    let subtitleTracks = [];

    // --- Event Listeners ---
    videoInput.addEventListener('change', handleFileSelect);
    extractBtn.addEventListener('click', handleExtract);

    async function handleFileSelect(event) {
        videoFile = event.target.files[0];
        if (!videoFile) return;
        
        resetUI();
        statusText.textContent = 'Preparing to scan... please wait.';

        if (!ffmpeg.isLoaded()) {
            await loadFFmpeg();
        }
        
        await scanForSubtitles();
    }
    
    // --- Core FFmpeg Functions ---

    async function loadFFmpeg() {
        statusText.textContent = 'Loading video processing engine (ffmpeg)... This may take a moment.';
        progressBar.classList.remove('hidden');
        ffmpeg.setProgress(({ ratio }) => {
            progressBar.value = ratio * 100;
        });
        await ffmpeg.load();
        progressBar.classList.add('hidden');
    }

    async function scanForSubtitles() {
        subtitleTracks = [];
        statusText.textContent = 'Writing file to virtual memory...';
        ffmpeg.FS('writeFile', videoFile.name, await fetchFile(videoFile));

        statusText.textContent = 'Scanning for subtitle tracks...';
        
        let commandOutput = "";
        ffmpeg.setLogger(({ type, message }) => { if (type === 'fferr') commandOutput += message + '\n'; });

        try {
            // This command is expected to fail. The error output contains the file info.
            await ffmpeg.run('-i', videoFile.name);
        } catch (e) {
            // We parse the output from the expected error
        } finally {
            parseFFmpegOutput(commandOutput);
            displayTracks();
            ffmpeg.setLogger(() => {}); // Reset logger
        }
    }
    
    async function handleExtract() {
        const selectedTracks = Array.from(document.querySelectorAll('input[name="subtitle-track"]:checked'));
        if (selectedTracks.length === 0) {
            alert('Please select at least one subtitle track to extract.');
            return;
        }

        statusText.textContent = `Preparing to extract ${selectedTracks.length} track(s)...`;
        progressBar.classList.remove('hidden');

        try {
            const filesToDownload = [];
            for (const trackInput of selectedTracks) {
                const trackIndex = trackInput.value;
                const originalFormat = trackInput.dataset.format;
                const outputFormat = outputFormatSelect.value;
                
                // 1. Extract the raw track file
                const tempFilename = `output.${originalFormat}`;
                await ffmpeg.run('-i', videoFile.name, '-map', `0:${trackIndex}`, '-c', 'copy', tempFilename);
                const data = ffmpeg.FS('readFile', tempFilename);
                ffmpeg.FS('unlink', tempFilename); // Clean up virtual file

                const fileContentStr = new TextDecoder().decode(data);
                
                // 2. Convert if a different format is requested
                let finalContent = fileContentStr;
                let finalFormat = outputFormat === 'original' ? originalFormat : outputFormat;

                if (outputFormat !== 'original' && outputFormat !== originalFormat) {
                    const parsedSubs = parseSubtitle(fileContentStr, originalFormat);
                    finalContent = buildSubtitle(parsedSubs, outputFormat);
                }
                
                const finalFileName = `${videoFile.name.split('.').slice(0, -1).join('.')}_${trackIndex}.${finalFormat}`;
                filesToDownload.push({ name: finalFileName, content: finalContent });
            }

            // 3. Download as single file or ZIP
            if (filesToDownload.length === 1) {
                triggerDownload(filesToDownload[0].content, filesToDownload[0].name);
            } else {
                const zip = new JSZip();
                filesToDownload.forEach(file => zip.file(file.name, file.content));
                const zipBlob = await zip.generateAsync({ type: "blob" });
                triggerDownload(zipBlob, 'subtitles.zip');
            }
            statusText.textContent = `${filesToDownload.length} track(s) extracted successfully.`;

        } catch(e) {
            statusText.textContent = 'An error occurred during extraction.';
            console.error(e);
        } finally {
            progressBar.classList.add('hidden');
        }
    }

    async function handlePreview(trackIndex, trackFormat) {
        statusText.textContent = `Generating preview for track ${trackIndex}...`;
        previewBox.classList.remove('hidden');
        previewContent.textContent = 'Processing...';
        
        try {
            const tempFilename = `preview.${trackFormat}`;
            await ffmpeg.run('-i', videoFile.name, '-map', `0:${trackIndex}`, '-c', 'copy', tempFilename);
            const data = ffmpeg.FS('readFile', tempFilename);
            ffmpeg.FS('unlink', tempFilename);

            const fileContentStr = new TextDecoder().decode(data);
            const parsedSubs = parseSubtitle(fileContentStr, trackFormat);

            const previewText = parsedSubs.slice(0, 5).map(sub => sub.text).join('\n---\n');
            previewContent.textContent = previewText || '(No text content found for preview)';
            statusText.textContent = 'Preview is ready.';
        } catch (e) {
            previewContent.textContent = 'Error generating preview.';
            console.error(e);
        }
    }

    // --- UI and Helper Functions ---
    
    function parseFFmpegOutput(output) {
        const streamRegex = /Stream #0:(\d+).*?Subtitle: (\w+)(?:.*?Language: (\w+))?/g;
        let match;
        while ((match = streamRegex.exec(output)) !== null) {
            let format = match[2].toLowerCase();
            if (format === 'subrip') format = 'srt'; // Standardize format names
            
            subtitleTracks.push({
                index: match[1],
                format: format,
                language: match[3] || 'Unknown'
            });
        }
    }

    function displayTracks() {
        if (subtitleTracks.length > 0) {
            statusText.textContent = `${subtitleTracks.length} subtitle track(s) found. Please make a selection.`;
            tracksList.innerHTML = '';
            subtitleTracks.forEach(track => {
                const div = document.createElement('div');
                div.className = 'track-item';
                div.innerHTML = `
                    <div class="track-item-info">
                        <input type="checkbox" name="subtitle-track" value="${track.index}" data-format="${track.format}">
                        <label>Track ${track.index} - Language: ${track.language} (Format: ${track.format.toUpperCase()})</label>
                    </div>
                    <button class="preview-btn" data-index="${track.index}" data-format="${track.format}">Preview</button>
                `;
                tracksList.appendChild(div);
            });
            document.querySelectorAll('.preview-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    handlePreview(e.target.dataset.index, e.target.dataset.format);
                });
            });
            tracksContainer.classList.remove('hidden');
            extractBtn.disabled = false;
        } else {
            statusText.textContent = 'No embedded subtitle tracks were found in this video.';
        }
    }
    
    function resetUI() {
        tracksContainer.classList.add('hidden');
        previewBox.classList.add('hidden');
        tracksList.innerHTML = '';
        extractBtn.disabled = true;
        progressBar.classList.add('hidden');
    }
    
    // --- Parser & Builder Functions ---

    function parseSubtitle(content, format) {
        if (format === 'srt') return parseSrt(content);
        if (format === 'vtt') return parseVtt(content);
        if (format === 'ass') return parseAss(content);
        throw new Error(`Parsing for format "${format}" is not supported.`);
    }

    function buildSubtitle(subtitles, format) {
        if (format === 'srt') return buildSrt(subtitles);
        if (format === 'vtt') return buildVtt(subtitles);
        throw new Error(`Building format "${format}" is not supported.`);
    }

    function parseSrt(data) {
        return data.trim().replace(/\r/g, '').split('\n\n').map(block => {
            const lines = block.split('\n');
            if (lines.length >= 2 && lines[1]?.includes('-->')) {
                const [startTime, endTime] = lines[1].split(' --> ');
                return { startTime, endTime, text: lines.slice(2).join('\n') };
            }
            return null;
        }).filter(Boolean);
    }

    function parseVtt(data) {
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
    }
    
    function parseAss(data) {
        const subs = [];
        const lines = data.trim().split(/\r?\n/);
        const eventLines = lines.filter(line => line.startsWith('Dialogue:'));
        for (const line of eventLines) {
            const parts = line.split(',');
            if (parts.length >= 10) {
                const text = parts.slice(9).join(',').replace(/{.*?}/g, '').replace(/\\N/g, '\n');
                subs.push({
                    startTime: formatAssTime(parts[1]),
                    endTime: formatAssTime(parts[2]),
                    text: text
                });
            }
        }
        return subs;
    }

    function buildSrt(subtitles) {
        return subtitles.map((sub, index) => {
            const startTime = sub.startTime.replace('.', ',');
            const endTime = sub.endTime.replace('.', ',');
            return `${index + 1}\n${startTime} --> ${endTime}\n${sub.text}`;
        }).join('\n\n') + '\n\n';
    }
    
    function buildVtt(subtitles) {
        const content = subtitles.map(sub => `${sub.startTime} --> ${sub.endTime}\n${sub.text}`).join('\n\n');
        return "WEBVTT\n\n" + content + '\n\n';
    }

    function formatAssTime(time) { // Converts H:MM:SS.ss to HH:MM:SS.sss
        const [h, m, s_cs] = time.split(':');
        const [s, cs] = s_cs.split('.');
        return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}.${(cs || '0').padEnd(3, '0')}`;
    }
    
    function triggerDownload(content, fileName) {
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
});
