import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PageShell } from "./route";
import { getMyCv, saveCv } from "@/lib/features.functions";
import { toast } from "sonner";
import { Save, Loader2, Plus, Trash2, Printer, FileDown, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cv")({
  head: () => ({
    meta: [
      { title: "CV Builder · Automated Recommendation System" },
      { name: "description", content: "Build a clean, ATS-friendly CV with Tailwind styling." },
      { property: "og:title", content: "CV Builder · Automated Recommendation System" },
      { property: "og:description", content: "Structured CV editor with live preview." },
    ],
  }),
  component: CvPage,
});

type CvData = {
  full_name: string; headline: string; email: string; phone: string; location: string;
  links: { label: string; url: string }[];
  summary: string;
  experience: { role: string; company: string; period: string; bullets: string[] }[];
  education: { school: string; degree: string; period: string }[];
  skills: string[];
  projects: { name: string; description: string; url?: string }[];
};

const empty: CvData = { full_name: "", headline: "", email: "", phone: "", location: "", links: [], summary: "", experience: [], education: [], skills: [], projects: [] };

function CvPage() {
  const getFn = useServerFn(getMyCv);
  const save = useServerFn(saveCv);
  const qc = useQueryClient();
  const { data: existing } = useQuery({ queryKey: ["cv"], queryFn: () => getFn() });
  const [id, setId] = useState<string | undefined>();
  const [title, setTitle] = useState("My CV");
  const [d, setD] = useState<CvData>(empty);

  useEffect(() => {
    if (existing) {
      setId(existing.id);
      setTitle(existing.title);
      setD({ ...empty, ...(existing.data as Partial<CvData>) });
    }
  }, [existing]);

  const saveMut = useMutation({
    mutationFn: () => save({ data: { id, title, template: "minimal", data: d } }),
    onSuccess: (r) => { setId(r.id); qc.invalidateQueries({ queryKey: ["cv"] }); toast.success("Saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const upd = <K extends keyof CvData>(k: K, v: CvData[K]) => setD({ ...d, [k]: v });

  const [downloading, setDownloading] = useState<null | "pdf" | "docx">(null);

  const fileBase = (title || d.full_name || "cv").replace(/[^a-z0-9-_]+/gi, "_");

  const downloadPdf = async () => {
    setDownloading("pdf");
    try {
      const el = document.getElementById("cv-preview");
      if (!el) throw new Error("Preview not found");
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
      pdf.save(`${fileBase}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setDownloading(null);
    }
  };

  const downloadDocx = async () => {
    setDownloading("docx");
    try {
      const el = document.getElementById("cv-preview");
      if (!el) throw new Error("Preview not found");
      const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Calibri,Automated Recommendation Systeml,sans-serif;color:#0f172a;} h1{font-size:26pt;margin:0 0 4pt;} h2{font-size:11pt;text-transform:uppercase;letter-spacing:1.5pt;color:#64748b;margin:14pt 0 4pt;border-bottom:1px solid #e2e8f0;padding-bottom:2pt;} ul{margin:4pt 0 4pt 18pt;} .meta{color:#64748b;font-size:10pt;} .row{display:flex;justify-content:space-between;} .muted{color:#64748b;} .tag{display:inline-block;background:#f1f5f9;padding:2pt 6pt;margin:2pt;border-radius:4pt;font-size:9pt;}</style></head><body>${el.innerHTML}</body></html>`;
      const blob = new Blob(["\ufeff", html], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBase}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Word file downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Word export failed");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <PageShell title="CV Builder" subtitle="Left: edit. Right: live Tailwind preview. Print to PDF from your browser.">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm text-cream disabled:opacity-50">
          {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
        </button>
        <button onClick={downloadPdf} disabled={downloading !== null} className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm disabled:opacity-50">
          {downloading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Download PDF
        </button>
        <button onClick={downloadDocx} disabled={downloading !== null} className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm disabled:opacity-50">
          {downloading === "docx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Download Word
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm"><Printer className="h-4 w-4" /> Print</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 print:hidden">
          <Card title="Basics">
            <Grid>
              <TF label="Full name" v={d.full_name} on={(v) => upd("full_name", v)} />
              <TF label="Headline" v={d.headline} on={(v) => upd("headline", v)} />
              <TF label="Email" v={d.email} on={(v) => upd("email", v)} />
              <TF label="Phone" v={d.phone} on={(v) => upd("phone", v)} />
              <TF label="Location" v={d.location} on={(v) => upd("location", v)} />
            </Grid>
            <Area label="Summary" v={d.summary} on={(v) => upd("summary", v)} rows={3} />
          </Card>

          <Card title="Experience" onAdd={() => upd("experience", [...d.experience, { role: "", company: "", period: "", bullets: [""] }])}>
            {d.experience.map((e, i) => (
              <div key={i} className="mb-3 rounded-lg border border-border p-3">
                <Grid>
                  <TF label="Role" v={e.role} on={(v) => upd("experience", d.experience.map((x, j) => j === i ? { ...x, role: v } : x))} />
                  <TF label="Company" v={e.company} on={(v) => upd("experience", d.experience.map((x, j) => j === i ? { ...x, company: v } : x))} />
                  <TF label="Period" v={e.period} on={(v) => upd("experience", d.experience.map((x, j) => j === i ? { ...x, period: v } : x))} />
                </Grid>
                <Area label="Bullets (one per line)" v={e.bullets.join("\n")} on={(v) => upd("experience", d.experience.map((x, j) => j === i ? { ...x, bullets: v.split("\n") } : x))} rows={3} />
                <button onClick={() => upd("experience", d.experience.filter((_, j) => j !== i))} className="mt-1 flex items-center gap-1 text-xs text-destructive"><Trash2 className="h-3 w-3" />Remove</button>
              </div>
            ))}
          </Card>

          <Card title="Education" onAdd={() => upd("education", [...d.education, { school: "", degree: "", period: "" }])}>
            {d.education.map((e, i) => (
              <div key={i} className="mb-3 rounded-lg border border-border p-3">
                <Grid>
                  <TF label="School" v={e.school} on={(v) => upd("education", d.education.map((x, j) => j === i ? { ...x, school: v } : x))} />
                  <TF label="Degree" v={e.degree} on={(v) => upd("education", d.education.map((x, j) => j === i ? { ...x, degree: v } : x))} />
                  <TF label="Period" v={e.period} on={(v) => upd("education", d.education.map((x, j) => j === i ? { ...x, period: v } : x))} />
                </Grid>
                <button onClick={() => upd("education", d.education.filter((_, j) => j !== i))} className="mt-1 flex items-center gap-1 text-xs text-destructive"><Trash2 className="h-3 w-3" />Remove</button>
              </div>
            ))}
          </Card>

          <Card title="Skills">
            <Area label="Comma-separated" v={d.skills.join(", ")} on={(v) => upd("skills", v.split(",").map((s) => s.trim()).filter(Boolean))} rows={2} />
          </Card>

          <Card title="Projects" onAdd={() => upd("projects", [...d.projects, { name: "", description: "", url: "" }])}>
            {d.projects.map((p, i) => (
              <div key={i} className="mb-3 rounded-lg border border-border p-3">
                <Grid>
                  <TF label="Name" v={p.name} on={(v) => upd("projects", d.projects.map((x, j) => j === i ? { ...x, name: v } : x))} />
                  <TF label="URL" v={p.url ?? ""} on={(v) => upd("projects", d.projects.map((x, j) => j === i ? { ...x, url: v } : x))} />
                </Grid>
                <Area label="Description" v={p.description} on={(v) => upd("projects", d.projects.map((x, j) => j === i ? { ...x, description: v } : x))} rows={2} />
                <button onClick={() => upd("projects", d.projects.filter((_, j) => j !== i))} className="mt-1 flex items-center gap-1 text-xs text-destructive"><Trash2 className="h-3 w-3" />Remove</button>
              </div>
            ))}
          </Card>
        </div>

        <div className="print:col-span-2">
          <div id="cv-preview" className="mx-auto max-w-[780px] rounded-2xl border border-border bg-white p-10 text-slate-900 shadow-panel print:rounded-none print:border-0 print:shadow-none">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-3xl font-semibold tracking-tight">{d.full_name || "Your name"}</h1>
              <div className="mt-1 text-sm text-slate-600">{d.headline || "Headline"}</div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {d.email && <span>{d.email}</span>}
                {d.phone && <span>{d.phone}</span>}
                {d.location && <span>{d.location}</span>}
              </div>
            </div>
            {d.summary && <Section title="Summary"><p className="text-sm leading-relaxed">{d.summary}</p></Section>}
            {d.experience.length > 0 && (
              <Section title="Experience">
                {d.experience.map((e, i) => (
                  <div key={i} className="mb-3">
                    <div className="flex items-baseline justify-between">
                      <div className="font-medium">{e.role} <span className="text-slate-500">· {e.company}</span></div>
                      <div className="text-xs text-slate-500">{e.period}</div>
                    </div>
                    <ul className="mt-1 list-disc pl-5 text-sm">{e.bullets.filter(Boolean).map((b, j) => <li key={j}>{b}</li>)}</ul>
                  </div>
                ))}
              </Section>
            )}
            {d.projects.length > 0 && (
              <Section title="Projects">
                {d.projects.map((p, i) => (
                  <div key={i} className="mb-2">
                    <div className="font-medium">{p.name}{p.url && <a href={p.url} className="ml-2 text-xs text-blue-600">↗</a>}</div>
                    <div className="text-sm">{p.description}</div>
                  </div>
                ))}
              </Section>
            )}
            {d.education.length > 0 && (
              <Section title="Education">
                {d.education.map((e, i) => (
                  <div key={i} className="flex items-baseline justify-between">
                    <div><span className="font-medium">{e.degree}</span> <span className="text-slate-500">· {e.school}</span></div>
                    <div className="text-xs text-slate-500">{e.period}</div>
                  </div>
                ))}
              </Section>
            )}
            {d.skills.length > 0 && (
              <Section title="Skills">
                <div className="flex flex-wrap gap-1.5">{d.skills.map((s) => <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">{s}</span>)}</div>
              </Section>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function Card({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd?: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-panel">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        {onAdd && <button onClick={onAdd} className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs"><Plus className="h-3 w-3" /> Add</button>}
      </div>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid gap-3 sm:grid-cols-2">{children}</div>; }
function TF({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span><input value={v} onChange={(e) => on(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ember" /></label>;
}
function Area({ label, v, on, rows }: { label: string; v: string; on: (v: string) => void; rows: number }) {
  return <label className="mt-3 block"><span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span><textarea value={v} onChange={(e) => on(e.target.value)} rows={rows} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ember" /></label>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-4"><h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</h2>{children}</div>;
}
