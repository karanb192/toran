export function canRecord(canvas) {
  return typeof canvas.captureStream === 'function' && typeof window.MediaRecorder === 'function';
}

function pickType() {
  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

export function recordClip(canvas, audioStream, ms) {
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(30);
    if (audioStream) for (const track of audioStream.getAudioTracks()) stream.addTrack(track);
    const type = pickType();
    const rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 4e6 } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getVideoTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: rec.mimeType || type || 'video/webm' }));
    };
    rec.onerror = (e) => reject(e.error || e);
    rec.start(250);
    setTimeout(() => rec.state !== 'inactive' && rec.stop(), ms);
  });
}
