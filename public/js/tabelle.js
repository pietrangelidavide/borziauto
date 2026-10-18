/* AutoProfit · lettura e scrittura di CSV ed Excel (.xlsx) nel browser.
   Usa solo JSZip (vendor/jszip.min.js). I file .xls vecchi non sono supportati: da Excel "Salva con nome" → .xlsx o .csv. */
(function () {
  const TG = window.TG || (window.TG = {});
  const T = (TG.tab = {});

  /* ---------- CSV ---------- */
  T.parseCSV = (text) => {
    text = String(text).replace(/^﻿/, "");
    // separatore: quello più frequente nella prima riga fuori dalle virgolette
    const first = text.split(/\r?\n/)[0] || "";
    let best = ";", bestN = -1;
    [";", ",", "\t"].forEach((d) => { let n = 0, q = false; for (const ch of first) { if (ch === '"') q = !q; else if (!q && ch === d) n++; } if (n > bestN) { bestN = n; best = d; } });
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === best) { row.push(cur); cur = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; rows.push(row); row = []; }
      else cur += ch;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return trim(rows);
  };
  T.toCSV = (rows) => rows.map((r) => r.map((v) => {
    v = v == null ? "" : String(v);
    return /[;"\r\n]/.test(v) || /^\s|\s$/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }).join(";")).join("\r\n") + "\r\n";
  const trim = (rows) => {
    while (rows.length && rows[rows.length - 1].every((c) => String(c).trim() === "")) rows.pop();
    return rows;
  };

  /* ---------- date di Excel ---------- */
  const serialToISO = (n) => new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000).toISOString().slice(0, 10);
  T.isoToSerial = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    return m ? Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000) : null;
  };
  T.serialToISO = serialToISO;

  /* ---------- lettura di un file ---------- */
  T.leggi = async (file) => {
    const buf = await file.arrayBuffer();
    const nome = (file.name || "").toLowerCase();
    const zip = new Uint8Array(buf, 0, 2);
    if (zip[0] === 0x50 && zip[1] === 0x4b) return readXLSX(buf);              // "PK": è un .xlsx
    if (/\.xls$/.test(nome) || (zip[0] === 0xd0 && zip[1] === 0xcf)) throw new Error("Il formato .xls (Excel vecchio) non è supportato: in Excel scegli File → Salva con nome → «Cartella di lavoro di Excel (.xlsx)» oppure «CSV».");
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch (e) { text = new TextDecoder("windows-1252").decode(buf); }
    return { sheets: [{ name: file.name.replace(/\.[^.]+$/, ""), rows: T.parseCSV(text) }] };
  };

  const xml = (s) => new DOMParser().parseFromString(s, "application/xml");
  const all = (n, name) => Array.prototype.slice.call(n.getElementsByTagNameNS("*", name));
  const colIndex = (ref) => { let n = 0; const m = /^[A-Z]+/.exec(ref)[0]; for (const ch of m) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

  async function readXLSX(buf) {
    if (!window.JSZip) throw new Error("Libreria Excel non caricata.");
    const zip = await JSZip.loadAsync(buf);
    const get = async (p) => { const f = zip.file(p); return f ? f.async("string") : null; };
    const wbX = await get("xl/workbook.xml");
    if (!wbX) throw new Error("Il file non sembra un Excel valido.");
    const rels = {};
    const relX = await get("xl/_rels/workbook.xml.rels");
    if (relX) all(xml(relX), "Relationship").forEach((r) => (rels[r.getAttribute("Id")] = r.getAttribute("Target")));
    const shared = [];
    const ssX = await get("xl/sharedStrings.xml");
    if (ssX) all(xml(ssX), "si").forEach((si) => {
      shared.push(all(si, "t").filter((t) => !t.parentNode.localName.startsWith("rPh")).map((t) => t.textContent).join(""));
    });
    // stili: quali formati sono date
    const dateXf = [];
    const stX = await get("xl/styles.xml");
    if (stX) {
      const sd = xml(stX), custom = {};
      all(sd, "numFmt").forEach((n) => (custom[n.getAttribute("numFmtId")] = n.getAttribute("formatCode") || ""));
      const xfs = all(sd, "cellXfs")[0];
      if (xfs) all(xfs, "xf").forEach((x) => {
        const id = +x.getAttribute("numFmtId") || 0;
        let isD = BUILTIN_DATE.has(id);
        if (!isD && custom[id]) isD = /[ymd]/i.test(custom[id].replace(/"[^"]*"|\[[^\]]*\]|\\./g, ""));
        dateXf.push(isD);
      });
    }
    const sheets = [];
    for (const s of all(xml(wbX), "sheet")) {
      const rid = s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || s.getAttribute("r:id");
      let target = rels[rid] || "";
      target = target.replace(/^\//, "").replace(/^(?!xl\/)/, "xl/");
      const sx = await get(target);
      if (!sx) continue;
      const rows = [];
      all(xml(sx), "row").forEach((r) => {
        const rn = (+r.getAttribute("r") || rows.length + 1) - 1;
        const arr = rows[rn] || (rows[rn] = []);
        let pos = 0;
        all(r, "c").forEach((c) => {
          const ref = c.getAttribute("r");
          const ci = ref ? colIndex(ref) : pos; pos = ci + 1;
          const t = c.getAttribute("t"), vN = all(c, "v")[0], v = vN ? vN.textContent : "";
          let val = "";
          if (t === "s") val = shared[+v] != null ? shared[+v] : "";
          else if (t === "inlineStr") val = all(c, "t").map((x) => x.textContent).join("");
          else if (t === "str") val = v;
          else if (t === "b") val = v === "1" ? "VERO" : "FALSO";
          else if (t === "e") val = "";
          else if (v !== "") {
            const si = +c.getAttribute("s") || 0;
            val = dateXf[si] && isFinite(+v) ? serialToISO(+v) : v;
          }
          arr[ci] = val;
        });
      });
      for (let i = 0; i < rows.length; i++) rows[i] = rows[i] ? Array.from(rows[i], (x) => (x == null ? "" : x)) : [];
      sheets.push({ name: s.getAttribute("name"), rows: trim(rows) });
    }
    return { sheets };
  }

  /* ---------- scrittura di un .xlsx ----------
     sheets: [{ name, cols:[{title, type:"text"|"int"|"year"|"money"|"date", width}], rows:[[valori…]] }] */
  const esc = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const colName = (i) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = ((i - 1) / 26) | 0; } return s; };
  const STYLE = { text: 0, header: 1, int: 2, year: 0, money: 3, date: 4 };

  T.scriviXLSX = async (sheets) => {
    if (!window.JSZip) throw new Error("Libreria Excel non caricata.");
    const z = new JSZip();
    const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
    const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    z.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
    z.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    z.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${NS} xmlns:r="${R}"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`);
    z.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="${R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="${R}/styles" Target="styles.xml"/></Relationships>`);
    z.file("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet ${NS}><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0\\ &quot;€&quot;"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B0D12"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
    sheets.forEach((s, i) => {
      const nC = s.cols.length, nR = s.rows.length + 1;
      let rows = `<row r="1" ht="22" customHeight="1">${s.cols.map((c, ci) => `<c r="${colName(ci)}1" s="1" t="inlineStr"><is><t>${esc(c.title)}</t></is></c>`).join("")}</row>`;
      s.rows.forEach((r, ri) => {
        let cells = "";
        s.cols.forEach((c, ci) => {
          let v = r[ci];
          if (v === "" || v == null) return;
          const ref = colName(ci) + (ri + 2);
          if (c.type === "int" || c.type === "year" || c.type === "money") { const n = +v; if (isFinite(n)) cells += `<c r="${ref}" s="${STYLE[c.type]}"><v>${n}</v></c>`; }
          else if (c.type === "date") { const sn = T.isoToSerial(v); cells += sn != null ? `<c r="${ref}" s="${STYLE.date}"><v>${sn}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`; }
          else cells += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
        });
        rows += `<row r="${ri + 2}">${cells}</row>`;
      });
      z.file(`xl/worksheets/sheet${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${NS}><dimension ref="A1:${colName(nC - 1)}${nR}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${s.cols.map((c, ci) => `<col min="${ci + 1}" max="${ci + 1}" width="${c.width || 14}" customWidth="1"/>`).join("")}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${colName(nC - 1)}${nR}"/></worksheet>`);
    });
    return z.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", compression: "DEFLATE" });
  };

  /* ---------- scarico di un file ---------- */
  T.scarica = (blobOrText, nome, tipo) => {
    const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type: tipo || "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };
})();
