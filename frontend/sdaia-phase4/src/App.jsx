import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

export default function App() {
  const [file, setFile] = useState(null);
  const [fileId, setFileId] = useState("");
  const [uploading, setUploading] = useState(false);

  const [sens, setSens] = useState(null);
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState("");

  async function doUpload() {
    setError(""); setSens(null); setAudit(null);
    if (!file) { setError("Choose a file first."); return; }

    const form = new FormData();
    form.append("file", file);

    setUploading(true);
    try {
      const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setFileId(data.file_id);
    } catch (e) {
      setError(`Upload failed: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function checkSensitivity() {
    setError(""); setSens(null);
    try {
      const res = await fetch(`${API_BASE}/sensitivity?file_id=${encodeURIComponent(fileId)}`);
      if (!res.ok) throw new Error(await res.text());
      setSens(await res.json());
    } catch (e) {
      setError(`Sensitivity failed: ${e.message}`);
    }
  }

  async function runAudit() {
    setError(""); setAudit(null);
    try {
      const res = await fetch(`${API_BASE}/audit?file_id=${encodeURIComponent(fileId)}`);
      if (!res.ok) throw new Error(await res.text());
      setAudit(await res.json());
    } catch (e) {
      setError(`Audit failed: ${e.message}`);
    }
  }

  return (
    <div style={{maxWidth: 900, margin: "40px auto", fontFamily: "system-ui, sans-serif"}}>
      <h1>SDAIA Phase 4 Tester</h1>

      <section style={{border: "1px solid #ddd", padding: 16, borderRadius: 8, marginBottom: 16}}>
        <h3>1) Upload a policy file</h3>
        <input type="file" accept=".pdf,.txt,.doc,.docx" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <button onClick={doUpload} disabled={uploading} style={{marginLeft: 8}}>
          {uploading ? "Uploading..." : "Upload"}
        </button>
        {fileId && <div style={{marginTop: 8}}>file_id: <code>{fileId}</code></div>}
        {error && <div style={{marginTop: 8, color: "crimson"}}>{error}</div>}
      </section>

      <section style={{border: "1px solid #ddd", padding: 16, borderRadius: 8, marginBottom: 16}}>
        <h3>2) Actions (after upload)</h3>
        <button onClick={checkSensitivity} disabled={!fileId} style={{marginRight: 8}}>Check Sensitivity</button>
        <button onClick={runAudit} disabled={!fileId}>Audit vs SDAIA</button>
        {!fileId && <div style={{marginTop: 8, color: "#555"}}>Upload first to enable actions.</div>}
      </section>

      {sens && (
        <section style={{border: "1px solid #ddd", padding: 16, borderRadius: 8, marginBottom: 16}}>
          <h3>Sensitivity</h3>
          <div><b>is_sensitive:</b> {sens.is_sensitive ? "Yes" : "No"}</div>
          <div><b>summary:</b> {sens.summary}</div>
          <h4 style={{marginTop: 12}}>findings</h4>
          {sens.findings?.length ? (
            <table width="100%" cellPadding="6" style={{borderCollapse: "collapse"}}>
              <thead>
                <tr style={{background:"#f6f6f6"}}>
                  <th align="left">type</th><th align="left">value</th><th>page</th><th>severity</th>
                </tr>
              </thead>
              <tbody>
                {sens.findings.map((f,i)=>(
                  <tr key={i}>
                    <td>{f.type}</td>
                    <td style={{fontFamily:"monospace"}}>{f.value}</td>
                    <td align="center">{f.page ?? "-"}</td>
                    <td align="center">{f.severity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div>No regex matches found.</div>}
        </section>
      )}

      {audit && (
        <section style={{border: "1px solid #ddd", padding: 16, borderRadius: 8}}>
          <h3>Audit vs SDAIA</h3>
          <div><b>compliance_score:</b> {audit.compliance_score}%</div>
          <div><b>coverage_summary:</b> {audit.coverage_summary}</div>

          <h4 style={{marginTop: 12}}>violations</h4>
          {audit.violations?.length ? (
            <table width="100%" cellPadding="6" style={{borderCollapse: "collapse"}}>
              <thead>
                <tr style={{background:"#f6f6f6"}}>
                  <th align="left">document</th>
                  <th>page</th>
                  <th align="left">section</th>
                  <th align="left">regulation_citation</th>
                  <th align="left">value</th>
                  <th align="left">explanation</th>
                </tr>
              </thead>
              <tbody>
                {audit.violations.map((v,i)=>(
                  <tr key={i}>
                    <td>{v.document}</td>
                    <td align="center">{v.page ?? "-"}</td>
                    <td>{v.section ?? "-"}</td>
                    <td>{v.regulation_citation}</td>
                    <td>{v.value}</td>
                    <td>{v.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div>No violations reported.</div>}

          <h4 style={{marginTop: 12}}>citations used</h4>
          <ul>
            {audit.used_context?.map((c,i)=>(<li key={i} style={{fontFamily:"monospace"}}>{c}</li>))}
          </ul>
        </section>
      )}
    </div>
  );
}