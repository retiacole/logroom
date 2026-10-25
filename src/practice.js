/* Offline practice variants and portable log archives. No host shell or network. */
(function (root) {
  'use strict';
  const normalizeAnswer = value => String(value).normalize('NFKC').trim().replace(/[。、，,]+$/u, '').trim().replace(/\s+/g, ' ').toLowerCase();
  function seedOffset(seed) {
    let hash = 2166136261;
    for (const character of String(seed)) hash = Math.imul(hash ^ character.codePointAt(0), 16777619) >>> 0;
    return hash;
  }
  function variantCases(cases, {seed = '', advanced = false} = {}) {
    // Map the addresses used by this dataset to distinct three-digit octets.
    // Equal-width octets also keep common literal-IP grep exercises unambiguous.
    const ips = new Map(), pattern = /\b(192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)(\d{1,3})\b/g;
    if (seed) {
      const source = JSON.stringify(cases) + ' 192.0.2.200';
      for (const prefix of ['192.0.2.', '198.51.100.', '203.0.113.']) {
        const used = [...new Set([...source.matchAll(pattern)].filter(m => m[1] === prefix && +m[2] > 0 && +m[2] < 255).map(m => +m[2]))].sort((a, b) => a - b);
        const pool = Array.from({length:155}, (_, i) => i + 100);
        let random = seedOffset(seed + ':' + prefix);
        for (let i = pool.length - 1; i > 0; i--) {random = (Math.imul(random,1664525) + 1013904223) >>> 0; const j = random % (i + 1); [pool[i],pool[j]] = [pool[j],pool[i]];}
        if (used.length > pool.length) throw new Error('Too many addresses for this practice variant');
        used.forEach((suffix, i) => ips.set(prefix + suffix, prefix + pool[i]));
      }
    }
    function copy(value, key) {
      if (typeof value === 'string') return seed && key !== 'url' ? value.replace(pattern, match => ips.get(match) || match) : value;
      if (Array.isArray(value)) return value.map(item => copy(item, key));
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, copy(item, name)]));
      return value;
    }
    const result = copy(cases);
    if (advanced) {
      const ssh = result.find(c => c.id === 'ssh');
      if (ssh) {
        // 20,000 short keepalive records keep the file below the virtual 2 MiB limit.
        // A different previous day remains in auth.log.1; it is not an exact baseline.
        const noise = Array.from({length: 20000}, (_, i) => {
          const seconds = 9 * 3600 + (i * 17 + i % 11) % 1561;
          const time = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
          return `Aug 12 ${time} edge-01 sshd[${10000 + i}]: Connection closed by 192.0.2.200 port ${32000 + i} [preauth]`;
        }).map(line => copy(line));
        for (const files of [ssh.files, ssh.baselineFiles]) {
          files['/var/log/auth.log'] = [...files['/var/log/auth.log'].trimEnd().split('\n'), ...noise].sort((a, b) => a.slice(0, 15).localeCompare(b.slice(0, 15))).join('\n') + '\n';
        }
        for (const task of ssh.tasks) for (const evidence of task.evidence || []) evidence.line = ssh.files[evidence.path].split('\n').indexOf(evidence.quote) + 1;
      }
    }
    return result;
  }
  function timeline(caseData) {
    if (caseData.id !== 'ssh') return null;
    const ip = caseData.tasks.find(task => task.id === 'source').answer;
    const address = new RegExp('(?:^|[^0-9.])' + ip.replace(/\./g, '\\.') + '(?:$|[^0-9.])');
    const lines = caseData.files['/var/log/auth.log'].trimEnd().split('\n').filter(line => address.test(line));
    lines.sort((a, b) => a.slice(0, 15).localeCompare(b.slice(0, 15)) || (a < b ? -1 : a > b ? 1 : 0));
    return {path: '/home/analyst/timeline.txt', ip, text: lines.join('\n') + '\n'};
  }
  function checkTimeline(caseData, files) {
    const expected = timeline(caseData);
    if (!expected || typeof files[expected.path] !== 'string') return false;
    const actual = files[expected.path].replace(/\r\n/g, '\n');
    // Exact canonical evidence prevents an empty, partial, duplicate, or invented timeline from passing.
    return actual.replace(/\n$/, '') === expected.text.replace(/\n$/, '');
  }
  const encode = value => new TextEncoder().encode(value);
  async function logArchive(files, caseId, metadata = () => ({})) {
    const parts = [];
    const entries = Object.entries(files).filter(([path, text]) => typeof text === 'string' && /^\/(?:var\/log|home\/analyst|etc)\//.test(path));
    entries.push(['/HOWTO.txt', 'Logroom synthetic training logs\n\nExtract this archive into a NEW working directory, then cd logroom-' + caseId + '.\nUse relative paths: grep "Failed password" var/log/auth.log\nCompressed history is real gzip: zgrep "Failed password" var/log/auth.log.2.gz\nDo not extract or copy these synthetic files into your real /var/log.\nCheck home/analyst/README.txt for the date, timezone and log formats.\nArchive timestamps are exercise metadata, not proof of event times.\n']);
    for (const [path, text] of entries) {
      const name = 'logroom-' + caseId + '/' + path.slice(1);
      if (name.split('/').some(part => part === '..') || encode(name).length > 100) throw new Error('Archive path is too long or invalid: ' + path);
      const meta = metadata(path) || {};
      let data = encode(text);
      if ((meta.compressed ?? path.endsWith('.gz'))) {
        if (typeof CompressionStream === 'undefined') throw new Error('This browser needs CompressionStream to export gzip logs.');
        data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
      }
      const header = new Uint8Array(512);
      const put = (at, length, value) => header.set(encode(value).slice(0, length), at);
      const octal = (at, length, value) => put(at, length, Math.max(0, Math.floor(value)).toString(8).padStart(length - 1, '0') + '\0');
      put(0, 100, name); octal(100, 8, typeof meta.mode === 'number' ? meta.mode : 0o644);
      octal(108, 8, 1000); octal(116, 8, 1000); octal(124, 12, data.length);
      const mtime = typeof meta.mtime === 'number' ? meta.mtime : Date.parse(meta.mtime);
      octal(136, 12, Number.isFinite(mtime) ? mtime / 1000 : Date.UTC(2026, 7, 12) / 1000);
      put(148, 8, '        '); put(156, 1, '0'); put(257, 6, 'ustar\0'); put(263, 2, '00');
      put(265, 32, meta.owner || 'analyst'); put(297, 32, meta.group || 'analyst');
      put(148, 8, header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0') + '\0 ');
      parts.push(header, data, new Uint8Array((512 - data.length % 512) % 512));
    }
    parts.push(new Uint8Array(1024));
    return new Blob(parts, {type: 'application/x-tar'});
  }
  root.LogroomPractice = Object.freeze({normalizeAnswer, variantCases, timeline, checkTimeline, logArchive});
})(globalThis);
